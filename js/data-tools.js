import { runManualBackup, getLastBackupLabel, getBackupList, restoreFromBackup } from "./backup.js";
import { exportPdf } from "./pdfexport.js";
import { encryptExistingData } from "./db.js";
import { showToast } from "./toast.js";

let uid = null;

const btnSettings = document.getElementById("btn-settings");
const btnManualBackup = document.getElementById("btn-manual-backup");
const btnExportPdf = document.getElementById("btn-export-pdf");
const btnEncryptExisting = document.getElementById("btn-encrypt-existing");
const backupStatus = document.getElementById("backup-status");
const backupList = document.getElementById("backup-list");
const encryptStatus = document.getElementById("encrypt-status");

export function initDataTools(userId){
  uid = userId;
}

export function teardownDataTools(){
  uid = null;
}

btnSettings.addEventListener("click", () => {
  refreshBackupStatus();
  refreshBackupList();
});

btnManualBackup.addEventListener("click", async () => {
  if(!uid) return;
  const original = btnManualBackup.textContent;
  btnManualBackup.disabled = true;
  btnManualBackup.textContent = "Fazendo backup…";
  try{
    await runManualBackup(uid);
    showToast("Backup salvo no Firestore e baixado no aparelho.");
    refreshBackupStatus();
    refreshBackupList();
  }catch(err){
    console.error(err);
    showToast("Não consegui fazer o backup agora. Confira as regras do Firestore.");
  }finally{
    btnManualBackup.disabled = false;
    btnManualBackup.textContent = original;
  }
});

btnExportPdf.addEventListener("click", async () => {
  if(!uid) return;
  const original = btnExportPdf.textContent;
  btnExportPdf.disabled = true;
  btnExportPdf.textContent = "Gerando PDF…";
  try{
    await exportPdf(uid);
  }catch(err){
    console.error(err);
    showToast("Não consegui gerar o PDF agora.");
  }finally{
    btnExportPdf.disabled = false;
    btnExportPdf.textContent = original;
  }
});

btnEncryptExisting.addEventListener("click", async () => {
  if(!uid) return;
  btnEncryptExisting.disabled = true;
  encryptStatus.textContent = "Cifrando…";
  try{
    const total = await encryptExistingData(uid, (done, tot) => {
      encryptStatus.textContent = `Cifrando… ${done}/${tot}`;
    });
    encryptStatus.textContent = total > 0
      ? `Pronto — ${total} item${total!==1?"s":""} verificado${total!==1?"s":""}.`
      : "Nada pra cifrar ainda.";
    showToast("Dados existentes cifrados.");
  }catch(err){
    console.error(err);
    showToast("Não consegui cifrar os dados existentes agora.");
    encryptStatus.textContent = "";
  }finally{
    btnEncryptExisting.disabled = false;
  }
});

async function refreshBackupStatus(){
  if(!uid) return;
  backupStatus.textContent = "Carregando…";
  try{
    backupStatus.textContent = await getLastBackupLabel(uid);
  }catch(err){
    console.error(err);
    backupStatus.textContent = "Não consegui carregar o status do backup.";
  }
}

async function refreshBackupList(){
  if(!uid) return;
  backupList.innerHTML = `<p class="settings-hint">Carregando backups…</p>`;
  try{
    const backups = await getBackupList(uid);
    if(backups.length === 0){
      backupList.innerHTML = `<p class="settings-hint">Nenhum backup ainda.</p>`;
      return;
    }
    backupList.innerHTML = "";
    backups.forEach(b => {
      const row = document.createElement("div");
      row.className = "backup-row";
      row.innerHTML = `
        <span class="backup-row-label"><strong>${b.label}</strong> · ${b.whenLabel} · ${b.habitCount} hábito${b.habitCount!==1?"s":""}</span>
        <button type="button" class="btn btn-ghost btn-sm">Restaurar</button>
      `;
      row.querySelector("button").addEventListener("click", (e) => handleRestore(b, e.currentTarget));
      backupList.appendChild(row);
    });
  }catch(err){
    console.error(err);
    backupList.innerHTML = `<p class="settings-hint">Não consegui carregar os backups.</p>`;
  }
}

async function handleRestore(b, btn){
  const confirmed = confirm(
    `Restaurar o backup ${b.label.toLowerCase()} de ${b.whenLabel}?\n\n` +
    `Isso regrava ${b.habitCount} hábito${b.habitCount!==1?"s":""} e todo o histórico deles com os dados salvos ` +
    `nesse backup. Hábitos criados DEPOIS desse backup não são apagados, mas hábitos que existiam ` +
    `nele voltam exatamente como estavam.`
  );
  if(!confirmed) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  try{
    btn.textContent = "Restaurando…";
    await restoreFromBackup(uid, b.id, (done, total) => {
      btn.textContent = `${done}/${total}…`;
    });
    showToast("Backup restaurado.");
    btn.textContent = "Restaurado ✓";
  }catch(err){
    console.error(err);
    showToast("Não consegui restaurar esse backup.");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
