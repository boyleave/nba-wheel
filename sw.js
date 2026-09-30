// NBA 輪盤 Service Worker：離線可用 + 球隊 Logo 快取
// 修改網站內容後，把版本號 +1，使用者下次開啟就會更新
var VERSION = 'v1';
var APP_CACHE = 'nba-wheel-app-' + VERSION;
var LOGO_CACHE = 'nba-wheel-logos'; // Logo 不隨版本清除

var APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

var LOGO_ABBRS = ['atl','bos','bkn','cha','chi','cle','dal','den','det','gs','hou','ind','lac','lal','mem',
  'mia','mil','min','no','ny','okc','orl','phi','phx','por','sac','sa','tor','utah','wsh'];
var LOGO_BASE = 'https://a.espncdn.com/i/teamlogos/nba/500/';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(APP_CACHE).then(function (cache) {
      return cache.addAll(APP_FILES);
    }).then(function () {
      // 預先下載 30 張 Logo；個別失敗不影響安裝
      return caches.open(LOGO_CACHE).then(function (cache) {
        return Promise.all(LOGO_ABBRS.map(function (abbr) {
          var url = LOGO_BASE + abbr + '.png';
          return cache.match(url).then(function (hit) {
            if (hit) return;
            return fetch(url, { mode: 'no-cors' }).then(function (res) {
              return cache.put(url, res);
            }).catch(function () {});
          });
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== APP_CACHE && key !== LOGO_CACHE) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = req.url;

  // 球隊 Logo：先用快取，沒有才上網抓
  if (url.indexOf(LOGO_BASE) === 0) {
    event.respondWith(
      caches.open(LOGO_CACHE).then(function (cache) {
        return cache.match(url).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            cache.put(url, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  // 只處理自己網站的檔案
  if (new URL(url).origin !== self.location.origin) return;

  // 頁面：先上網拿最新版，沒網路時用快取
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(APP_CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // 其他檔案（圖示、manifest）：先用快取
  event.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req);
    })
  );
});
