import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAllowlist } from "./db.js";

const googleProvider = new GoogleAuthProvider();

const authError = document.getElementById("auth-error");

// ------------------------------------------------------------
// Aviso automático para os dois problemas mais comuns ao testar:
// 1) abrir o index.html direto do disco (file://) em vez de
//    servir por http(s) — o Firebase Auth não funciona assim.
// 2) o domínio atual não estar na lista de domínios autorizados
//    do Firebase (Authentication → Settings → Authorized domains).
// ------------------------------------------------------------
if(location.protocol === "file:"){
  authError.innerHTML =
    "Este arquivo foi aberto direto do computador (file://). O login do Firebase " +
    "só funciona servido por http/https — teste pelo link do GitHub Pages, ou rode " +
    "um servidor local (ex.: <code>npx serve</code>) e abra por http://localhost.";
}

function showAuthError(err){
  console.error("[Haimë auth]", err);
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Não achei essa conta. Confira o e-mail ou crie uma nova.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/operation-not-allowed": "Esse método de login não está ativado no Firebase. Vá em Authentication → Sign-in method e ative E-mail/senha ou Google.",
    "auth/unauthorized-domain": `Este domínio (${location.hostname}) não está autorizado no Firebase. Vá em Authentication → Settings → Authorized domains e adicione "${location.hostname}".`,
    "auth/network-request-failed": "Falha de rede. Verifique sua internet e tente de novo.",
    "auth/popup-blocked": "O navegador bloqueou o pop-up de login. Permita pop-ups para este site e tente de novo.",
    "auth/popup-closed-by-user": "A janela de login do Google foi fechada antes de terminar.",
    "auth/cancelled-popup-request": "Login cancelado — só uma janela de login pode ficar aberta por vez.",
    "auth/web-storage-unsupported": "Este navegador (ou o modo privado/anônimo) está bloqueando cookies necessários para o login com Google.",
    "auth/internal-error": "Erro interno do Firebase. Confira se o projeto e a apiKey em firebase-config.js estão corretos.",
    "auth/configuration-not-found": "O provedor de login não está configurado no Firebase (ative em Authentication → Sign-in method)."
  };
  const friendly = map[err.code];
  authError.innerHTML = friendly
    ? `${friendly}<br><span style="opacity:.6">(${err.code})</span>`
    : `Algo deu errado: ${err.message || err.code || "erro desconhecido"}`;
}

// --- alternância entre abas Entrar / Criar conta ---
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    if(location.protocol !== "file:") authError.textContent = "";
    const isSignup = tab.dataset.tab === "signup";
    document.getElementById("signin-form").classList.toggle("is-hidden", isSignup);
    document.getElementById("signup-form").classList.toggle("is-hidden", !isSignup);
  });
});

// --- entrar com e-mail/senha ---
document.getElementById("signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value;
  try{
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if(!(await checkAllowed(cred.user))) return;
  }catch(err){ showAuthError(err); }
});

// --- criar conta com e-mail/senha ---
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if(!(await checkAllowed(cred.user))) return;
    await updateProfile(cred.user, { displayName: name });
    await ensureUserDoc(cred.user);
  }catch(err){ showAuthError(err); }
});

// --- entrar com Google ---
document.getElementById("google-signin").addEventListener("click", async () => {
  authError.textContent = "";
  try{
    const cred = await signInWithPopup(auth, googleProvider);
    if(!(await checkAllowed(cred.user))) return;
    await ensureUserDoc(cred.user);
  }catch(err){ showAuthError(err); }
});

// confere a lista de autorização (config/allowlist). Se o documento
// não existir, o acesso fica livre (recurso desligado por padrão).
// Se existir e o e-mail não estiver nela, desloga e avisa.
async function checkAllowed(user){
  let list;
  try{
    list = await getAllowlist();
  }catch(err){
    console.error("[Haimë auth] Falha ao ler a allowlist:", err);
    return true; // não bloqueia o acesso por causa de um erro de leitura
  }
  if(list === null) return true;
  const email = (user.email || "").toLowerCase().trim();
  if(list.includes(email)) return true;

  await signOut(auth);
  authError.innerHTML =
    `Este e-mail (${email}) ainda não foi autorizado a usar o Haimë. ` +
    `Peça para quem administra o app adicionar seu e-mail na lista de acesso.`;
  return false;
}

async function ensureUserDoc(user){
  try{
    await setDoc(doc(db, "users", user.uid), {
      name: user.displayName || "",
      email: user.email || "",
      updatedAt: serverTimestamp()
    }, { merge: true });
  }catch(err){
    // a conta já foi criada no Auth nesse ponto; um erro aqui costuma ser
    // regra do Firestore ainda não publicada — avisamos sem desfazer o login
    console.error("[Haimë auth] Falha ao gravar users/{uid}:", err);
    showAuthError({ code: err.code, message: "Login funcionou, mas não consegui salvar seu perfil no Firestore — confira se as regras (firestore.rules) foram publicadas." });
  }
}

export function watchAuth(onLogin, onLogout){
  onAuthStateChanged(auth, (user) => {
    if(user){ onLogin(user); }
    else{ onLogout(); }
  });
}

export async function logout(){
  await signOut(auth);
}
