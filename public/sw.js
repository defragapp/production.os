/*
 * Sovereign OS — privacy-first offline shell.
 *
 * Posture, deliberately:
 *  - /api/* is NEVER read from or written to any cache. API responses carry
 *    session data; caching one would survive logout and token_version
 *    revocation, which this product promises can never happen.
 *  - Authenticated HTML is NEVER cached. Successful navigations always go to
 *    the network; what is stored is the public /offline shell, the static
 *    assets that shell references (CSS/JS/fonts — all public, hash-named,
 *    immutable), and two static brand images. Nothing else.
 *  - The fallback exists for one moment only: a navigation that fails while
 *    the device has no connection, so an installed PWA shows a calm on-brand
 *    page instead of a raw browser error.
 *
 * Zero dependencies. Version bump on every edit forces a fresh precache.
 */
const SHELL_CACHE = "sovereign-offline-shell-v3";
const PRECACHE_URLS = ["/offline", "/brand/icon.png", "/brand/emblem-core.png"];

// The /offline HTML is build-stamped: it points at this build's hashed
// CSS/JS chunks. Those are stored alongside it so the shell renders styled
// when the device truly has no signal — the browser's own HTTP cache
// re-checks with the edge before trusting a stale entry, and that check is
// exactly what cannot run offline.
function shellAssets(html) {
  return [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s]+/g)].map((m) => m[0]))];
}

async function syncShell(cache, html) {
  const assets = shellAssets(html);
  await Promise.allSettled(assets.map((u) => cache.add(u)));
  // Drop chunks from a superseded build so the cache can't accumulate.
  const wanted = new Set(assets);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((req) => {
        const path = new URL(req.url).pathname;
        return path.startsWith("/_next/static/") && !wanted.has(path);
      })
      .map((req) => cache.delete(req)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      try {
        const res = await cache.match("/offline");
        if (res) await syncShell(cache, await res.text());
      } catch {}
    })().then(() => self.skipWaiting()),
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

  // Chunks and brand art the shell precached: served cache-first, because
  // these are exactly the URLs stored above — hash-named (immutable) or
  // brand images refreshed at install. Without this branch the requests
  // pass through to the (absent) network and the offline shell renders
  // unstyled. Anything not stored goes straight to the network.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }

  // The shell itself: network-first while online, cache only as the offline
  // fallback. Cache-first here once served a previous build's /offline HTML
  // (stale chunk/CSS hashes → unstyled page, dead Retry button) to visitors
  // who were plainly online. A successful online visit also re-syncs the
  // stored shell and its assets, so the next offline moment opens on the
  // current build.
  if (url.pathname === "/offline") {
    event.respondWith(
      fetch(request)
        .then(async (res) => {
          if (res.ok) {
            const html = await res.clone().text();
            event.waitUntil(
              caches
                .open(SHELL_CACHE)
                .then((cache) =>
                  cache
                    .put(request, new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }))
                    .then(() => syncShell(cache, html)),
                )
                .catch(() => {}),
            );
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
