// Hand-written rather than pulled in via next-pwa or similar — this app
// doesn't otherwise reach for build-plugin dependencies (see the vanilla
// approach elsewhere in the codebase), and the caching need here is
// narrow enough not to justify one: cache static assets so the shell
// loads offline, and cache visited pages so a teacher who already
// opened a lesson's attendance page can reopen it offline. A brand-new,
// never-visited page genuinely can't load with no connection — that's
// an inherent limit of this approach, not a bug to fix here.

const CACHE_NAME = "school-app-shell-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache mutating requests

  const url = new URL(request.url);

  // Static build assets: cache-first, they're content-hashed by Next.js
  // so a cached copy is never stale.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Page navigations: network-first, falling back to whatever was last
  // cached for this exact URL, then to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          return cached ?? cache.match(OFFLINE_URL);
        }
      })()
    );
  }
});
