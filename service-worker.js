// Service Worker Self-Destruct Script (Clean-sweeps all PWA caches and forces live reloading)
self.addEventListener('install', e => {
  console.log('Uninstalling service worker: skip waiting');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('Uninstalling service worker: unregistering and clearing caches');
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      console.log('Service Worker successfully uninstalled.');
      return self.clients.matchAll();
    }).then(clients => {
      clients.forEach(client => {
        if (client.url) {
          console.log('Reloading client:', client.url);
          client.navigate(client.url);
        }
      });
    })
  );
});

// Resilient bypass fetch handler during uninstallation transition
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
