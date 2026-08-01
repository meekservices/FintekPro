const CACHE_NAME = 'fintekpro-agent-v5'; // bumped 2026-08-01: add fetch handler + navigation preload support

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing — skip waiting immediately');
  // Skip waiting so there is never a stale SW sitting in "waiting" state.
  // This eliminates the race where the active SW receives postMessage
  // types it does not recognise, causing Chrome's "message channel closed" error.
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated — claiming all clients');
  event.waitUntil(
    Promise.all([
      // Claim all open tabs immediately
      clients.claim(),
      // Enable navigation preload so navigation requests don't block on the SW
      // This is the primary fix for "message channel closed" on navigation events
      self.registration.navigationPreload?.enable?.().catch(() => {}),
      // Delete old cache versions
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
// IMPORTANT: A Service Worker MUST have a fetch handler when navigation preload
// is enabled, otherwise Chrome internally queues a navigation preload response
// and when it gets no reply from the SW, logs:
//   "A listener indicated an asynchronous response by returning true,
//    but the message channel closed before a response was received"
//
// Strategy:
//  - API calls (/api/*): always network-only, never cached
//  - Navigation requests: network-first using preload response when available
//  - Everything else: network-only (no caching for authenticated app)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) {
    return; // Let the browser handle it natively (no event.respondWith)
  }

  // Navigation requests (page loads) — use preload response if available,
  // fall back to network fetch. This ensures the channel is always resolved.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Use preload response if available (avoids extra network round-trip)
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) return preloadResponse;
          // Otherwise fetch from network
          return await fetch(event.request);
        } catch {
          // Offline fallback — return a minimal offline page
          return new Response(
            '<!DOCTYPE html><html><body><h1>FintekPro</h1><p>You appear to be offline. Please check your connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })()
    );
    return;
  }

  // All other requests (JS/CSS/images): network-only, no caching
  // The app uses hashed filenames so Firebase Hosting CDN handles caching
});

// ── Message ───────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  // ALWAYS respond on the MessageChannel port if one was provided.
  // Chrome sends internal SW lifecycle messages using MessageChannel and expects
  // a response (even if empty). Not responding causes:
  //   "A listener indicated an asynchronous response by returning true,
  //    but the message channel closed before a response was received"
  const respond = (payload = { ok: true }) => {
    if (event.ports?.[0]) {
      event.ports[0].postMessage(payload);
    }
  };

  // Legacy: plain string from old clients
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    respond();
    return;
  }

  // Object format from useVersionCheck.ts → { type: "SKIP_WAITING" | "CLEAR_CACHE" }
  if (event.data && typeof event.data === 'object') {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
      respond();
      return;
    }

    if (event.data.type === 'CLEAR_CACHE') {
      // Delete all caches so stale JS bundles are purged on force-update
      event.waitUntil(
        caches.keys().then((keys) =>
          Promise.all(keys.map((key) => caches.delete(key)))
        ).then(() => {
          console.log('[SW] All caches cleared on force-update request');
          respond();
        }).catch(() => respond())
      );
      return;
    }
  }

  // Unknown message — respond with ok so Chrome never holds the channel open
  respond();
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: 'FintekPro Agent',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'default',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || payload.message || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || payload.type || data.tag,
        data: {
          url: payload.url || payload.link || '/',
          notificationId: payload.id,
          type: payload.type
        }
      };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  // Always wrap in waitUntil so the push event is never dropped
  event.waitUntil(
    self.registration.showNotification(data.title, options).catch((e) => {
      console.error('[SW] showNotification failed:', e);
    })
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') client.navigate(urlToOpen);
            return;
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});

self.addEventListener('notificationclose', () => {
  // No-op: Chrome requires this listener to be registered in some environments
});
