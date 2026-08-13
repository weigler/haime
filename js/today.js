import { watchHabits, watchLogs, setLog, watchTasks, updateTask } from "./db.js";
import { toDateKey, addDays, startOfWeek, todayKey, computeStreak, DOW_SHORT } from "./calendar.js";
import { showPanel, setActiveNav, registerTeardown, teardownOthers } from "./panel-router.js";
import { sortTasks, isOverdue, PRIORITIES } from "./tasks.js";

const WEEKDAY_FULL = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const MONTH_FULL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

let uid = null;
let habitsUnsub = null;
let logUnsubs = {};
let habits = [];
let logsMap = {};
let tasksUnsub = null;
let tasks = [];
let selectedDate = new Date();
let active = false;

const btnToday = document.getElementById("btn-today");
const dateCircle = document.getElementById("today-date-circle");
const weekdayEl = document.getElementById("today-weekday");
const monthBtn = document.getElementById("today-month-btn");
const monthEl = document.getElementById("today-month");
const weekStrip = document.getElementById("today-week-strip");
const habitsListEl = document.getElementById("today-habits-list");
const habitsEmptyEl = document.getElementById("today-habits-empty");
const habitsCountEl = document.getElementById("today-habits-count");
const tasksListEl = document.getElementById("today-tasks-list");
const tasksEmptyEl = document.getElementById("today-tasks-empty");
const tasksCountEl = document.getElementById("today-tasks-count");
const seeHabitsBtn = document.getElementById("today-see-habits");
const seeTasksBtn = document.getElementById("today-see-tasks");
const overdueBanner = document.getElementById("today-overdue-banner");

export function initTodayUid(userId){
  uid = userId;
}

export function teardownToday(){
  active = false;
  if(habitsUnsub){ habitsUnsub(); habitsUnsub = null; }
  Object.values(logUnsubs).forEach(fn => fn());
  logUnsubs = {};
  logsMap = {};
  habits = [];
  if(tasksUnsub){ tasksUnsub(); tasksUnsub = null; }
  tasks = [];
  selectedDate = new Date();
  habitsListEl.innerHTML = "";
  tasksListEl.innerHTML = "";
  weekStrip.innerHTML = "";
  overdueBanner.classList.add("is-hidden");
}
registerTeardown("today", teardownToday);

export function enterToday(){
  teardownOthers("today");
  active = true;
  selectedDate = new Date();
  showPanel("today");
  setActiveNav(btnToday);
  subscribe();
}

btnToday.addEventListener("click", enterToday);
monthBtn.addEventListener("click", () => { selectedDate = new Date(); render(); });
dateCircle.addEventListener("click", () => { selectedDate = new Date(); render(); });

seeHabitsBtn.addEventListener("click", () => {
  document.querySelector('[data-mobile-tab="habits"]')?.click();
});
seeTasksBtn.addEventListener("click", () => {
  document.getElementById("btn-tasks").click();
});
overdueBanner.addEventListener("click", () => {
  document.getElementById("btn-tasks").click();
});

function subscribe(){
  if(habitsUnsub) habitsUnsub();
  habitsUnsub = watchHabits(uid, (list) => {
    habits = list.filter(h => !h.archived);
    syncLogSubscriptions();
    render();
  });
  if(tasksUnsub) tasksUnsub();
  tasksUnsub = watchTasks(uid, (list) => {
    tasks = list;
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
  renderHeader();
  renderWeekStrip();
  renderHabits();
  renderTasks();
}

function renderHeader(){
  const isToday = toDateKey(selectedDate) === todayKey();
  dateCircle.textContent = selectedDate.getDate();
  dateCircle.classList.toggle("is-filled", isToday);
  weekdayEl.textContent = WEEKDAY_FULL[selectedDate.getDay()];
  monthEl.textContent = `${MONTH_FULL[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
}

function renderWeekStrip(){
  const start = startOfWeek(selectedDate);
  const days = Array.from({length:7}, (_,i) => addDays(start, i));
  const tKey = todayKey();
  const selKey = toDateKey(selectedDate);

  weekStrip.innerHTML = "";
  days.forEach(d => {
    const key = toDateKey(d);
    const hasMark = habits.some(h => (logsMap[h.id] || {})[key]?.value > 0);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "today-day" + (key === selKey ? " is-selected" : "") + (key === tKey ? " is-today" : "");
    btn.innerHTML = `
      <span class="today-day-dow">${DOW_SHORT[d.getDay()][0]}</span>
      <span class="today-day-num">${d.getDate()}</span>
      <span class="today-day-dot${hasMark ? " is-active" : ""}"></span>
    `;
    btn.addEventListener("click", () => { selectedDate = d; render(); });
    weekStrip.appendChild(btn);
  });
}

function renderHabits(){
  const key = toDateKey(selectedDate);
  habitsCountEl.textContent = habits.length ? `${habits.length}` : "";
  habitsEmptyEl.classList.toggle("is-hidden", habits.length > 0);
  habitsListEl.innerHTML = "";

  habits.forEach(h => {
    const logs = logsMap[h.id] || {};
    const log = logs[key];
    const filled = !!log && log.value > 0;
    const isQuit = h.goal === "quit";

    const row = document.createElement("div");
    row.className = "today-row";

    const freqLabel = h.type === "count"
      ? (h.target ? `Meta: ${h.target}/dia` : "Várias vezes ao dia")
      : "Diária";

    let actionHtml = "";
    if(isQuit){
      const streak = computeStreak(h, logs);
      actionHtml = `<button type="button" class="today-quit-badge${filled ? " is-slipped" : ""}" title="Marcar recaída hoje">${filled ? "😔" : `🕊 ${streak}`}</button>`;
    } else if(h.type === "count"){
      actionHtml = `
        <button type="button" class="today-count-btn">
          ${filled ? `<span class="today-count-value">${log.value}</span>` : "+"}
        </button>`;
    } else {
      actionHtml = `<button type="button" class="today-check${filled ? " is-checked" : ""}">${filled ? "✓" : ""}</button>`;
    }

    row.innerHTML = `
      <span class="habit-dot" style="background:${h.color}33;color:${h.color}">${isQuit ? "🚫" : h.icon}</span>
      <span class="today-row-body">
        <span class="today-row-name${filled && !isQuit ? " is-done" : ""}">${escapeHtml(h.name)}</span>
        <span class="today-row-freq">${freqLabel}</span>
      </span>
      ${actionHtml}
    `;

    const actionBtn = row.querySelector(".today-check, .today-count-btn, .today-quit-badge");
    actionBtn.addEventListener("click", () => handleHabitAction(h, key, log));
    if(h.type === "count"){
      actionBtn.addEventListener("contextmenu", (e) => { e.preventDefault(); handleHabitAction(h, key, log, true); });
    }

    habitsListEl.appendChild(row);
  });
}

async function handleHabitAction(habit, key, log, decrement){
  if(habit.type === "count"){
    const current = log?.value || 0;
    const next = decrement ? Math.max(0, current - 1) : current + 1;
    await setLog(uid, habit.id, key, next);
  } else {
    const filled = !!log && log.value > 0;
    await setLog(uid, habit.id, key, filled ? 0 : 1);
  }
}

function renderTasks(){
  const pending = tasks.filter(t => {
    const items = t.items || [];
    return items.length > 0 ? !items.every(i => i.done) : !t.done;
  });
  const overdueCount = pending.filter(isOverdue).length;
  overdueBanner.classList.toggle("is-hidden", overdueCount === 0);
  overdueBanner.textContent = overdueCount === 1 ? "🔴 1 tarefa atrasada" : `🔴 ${overdueCount} tarefas atrasadas`;

  const sorted = sortTasks(pending);
  tasksCountEl.textContent = sorted.length ? `${sorted.length}` : "";
  tasksEmptyEl.classList.toggle("is-hidden", sorted.length > 0);
  tasksListEl.innerHTML = "";

  sorted.slice(0, 6).forEach(task => {
    const items = task.items || [];
    const hasItems = items.length > 0;
    const overdue = isOverdue(task);
    const priority = PRIORITIES[task.priority];
    const metaBits = [];
    if(priority) metaBits.push(`${priority.emoji} ${priority.label}`);
    if(task.dueDate) metaBits.push(overdue ? "atrasada" : "com prazo");
    if(hasItems) metaBits.push(`${items.filter(i=>i.done).length}/${items.length} itens`);

    const row = document.createElement("div");
    row.className = "today-row" + (overdue ? " is-overdue-row" : "");
    row.innerHTML = `
      <button type="button" class="today-check"></button>
      <span class="today-row-body">
        <span class="today-row-name">${escapeHtml(task.title)}</span>
        ${metaBits.length ? `<span class="today-row-freq">${metaBits.join(" · ")}</span>` : ""}
      </span>
    `;
    row.querySelector(".today-check").addEventListener("click", () => {
      if(hasItems){
        updateTask(uid, task.id, { items: items.map(i => ({ ...i, done: true })) });
      } else {
        updateTask(uid, task.id, { done: true });
      }
    });
    tasksListEl.appendChild(row);
  });
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
