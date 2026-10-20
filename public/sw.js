// Wiridku service worker. Bump VERSION when the caching rules below change.
const VERSION = "wiridku-v7";
const PRECACHE = ["/", "/wirid-salat", "/kalender", "/jadwal-salat", "/tasbih", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // ponytail: only old app-shell caches; "wiridku-audio" holds the visitor's saved recordings and must survive updates
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("wiridku-v") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (path) =>
  path.startsWith("/_next/static/") || /^\/(icon-|apple-touch-icon|favicon|logo)[^/]*\.png$/.test(path) || path === "/manifest.webmanifest";

const put = (req, res) => {
  if (res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(VERSION).then((cache) => cache.put(req, copy));
  }
  return res;
};

// ponytail: assets of the very first visit load before this worker controls the page, so the page hands their URLs over
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-assets" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((u) => {
    try {
      const url = new URL(u);
      return url.origin === self.location.origin && isStatic(url.pathname);
    } catch {
      return false;
    }
  });
  event.waitUntil(caches.open(VERSION).then((cache) => Promise.all(urls.map((u) => cache.add(u).catch(() => {})))));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // admin, auth and RSC payloads are per-user or per-navigation; never serve them from cache
  if (url.pathname.startsWith("/putrazea") || url.pathname.startsWith("/auth") || url.searchParams.has("_rsc") || req.headers.get("RSC")) return;

  if (req.mode === "navigate") {
    // network-first so published edits show up as soon as the visitor is online
    // ponytail: no-cache because Next sends stale-while-revalidate and Chrome would otherwise show the previous version once
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => put(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  if (isStatic(url.pathname)) {
    // hashed build assets never change under the same URL, so cache-first is safe
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
  }
});
