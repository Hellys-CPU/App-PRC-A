// Service worker mínimo — existe só para o navegador considerar o app "instalável".
// Não faz cache agressivo de nada porque os dados vêm ao vivo do Supabase
// (Realtime, viagens, chat) e cache velho aqui geraria informação errada pro usuário.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
