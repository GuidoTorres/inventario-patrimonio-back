const CACHE_NAME = 'mi-app-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
];

// Almacena en caché los recursos especificados al instalar el service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Abriendo caché');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activa el service worker y limpia cachés antiguas si es necesario
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercepta las solicitudes de red y las sirve desde la caché en modo offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Si el recurso está en la caché, responde con él
      if (response) {
        return response;
      }
      // Si no está en caché, intenta obtenerlo de la red
      return fetch(event.request).catch(() => {
        // Devuelve el archivo index.html en caso de estar offline
        return caches.match('/index.html');
      });
    })
  );
});
