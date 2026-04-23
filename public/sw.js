// Service worker — minimal & safe.
// - Versioned caches with cleanup on activate
// - Skip non-GET requests entirely
// - Skip authed Supabase calls (don't cache user data)
// - Static assets: cache-first
// - Other GETs: network-first, cache fallback

const STATIC_CACHE = "shared-silance-static-v3";
const RUNTIME_CACHE = "shared-silance-runtime-v3";
const ALLOWED_CACHES = new Set([STATIC_CACHE, RUNTIME_CACHE]);

const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !ALLOWED_CACHES.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. Never touch non-GET (POST/PUT/DELETE can't be cached anyway).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 2. Skip authenticated Supabase calls and any request with Authorization.
  if (url.hostname.endsWith("supabase.co")) return;
  if (request.headers.get("Authorization")) return;

  // 3. Static assets: cache-first
  if (isStaticAsset(url) && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone)).catch(() => undefined);
          return res;
        });
      }),
    );
    return;
  }

  // 4. Other GETs: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(request).then((c) => c || Response.error())),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Our Journey", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data = { title: "Our Journey", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Our Journey", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/today" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        if ("focus" in client) {
          client.navigate?.(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
