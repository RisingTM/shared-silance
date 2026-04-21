const STATIC_CACHE = "shared-silance-static-v1";
const DATA_CACHE = "shared-silance-data-v1";
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const isSupabase = request.url.includes("supabase.co");
  if (isSupabase) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        return res;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Shared Silance", body: "You haven't written today yet." };
  event.waitUntil(self.registration.showNotification(data.title || "Shared Silance", { body: data.body || "" }));
});

