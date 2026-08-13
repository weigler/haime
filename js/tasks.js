import { watchTasks, createTask, updateTask, deleteTask } from "./db.js";
import { showPanel, setActiveNav, registerTeardown, teardownOthers } from "./panel-router.js";

let uid = null;
let tasks = [];
let tasksUnsub = null;
let expanded = new Set(); // ids de tarefas com os sub-itens abertos

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

function render(){
  tasksList.innerHTML = "";
  tasksEmpty.classList.toggle("is-hidden", tasks.length > 0);

  tasks.forEach(task => {
    tasksList.appendChild(renderTaskRow(task));
  });
}

function renderTaskRow(task){
  const items = task.items || [];
  const hasItems = items.length > 0;
  const isDone = hasItems ? items.every(i => i.done) : !!task.done;
  const isOpen = expanded.has(task.id);

  const wrap = document.createElement("div");
  wrap.className = "task-item" + (isDone ? " is-done" : "");

  const row = document.createElement("div");
  row.className = "task-row";
  row.innerHTML = `
    <button type="button" class="task-check${isDone ? " is-checked" : ""}" title="${isDone ? "Desmarcar" : "Concluir"}">
      ${isDone ? "✓" : ""}
    </button>
    <span class="task-title" tabindex="0">${escapeHtml(task.title)}</span>
    ${hasItems ? `<span class="task-progress">${items.filter(i=>i.done).length}/${items.length}</span>` : ""}
    <button type="button" class="icon-btn icon-btn-tiny task-expand" title="Sub-itens">${isOpen ? "▾" : "▸"}</button>
    <button type="button" class="icon-btn icon-btn-tiny task-delete" title="Excluir">×</button>
  `;

  // concluir/desmarcar a tarefa (só relevante quando não tem sub-itens controlando o estado)
  row.querySelector(".task-check").addEventListener("click", () => {
    if(hasItems){
      // marca/desmarca todos os sub-itens de uma vez
      const newDone = !isDone;
      updateTask(uid, task.id, { items: items.map(i => ({ ...i, done: newDone })) });
    } else {
      updateTask(uid, task.id, { done: !task.done });
    }
  });

  // renomear (clique no título vira campo editável)
  row.querySelector(".task-title").addEventListener("click", () => startRename(row, task));

  row.querySelector(".task-expand").addEventListener("click", () => {
    if(expanded.has(task.id)) expanded.delete(task.id); else expanded.add(task.id);
    render();
  });

  row.querySelector(".task-delete").addEventListener("click", () => {
    if(hasItems && !confirm("Excluir esta tarefa e todos os sub-itens dela?")) return;
    deleteTask(uid, task.id);
  });

  wrap.appendChild(row);

  if(isOpen){
    wrap.appendChild(renderSubItems(task, items));
  }

  return wrap;
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
      render(); // reverte sem mudar nada
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
