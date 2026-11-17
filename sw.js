/* HIRV arvostelukortti – © 2026 ICT- ja karttapalvelut Peltonen. Kaikki oikeudet pidätetään. */
const CACHE = 'hirv-v7';
const EXT = 'hirv-ext-v1';     // Leaflet-kirjasto ja karttatiilet
const MAX_TILES = 4000;
const FILES = ['./', './index.html', './rules.js', './geo.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
const LIBS = ['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'];
self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))),
    caches.open(EXT).then(c => c.addAll(LIBS)).catch(() => {})
  ]));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== EXT).map(k => caches.delete(k)))));
  self.clients.claim();
});
const isTile = u => /(^|\.)tile\.(opentopomap|openstreetmap)\.org$/.test(u.hostname);
const isLib = u => u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/leaflet@');
let trimT = 0;
async function trimTiles(){
  if (Date.now() - trimT < 60000) return; trimT = Date.now();
  const c = await caches.open(EXT); const ks = (await c.keys()).filter(r => isTile(new URL(r.url)));
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  // kirjasto ja karttatiilet: välimuisti ensin (toimii maastossa ilman verkkoa jo nähdyillä alueilla)
  if (isTile(u) || isLib(u)) {
    e.respondWith(caches.open(EXT).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') { c.put(e.request, res.clone()); if (isTile(u)) trimTiles(); }
      return res;
    }))));
    return;
  }
  if (u.origin !== location.origin) return;
  // sovellus: verkko ensin, välimuisti kun verkkoa ei ole
  const fromCache = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
  const net = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  });
  const timeout = new Promise((_, rej) => setTimeout(rej, 3000));
  e.respondWith(Promise.race([net, timeout]).catch(() => fromCache().then(r => r || net)));
});
