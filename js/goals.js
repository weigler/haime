import { watchGoals, createGoal, updateGoal, deleteGoal, getHabitsOnce } from "./db.js";
import { todayKey } from "./calendar.js";
import { showPanel, setActiveNav, registerTeardown, teardownOthers } from "./panel-router.js";

let uid = null;
let goals = [];
let goalsUnsub = null;
let habits = [];
let editingId = null;

const btnGoals = document.getElementById("btn-goals");
const btnNewGoal = document.getElementById("btn-new-goal");
const goalsList = document.getElementById("goals-list");
const goalsEmpty = document.getElementById("goals-empty");

const modal = document.getElementById("goal-modal");
const form = document.getElementById("goal-form");
const habitSelect = document.getElementById("goal-field-habit");
const deleteBtn = document.getElementById("goal-delete-btn");

export function initGoalsUid(userId){
  uid = userId;
}

export function teardownGoals(){
  if(goalsUnsub){ goalsUnsub(); goalsUnsub = null; }
  goals = [];
  goalsList.innerHTML = "";
}
registerTeardown("goals", teardownGoals);

btnGoals.addEventListener("click", () => {
  teardownOthers("goals");
  showPanel("goals");
  setActiveNav(btnGoals);
  subscribe();
});

function subscribe(){
  if(goalsUnsub) goalsUnsub();
  goalsUnsub = watchGoals(uid, (list) => {
    goals = list;
    render();
  });
}

function render(){
  goalsEmpty.classList.toggle("is-hidden", goals.length > 0);
  goalsList.innerHTML = "";
  // metas em aberto primeiro, concluídas no fim
  const sorted = [...goals].sort((a, b) => (a.done === b.done) ? 0 : a.done ? 1 : -1);
  sorted.forEach(g => goalsList.appendChild(renderGoalCard(g)));
}

function renderGoalCard(goal){
  const card = document.createElement("div");
  card.className = "goal-card" + (goal.done ? " is-done" : "");

  const deadlineInfo = formatDeadline(goal.targetDate);
  const habit = habits.find(h => h.id === goal.linkedHabitId);
  const progress = Math.max(0, Math.min(100, goal.progress || 0));

  card.innerHTML = `
    <div class="goal-card-head">
      <button type="button" class="task-check${goal.done ? " is-checked" : ""}" title="${goal.done ? "Reabrir" : "Concluir meta"}">${goal.done ? "✓" : ""}</button>
      <div class="goal-card-title-wrap">
        <span class="goal-card-title">${escapeHtml(goal.title)}</span>
        ${goal.description ? `<span class="goal-card-desc">${escapeHtml(goal.description)}</span>` : ""}
      </div>
      <button type="button" class="icon-btn icon-btn-tiny goal-edit-btn" title="Editar">✎</button>
    </div>

    <div class="goal-meta-row">
      ${deadlineInfo ? `<span class="task-meta-chip${deadlineInfo.overdue ? " is-overdue" : ""}">📅 ${deadlineInfo.label}</span>` : ""}
      ${habit ? `<span class="task-meta-chip">${habit.icon} ${escapeHtml(habit.name)}</span>` : ""}
    </div>

    <div class="goal-progress-row">
      <input type="range" class="goal-progress-slider" min="0" max="100" step="5" value="${progress}" ${goal.done ? "disabled" : ""}>
      <span class="goal-progress-value">${progress}%</span>
    </div>
  `;

  card.querySelector(".task-check").addEventListener("click", () => {
    const nowDone = !goal.done;
    updateGoal(uid, goal.id, { done: nowDone, progress: nowDone ? 100 : goal.progress });
  });

  card.querySelector(".goal-edit-btn").addEventListener("click", () => openModal(goal));

  const slider = card.querySelector(".goal-progress-slider");
  const valueLabel = card.querySelector(".goal-progress-value");
  slider.addEventListener("input", () => {
    valueLabel.textContent = `${slider.value}%`;
  });
  slider.addEventListener("change", () => {
    const val = Number(slider.value);
    updateGoal(uid, goal.id, { progress: val, done: val >= 100 ? true : goal.done });
  });

  return card;
}

function formatDeadline(dateStr){
  if(!dateStr) return null;
  const overdue = dateStr < todayKey();
  const [y,m,d] = dateStr.split("-").map(Number);
  const date = new Date(y, m-1, d);
  const label = date.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }).replace(".", "");
  if(overdue) return { label: `${label} · atrasada`, overdue: true };
  const [ty,tm,td] = todayKey().split("-").map(Number);
  const today = new Date(ty, tm-1, td);
  const daysLeft = Math.round((date - today) / (1000*60*60*24));
  if(daysLeft === 0) return { label: `${label} · hoje`, overdue: false };
  if(daysLeft <= 30) return { label: `${label} · faltam ${daysLeft}d`, overdue: false };
  return { label, overdue: false };
}

// ------------------------------------------------------------
// Modal de criar/editar
// ------------------------------------------------------------
btnNewGoal.addEventListener("click", () => openModal(null));
document.getElementById("goal-modal-close").addEventListener("click", closeModal);
document.getElementById("goal-cancel-btn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if(e.target === modal) closeModal(); });

async function openModal(goal){
  editingId = goal?.id || null;
  document.getElementById("goal-modal-title").textContent = goal ? "Editar meta" : "Nova meta";
  document.getElementById("goal-field-title").value = goal?.title || "";
  document.getElementById("goal-field-desc").value = goal?.description || "";
  document.getElementById("goal-field-date").value = goal?.targetDate || "";

  try{
    habits = (await getHabitsOnce(uid)).filter(h => !h.archived);
  }catch(err){ console.error(err); habits = []; }
  habitSelect.innerHTML = `<option value="">Nenhum</option>` +
    habits.map(h => `<option value="${h.id}">${h.icon} ${escapeHtml(h.name)}</option>`).join("");
  habitSelect.value = goal?.linkedHabitId || "";

  deleteBtn.classList.toggle("is-hidden", !goal);
  modal.classList.remove("is-hidden");
}

function closeModal(){
  modal.classList.add("is-hidden");
  editingId = null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    title: document.getElementById("goal-field-title").value.trim(),
    description: document.getElementById("goal-field-desc").value.trim() || null,
    targetDate: document.getElementById("goal-field-date").value || null,
    linkedHabitId: habitSelect.value || null,
  };
  if(!data.title) return;

  if(editingId){
    await updateGoal(uid, editingId, data);
  } else {
    teardownOthers("goals");
    await createGoal(uid, data);
  }
  closeModal();
});

deleteBtn.addEventListener("click", async () => {
  if(!editingId) return;
  if(!confirm("Excluir esta meta? Essa ação não pode ser desfeita.")) return;
  await deleteGoal(uid, editingId);
  closeModal();
});

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
