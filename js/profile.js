import { auth } from "./firebase-config.js";
import { updateProfile as updateAuthProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getUserDoc, updateUserDoc } from "./db.js";
import { showToast } from "./toast.js";

// tamanho máximo do avatar comprimido (em caracteres da data URL) — o
// documento users/{uid} inteiro tem um teto de 1 MiB no Firestore, então
// isso mantém uma folga bem confortável.
const AVATAR_MAX_CHARS = 220000;
const AVATAR_SIZE = 160; // px, quadrado

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

  statusEl.textContent = "Processando imagem…";
  try{
    const dataUrl = await compressImageToDataUrl(file);
    if(!dataUrl){
      showToast("Essa imagem ficou grande demais mesmo comprimida. Tenta outra.");
      statusEl.textContent = "";
      return;
    }
    await updateUserDoc(uid, { photoURL: dataUrl });
    setAvatarPreview(dataUrl, nameInput.value);
    const userDoc = await getUserDoc(uid);
    applyTopbarIdentity(auth.currentUser, userDoc);
    statusEl.textContent = "Foto atualizada.";
    showToast("Foto de perfil atualizada.");
  }catch(err){
    console.error("[Haimë profile] falha ao salvar avatar:", err);
    showToast("Não consegui salvar a foto agora.");
    statusEl.textContent = "";
  }
});

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
    await updateUserDoc(uid, { name });
    await updateAuthProfile(auth.currentUser, { displayName: name });
    setAvatarPreview((await getUserDoc(uid))?.photoURL || null, name);
    const userDoc = await getUserDoc(uid);
    applyTopbarIdentity(auth.currentUser, userDoc);
    statusEl.textContent = "Nome salvo.";
    showToast("Nome de exibição atualizado.");
  }catch(err){
    console.error("[Haimë profile] falha ao salvar nome:", err);
    showToast("Não consegui salvar o nome agora.");
    statusEl.textContent = "";
  }finally{
    saveBtn.disabled = false;
  }
});

// ------------------------------------------------------------
// Redimensiona/comprime a imagem no navegador (canvas) antes de
// salvar como data URL no Firestore. Reduz a qualidade até caber
// num tamanho razoável, ou desiste depois de algumas tentativas.
// ------------------------------------------------------------
function compressImageToDataUrl(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext("2d");

        // recorte "cover" quadrado, centralizado
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        let attempts = 0;
        while(dataUrl.length > AVATAR_MAX_CHARS && attempts < 5){
          quality -= 0.15;
          dataUrl = canvas.toDataURL("image/jpeg", Math.max(0.1, quality));
          attempts++;
        }
        resolve(dataUrl.length > AVATAR_MAX_CHARS ? null : dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
