const SW_URL = new URL(self.location.href);
const VERSION = SW_URL.searchParams.get('v') || '10';
const BUILD_TIMESTAMP = VERSION;
const CACHE_PREFIX = 'fintekpro';
const STATIC_CACHE_NAME = `${CACHE_PREFIX}-static-v${VERSION}`;
const DYNAMIC_CACHE_NAME = `${CACHE_PREFIX}-dynamic-v${VERSION}`;
const EXPECTED_CACHES = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

const CACHED_API_ROUTES = [
  '/api/platform/stats',
  '/api/market/movers',
  '/api/bonds/yield-curve/public',
  '/api/market/news',
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

const NEVER_CACHE_EXTENSIONS = [
  '.tsx',
  '.ts',
  '.jsx',
  '.vue',
  '.svelte',
];

self.addEventListener('install', (event) => {
  console.log(`[ServiceWorker] Installing v${VERSION} (build: ${BUILD_TIMESTAMP})...`);
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME)
        .then((cache) => {
          console.log('[ServiceWorker] Caching static assets');
          return cache.addAll(STATIC_ASSETS);
        }),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX) && !EXPECTED_CACHES.includes(name))
            .map((name) => {
              console.log('[ServiceWorker] Pre-deleting old cache during install:', name);
              return caches.delete(name);
            })
        );
      })
    ]).then(() => {
      console.log('[ServiceWorker] Skip waiting to activate immediately');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log(`[ServiceWorker] Activating v${VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            if (EXPECTED_CACHES.includes(name)) {
              return false;
            }
            if (name.startsWith(CACHE_PREFIX)) {
              return true;
            }
            if (name.startsWith('fintekpro-')) {
              return true;
            }
            return false;
          })
          .map((name) => {
            console.log('[ServiceWorker] Deleting stale cache:', name);
            return caches.delete(name);
          })
      );
    }).then(async () => {
      const cache = await caches.open(STATIC_CACHE_NAME);
      const keys = await cache.keys();
      await Promise.all(
        keys
          .filter((req) => req.url.match(/\.(js|mjs)$/))
          .map((req) => {
            console.log('[ServiceWorker] Clearing cached JS on activate:', req.url);
            return cache.delete(req);
          })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming all clients');
      return self.clients.claim();
    })
  );
});

function shouldNeverCache(url) {
  if (NEVER_CACHE_ROUTES.some(route => url.includes(route))) {
    return true;
  }
  if (NEVER_CACHE_EXTENSIONS.some(ext => url.endsWith(ext))) {
    return true;
  }
  if (url.includes('/src/') || url.includes('/@') || url.includes('node_modules')) {
    return true;
  }
  return false;
}

function shouldCacheApi(url) {
  return CACHED_API_ROUTES.some(route => url.includes(route));
}

function isViteHashedAsset(pathname) {
  return pathname.includes('/assets/') && pathname.match(/\.(js|mjs)$/);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith('http')) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  if (shouldNeverCache(url.pathname) || shouldNeverCache(url.href)) {
    return;
  }

  if (url.pathname.match(/\.(js|mjs)$/) && !url.pathname.includes('/src/')) {
    if (isViteHashedAsset(url.pathname)) {
      event.respondWith(networkOnly(request));
    } else {
      event.respondWith(networkFirstWithCache(request, STATIC_CACHE_NAME, 5000));
    }
  } else if (url.pathname.match(/\.(css|woff2?|ttf|eot|png|jpg|jpeg|gif|ico|webp)$/)) {
    event.respondWith(cacheFirstWithNetwork(request));
  }
});

async function networkOnly(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network-only fetch failed (Vite hashed asset):', request.url);
    throw error;
  }
}

async function networkFirstWithCache(request, cacheName, timeout = 30000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    } else if (networkResponse.status === 404) {
      const cache = await caches.open(cacheName);
      await cache.delete(request);
      console.log('[ServiceWorker] Got 404, cleared cache entry:', request.url);
      return networkResponse;
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[ServiceWorker] Network failed, serving from cache:', request.url);
      return cachedResponse;
    }
    throw error;
  }
}

async function cacheFirstWithNetwork(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Failed to fetch:', request.url);
    throw error;
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  
  if (data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  
  if (data === 'clearCache') {
    caches.keys().then((names) => {
      Promise.all(names.map((name) => caches.delete(name)));
    });
    return;
  }
  
  if (data === 'getVersion') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: VERSION, build: BUILD_TIMESTAMP });
    }
    return;
  }
  
});
