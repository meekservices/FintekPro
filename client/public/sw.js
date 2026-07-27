const CACHE_NAME = 'fintekpro-agent-v3'; // bumped 2026-07-27: fix SW message handler (SKIP_WAITING/CLEAR_CACHE)

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  // Do NOT call skipWaiting() here — that would immediately activate the new SW,
  // trigger clients.claim(), fire a controllerchange in every open tab, and cause
  // an automatic page reload for all users mid-session.
  // Instead, the new SW enters the 'waiting' state, the UpdateNotificationBanner
  // appears, and skipWaiting is called only when the user clicks "Refresh Now".
});

self.addEventListener('message', (event) => {
  // Legacy: plain string from old clients
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }

  // Object format from useVersionCheck.ts → { type: "SKIP_WAITING" | "CLEAR_CACHE" }
  if (event.data && typeof event.data === 'object') {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
      return;
    }

    if (event.data.type === 'CLEAR_CACHE') {
      // Delete all caches so stale JS bundles are purged on force-update
      event.waitUntil(
        caches.keys().then((keys) =>
          Promise.all(keys.map((key) => caches.delete(key)))
        ).then(() => {
          console.log('[SW] All caches cleared on force-update request');
        })
      );
      return;
    }
  }
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
