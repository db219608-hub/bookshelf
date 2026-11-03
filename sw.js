// Offline support for My Bookshelf.
// Your own files (page, CSV, icons) load fresh from the network when online and
// fall back to the saved copy when offline. Covers and fonts are saved as you view them.
var CACHE = 'bookshelf-v1';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function keyFor(url) {
  var u = new URL(url);
  u.search = '';
  return u.toString();
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Your own files: network first, saved copy when offline.
  if (url.origin === self.location.origin) {
    var key = keyFor(req.url);
    e.respondWith(
      fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, copy); }); }
        return res;
      }).catch(function () {
        return caches.match(key).then(function (hit) { return hit || caches.match('index.html'); });
      })
    );
    return;
  }

  // Covers and fonts: show the saved copy right away, refresh it in the background.
  var isCover = url.hostname === 'covers.openlibrary.org' || url.hostname.endsWith('archive.org');
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (isCover || isFont) {
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) {
            // Only keep good responses, so "no cover found" answers are never saved.
            if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
  }
});
