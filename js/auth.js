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

const googleProvider = new GoogleAuthProvider();

const authError = document.getElementById("auth-error");

function showAuthError(err){
  console.error(err);
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Não achei essa conta. Confira o e-mail ou crie uma nova.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres."
  };
  authError.textContent = map[err.code] || "Algo deu errado. Tente de novo.";
}

// --- alternância entre abas Entrar / Criar conta ---
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    authError.textContent = "";
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
    await signInWithEmailAndPassword(auth, email, password);
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
    await updateProfile(cred.user, { displayName: name });
    await ensureUserDoc(cred.user);
  }catch(err){ showAuthError(err); }
});

// --- entrar com Google ---
document.getElementById("google-signin").addEventListener("click", async () => {
  authError.textContent = "";
  try{
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(cred.user);
  }catch(err){ showAuthError(err); }
});

async function ensureUserDoc(user){
  await setDoc(doc(db, "users", user.uid), {
    name: user.displayName || "",
    email: user.email || "",
    updatedAt: serverTimestamp()
  }, { merge: true });
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
