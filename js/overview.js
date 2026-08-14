import { watchHabits, watchLogs, setLog } from "./db.js";
import { toDateKey, addDays, startOfWeek, todayKey, DOW_SHORT, MONTH_NAMES, contrastText } from "./calendar.js";
import { showPanel, setActiveNav, registerTeardown, teardownOthers } from "./panel-router.js";
import { bindCountTap } from "./interactions.js";

let uid = null;
let habitsUnsub = null;
let logUnsubs = {};
let habits = [];
let logsMap = {};
let currentView = "week";
let active = false;

const btnOverview = document.getElementById("btn-overview");
const containers = {
  week: document.getElementById("overview-week"),
  month: document.getElementById("overview-month"),
  semester: document.getElementById("overview-semester"),
};

export function initOverviewUid(userId){
  uid = userId;
}

export function teardownOverview(){
  active = false;
  if(habitsUnsub){ habitsUnsub(); habitsUnsub = null; }
  Object.values(logUnsubs).forEach(fn => fn());
  logUnsubs = {};
  logsMap = {};
  habits = [];
  // limpa qualquer conteúdo renderizado, para não deixar rastro de outra conta
  Object.values(containers).forEach(el => { el.innerHTML = ""; });
}
registerTeardown("overview", teardownOverview);

btnOverview.addEventListener("click", () => {
  teardownOthers("overview");
  active = true;
  showPanel("overview");
  setActiveNav(btnOverview);
  subscribe();
});

document.querySelectorAll('[data-oview]').forEach(tab => {
  tab.addEventListener("click", () => {
    currentView = tab.dataset.oview;
    document.querySelectorAll('[data-oview]').forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    Object.entries(containers).forEach(([key, el]) => el.classList.toggle("is-hidden", key !== currentView));
    render();
  });
});

function subscribe(){
  if(habitsUnsub) habitsUnsub();
  habitsUnsub = watchHabits(uid, (list) => {
    habits = list.filter(h => !h.archived);
    syncLogSubscriptions();
    render();
  });
}

function syncLogSubscriptions(){
  const ids = new Set(habits.map(h => h.id));
  Object.keys(logUnsubs).forEach(id => {
    if(!ids.has(id)){ logUnsubs[id](); delete logUnsubs[id]; delete logsMap[id]; }
  });
  habits.forEach(h => {
    if(!logUnsubs[h.id]){
      logUnsubs[h.id] = watchLogs(uid, h.id, (logs) => {
        logsMap[h.id] = logs;
        if(active) render();
      });
    }
  });
}

function render(){
  if(!active) return;
  if(habits.length === 0){
    Object.values(containers).forEach(el => {
      el.innerHTML = `<p class="overview-empty">Crie um hábito para ver a visão geral.</p>`;
    });
    return;
  }
  if(currentView === "week") renderWeekStrip(containers.week);
  if(currentView === "month") renderWeekGrid(containers.month, weeksForCurrentMonth());
  if(currentView === "semester") renderWeekGrid(containers.semester, weeksForSemester());
}

// ------------------------------------------------------------
// Semana: uma tira de 7 dias por hábito (formato de lista)
// ------------------------------------------------------------
function weekDays(){
  const start = startOfWeek(new Date());
  return Array.from({length:7}, (_,i) => addDays(start, i));
}

function renderWeekStrip(container){
  const days = weekDays();
  const tKey = todayKey();

  const header = `
    <div class="overview-row overview-header">
      <div class="overview-label"></div>
      <div class="overview-cells">
        ${days.map(d => `<span class="overview-col-label">${d.getDate()}</span>`).join("")}
      </div>
    </div>`;

  const rows = habits.map(h => {
    const logs = logsMap[h.id] || {};
    const cells = days.map(d => {
      const key = toDateKey(d);
      const log = logs[key];
      const filled = !!log && log.value > 0;
      const isToday = key === tKey;
      const isFuture = d > new Date();
      const style = filled ? `background:${h.color};border-color:${h.color}` : "";
      const readonly = isFuture ? " is-readonly" : "";
      return `<span class="overview-cell${isToday ? " is-today" : ""}${readonly}" style="${style}" data-habit="${h.id}" data-date="${key}" title="${escapeHtml(h.name)} · ${d.getDate()}/${d.getMonth()+1}"></span>`;
    }).join("");
    return `
      <div class="overview-row">
        <div class="overview-label">
          <span class="overview-label-dot" style="background:${h.color}33;color:${h.color}">${h.icon}</span>
          <span class="overview-label-name">${escapeHtml(h.name)}</span>
        </div>
        <div class="overview-cells">${cells}</div>
      </div>`;
  }).join("");

  container.innerHTML = `<div class="overview-scroll"><div class="overview-grid-wrap">${header}${rows}</div></div>`;
  wireCells(container);
}

// ------------------------------------------------------------
// Mensal / Semestral: um mini-heatmap por hábito, semanas em
// colunas e dias da semana em linhas (7 linhas sempre).
// ------------------------------------------------------------
function weeksForCurrentMonth(){
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth()+1, 0);
  const gridStart = startOfWeek(monthStart);
  const gridEndWeek = startOfWeek(monthEnd);

  const weeks = [];
  let cursor = gridStart;
  while(cursor <= gridEndWeek){
    weeks.push(Array.from({length:7}, (_,i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function weeksForSemester(){
  const today = new Date(); today.setHours(0,0,0,0);
  const end = startOfWeek(today);
  const start = addDays(end, -23*7); // 24 semanas
  const weeks = [];
  for(let w=0; w<24; w++){
    const weekStart = addDays(start, w*7);
    weeks.push(Array.from({length:7}, (_,i) => addDays(weekStart, i)));
  }
  return weeks;
}

function renderWeekGrid(container, weeks){
  const today = new Date(); today.setHours(0,0,0,0);
  const tKey = todayKey();

  const blocks = habits.map(h => {
    const logs = logsMap[h.id] || {};
    let lastMonth = -1;

    const monthLabels = weeks.map(week => {
      const firstDow = week[0];
      let label = "";
      if(firstDow.getMonth() !== lastMonth){
        lastMonth = firstDow.getMonth();
        label = MONTH_NAMES[firstDow.getMonth()].slice(0,3);
      }
      return `<span>${label}</span>`;
    }).join("");

    const cols = weeks.map(week => week.map(d => {
      const key = toDateKey(d);
      const log = logs[key];
      const filled = !!log && log.value > 0;
      const isFuture = d > today;
      const isToday = key === tKey;
      let style = "";
      let text = "";
      let titleSuffix = "";
      if(filled){
        const intensity = h.type === "count" && h.target ? Math.min(1, log.value / h.target) : 1;
        style = `background:${h.color};opacity:${(0.55 + intensity*0.45).toFixed(2)}`;
        if(h.type === "count"){
          text = `${log.value}x`;
          style += `;color:${contrastText(h.color)}`;
          titleSuffix = ` · ${log.value}${h.target ? "/"+h.target : ""}`;
        }
      }
      return `<span class="heatmap-cell${isToday ? " is-today" : ""}${isFuture ? " is-readonly" : ""}" style="${style}" data-habit="${h.id}" data-date="${key}" title="${escapeHtml(h.name)} · ${d.getDate()}/${d.getMonth()+1}${titleSuffix}">${text}</span>`;
    }).join("")).join("");

    return `
      <div class="overview-heat-block">
        <div class="overview-heat-header">
          <span class="overview-label-dot" style="background:${h.color}33;color:${h.color}">${h.icon}</span>
          <span class="overview-label-name">${escapeHtml(h.name)}</span>
        </div>
        <div class="heatmap-scroll">
          <div class="heatmap-top">
            <span class="heatmap-top-spacer"></span>
            <div class="heatmap-months">${monthLabels}</div>
          </div>
          <div class="heatmap-body">
            <div class="heatmap-dows">${DOW_SHORT.map(d => `<span>${d[0]}</span>`).join("")}</div>
            <div class="heatmap-grid">${cols}</div>
          </div>
        </div>
      </div>`;
  }).join("");

  container.innerHTML = `<div class="overview-heat-wrap">${blocks}</div>`;
  wireCells(container, ".heatmap-cell");
}

function wireCells(container, selector = ".overview-cell"){
  container.querySelectorAll(`${selector}:not(.is-readonly)`).forEach(cell => {
    const habit = habits.find(h => h.id === cell.dataset.habit);
    if(habit?.type === "count"){
      bindCountTap(
        cell,
        () => toggleCell(cell.dataset.habit, cell.dataset.date),
        () => toggleCell(cell.dataset.habit, cell.dataset.date, true)
      );
    } else {
      cell.addEventListener("click", () => toggleCell(cell.dataset.habit, cell.dataset.date));
    }
  });
}

async function toggleCell(habitId, dateKey, decrement){
  const habit = habits.find(h => h.id === habitId);
  if(!habit) return;
  const logs = logsMap[habitId] || {};
  const log = logs[dateKey];
  if(habit.type === "count"){
    const current = log?.value || 0;
    const next = decrement ? Math.max(0, current - 1) : current + 1;
    await setLog(uid, habitId, dateKey, next);
  } else {
    const filled = !!log && log.value > 0;
    await setLog(uid, habitId, dateKey, filled ? 0 : 1);
  }
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
