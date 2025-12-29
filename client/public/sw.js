const CACHE_NAME = 'fintekpro-v1';
const STATIC_CACHE_NAME = 'fintekpro-static-v1';
const DYNAMIC_CACHE_NAME = 'fintekpro-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
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

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('fintekpro-') && 
                          name !== STATIC_CACHE_NAME && 
                          name !== DYNAMIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

function shouldNeverCache(url) {
  return NEVER_CACHE_ROUTES.some(route => url.includes(route));
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

  if (shouldNeverCache(url.pathname)) {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (shouldCacheApi(url.pathname)) {
      event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE_NAME, 60000));
    }
    return;
  }

  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      url.pathname.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$/)) {
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
      console.log('[ServiceWorker] Serving from cache:', request.url);
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
    console.error('[ServiceWorker] Network request failed:', request.url);
    
    if (request.destination === 'document') {
      const cachedIndex = await caches.match('/');
      if (cachedIndex) {
        return cachedIndex;
      }
    }
    
    throw error;
  }
}

self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync event:', event.tag);
  
  if (event.tag === 'sync-drafts') {
    event.waitUntil(syncDrafts());
  } else if (event.tag === 'sync-actions') {
    event.waitUntil(syncActions());
  }
});

async function syncDrafts() {
  console.log('[ServiceWorker] Syncing drafts...');
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_DRAFTS' });
  });
}

async function syncActions() {
  console.log('[ServiceWorker] Syncing actions...');
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_ACTIONS' });
  });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});
