/* YMS Yard Twin — offline asset cache.
 *
 * Strategy:
 *   • App shell (HTML/JS/CSS chunks)  → stale-while-revalidate
 *   • Static yard data (DXF JSON, slot-geofence) → cache-first, revalidate in background
 *   • API responses                    → network-only (bypass cache)
 *   • Images, fonts, GLB               → cache-first with long TTL
 *
 * Bump CACHE_VERSION whenever the deploy needs to invalidate everything.
 */
const CACHE_VERSION = "yms-yard-twin-v1";
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const ASSET_CACHE   = `${CACHE_VERSION}-assets`;

const STATIC_PATTERNS = [
  /\/yard-layout\.json$/,
  /\/slot-geofence\.json$/,
  /\/layers\.json$/,
  /\/block-zones\.json$/,
  /\/texts\.json$/,
];
const ASSET_PATTERNS = [
  /\.(?:png|jpg|jpeg|gif|svg|webp|woff2?|ttf|otf|glb|gltf|hdr|mp3|ogg)(?:\?.*)?$/i,
];
const SHELL_PATTERNS = [
  /\/$/,
  /\/index\.html$/,
  /\/assets\/.+\.(?:js|css)$/,
];
// Heuristics for "do NOT cache" — API endpoints
const NEVER_CACHE = [
  /\/api\//,
  /\/auth\//,
  /\/login/,
  /\/socket\.io\//,
  /\/(?:graphql|rpc)\b/,
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL_CACHE));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => !k.startsWith(CACHE_VERSION))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function matchesAny(url, patterns) {
  return patterns.some(re => re.test(url.pathname) || re.test(url.href));
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkFetch = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || networkFetch;
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    // Refresh asynchronously
    fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
    return cached;
  }
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  // Bypass cross-origin API hosts and never-cache routes
  if (matchesAny(url, NEVER_CACHE)) return;

  if (matchesAny(url, ASSET_PATTERNS)) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }
  if (matchesAny(url, STATIC_PATTERNS)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
  if (matchesAny(url, SHELL_PATTERNS) || req.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }
  // Default: pass-through
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
