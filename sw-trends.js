/* Service worker voor Trends: stale-while-revalidate. Meteen uit de eigen
   cache bedienen en op de achtergrond verversen; of er een nieuwe versie is,
   beslist de app zelf (checkAppUpdate, met het versiestempel). Trends is één
   bestand, dus versies uit twee deploys lopen niet binnen één pagina door
   elkaar.

   De drie service workers doen hetzelfde, elk in de schrijfstijl van de eigen
   app; de gedeelde regels staan in apps-basis/conventies.md, paragraaf 3.
   Wijzig je hier iets wezenlijks, doe het dan ook daar en in de andere twee.

   CACHE_VERSION is de naam van de cache. update_cache_version.py verhoogt hem,
   en dat hoort zodra dit bestand of de lijst met appbestanden wijzigt: anders
   installeert de nieuwe worker in dezelfde cache waaruit de oude nog bedient.
   Het versiestempel in trends.html is een eigen teller en gaat met de hand
   omhoog. */

const CACHE_VERSION = 30;
const CACHE_NAME = 'trends-v' + CACHE_VERSION;

/* Zonder dit bestand is er niets om offline te openen, dus dit moet slagen. */
const VERPLICHT = ['./trends.html'];
/* De rest is gemak: './' en index.html sturen alleen door naar trends.html,
   manifest en icoon zijn voor het installeren als app. Ze mogen mislukken:
   niet elke server beantwoordt een kale map, en dan zou die ene de hele
   installatie blokkeren. */
const OPTIONEEL = ['./', './index.html', './manifest.json', './icon.svg'];
const ASSETS = VERPLICHT.concat(OPTIONEEL);

/* De eigen bestanden als pad: de cacheopslag is van de hele origin, en elke
   app staat in een eigen map (mv-systems-apps.github.io/<app>/), dus alleen
   de origin vergelijken is te grof. Zo belandt er nooit iets van een andere
   app in de Trends-cache. */
function volledig(u) { return new URL(u, self.location.href); }
const EIGEN_PADEN = ASSETS.map((u) => volledig(u).pathname);
function isEigen(url) {
  return url.origin === self.location.origin && EIGEN_PADEN.indexOf(url.pathname) >= 0;
}
/* De sleutel in de cache: het pad zonder zoekstring, zodat alle varianten van
   een bestand één regel delen. */
function sleutel(url) { return url.origin + url.pathname; }
const APP_SLEUTEL = sleutel(volledig('./trends.html'));

/* Drie uiterste wachttijden, naar de rol van het verzoek; bij de grens wordt
   het verzoek echt afgebroken (zie metGrens).
   - GRENS: een cachemisser; dan is dit verzoek het antwoord, en een trage maar
     werkende verbinding afkappen levert alleen een offlinepagina op. Ook elke
     ophaalpoging van de installatie: een installatie die blijft hangen loopt
     nooit af, en zolang dat zo is doet registration.update() niets.
   - GRENS_MET_TERUGVAL: een paginaverzoek mist de cache terwijl de app wel
     bewaard is. Lang wachten koopt dan niets: liever na 3 s de bewaarde app.
   - GRENS_ACHTERGROND: een cachetreffer. Het antwoord is al gegeven en dit
     verzoek ververst alleen de kopie; daar wacht niemand op, dus die mag ruim,
     anders wordt de verversing op een trage verbinding afgekapt. */
const GRENS = 10000;
const GRENS_MET_TERUGVAL = 3000;
const GRENS_ACHTERGROND = 60000;

function metGrens(req, ms, init) {
  /* Het netwerk met een uiterste grens: een verbinding die blijft hangen
     (slecht mobiel bereik, een captive portal), geeft nooit een antwoord en
     nooit een fout. Bij de grens wordt het verzoek echt afgebroken en niet
     alleen losgelaten; anders houdt het een verbinding bezet terwijl niemand
     meer op het antwoord wacht. Zonder AbortController blijft het bij de grens
     zonder afbreken. */
  const ac = (typeof AbortController === 'function') ? new AbortController() : null;
  const opties = Object.assign({}, init || {}, ac ? { signal: ac.signal } : {});
  return new Promise((klaar, mis) => {
    let af = false;
    const klok = setTimeout(() => {
      if (af) return;
      af = true;
      if (ac) ac.abort();
      mis(new Error('netwerk duurde langer dan ' + ms + ' ms'));
    }, ms);
    fetch(req, opties).then(
      (res) => { if (af) return; af = true; clearTimeout(klok); klaar(res); },
      (e) => { if (af) return; af = true; clearTimeout(klok); mis(e); }
    );
  });
}

/* cache:'reload' zodat de installatie geen verouderde kopie uit de
   browsercache overneemt, en met de grens zodat een hangende verbinding de
   installatie niet eindeloos ophoudt. Een mislukking komt terug als null, zodat
   de aanroeper beslist of dat erg is. */
function haal(url) {
  return metGrens(volledig(url).href, GRENS, { cache: 'reload' }).then(
    (res) => (res && res.ok) ? res : null,
    () => null
  );
}

/* Een optioneel bestand dat niet binnenkwam, overnemen uit de nieuwste vorige
   eigen cache, zodat het niet ontbreekt tot de achtergrondverversing het aanvult.
   Alleen eigen caches, op nummer gesorteerd (trends-v10 is nieuwer dan trends-v9):
   caches.match() zou ook in die van Golf Score en Events zoeken. Lukt het niet,
   dan is er niets verloren. */
async function uitVorigeCache(cache, u) {
  try {
    const adres = sleutel(volledig(u));
    const vorige = (await caches.keys())
      .filter((n) => n.startsWith('trends-v') && n !== CACHE_NAME)
      .sort((a, b) => parseInt(b.slice(8), 10) - parseInt(a.slice(8), 10));
    for (const naam of vorige) {
      const oud = await (await caches.open(naam)).match(adres);
      if (oud) return await cache.put(adres, oud);
    }
  } catch (e) { /* gemak; de app werkt ook zonder */ }
  return null;
}

/* Een geldig antwoord in plaats van undefined aan respondWith: anders toont de
   browser een netwerkfout zonder uitleg. */
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

/* Welke grens geldt, hangt af van de rol van dit verzoek: bij een cachetreffer
   is het alleen de achtergrondverversing, bij een misser het antwoord zelf, en
   dan korter als er een bewaarde app is om op terug te vallen. De extra
   opzoeking kost alleen iets bij een misser op een paginaverzoek. */
function bepaalGrens(cache, gecached, navigatie) {
  if (gecached) return Promise.resolve(GRENS_ACHTERGROND);
  if (!navigatie) return Promise.resolve(GRENS);
  return cache.match(APP_SLEUTEL).then(
    (app) => app ? GRENS_MET_TERUGVAL : GRENS,
    () => GRENS
  );
}

/* Cachemisser én geen netwerk. Bij een paginaverzoek eerst de bewaarde app, zodat
   een opgeruimde of nog niet gevulde regel niet in een foutpagina eindigt. */
function terugval(cache, navigatie) {
  if (!navigatie) return Promise.resolve(offlineAntwoord(false));
  return cache.match(APP_SLEUTEL).then(
    (app) => app || offlineAntwoord(true),
    () => offlineAntwoord(true)
  );
}

/* Zeggen dat er een verse kopie van de pagina in de cache staat. De app kijkt
   ook zelf (4 s na de start), maar dan is de verversing op een trage verbinding
   vaak nog onderweg; zonder dit bericht komt de melding pas bij het
   wegschakelen en terughalen van de app. */
function meldVerversing() {
  if (!self.clients || typeof self.clients.matchAll !== 'function') return;
  self.clients.matchAll({ type: 'window' }).then((lijst) => {
    lijst.forEach((c) => { try { c.postMessage({ type: 'kopieVernieuwd' }); } catch (e) { /* weg is weg */ } });
  }).catch(() => { /* niets aan te doen */ });
}

self.addEventListener('install', (event) => {
  /* Bestond deze cache al, dan is CACHE_VERSION niet verhoogd en bedient de
     draaiende worker er nog uit: een mislukte installatie wist hem dan niet,
     anders is de app offline onbruikbaar. Alleen een cache die hier zelf is
     aangemaakt, wordt opgeruimd. */
  event.waitUntil(
    caches.keys().then((namen) => namen.indexOf(CACHE_NAME) >= 0).catch(() => false)
    .then((bestondAl) =>
    caches.open(CACHE_NAME).then((cache) =>
      // Eerst alle verplichte bestanden binnenhalen en pas daarna wegschrijven:
      // zo staat er nooit een halve deploy in de cache.
      Promise.all(VERPLICHT.map((u) => haal(u).then((res) => ({ u, res }))))
        .then((uit) => {
          const mist = uit.filter((x) => !x.res).map((x) => x.u);
          if (mist.length) throw new Error('verplichte bestanden ontbreken: ' + mist.join(', '));
          return Promise.all(uit.map((x) => cache.put(sleutel(volledig(x.u)), x.res)));
        })
        .then(() =>
          // De rest mag mislukken; wat ontbreekt komt uit de vorige eigen cache.
          Promise.all(OPTIONEEL.map((u) => haal(u).then((res) =>
            res ? cache.put(sleutel(volledig(u)), res).catch(() => null) : uitVorigeCache(cache, u))))
        )
        .catch((err) => {
          /* caches.open maakt de cache aan voordat er iets in staat, en zo'n
             lege huls gaat anders door voor een geslaagde installatie. */
          if (bestondAl) throw err;
          return caches.delete(CACHE_NAME).then(
            () => { throw err; },
            () => { throw err; }
          );
        })
    ))
    /* Geen skipWaiting: een nieuwe versie neemt een open app niet onder handen
       terwijl er misschien iets niet is opgeslagen. De app meldt de wachtende
       versie (de updatebalk) en vraagt er zelf om zodra alles op schijf staat;
       zie de message-handler. */
  );
});

/* De gebruiker klikte op herladen en er staat niets meer open: pas dan mag een
   wachtende worker het overnemen. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'nuOverstappen') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  /* clients.claim() hoort in de keten: anders kan de worker clients overnemen
     terwijl het opruimen van de oude caches nog loopt. */
  event.waitUntil(
    caches.keys().then((keys) =>
      // Alle apps op deze origin delen dezelfde cacheopslag: alleen eigen oude
      // caches opruimen. Pas bij activeren, zodat de vorige cache blijft staan tot
      // de nieuwe versie het werkelijk overneemt.
      Promise.all(keys.filter((key) => key.startsWith('trends-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: meteen uit de cache bedienen en op de achtergrond verversen.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }
  // Niet van deze app: laten gaan alsof er geen service worker is.
  if (!isEigen(url)) return;
  const isNavigatie = event.request.mode === 'navigate';

  /* Een verzoek dat uitdrukkelijk vers wil: altijd het netwerk, nooit de cache,
     niets bewaren. Wel met een grens, en zonder netwerk een foutcode in plaats van
     de oude kopie — anders ziet wie naar de server vraagt de cache. */
  if (!isNavigatie && (event.request.cache === 'reload' || event.request.cache === 'no-store')) {
    event.respondWith(metGrens(event.request, GRENS).catch(() => offlineAntwoord(false)));
    return;
  }

  /* Eén kopie per pad: opzoeken, ophalen en bewaren onder het pad zonder
     zoekstring. De Cache API neemt de zoekstring anders mee in de sleutel; dan
     mist trends.html?iets=1 de cache en faalt het offline, of komt er voor elke
     variant een kopie bij. */
  const bewaarSleutel = sleutel(url);

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(bewaarSleutel).then((cachedResponse) =>
      bepaalGrens(cache, cachedResponse, isNavigatie).then((grens) => {
        /* Bij een cachetreffer op de pagina met no-cache: GitHub Pages laat een
           bestand 10 minuten bewaren, en een gewoon verzoek kan dan dezelfde oude
           bytes terugschrijven, waardoor de melding van een nieuwe versie vlak na
           een push uitblijft. Alleen de pagina: daar staat het stempel. */
        const init = (cachedResponse && isNavigatie) ? { cache: 'no-cache' } : undefined;
        let klaarMetBewaren = null;
        const fetchPromise = metGrens(bewaarSleutel, grens, init)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const kopie = networkResponse.clone();
              // Mislukt het wegschrijven (geen ruimte, geen toestemming), dan blijft het antwoord staan.
              klaarMetBewaren = cache.put(bewaarSleutel, kopie)
                .then(() => { if (isNavigatie) meldVerversing(); })
                .catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || terugval(cache, isNavigatie));

        /* Dit moet vóór het antwoord staan: bij een cachetreffer lost respondWith
           meteen op, het event is dan afgehandeld en een latere waitUntil gooit
           InvalidStateError. Deze ene waitUntil omvat het ophalen en het
           wegschrijven, zodat de browser de worker niet stopt voordat de nieuwe
           kopie in de cache staat. */
        try {
          event.waitUntil(fetchPromise.then(() => klaarMetBewaren, () => {}));
        } catch (e) { /* event al afgehandeld; dan is er niets te verlengen */ }

        return cachedResponse || fetchPromise;
      }))
    ).catch(() => offlineAntwoord(isNavigatie)) // cacheopslag stuk of geweigerd
  );
});
