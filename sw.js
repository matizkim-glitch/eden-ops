const CACHE_NAME = 'eden-bos-v3-static';
const APP_SHELL = [
  '/js/config.js',
  '/js/supabase-client.js',
  '/js/state.js',
  '/js/auth.js',
  '/js/router.js',
  '/js/utils.js',
  '/js/notifications.js',
  '/js/components/toast.js',
  '/js/components/modal.js',
  '/js/components/table.js',
  '/js/components/charts.js',
  '/js/modules/collection.js',
  '/js/modules/inventory.js',
  '/js/modules/production.js',
  '/js/modules/sales.js',
  '/js/modules/hr.js',
  '/js/modules/finance.js',
  '/js/modules/dashboard.js'
];
const STATIC_ASSET_PATTERN = /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|json|woff2?)$/i;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset = isSameOrigin && STATIC_ASSET_PATTERN.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
