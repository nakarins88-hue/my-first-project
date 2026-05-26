const CACHE_NAME = 'jeff-bernat-lounge-v8';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './player-v8.js',
  './manifest.json',
  './default_cover.png',
  './cover_renaissance.png',
  './cover_meantime.png',
  './cover_shelovesmenot.png',
  './cover_singles.png'
];

// Install Event
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching core assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch Event (Network-First Fallback-to-Cache Strategy for high resilience)
self.addEventListener('fetch', e => {
  // Skip caching for external APIs or media streams (to prevent range-request CORS exceptions in Safari/Chrome)
  if (e.request.url.includes('itunes.apple.com') || e.request.url.includes('/music/') || e.request.url.includes('youtube.com')) {
    return;
  }
  
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
