// ============================================================
// Controla qual painel principal está visível (vazio / hábito
// selecionado / visão geral) e qual item da barra lateral está
// marcado como ativo. Compartilhado entre habits.js e overview.js
// para eles não precisarem se conhecer diretamente.
// ============================================================

const panels = {
  empty: document.getElementById("panel-empty"),
  habit: document.getElementById("panel-habit"),
  overview: document.getElementById("panel-overview"),
};

export function showPanel(which){
  Object.entries(panels).forEach(([key, el]) => {
    el.classList.toggle("is-hidden", key !== which);
  });
}

export function setActiveNav(el){
  document.querySelectorAll(".habit-row").forEach(b => b.classList.remove("is-active"));
  if(el) el.classList.add("is-active");
}
