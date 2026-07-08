const CACHE_NAME = 'jaxtri-academy-pwa-v9-1';
const NAV_FALLBACK = '/login.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([
        '/',
        '/login.html',
        '/notifications.html',
        '/manifest.json',
        '/assets/styles.css',
        '/assets/frost-theme.css',
        '/assets/mobile-app.css',
        '/assets/pwa-install.css',
        '/assets/pwa-install.js',
      ]).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match(NAV_FALLBACK)))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => null);
        return response;
      }).catch(() => cached))
    );
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      data = { body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'Jaxtri Academy';
    const body = data.body || 'You have a new alert. Tap to review.';
    const url = data.url || '/notifications.html';

    await self.registration.showNotification(title, {
      body,
      icon: data.icon || '/assets/icon-192.png',
      badge: data.badge || '/assets/icon-192.png',
      tag: data.tag || 'jaxtri-alert',
      renotify: true,
      data: { url },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/notifications.html', self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client && client.url.startsWith(self.location.origin)) {
        await client.navigate(url);
        return client.focus();
      }
    }
    return clients.openWindow(url);
  })());
});
