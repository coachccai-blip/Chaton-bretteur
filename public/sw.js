// Service worker minimal : rend le jeu installable (PWA) et jouable hors-ligne.
// Stratégie « réseau d'abord » : contenu toujours frais en ligne, repli sur le
// cache hors-ligne. Aucune liste d'assets à maintenir (les noms sont hachés).
const CACHE = 'chaton-bretteur-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.ok && new URL(req.url).origin === self.location.origin) {
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      const cached = await cache.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const index = await cache.match('./') || await cache.match('index.html');
        if (index) return index;
      }
      throw new Error('hors-ligne et non mis en cache');
    }
  })());
});
