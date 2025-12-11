/* TidyZou - Service Worker
   Mode OFFLINE FULL - App Shell / Cache-first
   
*/
const STATIC_CACHE = `TidyZou-static`;

// 🔧 À adapter si tu changes les versions de tes assets (v=3.6, v=3.7, etc.)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './about.html',
  './install.html',
  './purge.html',

  // CSS / JS avec les bons query params
  './style.css',
  './index.js',

  // PWA
  './manifest.json',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* 🧩 INSTALL : pré-cache de l’app shell */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_ASSETS);
      console.log(`[SW] ${SW_VERSION} installé (app shell précaché).`);
    } catch (e) {
      console.warn('[SW] Erreur pendant le pré-cache :', e);
    }
  })());

  // On prend la main direct
  self.skipWaiting();
});

/* 🧹 ACTIVATE : clean des anciens caches + claim immédiat */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('TidyZou-static-') && k !== STATIC_CACHE)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
	console.log('[SW] Activé, anciens caches TidyZou-static-* supprimés.');  })());
});

/* 🚀 FETCH : offline full / app shell cache-first
   - Toutes les navigations HTML (index, about, install, etc.) → cache-first
   - Tous les assets same-origin (CSS, JS, icônes...) → cache-first
   - Externes (CDN, images HTTP...) → laissés au réseau (pas de magie offline)
*/
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On touche uniquement aux GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const accept = req.headers.get('accept') || '';
  const isHTML =
    req.mode === 'navigate' ||
    accept.includes('text/html');

  // HTML same-origin → app shell cache-first
  if (isSameOrigin && isHTML) {
    event.respondWith(cacheFirst(req, { fallbackToIndex: true }));
    return;
  }

  // Static same-origin → cache-first
  if (isSameOrigin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Pour le reste (externes), on ne force rien
});

/* 💾 cacheFirst : priorise le cache, tente une MAJ en arrière-plan */
async function cacheFirst(req, options = {}) {
  const { fallbackToIndex = false } = options;
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);

  if (cached) {
    // Stale-while-revalidate light
    refreshInBackground(req, cache);
    return cached;
  }

  // Pas en cache → on tente le réseau
  try {
    const network = await fetch(req);
    if (network && network.ok) {
      cache.put(req, network.clone());
    }
    return network;
  } catch (err) {
    console.warn('[SW] Erreur réseau sur', req.url, err);

    if (fallbackToIndex) {
      const fallback =
        (await cache.match('./index.html')) ||
        (await cache.match('/index.html'));
      if (fallback) return fallback;
      return new Response('⚠️ Hors ligne', { status: 503 });
    }

    // Pas de fallback spécifique → on laisse l’erreur remonter
    return new Response('⚠️ Ressource indisponible hors ligne', {
      status: 503
    });
  }
}

/* 🔁 MAJ silencieuse en arrière-plan (stale-while-revalidate) */
async function refreshInBackground(req, cache) {
  try {
    const network = await fetch(req, { cache: 'no-store' });
    if (network && network.ok) {
      await cache.put(req, network.clone());
    }
  } catch (e) {
    // On ignore, pas bloquant pour l’UX
  }
}

/* 🔄 Gestion du skipWaiting via message (pour ton bandeau "maj dispo") */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
