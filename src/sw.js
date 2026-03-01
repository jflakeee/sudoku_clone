/**
 * Service Worker - Cache-first strategy for offline support
 */

const CACHE_NAME = 'sudoku-v15';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/grid.css',
  './css/animations.css',
  './css/screens.css',
  './js/app.js',
  './js/game/board.js',
  './js/game/input.js',
  './js/game/notes.js',
  './js/game/history.js',
  './js/game/timer.js',
  './js/game/hints.js',
  './js/core/generator.js',
  './js/core/solver.js',
  './js/core/validator.js',
  './js/core/scorer.js',
  './js/core/board-config.js',
  './js/ui/grid.js',
  './js/ui/highlight.js',
  './js/ui/numberpad.js',
  './js/ui/toolbar.js',
  './js/ui/animations.js',
  './js/utils/storage.js',
  './js/utils/sound.js',
  './js/utils/daily-seed.js',
  './js/screens/main.js',
  './js/screens/game.js',
  './js/screens/complete.js',
  './js/screens/daily.js',
  './js/screens/profile.js',
  './js/screens/stats.js',
  './js/screens/awards.js',
  './js/screens/settings.js',
  './js/screens/tutorial.js',
  './js/screens/mode-select.js',
  './js/screens/history.js',
  './js/screens/print.js',
  './js/utils/export.js',
  './js/core/puzzle-worker.js',
  './css/print.css',
];

// Install: pre-cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first, falling back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Only cache same-origin GET requests
        if (
          response.ok &&
          event.request.method === 'GET' &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      return caches.match('./index.html');
    })
  );
});
