import { createHabit, updateHabit, deleteHabit, watchHabits, watchLogs, setLog } from "./db.js";
import { renderWeek, renderMonth, renderHeatmap, computeStreak, todayKey } from "./calendar.js";
import { showPanel, setActiveNav, registerTeardown, teardownOthers } from "./panel-router.js";

const ICONS = ["✅","💧","🏃","🚶","🧘","🚴","🏋️","⛰️","🏕️","🚿","🛏️","😴","🦷","🧴","💊","🩺","📖","📚","🎓","✏️","🖊️","📝","🙏","📿","🧠","🎯","💡","🚭","🚬","🍺","🍷","🍬","🍭","🍫","🎰","📵","📱","🎮","📺","🍿","🧹","🧺","💸","💰","📅","⏰","🧾","🛒","🎨","📷","🎬","🎧","🎸","🎹","♟️","🧩","🌱","🌳","☀️","🌙","🐕","🐈","🚲","🥗","🍎","🥦","☕","🍵","🥤","🍕"];
const COLORS = ["#4FA99A","#D2A84C","#C1573F","#6E9CD2","#9B7CD9","#5CB876","#D97D9C","#7A8790"];

let uid = null;
let allHabits = [];
let habits = [];       // ativos (não arquivados)
let archived = [];     // arquivados
let habitsUnsub = null;
let selectedId = null;
let logsUnsub = null;
let currentLogs = {};
let currentView = "week";
let refDate = new Date();
let editingId = null;
let editingArchived = false;
let archivedExpanded = false;

const listBuild = document.getElementById("list-build");
const listQuit = document.getElementById("list-quit");
const listArchived = document.getElementById("list-archived");
const archivedGroup = document.getElementById("archived-group");
const archivedToggle = document.getElementById("archived-toggle");
const archivedCount = document.getElementById("archived-count");
const emptyHabits = document.getElementById("empty-habits");

export function initHabits(userId){
  uid = userId;
  showPanel("empty");
  if(habitsUnsub) habitsUnsub();
  habitsUnsub = watchHabits(uid, (list) => {
    allHabits = list;
    habits = allHabits.filter(h => !h.archived);
    archived = allHabits.filter(h => h.archived);
    renderList();
    if(selectedId && !allHabits.find(h => h.id === selectedId)){
      selectedId = null;
    }
    if(selectedId){ renderSelected(); }
  });
}

export function teardownHabits(){
  if(habitsUnsub) habitsUnsub();
  if(logsUnsub) logsUnsub();
  allHabits = []; habits = []; archived = []; selectedId = null; currentLogs = {};
  listBuild.innerHTML = ""; listQuit.innerHTML = ""; listArchived.innerHTML = "";
  document.getElementById("view-week").innerHTML = "";
  document.getElementById("view-month").innerHTML = "";
  document.getElementById("view-heatmap").innerHTML = "";
}

registerTeardown("habit", () => {
  selectedId = null;
  if(logsUnsub){ logsUnsub(); logsUnsub = null; }
  renderList();
});

function renderList(){
  listBuild.innerHTML = "";
  listQuit.innerHTML = "";
  listArchived.innerHTML = "";
  const build = habits.filter(h => h.goal !== "quit");
  const quit = habits.filter(h => h.goal === "quit");

  build.forEach(h => listBuild.appendChild(habitRow(h)));
  quit.forEach(h => listQuit.appendChild(habitRow(h)));
  archived.forEach(h => listArchived.appendChild(habitRow(h, true)));

  document.querySelectorAll(".sidebar-group:not(#archived-group)").forEach(g => {
    const list = g.querySelector(".habit-list");
    g.classList.toggle("is-hidden", list.children.length === 0);
  });
  emptyHabits.classList.toggle("is-hidden", habits.length > 0 || archived.length > 0);

  archivedGroup.classList.toggle("is-hidden", archived.length === 0);
  archivedCount.textContent = `(${archived.length})`;
  listArchived.classList.toggle("is-hidden", !archivedExpanded);
  archivedToggle.classList.toggle("is-expanded", archivedExpanded);
}

archivedToggle.addEventListener("click", () => {
  archivedExpanded = !archivedExpanded;
  listArchived.classList.toggle("is-hidden", !archivedExpanded);
  archivedToggle.classList.toggle("is-expanded", archivedExpanded);
});

function habitRow(h, isArchived){
  const li = document.createElement("li");
  const row = document.createElement("button");
  row.type = "button";
  row.dataset.id = h.id;
  row.className = "habit-row" + (h.id === selectedId ? " is-active" : "") + (isArchived ? " is-archived" : "");
  row.innerHTML = `
    <span class="habit-dot" style="background:${h.color}33;color:${h.color}">${h.icon}</span>
    <span class="habit-row-name">${escapeHtml(h.name)}</span>
    ${isArchived
      ? `<span class="icon-btn icon-btn-tiny" data-unarchive title="Desarquivar">↺</span>`
      : `<span class="habit-row-streak"></span>`}
  `;
  row.addEventListener("click", (e) => {
    if(e.target.closest("[data-unarchive]")){
      e.stopPropagation();
      updateHabit(uid, h.id, { archived: false });
      return;
    }
    selectHabit(h.id);
  });
  li.appendChild(row);
  return li;
}

function selectHabit(id){
  teardownOthers("habit");
  selectedId = id;
  refDate = new Date();
  currentView = "week";
  document.querySelectorAll(".view-tab[data-view]").forEach(t => t.classList.toggle("is-active", t.dataset.view === "week"));
  renderList();
  renderSelected();
}

function showEmptyPanel(){
  showPanel("empty");
}

function renderSelected(){
  const habit = allHabits.find(h => h.id === selectedId);
  if(!habit){ showEmptyPanel(); return; }

  showPanel("habit");
  setActiveNav(document.querySelector(`.habit-row[data-id="${habit.id}"]`));

  document.getElementById("habit-icon").textContent = habit.icon;
  document.getElementById("habit-icon").style.background = habit.color + "33";
  document.getElementById("habit-icon").style.color = habit.color;
  document.getElementById("habit-name").textContent = habit.name;
  document.getElementById("habit-meta").textContent =
    (habit.goal === "quit" ? "Abandonar" : "Construir") + " · " +
    (habit.type === "count" ? (habit.target ? `meta de ${habit.target}/dia` : "várias vezes ao dia") : "marcação diária") +
    (habit.archived ? " · arquivado" : "");

  if(logsUnsub) logsUnsub();
  logsUnsub = watchLogs(uid, habit.id, (logs) => {
    currentLogs = logs;
    updateStreakBadge(habit);
    renderView(habit);
    // atualiza também o "streak" na linha da lista lateral
    const row = document.querySelector(`.habit-row[data-id="${habit.id}"]`);
    if(row){
      const streak = computeStreak(habit, logs);
      row.querySelector(".habit-row-streak").textContent = streak > 0 ? `${streak}d` : "";
    }
  });

  document.getElementById("btn-edit-habit").onclick = () => openModal(habit);
}

function updateStreakBadge(habit){
  const streak = computeStreak(habit, currentLogs);
  const badge = document.getElementById("habit-streak");
  if(streak <= 0){
    badge.textContent = habit.goal === "quit" ? "começando agora" : "sem sequência ainda";
  } else if(habit.goal === "quit"){
    badge.textContent = `🕊 ${streak} dia${streak>1?"s":""} limpo${streak>1?"s":""}`;
  } else {
    badge.textContent = `🔥 ${streak} dia${streak>1?"s":""} seguido${streak>1?"s":""}`;
  }
}

function renderView(habit){
  const week = document.getElementById("view-week");
  const month = document.getElementById("view-month");
  const heat = document.getElementById("view-heatmap");
  week.classList.toggle("is-hidden", currentView !== "week");
  month.classList.toggle("is-hidden", currentView !== "month");
  heat.classList.toggle("is-hidden", currentView !== "heatmap");

  const onToggle = (key, log, decrement) => handleToggle(habit, key, log, decrement);

  if(currentView === "week") renderWeek(week, habit, currentLogs, refDate, onToggle);
  if(currentView === "month") renderMonth(month, habit, currentLogs, onToggle);
  if(currentView === "heatmap") renderHeatmap(heat, habit, currentLogs, onToggle);
}

async function handleToggle(habit, key, log, decrement){
  if(habit.type === "count"){
    // clique esquerdo soma 1; clique direito tira 1 (até chegar a zero, que remove a marcação)
    const current = log?.value || 0;
    const next = decrement ? Math.max(0, current - 1) : current + 1;
    await setLog(uid, habit.id, key, next);
  } else {
    const filled = !!log && log.value > 0;
    await setLog(uid, habit.id, key, filled ? 0 : 1);
  }
}

document.querySelectorAll(".view-tab[data-view]").forEach(tab => {
  tab.addEventListener("click", () => {
    currentView = tab.dataset.view;
    document.querySelectorAll(".view-tab[data-view]").forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const habit = allHabits.find(h => h.id === selectedId);
    if(habit) renderView(habit);
  });
});

// ------------------------------------------------------------
// Modal de criação/edição
// ------------------------------------------------------------
const modal = document.getElementById("habit-modal");
const form = document.getElementById("habit-form");
const iconPicker = document.getElementById("icon-picker");
const colorPicker = document.getElementById("color-picker");
const fieldIcon = document.getElementById("field-icon");
const fieldType = document.getElementById("field-type");
const targetField = document.getElementById("target-field");
let selectedColor = COLORS[0];

ICONS.forEach(icon => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-opt";
  btn.textContent = icon;
  btn.addEventListener("click", () => {
    fieldIcon.value = icon;
    iconPicker.querySelectorAll(".icon-opt").forEach(b => b.classList.remove("is-selected"));
    btn.classList.add("is-selected");
  });
  iconPicker.appendChild(btn);
});

COLORS.forEach(color => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "color-opt";
  btn.style.background = color;
  btn.dataset.color = color;
  btn.addEventListener("click", () => {
    selectedColor = color;
    colorPicker.querySelectorAll(".color-opt").forEach(b => b.classList.remove("is-selected"));
    btn.classList.add("is-selected");
  });
  colorPicker.appendChild(btn);
});

fieldType.addEventListener("change", () => {
  targetField.classList.toggle("is-hidden", fieldType.value !== "count");
});

document.getElementById("btn-new-habit").addEventListener("click", () => openModal(null));
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("btn-cancel-habit").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if(e.target === modal) closeModal(); });

function openModal(habit){
  editingId = habit?.id || null;
  editingArchived = habit?.archived || false;
  document.getElementById("modal-title").textContent = habit ? "Editar hábito" : "Novo hábito";
  document.getElementById("field-name").value = habit?.name || "";
  fieldIcon.value = habit?.icon || ICONS[0];
  document.getElementById("field-goal").value = habit?.goal || "build";
  fieldType.value = habit?.type || "check";
  document.getElementById("field-target").value = habit?.target || "";
  targetField.classList.toggle("is-hidden", (habit?.type || "check") !== "count");
  selectedColor = habit?.color || COLORS[0];

  iconPicker.querySelectorAll(".icon-opt").forEach(b => b.classList.toggle("is-selected", b.textContent === fieldIcon.value));
  colorPicker.querySelectorAll(".color-opt").forEach(b => b.classList.toggle("is-selected", b.dataset.color === selectedColor));

  document.getElementById("btn-delete-habit").classList.toggle("is-hidden", !habit);
  const archiveBtn = document.getElementById("btn-archive-habit");
  archiveBtn.classList.toggle("is-hidden", !habit);
  archiveBtn.textContent = editingArchived ? "Desarquivar" : "Arquivar";
  modal.classList.remove("is-hidden");
}

function closeModal(){
  modal.classList.add("is-hidden");
  editingId = null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById("field-name").value.trim(),
    icon: fieldIcon.value || "✅",
    color: selectedColor,
    goal: document.getElementById("field-goal").value,
    type: fieldType.value,
    target: fieldType.value === "count" && document.getElementById("field-target").value
      ? Number(document.getElementById("field-target").value) : null
  };
  if(!data.name) return;

  if(editingId){
    await updateHabit(uid, editingId, data);
  } else {
    teardownOthers("habit");
    const ref = await createHabit(uid, data);
    selectedId = ref.id;
  }
  closeModal();
});

document.getElementById("btn-delete-habit").addEventListener("click", async () => {
  if(!editingId) return;
  if(!confirm("Excluir este hábito e todo o histórico dele? Essa ação não pode ser desfeita.")) return;
  await deleteHabit(uid, editingId);
  if(selectedId === editingId){
    selectedId = null;
    showEmptyPanel();
  }
  closeModal();
});

document.getElementById("btn-archive-habit").addEventListener("click", async () => {
  if(!editingId) return;
  await updateHabit(uid, editingId, { archived: !editingArchived });
  closeModal();
});

// ------------------------------------------------------------
function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

