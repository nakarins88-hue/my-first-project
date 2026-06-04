// ==========================================================================
// Jeff Bernat Cozy Music Lounge - Service Worker (PWA + Background Audio)
// ==========================================================================

const CACHE_NAME = 'cozy-lounge-v3';

// App shell files to pre-cache for fast loading
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './player-v8.js',
  './visitor-counter.js',
  './visitor-counter.css',
  './manifest.json',
  './default_cover.png',
  './cover_renaissance.png',
  './cover_meantime.png',
  './cover_shelovesmenot.png',
  './cover_singles.png'
];

// Install: Pre-cache app shell, then activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Cozy Lounge Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches, claim all clients immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Cozy Lounge Service Worker...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(() => {
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    })
  );
});

// Fetch: Network-first strategy for HTML/API, Cache-first for static assets
// Music files (audio/*) are never cached (too large) — they stream directly
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip music files — they are too large to cache and stream fine on their own
  if (url.pathname.startsWith('/music/') || url.pathname.endsWith('.mp3') || url.pathname.endsWith('.m4a')) {
    return;
  }

  // Never cache the playlist — always fetch fresh so newly added songs show up right away
  if (url.pathname.endsWith('songs.json')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for offline fallback
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve from cache if available
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For navigation requests, return the cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
