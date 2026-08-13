import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  onSnapshot, query, orderBy, getDocs, serverTimestamp
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

export { serverTimestamp };
