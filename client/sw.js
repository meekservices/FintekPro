const CACHE_NAME = 'fintekpro-agent-v4'; // bumped 2026-07-28: skipWaiting on install + MessageChannel port response fix

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing — skipping waiting immediately');
  // Skip waiting immediately so there is never a 'waiting' SW.
  // This eliminates the race where the active (old) SW receives postMessage
  // types it doesn't recognise, causing Chrome's "message channel closed"
  // UnhandledPromiseRejection in the page context.
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  // ALWAYS respond on the MessageChannel port if one was provided.
  // Chrome sends internal SW lifecycle messages using MessageChannel and expects
  // a response (even if empty). Not responding causes:
  //   "A listener indicated an asynchronous response by returning true,
  //    but the message channel closed before a response was received"
  // We respond synchronously here so the channel is never left dangling.
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
        })
      );
      return;
    }
  }

  // Unknown message — respond with ok so Chrome doesn't hold the channel open
  respond();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
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
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return;
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});
