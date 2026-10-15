/* Service worker voor Trends.

   Dezelfde opzet als sw-golf-score.js en sw-events.js: de drie werken hetzelfde,
   alleen in de schrijfstijl van hun eigen app. Wat ze gemeen hebben staat in
   apps-basis/conventies.md, paragraaf 3; wijzig je hier iets wezenlijks, doe het
   dan ook daar en in de andere twee.

   De strategie is stale-while-revalidate, bewust gekozen boven cache-first:
   Trends is één bestand, dus versies uit twee deploys kunnen niet binnen één
   pagina door elkaar lopen, en de verversing op de achtergrond houdt de
   updatemelding in trends.html werkend zonder aparte ETag-controle hier.

   - Staat een bestand in de cache, dan komt het daaruit en wacht niemand op het
     netwerk. Starten is daarmee onafhankelijk van de snelheid en de
     beschikbaarheid van de verbinding.
   - Daarnaast loopt een verzoek naar het netwerk, zodat de cache zich ververst.
     Staat er een verse kopie van de pagina, dan krijgt de app daar meteen een
     bericht van (kopieVernieuwd) en kan ze de nieuwe versie melden.
   - Staat het bestand er niet in én is er geen netwerk, dan volgt bij een
     paginaverzoek de bewaarde app, en anders een nette offlinepagina. Er komt
     nooit undefined uit respondWith.
   - Elk eigen bestand heeft één kopie, onder zijn pad zonder query.
   - Een verzoek dat uitdrukkelijk vers wil (cache 'reload' of 'no-store'), gaat
     altijd naar het netwerk en wordt niet bewaard.
   - Alles van een andere origin of een ander pad: niet aankomen.

   De installatie slaagt alleen als trends.html binnen is. De andere bestanden
   mogen mislukken; wat ontbreekt wordt overgenomen uit de vorige eigen cache, en
   anders later door de achtergrondverversing aangevuld.

   CACHE_VERSION is de naam van de cache en gaat met update_cache_version.py
   omhoog zodra dit bestand zelf wijzigt. Doe je dat niet, dan installeert de
   nieuwe worker in dezelfde cache waaruit de oude nog bedient. Voor een wijziging
   aan alleen trends.html is het niet nodig: de cache ververst zichzelf. Het
   stempel waaraan de app een nieuwe versie herkent, staat in trends.html en gaat
   met de hand omhoog. */

const CACHE_VERSION = 29;
const CACHE_NAME = 'trends-v' + CACHE_VERSION;

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
/* De sleutel in de cache: het pad zonder query, zodat alle varianten van een
   bestand één regel delen. */
function sleutel(url) { return url.origin + url.pathname; }
const APP_SLEUTEL = sleutel(volledig('./trends.html'));

/* Uiterste wachttijden voor het netwerk. Een verbinding die niet weigert maar
   blijft hangen — slecht mobiel bereik, een captive portal, wifi zonder uitweg —
   levert nooit een antwoord en nooit een fout. Zonder grens wacht het tabblad
   daarop tot de browser er zelf een eind aan maakt.

   Drie grenzen, want de afweging verschilt per rol van het verzoek.
   - GRENS: een cachemisser zonder bewaarde app. Dan is wachten het beste wat er
     te doen valt — een trage maar werkende verbinding afkappen levert een
     offlinepagina op. Ook de installatie haalt met deze grens op: een installatie
     die blijft hangen loopt nooit af, en dan doet registration.update() niets.
   - GRENS_MET_TERUGVAL: een cachemisser terwijl de app wel bewaard is. Lang
     wachten koopt dan niets: liever na 3 s de kopie die er al is.
   - GRENS_ACHTERGROND: een cachetreffer. Het antwoord is dan al gegeven en dit
     verzoek ververst alleen de kopie. Daar wacht niemand op, dus die mag ruim:
     met 10 s werd op een trage verbinding de nieuwe versie telkens afgekapt en
     bleef de updatemelding uit. */
const GRENS = 10000;
const GRENS_MET_TERUGVAL = 3000;
const GRENS_ACHTERGROND = 60000;

function metGrens(req, ms, init) {
  /* Alleen de belofte verwerpen is niet genoeg: het onderliggende verzoek liep dan
     door, hield de verbinding bezig en kon later alsnog in de cache schrijven.
     AbortController breekt het werkelijk af. Niet elke omgeving heeft hem, dus bij
     afwezigheid blijft het bij de grens zonder afbreken. */
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

/* Welke grens geldt voor dit verzoek. Bij een cachetreffer is het alleen de
   achtergrondverversing. Bij een misser beslist of er een bewaarde app is om op
   terug te vallen; de extra opzoeking kost alleen iets op dat pad, en dat is
   precies het pad waar de tijd nergens heen gaat. */
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

/* Zeggen dat er een nieuwe kopie van de pagina staat. De app controleert 4 s na de
   start, maar op een trage verbinding is de verversing dan nog onderweg; zonder dit
   bericht kwam de melding pas bij het wegschakelen en terughalen. */
function meldVerversing() {
  if (!self.clients || typeof self.clients.matchAll !== 'function') return;
  self.clients.matchAll({ type: 'window' }).then((lijst) => {
    lijst.forEach((c) => { try { c.postMessage({ type: 'kopieVernieuwd' }); } catch (e) { /* weg is weg */ } });
  }).catch(() => { /* niets aan te doen */ });
}

self.addEventListener('install', (event) => {
  /* Bestond deze cache al, dan is CACHE_VERSION niet verhoogd en gebruikt de nieuwe
     worker de cache die de oude op dit moment nog bedient. Dan mag een mislukte
     installatie die cache niet weggooien: de app zou offline onbruikbaar worden.
     Alleen een cache die hier zelf is aangemaakt wordt opgeruimd. */
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
          /* caches.open maakt de cache al aan voordat er iets in staat. Mislukt het
             vullen van een nieuwe cache, dan blijft er anders een lege huls achter die
             voor een geslaagde installatie doorgaat. Een cache die er al was blijft
             staan — die is van de versie die nu werkt. */
          if (bestondAl) throw err;
          return caches.delete(CACHE_NAME).then(
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
      Promise.all(keys.filter((key) => key.startsWith('trends-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
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
  const isNavigatie = event.request.mode === 'navigate';

  /* Een verzoek dat uitdrukkelijk vers wil: altijd het netwerk, nooit de cache,
     niets bewaren. Wel met een grens, en zonder netwerk een foutcode in plaats van
     de oude kopie — anders ziet wie naar de server vraagt de cache. */
  if (!isNavigatie && (event.request.cache === 'reload' || event.request.cache === 'no-store')) {
    event.respondWith(metGrens(event.request, GRENS).catch(() => offlineAntwoord(false)));
    return;
  }

  /* Eén kopie per pad: opzoeken, ophalen en bewaren gebeurt onder het pad zonder
     query. De Cache API neemt de query anders mee in de sleutel, en dan mist
     trends.html?iets=1 de cache en faalt het offline, of komt er voor elke variant
     een kopie bij. */
  const bewaarSleutel = sleutel(url);

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(bewaarSleutel).then((cachedResponse) =>
      bepaalGrens(cache, cachedResponse, isNavigatie).then((grens) => {
        /* Is er een cachetreffer op de pagina, dan dient dit verzoek alleen nog om de
           cache te verversen. GitHub Pages stuurt een max-age van 10 minuten mee, dus
           een kaal verzoek kan dezelfde oude bytes terugschrijven en blijft de
           stempelvergelijking blind. Daarom no-cache, en alleen bij de pagina: daar
           staat het stempel. */
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
