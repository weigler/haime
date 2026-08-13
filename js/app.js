import { watchAuth, logout } from "./auth.js";
import { initHabits, teardownHabits } from "./habits.js";
import { initOverviewUid } from "./overview.js";
import { initDataTools, teardownDataTools } from "./data-tools.js";
import { runAutoBackupIfDue } from "./backup.js";
import { showToast } from "./toast.js";

const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const userInitial = document.getElementById("user-initial");
const userMenuBtn = document.getElementById("btn-user-menu");

watchAuth(
  (user) => {
    authScreen.classList.add("is-hidden");
    appScreen.classList.remove("is-hidden");
    const label = (user.displayName || user.email || "?").trim();
    userInitial.textContent = label.charAt(0).toUpperCase();
    userMenuBtn.title = user.displayName || user.email || "";
    initHabits(user.uid);
    initOverviewUid(user.uid);
    initDataTools(user.uid);

    // backup automático (no máximo 1x por dia), silencioso em segundo plano
    runAutoBackupIfDue(user.uid)
      .then(ran => { if(ran) showToast("Backup automático do dia concluído."); })
      .catch(err => console.error("Backup automático falhou:", err));
  },
  () => {
    authScreen.classList.remove("is-hidden");
    appScreen.classList.add("is-hidden");
    teardownHabits();
    teardownDataTools();
  }
);

userMenuBtn.addEventListener("click", async () => {
  if(confirm("Sair da sua conta?")){
    await logout();
  }
});

// registra o service worker (PWA / uso offline básico)
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
