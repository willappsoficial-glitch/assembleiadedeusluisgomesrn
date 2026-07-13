const CACHE_NAME = 'ad-luis-gomes-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.jpg',
  './logo.png'
];

// Instala o Service Worker e guarda os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta as requisições para o app funcionar rápido (ou offline)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Se tem no cache, retorna rápido
        }
        return fetch(event.request); // Se não tem, busca na internet
      })
  );
});
