import { watchTasks, createTask, updateTask, deleteTask } from "./db.js";
import { todayKey } from "./calendar.js";
import { showPanel, setActiveNav, registerTeardown, teardownOthers } from "./panel-router.js";

export const PRIORITIES = {
  high:   { label: "Alta",  emoji: "🔴", order: 3 },
  medium: { label: "Média", emoji: "🟠", order: 2 },
  low:    { label: "Baixa", emoji: "⚪", order: 1 },
};

let uid = null;
let tasks = [];
let tasksUnsub = null;
let expanded = new Set();     // ids de tarefas com os sub-itens abertos
let editingMeta = new Set();  // ids de tarefas com o editor de data/prioridade aberto

const btnTasks = document.getElementById("btn-tasks");
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const tasksList = document.getElementById("tasks-list");
const tasksEmpty = document.getElementById("tasks-empty");

export function initTasksUid(userId){
  uid = userId;
}

export function teardownTasks(){
  if(tasksUnsub){ tasksUnsub(); tasksUnsub = null; }
  tasks = [];
  expanded = new Set();
  editingMeta = new Set();
  tasksList.innerHTML = "";
}
registerTeardown("tasks", teardownTasks);

btnTasks.addEventListener("click", () => {
  teardownOthers("tasks");
  showPanel("tasks");
  setActiveNav(btnTasks);
  subscribe();
});

function subscribe(){
  if(tasksUnsub) tasksUnsub();
  tasksUnsub = watchTasks(uid, (list) => {
    tasks = list;
    render();
  });
}

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = taskInput.value.trim();
  if(!title || !uid) return;
  taskInput.value = "";
  await createTask(uid, title);
});

// ------------------------------------------------------------
// Ordenação: pendentes primeiro (prioridade alta→baixa, depois
// data mais próxima primeiro, sem data por último), concluídas
// no final.
// ------------------------------------------------------------
export function sortTasks(list){
  const isDone = (t) => {
    const items = t.items || [];
    return items.length > 0 ? items.every(i => i.done) : !!t.done;
  };
  return [...list].sort((a, b) => {
    const doneA = isDone(a), doneB = isDone(b);
    if(doneA !== doneB) return doneA ? 1 : -1;

    const pA = PRIORITIES[a.priority]?.order || 0;
    const pB = PRIORITIES[b.priority]?.order || 0;
    if(pA !== pB) return pB - pA;

    if(a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    if(a.dueDate) return -1;
    if(b.dueDate) return 1;
    return 0;
  });
}

export function isOverdue(task){
  const items = task.items || [];
  const done = items.length > 0 ? items.every(i => i.done) : !!task.done;
  return !done && task.dueDate && task.dueDate < todayKey();
}

function render(){
  const sorted = sortTasks(tasks);
  tasksList.innerHTML = "";
  tasksEmpty.classList.toggle("is-hidden", sorted.length > 0);

  sorted.forEach(task => {
    tasksList.appendChild(renderTaskRow(task));
  });
}

function formatDueLabel(dueDate){
  const [y,m,d] = dueDate.split("-").map(Number);
  const date = new Date(y, m-1, d);
  return date.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "");
}

function renderTaskRow(task){
  const items = task.items || [];
  const hasItems = items.length > 0;
  const isDone = hasItems ? items.every(i => i.done) : !!task.done;
  const isOpen = expanded.has(task.id);
  const isEditingMeta = editingMeta.has(task.id);
  const overdue = isOverdue(task);
  const priority = PRIORITIES[task.priority];

  const wrap = document.createElement("div");
  wrap.className = "task-item" + (isDone ? " is-done" : "");

  const row = document.createElement("div");
  row.className = "task-row";

  const metaBits = [];
  if(priority) metaBits.push(`<span class="task-meta-chip">${priority.emoji} ${priority.label}</span>`);
  if(task.dueDate) metaBits.push(`<span class="task-meta-chip${overdue ? " is-overdue" : ""}">📅 ${formatDueLabel(task.dueDate)}${overdue ? " · atrasada" : ""}</span>`);

  row.innerHTML = `
    <button type="button" class="task-check${isDone ? " is-checked" : ""}" title="${isDone ? "Desmarcar" : "Concluir"}">
      ${isDone ? "✓" : ""}
    </button>
    <span class="task-title-wrap">
      <span class="task-title" tabindex="0">${escapeHtml(task.title)}</span>
      ${metaBits.length ? `<span class="task-meta-row">${metaBits.join("")}</span>` : ""}
    </span>
    ${hasItems ? `<span class="task-progress">${items.filter(i=>i.done).length}/${items.length}</span>` : ""}
    <button type="button" class="icon-btn icon-btn-tiny task-meta-btn" title="Data e prioridade">🗓</button>
    <button type="button" class="icon-btn icon-btn-tiny task-expand" title="Sub-itens">${isOpen ? "▾" : "▸"}</button>
    <button type="button" class="icon-btn icon-btn-tiny task-delete" title="Excluir">×</button>
  `;

  row.querySelector(".task-check").addEventListener("click", () => {
    if(hasItems){
      const newDone = !isDone;
      updateTask(uid, task.id, { items: items.map(i => ({ ...i, done: newDone })) });
    } else {
      updateTask(uid, task.id, { done: !task.done });
    }
  });

  row.querySelector(".task-title").addEventListener("click", () => startRename(row, task));

  row.querySelector(".task-meta-btn").addEventListener("click", () => {
    if(editingMeta.has(task.id)) editingMeta.delete(task.id); else editingMeta.add(task.id);
    render();
  });

  row.querySelector(".task-expand").addEventListener("click", () => {
    if(expanded.has(task.id)) expanded.delete(task.id); else expanded.add(task.id);
    render();
  });

  row.querySelector(".task-delete").addEventListener("click", () => {
    if(hasItems && !confirm("Excluir esta tarefa e todos os sub-itens dela?")) return;
    deleteTask(uid, task.id);
  });

  wrap.appendChild(row);

  if(isEditingMeta){
    wrap.appendChild(renderMetaEditor(task));
  }
  if(isOpen){
    wrap.appendChild(renderSubItems(task, items));
  }

  return wrap;
}

function renderMetaEditor(task){
  const box = document.createElement("div");
  box.className = "task-meta-editor";
  box.innerHTML = `
    <label>Prazo
      <input type="date" class="task-date-input" value="${task.dueDate || ""}">
    </label>
    <div class="task-priority-picker">
      ${Object.entries(PRIORITIES).map(([key, p]) => `
        <button type="button" class="task-priority-opt${task.priority === key ? " is-selected" : ""}" data-priority="${key}">${p.emoji} ${p.label}</button>
      `).join("")}
      <button type="button" class="task-priority-opt${!task.priority ? " is-selected" : ""}" data-priority="">Nenhuma</button>
    </div>
  `;
  box.querySelector(".task-date-input").addEventListener("change", (e) => {
    updateTask(uid, task.id, { dueDate: e.target.value || null });
  });
  box.querySelectorAll(".task-priority-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      updateTask(uid, task.id, { priority: btn.dataset.priority || null });
    });
  });
  return box;
}

function startRename(row, task){
  const span = row.querySelector(".task-title");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "task-title-input";
  input.value = task.title;
  span.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const value = input.value.trim();
    if(value && value !== task.title){
      updateTask(uid, task.id, { title: value });
    } else {
      render();
    }
  };
  input.addEventListener("keydown", (e) => {
    if(e.key === "Enter"){ e.preventDefault(); input.blur(); }
    if(e.key === "Escape"){ render(); }
  });
  input.addEventListener("blur", commit);
}

function renderSubItems(task, items){
  const box = document.createElement("div");
  box.className = "task-subitems";

  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "task-subitem" + (item.done ? " is-done" : "");
    row.innerHTML = `
      <button type="button" class="task-check task-check-sm${item.done ? " is-checked" : ""}">${item.done ? "✓" : ""}</button>
      <span class="task-subitem-text">${escapeHtml(item.text)}</span>
      <button type="button" class="icon-btn icon-btn-tiny">×</button>
    `;
    row.querySelector(".task-check").addEventListener("click", () => {
      const next = items.map((it, i) => i === idx ? { ...it, done: !it.done } : it);
      updateTask(uid, task.id, { items: next });
    });
    row.querySelector(".icon-btn").addEventListener("click", () => {
      const next = items.filter((_, i) => i !== idx);
      updateTask(uid, task.id, { items: next });
    });
    box.appendChild(row);
  });

  const addForm = document.createElement("form");
  addForm.className = "task-subitem-add";
  addForm.innerHTML = `<input type="text" placeholder="Adicionar item…" required><button type="submit" class="icon-btn icon-btn-tiny">+</button>`;
  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = addForm.querySelector("input");
    const text = input.value.trim();
    if(!text) return;
    const next = [...items, { id: crypto.randomUUID(), text, done: false }];
    updateTask(uid, task.id, { items: next });
    input.value = "";
  });
  box.appendChild(addForm);

  return box;
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
