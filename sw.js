const CACHE_NAME = 'ad-luis-gomes-v5'; // Atualize a versão do cache
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './logo.jpg',
  './logo.png'
  './assinatura secretario.jpg'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Força a atualização do Service Worker imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // Limpa caches antigos
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignora o cache para chamadas de API do Google Apps Script
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para arquivos estáticos do app
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
