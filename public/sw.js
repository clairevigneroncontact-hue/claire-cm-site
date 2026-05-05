const CACHE = 'claire-cm-v5';
const STATIC = [
  '/favicon.svg',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Mise en cache des assets statiques uniquement
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

// Nettoyer les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch : cache-first UNIQUEMENT pour les assets statiques listés
// Tout le reste (pages HTML, scripts CDN, API…) → réseau direct, jamais mis en cache
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (STATIC.includes(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
  // Rien d'autre — browser gère normalement
});
