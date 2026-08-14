import { getHabitsOnce, setLog, watchFocusSessions, logFocusSession } from "./db.js";
import { toDateKey } from "./calendar.js";
import { showPanel, setActiveNav, registerTeardown, teardownOthers } from "./panel-router.js";
import { showToast } from "./toast.js";

let uid = null;
let habits = [];
let sessionsUnsub = null;

let selectedMinutes = 25;
let remainingSeconds = 25 * 60;
let running = false;
let intervalId = null;
let endAt = null; // timestamp absoluto (Date.now() + ms restantes) — é o que garante
                   // que o timer "se corrige" sozinho mesmo se o navegador pausar o
                   // setInterval em segundo plano ou com a tela travada.
let wakeLock = null;

const btnTimer = document.getElementById("btn-timer");
const timeEl = document.getElementById("timer-time");
const progressFill = document.getElementById("timer-progress-fill");
const presetsWrap = document.getElementById("timer-presets");
const customInput = document.getElementById("timer-custom-min");
const habitSelect = document.getElementById("timer-habit-select");
const btnStart = document.getElementById("timer-start");
const btnPause = document.getElementById("timer-pause");
const btnReset = document.getElementById("timer-reset");
const sessionsList = document.getElementById("timer-sessions-list");
const sessionsEmpty = document.getElementById("timer-sessions-empty");

export function initTimerUid(userId){
  uid = userId;
}

export function teardownTimer(){
  if(sessionsUnsub){ sessionsUnsub(); sessionsUnsub = null; }
  sessionsList.innerHTML = "";
  // o timer em si continua rodando em segundo plano mesmo saindo da aba;
  // só paramos de escutar o histórico de sessões.
}
registerTeardown("timer", teardownTimer);

btnTimer.addEventListener("click", () => {
  teardownOthers("timer");
  showPanel("timer");
  setActiveNav(btnTimer);
  loadHabitOptions();
  subscribeSessions();
});

presetsWrap.querySelectorAll(".timer-preset").forEach(btn => {
  btn.addEventListener("click", () => {
    if(running) return;
    setMinutes(Number(btn.dataset.min));
    customInput.value = "";
  });
});

customInput.addEventListener("change", () => {
  const val = Math.max(1, Math.min(240, Number(customInput.value) || 0));
  if(val > 0 && !running) setMinutes(val);
});

function setMinutes(min){
  selectedMinutes = min;
  remainingSeconds = min * 60;
  presetsWrap.querySelectorAll(".timer-preset").forEach(b =>
    b.classList.toggle("is-active", Number(b.dataset.min) === min));
  render();
}

btnStart.addEventListener("click", () => {
  running = true;
  endAt = Date.now() + remainingSeconds * 1000;
  btnStart.classList.add("is-hidden");
  btnPause.classList.remove("is-hidden");
  presetsWrap.querySelectorAll(".timer-preset").forEach(b => b.disabled = true);
  customInput.disabled = true;
  habitSelect.disabled = true;

  requestWakeLock();
  intervalId = setInterval(tick, 1000);
});

function tick(){
  // recalcula a partir do horário absoluto — mesmo que o navegador tenha
  // "pulado" alguns segundos (aba em segundo plano), o resultado fica certo.
  remainingSeconds = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  if(remainingSeconds <= 0){
    finishSession();
  } else {
    render();
  }
}

btnPause.addEventListener("click", () => {
  running = false;
  clearInterval(intervalId);
  releaseWakeLock();
  btnStart.classList.remove("is-hidden");
  btnStart.textContent = "Continuar";
  btnPause.classList.add("is-hidden");
});

btnReset.addEventListener("click", () => {
  running = false;
  clearInterval(intervalId);
  releaseWakeLock();
  remainingSeconds = selectedMinutes * 60;
  endAt = null;
  btnStart.classList.remove("is-hidden");
  btnStart.textContent = "Iniciar";
  btnPause.classList.add("is-hidden");
  presetsWrap.querySelectorAll(".timer-preset").forEach(b => b.disabled = false);
  customInput.disabled = false;
  habitSelect.disabled = false;
  render();
});

// se a aba volta a ficar visível (usuário reabriu o app / destravou a tela),
// recalcula o tempo restante na hora — o navegador pode ter pausado o
// setInterval enquanto estava em segundo plano, então sem isso o timer
// ficaria "parado" mostrando um valor desatualizado até o próximo tick.
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && running && endAt){
    tick();
    requestWakeLock();
  }
});

async function requestWakeLock(){
  try{
    if("wakeLock" in navigator){
      wakeLock = await navigator.wakeLock.request("screen");
    }
  }catch(err){
    // alguns navegadores negam (ex.: bateria fraca) — sem problema,
    // o timer continua funcionando, só não impede a tela de travar
    console.warn("[Haimë timer] wake lock indisponível:", err);
  }
}

function releaseWakeLock(){
  try{ wakeLock?.release(); }catch(err){ /* ignora */ }
  wakeLock = null;
}

async function finishSession(){
  running = false;
  clearInterval(intervalId);
  releaseWakeLock();
  remainingSeconds = 0;
  endAt = null;
  render();
  playBeep();
  notify();

  const habitId = habitSelect.value || null;
  const habitName = habitId ? habitSelect.options[habitSelect.selectedIndex].textContent : null;

  try{
    await logFocusSession(uid, { minutes: selectedMinutes, habitId, habitName });
  }catch(err){ console.error("[Haimë timer] falha ao salvar sessão:", err); }

  if(habitId){
    const habit = habits.find(h => h.id === habitId);
    if(habit){
      try{
        await setLog(uid, habitId, toDateKey(new Date()), 1);
        showToast(`Sessão concluída — "${habit.name}" marcado hoje.`);
      }catch(err){
        console.error(err);
        showToast("Sessão concluída, mas não consegui marcar o hábito.");
      }
    }
  } else {
    showToast(`Sessão de ${selectedMinutes} min concluída! 🎉`);
  }

  btnStart.classList.remove("is-hidden");
  btnStart.textContent = "Iniciar";
  btnPause.classList.add("is-hidden");
  presetsWrap.querySelectorAll(".timer-preset").forEach(b => b.disabled = false);
  customInput.disabled = false;
  habitSelect.disabled = false;
}

function render(){
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  timeEl.textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  const total = selectedMinutes * 60;
  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - remainingSeconds) / total) * 100)) : 0;
  progressFill.style.width = `${pct}%`;
}

async function loadHabitOptions(){
  if(!uid) return;
  try{
    habits = (await getHabitsOnce(uid)).filter(h => !h.archived);
  }catch(err){ console.error(err); habits = []; }
  const current = habitSelect.value;
  habitSelect.innerHTML = `<option value="">Nenhum</option>` +
    habits.map(h => `<option value="${h.id}">${h.icon} ${escapeHtml(h.name)}</option>`).join("");
  habitSelect.value = current;
}

function subscribeSessions(){
  if(sessionsUnsub) sessionsUnsub();
  sessionsUnsub = watchFocusSessions(uid, (sessions) => {
    sessionsEmpty.classList.toggle("is-hidden", sessions.length > 0);
    sessionsList.innerHTML = "";
    sessions.forEach(s => {
      const row = document.createElement("div");
      row.className = "today-row";
      const when = s.completedAt?.toDate ? s.completedAt.toDate().toLocaleString("pt-BR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
      row.innerHTML = `
        <span class="habit-dot overview-nav-dot">⏱</span>
        <span class="today-row-body">
          <span class="today-row-name">${s.minutes} min${s.habitName ? ` · ${escapeHtml(s.habitName)}` : ""}</span>
          <span class="today-row-freq">${when}</span>
        </span>
      `;
      sessionsList.appendChild(row);
    });
  });
}

function playBeep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.16, ctx.currentTime + i*0.28);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.28 + 0.35);
      osc.start(ctx.currentTime + i*0.28);
      osc.stop(ctx.currentTime + i*0.28 + 0.4);
    });
  }catch(err){ /* Web Audio indisponível — sem som, sem problema */ }
}

function notify(){
  try{
    if("Notification" in window){
      if(Notification.permission === "granted"){
        new Notification("Haimë", { body: "Sua sessão de foco terminou." });
      } else if(Notification.permission !== "denied"){
        Notification.requestPermission();
      }
    }
  }catch(err){ /* ignora se não suportado */ }
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

render();
