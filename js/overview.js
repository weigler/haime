import { watchHabits, watchLogs, setLog } from "./db.js";
import { toDateKey, addDays, startOfWeek, todayKey, DOW_SHORT, MONTH_NAMES } from "./calendar.js";
import { showPanel, setActiveNav } from "./panel-router.js";
import { deselectHabit } from "./habits.js";

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
}

btnOverview.addEventListener("click", () => {
  active = true;
  deselectHabit();
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
  if(currentView === "week") renderDaily(containers.week, weekDays());
  if(currentView === "month") renderDaily(containers.month, monthDays());
  if(currentView === "semester") renderSemester(containers.semester);
}

function weekDays(){
  const start = startOfWeek(new Date());
  return Array.from({length:7}, (_,i) => addDays(start, i));
}
function monthDays(){
  const start = startOfWeek(addDays(new Date(), -21));
  return Array.from({length:28}, (_,i) => addDays(start, i));
}

function renderDaily(container, days){
  const tKey = todayKey();
  const header = `
    <div class="overview-row overview-header">
      <div class="overview-label"></div>
      <div class="overview-cells">
        ${days.map(d => `<span class="overview-col-label">${d.getDate()}</span>${d.getDay()===6 ? '<span class="overview-week-gap"></span>':''}`).join("")}
      </div>
    </div>`;

  const rows = habits.map(h => {
    const logs = logsMap[h.id] || {};
    const cells = days.map(d => {
      const key = toDateKey(d);
      const log = logs[key];
      const filled = !!log && log.value > 0;
      const isToday = key === tKey;
      const style = filled ? `background:${h.color};border-color:${h.color}` : "";
      const gap = d.getDay() === 6 ? '<span class="overview-week-gap"></span>' : "";
      return `<span class="overview-cell${isToday ? " is-today" : ""}" style="${style}" data-habit="${h.id}" data-date="${key}" title="${h.name} · ${d.getDate()}/${d.getMonth()+1}"></span>${gap}`;
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

  container.querySelectorAll(".overview-cell").forEach(cell => {
    cell.addEventListener("click", () => toggleCell(cell.dataset.habit, cell.dataset.date));
    cell.addEventListener("contextmenu", (e) => {
      const habit = habits.find(h => h.id === cell.dataset.habit);
      if(habit?.type === "count"){ e.preventDefault(); toggleCell(cell.dataset.habit, cell.dataset.date, true); }
    });
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

function renderSemester(container){
  const today = new Date(); today.setHours(0,0,0,0);
  const end = startOfWeek(today);
  const weeks = Array.from({length:26}, (_,i) => addDays(end, -(25-i)*7));

  let lastMonth = -1;
  const header = `
    <div class="overview-row overview-header">
      <div class="overview-label"></div>
      <div class="overview-cells">
        ${weeks.map(w => {
          const label = w.getMonth() !== lastMonth ? (lastMonth = w.getMonth(), MONTH_NAMES[w.getMonth()].slice(0,3)) : "";
          return `<span class="overview-col-label" style="width:14px">${label}</span>`;
        }).join("")}
      </div>
    </div>`;

  const rows = habits.map(h => {
    const logs = logsMap[h.id] || {};
    const cells = weeks.map(weekStart => {
      let count = 0;
      for(let i=0;i<7;i++){
        const key = toDateKey(addDays(weekStart, i));
        if(logs[key] && logs[key].value > 0) count++;
      }
      const intensity = count / 7;
      const style = intensity > 0 ? `background:${h.color};opacity:${(0.35 + intensity*0.65).toFixed(2)};border-color:${h.color}` : "";
      return `<span class="overview-cell is-readonly" style="width:14px;height:14px;${style}" title="${h.name} · semana de ${weekStart.getDate()}/${weekStart.getMonth()+1}: ${count}/7 dias"></span>`;
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
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
