import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  onSnapshot, query, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { encryptText, decryptText, isEncrypted } from "./crypto-fields.js";

// ------------------------------------------------------------
// Estrutura no Firestore:
// users/{uid}                              -> perfil
// users/{uid}/habits/{habitId}             -> {name, icon, color, goal, type, target, order, archived, createdAt}
// users/{uid}/habits/{habitId}/logs/{date} -> {value, updatedAt}   (date = "YYYY-MM-DD")
// ------------------------------------------------------------

function habitsCol(uid){
  return collection(db, "users", uid, "habits");
}
function logsCol(uid, habitId){
  return collection(db, "users", uid, "habits", habitId, "logs");
}
function tasksCol(uid){
  return collection(db, "users", uid, "tasks");
}
function goalsCol(uid){
  return collection(db, "users", uid, "goals");
}
function focusCol(uid){
  return collection(db, "users", uid, "focusSessions");
}

// ------------------------------------------------------------
// Cifra/decifra só os campos de texto livre de cada coleção —
// números, datas e ids continuam normais. Ver crypto-fields.js.
// ------------------------------------------------------------
async function encryptHabitData(uid, data){
  if(data.name === undefined) return data;
  return { ...data, name: await encryptText(uid, data.name) };
}
async function decryptHabit(uid, habit){
  return { ...habit, name: await decryptText(uid, habit.name) };
}

async function encryptTaskData(uid, data){
  const out = { ...data };
  if(out.title !== undefined) out.title = await encryptText(uid, out.title);
  if(out.items !== undefined){
    out.items = await Promise.all(out.items.map(async (it) => ({ ...it, text: await encryptText(uid, it.text) })));
  }
  return out;
}
async function decryptTask(uid, task){
  const out = { ...task, title: await decryptText(uid, task.title) };
  if(Array.isArray(task.items)){
    out.items = await Promise.all(task.items.map(async (it) => ({ ...it, text: await decryptText(uid, it.text) })));
  }
  return out;
}

async function encryptGoalData(uid, data){
  const out = { ...data };
  if(out.title !== undefined) out.title = await encryptText(uid, out.title);
  if(out.description !== undefined) out.description = await encryptText(uid, out.description);
  return out;
}
async function decryptGoal(uid, goal){
  return {
    ...goal,
    title: await decryptText(uid, goal.title),
    description: await decryptText(uid, goal.description)
  };
}

export function watchHabits(uid, callback){
  const q = query(habitsCol(uid), orderBy("createdAt", "asc"));
  return onSnapshot(q, async (snap) => {
    const raw = [];
    snap.forEach(d => raw.push({ id: d.id, ...d.data() }));
    const habits = await Promise.all(raw.map(h => decryptHabit(uid, h)));
    callback(habits);
  });
}

export async function createHabit(uid, data){
  return addDoc(habitsCol(uid), {
    ...(await encryptHabitData(uid, data)),
    archived: false,
    createdAt: serverTimestamp()
  });
}

export async function updateHabit(uid, habitId, data){
  return updateDoc(doc(db, "users", uid, "habits", habitId), await encryptHabitData(uid, data));
}

export async function deleteHabit(uid, habitId){
  // apaga os registros (logs) do hábito antes de apagar o hábito em si
  const snap = await getDocs(logsCol(uid, habitId));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  return deleteDoc(doc(db, "users", uid, "habits", habitId));
}

// escuta todos os registros de um hábito (usado para semana/mês/heatmap/streak)
export function watchLogs(uid, habitId, callback){
  return onSnapshot(logsCol(uid, habitId), (snap) => {
    const logs = {};
    snap.forEach(d => { logs[d.id] = d.data(); });
    callback(logs);
  });
}

// define o valor de um dia. value <= 0 remove a marcação.
export async function setLog(uid, habitId, dateKey, value){
  const ref = doc(db, "users", uid, "habits", habitId, "logs", dateKey);
  if(value > 0){
    await setDoc(ref, { value, updatedAt: serverTimestamp() });
  } else {
    await deleteDoc(ref);
  }
}

// ------------------------------------------------------------
// Leituras avulsas (sem listener em tempo real) — usadas por
// backup.js e pdfexport.js, que só precisam de uma "foto" atual.
// getHabitsOnce decifra (uso normal do app); getHabitsOnceRaw NÃO
// decifra — é só pra gravar backups exatamente como estão no banco
// (senão o backup guardaria o nome em texto livre, contornando a
// própria criptografia).
// ------------------------------------------------------------
export async function getHabitsOnce(uid){
  const raw = await getHabitsOnceRaw(uid);
  return Promise.all(raw.map(h => decryptHabit(uid, h)));
}

export async function getHabitsOnceRaw(uid){
  const snap = await getDocs(query(habitsCol(uid), orderBy("createdAt", "asc")));
  const habits = [];
  snap.forEach(d => habits.push({ id: d.id, ...d.data() }));
  return habits;
}

export async function getLogsOnce(uid, habitId){
  const snap = await getDocs(logsCol(uid, habitId));
  const logs = {};
  snap.forEach(d => { logs[d.id] = d.data(); });
  return logs;
}

export async function writeBackupDoc(uid, backupId, data){
  await setDoc(doc(db, "users", uid, "backups", backupId), data);
}

export async function listBackups(uid){
  const snap = await getDocs(query(collection(db, "users", uid, "backups"), orderBy("generatedAt", "desc")));
  const list = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() }));
  return list;
}

// grava um hábito restaurado com o MESMO id que ele tinha no backup
// (em vez de gerar um id novo), pra preservar vínculos com metas etc.
export async function restoreHabitDoc(uid, habitId, data){
  await setDoc(doc(db, "users", uid, "habits", habitId), data);
}

export async function restoreLogDoc(uid, habitId, dateKey, log){
  await setDoc(doc(db, "users", uid, "habits", habitId, "logs", dateKey), log);
}

export async function getUserDoc(uid){
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserDoc(uid, data){
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// ------------------------------------------------------------
// Lista de autorização (allowlist) para controlar quem pode
// criar conta / entrar. Documento único em config/allowlist,
// editado manualmente pelo console do Firebase — ver README.
// Se o documento não existir, o app trata como "sem restrição".
// ------------------------------------------------------------
export async function getAllowlist(){
  const snap = await getDoc(doc(db, "config", "allowlist"));
  if(!snap.exists()) return null;
  return (snap.data().emails || []).map(e => String(e).toLowerCase().trim());
}

export { serverTimestamp };

// ------------------------------------------------------------
// Cifra retroativamente hábitos/tarefas/metas que já existiam
// antes da criptografia ser ligada (ficariam em texto livre pra
// sempre, senão — só ficam cifrados a partir da próxima edição).
// ------------------------------------------------------------
export async function encryptExistingData(uid, onProgress){
  const habits = await getHabitsOnceRaw(uid);
  const tasksSnap = await getDocs(tasksCol(uid));
  const goalsSnap = await getDocs(goalsCol(uid));
  const tasks = []; tasksSnap.forEach(d => tasks.push({ id: d.id, ...d.data() }));
  const goals = []; goalsSnap.forEach(d => goals.push({ id: d.id, ...d.data() }));

  const total = habits.length + tasks.length + goals.length;
  let done = 0;
  const tick = () => { done++; onProgress?.(done, total); };

  for(const h of habits){
    if(!isEncrypted(h.name)){
      await updateDoc(doc(db, "users", uid, "habits", h.id), { name: await encryptText(uid, h.name) });
    }
    tick();
  }
  for(const t of tasks){
    const items = t.items || [];
    const needsTitle = !isEncrypted(t.title);
    const needsItems = items.some(it => !isEncrypted(it.text));
    if(needsTitle || needsItems){
      await updateDoc(doc(db, "users", uid, "tasks", t.id), await encryptTaskData(uid, { title: t.title, items }));
    }
    tick();
  }
  for(const g of goals){
    const needsTitle = !isEncrypted(g.title);
    const needsDesc = g.description && !isEncrypted(g.description);
    if(needsTitle || needsDesc){
      await updateDoc(doc(db, "users", uid, "goals", g.id), await encryptGoalData(uid, { title: g.title, description: g.description }));
    }
    tick();
  }
  return total;
}

// ------------------------------------------------------------
// Tarefas (To-Do), com sub-itens opcionais (ex.: lista de mercado)
// ------------------------------------------------------------
export function watchTasks(uid, callback){
  const q = query(tasksCol(uid), orderBy("createdAt", "asc"));
  return onSnapshot(q, async (snap) => {
    const raw = [];
    snap.forEach(d => raw.push({ id: d.id, ...d.data() }));
    const tasks = await Promise.all(raw.map(t => decryptTask(uid, t)));
    callback(tasks);
  });
}

export async function createTask(uid, title){
  return addDoc(tasksCol(uid), {
    title: await encryptText(uid, title),
    done: false,
    items: [],
    dueDate: null,
    priority: null,
    createdAt: serverTimestamp()
  });
}

export async function updateTask(uid, taskId, data){
  return updateDoc(doc(db, "users", uid, "tasks", taskId), await encryptTaskData(uid, data));
}

export async function deleteTask(uid, taskId){
  return deleteDoc(doc(db, "users", uid, "tasks", taskId));
}

// ------------------------------------------------------------
// Metas (Goals) — objetivos de longo prazo, opcionalmente
// vinculados a um hábito.
// ------------------------------------------------------------
export function watchGoals(uid, callback){
  const q = query(goalsCol(uid), orderBy("createdAt", "asc"));
  return onSnapshot(q, async (snap) => {
    const raw = [];
    snap.forEach(d => raw.push({ id: d.id, ...d.data() }));
    const goals = await Promise.all(raw.map(g => decryptGoal(uid, g)));
    callback(goals);
  });
}

export async function createGoal(uid, data){
  return addDoc(goalsCol(uid), {
    ...(await encryptGoalData(uid, data)),
    done: false,
    progress: 0,
    createdAt: serverTimestamp()
  });
}

export async function updateGoal(uid, goalId, data){
  return updateDoc(doc(db, "users", uid, "goals", goalId), await encryptGoalData(uid, data));
}

export async function deleteGoal(uid, goalId){
  return deleteDoc(doc(db, "users", uid, "goals", goalId));
}

// ------------------------------------------------------------
// Sessões de foco (Timer) — histórico das últimas sessões
// concluídas, opcionalmente vinculadas a um hábito.
// ------------------------------------------------------------
export function watchFocusSessions(uid, callback, max = 8){
  const q = query(focusCol(uid), orderBy("completedAt", "desc"), limit(max));
  return onSnapshot(q, (snap) => {
    const sessions = [];
    snap.forEach(d => sessions.push({ id: d.id, ...d.data() }));
    callback(sessions);
  });
}

export async function logFocusSession(uid, data){
  return addDoc(focusCol(uid), { ...data, completedAt: serverTimestamp() });
}
