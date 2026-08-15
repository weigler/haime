// Service worker: guarda uma cópia do "shell" do app para funcionar
// offline, mas SEMPRE tenta a rede primeiro para arquivos do próprio
// site (html/css/js) — só cai pro cache se estiver sem internet. Isso
// evita ficar preso numa versão antiga depois de uma atualização.
// Chamadas ao Firebase e a CDNs externas passam direto, sem cache.

const CACHE = "haime-v20";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/toast.js",
  "./js/crypto-fields.js",
  "./js/settings.js",
  "./js/panel-router.js",
  "./js/interactions.js",
  "./js/overview.js",
  "./js/tasks.js",
  "./js/today.js",
  "./js/timer.js",
  "./js/goals.js",
  "./js/habits.js",
  "./js/mobile-nav.js",
  "./js/backup.js",
  "./js/pdfexport.js",
  "./js/data-tools.js",
  "./js/profile.js",
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
  const url = event.request.url;
  const isExternal = url.includes("firestore") || url.includes("googleapis")
    || url.includes("identitytoolkit") || url.includes("cdnjs.cloudflare.com")
    || url.includes("gstatic.com") || url.includes("fonts.googleapis.com");
  if(isExternal) return; // deixa passar direto para a rede, sem cache

  // network-first: tenta buscar a versão mais nova; se não tiver rede,
  // usa a última cópia salva. Atualiza o cache a cada busca bem-sucedida.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
