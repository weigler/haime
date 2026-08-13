import { runManualBackup, getLastBackupLabel } from "./backup.js";
import { exportPdf } from "./pdfexport.js";
import { showToast } from "./toast.js";

let uid = null;

const btnSettings = document.getElementById("btn-settings");
const btnManualBackup = document.getElementById("btn-manual-backup");
const btnExportPdf = document.getElementById("btn-export-pdf");
const backupStatus = document.getElementById("backup-status");

export function initDataTools(userId){
  uid = userId;
}

export function teardownDataTools(){
  uid = null;
}

btnSettings.addEventListener("click", refreshBackupStatus);

btnManualBackup.addEventListener("click", async () => {
  if(!uid) return;
  const original = btnManualBackup.textContent;
  btnManualBackup.disabled = true;
  btnManualBackup.textContent = "Fazendo backup…";
  try{
    await runManualBackup(uid);
    showToast("Backup salvo no Firestore e baixado no aparelho.");
    refreshBackupStatus();
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
