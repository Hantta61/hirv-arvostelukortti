const CACHE = 'hirv-v3';
const FILES = ['./', './index.html', './rules.js', './geo.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Verkko ensin (päivitykset tulevat heti), välimuisti kun verkkoa ei ole
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const fromCache = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
  const net = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  });
  // heikolla yhteydellä (maastossa) ei odoteta yli 3 s
  const timeout = new Promise((_, rej) => setTimeout(rej, 3000));
  e.respondWith(Promise.race([net, timeout]).catch(() => fromCache().then(r => r || net)));
});
