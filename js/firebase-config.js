// ============================================================
// Configuração do Firebase
// ------------------------------------------------------------
// 1. Vá em https://console.firebase.google.com → crie um projeto
// 2. Adicione um "app da Web" (ícone </>) e copie o objeto de
//    configuração que ele te der, colando aqui embaixo.
// 3. Em Build → Authentication → Sign-in method, ative
//    "E-mail/senha".
// 4. Em Build → Firestore Database, crie o banco (modo produção)
//    e depois publique as regras do arquivo firestore.rules
//    (Firestore → Regras → cole o conteúdo → Publicar).
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgzmf2W5YrYHOdqpQjrcxyRkotlRae0ck",
  authDomain: "haime-6c926.firebaseapp.com",
  projectId: "haime-6c926",
  storageBucket: "haime-6c926.firebasestorage.app",
  messagingSenderId: "1003120708430",
  appId: "1:1003120708430:web:c096d4d894404263f02c1f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
