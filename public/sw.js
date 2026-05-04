// Service worker minimal — PWA installable sans casser le chargement des scripts
const CACHE = 'claire-cm-v2';
const STATIC = ['/favicon.svg', '/favicon.ico', '/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Uniquement les assets statiques en cache — tout le reste passe en réseau normal
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Ne touche qu'aux fichiers statiques locaux listés ci-dessus
  if (STATIC.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
  // Tout le reste (pages, APIs, scripts CDN…) → réseau normal sans interception
});
