/*
 * Sovereign OS — privacy-first offline shell.
 *
 * Posture, deliberately:
 *  - /api/* is NEVER read from or written to any cache. API responses carry
 *    session data; caching one would survive logout and token_version
 *    revocation, which this product promises can never happen.
 *  - Authenticated HTML is NEVER cached. Successful navigations always go to
 *    the network; the only stored page is the public /offline shell plus two
 *    static brand images.
 *  - The fallback exists for one moment only: a navigation that fails while
 *    the device has no connection, so an installed PWA shows a calm on-brand
 *    page instead of a raw browser error.
 *
 * Zero dependencies. Version bump on every edit forces a fresh precache.
 */
const SHELL_CACHE = "sovereign-offline-shell-v2";
const PRECACHE_URLS = ["/offline", "/brand/icon.png", "/brand/emblem-core.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Pass-through rules first: anything that isn't a same-origin GET page
  // navigation is the browser's problem, never the cache's.
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // The shell itself: network-first while online, cache only as the offline
  // fallback. Cache-first here once served a previous build's /offline HTML
  // (stale chunk/CSS hashes → unstyled page, dead Retry button) to visitors
  // who were plainly online. A fresh precache still exists for the moment
  // the network is actually unreachable.
  if (url.pathname === "/offline") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Only document navigations get the fallback treatment. Successful
  // responses are returned untouched and are never stored.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match("/offline").then((shell) => shell || Response.error()),
    ),
  );
});
