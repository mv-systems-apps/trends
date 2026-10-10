const CACHE_VERSION = 'trends-v16';
const PRECACHE_URLS = [
  './',
  './index.html',
  './trends.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // Andere apps op dezelfde origin delen deze cacheopslag: alleen eigen caches opruimen.
      Promise.all(keys.filter((key) => key.startsWith('trends-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate: serveer direct uit cache, ververs op de achtergrond.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Alleen eigen bestanden: verzoeken naar een andere origin horen niet in de Trends-cache.
  if (url.origin !== self.location.origin) return;

  /* Een navigatie met een query-string (trends.html?iets=1) is dezelfde pagina, maar de
     Cache API neemt de query mee in de sleutel. Zonder ignoreSearch mist zo'n verzoek de
     cache en faalt het offline. Bewaren gebeurt onder de URL zonder query, zodat er niet
     voor elke variant een kopie in de cache belandt. Bij andere bestanden blijft de query
     wél onderscheidend: daar hoort ?v=2 juist een nieuwe ophaalactie te zijn. */
  const isNavigatie = event.request.mode === 'navigate';
  const zoekOpties = isNavigatie ? { ignoreSearch: true } : undefined;
  const bewaarSleutel = isNavigatie ? url.origin + url.pathname : event.request;

  event.respondWith(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.match(event.request, zoekOpties).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              cache.put(bewaarSleutel, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    )
  );
});
