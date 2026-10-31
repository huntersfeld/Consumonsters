// Offline support: cache the app shell, serve it cache-first, and refresh it in the background.
// Bump VERSION whenever a shipped file changes so phones pick up the new build.
const VERSION = 'consumonsters-v14';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/engine.js', 'src/personality.js', 'src/bond.js', 'src/hats.js', 'src/rewards.js', 'src/places.js', 'src/pasture-scene.js', 'src/places/meadow.js', 'src/places/lagoon.js', 'src/places/cliffs.js', 'src/pasture.js', 'src/app.js', 'vendor/zxing-library-0.21.3.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, {ignoreSearch: true});
    const net = fetch(req).then(res => {
      if(res.ok && (res.type === 'basic' || res.type === 'cors')) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
