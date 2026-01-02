const CACHE_VERSION = 'v3';
const CACHE_NAME = 'fintekpro-' + CACHE_VERSION;
const STATIC_CACHE_NAME = 'fintekpro-static-' + CACHE_VERSION;
const DYNAMIC_CACHE_NAME = 'fintekpro-dynamic-' + CACHE_VERSION;

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
];

const NEVER_CACHE_EXTENSIONS = [
  '.tsx',
  '.ts',
  '.jsx',
  '.vue',
  '.svelte',
];

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing ' + CACHE_VERSION + '...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting to activate immediately');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating ' + CACHE_VERSION + '...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            if (name === STATIC_CACHE_NAME || name === DYNAMIC_CACHE_NAME) {
              return false;
            }
            return true;
          })
          .map((name) => {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (shouldNeverCache(url.pathname) || shouldNeverCache(url.href)) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (shouldCacheApi(url.pathname)) {
      event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE_NAME, 60000));
    }
    return;
  }

  if (url.pathname.match(/\.(js|mjs)$/) && !url.pathname.includes('/src/')) {
    event.respondWith(networkFirstWithCache(request, STATIC_CACHE_NAME, 5000));
  } else if (url.pathname.match(/\.(css|woff2?|ttf|eot|png|jpg|jpeg|gif|ico|webp)$/)) {
    event.respondWith(cacheFirstWithNetwork(request));
  }
});

async function networkFirstWithCache(request, cacheName, timeout = 30000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
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
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});
