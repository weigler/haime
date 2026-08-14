// ============================================================
// Controla qual painel principal está visível (vazio / hábito
// selecionado / visão geral / tarefas) e qual item da barra
// lateral está marcado como ativo.
//
// As "views exclusivas" (hábito, visão geral, tarefas) se
// registram aqui com uma função de teardown. Assim, ao entrar
// em uma delas, as outras duas são encerradas automaticamente
// sem que os módulos precisem se importar uns aos outros.
// ============================================================

const panels = {
  empty: document.getElementById("panel-empty"),
  habit: document.getElementById("panel-habit"),
  overview: document.getElementById("panel-overview"),
  tasks: document.getElementById("panel-tasks"),
  today: document.getElementById("panel-today"),
  timer: document.getElementById("panel-timer"),
  goals: document.getElementById("panel-goals"),
};

const layoutEl = document.querySelector(".layout");

const teardowns = {};

export function showPanel(which){
  // qualquer troca de painel sai do modo "lista de hábitos em tela cheia"
  // do celular — evita a barra lateral ficar presa em cima das outras abas
  layoutEl.classList.remove("mobile-show-habits");
  Object.entries(panels).forEach(([key, el]) => {
    el.classList.toggle("is-hidden", key !== which);
  });
}

// usado pela aba "Hábitos" da barra de abas do celular/tablet: mostra a
// lista em tela cheia, escondendo o painel principal até um hábito ser
// escolhido (o que aciona showPanel de novo e sai desse modo).
export function showMobileHabitsList(){
  layoutEl.classList.add("mobile-show-habits");
}

export function setActiveNav(el){
  document.querySelectorAll(".habit-row").forEach(b => b.classList.remove("is-active"));
  if(el) el.classList.add("is-active");
}

export function registerTeardown(key, fn){
  teardowns[key] = fn;
}

export function teardownOthers(exceptKey){
  Object.entries(teardowns).forEach(([key, fn]) => { if(key !== exceptKey) fn(); });
}
