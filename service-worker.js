const CACHE_NAME = 'lifehub-v1';
const CACHE_URLS = [
  '/index.html',
  '/styles.css',
  '/app.js',
  '/js/utils.js',
  '/js/validators.js',
  '/js/config.js',
  '/js/auth.js',
  '/js/database.js',
  '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cache aberto');
        return cache.addAll(CACHE_URLS);
      })
      .catch((error) => {
        console.error('[Service Worker] Erro ao fazer cache:', error);
      })
  );
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Estratégia: Network First, com fallback para Cache
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET e URLs externas
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('firebase') &&
      !event.request.url.includes('gstatic') &&
      !event.request.url.includes('tailwindcss') &&
      !event.request.url.includes('lucide') &&
      !event.request.url.includes('chart.js')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clonar a resposta para poder usá-la duas vezes
        const responseToCache = response.clone();
        
        // Atualizar o cache com a nova versão
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Se a rede falhar, buscar do cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Se não houver cache, retornar página offline personalizada
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          
          return new Response('Offline - Conteúdo não disponível', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Listen para mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
