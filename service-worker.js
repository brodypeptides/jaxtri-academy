const JAXTRI_CACHE = 'jaxtri-academy-v9';
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/assets/styles.css',
  '/assets/frost-theme.css',
  '/assets/navigation-categories.css',
  '/assets/mobile-app.css',
  '/assets/session.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(JAXTRI_CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => null)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== JAXTRI_CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(response => {
      const copy = response.clone();
      caches.open(JAXTRI_CACHE).then(cache => cache.put(req, copy)).catch(() => {});
      return response;
    }).catch(() => cached))
  );
});
