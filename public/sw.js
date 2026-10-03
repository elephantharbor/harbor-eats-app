/* FlavorWeave — conservative SW: network-first, versioned, freshness over cache */
const CACHE_VERSION = "fw-sw-v14";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/theme.js",
  "/meal-media.js",
  "/meal-identity.js",
  "/nav-context.js",
  "/taste-ui.js",
  "/app.js",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/brand/flavorweave-emblem.svg",
  "/brand/flavorweave-wordmark.svg",
  "/brand/flavorweave-lockup-horizontal.svg",
  "/brand/flavorweave-lockup-horizontal-reversed.svg",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match("/index.html")))
  );
});
