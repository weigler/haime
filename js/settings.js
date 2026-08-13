// ============================================================
// Configurações: tema (claro/escuro) e paleta de cor de fundo.
// Aplicados via atributos data-theme / data-palette na <html>
// e salvos no localStorage (preferência por dispositivo).
// A tela de login já aplica o tema salvo antes do CSS carregar
// (ver o <script> inline no <head> do index.html).
// ============================================================

const THEME_KEY = "haime-theme";
const PALETTE_KEY = "haime-palette";

export const PALETTES = [
  { id: "slate", name: "Ardósia", light: "#F7F8F9", dark: "#15181C" },
  { id: "ivory", name: "Marfim",  light: "#FBF8F2", dark: "#1C1812" },
  { id: "mist",  name: "Bruma",   light: "#F5F7FB", dark: "#10151D" },
  { id: "moss",  name: "Musgo",   light: "#F5F8F4", dark: "#10160F" },
  { id: "plum",  name: "Ameixa",  light: "#F8F6FA", dark: "#150F1C" },
  { id: "mono",  name: "Carvão",  light: "#FFFFFF", dark: "#0A0A0A" },
];

const root = document.documentElement;
const modal = document.getElementById("settings-modal");
const paletteGrid = document.getElementById("palette-grid");

// monta a grade de paletas dinamicamente
PALETTES.forEach(p => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "palette-opt";
  btn.dataset.palette = p.id;
  btn.innerHTML = `
    <span class="palette-swatch-pair">
      <span style="background:${p.light}"></span>
      <span style="background:${p.dark}"></span>
    </span>
    ${p.name}
  `;
  btn.addEventListener("click", () => applyPalette(p.id));
  paletteGrid.appendChild(btn);
});

document.querySelectorAll("#theme-toggle .theme-opt").forEach(btn => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
});

document.getElementById("btn-settings").addEventListener("click", () => {
  syncControls();
  modal.classList.remove("is-hidden");
});
document.getElementById("settings-close").addEventListener("click", closeSettings);
modal.addEventListener("click", (e) => { if(e.target === modal) closeSettings(); });

function closeSettings(){ modal.classList.add("is-hidden"); }

function applyTheme(theme){
  root.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  syncControls();
}

function applyPalette(paletteId){
  root.setAttribute("data-palette", paletteId);
  localStorage.setItem(PALETTE_KEY, paletteId);
  syncControls();
}

function syncControls(){
  const theme = root.getAttribute("data-theme") || "dark";
  const palette = root.getAttribute("data-palette") || "slate";
  document.querySelectorAll("#theme-toggle .theme-opt").forEach(b =>
    b.classList.toggle("is-active", b.dataset.theme === theme));
  document.querySelectorAll(".palette-opt").forEach(b =>
    b.classList.toggle("is-active", b.dataset.palette === palette));
}

// garante que o estado inicial (definido no <head>) já venha refletido nos controles
syncControls();
