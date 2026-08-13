import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  onSnapshot, query, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

export function watchHabits(uid, callback){
  const q = query(habitsCol(uid), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const habits = [];
    snap.forEach(d => habits.push({ id: d.id, ...d.data() }));
    callback(habits);
  });
}

export async function createHabit(uid, data){
  return addDoc(habitsCol(uid), {
    ...data,
    archived: false,
    createdAt: serverTimestamp()
  });
}

export async function updateHabit(uid, habitId, data){
  return updateDoc(doc(db, "users", uid, "habits", habitId), data);
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
// ------------------------------------------------------------
export async function getHabitsOnce(uid){
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
// Tarefas (To-Do), com sub-itens opcionais (ex.: lista de mercado)
// ------------------------------------------------------------
export function watchTasks(uid, callback){
  const q = query(tasksCol(uid), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const tasks = [];
    snap.forEach(d => tasks.push({ id: d.id, ...d.data() }));
    callback(tasks);
  });
}

export async function createTask(uid, title){
  return addDoc(tasksCol(uid), {
    title,
    done: false,
    items: [],
    dueDate: null,
    priority: null,
    createdAt: serverTimestamp()
  });
}

export async function updateTask(uid, taskId, data){
  return updateDoc(doc(db, "users", uid, "tasks", taskId), data);
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
  return onSnapshot(q, (snap) => {
    const goals = [];
    snap.forEach(d => goals.push({ id: d.id, ...d.data() }));
    callback(goals);
  });
}

export async function createGoal(uid, data){
  return addDoc(goalsCol(uid), {
    ...data,
    done: false,
    progress: 0,
    createdAt: serverTimestamp()
  });
}

export async function updateGoal(uid, goalId, data){
  return updateDoc(doc(db, "users", uid, "goals", goalId), data);
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
