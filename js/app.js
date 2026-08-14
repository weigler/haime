import { watchAuth, logout, checkAllowed } from "./auth.js";
import { initHabits, teardownHabits } from "./habits.js";
import { initOverviewUid, teardownOverview } from "./overview.js";
import { initTasksUid, teardownTasks } from "./tasks.js";
import { initTodayUid, teardownToday, enterToday } from "./today.js";
import { initTimerUid, teardownTimer } from "./timer.js";
import { initGoalsUid, teardownGoals } from "./goals.js";
import { initDataTools, teardownDataTools } from "./data-tools.js";
import { initProfileUid, applyTopbarIdentity } from "./profile.js";
import { getUserDoc } from "./db.js";
import { runAutoBackupIfDue } from "./backup.js";
import { showToast } from "./toast.js";
import { showPanel, setActiveNav } from "./panel-router.js";

const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const userMenuBtn = document.getElementById("btn-user-menu");

watchAuth(
  async (user) => {
    // checa a lista de autorização em TODA mudança de estado de login —
    // inclusive quando a página recarrega com uma sessão já aberta —
    // não só no momento do cadastro/login. Se não for permitido,
    // checkAllowed já desloga e mostra o aviso; não avançamos daqui.
    const allowed = await checkAllowed(user);
    if(!allowed) return;

    authScreen.classList.add("is-hidden");
    appScreen.classList.remove("is-hidden");
    userMenuBtn.title = user.displayName || user.email || "";
    initHabits(user.uid);
    initOverviewUid(user.uid);
    initTasksUid(user.uid);
    initTodayUid(user.uid);
    initTimerUid(user.uid);
    initGoalsUid(user.uid);
    initDataTools(user.uid);
    initProfileUid(user.uid);
    enterToday(); // tela inicial, como no app de referência

    // aplica nome/foto salvos no chip do topo (cai pra inicial do e-mail se não tiver nada ainda)
    getUserDoc(user.uid)
      .then(userDoc => applyTopbarIdentity(user, userDoc))
      .catch(() => applyTopbarIdentity(user, null));

    // backup automático (no máximo 1x por dia), silencioso em segundo plano
    runAutoBackupIfDue(user.uid)
      .then(ran => { if(ran) showToast("Backup automático do dia concluído."); })
      .catch(err => console.error("Backup automático falhou:", err));
  },
  () => {
    authScreen.classList.remove("is-hidden");
    appScreen.classList.add("is-hidden");
    teardownHabits();
    teardownOverview();
    teardownTasks();
    teardownToday();
    teardownTimer();
    teardownGoals();
    teardownDataTools();
    showPanel("empty");
    setActiveNav(null);
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
