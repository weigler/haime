import { auth } from "./firebase-config.js";
import { updateProfile as updateAuthProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getUserDoc, updateUserDoc } from "./db.js";
import { showToast } from "./toast.js";

// tamanho máximo do avatar comprimido (em caracteres da data URL) — o
// documento users/{uid} inteiro tem um teto de 1 MiB no Firestore, então
// isso mantém uma folga bem confortável.
const AVATAR_MAX_CHARS = 220000;
const CANVAS_SIZE = 320; // px, quadrado — também o tamanho final salvo

let uid = null;

const avatarBtn = document.getElementById("profile-avatar-btn");
const avatarInput = document.getElementById("profile-avatar-input");
const avatarInitial = document.getElementById("profile-avatar-initial");
const avatarImg = document.getElementById("profile-avatar-img");
const nameInput = document.getElementById("profile-name-input");
const emailDisplay = document.getElementById("profile-email-display");
const saveBtn = document.getElementById("profile-save-btn");
const statusEl = document.getElementById("profile-status");

const topbarInitial = document.getElementById("user-initial");
const topbarAvatarImg = document.getElementById("user-avatar-img");

export function initProfileUid(userId){
  uid = userId;
}

document.getElementById("btn-settings").addEventListener("click", () => {
  loadProfileIntoSettings();
});

export async function loadProfileIntoSettings(){
  if(!uid || !auth.currentUser) return;
  const user = auth.currentUser;
  emailDisplay.value = user.email || "";

  let userDoc = null;
  try{ userDoc = await getUserDoc(uid); }catch(err){ console.error(err); }

  const name = userDoc?.name || user.displayName || "";
  nameInput.value = name;
  setAvatarPreview(userDoc?.photoURL || null, name || user.email);
}

function setAvatarPreview(photoURL, fallbackLabel){
  if(photoURL){
    avatarImg.src = photoURL;
    avatarImg.classList.remove("is-hidden");
    avatarInitial.classList.add("is-hidden");
  } else {
    avatarImg.classList.add("is-hidden");
    avatarInitial.classList.remove("is-hidden");
    avatarInitial.textContent = (fallbackLabel || "?").trim().charAt(0).toUpperCase();
  }
}

// aplica no chip do topo (chamado no login e sempre que o perfil muda)
export function applyTopbarIdentity(user, userDoc){
  const label = (userDoc?.name || user.displayName || user.email || "?").trim();
  const photoURL = userDoc?.photoURL || null;
  if(photoURL){
    topbarAvatarImg.src = photoURL;
    topbarAvatarImg.classList.remove("is-hidden");
    topbarInitial.classList.add("is-hidden");
  } else {
    topbarAvatarImg.classList.add("is-hidden");
    topbarInitial.classList.remove("is-hidden");
    topbarInitial.textContent = label.charAt(0).toUpperCase();
  }
}

avatarBtn.addEventListener("click", () => avatarInput.click());

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files?.[0];
  avatarInput.value = "";
  if(!file || !uid) return;
  if(!file.type.startsWith("image/")){
    showToast("Escolha um arquivo de imagem.");
    return;
  }
  try{
    await openCropModal(file);
  }catch(err){
    console.error("[Haimë profile] falha ao carregar a imagem:", err);
    showToast("Não consegui abrir essa imagem.");
  }
});

function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms))
  ]);
}

saveBtn.addEventListener("click", async () => {
  if(!uid || !auth.currentUser) return;
  const name = nameInput.value.trim();
  if(!name){
    showToast("Escolha um nome antes de salvar.");
    return;
  }
  saveBtn.disabled = true;
  statusEl.textContent = "Salvando…";
  try{
    // limite de 15s pra nunca ficar preso em "Salvando…" pra sempre,
    // mesmo com internet ruim ou alguma falha silenciosa de rede
    await withTimeout(updateUserDoc(uid, { name }), 15000, "salvar nome");
    await withTimeout(updateAuthProfile(auth.currentUser, { displayName: name }), 15000, "atualizar perfil de login");
    setAvatarPreview((await getUserDoc(uid))?.photoURL || null, name);
    const userDoc = await getUserDoc(uid);
    applyTopbarIdentity(auth.currentUser, userDoc);
    statusEl.textContent = "Nome salvo.";
    showToast("Nome de exibição atualizado.");
  }catch(err){
    console.error("[Haimë profile] falha ao salvar nome:", err);
    const timedOut = String(err?.message || "").startsWith("timeout:");
    showToast(timedOut ? "Demorou demais pra salvar — confira sua internet e tente de novo." : "Não consegui salvar o nome agora.");
    statusEl.textContent = "";
  }finally{
    saveBtn.disabled = false;
  }
});

// ============================================================
// Recorte de avatar: arrastar pra posicionar, zoom pra escalar.
// A pessoa vê exatamente o que vai ser salvo, dentro do círculo.
// ============================================================
const cropModal = document.getElementById("avatar-crop-modal");
const cropCanvas = document.getElementById("avatar-crop-canvas");
const cropCtx = cropCanvas.getContext("2d");
const zoomInput = document.getElementById("avatar-crop-zoom-input");

let cropImage = null;   // ImageBitmap ou HTMLImageElement já com orientação correta
let baseDrawW = 0, baseDrawH = 0; // tamanho do desenho no zoom=1 (cobre o canvas)
let zoom = 1;
let panX = 0, panY = 0;
let dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;

async function openCropModal(file){
  cropImage = await loadOrientedImage(file);
  const iw = cropImage.width, ih = cropImage.height;
  const coverScale = CANVAS_SIZE / Math.min(iw, ih);
  baseDrawW = iw * coverScale;
  baseDrawH = ih * coverScale;
  // começa mostrando a foto INTEIRA (sem cortar as laterais), em vez de já
  // abrir no modo "cover" (que corta os lados em qualquer foto mais larga
  // que alta — a maioria). A pessoa aumenta o zoom depois se quiser um
  // enquadramento mais fechado.
  const fitPct = Math.round((Math.min(iw, ih) / Math.max(iw, ih)) * 100);
  zoom = Math.max(25, Math.min(100, fitPct)) / 100;
  panX = 0;
  panY = 0;
  zoomInput.value = Math.round(zoom * 100);
  redrawCrop();
  cropModal.classList.remove("is-hidden");
}

function closeCropModal(){
  cropModal.classList.add("is-hidden");
  cropImage = null;
}
document.getElementById("avatar-crop-close").addEventListener("click", closeCropModal);
document.getElementById("avatar-crop-cancel").addEventListener("click", closeCropModal);
cropModal.addEventListener("click", (e) => { if(e.target === cropModal) closeCropModal(); });

zoomInput.addEventListener("input", () => {
  zoom = Number(zoomInput.value) / 100;
  clampPan();
  redrawCrop();
});

function clampPan(){
  const maxX = Math.max(0, (baseDrawW * zoom - CANVAS_SIZE) / 2);
  const maxY = Math.max(0, (baseDrawH * zoom - CANVAS_SIZE) / 2);
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
}

function redrawCrop(){
  cropCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  cropCtx.fillStyle = "#000";
  cropCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  cropCtx.save();
  cropCtx.translate(CANVAS_SIZE / 2 + panX, CANVAS_SIZE / 2 + panY);
  cropCtx.scale(zoom, zoom);
  cropCtx.drawImage(cropImage, -baseDrawW / 2, -baseDrawH / 2, baseDrawW, baseDrawH);
  cropCtx.restore();
}

function pointerPos(e){
  const raw = (e.touches && e.touches[0]) ? e.touches[0] : e;
  // o canvas tem resolução interna de CANVAS_SIZE, mas é exibido na tela
  // num tamanho CSS diferente (.avatar-crop-stage) — sem essa conversão,
  // cada pixel arrastado na tela move a imagem numa proporção errada
  // dentro do canvas, e a posição final não bate com o que se vê arrastando.
  const rect = cropCanvas.getBoundingClientRect();
  const scaleX = CANVAS_SIZE / rect.width;
  const scaleY = CANVAS_SIZE / rect.height;
  return { x: raw.clientX * scaleX, y: raw.clientY * scaleY };
}

function startDrag(e){
  if(!cropImage) return;
  dragging = true;
  const p = pointerPos(e);
  dragStartX = p.x; dragStartY = p.y;
  panStartX = panX; panStartY = panY;
}
function moveDrag(e){
  if(!dragging) return;
  e.preventDefault();
  const p = pointerPos(e);
  panX = panStartX + (p.x - dragStartX);
  panY = panStartY + (p.y - dragStartY);
  clampPan();
  redrawCrop();
}
function endDrag(){ dragging = false; }

cropCanvas.addEventListener("mousedown", startDrag);
window.addEventListener("mousemove", moveDrag);
window.addEventListener("mouseup", endDrag);
cropCanvas.addEventListener("touchstart", startDrag, { passive: true });
window.addEventListener("touchmove", moveDrag, { passive: false });
window.addEventListener("touchend", endDrag);

document.getElementById("avatar-crop-save").addEventListener("click", async () => {
  if(!cropImage || !uid) return;
  const dataUrl = compressCanvasToDataUrl();
  if(!dataUrl){
    showToast("Essa imagem ficou grande demais mesmo comprimida. Tenta outra.");
    return;
  }
  closeCropModal();
  statusEl.textContent = "Salvando foto…";
  try{
    await withTimeout(updateUserDoc(uid, { photoURL: dataUrl }), 15000, "salvar foto");
    setAvatarPreview(dataUrl, nameInput.value);
    const userDoc = await getUserDoc(uid);
    applyTopbarIdentity(auth.currentUser, userDoc);
    statusEl.textContent = "Foto atualizada.";
    showToast("Foto de perfil atualizada.");
  }catch(err){
    console.error("[Haimë profile] falha ao salvar avatar:", err);
    const timedOut = String(err?.message || "").startsWith("timeout:");
    showToast(timedOut ? "Demorou demais pra salvar — confira sua internet e tente de novo." : "Não consegui salvar a foto agora.");
    statusEl.textContent = "";
  }
});

// carrega a imagem já com a orientação EXIF corrigida (fotos de celular
// costumam vir "deitadas" com uma flag de rotação — sem tratar isso,
// a prévia sai torta/no formato errado)
async function loadOrientedImage(file){
  if("createImageBitmap" in window){
    try{
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    }catch(err){
      // alguns navegadores mais antigos não aceitam a opção — cai pro fallback
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => resolve(img);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function compressCanvasToDataUrl(){
  let quality = 0.85;
  let dataUrl = cropCanvas.toDataURL("image/jpeg", quality);
  let attempts = 0;
  while(dataUrl.length > AVATAR_MAX_CHARS && attempts < 5){
    quality -= 0.15;
    dataUrl = cropCanvas.toDataURL("image/jpeg", Math.max(0.1, quality));
    attempts++;
  }
  return dataUrl.length > AVATAR_MAX_CHARS ? null : dataUrl;
}
