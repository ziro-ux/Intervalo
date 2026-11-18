// Intervalo: guarda o app para funcionar offline. Os dados do usuário ficam no aparelho (localStorage e IndexedDB), nunca aqui.
// O nome do cache é trocado a cada publicação pelo GitHub Actions, para o celular baixar a versão nova.
const CACHE = 'intervalo-dev';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './fonts/nunito.ttf', './fonts/lora.ttf', './vendor/zxing.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(hit => {
      const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
});
