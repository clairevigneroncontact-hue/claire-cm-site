const CACHE = 'claire-cm-v1';
const SHELL = [
  '/',
  '/espace-client',
  '/espace-client/dashboard',
  '/favicon.svg',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Installation : mise en cache du shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch : network-first pour les pages, cache-first pour les assets statiques
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ignorer les requêtes non-GET et les APIs externes (Supabase, Resend…)
  if (e.request.method !== 'GET') return;
  if (!url.origin.includes(self.location.hostname)) return;
  if (url.pathname.startsWith('/api/')) return;

  // Assets statiques (images, fonts, icônes) → cache-first
  if (/\.(png|svg|ico|woff2?|jpg|jpeg|webp|gif)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Pages → network-first, fallback cache
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
