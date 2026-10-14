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

const CACHE_VERSION = 'trends-v28';

/* Zonder dit bestand is er niets om offline te openen, dus dit moet slagen. */
const VERPLICHT = ['./trends.html'];
/* De rest is gemak: './' en index.html verwijzen alleen door naar trends.html,
   manifest en icoon zijn voor het installeren als app. Niet elke server
   antwoordt op een kale map-URL, en dan zou die ene de hele update blokkeren. */
const OPTIONEEL = ['./', './index.html', './manifest.json', './icon.svg'];
const ASSETS = VERPLICHT.concat(OPTIONEEL);

/* De eigen bestanden als pad. Elke app staat in een eigen submap op deze origin
   (mv-systems-apps.github.io/<app>/), dus de scope van deze worker is die submap en
   niet de hele origin — de registraties van Golf Score en Events botsen hier dus niet
   met die van Trends. De cacheopslag is wél van het hele domein, en dit filter is de
   extra zekerheid dat er nooit iets van een andere app in de Trends-cache belandt. */
function volledig(u) { return new URL(u, self.location.href); }
const EIGEN_PADEN = ASSETS.map((u) => volledig(u).pathname);
function isEigen(url) {
  return url.origin === self.location.origin && EIGEN_PADEN.indexOf(url.pathname) >= 0;
}

/* Uiterste wachttijd voor het netwerk. Een verbinding die niet weigert maar
   blijft hangen — slecht mobiel bereik, een captive portal, wifi zonder uitweg —
   levert nooit een antwoord en nooit een fout. Zonder grens wacht het tabblad
   daarop tot de browser er zelf een eind aan maakt, en komt de terugval naar de
   offlinepagina nooit aan de beurt.

   Twee grenzen, want de afweging verschilt. Is er een bewaarde app om op terug
   te vallen, dan koopt lang wachten niets: dan liever na 3 s de kopie die er al
   is. Is er niets, dan is wachten juist het beste wat er te doen valt — een
   trage maar werkende verbinding afkappen levert een offlinepagina op en daar
   heeft niemand iets aan. Vandaar de volle 10 s. */
const GRENS = 10000;
const GRENS_MET_TERUGVAL = 3000;

function metGrens(req, ms) {
  /* Alleen de belofte verwerpen is niet genoeg: het onderliggende verzoek liep dan
     door, hield de verbinding bezig en kon later alsnog in de cache schrijven.
     AbortController breekt het werkelijk af. Niet elke omgeving heeft hem, dus bij
     afwezigheid blijft het bij de grens zonder afbreken. */
  const ac = (typeof AbortController === 'function') ? new AbortController() : null;
  return new Promise((klaar, mis) => {
    let af = false;
    const klok = setTimeout(() => {
      if (af) return;
      af = true;
      if (ac) ac.abort();
      mis(new Error('netwerk duurde langer dan ' + ms + ' ms'));
    }, ms);
    fetch(req, ac ? { signal: ac.signal } : undefined).then(
      (res) => { if (af) return; af = true; clearTimeout(klok); klaar(res); },
      (e) => { if (af) return; af = true; clearTimeout(klok); mis(e); }
    );
  });
}

/* cache:'reload' zodat de installatie geen verouderde kopie uit de
   browsercache overneemt. Een mislukking komt terug als null, zodat de
   aanroeper beslist of dat erg is. */
function haal(url) {
  /* Ook hier een grens. De fetch-handler was wel beschermd, de installatie niet: bij een
     verbinding die hangt kwam er nooit een antwoord en nooit een fout, liep de installatie
     nooit af, werd er niets afgebroken en bleef de lege cache liggen. Zolang zo'n
     installatie hangt doet registration.update() ook niets, dus de updatecontrole stond stil. */
  // volledig() lost de relatieve URL expliciet op tegen de scope, zodat dit niet van
  // een impliciete basis-URL afhangt.
  return metGrens(new Request(volledig(url).href, { cache: 'reload' }), GRENS).then(
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

/* Hoe lang er op het netwerk gewacht mag worden. Bij een cachetreffer wacht niemand
   op dit verzoek — het is dan de achtergrondverversing — dus daar bepaalt de grens
   alleen hoe lang een hangende verbinding de worker bezig houdt. Bij een misser
   beslist of er een bewaarde app is om op terug te vallen. De extra opzoeking kost
   alleen iets op dat pad, en dat is precies het pad waar de tijd nergens heen gaat. */
function bepaalGrens(cache, gecached, navigatie) {
  if (gecached || !navigatie) return Promise.resolve(GRENS);
  return cache.match('./trends.html').then(
    (app) => app ? GRENS_MET_TERUGVAL : GRENS,
    () => GRENS
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
  /* Bestond deze cache al, dan is CACHE_VERSION niet verhoogd en gebruikt de nieuwe
     worker de cache die de oude op dit moment nog bedient. Dan mag een mislukte
     installatie die cache niet weggooien: de app zou offline onbruikbaar worden.
     Alleen een cache die hier zelf is aangemaakt wordt opgeruimd. */
  event.waitUntil(
    caches.keys().then((namen) => namen.indexOf(CACHE_VERSION) >= 0).catch(() => false)
    .then((bestondAl) =>
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
        .catch((err) => {
          /* caches.open maakt de cache al aan voordat er iets in staat. Mislukt het
             vullen van een nieuwe cache, dan blijft er anders een lege huls achter die
             voor een geslaagde installatie doorgaat. Een cache die er al was blijft
             staan — die is van de versie die nu werkt. */
          if (bestondAl) throw err;
          return caches.delete(CACHE_VERSION).then(
            () => { throw err; },
            () => { throw err; }
          );
        })
    ))
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
  /* clients.claim() hoort in de keten: anders kan de worker clients overnemen terwijl
     het opruimen van de oude caches nog loopt. Overnemen gebeurt alleen nadat de
     gebruiker zelf om de nieuwe versie heeft gevraagd — zie de message-handler. */
  event.waitUntil(
    caches.keys().then((keys) =>
      // Andere apps op dezelfde origin delen deze cacheopslag: alleen eigen caches
      // opruimen, en pas bij het activeren, zodat de vorige kopie blijft staan tot
      // de nieuwe versie het werkelijk overneemt.
      Promise.all(keys.filter((key) => key.startsWith('trends-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
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
      cache.match(event.request, zoekOpties).then((cachedResponse) =>
      bepaalGrens(cache, cachedResponse, isNavigatie).then((grens) => {
        /* De grens geldt voor beide rollen van dit verzoek. Bij een cachemisser wordt
           erop gewacht, dus daar voorkomt hij een vastgelopen tabblad. Bij een
           cachetreffer is dit de achtergrondverversing: daar wacht niemand op, maar
           zonder grens houdt een hangende verbinding de worker in leven via waitUntil.
           Afbreken is daar onschadelijk — de cache blijft dan staan zoals hij was. */
        /* Is er een cachetreffer, dan dient dit verzoek alleen nog om de cache te verversen
           en wordt het antwoord nooit getoond. GitHub Pages stuurt een max-age mee, dus een
           kaal verzoek kan dezelfde oude bytes terugschrijven en blijft de stempel-
           vergelijking blind. Bij een misser blijft het oorspronkelijke verzoek staan,
           want dát antwoord gaat wél naar de pagina. */
        const netwerkVerzoek = (cachedResponse && isNavigatie)
          ? new Request(bewaarSleutel, { cache: 'no-cache' })
          : event.request;
        let klaarMetBewaren = null;
        const fetchPromise = metGrens(netwerkVerzoek, grens)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const kopie = networkResponse.clone();
              // Mislukt het wegschrijven (geen ruimte, geen toestemming), dan blijft het antwoord staan.
              klaarMetBewaren = cache.put(bewaarSleutel, kopie).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || terugval(cache, isNavigatie));

        /* Dit moet hier staan, vóór het antwoord. Bij een cachetreffer lost respondWith
           meteen op met de kopie uit de cache; daarmee is het event afgehandeld en gooit
           een latere waitUntil InvalidStateError. De verversing zou dan niets meer te
           beschermen hebben en de browser mag de worker afsluiten voordat de nieuwe
           versie is weggeschreven — precies het mechanisme waar de updatemelding op rust. */
        try {
          event.waitUntil(fetchPromise.then(() => klaarMetBewaren, () => {}));
        } catch (e) { /* event al afgehandeld; dan is er niets te verlengen */ }

        return cachedResponse || fetchPromise;
      }))
    ).catch(() => offlineAntwoord(isNavigatie)) // cacheopslag stuk of geweigerd
  );
});
