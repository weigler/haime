// ============================================================
// Backup dos dados do usuário.
// ------------------------------------------------------------
// - Automático: roda no máximo 1x a cada 24h (verificado pelo
//   campo users/{uid}.lastBackupAt) e grava por cima do mesmo
//   documento "backups/auto-latest", pra não acumular espaço.
// - Manual: grava um documento novo com data no nome (histórico
//   fica guardado) e também baixa um arquivo .json no aparelho.
//
// Sobre os limites do Firestore (plano gratuito "Spark"): 1 GiB
// de armazenamento e 50 mil leituras / 20 mil escritas por dia.
// Um backup completo do Haimë (alguns hábitos + marcações diárias)
// normalmente fica na casa dos poucos KB a poucas centenas de KB
// — bem longe do limite de 1 MiB por documento e do teto de
// armazenamento do plano gratuito.
// ============================================================

import { getHabitsOnceRaw, getLogsOnce, writeBackupDoc, listBackups, restoreHabitDoc, restoreLogDoc, getUserDoc, updateUserDoc, serverTimestamp } from "./db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildSnapshot(uid){
  // usa a versão "crua" (sem decifrar) — o backup precisa guardar
  // exatamente o que está no banco, senão viraria uma porta dos
  // fundos pra ler nomes cifrados em texto livre.
  const habits = await getHabitsOnceRaw(uid);
  const data = {};
  for(const h of habits){
    const { createdAt, ...rest } = h;
    data[h.id] = {
      habit: {
        ...rest,
        createdAt: createdAt?.toDate ? createdAt.toDate().toISOString() : null
      },
      logs: await getLogsOnce(uid, h.id)
    };
  }
  return { generatedAt: new Date().toISOString(), habits: data };
}

export async function runAutoBackupIfDue(uid){
  const userDoc = await getUserDoc(uid);
  const last = parseTimestamp(userDoc?.lastBackupAt);
  if(last && (Date.now() - last.getTime()) < DAY_MS) return false;

  const snapshot = await buildSnapshot(uid);
  await writeBackupDoc(uid, "auto-latest", snapshot);
  await updateUserDoc(uid, { lastBackupAt: serverTimestamp() });
  return true;
}

export async function runManualBackup(uid){
  const snapshot = await buildSnapshot(uid);
  const id = "manual-" + new Date().toISOString().replace(/[:.]/g, "-");
  await writeBackupDoc(uid, id, snapshot);
  await updateUserDoc(uid, { lastBackupAt: serverTimestamp() });
  downloadJson(snapshot, `haime-backup-${new Date().toISOString().slice(0,10)}.json`);
  return snapshot;
}

export async function getLastBackupLabel(uid){
  const userDoc = await getUserDoc(uid);
  const last = parseTimestamp(userDoc?.lastBackupAt);
  if(!last) return "Ainda não houve backup.";
  return `Último backup: ${last.toLocaleDateString("pt-BR")} às ${last.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"})}`;
}

// ------------------------------------------------------------
// Lista os backups disponíveis (o automático + cada manual),
// mais recente primeiro, com um rótulo pronto pra exibir.
// ------------------------------------------------------------
export async function getBackupList(uid){
  const list = await listBackups(uid);
  return list.map(b => {
    const when = parseTimestamp(b.generatedAt);
    const isAuto = b.id === "auto-latest";
    const habitCount = Object.keys(b.habits || {}).length;
    return {
      id: b.id,
      label: isAuto ? "Automático" : "Manual",
      whenLabel: when
        ? `${when.toLocaleDateString("pt-BR")} às ${when.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"})}`
        : "data desconhecida",
      habitCount,
    };
  });
}

// ------------------------------------------------------------
// Restaura um backup: regrava cada hábito (com o mesmo id de
// antes) e todas as marcações dele. Não apaga hábitos que não
// estavam no backup — é um "mesclar de volta", não uma
// substituição total, pra reduzir o risco de perder algo por
// engano.
// ------------------------------------------------------------
export async function restoreFromBackup(uid, backupId, onProgress){
  const backups = await listBackups(uid);
  const backup = backups.find(b => b.id === backupId);
  if(!backup) throw new Error("Backup não encontrado.");

  const entries = Object.entries(backup.habits || {});
  let done = 0;
  for(const [habitId, entry] of entries){
    const { habit, logs } = entry;
    const restoredHabit = {
      ...habit,
      createdAt: habit?.createdAt ? new Date(habit.createdAt) : serverTimestamp(),
    };
    await restoreHabitDoc(uid, habitId, restoredHabit);
    for(const [dateKey, log] of Object.entries(logs || {})){
      await restoreLogDoc(uid, habitId, dateKey, log);
    }
    done++;
    if(onProgress) onProgress(done, entries.length);
  }
  return entries.length;
}

function parseTimestamp(value){
  if(!value) return null;
  if(value.toDate) return value.toDate();
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function downloadJson(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
