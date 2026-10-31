// Service worker minimal : rend le site installable (Android) et affiche
// la dernière version de la page d'accueil si le réseau est coupé au bord du lac.
// Toujours le réseau d'abord : le site reste à jour.
const CACHE = 'alr-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.mode !== 'navigate' || r.method !== 'GET') return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok && new URL(r.url).pathname === '/') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('/', copy));
      }
      return res;
    }).catch(() => caches.open(CACHE).then(c => c.match('/')).then(m => m || Response.error()))
  );
});
