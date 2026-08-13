// ============================================================
// Utilitários de data + renderização das três visões de
// calendário (semana, mês, heatmap de 6 meses).
// Tudo em fuso local (evita o clássico bug de "dia errado" do UTC).
// ============================================================

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
  if(!satisfies(toDateKey(cursor))){
    cursor = addDays(cursor, -1);
    if(!satisfies(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while(satisfies(toDateKey(cursor))){
    streak++;
    cursor = addDays(cursor, -1);
    // trava de segurança: não recua antes da criação do hábito
    if(habit.createdAt?.toDate && cursor < habit.createdAt.toDate()) break;
    if(streak > 3650) break;
  }
  return streak;
}

// ------------------------------------------------------------
// Semana
// ------------------------------------------------------------
export function renderWeek(container, habit, logs, refDate, onToggle){
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
      <span class="day-stamp ${filled ? "" : "is-empty"}" style="${filled ? `background:${habit.color}` : ""}">
        ${filled ? stampContent(habit, log) : ""}
      </span>
      ${habit.type === "count" && filled ? `<span class="day-count">${log.value}${habit.target ? "/"+habit.target : ""}</span>` : ""}
    `;
    cell.addEventListener("click", () => onToggle(key, log));
    if(habit.type === "count"){
      cell.addEventListener("contextmenu", (e) => { e.preventDefault(); onToggle(key, log, true); });
      cell.title = "Clique para somar · clique direito para tirar";
    }
    grid.appendChild(cell);
  });

  container.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = parseInt(btn.dataset.nav, 10);
      renderWeek(container, habit, logs, addDays(refDate, delta), onToggle);
    });
  });
}

function formatWeekLabel(start){
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = `${start.getDate()} ${sameMonth ? "" : MONTH_NAMES[start.getMonth()].slice(0,3)}`.trim();
  return `${startStr} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
}

function stampContent(habit, log){
  if(habit.goal === "quit") return "✕";
  if(habit.type === "count") return log.value;
  return "✓";
}

// ------------------------------------------------------------
// Mês
// ------------------------------------------------------------
export function renderMonth(container, habit, logs, refDate, onToggle){
  const monthStart = startOfMonth(refDate);
  const gridStart = startOfWeek(monthStart);
  const tKey = todayKey();
  const month = refDate.getMonth();

  container.innerHTML = `
    <div class="range-nav">
      <button class="icon-btn" data-nav="-1">‹</button>
      <span class="range-nav-label">${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}</span>
      <button class="icon-btn" data-nav="1">›</button>
    </div>
    <div class="month-grid"></div>
  `;
  const grid = container.querySelector(".month-grid");
  DOW_SHORT.forEach(d => {
    const el = document.createElement("div");
    el.className = "month-dow";
    el.textContent = d;
    grid.appendChild(el);
  });

  for(let i=0; i<42; i++){
    const d = addDays(gridStart, i);
    const key = toDateKey(d);
    const log = logs[key];
    const outside = d.getMonth() !== month;
    const filled = !!log && log.value > 0;
    const cell = document.createElement("div");
    cell.className = "month-cell" + (outside ? " is-outside" : "") + (key === tKey ? " is-today" : "");
    cell.innerHTML = `
      <span class="month-cell-num">${d.getDate()}</span>
      ${filled ? `<span class="month-stamp" style="background:${habit.color}"></span>` : ""}
    `;
    if(!outside){
      cell.addEventListener("click", () => onToggle(key, log));
      if(habit.type === "count"){
        cell.addEventListener("contextmenu", (e) => { e.preventDefault(); onToggle(key, log, true); });
      }
    }
    grid.appendChild(cell);
  }

  container.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = parseInt(btn.dataset.nav, 10);
      const next = new Date(refDate.getFullYear(), refDate.getMonth()+delta, 1);
      renderMonth(container, habit, logs, next, onToggle);
    });
  });
}

// ------------------------------------------------------------
// Heatmap de 6 meses (estilo "contribuições", semanas x dias)
// ------------------------------------------------------------
export function renderHeatmap(container, habit, logs, onToggle){
  const today = new Date(); today.setHours(0,0,0,0);
  const end = startOfWeek(today);
  const start = addDays(end, -25*7); // ~26 semanas ≈ 6 meses
  const tKey = todayKey();

  const weeks = [];
  for(let w=0; w<=25; w++){
    const weekStart = addDays(start, w*7);
    weeks.push(Array.from({length:7}, (_,i) => addDays(weekStart, i)));
  }

  container.innerHTML = `
    <div class="heatmap-wrap">
      <div class="heatmap-months" id="heatmap-months"></div>
      <div class="heatmap-body">
        <div class="heatmap-dows">
          <span></span><span>Seg</span><span></span><span>Qua</span><span></span><span>Sex</span><span></span>
        </div>
        <div id="heatmap-cols" class="heatmap-body"></div>
      </div>
    </div>
    <div class="heatmap-legend">
      <span>menos</span>
      <span class="heatmap-cell" style="background:var(--ink-800)"></span>
      <span class="heatmap-cell" style="background:${habit.color}66"></span>
      <span class="heatmap-cell" style="background:${habit.color}"></span>
      <span>mais</span>
    </div>
  `;

  const monthsRow = container.querySelector("#heatmap-months");
  const cols = container.querySelector("#heatmap-cols");

  let lastMonth = -1;
  weeks.forEach(week => {
    const col = document.createElement("div");
    col.className = "heatmap-col";
    week.forEach(d => {
      const key = toDateKey(d);
      const log = logs[key];
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.title = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
      if(d > today){
        cell.style.opacity = "0.25";
        cell.style.pointerEvents = "none";
      } else if(log && log.value > 0){
        const intensity = habit.type === "count" && habit.target
          ? Math.min(1, log.value / habit.target)
          : 1;
        cell.style.background = habit.color;
        cell.style.opacity = String(0.45 + intensity*0.55);
      }
      if(key === tKey) cell.style.outline = "1.5px solid var(--paper)";
      cell.addEventListener("click", () => { if(d <= today) onToggle(key, log); });
      if(habit.type === "count"){
        cell.addEventListener("contextmenu", (e) => { e.preventDefault(); if(d <= today) onToggle(key, log, true); });
      }
      col.appendChild(cell);
    });
    cols.appendChild(col);

    const firstDow = week[0];
    if(firstDow.getMonth() !== lastMonth){
      lastMonth = firstDow.getMonth();
      const label = document.createElement("span");
      label.style.minWidth = "15px";
      label.textContent = MONTH_NAMES[firstDow.getMonth()].slice(0,3);
      monthsRow.appendChild(label);
    } else {
      const spacer = document.createElement("span");
      spacer.style.minWidth = "15px";
      monthsRow.appendChild(spacer);
    }
  });
}
