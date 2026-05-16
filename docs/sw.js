const CACHE = 'frontend-v13';
const ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './styles.css?v=13',
  './config.js?v=13',
  './gas-client.js?v=13',
  './app.js?v=13',
];

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'skipWaiting') {
    self.skipWaiting();
  }
});

function isDocumentOrStyle(req) {
  var p = new URL(req.url).pathname;
  return /\/(index\.html)?$/.test(p) || /styles\.css/.test(p);
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        return cache.addAll(ASSETS).catch(function () {});
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
      .catch(function () {})
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (isDocumentOrStyle(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
          return res;
        })
        .catch(function () { return caches.match(e.request); })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
        return res;
      });
    })
  );
});
