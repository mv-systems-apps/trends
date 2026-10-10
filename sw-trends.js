/* Service worker voor Trends.

   Dit bestand is de referentie voor de drie apps: Events en Golf Score wijken er
   nu nog van af. De strategie is stale-while-revalidate, bewust gekozen boven
   cache-first: Trends is één bestand, dus versies uit twee deploys kunnen niet
   binnen één pagina door elkaar lopen, en de verversing op de achtergrond houdt
   de updatemelding in trends.html werkend zonder aparte ETag-controle hier.

   - Staat een bestand in de cache, dan komt het daaruit en wacht niemand op het
     netwerk. Starten is daarmee onafhankelijk van de snelheid en de
     beschikbaarheid van de verbinding.
   - Daarnaast loopt een verzoek naar het netwerk, zodat de cache zich ververst
     en trends.html bij een volgende start de nieuwe versie kan melden.
   - Staat het bestand er niet in én is er geen netwerk, dan volgt bij een
     paginaverzoek de bewaarde app, en anders een nette offlinepagina. Er komt
     nooit undefined uit respondWith.
   - Alles van een andere origin: niet aankomen.

   De installatie slaagt alleen als trends.html binnen is. De andere bestanden
   mogen mislukken; die worden later door de achtergrondverversing aangevuld. */

const CACHE_VERSION = 'trends-v17';

/* Zonder dit bestand is er niets om offline te openen, dus dit moet slagen. */
const VERPLICHT = ['./trends.html'];
/* De rest is gemak: './' en index.html verwijzen alleen door naar trends.html,
   manifest en icoon zijn voor het installeren als app. Niet elke server
   antwoordt op een kale map-URL, en dan zou die ene de hele update blokkeren. */
const OPTIONEEL = ['./', './index.html', './manifest.json', './icon.svg'];
const ASSETS = VERPLICHT.concat(OPTIONEEL);

/* De eigen bestanden als pad. Het bereik van deze worker is de hele origin,
   want in de root staan ook Golf Score en Events. Zonder dit filter trok Trends
   hun bestanden in zijn eigen cache, en die ruimt de browser bij een nieuwe
   versie van Trends weer op. Een origin-controle alleen is daarvoor te grof. */
function volledig(u) { return new URL(u, self.location.href); }
const EIGEN_PADEN = ASSETS.map((u) => volledig(u).pathname);
function isEigen(url) {
  return url.origin === self.location.origin && EIGEN_PADEN.indexOf(url.pathname) >= 0;
}

/* cache:'reload' zodat de installatie geen verouderde kopie uit de
   browsercache overneemt. Een mislukking komt terug als null, zodat de
   aanroeper beslist of dat erg is. */
function haal(url) {
  return fetch(url, { cache: 'reload' }).then(
    (res) => (res && res.ok) ? res : null,
    () => null
  );
}

/* Een net antwoord in plaats van undefined aan respondWith: dat laatste gaf een
   browserfout zonder uitleg, precies op het moment dat de gebruiker offline is. */
function offlineAntwoord(navigatie) {
  return new Response(
    navigatie
      ? '<!doctype html><html lang="nl"><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Trends offline</title>' +
        '<body style="font:16px system-ui;margin:2rem;color:#e7edf0;background:#0f1417">' +
        '<h1 style="font-size:1.2rem">Trends is offline</h1>' +
        '<p>Deze pagina staat niet in de offline-kopie. Open de app een keer met ' +
        'verbinding, daarna werkt hij ook zonder.</p>'
      : '',
    {
      status: 503,
      statusText: 'offline',
      headers: { 'Content-Type': navigatie ? 'text/html;charset=utf-8' : 'text/plain' }
    }
  );
}

/* Cachemisser én geen netwerk. Bij een paginaverzoek eerst de bewaarde app, zodat
   een opgeruimde of nog niet gevulde regel niet in een foutpagina eindigt. */
function terugval(cache, navigatie) {
  if (!navigatie) return Promise.resolve(offlineAntwoord(false));
  return cache.match('./trends.html').then(
    (app) => app || offlineAntwoord(true),
    () => offlineAntwoord(true)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Eerst alle verplichte bestanden binnenhalen en pas daarna wegschrijven:
      // zo staat er nooit een halve deploy in de cache.
      Promise.all(VERPLICHT.map((u) => haal(u).then((res) => ({ u, res }))))
        .then((uit) => {
          const mist = uit.filter((x) => !x.res).map((x) => x.u);
          if (mist.length) throw new Error('verplichte bestanden ontbreken: ' + mist.join(', '));
          return Promise.all(uit.map((x) => cache.put(x.u, x.res)));
        })
        .then(() =>
          // De rest mag mislukken; wat ontbreekt wordt later alsnog aangevuld.
          Promise.all(OPTIONEEL.map((u) => haal(u).then((res) => res ? cache.put(u, res) : null)))
        )
        .catch((err) =>
          // caches.open maakt de cache al aan voordat er iets in staat. Mislukt het
          // vullen, dan blijft er anders een lege huls achter die voor een geslaagde
          // installatie doorgaat.
          caches.delete(CACHE_VERSION).then(
            () => { throw err; },
            () => { throw err; }
          )
        )
    )
    /* Geen skipWaiting: een nieuwe versie neemt een open app niet onder handen
       terwijl er misschien iets niet is opgeslagen. De app ziet dat er een versie
       wacht, meldt dat met de updatebalk, en vraagt er zelf om zodra alles op
       schijf staat — zie de message-handler hieronder. */
  );
});

/* De gebruiker klikte op herladen en er staat niets meer open: pas dan mag een
   wachtende worker het overnemen. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'nuOverstappen') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // Andere apps op dezelfde origin delen deze cacheopslag: alleen eigen caches
      // opruimen, en pas bij het activeren, zodat de vorige kopie blijft staan tot
      // de nieuwe versie het werkelijk overneemt.
      Promise.all(keys.filter((key) => key.startsWith('trends-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate: serveer direct uit cache, ververs op de achtergrond.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  // Niet van deze app: laten gaan alsof er geen service worker is.
  if (!isEigen(url)) return;

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
              const kopie = networkResponse.clone();
              /* Het wegschrijven mag na het antwoord doorlopen, maar de browser mag de
                 worker er niet voor afsluiten. Mislukt het (geen ruimte, geen
                 toestemming), dan blijft het antwoord staan. */
              const bewaren = cache.put(bewaarSleutel, kopie).catch(() => {});
              try { event.waitUntil(bewaren); } catch (e) { /* event al afgehandeld */ }
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || terugval(cache, isNavigatie));
        return cachedResponse || fetchPromise;
      })
    ).catch(() => offlineAntwoord(isNavigatie)) // cacheopslag stuk of geweigerd
  );
});
