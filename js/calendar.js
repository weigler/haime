// ============================================================
// Utilitários de data + renderização das três visões de
// calendário (semana, mês, heatmap de 6 meses).
// Tudo em fuso local (evita o clássico bug de "dia errado" do UTC).
// ============================================================
import { bindCountTap } from "./interactions.js";

export const DOW_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
export const MONTH_NAMES = ["janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro"];

export function toDateKey(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

export function todayKey(){ return toDateKey(new Date()); }

export function addDays(d, n){
  const r = new Date(d);
  r.setDate(r.getDate()+n);
  return r;
}

export function startOfWeek(d){
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0,0,0,0);
  return r;
}

export function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }

// escolhe texto claro ou escuro conforme o brilho da cor de fundo,
// pra "1x, 2x..." ficar legível em qualquer cor de hábito
export function contrastText(hex){
  const clean = (hex || "#4FA99A").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c+c).join("") : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

// ------------------------------------------------------------
// Cálculo de sequência (streak)
// ------------------------------------------------------------
export function computeStreak(habit, logs){
  const today = new Date(); today.setHours(0,0,0,0);

  const satisfies = (key) => {
    const log = logs[key];
    if(habit.goal === "quit"){
      return !log; // dia sem registro = dia limpo
    }
    if(!log) return false;
    if(habit.type === "count" && habit.target){ return log.value >= habit.target; }
    return log.value > 0;
  };

  // ponto de partida: hoje, com tolerância de 1 dia se hoje ainda não foi marcado
  let cursor = new Date(today);
  if(habit.goal === "quit"){
    // hábito de abandonar: um registro hoje é uma recaída confirmada —
    // a sequência zera na hora, sem a tolerância de 1 dia.
    if(!satisfies(toDateKey(cursor))) return 0;
  } else {
    // hábito de construir: tolerância de 1 dia — talvez a pessoa ainda
    // não tenha marcado hoje porque o dia não acabou.
    if(!satisfies(toDateKey(cursor))){
      cursor = addDays(cursor, -1);
      if(!satisfies(toDateKey(cursor))) return 0;
    }
  }

  let streak = 0;
  // pra hábitos de abandonar, o limite de quão longe a sequência pode
  // recuar é a data mais antiga que a gente realmente conhece: a
  // criação do hábito OU o registro (recaída) mais antigo já feito —
  // o que vier primeiro. Sem isso, marcar retroativamente uma recaída
  // antiga (ex.: registrar que usou em dias antes de começar a
  // acompanhar no app) ficava presa atrás da data de criação, cortando
  // a sequência de dias limpos cedo demais.
  let quitBoundaryKey = null;
  if(habit.goal === "quit"){
    const createdKey = habit.createdAt?.toDate ? toDateKey(habit.createdAt.toDate()) : null;
    const logKeys = Object.keys(logs);
    const earliestLogKey = logKeys.length ? logKeys.reduce((min, k) => (k < min ? k : min), logKeys[0]) : null;
    if(createdKey && earliestLogKey) quitBoundaryKey = createdKey < earliestLogKey ? createdKey : earliestLogKey;
    else quitBoundaryKey = createdKey || earliestLogKey;
  }
  while(satisfies(toDateKey(cursor))){
    streak++;
    if(habit.goal === "quit" && quitBoundaryKey && toDateKey(cursor) <= quitBoundaryKey) break;
    cursor = addDays(cursor, -1);
    if(streak > 3650) break;
  }
  return streak;
}

// ------------------------------------------------------------
// Semana
// ------------------------------------------------------------
export function renderWeek(container, habit, logs, refDate, onToggle, onNavigate){
  const start = startOfWeek(refDate);
  const days = Array.from({length:7}, (_,i) => addDays(start, i));
  const tKey = todayKey();

  container.innerHTML = `
    <div class="range-nav">
      <button class="icon-btn" data-nav="-7">‹</button>
      <span class="range-nav-label">${formatWeekLabel(start)}</span>
      <button class="icon-btn" data-nav="7">›</button>
    </div>
    <div class="week-grid"></div>
  `;
  const grid = container.querySelector(".week-grid");

  days.forEach(d => {
    const key = toDateKey(d);
    const log = logs[key];
    const cell = document.createElement("div");
    cell.className = "day-cell" + (key === tKey ? " is-today" : "");
    const filled = !!log && log.value > 0;
    cell.innerHTML = `
      <span class="day-cell-dow">${DOW_SHORT[d.getDay()]}</span>
      <span class="day-cell-num">${d.getDate()}</span>
      <span class="day-stamp ${filled ? "" : "is-empty"}" style="${filled ? `background:${habit.color}33` : ""}">
        ${filled ? habit.icon : ""}
        ${filled && habit.type === "count" ? `<span class="day-count-badge">${log.value}${habit.target ? "/"+habit.target : ""}</span>` : ""}
      </span>
    `;
    if(habit.type === "count"){
      bindCountTap(cell, () => onToggle(key, log), () => onToggle(key, log, true));
      cell.title = "Toque para somar · clique direito ou toque e segure para tirar";
    } else {
      cell.addEventListener("click", () => onToggle(key, log));
    }
    grid.appendChild(cell);
  });

  container.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = parseInt(btn.dataset.nav, 10);
      const newDate = addDays(refDate, delta);
      if(onNavigate) onNavigate(newDate);
      renderWeek(container, habit, logs, newDate, onToggle, onNavigate);
    });
  });
}

function formatWeekLabel(start){
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = `${start.getDate()} ${sameMonth ? "" : MONTH_NAMES[start.getMonth()].slice(0,3)}`.trim();
  return `${startStr} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

// ------------------------------------------------------------
// Mês — matriz de 4 semanas (4x7 = 28 dias), sempre as mais
// recentes até hoje. Sem navegação: é uma janela "rolante".
// ------------------------------------------------------------
export function renderMonth(container, habit, logs, onToggle){
  const currentWeekStart = startOfWeek(new Date());
  const start = addDays(currentWeekStart, -21); // 4 semanas, começando pela mais antiga
  const days = Array.from({length:28}, (_,i) => addDays(start, i));
  const tKey = todayKey();
  const today = new Date(); today.setHours(0,0,0,0);

  container.innerHTML = `
    <div class="range-nav range-nav-static">
      <span class="range-nav-label">${formatRangeLabel(start, addDays(start, 27))}</span>
    </div>
    <div class="month-dow-row"></div>
    <div class="month-grid"></div>
  `;
  const dowRow = container.querySelector(".month-dow-row");
  DOW_SHORT.forEach(d => {
    const el = document.createElement("span");
    el.className = "month-dow";
    el.textContent = d[0];
    dowRow.appendChild(el);
  });

  const grid = container.querySelector(".month-grid");
  days.forEach(d => {
    const key = toDateKey(d);
    const log = logs[key];
    const filled = !!log && log.value > 0;
    const future = d > today;
    const cell = document.createElement("div");
    cell.className = "month-cell" + (key === tKey ? " is-today" : "") + (future ? " is-outside" : "");
    let stampHtml = "";
    let numStyle = "";
    if(filled){
      const ink = contrastText(habit.color);
      numStyle = ` style="color:${ink}"`;
      if(habit.type === "count"){
        const intensity = habit.target ? Math.min(1, log.value / habit.target) : 1;
        stampHtml = `
          <span class="month-stamp" style="background:${habit.color};opacity:${(0.55+intensity*0.45).toFixed(2)}"></span>
          <span class="month-stamp-count" style="background:${habit.color};color:${ink}">${log.value}x</span>`;
      } else {
        stampHtml = `<span class="month-stamp" style="background:${habit.color}"></span>`;
      }
    }
    cell.innerHTML = `
      <span class="month-cell-num"${numStyle}>${d.getDate()}</span>
      ${stampHtml}
    `;
    if(filled && habit.type === "count"){
      cell.title = `${log.value}${habit.target ? "/"+habit.target : ""}`;
    }
    if(!future){
      if(habit.type === "count"){
        bindCountTap(cell, () => onToggle(key, log), () => onToggle(key, log, true));
      } else {
        cell.addEventListener("click", () => onToggle(key, log));
      }
    }
    grid.appendChild(cell);
  });
}

function formatRangeLabel(start, end){
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = sameMonth ? `${start.getDate()}` : `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0,3)}`;
  return `${startStr} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

// ------------------------------------------------------------
// Semestral — matriz de 24 semanas (24x7 = 168 dias). A grade
// ocupa toda a largura disponível (igual às outras visões) e os
// quadrados se ajustam ao espaço — sem precisar de rolagem lateral.
// ------------------------------------------------------------
export function renderHeatmap(container, habit, logs, onToggle){
  const today = new Date(); today.setHours(0,0,0,0);
  const end = startOfWeek(today);
  const start = addDays(end, -23*7); // 24 semanas
  const tKey = todayKey();

  const weeks = [];
  for(let w=0; w<24; w++){
    const weekStart = addDays(start, w*7);
    weeks.push(Array.from({length:7}, (_,i) => addDays(weekStart, i)));
  }

  container.innerHTML = `
    <div class="heatmap-scroll">
      <div class="heatmap-top">
        <span class="heatmap-top-spacer"></span>
        <div class="heatmap-months" id="heatmap-months"></div>
      </div>
      <div class="heatmap-body">
        <div class="heatmap-dows">
          <span></span><span>Seg</span><span></span><span>Qua</span><span></span><span>Sex</span><span></span>
        </div>
        <div id="heatmap-grid" class="heatmap-grid"></div>
      </div>
    </div>
    <div class="heatmap-legend">
      <span>menos</span>
      <span class="heatmap-cell" style="background:var(--surface)"></span>
      <span class="heatmap-cell" style="background:${habit.color}66"></span>
      <span class="heatmap-cell" style="background:${habit.color}"></span>
      <span>mais</span>
    </div>
  `;

  const monthsRow = container.querySelector("#heatmap-months");
  const grid = container.querySelector("#heatmap-grid");

  let lastMonth = -1;
  weeks.forEach(week => {
    const firstDow = week[0];
    const label = document.createElement("span");
    if(firstDow.getMonth() !== lastMonth){
      lastMonth = firstDow.getMonth();
      label.textContent = MONTH_NAMES[firstDow.getMonth()].slice(0,3);
    }
    monthsRow.appendChild(label);

    week.forEach(d => {
      const key = toDateKey(d);
      const log = logs[key];
      const filled = !!log && log.value > 0;
      const future = d > today;
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.title = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

      if(future){
        cell.style.opacity = "0.25";
        cell.style.pointerEvents = "none";
      } else if(filled){
        const intensity = habit.type === "count" && habit.target
          ? Math.min(1, log.value / habit.target)
          : 1;
        cell.style.background = habit.color;
        cell.style.opacity = String(0.55 + intensity*0.45);
        if(habit.type === "count"){
          cell.textContent = `${log.value}x`;
          cell.style.color = contrastText(habit.color);
          cell.title = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · ${log.value}${habit.target ? "/"+habit.target : ""}`;
        }
      }
      if(key === tKey) cell.style.boxShadow = "inset 0 0 0 1.5px var(--text-faint)";

      if(!future){
        if(habit.type === "count"){
          bindCountTap(cell, () => onToggle(key, log), () => onToggle(key, log, true));
        } else {
          cell.addEventListener("click", () => onToggle(key, log));
        }
      }
      grid.appendChild(cell);
    });
  });
}
