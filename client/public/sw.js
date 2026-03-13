const SW_URL = new URL(self.location.href);
const VERSION = SW_URL.searchParams.get('v') || '10';
const CACHE_PREFIX = 'fintekpro';
const SHELL_CACHE = `${CACHE_PREFIX}-shell-v${VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}-static-v${VERSION}`;
const EXPECTED_CACHES = [SHELL_CACHE, STATIC_CACHE];

const SHELL_ASSETS = [
  '/',
];

const NEVER_CACHE_ROUTES = [
  '/api/auth',
  '/api/login',
  '/api/logout',
  '/api/orders',
  '/api/trade',
  '/api/execute',
  '/api/payment',
  '/api/consent',
  '/api/submit',
  '/api/transactions',
  '/api/mca',
  '/api/wallet',
  '/api/admin',
];

self.addEventListener('install', (event) => {
  console.log(`[ServiceWorker] Installing v${VERSION}...`);
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => {
        console.log('[ServiceWorker] Shell cached, skipping wait');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log(`[ServiceWorker] Activating v${VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && !EXPECTED_CACHES.includes(name))
          .map((name) => {
            console.log('[ServiceWorker] Deleting stale cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

function isNeverCache(url) {
  return NEVER_CACHE_ROUTES.some(route => url.includes(route));
}

function isViteHashedAsset(pathname) {
  return pathname.startsWith('/assets/') && /\.(js|mjs|css)$/.test(pathname);
}

function isStaticMedia(pathname) {
  return /\.(png|jpg|jpeg|gif|ico|webp|woff2?|ttf|eot|svg)$/.test(pathname);
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith('http')) return;
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (isNeverCache(url.pathname)) return;
  if (url.pathname.includes('/src/') || url.pathname.includes('/@') || url.pathname.includes('node_modules')) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        try {
          const networkResp = await fetch(request);
          if (networkResp.ok) cache.put(request, networkResp.clone());
          return networkResp;
        } catch {
          const cached = await cache.match('/');
          return cached || fetch(request);
        }
      })
    );
    return;
  }

  if (isViteHashedAsset(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const networkResp = await fetch(request);
        if (networkResp.ok) cache.put(request, networkResp.clone());
        return networkResp;
      })
    );
    return;
  }

  if (isStaticMedia(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const networkResp = await fetch(request);
          if (networkResp.ok) cache.put(request, networkResp.clone());
          return networkResp;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (data === 'clearCache') {
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))));
    return;
  }
  if (data === 'getVersion' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION });
    return;
  }
  if (data && data.type === 'SYNC_DRAFTS') {
    self.clients.matchAll().then(clients =>
      clients.forEach(c => c.postMessage({ type: 'SYNC_DRAFTS' }))
    );
    return;
  }
  if (data && data.type === 'SYNC_ACTIONS') {
    self.clients.matchAll().then(clients =>
      clients.forEach(c => c.postMessage({ type: 'SYNC_ACTIONS' }))
    );
    return;
  }
});
