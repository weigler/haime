// Service worker simples: cacheia o "shell" do app para abrir offline.
// Os dados (hábitos/marcações) sempre vêm do Firestore quando há internet;
// o cache aqui é só para a interface abrir rápido / funcionar sem rede.

const CACHE = "haime-v1";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/habits.js",
  "./js/calendar.js",
  "./js/firebase-config.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // network-first para chamadas ao Firebase; cache-first para o shell estático
  const url = event.request.url;
  if(url.includes("firestore") || url.includes("googleapis") || url.includes("identitytoolkit")){
    return; // deixa passar direto para a rede
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
