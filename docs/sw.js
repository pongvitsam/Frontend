/* PWA service worker — caches app shell for fast repeat visits on iOS/Android. */
var VERSION = '36';
var SHELL_CACHE = 'pk2-shell-v' + VERSION;
var RUNTIME_CACHE = 'pk2-runtime-v' + VERSION;

var CDN_HOSTS = {
  'cdnjs.cloudflare.com': 1,
  'cdn.jsdelivr.net': 1,
  'fonts.googleapis.com': 1,
  'fonts.gstatic.com': 1,
};

function scopeUrl(rel) {
  return new URL(rel, self.registration.scope).toString();
}

function precacheList() {
  return [
    './',
    './index.html',
    './styles.css?v=' + VERSION,
    './config.js?v=' + VERSION,
    './gas-client.js?v=' + VERSION,
    './app.js?v=' + VERSION,
    './favicon.svg',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
  ].map(scopeUrl);
}

function isBypassHost(hostname) {
  if (hostname === 'script.google.com') return true;
  if (hostname === 'accounts.google.com') return true;
  if (hostname.indexOf('googleusercontent.com') !== -1) return true;
  if (hostname.indexOf('googleapis.com') !== -1 && hostname !== 'fonts.googleapis.com') return true;
  if (hostname.indexOf('gstatic.com') !== -1 && hostname !== 'fonts.gstatic.com') return true;
  if (hostname.indexOf('drive.google.com') !== -1) return true;
  return false;
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) {
        return cache.addAll(precacheList());
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
          return undefined;
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function fromCache(request) {
  return caches.match(request).then(function (cached) {
    return cached || caches.match(scopeUrl('./index.html'));
  });
}

function putRuntime(request, response) {
  if (!response || !response.ok) return response;
  var copy = response.clone();
  caches.open(RUNTIME_CACHE).then(function (cache) {
    cache.put(request, copy);
  }).catch(function () {});
  return response;
}

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(SHELL_CACHE).then(function (cache) {
        cache.put(scopeUrl('./index.html'), copy);
      }).catch(function () {});
    }
    return response;
  }).catch(function () {
    return fromCache(request);
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      return putRuntime(request, response);
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    var network = fetch(request).then(function (response) {
      return putRuntime(request, response);
    }).catch(function () {
      return cached;
    });
    return cached || network;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isBypassHost(url.hostname)) return;

  var sameOrigin = url.origin === self.location.origin;
  var isNavigate = request.mode === 'navigate'
    || (request.destination === 'document')
    || ((request.headers.get('accept') || '').indexOf('text/html') !== -1 && sameOrigin && url.pathname.indexOf('.') === -1);

  if (isNavigate && sameOrigin) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (sameOrigin) {
    if (url.search.indexOf('v=' + VERSION) !== -1 || /\/icons\/|favicon\.svg$|manifest\.webmanifest$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request));
      return;
    }
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (CDN_HOSTS[url.hostname]) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
