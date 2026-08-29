/* CME Digital — cache do casco para uso offline. */
var CACHE = 'cme-v5';
var ARQUIVOS = ['./', './index.html', './style.css', './db.js', './core.js', './motor.js', './seed.js',
  './mod-hoje.js', './mod-cargas.js', './mod-equipamentos.js', './mod-pps.js', './mod-ifu.js',
  './mod-apoio.js', './mod-checklist.js', './vendor/qrcode.js', './manifest.json', './icone.svg', './icone-180.png', './icone-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); })
    .then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request).catch(function () { return caches.match('./index.html'); });
  }));
});
