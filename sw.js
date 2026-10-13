// Простой офлайн-кэш: пригождается только при открытии игры по https или на localhost
// (на file:// Service Worker не регистрируется, но там и так всё локально).
const CACHE = "smeshariki-v1";
const CORE = [
  "./", "./index.html", "./game.js", "./config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((resp) => {
        if (resp && resp.ok) caches.open(CACHE).then((c) => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
