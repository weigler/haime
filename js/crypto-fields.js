// ============================================================
// Criptografia dos campos de texto livre (nomes/descrições de
// hábitos, tarefas e metas) — números, datas e ids continuam
// normais, sem criptografia.
//
// Objetivo real disto (conversamos sobre isso): impedir que
// alguém — inclusive quem administra o projeto — veja esse texto
// por acidente ao abrir um documento no Firestore Console. NÃO é
// uma proteção contra um ataque deliberado: a chave é derivada
// automaticamente a partir do UID de cada usuário (que já mora no
// próprio caminho do documento) mais um sal fixo do app, então
// alguém com acesso ao código-fonte e ao banco, com esforço
// técnico, consegue reconstruir a chave. O que isso resolve é
// exatamente o que foi pedido: não expor o conteúdo em texto
// livre ao navegar pelos dados.
//
// Por não depender de senha nenhuma:
// - Não existe risco de perda de dados por esquecimento.
// - Ninguém vê nenhum prompt de senha — é 100% automático.
// - Dá pra trocar o nome de exibição à vontade, sem quebrar nada
//   (a chave não depende do nome, só do UID).
// ============================================================

const PREFIX = "encv1:";
const SALT = "haime-app-encryption-namespace-v1";
const keyCache = {};

async function deriveKey(uid){
  if(keyCache[uid]) return keyCache[uid];
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw", enc.encode(uid), "PBKDF2", false, ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(SALT), iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  keyCache[uid] = key;
  return key;
}

export function isEncrypted(value){
  return typeof value === "string" && value.startsWith(PREFIX);
}

export async function encryptText(uid, plain){
  if(plain === null || plain === undefined || plain === "") return plain;
  if(typeof plain !== "string") return plain;
  if(isEncrypted(plain)) return plain; // já cifrado, não cifra de novo
  try{
    const key = await deriveKey(uid);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
    return `${PREFIX}${bufToB64(iv)}.${bufToB64(new Uint8Array(cipherBuf))}`;
  }catch(err){
    console.error("[Haimë crypto] falha ao cifrar, salvando sem cifrar:", err);
    return plain;
  }
}

export async function decryptText(uid, value){
  if(!isEncrypted(value)) return value; // texto antigo/sem cifra: devolve como está
  try{
    const [ivB64, cipherB64] = value.slice(PREFIX.length).split(".");
    const key = await deriveKey(uid);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBuf(ivB64) }, key, b64ToBuf(cipherB64)
    );
    return new TextDecoder().decode(plainBuf);
  }catch(err){
    console.error("[Haimë crypto] falha ao decifrar:", err);
    return "🔒 (não foi possível decifrar)";
  }
}

function bufToB64(buf){
  let binary = "";
  buf.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function b64ToBuf(b64){
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for(let i=0; i<binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}
