#!/usr/bin/env node
/* Regressietests voor Trends.
   Draaien met:  node trends-tests.cjs   (vanuit dezelfde map als trends.html en sw-trends.js)

   De tests halen de functies letterlijk uit trends.html, zodat ze niet uit de pas kunnen
   lopen met de app. Browsergedrag (scrollen, dialogen, DOM) wordt hier NIET getest.

   De groepen hangen aan elkaar: groep 6 is asynchroon en roept aan het eind vervolg()
   aan, die roept deel8() aan, en zo verder. Dat betekent dat een groep die omvalt de
   groepen erna meesleept. Daar is nu een vangnet voor -- een niet-opgevangen fout wordt
   als mislukte controle geteld, de eindregel verschijnt altijd, en die meldt hoeveel van
   de 19 groepen werkelijk hebben gedraaid. Zonder dat vangnet eindigde een mislukte run
   met alleen een stacktrace: de bundel stopte bij groep 6 van de 19, en omdat de
   exitcode in een pijp niet opvalt, las dat als 'niets mislukt'.

   Valt een groep om in zijn SYNCHRONE deel (bijvoorbeeld bij het bouwen van de
   zandbak), dan is de ketting daar werkelijk afgebroken en draaien de groepen erna
   niet; de eindregel zegt dan tot hoever het kwam. Dat herstellen vraagt een andere
   opzet van de bundel en is bewust niet gedaan. */

const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, 'trends.html'), 'utf8');
const SW   = fs.readFileSync(path.join(__dirname, 'sw-trends.js'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

/* Een functie letterlijk uit de app halen. De app schrijft de sluitaccolade van
   een functie met meer regels op kolom 0; een functie van EEN regel sluit op die
   regel zelf. Beide gevallen apart, want een greep tot de volgende '\n}' slokt
   bij een functie van een regel de hele volgende functie mee -- en dan draait er
   stil iets anders dan de naam belooft. De controle erna vangt zo'n misgreep: in
   het stuk mag maar een functiekop staan. Dezelfde opzet als in
   events-tests.cjs, waar deze misgreep eerder is opgetreden. */
const haal = naam => {
  const kop_ = new RegExp('^(?:async )?function ' + naam + '\\s*\\(', 'm').exec(SCRIPT);
  if (!kop_) throw new Error('functie niet gevonden in trends.html: ' + naam);
  const eersteRegel = SCRIPT.slice(kop_.index, SCRIPT.indexOf('\n', kop_.index));
  const tel = (t, c) => t.split(c).length - 1;
  const stuk = (tel(eersteRegel, '{') > 0 && tel(eersteRegel, '{') === tel(eersteRegel, '}'))
    ? eersteRegel
    : SCRIPT.slice(kop_.index, SCRIPT.indexOf('\n}', kop_.index) + 2);
  const koppen = (stuk.match(/^(?:async )?function (\w+)/gm) || []);
  if (koppen.length !== 1) throw new Error('greep te ruim bij ' + naam + ': ' + koppen.join(', '));
  return stuk;
};
const KERN = ['keyToDate','keyToTimeMinutes','dateToKey','geldigeSleutel','getFlatEntries',
  'aggregateDayValue','getDailyFromFlat','normalizeDataKeys','dataFileObj','computeMeanSigma',
  'computeRBar','todayUTCDate','getWeekStart','getMonthStart','getQuarterStart','getYearStart','getGroupEnd',
  'aggregatePoints','fmtDateNL'].map(haal).join('\n');
eval(KERN);

let goed = 0, fout = 0;
const ok = (naam, voorwaarde, extra='') => {
  if (voorwaarde) { goed++; console.log('  OK   ' + naam + (extra ? '  — ' + extra : '')); }
  else { fout++; console.log('  FOUT ' + naam + (extra ? '  — ' + extra : '')); }
};
let groepen = 0;
const kop = t => { groepen++; console.log('\n' + t); };
const GROEPEN_VERWACHT = 23;

/* De eindregel op een plek, zodat hij ook verschijnt als de bundel onderweg
   omvalt. Anders eindigt een mislukte run met alleen een stacktrace, en dat
   leest als 'niets mislukt' -- precies wat hier gebeurde: de bundel stopte bij
   groep 6 van de 19 en niemand zag het. */
let afgerond = false;
function eindregel(){
  if (afgerond) return;
  afgerond = true;
  console.log('\n' + '='.repeat(60));
  if (groepen !== GROEPEN_VERWACHT) {
    fout++;
    console.log('  FOUT de bundel liep niet tot het eind  — ' + groepen + ' van de ' +
                GROEPEN_VERWACHT + ' groepen gedraaid');
  } else {
    console.log('alle ' + GROEPEN_VERWACHT + ' groepen hebben gedraaid');
  }
  console.log(goed + ' geslaagd, ' + fout + ' mislukt');
  console.log('NIET getest (vereist een browser of toestel): scrollen, DOM-weergave,');
  console.log('schermlezer en focusvolgorde, of de serviceworker werkelijk een nieuwe');
  console.log('versie ophaalt, een gedwongen afsluiting door Android, ontbrekende');
  console.log('maptoestemming en een werkelijk volle opslag.');
  process.exit(fout ? 1 : 0);
}

/* Een afgewezen belofte die niemand opvangt sluit node af. Hier wordt dat eerst
   als mislukte controle geteld en daarna netjes afgerond, zodat te zien is WAAR
   het omviel en wat er tot dat punt al niet klopte. */
function omgevallen(waar, e){
  fout++;
  console.log('  FOUT ' + waar + '  — ' + ((e && e.message) || e));
  if (e && e.stack) console.log('       ' + String(e.stack).split('\n')[1].trim());
  eindregel();
}
process.on('unhandledRejection', (e) => omgevallen('een afgewezen belofte is niet opgevangen', e));
process.on('uncaughtException', (e) => omgevallen('een uitzondering is niet opgevangen', e));
/* Een belofte die nooit uitkomt, laat node zonder werk achter: dan sluit het stil af,
   zonder eindregel en met code 0, en leest een halve run als 'niets mislukt'. Dat
   gebeurde hier met een test die op een nagebootste klok wachtte die niet liep. */
process.on('beforeExit', () => { if (!afgerond) omgevallen('de bundel stopte halverwege', 'een belofte kwam nooit uit'); });
const bijna = (a, b, marge=1e-9) => Math.abs(a - b) < marge;

/* Nagebootste serviceworker-omgeving met de echte semantiek van de Cache API:
   relatieve sleutels worden tegen de scope opgelost, de zoekstring hoort bij de
   sleutel tenzij er met ignoreSearch wordt gezocht, en een netwerkantwoord heeft
   een ok-vlag. Zonder die drie dingen toetsen de tests iets anders dan de browser doet. */
const ORIGIN = 'https://mv-systems-apps.github.io';
const SCOPE = ORIGIN + '/';
/* De naam van de eigen cache. Sinds de drie apps gelijk zijn getrokken een losse
   teller met de naam ervan afgeleid; de oude schrijfwijze ('trends-v28') wordt
   hier nog herkend, zodat de bundel ook tegen de vorige versie te draaien is. */
const CACHE_NAAM = (() => {
  const oud = SW.match(/CACHE_VERSION = '([^']+)'/);
  if (oud) return oud[1];
  const teller = SW.match(/const CACHE_VERSION = (\d+);/);
  return 'trends-v' + (teller ? teller[1] : '?');
})();
function swOmgeving(opties = {}) {
  const abs = u => new URL(u, SCOPE).href;
  const zonderQuery = u => String(u).split('?')[0];
  const store = new Map();
  const caches = {
    async keys(){ return [...store.keys()]; },
    async delete(n){ return store.delete(n); },
    async open(n){
      if (opties.cacheStuk) throw new Error('cacheopslag geweigerd');
      if (!store.has(n)) store.set(n, new Map());
      const c = store.get(n);
      return {
        async match(r, o){
          const url = abs(r && r.url ? r.url : r);
          if (c.has(url)) return c.get(url);
          if (o && o.ignoreSearch) {
            for (const k of c.keys()) if (zonderQuery(k) === zonderQuery(url)) return c.get(k);
          }
          return undefined;
        },
        async put(r, resp){
          if (opties.putStuk) throw new Error('geen ruimte');
          c.set(abs(r && r.url ? r.url : r), resp);
        },
        // Hoort bij de echte API en is alles-of-niets: één mislukking laat het geheel falen.
        async addAll(urls){
          const uit = await Promise.all(urls.map(u => netwerk(u, {cache: 'reload'}).then(r => r, () => null)));
          if (uit.some(r => !r || !r.ok)) throw new TypeError('addAll: een verzoek mislukte');
          urls.forEach((u, i) => c.set(abs(u), uit[i]));
        }
      };
    }
  };
  // standaard staan alle app-bestanden op de server
  const server = new Set((opties.server || ['./', './index.html', './trends.html', './manifest.json', './icon.svg']).map(abs));
  const log = [];
  let online = opties.online !== false;
  let hangt = false;
  let traag = opties.traag || 0;
  const netwerk = (req, init) => {
    const url = abs(req && req.url ? req.url : req);
    log.push({url, cache: (init && init.cache) || (req && req.cache)});
    // Een verbinding die blijft hangen: geen antwoord én geen fout, nooit.
    if (hangt) return new Promise(() => {});
    /* Een trage maar werkende verbinding: het antwoord komt, maar pas na
       opties.traag ms op de nagebootste klok. */
    if (traag && online && server.has(zonderQuery(url))) {
      return new Promise(r => nepSetTimeout(() => r({ok: true, status: 200, type: 'basic',
        body: 'traag ' + url, clone(){ return this; }}), traag));
    }
    if (!online) return Promise.reject(new Error('offline'));
    if (new URL(url).origin !== ORIGIN) return Promise.resolve({ok: true, status: 200, type: 'cors', clone(){ return this; }});
    /* Een statische server bedient op pad en trekt zich van de query niets aan. */
    if (!server.has(zonderQuery(url))) return Promise.resolve({ok: false, status: 404, type: 'basic', clone(){ return this; }});
    return Promise.resolve({ok: true, status: 200, type: 'basic', body: 'inhoud ' + url, clone(){ return this; }});
  };
  /* Nagebootste klok, zodat een test op de uiterste wachttijd niet echt tien
     seconden stilstaat. tik(ms) laat de tijd verstrijken en vuurt wat aan de beurt is. */
  let nu = 0, volgnr = 0;
  const klokken = new Map();
  const nepSetTimeout = (fn, ms) => { const id = ++volgnr; klokken.set(id, {op: nu + (ms || 0), fn}); return id; };
  const nepClearTimeout = (id) => klokken.delete(id);
  const handlers = {};
  const self = {
    location: {origin: ORIGIN, href: SCOPE},
    addEventListener: (t, f) => { (handlers[t] ||= []).push(f); },
    skipWaiting(){ self.skipWaitingAangeroepen = true; },
    /* De worker schrijft de open vensters aan zodra er een verse kopie van de
       pagina staat; hier worden die berichten opgevangen. */
    clients: {claim(){}, matchAll(){ return Promise.resolve(vensters); }},
    berichten: []
  };
  const vensters = [{postMessage: m => self.berichten.push(m)}];
  return {
    ORIGIN, SCOPE, abs, store, caches, handlers, self, log,
    zetOffline(){ online = false; },
    zetOnline(){ online = true; },
    zetHangend(){ hangt = true; },
    zetTraag(ms){ traag = ms; },
    lopendeKlokken(){ return klokken.size; },
    async tik(ms){
      /* Eerst de microtaken laten uitlopen: de klok van metGrens wordt pas gezet
         nadat de cache is doorzocht, dus zonder deze stap loopt de tijd vooruit op
         de code en vuurt er niets. Daarna de tijd verzetten en opnieuw laten uitlopen. */
      for (let i = 0; i < 20; i++) await Promise.resolve();
      nu += ms;
      for (const [id, k] of [...klokken]) {
        if (k.op <= nu) { klokken.delete(id); k.fn(); }
      }
      for (let i = 0; i < 20; i++) await Promise.resolve();
    },
    maakSw(){
      new Function('self', 'caches', 'fetch', 'setTimeout', 'clearTimeout', SW)(
        self, caches, netwerk, nepSetTimeout, nepClearTimeout);
    }
  };
}

/* ---------- 1. toevoegen, wijzigen, verwijderen ---------- */
kop('1. Toevoegen, wijzigen en verwijderen van metingen');
{
  let cache = {}, versie = 0;
  const setMeting = (k, v) => { cache[k] = v; versie++; };
  const deleteMeting = k => { delete cache[k]; versie++; };
  setMeting('D20260101T1200', 80);
  ok('toevoegen', getFlatEntries(cache).length === 1);
  setMeting('D20260101T1200', 81);
  ok('wijzigen vervangt, geen duplicaat', getFlatEntries(cache).length === 1 && getFlatEntries(cache)[0].value === 81);
  deleteMeting('D20260101T1200');
  ok('verwijderen', getFlatEntries(cache).length === 0);
  ok('versieteller loopt op bij elke mutatie', versie === 3, 'versie=' + versie);
}

/* ---------- 2. meerdere metingen op één dag ---------- */
kop('2. Meerdere metingen op één dag');
{
  const data = {'D20260101T0600': 80, 'D20260101T1200': 82, 'D20260101T1800': 84, 'D20260102T1200': 90};
  const daily = getDailyFromFlat(getFlatEntries(data));
  ok('drie metingen worden één dag', daily.length === 2);
  ok('dagwaarde is het gemiddelde', bijna(daily[0].value, 82), daily[0].value);
  ok('telling per dag klopt', daily[0].count === 3 && daily[1].count === 1);
  ok('enkele meting = die waarde', bijna(daily[1].value, 90));
  const tijden = daily[0].entries.map(e => e.minutes);
  ok('metingen binnen de dag chronologisch', tijden.join() === '360,720,1080', tijden.join());
}

/* ---------- 3. aggregaties ---------- */
kop('3. Aggregaties per dag, week, maand, kwartaal en jaar');
{
  const data = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
    data['D' + dateToKey(d) + 'T1200'] = 100;           // elke dag dezelfde waarde
  }
  const daily = getDailyFromFlat(getFlatEntries(data));
  ok('dag: 365 groepen', daily.length === 365, daily.length);
  for (const [mode, verwacht] of [['w', 53], ['m', 12], ['q', 4], ['y', 1]]) {
    const groepen = aggregatePoints(daily, mode).filter(p => p.value != null);
    ok(`${mode}: aantal groepen plausibel`, groepen.length === verwacht, groepen.length + ' groepen');
    ok(`${mode}: gemiddelde blijft 100`, groepen.every(p => bijna(p.value, 100)));
  }
  ok("'dag' en 'tijd' laten de punten ongemoeid",
     aggregatePoints(daily, 'd').length === daily.length && aggregatePoints(daily, 'p').length === daily.length);
}

/* ---------- 4. statistiek ---------- */
kop('4. Statistieken');
{
  const vals = [2, 4, 4, 4, 5, 5, 7, 9];
  const {mean, sigma} = computeMeanSigma(vals);
  ok('gemiddelde', bijna(mean, 5), mean);
  ok('sigma (n-1)', bijna(sigma, Math.sqrt(32/7)), sigma.toFixed(6));   // steekproef, niet populatie
  ok('rBar = gemiddelde absolute opeenvolgende verschil', bijna(computeRBar([1, 3, 2, 6]), (2+1+4)/3));
  ok('sigma bij één waarde is 0', computeMeanSigma([5]).sigma === 0);
  ok('leeg levert geen getal op', computeMeanSigma([]).mean === null);
}
/* Regressie (1352898-026): de echte functies uit de app */
{
  const R = new Function([
    'let currentFmtThousands = false, dataAggMode = "d", chartViewMode = "standard", prognoseMogelijk = false;',
    SCRIPT.match(/^const T95 = [^;]*;/m)[0],
    /* vandaag vast: 1 december 2025, zodat de prognoses in 2026 in de toekomst liggen */
    'let vandaagTest = new Date(Date.UTC(2025, 11, 1)); function todayUTCDate(){ return new Date(vandaagTest); }',
    haal('tWaarde'), haal('prognoseVoor'), haal('prognoseNaVandaag'), haal('hellingDecimalen'), haal('isTrendWeergave'), haal('grenzenRondLijn'), haal('effectieveWeergave'), haal('tabelTrend'),
    SCRIPT.match(/^const REGRESSIE_KLEUR = [^;]*;/m)[0],
    SCRIPT.match(/^const REGRESSIE_EENHEID = [^;]*;/m)[0],
    SCRIPT.match(/^const REGRESSIE_MIN_GRENZEN = [^;]*;/m)[0],
    SCRIPT.match(/^const TABELKLEUR = [^;]*;/m)[0],
    haal('kleurBijLijn'), haal('regressieKleuren'),
    haal('fmtVal'), haal('berekenRegressie'), haal('regressieVoor'), haal('metTeken'), haal('hellingPijl'), haal('hellingTekst'), haal('grafiekWeergaven'),
    'return { tWaarde, prognoseVoor, grenzenRondLijn, hellingDecimalen, zetVandaag: d => { vandaagTest = d; },',
    '  effectief: (a, w) => { dataAggMode = a; chartViewMode = w; return [effectieveWeergave(), JSON.stringify(tabelTrend())]; },',
    '  zetPrognose: (m, w) => { prognoseMogelijk = m; chartViewMode = w || "standard"; },',
    '  berekenRegressie, regressieVoor, kleurBijLijn, regressieKleuren, metTeken, hellingPijl, hellingTekst, KLEUR: REGRESSIE_KLEUR,',
    '  weergaven: a => { dataAggMode = a; return grafiekWeergaven(); } };'
  ].join('\n'))();
  let g = R.berekenRegressie([0, 1, 2, 3], [1, 3, 5, 7]);
  ok('regressie: een perfect stijgende reeks geeft r=1, helling en snijpunt exact (026)',
     g && bijna(g.r, 1) && bijna(g.r2, 1) && bijna(g.helling, 2) && bijna(g.snijpunt, 1) && g.sRes === 0);
  g = R.berekenRegressie([0, 1, 2, 3], [7, 5, 3, 1]);
  ok('regressie: dalend geeft r=-1 (026)', g && bijna(g.r, -1) && bijna(g.helling, -2));
  /* bekende uitkomst: x 1..5, y 2,4,5,4,5 -> b=0.6, a=2.2, r=0.7746, s=sqrt(2.4/3)=0.8944 */
  g = R.berekenRegressie([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
  ok('regressie: bekende uitkomst (b=0,6, a=2,2, r=0,775, s rond de lijn 0,894) (026)',
     g && bijna(g.helling, 0.6) && bijna(g.snijpunt, 2.2) && Math.abs(g.r - 0.774597) < 1e-5 && Math.abs(g.sRes - 0.894427) < 1e-5,
     g && [g.helling, g.snijpunt, g.r, g.sRes].map(v => v.toFixed(4)).join(' '));
  ok('regressie: minder dan 3 punten geeft geen lijn (026)', R.berekenRegressie([0, 1], [1, 2]) === null);
  ok('regressie: alle waarden gelijk geeft geen lijn (026)', R.berekenRegressie([0, 1, 2], [4, 4, 4]) === null);
  ok('regressie: alles op hetzelfde moment geeft geen lijn (026)', R.berekenRegressie([3, 3, 3], [1, 2, 3]) === null);
  ok('regressie: een waarde zonder getal geeft geen lijn (026)', R.berekenRegressie([0, 1, 2], [1, NaN, 3]) === null);
  const d = (iso) => new Date(iso + 'T00:00:00Z');
  /* per dag: x in dagen, ook over een gat; helling per week */
  const dag = [{date: d('2026-10-01'), value: 10}, {date: d('2026-10-02'), value: 11}, {date: d('2026-10-05'), value: 14}];
  g = R.regressieVoor(dag, dag, 'd');
  ok('per dag: een gat telt als tijd, helling per week (026)', g && bijna(g.helling, 1) && bijna(g.hellingPer, 7) && g.eenheid === 'wk');
  ok('per dag: de waarde op de lijn per punt, voor de trendkaart (026)',
     g && g.verwacht.length === 3 && bijna(g.verwacht[0], 10) && bijna(g.verwacht[1], 11) && bijna(g.verwacht[2], 14));
  ok('per dag: lijn van begin tot eind en de verandering daartussen (026)',
     g && bijna(g.lijnBegin, 10) && bijna(g.lijnEind, 14) && bijna(g.verandering, 4) && g.datumEind.getTime() === d('2026-10-05').getTime());
  /* per maand: x is de plek op de as (de gevulde groepen), zoals getekend */
  const slots = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'].map(x => ({date: d(x)}));
  const mnd = [{date: d('2026-01-01'), value: 5}, {date: d('2026-02-01'), value: 6}, {date: d('2026-04-01'), value: 8}];
  g = R.regressieVoor(mnd, slots, 'm');
  ok('per maand: een lege maand telt mee als plek, helling per maand (026)', g && bijna(g.hellingPer, 1) && g.eenheid === 'mnd');
  ok('per jaar en per kwartaal de eigen eenheid (026)',
     R.regressieVoor(mnd, slots, 'q').eenheid === 'kw' && R.regressieVoor(mnd, slots, 'y').eenheid === 'jr');
  ok('een punt dat niet op de as staat: geen lijn (026)', R.regressieVoor(mnd, slots.slice(0, 2), 'm') === null);
  ok('helling met teken, afgerond op nul zonder teken (026)',
     R.metTeken(0.3, 2) === '+0.30' && R.metTeken(-0.3, 2) === '-0.30' && R.metTeken(0.001, 2) === '0.00');
  ok('de kop: een pijl voor de richting in plaats van het woord helling (026)',
     [R.hellingPijl({hellingPer: -0.153}, 2), R.hellingTekst({hellingPer: -0.153, eenheid: 'wk'}, 2)].join(' ') === '↘ -0.15/wk' &&
     R.hellingPijl({hellingPer: 0.3}, 2) + R.hellingTekst({hellingPer: 0.3, eenheid: 'mnd'}, 2) === '↗+0.30/mnd' &&
     R.hellingPijl({hellingPer: 0.001}, 2) === '→' && R.hellingTekst(null, 2) === '–' && R.hellingPijl(null, 2) === '' &&
     !/helling=/.test(haal('drawChart')));
  ok('de pijl is wit, alleen de waarde in de kleur van de lijn (026)',
     /\[hellingPijl\(regressie, dec\+1\),2,'#e7edf0'\]/.test(haal('drawChart')) && /delen\.push\(\[hTxt,1,REGRESSIE_KLEUR\]/.test(haal('drawChart')));
  ok('geen label meer in de grafiek; de naam staat onder de grafiek en in Analyse voluit (029)',
     !/badgeText/.test(haal('drawChart')) && /titelEl\.innerHTML = weergaveNaamHtml\(stats\.chartMode\);/.test(haal('openChartStatsModal')) &&
     /regressie:'Regressie', regressieXmr:'Regressie XmR', prognose:'Prognose'/.test(SCRIPT) && /toonWeergaveStipjes\(effectiveChartMode\);/.test(SCRIPT));
  ok('niet aantoonbaar: een wit vraagteken achter de pijl, en de lijn gestreept (027)',
     /if\(regressie && !regressie\.aantoonbaar\) delen\.push\(\['\?',1,'#e7edf0'\]\);/.test(haal('drawChart')) &&
     /ctx\.setLineDash\(regressie\.aantoonbaar \? \[\] : \[7,5\]\)/.test(haal('drawChart')));
  ok('prognose: de datum rechts onder de grafiek in de kleur van de lijn, niet in de kop; geen grenzen (027)',
     !/fmtDateNL\(dateToKey\(regressie\.prognose\)\) : '–'/.test(haal('drawChart')) &&
     /if\(!prognoseLabel\(\)\) drawDateLabel\(lastP\.date, rightLabelX, 'right'\);/.test(haal('drawChart')) &&
     /if\(!prognoseLabel\(\)\) drawDateLabel\(new Date\(xMin\.getTime\(\) \+ xSpan\), rightLabelX, 'right'\);/.test(haal('drawChart')) &&
     /ctx\.textAlign = 'right'; ctx\.fillStyle = REGRESSIE_KLEUR;/.test(haal('drawChart')) &&
     /if\(!isPrognose && kleurBijLijn\(0, regressie, points\.length, regressie\.xmr\) !== null\)/.test(haal('drawChart')));
  ok('vegen: na Range de trendkaart, per dag en per meting ook met XmR-grenzen (026, 027)',
     R.weergaven('d').join() === 'standard,xmr,range,regressie,regressieXmr' && R.weergaven('p').join() === 'standard,xmr,range,regressie,regressieXmr' &&
     R.weergaven('m').join() === 'standard,range,regressie');
  R.zetPrognose(true);
  ok('vegen: de prognose als laatste, alleen als er een is (027)',
     R.weergaven('d').join() === 'standard,xmr,range,regressie,regressieXmr,prognose' && R.weergaven('w').join() === 'standard,range,regressie,prognose');
  R.zetPrognose(false, 'prognose');
  ok('vegen: sta je op de prognose en is er geen meer, dan blijft hij in de rij (geen sprong) (027)', R.weergaven('d').slice(-1)[0] === 'prognose');
  R.zetPrognose(false);
  ok('XmR-varianten alleen per dag en per meting; daarbuiten de gewone (027)',
     R.effectief('w', 'regressieXmr').join('|') === 'regressie|{"xmr":false}' && R.effectief('d', 'regressieXmr').join('|') === 'regressieXmr|{"xmr":true}' &&
     R.effectief('m', 'xmr')[0] === 'standard' && R.effectief('d', 'prognose').join('|') === 'prognose|{"neutraal":true}' && R.effectief('d', 'standard')[1] === 'null');
  {
    /* 027: is de trend echt? Bekende uitkomst: x 1..5, y 2,4,5,4,5: se(b) = 0.8944/sqrt(10) = 0.2828, t(3) = 3.182 */
    const h = R.berekenRegressie([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
    ok('helling met marge: t(3) x standaardfout, en 0,6 ligt binnen 0,90 dus niet aantoonbaar (027)',
       Math.abs(h.marge - 3.182*0.894427/Math.sqrt(10)) < 1e-4 && h.aantoonbaar === false, h.marge.toFixed(4));
    const veel = R.berekenRegressie([...Array(30).keys()], [...Array(30).keys()].map(i => 80 - 0.1*i + [0.2, -0.1, 0.1, -0.2, 0][i % 5]));
    ok('een duidelijke daling over 30 punten is aantoonbaar (027)', veel.aantoonbaar === true && veel.helling < 0);
    ok('t-waarden: klein aantal ruimer, groot aantal 1,96, onzin oneindig (027)',
       R.tWaarde(1) === 12.706 && R.tWaarde(11) === 2.228 && R.tWaarde(29) === 2.060 && R.tWaarde(500) === 1.98 && R.tWaarde(0) === Infinity);
  }
  {
    /* 027: XmR rond de lijn */
    const d0 = (i) => new Date(Date.UTC(2026, 0, 1 + i));
    const rech = [...Array(30).keys()].map(i => ({date: d0(i), value: 90 - 0.3*i + [0.05, -0.05][i % 2]}));
    const g3 = R.regressieVoor(rech, null, 'd');
    ok('r̄ rond de lijn: de gemiddelde sprong in de afstand tot de lijn (027)', Math.abs(g3.rBar - 0.1) < 0.002, g3.rBar);
    const gx = R.grenzenRondLijn(g3, true), gs = R.grenzenRondLijn(g3, false);
    ok('XmR-grenzen 2,66 en 1,77 x r̄, σ-grenzen 3 en 2 x σ (027)',
       bijna(gx.rood, 2.66*g3.rBar) && bijna(gx.oranje, 1.77*g3.rBar) && bijna(gs.rood, 3*g3.sRes) && bijna(gs.oranje, 2*g3.sRes));
    ok('kleur met XmR-grenzen (027)', R.kleurBijLijn(2.7*g3.rBar, g3, 30, true) === 'rood' && R.kleurBijLijn(2*g3.rBar, g3, 30, true) === 'oranje' && R.kleurBijLijn(g3.rBar, g3, 30, true) === '');
    /* prognose */
    const pr = R.prognoseVoor(g3, 80);
    ok('prognose: de dag waarop de lijn het doel raakt, naar boven afgerond (027)', pr && (pr - d0(0))/864e5 === Math.ceil((80 - g3.snijpunt)/g3.helling), pr && pr.toISOString());
    ok('geen prognose als het doel achter je ligt, de lijn er vanaf loopt of er geen doel is (027)',
       R.prognoseVoor(g3, 95) === null && R.prognoseVoor(g3, 85) === null && R.prognoseVoor(g3, null) === null);
    R.zetVandaag(new Date(pr.getTime() + 864e5));
    ok('geen prognose als die dag al voorbij is (je mat een tijd niet) (029)', R.prognoseVoor(g3, 80) === null);
    R.zetVandaag(new Date(pr.getTime() - 864e5));
    ok('de dag ervoor nog wel (029)', R.prognoseVoor(g3, 80) !== null);
    R.zetVandaag(new Date(Date.UTC(2025, 11, 1)));
    const recht = R.regressieVoor([...Array(20).keys()].map(i => ({date: d0(i), value: 12345.6 + 43.7*i})), null, 'd');
    ok('een volkomen rechte lijn: geen spreiding, dus geen kleuren, ook niet met XmR (029)',
       recht.sRes === 0 && recht.rBar === 0 && R.kleurBijLijn(1e-9, recht, 20, true) === null);
    const traag = {hellingPer: 0.004, aantoonbaar: true, eenheid: 'wk'};
    ok('een aantoonbare helling die afgerond nul is, krijgt meer decimalen (029)',
       R.hellingTekst(traag, 1) === '+0.004/wk' && R.hellingPijl(traag, 1) === '↗' && R.hellingTekst(Object.assign({}, traag, {aantoonbaar: false}), 1) === '0.0/wk');
    const vlak = R.berekenRegressie([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
    ok('geen prognose bij een trend die niet aantoonbaar is (027)', R.prognoseVoor(Object.assign(vlak, {xEind: 5, datumEind: d0(5), t0: d0(1).getTime(), perGroep: false}), 50) === null);
    const slots = [...Array(12).keys()].map(i => ({date: new Date(Date.UTC(2026, i, 1))}));
    const mnd = slots.map((s0, i) => ({date: s0.date, value: 100 - 2*i + [0.3, -0.3][i % 2]}));
    const gm = R.regressieVoor(mnd, slots, 'm');
    const pm = R.prognoseVoor(gm, 70);
    ok('prognose per maand: vanaf de laatste maand met de gemiddelde maandlengte (027)',
       pm && pm.getTime() === Math.ceil((slots[11].date.getTime() + ((70 - gm.snijpunt)/gm.helling - 11)*30.44*864e5)/864e5)*864e5);
  }
  ok('beide veegplekken gebruiken die volgorde (026)', (SCRIPT.match(/const carousel = grafiekWeergaven\(\);/g) || []).length === 2);
  ok('de regressie alleen in de trendweergaven, of bij een doel voor de prognose (026, 027)',
     /const regressie = \(isTrend \|\| src\?\.doel_x != null\) \? regressieVoor\(/.test(SCRIPT));
  ok('trendkaart: geen grenzen rond het gemiddelde, wel grenzen op 2σ en 3σ rond de lijn (026)',
     /if\(mean!==null && !isRegressie\)\{/.test(haal('drawChart')) &&
     /const g = grenzenRondLijn\(regressie, regressie\.xmr\);/.test(haal('drawChart')) &&
     /\[\[g\.rood,'#ef5b5b'\],\[g\.oranje,'#f0a84f'\],\[-g\.oranje,'#f0a84f'\],\[-g\.rood,'#ef5b5b'\]\]/.test(haal('drawChart')) &&
     /regressie\.lijnBegin \+ k\)/.test(haal('drawChart')) && /regressie\.lijnEind \+ k\)/.test(haal('drawChart')));
  {
    /* twintig dagen op een lijn met kleine schommelingen, en één uitschieter */
    const pt = [0, 0.1, -0.1, 0.05, -0.05, 0.1, -0.1, 0, 0.05, -0.05, 0.1, -0.1, 0.05, 0, -0.05, 0.1, -0.1, 0.05, -0.05, 0].map((e, i) => ({date: d('2026-10-' + String(i + 1).padStart(2, '0')), value: 90 - i + e}));
    const kl = R.regressieKleuren(pt, null, 'd');
    ok('trendkaart: een steile trend zonder uitschieter kleurt niets, ook niet het begin en eind (026)', kl.every(k => k === 'var(--text)'), kl.join());
    const met = pt.map((p, i) => i === 6 ? {date: p.date, value: p.value + 1.5} : p);
    const kl2 = R.regressieKleuren(met, null, 'd');
    ok('trendkaart: de uitschieter ten opzichte van de lijn wordt rood, de rest niet (026)',
       kl2[6] === 'var(--danger)' && kl2.filter(k => k === 'var(--danger)').length === 1, kl2.join());
    const reg = R.regressieVoor(met, null, 'd');
    ok('trendkaart: grenzen pas vanaf 5 punten (026)',
       R.kleurBijLijn(0, reg, 4) === null && R.kleurBijLijn(0, reg, 5) === '' &&
       R.kleurBijLijn(3.01*reg.sRes, reg, 5) === 'rood' && R.kleurBijLijn(2.01*reg.sRes, reg, 5) === 'oranje');
    ok('trendkaart: punten in de grafiek en rijen in de tabel volgen dezelfde regel (026)',
       /kleurBijLijn\(Math\.abs\(p\.value - regressie\.verwacht\[i\]\), regressie, points\.length, regressie\.xmr\)/.test(haal('drawChart')) &&
       /regressieKleuren\(/.test(SCRIPT.slice(SCRIPT.indexOf('const pChartMode'))));
  }
  ok('lijn, label en waarden in de eigen paarse kleur, niet die van het doel (026)',
     R.KLEUR === '#d19ac0' && R.KLEUR !== '#b48ef0' && /ctx\.strokeStyle = REGRESSIE_KLEUR;/.test(haal('drawChart')));
}

/* ---------- 5. sleutelkeuring en normalisatie ---------- */
kop('5. Datavalidatie');
{
  ok('geldig: zonder D', geldigeSleutel('20260101'));
  ok('geldig: met D en tijd', geldigeSleutel('D20260101T1430'));
  ok('geldig: schrikkeldag', geldigeSleutel('D20240229'));
  ok('geweigerd: maand 13', !geldigeSleutel('D20261345'));
  ok('geweigerd: 29-02 in gewoon jaar', !geldigeSleutel('D20270229'));
  ok('geweigerd: 31 april', !geldigeSleutel('D20260431'));
  ok('geweigerd: uur 25', !geldigeSleutel('D20260101T2500'));
  ok('geweigerd: minuut 60', !geldigeSleutel('D20260101T2360'));
  ok('geweigerd: HTML-injectie in sleutel', !geldigeSleutel('D20260101" onmouseover="x'));
  ok('geweigerd: __proto__', !geldigeSleutel('__proto__'));

  const gemengd = JSON.parse('{"20260101":80,"D20260102":81,"__proto__":9,"Dkapot":7,"D20260103T0900":82}');
  const n = normalizeDataKeys(dataFileObj(gemengd), {meerdere_metingen: true});
  ok('alles krijgt D en een tijd', Object.keys(n.data).every(k => /^D\d{8}T\d{4}$/.test(k)), Object.keys(n.data).join(' '));
  ok('onzin geweigerd en geteld', n.geweigerd.length === 1 && n.geweigerd[0] === 'Dkapot');
  ok('prototype blijft schoon', ({}).polluted === undefined && Object.keys(n.data).length === 3);

  ok('alleen getallen als waarde', Object.keys(dataFileObj({'D20260101T1200':'80','D20260102T1200':{},'D20260103T1200':83})).length === 1);
  ok('leeg bestand geeft leeg resultaat', Object.keys(normalizeDataKeys(dataFileObj({}), {}).data).length === 0);

  const bots = normalizeDataKeys(dataFileObj({'D20260101':1, 'D20260101T1200':2}), {meerdere_metingen: true});
  ok('dubbele dag: expliciete tijd wint, botsing gemeld',
     bots.data['D20260101T1200'] === 2 && bots.dropped.length === 1);
}

/* ---------- 6. een meting: het bestand is de tabel plus jouw wijziging ---------- */
kop('6. Een meting: het bestand is de tabel plus jouw wijziging');
{
  /* Sinds 1352898-020 schrijft alleen Trends in de bestanden. Opslaan leest of
     vergelijkt het bestand dus niet: het schrijft de tabel met deze ene wijziging
     erin. Een meting komt pas in de tabel als hij in het bestand staat. Alleen als
     de tabel het bestand niet volledig weergeeft (tabelIsVolledig), leest Trends het
     bestand eerst; lukt dat niet, dan wordt er niets opgeslagen. */
  const env = {bestand: {D20261001T1200: 80, D20261002T1200: 81}, faalt: false, toegang: true, geschreven: 0, wacht: 0,
               meer: true, kapot: false, gelezen: 0};
  const t = new Function('env', [
    /* een tabel die niet uit het bestand komt (niet in __volledigeTabel) */
    'let dataCache = {b: {D20261001T1200: 80}};',
    'const dirHandle = {}; const dataVersion = {}; const derivedCache = new Map();',
    'const console = {error(){}};',
    'function getSource(){ return {bestand:"B.json", titel:"Bron B", meerdere_metingen:env.meer}; }',
    'async function zorgVoorToegang(){ return env.toegang; }',
    'async function readJsonFromDir(){ env.gelezen++; if(env.kapot) throw new SyntaxError("komma"); return env.bestand === null ? null : JSON.parse(JSON.stringify(env.bestand)); }',
    'async function writeJsonToDir(naam, obj){ if(env.wacht) await new Promise(r => setTimeout(r, env.wacht)); if(env.faalt) throw new Error("geen ruimte"); env.geschreven++; env.bestand = JSON.parse(JSON.stringify(obj)); }',
    haal('geldigeSleutel'), haal('normalizeDataKeys'), haal('dataFileObj'),
    haal('bumpDataVersion'), haal('dateToKey'), haal('keyToDate'), haal('keysForSameDay'),
    'const __volledigeTabel = new WeakSet();',
    haal('tabelIsVolledig'),
    'const __restVan = new WeakMap();', haal('restVanBestand'), haal('bestandsInhoud'),
    'let __metingBezig = false;',
    haal('slaMetingOp'),
    'return {slaMetingOp, cache: () => dataCache.b, vergeet: () => { dataCache.b = {...dataCache.b}; }};'
  ].join('\n'))(env);
  const gesorteerd = (o) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  const gelijk = () => gesorteerd(t.cache()) === gesorteerd(env.bestand);
  const zet = (k, v) => ({weg: [], zet: {[k]: v}, hoofd: k});

  (async () => {
    let r = await t.slaMetingOp('b', zet('D20261003T1200', 91));
    ok('een tabel die niet uit het bestand komt: eerst het bestand lezen', env.gelezen === 1);
    ok('dan staat de meting erbij, en blijft wat er al stond', r.ok === true && env.bestand.D20261003T1200 === 91 && env.bestand.D20261002T1200 === 81);
    ok('en de tabel is het bestand', gelijk());

    r = await t.slaMetingOp('b', zet('D20261004T1200', 92));
    ok('daarna leest opslaan het bestand niet meer', r.ok === true && env.gelezen === 1);
    ok('het bestand is de tabel plus de nieuwe meting', gelijk() && env.bestand.D20261004T1200 === 92);

    env.bestand.D20261005T1200 = 70;   // buiten Trends om: wordt niet meer bewaakt
    r = await t.slaMetingOp('b', zet('D20261006T1200', 93));
    ok('een wijziging buiten Trends om wordt bij het volgende opslaan overschreven (bewuste keuze)',
       r.ok === true && !('D20261005T1200' in env.bestand) && gelijk() && env.gelezen === 1);

    env.faalt = true;
    r = await t.slaMetingOp('b', zet('D20261007T1200', 94));
    ok('mislukt het schrijven, dan komt mislukt terug', r.fout === 'mislukt');
    ok('en komt de waarde niet in de tabel', !('D20261007T1200' in t.cache()));
    env.faalt = false;
    r = await t.slaMetingOp('b', zet('D20261007T1200', 94));
    ok('daarna lukt het, nog steeds zonder te lezen', r.ok === true && env.gelezen === 1 && gelijk());

    r = await t.slaMetingOp('b', {weg: ['D20261007T1200'], zet: {D20261008T1200: 95}, hoofd: 'D20261008T1200'});
    ok('een andere datum: oude sleutel weg, nieuwe erbij',
       r.ok === true && !('D20261007T1200' in env.bestand) && env.bestand.D20261008T1200 === 95);

    r = await t.slaMetingOp('b', {weg: ['D20261008T1200'], zet: {}, hoofd: 'D20261008T1200'});
    ok('verwijderen haalt hem uit het bestand', r.ok === true && !('D20261008T1200' in env.bestand) && gelijk());

    env.toegang = false;
    r = await t.slaMetingOp('b', zet('D20261009T1200', 96));
    ok('zonder toegang: toegang, en niets in de tabel of het bestand', r.fout === 'toegang' && !('D20261009T1200' in t.cache()) && !('D20261009T1200' in env.bestand));
    env.toegang = true;

    env.wacht = 20;
    const [r1, r2] = await Promise.all([t.slaMetingOp('b', zet('D20261010T1200', 1)), t.slaMetingOp('b', zet('D20261011T1200', 2))]);
    ok('een tweede opslag tegelijk wordt geweigerd', r1.ok === true && r2.fout === 'bezig');
    env.wacht = 0;
    r = await t.slaMetingOp('b', zet('D20261011T1200', 2));
    ok('en daarna kan het weer', r.ok === true);

    /* de tabel is vervangen (bijvoorbeeld: zonder leeskopie, of na een fout bij het lezen) */
    const voorK = env.geschreven, voorBestand = JSON.stringify(env.bestand);
    t.vergeet(); env.kapot = true;
    r = await t.slaMetingOp('b', zet('D20261012T1200', 4));
    ok('een tabel die het bestand niet weergeeft en een kapot bestand: kapot, niets geschreven',
       r.fout === 'kapot' && env.geschreven === voorK && JSON.stringify(env.bestand) === voorBestand);
    env.kapot = false;
    const gelezenVoor = env.gelezen;
    r = await t.slaMetingOp('b', zet('D20261012T1200', 4));
    ok('is het bestand weer leesbaar, dan eerst lezen en dan opslaan',
       r.ok === true && env.gelezen === gelezenVoor + 1 && env.bestand.D20261001T1200 === 80 && env.bestand.D20261012T1200 === 4);

    /* een bron waarvan het bestand nog niet bestaat */
    t.vergeet(); env.bestand = null;
    r = await t.slaMetingOp('b', zet('D20261013T1200', 5));
    ok('nog geen bestand: het wordt gemaakt met deze meting', r.ok === true && JSON.stringify(env.bestand) === JSON.stringify({D20261013T1200: 5}));

    /* één waarde per dag */
    env.meer = false;
    t.vergeet(); env.bestand = {D20261018: 80, D20261019T0700: 70};
    r = await t.slaMetingOp('b', zet('D20261019', 79));
    /* 1352898-015: zonder meer metingen per dag wordt een dag met één meting met tijd
       weer een gewone dag (D20261019) */
    ok('één waarde per dag: de andere meting op die dag gaat weg', r.ok === true &&
       env.bestand.D20261019 === 79 && !('D20261019T0700' in env.bestand) && env.bestand.D20261018 === 80);
    env.meer = true;

    vervolg();
  })().catch((e) => {
    /* Valt deze groep om, dan tellen we dat als mislukte controle en gaan we
       door met de groepen erna: die hebben er niets mee te maken. */
    fout++;
    console.log('  FOUT groep 6 viel om  — ' + ((e && e.message) || e));
    vervolg();
  });
}

function vervolg(){
/* ---------- 7. mislukte back-up ---------- */
kop('7. Mislukte back-up');
{
  const env = {idb: new Map(), bestanden: new Map([['B.json', 'oud']]), faalt: true, meldingen: []};
  const dirHandle = {
    async getFileHandle(name, opts){
      if (name.includes('_backup')) {
        if (env.faalt) throw Object.assign(new Error('vol'), {name: 'QuotaExceededError'});
        return {async createWritable(){ return {async write(t){ env.bestanden.set(name, t); }, async close(){}}; }};
      }
      if (!env.bestanden.has(name)) throw Object.assign(new Error('weg'), {name: 'NotFoundError'});
      return {async getFile(){ return {async text(){ return env.bestanden.get(name); }}; }};
    }
  };
  const t = new Function('env', 'dirHandle', [
    /* dateToKey is hier een stub met een vaste dag, zodat 'een back-up per dag'
       te toetsen is; todayUTCDate komt echt uit de app, want die werd
       aangeroepen en ontbrak -- daarop viel groep 7 om. */
    'function dateToKey(){ return "20261009"; }',
    haal('todayUTCDate'),
    'function backupFilename(n){ const d=n.lastIndexOf("."); return n.slice(0,d)+"_backup"+n.slice(d); }',
    'async function idbGet(k){ return env.idb.get(k) ?? null; }',
    'async function idbSet(k,v){ env.idb.set(k,v); }',
    'function showAlert(m){ env.meldingen.push(m); }',
    'const __backupGemeld = new Set();',
    haal('maybeBackupFile'),
    'return { maybeBackupFile };'
  ].join('\n'))(env, dirHandle);

  t.maybeBackupFile('B.json').then(async () => {
    ok('mislukking wordt gemeld', env.meldingen.length === 1);
    ok('dag NIET afgevinkt na mislukking', !env.idb.get('backup:B.json'));
    env.faalt = false;
    await t.maybeBackupFile('B.json');
    ok('tweede poging maakt de kopie alsnog', env.bestanden.get('B_backup.json') === 'oud');
    ok('nu pas afgevinkt', env.idb.get('backup:B.json') === '20261009');
    env.bestanden.set('B.json', 'nieuw');
    await t.maybeBackupFile('B.json');
    ok('één back-up per dag', env.bestanden.get('B_backup.json') === 'oud');
    deel8();
  });
}
}

function deel8(){
/* ---------- 8. opslaan raakt het bestand alleen om te schrijven ---------- */
kop('8. Opslaan raakt het bestand alleen om te schrijven');
{
  /* Tot 019 las writeJsonToDir vóór het schrijven de stempel van het bestand, en
     erna nog eens (vier à vijf keer het bestand opzoeken per opslag, op een telefoon
     merkbaar). Sinds 1352898-020: alleen schrijven (de back-up staat hier uit). */
  const env = {schijf: new Map(), opgezocht: 0, gelezen: 0};
  const dirHandle = {
    async getFileHandle(name, opts){
      env.opgezocht++;
      if (!env.schijf.has(name)) {
        if (!opts || !opts.create) throw Object.assign(new Error('weg'), {name: 'NotFoundError'});
        env.schijf.set(name, '');
      }
      return {
        async getFile(){ env.gelezen++; return {lastModified: 1, size: env.schijf.get(name).length, async text(){ return env.schijf.get(name); }}; },
        async createWritable(){ return {async write(t){ env.schijf.set(name, t); }, async close(){}}; }
      };
    }
  };
  const t = new Function('env', 'dirHandle', [
    'let __pendingWrites = 0; const __writeChain = new Map();',
    'async function maybeBackupFile(){}',
    'async function writeHandleJson(h,o){ const w=await h.createWritable(); await w.write(JSON.stringify(o)); await w.close(); }',
    'let leesKopieModus = false; const __zonderKopie = new Set();',
    'async function bewaarKopieVan(){} async function zorgVoorToegang(){ return true; } async function idbDelete(){} async function idbGet(){ return null; } async function idbSet(){}',
    haal('readJsonFromDir'), haal('writeJsonToDir'),
    'return { readJsonFromDir, writeJsonToDir };'
  ].join('\n'))(env, dirHandle);

  (async () => {
    env.schijf.set('B.json', '{"a":1}');
    await t.readJsonFromDir('B.json');
    env.schijf.set('B.json', '{"b":2}');   // buiten Trends om
    env.opgezocht = 0; env.gelezen = 0;
    let fout = null;
    try { await t.writeJsonToDir('B.json', {c: 3}); } catch (e) { fout = e; }
    ok('schrijven gelukt, ook na een wijziging buiten Trends om', !fout && env.schijf.get('B.json') === '{"c":3}', fout && fout.name);
    ok('het bestand één keer opgezocht en niet gelezen', env.opgezocht === 1 && env.gelezen === 0, env.opgezocht + ' opgezocht, ' + env.gelezen + ' gelezen');
    await t.writeJsonToDir('B.json', {c: 4});
    ok('nog eens schrijven: hetzelfde', env.schijf.get('B.json') === '{"c":4}' && env.opgezocht === 2 && env.gelezen === 0);
    deel9();
  })();
}
}

function deel9(){
/* ---------- 9. service worker ---------- */
kop('9. Cache-isolatie, offline en externe verzoeken (sw-trends.js)');
{
  const {ORIGIN, store, caches, handlers, maakSw} = swOmgeving();
  store.set('golf-score-v3', new Map([[ORIGIN + '/golf/golf.html', 'golf']]));
  store.set('events-v2', new Map([[ORIGIN + '/events/events.html', 'events']]));
  store.set('trends-v1', new Map([[ORIGIN + '/trends.html', 'heel oud']]));
  maakSw();
  const huidige = CACHE_NAAM;

  (async () => {
    let p; handlers.install[0]({waitUntil: x => p = x}); await p;
    let q; handlers.activate[0]({waitUntil: x => q = x}); await q;
    const over = [...store.keys()];
    ok('andere apps blijven staan', over.includes('golf-score-v3') && over.includes('events-v2'));
    ok('oude Trends-cache opgeruimd', !over.includes('trends-v1'));
    ok('nieuwe Trends-cache aanwezig', over.includes(huidige), huidige);
    ok('cachenaam begint met trends-', huidige.startsWith('trends-'));

    for (const url of [ORIGIN + '/trends.html', 'https://cdn.example.com/x.js']) {
      let a = null;
      handlers.fetch[0]({request: {method: 'GET', url}, respondWith: x => a = x, waitUntil(){}});
      if (a) await a;
    }
    const inCache = [...store.get(huidige).keys()];
    ok('extern verzoek niet gecachet', !inCache.some(u => String(u).includes('cdn.example.com')));
    const offline = await (await caches.open(huidige)).match('./trends.html');
    ok('Trends offline beschikbaar', !!offline);
    ok('cache andere app ongemoeid', !!(await (await caches.open('golf-score-v3')).match(ORIGIN + '/golf/golf.html')));
    deel10();
  })();
}
}

function deel10(){
/* ---------- 10. grote datasets ---------- */
kop('10. Grote datasets — verwerkingstijd en geheugen');
{
  const ms = f => { const t = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
  const maak = n => {
    const d = {}; const start = Date.UTC(2000, 0, 1);
    for (let i = 0; i < n; i++) {
      const dt = new Date(start + Math.floor(i / 3) * 86400000);
      d['D' + dateToKey(dt) + 'T' + String(6 + (i % 3) * 6).padStart(2, '0') + '00'] = 80 + Math.random() * 4;
    }
    return d;
  };
  console.log('       n   normaliseren   platte lijst   dagaggregatie   totaal   per meting');
  const tijden = [];
  for (const n of [1000, 10000, 100000]) {
    const raw = maak(n);
    const [t1, norm] = ms(() => normalizeDataKeys(dataFileObj(raw), {meerdere_metingen: true}).data);
    const [t2, flat] = ms(() => getFlatEntries(norm));
    const [t3] = ms(() => getDailyFromFlat(flat));
    const totaal = t1 + t2 + t3;
    tijden.push(totaal / n);
    console.log('  ' + String(n).padStart(6) + t1.toFixed(0).padStart(13) + ' ms' +
                t2.toFixed(0).padStart(12) + ' ms' + t3.toFixed(0).padStart(13) + ' ms' +
                totaal.toFixed(0).padStart(8) + ' ms' + (totaal / n * 1000).toFixed(1).padStart(10) + ' µs');
  }
  // bij O(n log n) blijft de tijd per meting ongeveer gelijk; bij O(n²) zou die sterk oplopen
  const factor = tijden[2] / tijden[0];
  ok('schaalt niet kwadratisch (tijd per meting blijft vergelijkbaar)', factor < 5, 'factor ' + factor.toFixed(1) + '× van 1k naar 100k');
  const mb = (process.memoryUsage().heapUsed / 1048576).toFixed(0);
  console.log('  geheugen na 100.000 metingen: ~' + mb + ' MB heap');

  deel11();
}
}

function deel11(){
/* ---------- 11. updatemelding en herladen ---------- */
kop('11. Updatemelding en herladen');
(async ()=>{
  // de beslissing om te waarschuwen voor herladen
  {
    let herladen = 0, gevraagd = null, antwoord = true;
    const location = {reload: ()=>{ herladen++; }};
    const showConfirm = (msg)=>{ gevraagd = msg; return Promise.resolve(antwoord); };
    let __pendingWrites = 0;
    let __herladen = false;
    let __swRegistratie = null;
    let berichten = [], controllerLuisteraars = [];
    const navigator = {serviceWorker: {addEventListener: (t, f)=>{ controllerLuisteraars.push([t, f]); }}};
    /* De echte setTimeout, want wachtOpSchrijfacties polst daarmee; met een
       lege stub zou die belofte nooit uitkomen en bleef de groep hangen. De
       wachttijd gaat hier wel omlaag van 10 s naar 40 ms: het gaat om het
       mechanisme, niet om het getal. */
    const HERLAAD_WACHT = 40;
    let gemeld = null;
    const showAlert = (m)=>{ gemeld = m; };
    eval(haal('wachtOpSchrijfacties'));
    eval(haal('herlaadNu'));
    eval(haal('herlaadMetWachtendeWorker'));
    eval(haal('herlaadVoorUpdate'));
    const opnieuw = ()=>{ __herladen = false; };

    await herlaadVoorUpdate();
    ok('niets open: herladen zonder vraag', herladen === 1 && gemeld === null);

    /* De kern van de huidige werkwijze: een schrijfactie die binnen de wachttijd
       klaar is, wordt afgewacht en daarna wordt er gewoon herladen -- zonder de
       gebruiker iets te vragen. Met de oude "mag dit sneuvelen?"-vraag zou hier
       een vraag staan. */
    opnieuw(); __pendingWrites = 1; gemeld = null;
    const bijna_klaar = herlaadVoorUpdate();
    setTimeout(()=>{ __pendingWrites = 0; }, 5);
    await bijna_klaar;
    ok('een schrijfactie die klaarkomt wordt afgewacht, en dan wordt er herladen',
       herladen === 2 && gemeld === null, 'herladen ' + herladen);

    /* Komt de schrijfactie niet klaar -- bijvoorbeeld omdat er binnen de
       schrijfactie een conflictvraag openstaat -- dan gebeurt er NIETS en komt
       er een melding. De updatebalk blijft staan, dus herladen kan daarna
       alsnog; er sneuvelt niets. */
    opnieuw(); __pendingWrites = 1; gemeld = null;
    await herlaadVoorUpdate();
    ok('een schrijfactie die blijft hangen: niet herladen', herladen === 2);
    ok('en dat wordt gemeld', /nog opgeslagen/.test(gemeld || ''), gemeld);
    ok('er is niets gevraagd: de app wacht in plaats van te vragen', gevraagd === null);

    /* Er is geen test meer voor "niet opgeslagen bij herladen": een mislukte
       schrijfactie wordt teruggedraaid, dus zo'n wijziging bestaat niet meer. */
    opnieuw(); __pendingWrites = 0; antwoord = true; gevraagd = null; gemeld = null;
    await herlaadVoorUpdate();
    ok('niets open: herladen zonder vraag, ook na een eerdere mislukking',
       gevraagd === null && gemeld === null);

    /* Met een wachtende worker mag er niet meteen worden herladen: de oude worker
       beheert de pagina nog en zou dezelfde versie opnieuw leveren. */
    opnieuw(); herladen = 0; berichten = []; controllerLuisteraars = [];
    __swRegistratie = {waiting: {postMessage: (m)=>berichten.push(m)}};
    await herlaadVoorUpdate();
    ok('wachtende worker: nog niet herladen', herladen === 0);
    ok('maar wel om overstappen gevraagd', berichten.length === 1 && berichten[0].type === 'nuOverstappen', JSON.stringify(berichten));
    ok('en er wordt op controllerchange gewacht', controllerLuisteraars.some(([t]) => t === 'controllerchange'));
    controllerLuisteraars.filter(([t]) => t === 'controllerchange').forEach(([, f]) => f());
    ok('na het overnemen wordt herladen', herladen === 1);
    controllerLuisteraars.filter(([t]) => t === 'controllerchange').forEach(([, f]) => f());
    ok('en niet twee keer', herladen === 1);

    // zonder wachtende worker is een gewone herlaadactie genoeg
    opnieuw(); herladen = 0; berichten = []; __swRegistratie = {waiting: null};
    await herlaadVoorUpdate();
    ok('geen wachtende worker: direct herladen', herladen === 1 && berichten.length === 0);
  }

  // afknijpen van registration.update()
  {
    let aangeroepen = 0;
    let __swUpdateLaatst = 0, __swRegistratie = null;
    const SW_UPDATE_INTERVAL = 30 * 60 * 1000;
    eval(haal('vraagSwUpdate'));
    ok('zonder registratie geen aanroep', vraagSwUpdate() === false && aangeroepen === 0);
    __swRegistratie = {update: ()=>{ aangeroepen++; return Promise.resolve(); }};
    ok('eerste aanroep gaat door', vraagSwUpdate() === true && aangeroepen === 1);
    ok('tweede aanroep direct erna wordt overgeslagen', vraagSwUpdate() === false && aangeroepen === 1);
    __swUpdateLaatst = Date.now() - SW_UPDATE_INTERVAL - 1;
    ok('na het interval mag het weer', vraagSwUpdate() === true && aangeroepen === 2);
    __swRegistratie = {update: ()=>Promise.reject(new Error('offline'))};
    __swUpdateLaatst = 0;
    ok('mislukte update werpt niet', vraagSwUpdate() === true);
  }

  // aanwezigheid in de bron: dit zijn geen gedragstests maar koppelingen die in de DOM liggen
  {
    ok('updatebalk reageert op het toetsenbord', /updateBar\.addEventListener\('keydown'/.test(SCRIPT));
    ok('Enter en spatie activeren de balk', /e\.key === 'Enter' \|\| e\.key === ' '/.test(SCRIPT));
    ok('visibilitychange vraagt een serviceworker-update', /vraagSwUpdate\(\);\s*\n\s*checkAppUpdate\(\);/.test(SCRIPT));
    ok('nieuwe versie geïnstalleerd = meteen melden of controleren',
       /updatefound/.test(SCRIPT) && /sw\.state !== 'installed'/.test(SCRIPT));
    ok('een wachtende versie is zelf al het bewijs', /if\(reg\.waiting\) toonUpdateBalk\(\); else checkAppUpdate\(\);/.test(SCRIPT));
    ok('een versie die uit een eerdere sessie wacht wordt ook gemeld', /if\(reg\.waiting\) toonUpdateBalk\(\);\n/.test(SCRIPT));
    ok('geen skipWaiting meer bij het installeren', !/self\.skipWaiting\(\);/.test(SW.split("addEventListener('message'")[0]));
    ok('skipWaiting alleen nog op verzoek van de app', /'nuOverstappen'\) self\.skipWaiting\(\)/.test(SW));
  }

  await deel12();
})();
}

/* ---------- 12. herstel uit back-up ---------- */
async function deel12(){
kop('12. Herstel uit back-up na een beschadigd bestand');

// Nagebootste werkmap: naam -> tekst. createWritable schrijft pas bij close(),
// net als de File System Access API zelf.
const maakMap = (bestanden, falend = null) => {
  const map = new Map(Object.entries(bestanden));
  return {
    map,
    getFileHandle: async (naam, opts) => {
      if (falend === naam) throw Object.assign(new Error('geen toegang'), {name:'NotAllowedError'});
      if (!map.has(naam) && !(opts && opts.create)) throw Object.assign(new Error('weg'), {name:'NotFoundError'});
      return {
        getFile: async () => ({text: async () => map.get(naam) || '', lastModified: Date.UTC(2026, 9, 7), size: (map.get(naam) || '').length}),
        createWritable: async () => { let buf = ''; return {write: async t => { buf += t; }, close: async () => { map.set(naam, buf); }}; }
      };
    }
  };
};

const omgeving = (bestanden, antwoord, falend) => {
  const ctx = {
    dirHandle: maakMap(bestanden, falend),
    dataCache: {}, dataFileExists: {},
    meldingen: [], vragen: [], idbSleutels: [], schrijfOrde: [],
  };
  ctx.getSource = () => ({id:'b1', titel:'Gewicht', bestand:'gewicht.json'});
  ctx.showConfirm = (m) => { ctx.vragen.push(m); return Promise.resolve(antwoord); };
  ctx.showAlert = (m) => { ctx.meldingen.push(m); };
  ctx.idbSet = async (k) => { ctx.idbSleutels.push(k); ctx.schrijfOrde.push('idb'); };
  ctx.bumpDataVersion = () => {};
  ctx.syncDataFile = async (id) => {
    ctx.schrijfOrde.push('schrijf');
    const h = await ctx.dirHandle.getFileHandle('gewicht.json', {create:true});
    const w = await h.createWritable();
    await w.write(JSON.stringify(dataFileObj(ctx.dataCache[id])));
    await w.close();
    return true;
  };
  /* todayUTCDate hoort hier echt bij: herstelUitBackup vinkt de dagelijkse
     back-up af met dateToKey(todayUTCDate()), en dat staat in een try/catch.
     Zonder deze functie wierp die regel een ReferenceError die de app zelf
     opslokte -- het afvinken gebeurde dan niet, en de controle daarop keek naar
     iets wat nooit was gebeurd. */
  const fn = new Function('ctx', 'normalizeDataKeys', 'dataFileObj', 'fmtDateNL', 'dateToKey', 'todayUTCDate', `
    const {dirHandle, dataCache, dataFileExists, getSource, showConfirm, showAlert, idbSet, bumpDataVersion, syncDataFile} = ctx;
    const __volledigeTabel = new WeakSet(); const __restVan = new WeakMap();
    ${haal('restVanBestand')}
    ${haal('backupFilename')}
    ${haal('beschadigdFilename')}
    ${haal('leesBackup')}
    ${haal('herstelUitBackup')}
    return herstelUitBackup;
  `);
  return {ctx, herstel: fn(ctx, normalizeDataKeys, dataFileObj, fmtDateNL, dateToKey, todayUTCDate)};
};

const GOED = JSON.stringify({D20261001T1200: 80, D20261002T1200: 81});
const KAPOT = '{"D20261001T1200": 80,';

{
  const {ctx, herstel} = omgeving({'gewicht.json': KAPOT}, true);
  const r = await herstel('b1');
  ok('geen back-up: niets gebeurt', r === null && ctx.vragen.length === 0 && ctx.dirHandle.map.get('gewicht.json') === KAPOT);
}
{
  const {ctx, herstel} = omgeving({'gewicht.json': KAPOT, 'gewicht_backup.json': KAPOT}, true);
  const r = await herstel('b1');
  ok('onleesbare back-up: niets gebeurt', r === null && ctx.vragen.length === 0 && ctx.dirHandle.map.get('gewicht.json') === KAPOT);
}
{
  const {ctx, herstel} = omgeving({'gewicht.json': KAPOT, 'gewicht_backup.json': GOED}, false);
  const r = await herstel('b1');
  ok('annuleren laat het bestand ongemoeid', r === null && ctx.dirHandle.map.get('gewicht.json') === KAPOT);
  ok('vraag noemt datum, aantal en de bewaarnaam',
     /07-10-2026/.test(ctx.vragen[0]) && /2 meting/.test(ctx.vragen[0]) && /gewicht_beschadigd\.json/.test(ctx.vragen[0]), ctx.vragen[0]);
}
{
  const {ctx, herstel} = omgeving({'gewicht.json': KAPOT, 'gewicht_backup.json': GOED}, true);
  const r = await herstel('b1');
  ok('terugzetten levert de metingen uit de back-up', r !== null && Object.keys(r).length === 2);
  ok('beschadigd bestand blijft bewaard', ctx.dirHandle.map.get('gewicht_beschadigd.json') === KAPOT);
  /* zonder meer metingen per dag: de dag zonder tijd (1352898-015) */
  ok('databestand is weer leesbaar', JSON.parse(ctx.dirHandle.map.get('gewicht.json')).D20261001 === 80);
  ok('back-up zelf blijft ongemoeid', ctx.dirHandle.map.get('gewicht_backup.json') === GOED);
  /* De tweede helft van deze controle keek naar dataFileExists, en die variabele
     komt in trends.html niet meer voor; die kon dus nooit meer kloppen. Wat
     ertoe doet is dat de teruggezette metingen in de app staan. */
  ok('de teruggezette metingen staan in de app', Object.keys(ctx.dataCache.b1).length === 2,
     Object.keys(ctx.dataCache.b1).join());
  ok('dagelijkse back-up afgevinkt vóór het schrijven',
     ctx.schrijfOrde.join('>') === 'idb>schrijf' && ctx.idbSleutels[0] === 'backup:gewicht.json', ctx.schrijfOrde.join('>'));
  ok('melding bevestigt het herstel', /teruggezet/.test(ctx.meldingen.join(' ')));
}
{
  // het beschadigde bestand kan niet worden weggezet -> er mag niets worden overschreven
  const {ctx, herstel} = omgeving({'gewicht.json': KAPOT, 'gewicht_backup.json': GOED}, true, 'gewicht_beschadigd.json');
  const r = await herstel('b1');
  ok('kan beschadigd bestand niet bewaren: niets overschreven',
     r === null && ctx.dirHandle.map.get('gewicht.json') === KAPOT && ctx.schrijfOrde.length === 0);
  ok('en dat wordt gemeld', /kon niet worden bewaard/.test(ctx.meldingen.join(' ')));
}
{
  ok('beschadigd bestand krijgt een eigen naam naast de back-up',
     /_beschadigd/.test(SCRIPT) && /herstelUitBackup/.test(SCRIPT));
  /* zonder toegang (leeskopie) kan er niets uit de back-up worden teruggezet */
  ok('beschadigd bestand wordt bij inlezen aangeboden',
     /if\(!leesKopieModus && await herstelUitBackup\(id\)\) return;/.test(SCRIPT));
}

await deel13();
}

/* ---------- 13. bronnen: toevoegen, wijzigen, verwijderen, wisselen ---------- */
async function deel13(){
kop('13. Bronnen toevoegen, wijzigen, verwijderen en wisselen');

// loadMetaFromDir leest de metadata in; render- en controlestappen worden hier afgevangen.
const leesMeta = async (json) => {
  const ctx = {bronnen: null, meldingen: []};
  const fn = new Function('ctx', 'slugify', `
    return (async ()=>{
      let bronnen = []; let bronnenVolledig = false; const __zonderKopie = new Set();
      let __metaRest = {}; const BRONVELDEN = []; const __bronnenSchrijven = Promise.resolve(); let __bronnenVersie = 0;
      const META_FILENAME = 'trends_meta.json';
      const readJsonFromDir = async ()=> ctx.json;
      const showAlert = m => ctx.meldingen.push(m);
      const renderSourceList = ()=>{}, renderSourceSelects = ()=>{}, validateBronnen = ()=>{};
      ${haal('getalVan')}
      ${haal('decimalenVan')}
      ${haal('loadMetaFromDir')}
      await loadMetaFromDir();
      ctx.bronnen = bronnen;
    })();
  `);
  ctx.json = json;
  await fn(ctx, eval('slugify'));
  return ctx;
};
eval(haal('slugify'));

/* derde review (1352898-015): trends.json met een verkeerde opbouw */
{
  let r = await leesMeta({bronnen: {gewicht: {titel: 'Gewicht'}}});
  ok('"bronnen" geen lijst: geen bronnen, en een melding', r.bronnen.length === 0 && /geen lijst/.test(r.meldingen.join(' ')), r.meldingen);
  r = await leesMeta({bronnen: [null, {titel: 'Gewicht', bestand: 'g.json'}, [1]]});
  ok('een element dat geen bron is: overgeslagen en gemeld, de rest blijft', r.bronnen.length === 1 && /2 bronnen overgeslagen/.test(r.meldingen.join(' ')), r.meldingen);
}

{
  const {bronnen} = await leesMeta({bronnen: [{titel:'Gewicht', bestand:'gewicht.json', eenheid:'kg'}]});
  ok('bron toevoegen: id uit de bestandsnaam', bronnen.length === 1 && bronnen[0].id === 'gewicht');
  ok('standaardwaarden gezet', bronnen[0].decimalen === 1 && bronnen[0].standaard_bereik === '1m' && bronnen[0].standaard_groepering === 'd');
  ok('schakelaars standaard uit', bronnen[0].duizendtal === false && bronnen[0].meerdere_metingen === false);
  ok('grafiek standaard aan', bronnen[0].toon_grafiek === true);
}
{
  const {bronnen} = await leesMeta({bronnen: [{titel:'x'.repeat(500), bestand:'a.json', eenheid:'y'.repeat(50), decimalen:99}]});
  ok('titel afgekapt op 200', bronnen[0].titel.length === 200);
  ok('eenheid afgekapt op 20', bronnen[0].eenheid.length === 20);
  ok('decimalen geklemd op 10', bronnen[0].decimalen === 10, bronnen[0].decimalen);
}
{
  const {bronnen} = await leesMeta({bronnen: [{titel:'a', bestand:'a.json', decimalen:-3}, {titel:'b', bestand:'b.json', decimalen:'onzin'}]});
  ok('negatieve decimalen worden 0', bronnen[0].decimalen === 0);
  ok('onleesbare decimalen worden 1', bronnen[1].decimalen === 1);
}
{
  const {bronnen} = await leesMeta([{titel:'Oud formaat', bestand:'o.json'}]);
  ok('platte lijst zonder bronnen-sleutel werkt nog', bronnen.length === 1 && bronnen[0].titel === 'Oud formaat');
}
{
  const {bronnen} = await leesMeta(null);
  ok('geen metadatabestand = geen bronnen, geen fout', Array.isArray(bronnen) && bronnen.length === 0);
}
{
  const {bronnen} = await leesMeta({bronnen: [{titel:'Mijn meting!', bestand:''}]});
  // slugify maakt eerst spaties tot _ en verwijdert daarna wat niet mag
  ok('bestandsnaam afgeleid als die leeg is', bronnen[0].bestand === 'Mijn_meting.json', bronnen[0].bestand);
}

// metaFileObj schrijft terug zonder de interne id
{
  let bronnen = [{id:'gewicht', titel:'Gewicht', bestand:'gewicht.json', decimalen:1}];
  let __metaRest = {extra: {}, perBron: new Map(), overgeslagen: []};
  eval(haal('metaFileObj'));
  const uit = metaFileObj();
  ok('id gaat niet mee naar het bestand', uit.bronnen[0].id === undefined && uit.bronnen[0].titel === 'Gewicht');
  ok('bestand houdt de bronnen-sleutel', Array.isArray(uit.bronnen));
}

// de bronnenlijst: bronnen verandert pas als het bestand is geschreven
{
  const env = {faalt: false, geschreven: []};
  const m = new Function('env', [
    'let bronnen = [{id:"a", titel:"Bron A", bestand:"a.json"}];',
    'let bronnenVolledig = true;',
    'const META_FILENAME = "trends_meta.json";',
    'const dirHandle = {name: "Map"};',
    'const console = {error(){}};',
    'function metaFileObj(l){ return {bronnen: l || bronnen}; }',
    'function setFileLinkUI(){} function toonKopieStand(){}',
    'async function writeJsonToDir(n, obj){ if(env.faalt) throw new Error("geen ruimte"); env.geschreven.push(obj); }',
    'let __bronnenSchrijven = Promise.resolve(); let __bronnenVersie = 0;',
    haal('schrijfBronnen'), haal('schrijfBronnenNu'),
    'return {schrijfBronnen, lijst: ()=>bronnen, onvolledig: () => { bronnenVolledig = false; }};'
  ].join('\n'))(env);

  await (async () => {
    env.faalt = true;
    let r = await m.schrijfBronnen(l => l.concat([{id:'b', titel:'Bron B', bestand:'b.json'}]));
    ok('mislukt het schrijven, dan komt mislukt terug', r.fout === 'mislukt');
    ok('en verandert de lijst niet', m.lijst().length === 1);
    env.faalt = false;
    r = await m.schrijfBronnen(l => l.concat([{id:'b', titel:'Bron B', bestand:'b.json'}]));
    ok('gelukt: de nieuwe bron staat in het bestand en in de lijst', r.ok === true && env.geschreven.length === 1 && m.lijst().length === 2);
    /* 1352898-020: niet vanuit een lijst die het bestand niet volledig weergeeft */
    m.onvolledig();
    r = await m.schrijfBronnen(l => l.concat([{id:'c', titel:'Bron C', bestand:'c.json'}]));
    ok('een niet volledig ingelezen lijst: onvolledig, niets geschreven', r.fout === 'onvolledig' && env.geschreven.length === 1 && m.lijst().length === 2);
  })();
}

// de oude machinerie moet echt weg zijn, niet als dode bedrading achterblijven
{
  ok('__nietOpgeslagen bestaat niet meer', !/__nietOpgeslagen/.test(SCRIPT));
  ok('openstaandeSchrijfacties bestaat niet meer', !/openstaandeSchrijfacties/.test(SCRIPT));
  ok('afsluitwaarschuwing kijkt alleen naar lopende schrijfacties',
     /if\(__pendingWrites > 0\)\{ e\.preventDefault\(\); e\.returnValue = ''; \}/.test(SCRIPT));
  ok('syncDataFile meldt zelf niets meer', !/showAlert/.test(haal('syncDataFile')));
  ok('het terugdraaimechanisme is weg', !/beginMutatie|draaiMutatieTerug|bewaarMeting/.test(SCRIPT));
  const aanroepen = (SCRIPT.match(/voerMetingUit\(id, \{weg:/g) || []).length;
  ok('alle drie de opslagpaden gaan via het venster (voerMetingUit)', aanroepen === 3, aanroepen + ' aanroepen');
  ok('het venster sluit pas als het is opgeslagen',
     /if\(res\.ok\)\{ klaar\(\); return res; \}/.test(haal('voerMetingUit')) &&
     !/closeDatapointModal\(\);\s*\n\s*selectedDataKey = selectieVormVan\(newKey, src\);\s*\n\s*renderDataView\(true\);\s*\n\s*\/\/ op de achtergrond/.test(SCRIPT));
}

// wisselen van bron: afgeleide data per bron gescheiden
{
  const dataCache = {a: {D20260101T1200: 10}, b: {D20260101T1200: 99, D20260102T1200: 98}};
  const dataVersion = {}, derivedCache = new Map();
  eval(haal('getDerivedData'));
  const da = getDerivedData('a'), db = getDerivedData('b');
  ok('elke bron eigen afgeleide data', da.flat.length === 1 && db.flat.length === 2);
  ok('cache per bron apart bewaard', derivedCache.size === 2);
  ok('tweede aanroep komt uit de cache', getDerivedData('a') === da);
  dataVersion.a = 1;
  ok('versiewissel verveist de cache van die bron', getDerivedData('a') !== da && getDerivedData('b') === db);
}

// verwijderen ruimt alle sporen van de bron op
{
  /* Deze controle eiste 'delete dataFileExists[id];' binnen een venster van 120
     tekens achter delete dataCache[id]. Die variabele bestaat niet meer, en het
     venster brak bij elke regel ertussen. Nu op de functie zelf, per spoor dat
     opgeruimd hoort te worden -- de bumpDataVersion hoort erbij, want zonder die
     blijft de afgeleide cache van een verwijderde bron hergebruikt worden. */
  const wissen = haal('deleteSource');
  ok('verwijderen haalt de bron uit de metadata',
     /schrijfBronnen\(lijst => lijst\.some\(x=>x\.id===id\) \? lijst\.filter\(x=>x\.id!==id\) : null\)/.test(wissen));
  ok('en wist de metingen, de versie en de afgeleide cache',
     /delete dataCache\[id\];/.test(wissen) && /bumpDataVersion\(id\);/.test(wissen) &&
     /derivedCache\.delete\(id\);/.test(wissen));
  ok('verwijderen laat het gegevensbestand staan', /blijft ongewijzigd in de werkmap staan/.test(SCRIPT));
}

await deel14();
}

/* ---------- 14. opslaan en opnieuw inlezen ---------- */
async function deel14(){
kop('14. Opslaan en opnieuw inlezen (rondrit door het bestandsformaat)');
{
  const src = {meerdere_metingen: true};
  const rondrit = (data) => normalizeDataKeys(dataFileObj(JSON.parse(JSON.stringify(dataFileObj(data)))), src).data;

  const origineel = {D20260103T0800: 81.5, D20260101T1200: 80, D20260102T1800: -3.25};
  const terug = rondrit(origineel);
  ok('alle metingen komen terug', Object.keys(terug).length === 3);
  ok('waarden exact gelijk', terug.D20260101T1200 === 80 && terug.D20260103T0800 === 81.5 && terug.D20260102T1800 === -3.25);
  ok('sleutels gesorteerd opgeslagen', Object.keys(dataFileObj(origineel)).join() === 'D20260101T1200,D20260102T1800,D20260103T0800');

  const rommel = {D20260101T1200: 80, D20260102T1200: 'tekst', D20260103T1200: null, D20260104T1200: NaN, D20260105T1200: undefined};
  ok('niet-numerieke waarden verdwijnen bij opslaan', Object.keys(dataFileObj(rommel)).join() === 'D20260101T1200');

  const oud = {'20260101': 70, '20260102': 71};
  const gemigreerd = normalizeDataKeys(dataFileObj(oud), {meerdere_metingen: false}).data;
  ok('oude sleutels zonder D blijven leesbaar', Object.keys(gemigreerd).length === 2);
  ok('en worden naar de D-notatie omgezet', Object.keys(gemigreerd).every(k => k.startsWith('D')), Object.keys(gemigreerd).join());

  const tweedeRonde = rondrit(terug);
  ok('tweede rondrit verandert niets meer', JSON.stringify(dataFileObj(tweedeRonde)) === JSON.stringify(dataFileObj(terug)));

  const nul = rondrit({D20260101T1200: 0});
  ok('de waarde 0 blijft bewaard', nul.D20260101T1200 === 0);
}
await deel15();
}

/* ---------- 15. r-streep bij meerdere metingen per dag ---------- */
async function deel15(){
kop('15. Bewegende spreiding: dagweergave tegenover tijdweergave');
{
  const eenPerDag = {D20260101T1200: 10, D20260102T1200: 14, D20260103T1200: 11};
  const flat = getFlatEntries(eenPerDag);
  const daily = getDailyFromFlat(flat);
  const rFlat = computeRBar(flat.map(e => e.value));
  const rDaily = computeRBar(daily.map(d => d.value));
  ok('één meting per dag: beide paden gelijk', bijna(rFlat, rDaily), rFlat + ' / ' + rDaily);
  ok('en gelijk aan de handberekening', bijna(rFlat, (4 + 3) / 2), rFlat);

  const meerdere = {D20260101T0600: 8, D20260101T1800: 12, D20260102T0600: 20, D20260102T1800: 20};
  const fl = getFlatEntries(meerdere);
  const dg = getDailyFromFlat(fl);
  ok('dagwaarden zijn de gemiddelden', bijna(dg[0].value, 10) && bijna(dg[1].value, 20));
  ok('dagweergave: r-streep over de daggemiddelden', bijna(computeRBar(dg.map(d => d.value)), 10));
  ok('tijdweergave: r-streep over de losse metingen', bijna(computeRBar(fl.map(e => e.value)), (4 + 8 + 0) / 3));
  ok('de twee verschillen bewust en zijn beide stabiel',
     !bijna(computeRBar(dg.map(d => d.value)), computeRBar(fl.map(e => e.value))));

  ok('te weinig punten geeft geen r-streep', computeRBar([5]) === null && computeRBar([]) === null);
  ok('gelijke waarden geven r-streep 0', computeRBar([7, 7, 7]) === 0);
}
await deel16();
}

/* ---------- 16. XmR tegen een externe referentie ---------- */
async function deel16(){
kop('16. XmR-grenzen tegen een externe referentie');
/* Referentie: NCSS, "Individuals and Moving Range Charts", voorbeeld 1 (50 metingen).
   Daar gerapporteerd: middenlijn 46,26 — r-streep 9,448979 — UCL 71,39027 —
   LCL 21,12974 — UCL spreiding 30,8851 — LCL spreiding 0.
   De app rekent met de afgeronde constanten 2,66 en 3,267; NCSS met 3/d2 =
   2,659575 en D4 = 3,268626. Die tests leggen het verschil vast, zodat een
   wijziging van de constanten niet ongemerkt doorgaat. */
{
  const xBar = 46.26, rBar = 9.448979;
  const ucl = xBar + 2.66 * rBar;
  const lcl = xBar - 2.66 * rBar;
  const uwl = xBar + 1.77 * rBar;
  const uclR = 3.267 * rBar;

  ok('UCL individuen binnen 0,01 van de referentie', Math.abs(ucl - 71.39027) < 0.01, ucl.toFixed(5) + ' tegen 71.39027');
  ok('LCL individuen binnen 0,01 van de referentie', Math.abs(lcl - 21.12974) < 0.01, lcl.toFixed(5) + ' tegen 21.12974');
  /* NCSS deelt hier door 3,268617 in plaats van de gepubliceerde D4 = 3,267.
     Dat geeft bij deze r-streep 0,0153 verschil, oftewel 0,05%. De marge staat
     daarom op 0,02; valt hij erbuiten, dan is er echt iets aan de constante veranderd. */
  ok('UCL spreiding binnen 0,02 van de referentie', Math.abs(uclR - 30.8851) < 0.02, uclR.toFixed(5) + ' tegen 30.8851, verschil ' + Math.abs(uclR - 30.8851).toFixed(4));
  ok('3,267 is D4 = 1 + 3·d3/d2 met d2 = 1,128 en d3 = 0,8525',
     Math.abs(3.267 - (1 + 3 * 0.8525 / 1.128)) < 0.001, (1 + 3 * 0.8525 / 1.128).toFixed(6));
  ok('LCL spreiding staat vast op 0 (D3 = 0 bij n = 2)', /lcl = useRange \? 0 :/.test(SCRIPT));

  // de constanten zelf, tegen hun definitie met d2 = 1,128 voor n = 2
  ok('2,66 is 3/d2 op twee decimalen', Math.abs(2.66 - 3 / 1.128) < 0.005, (3 / 1.128).toFixed(6));
  ok('1,77 is 2/d2 op twee decimalen', Math.abs(1.77 - 2 / 1.128) < 0.005, (2 / 1.128).toFixed(6));
  ok('waarschuwingsgrens ligt op tweederde van de controlegrens', bijna((uwl - xBar) / (ucl - xBar), 1.77 / 2.66));

  // en de app gebruikt deze constanten ook werkelijk
  ok('app rekent met 2,66 en 1,77 in de XmR-modus', /mean \+ 2\.66\*rBar/.test(SCRIPT) && /mean \+ 1\.77\*rBar/.test(SCRIPT));
  ok('app rekent met 3,267 voor de spreidingskaart', /rBar\*3\.267/.test(SCRIPT));
  ok('sigma-modus gebruikt de steekproef-sd met n-1', /\(n-1\)/.test(haal('computeMeanSigma')));
}

deel17();
}

/* ---------- 17. toegankelijkheid en toetsenbordbediening ---------- */
function deel17(){
kop('17. Toegankelijkheid en toetsenbordbediening');

// labels aan velden gekoppeld, en elk doel bestaat echt
{
  const fors = [...HTML.matchAll(/<label for="([^"]+)"/g)].map(m => m[1]);
  const ids = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  ok('labels zijn aan een veld gekoppeld', fors.length >= 11, fors.length + ' labels');
  const wees = fors.filter(f => !ids.has(f));
  ok('elk label wijst naar een bestaand veld', wees.length === 0, wees.join() || 'geen wezen');
  ok('geen dubbele koppelingen', new Set(fors).size === fors.length);
  // labels naast een schakelaar of keuzeknop kunnen niet koppelen; die blijven ongekoppeld
  const losse = [...HTML.matchAll(/<label(?! for=)[^>]*>/g)].length;
  ok('alleen schakelaar- en knoplabels blijven ongekoppeld', losse <= 7, losse + ' ongekoppeld');
}

// dialogen als dialoog aangekondigd
{
  const dozen = [...HTML.matchAll(/<div class="modal-box"([^>]*)>/g)].map(m => m[1]);
  ok('elke dialoog heeft role="dialog"', dozen.length > 0 && dozen.every(a => /role="dialog"/.test(a)), dozen.length + ' dialogen');
  ok('elke dialoog is modaal aangekondigd', dozen.every(a => /aria-modal="true"/.test(a)));
}

// het invoerveld en de validatie mogen niet uiteenlopen
{
  const max = HTML.match(/id="f-decimalen"[^>]*max="(\d+)"/);
  const clamp = SCRIPT.match(/Math\.min\((\d+), Math\.max\(0,/);
  ok('max in het veld en de klem in de code zijn gelijk', max && clamp && max[1] === clamp[1], (max && max[1]) + ' / ' + (clamp && clamp[1]));
}

// Escape sluit via hetzelfde pad als de terugknop
{
  ok('Escape wordt afgehandeld', /if\(e\.key === 'Escape'\)/.test(SCRIPT));
  ok('Escape gaat via history.back(), niet via een eigen sluitpad',
     /if\(e\.key === 'Escape'\)\{[\s\S]{0,200}history\.back\(\);/.test(SCRIPT));
  ok('Escape doet niets als er een vraag openstaat', /if\(wachtOpAntwoord\(\) \|\| !modalStack\.length\) return;/.test(SCRIPT));
  ok('Tab blijft binnen de bovenste dialoog', /if\(e\.key !== 'Tab'\) return;/.test(SCRIPT) && /bovensteDialoog\(\)/.test(SCRIPT));
}

// wachtOpAntwoord kijkt naar de drie vraag- en meldingsvensters
{
  const zichtbaar = new Set();
  const document = {getElementById: id => ({style: {display: zichtbaar.has(id) ? 'flex' : 'none'}})};
  eval(haal('wachtOpAntwoord'));
  ok('niets open: Escape mag sluiten', wachtOpAntwoord() === false);
  for (const id of ['confirm-overlay', 'alert-overlay', 'warn-overlay']) {
    zichtbaar.clear(); zichtbaar.add(id);
    ok(id + ' open: Escape doet niets', wachtOpAntwoord() === true);
  }
}

// focus terug naar de knop die de dialoog opende
{
  const knopA = {naam: 'A', focus(){ gefocust.push('A'); }};
  const knopB = {naam: 'B', focus(){ gefocust.push('B'); }};
  let gefocust = [];
  const body = {};
  const document = {activeElement: body, body, contains: () => true,
                    querySelectorAll: () => []};
  const history = {pushState(){}, back(){}};
  const modalStack = [];
  const focusVoorModal = [];
  let suppressNextPopstate = false;
  /* herstelFocus plant na het sluiten van het laatste venster de controle op een nieuwe
     dag in (1352898-025); hier geteld in plaats van uitgevoerd */
  let nieuweDagGepland = 0;
  const bijNieuweDag = () => {};
  const setTimeout = (f) => { if (f === bijNieuweDag) nieuweDagGepland++; };
  /* pushModal focust ook de doos van de bovenste dialoog; die komt uit de DOM en
     die is hier niet nagemaakt. Deze groep gaat over de FOCUSSTAPEL, dus de
     echte bovensteDialoog() krijgt met querySelectorAll: () => [] netjes 'geen
     dialoog' terug, in plaats van om te vallen op een ontbrekende functie --
     waarop de bundel eerder bij groep 17 van de 19 stopte. Dat die doos
     werkelijk focus krijgt, is browsergedrag en staat in de lijst hieronder. */
  eval(haal('bovensteDialoog') + '\n' + haal('pushModal') + '\n' +
       haal('herstelFocus') + '\n' + haal('popModalForClose'));

  document.activeElement = knopA;
  pushModal({close(){}});
  document.activeElement = knopB;
  pushModal({close(){}});
  ok('twee dialogen open, twee onthouden focussen', modalStack.length === 2);
  popModalForClose();
  ok('bovenste dicht: focus terug naar B', gefocust.join() === 'B', gefocust.join());
  ok('nog een venster open: nog geen controle op een nieuwe dag', nieuweDagGepland === 0, nieuweDagGepland);
  popModalForClose();
  ok('onderste dicht: focus terug naar A', gefocust.join() === 'B,A', gefocust.join());
  ok('laatste venster dicht: de controle op een nieuwe dag wordt ingepland', nieuweDagGepland === 1, nieuweDagGepland);
  ok('stapels blijven gelijk lopen', modalStack.length === 0);

  gefocust = [];
  document.activeElement = body;
  pushModal({close(){}});
  popModalForClose();
  ok('aanraking zonder focus: niets te herstellen', gefocust.length === 0);

  // een element dat inmiddels uit de DOM is, mag geen fout geven
  gefocust = [];
  document.contains = () => false;
  document.activeElement = knopA;
  pushModal({close(){}});
  popModalForClose();
  ok('verdwenen opener geeft geen fout', gefocust.length === 0);
}

{
  ok('focus wordt ook hersteld bij sluiten via de terugknop',
     /modalStack\.pop\(\);\s*\n\s*herstelFocus\(\);\s*\n\s*top\.close\(true\);/.test(SCRIPT));
}

deel18();
}

/* ---------- 18. offline met een query-string in de URL ---------- */
function deel18(){
kop('18. Offline navigeren met een query-string');
{
  const env = swOmgeving();
  env.maakSw();
  const huidige = CACHE_NAAM;

  (async () => {
    // eerst online installeren, dan de verbinding wegnemen
    let p; env.handlers.install[0]({waitUntil: x => p = x}); await p;
    const inhoud = env.store.get(huidige);
    const aantalNaPrecache = inhoud.size;
    env.zetOffline();

    const vraag = async (url, mode, method = 'GET') => {
      let antwoord = null;
      env.handlers.fetch[0]({request: {method, url, mode}, respondWith: x => antwoord = x, waitUntil(){}});
      return antwoord ? await antwoord : undefined;
    };
    const ORIGIN = env.ORIGIN;

    ok('gewone navigatie werkt offline', !!(await vraag(ORIGIN + '/trends.html', 'navigate')));
    ok('navigatie mét query werkt offline', !!(await vraag(ORIGIN + '/trends.html?utm=mail', 'navigate')),
       'dit was de misser vóór ignoreSearch');
    ok('ook de map-URL met query werkt', !!(await vraag(ORIGIN + '/?x=1', 'navigate')));
    ok('geen extra kopie per query-variant in de cache', inhoud.size === aantalNaPrecache, inhoud.size + ' sleutels');

    /* Eén kopie per pad, voor elk eigen bestand: zo doen de drie apps het sinds ze
       gelijk zijn getrokken. Wie echt een verse versie wil, vraagt dat met cache
       'reload' of 'no-store' (groep 21). */
    {
      const res = await vraag(ORIGIN + '/icon.svg?v=2', 'no-cors');
      ok('ook een bestand met query komt offline uit de cache', !!res && res.status === 200, res && res.status);
    }
    ok('bestand zonder query komt wel uit de cache', !!(await vraag(ORIGIN + '/icon.svg', 'no-cors')));

    // en de bestaande afspraken blijven staan
    ok('ander domein blijft buiten de cache', (await vraag('https://cdn.example.com/x.js', 'no-cors')) === undefined);
    ok('niet-GET gaat de serviceworker voorbij', (await vraag(ORIGIN + '/trends.html', 'navigate', 'POST')) === undefined);
    ok('opzoeken gebeurt onder het pad zonder query', /const bewaarSleutel = sleutel\(url\);/.test(SW));

    await deel19();
  })();
}
}

/* ---------- 19. installatie en offline-terugval ---------- */
async function deel19(){
kop('19. Betrouwbare installatie en offline-terugval');

const huidige = CACHE_NAAM;
const installeer = async (env) => {
  env.maakSw();
  let p; env.handlers.install[0]({waitUntil: x => p = x});
  try { await p; return null; } catch (e) { return e; }
};
const vraagVan = (env) => async (url, mode, method = 'GET') => {
  let antwoord = null;
  env.handlers.fetch[0]({request: {method, url, mode}, respondWith: x => antwoord = x, waitUntil(){}});
  return antwoord ? await antwoord : undefined;
};

// een ontbrekend optioneel bestand mag de installatie niet blokkeren
{
  const env = swOmgeving({server: ['./trends.html', './index.html', './manifest.json']});
  const fail = await installeer(env);
  ok('ontbrekend icoon blokkeert de installatie niet', fail === null, fail && fail.message);
  const gecached = env.store.get(huidige) || new Map();
  // Beide helften in één toets: anders slaagt "icoon overgeslagen" ook als er niets is gecachet.
  ok('de app staat in de cache en het ontbrekende bestand is overgeslagen',
     gecached.has(env.abs('./trends.html')) && !gecached.has(env.abs('./icon.svg')),
     gecached.size + ' sleutels');
}
// een ontbrekend verplicht bestand moet de installatie laten mislukken
{
  const env = swOmgeving({server: ['./', './index.html', './manifest.json', './icon.svg']});
  env.store.set('trends-v15', new Map([[env.abs('./trends.html'), 'vorige versie']]));
  const fail = await installeer(env);
  ok('ontbrekende app laat de installatie mislukken', fail !== null, fail && fail.message);
  ok('geen lege huls in de cache achtergelaten', !env.store.has(huidige), [...env.store.keys()].join());
  ok('de vorige versie blijft staan', env.store.has('trends-v15'));
}
// offline terugval: nooit undefined
{
  const env = swOmgeving();
  await installeer(env);
  env.zetOffline();
  const vraag = vraagVan(env);

  // de cache is leeggeruimd door de browser, bijvoorbeeld bij opslagdruk
  env.store.get(huidige).clear();
  const nav = await vraag(env.ORIGIN + '/trends.html', 'navigate');
  ok('lege cache offline geeft geen undefined', nav !== undefined);
  ok('en een echte offlinepagina', !!nav && nav.status === 503, nav && nav.status);
  const tekst = nav ? await nav.text() : '';
  ok('met uitleg in het Nederlands', /Trends is offline/.test(tekst));
  ok('als HTML, zodat de browser hem toont', !!nav && /text\/html/.test(nav.headers.get('Content-Type')));

  const bestand = await vraag(env.ORIGIN + '/icon.svg', 'no-cors');
  ok('een gewoon bestand krijgt geen HTML-pagina', !!bestand && !/text\/html/.test(bestand.headers.get('Content-Type')));
}
/* Een eigen pad waarvan de cacheregel weg is, valt terug op de bewaarde app. Dit is
   het scenario waarin de browser onder opslagdruk een deel van de cache opruimt: de
   map-URL is weg, trends.html staat er nog. */
{
  const env = swOmgeving();
  await installeer(env);
  env.store.get(huidige).delete(env.abs('./'));
  env.zetOffline();
  const map = await vraagVan(env)(env.ORIGIN + '/', 'navigate');
  ok('eigen pad zonder cacheregel valt terug op de bewaarde app', !!map && map.status === 200, map && map.status);
}
// eigen-padenfilter: alleen de vijf bestanden van Trends gaan door deze worker
{
  const env = swOmgeving();
  await installeer(env);
  const onderschept = async (url, mode) => {
    let antwoord = null;
    env.handlers.fetch[0]({request: {method: 'GET', url, mode}, respondWith: x => antwoord = x, waitUntil(){}});
    if (antwoord) await antwoord;
    return antwoord !== null;
  };
  ok('eigen bestand wordt onderschept', await onderschept(env.ORIGIN + '/trends.html', 'navigate'));
  ok('eigen bestand met query ook', await onderschept(env.ORIGIN + '/trends.html?x=1', 'navigate'));
  ok('bestand van Golf Score niet', !(await onderschept(env.ORIGIN + '/golf-score.html', 'navigate')));
  ok('bestand van Events niet', !(await onderschept(env.ORIGIN + '/events.html', 'navigate')));
  ok('onbekend pad op de eigen origin niet', !(await onderschept(env.ORIGIN + '/iets-anders.json', 'no-cors')));
  ok('ander domein niet', !(await onderschept('https://cdn.example.com/x.js', 'no-cors')));
  ok('niets van buiten in de Trends-cache',
     [...env.store.get(huidige).keys()].every(k => /\/(index\.html|trends\.html|manifest\.json|icon\.svg)$|\/$/.test(k)),
     [...env.store.get(huidige).keys()].join(' '));
}

// uiterste wachttijd: een hangende verbinding mag het tabblad niet vasthouden
{
  const m = SW.match(/const GRENS = (\d+);/);
  const mt = SW.match(/const GRENS_MET_TERUGVAL = (\d+);/);
  ok('de grens staat in het bestand', !!m && Number(m[1]) > 0 && Number(m[1]) <= 30000,
     m ? m[1] + ' ms' : 'geen GRENS gevonden');
  ok('de korte grens met terugval staat erbij', !!mt && Number(mt[1]) < Number(m ? m[1] : 0),
     mt ? mt[1] + ' ms' : 'geen GRENS_MET_TERUGVAL gevonden');
  // zonder constante toch doormeten, zodat de gedragstests hieronder iets zeggen
  const GRENS = m ? Number(m[1]) : 10000;
  /* Niet terugvallen op GRENS als de constante ontbreekt: dan zou de test op een
     versie zonder korte grens alsnog slagen en dus niets toetsen. */
  const KORT = mt ? Number(mt[1]) : 3000;

  // cachemisser met een verbinding die blijft hangen
  {
    const env = swOmgeving();
    await installeer(env);
    env.store.get(huidige).clear();
    env.zetHangend();
    let antwoord = null, klaar = false;
    env.handlers.fetch[0]({
      request: {method: 'GET', url: env.ORIGIN + '/trends.html', mode: 'navigate'},
      respondWith: x => antwoord = x, waitUntil(){}
    });
    const belofte = antwoord.then(r => { klaar = true; return r; });
    await env.tik(GRENS - 1);
    ok('vóór de grens wordt er nog gewacht', klaar === false);
    await env.tik(2);
    /* Echte bovengrens om de testset zelf niet te laten hangen: zonder de ingebouwde
       grens settelt dit antwoord nooit, en dan moet hier FOUT staan in plaats van stilte. */
    const res = await Promise.race([belofte, new Promise(r => setTimeout(() => r('BLEEF HANGEN'), 200))]);
    ok('na de grens komt de offlinepagina', !!res && res.status === 503, (res && res.status) || res);
    ok('en dus niet undefined', res !== undefined && res !== 'BLEEF HANGEN');
  }

  // cachetreffer: op het netwerk wordt niet gewacht, hoe lang het ook hangt
  {
    const env = swOmgeving();
    await installeer(env);
    env.zetHangend();
    let antwoord = null;
    env.handlers.fetch[0]({
      request: {method: 'GET', url: env.ORIGIN + '/trends.html', mode: 'navigate'},
      respondWith: x => antwoord = x, waitUntil(){}
    });
    const res = await antwoord; // zonder ook maar één tik
    ok('cachetreffer wacht niet op een hangend netwerk', !!res && res.status === 200, res && res.status);
    await env.tik(0);
    const voor = env.store.get(huidige).size;
    await env.tik(GRENS + 1);
    ok('de hangende achtergrondverversing laat de cache ongemoeid', env.store.get(huidige).size === voor);
  }

  // een netwerk dat binnen de grens antwoordt wordt gewoon gebruikt, en de klok opgeruimd
  {
    const env = swOmgeving();
    await installeer(env);
    env.store.get(huidige).clear();
    let antwoord = null;
    env.handlers.fetch[0]({
      request: {method: 'GET', url: env.ORIGIN + '/trends.html', mode: 'navigate'},
      respondWith: x => antwoord = x, waitUntil(){}
    });
    const res = await antwoord;
    ok('een tijdig antwoord wordt gewoon gebruikt', !!res && res.status === 200, res && res.status);
    ok('en de klok wordt opgeruimd', env.lopendeKlokken() === 0, env.lopendeKlokken() + ' lopend');
  }

  /* Is er een bewaarde app, dan hoeft er niet lang gewacht te worden: de korte grens.
     Dit is het geval waarin één pad niet geïnstalleerd raakte (bijvoorbeeld de kale
     map-URL) terwijl trends.html er wel staat. */
  {
    const env = swOmgeving();
    await installeer(env);
    env.store.get(huidige).delete(env.abs('./'));
    env.zetHangend();
    let antwoord = null, klaar = false;
    env.handlers.fetch[0]({
      request: {method: 'GET', url: env.ORIGIN + '/', mode: 'navigate'},
      respondWith: x => antwoord = x, waitUntil(){}
    });
    const belofte = antwoord.then(r => { klaar = true; return r; });
    await env.tik(KORT - 1);
    ok('met terugval: vóór de korte grens nog wachten', klaar === false);
    await env.tik(2);
    const res = await Promise.race([belofte, new Promise(r => setTimeout(() => r('BLEEF HANGEN'), 200))]);
    ok('met terugval: na de korte grens komt de bewaarde app', !!res && res.status === 200, (res && res.status) || res);
    ok('en dus niet de volle wachttijd', KORT < GRENS, KORT + ' in plaats van ' + GRENS);
  }
  /* Is er niets om op terug te vallen, dan is wachten juist het beste: een trage maar
     werkende verbinding afkappen levert alleen een offlinepagina op. */
  {
    const env = swOmgeving();
    await installeer(env);
    env.store.get(huidige).clear();
    env.zetHangend();
    let antwoord = null, klaar = false;
    env.handlers.fetch[0]({
      request: {method: 'GET', url: env.ORIGIN + '/trends.html', mode: 'navigate'},
      respondWith: x => antwoord = x, waitUntil(){}
    });
    const belofte = antwoord.then(r => { klaar = true; return r; });
    await env.tik(KORT + 1);
    ok('zonder terugval geldt de korte grens niet', klaar === false);
    await env.tik(GRENS - KORT);
    const res = await Promise.race([belofte, new Promise(r => setTimeout(() => r('BLEEF HANGEN'), 200))]);
    ok('zonder terugval wordt de volle wachttijd gebruikt', !!res && res.status === 503, (res && res.status) || res);
  }

  // een weigerend netwerk gedraagt zich nog precies als voorheen
  {
    const env = swOmgeving();
    await installeer(env);
    env.store.get(huidige).clear();
    env.zetOffline();
    const res = await vraagVan(env)(env.ORIGIN + '/trends.html', 'navigate');
    ok('een weigering valt meteen terug, zonder te wachten', !!res && res.status === 503, res && res.status);
    ok('ook daar blijft geen klok lopen', env.lopendeKlokken() === 0, env.lopendeKlokken() + ' lopend');
  }
}

// cacheopslag geweigerd: wel een antwoord, geen crash
{
  const env = swOmgeving({cacheStuk: true});
  env.maakSw();
  const res = await vraagVan(env)(env.ORIGIN + '/trends.html', 'navigate');
  ok('geweigerde cacheopslag geeft toch een antwoord', res !== undefined && res.status === 503, res && res.status);
}
// geen ruimte om weg te schrijven: het antwoord blijft staan
{
  const env = swOmgeving({putStuk: true});
  const fail = await installeer(env);
  ok('volle opslag laat de installatie mislukken in plaats van half', fail !== null, fail && fail.message);
  const env2 = swOmgeving();
  await installeer(env2);
  env2.store.get(huidige).clear();
  const res = await vraagVan(env2)(env2.ORIGIN + '/trends.html', 'navigate');
  ok('online met lege cache levert gewoon het netwerkantwoord', !!res && res.status === 200);
}

/* ---------- 20. vastgezette opslag ---------- */
kop('20. Vastgezette opslag');
{
  /* Zonder vastgezette opslag mag de browser de opslag van de app wissen bij
     ruimtegebrek. Daarin zit de verwijzing naar de werkmap: raakt die weg, dan
     is niet alleen de toestemming verlopen maar weet de app niet meer WELKE map
     het was. Golf-score en events vragen het allebei; trends deed dat niet. */
  ok('trends vraagt de browser om vastgezette opslag',
     /navigator\.storage/.test(SCRIPT) && /\.persist\(\)/.test(SCRIPT) && /\.persisted\(\)/.test(SCRIPT));
  ok('en laat in het scherm zien wat eruit kwam',
     /<div id="opslag-vast">/.test(HTML) && /getElementById\('opslag-vast'\)/.test(SCRIPT));

  /* Een afgewezen belofte mag hier geen uitzondering worden: dan stopt de
     bundel en lees je niet meer WELK geval misging. */
  const uitkomst = async (p) => { try { return await p; } catch (e) { return 'uitzondering: ' + e.message; } };
  const bouw = () => {
    const ctx = { persistAanroepen: 0 };
    return new Function('ctx', 'navigator', [
      'let opslagVast = null;',
      haal('zetOpslagVast'),
      'return { zetOpslagVast, eigenToestand: () => opslagVast };'
    ].join('\n'))(ctx, { storage: null });
  };
  const opslag = (opzet) => ({
    persisted: async () => {
      if (opzet.queryWerpt) throw new Error('niet toegestaan');
      return opzet.al === true;
    },
    persist: async () => { opzet.aanroepen = (opzet.aanroepen || 0) + 1; return opzet.geeft !== false; }
  });

  {
    /* Staat het al vast, dan mag er NIET opnieuw gevraagd worden: sommige
       browsers tonen er een venstertje bij, en dat hoort niet bij elke start
       te komen. */
    const o = { al: true };
    ok('staat het al vast, dan is het goed', (await uitkomst(bouw().zetOpslagVast(opslag(o)))) === true);
    ok('en wordt er niet opnieuw gevraagd', (o.aanroepen || 0) === 0, (o.aanroepen || 0) + ' keer');
  }
  {
    const o = { al: false, geeft: true };
    ok('staat het nog niet vast, dan wordt het gevraagd',
       (await uitkomst(bouw().zetOpslagVast(opslag(o)))) === true);
    ok('en precies een keer', o.aanroepen === 1, o.aanroepen + ' keer');
  }
  ok('een weigering levert false, geen uitzondering',
     (await uitkomst(bouw().zetOpslagVast(opslag({ al: false, geeft: false })))) === false);
  ok('een stukke opslag levert null, geen uitzondering',
     (await uitkomst(bouw().zetOpslagVast(opslag({ queryWerpt: true })))) === null);
  ok('een browser zonder deze mogelijkheid levert null',
     (await uitkomst(bouw().zetOpslagVast({}))) === null);
  {
    /* De meegegeven opslag is er om na te rekenen; die hoort de toestand van de
       app niet te veranderen, anders toetst de test zijn eigen bijwerking. */
    const app = bouw();
    await uitkomst(app.zetOpslagVast(opslag({ al: true })));
    ok('een meegegeven opslag verandert de toestand van de app niet',
       app.eigenToestand() === null, String(app.eigenToestand()));
  }
  /* Drie uitkomsten, drie woorden. "onbekend" en niet "nee" als de vraag niet
     lukte: het kan dan nog steeds vaststaan, we weten het alleen niet -- en
     "nee" zou je op zoek sturen naar een probleem dat er misschien niet is. */
  {
    const t = haal('toonOpslagVast');
    ok('de melding is kort', /'Opslag vastgezet: '/.test(t));
    ok('en onderscheidt ja, nee en onbekend',
       (t.match(/opslagVast === (true|false)/g) || []).length === 2 &&
       /'ja'/.test(t) && /'nee'/.test(t) && /'onbekend'/.test(t));
  }
}

/* ---------- 21. gelijk met Golf Score en Events ---------- */
kop('21. De worker doet hetzelfde als die van Golf Score en Events');
{
  const vraagMet = (env) => async (url, mode, cache) => {
    let antwoord = null;
    env.handlers.fetch[0]({request: {method: 'GET', url, mode, cache}, respondWith: x => antwoord = x, waitUntil(){}});
    return antwoord ? await antwoord : undefined;
  };

  /* Stap 8: de cachenaam is een losse teller, met de naam ervan afgeleid. */
  ok('CACHE_VERSION is een getal', /const CACHE_VERSION = \d+;/.test(SW));
  ok('en de naam wordt ervan afgeleid', /const CACHE_NAME = 'trends-v' \+ CACHE_VERSION;/.test(SW));
  ok('update_cache_version.py kent die schrijfwijze',
     /const CACHE_VERSION = \(\\d\+\);/.test(fs.readFileSync(path.join(__dirname, 'update_cache_version.py'), 'utf8')));

  /* Stap 2: de achtergrondverversing mag 60 s duren. Met 10 s werd op een trage
     verbinding de nieuwe versie telkens afgekapt en bleef de melding uit. */
  {
    const ga = SW.match(/const GRENS_ACHTERGROND = (\d+);/);
    ok('de worker kent een ruime grens voor de achtergrondverversing', !!ga && +ga[1] === 60000, ga && ga[1] + ' ms');
    const env = swOmgeving();
    await installeer(env);
    env.zetTraag(11000);
    const voor = env.store.get(huidige).get(env.abs('./trends.html'));
    const res = await vraagMet(env)(env.ORIGIN + '/trends.html', 'navigate');
    ok('een cachetreffer komt meteen', !!res && res.status === 200, res && res.status);
    await env.tik(11001);
    const na = env.store.get(huidige).get(env.abs('./trends.html'));
    ok('een verversing van 11 s komt nog in de cache', !!na && na !== voor && na.body === 'traag ' + env.abs('./trends.html'),
       na === voor ? 'ongewijzigd' : (na && na.body));
  }

  /* Stap 4: de worker meldt een verse kopie van de pagina, zodat de app meteen
     controleert en niet pas bij het volgende wegschakelen. */
  {
    const env = swOmgeving();
    await installeer(env);
    await vraagMet(env)(env.ORIGIN + '/trends.html', 'navigate');
    await env.tik(0);
    ok('na een verse kopie van de pagina volgt een bericht',
       env.self.berichten.some(m => m && m.type === 'kopieVernieuwd'), JSON.stringify(env.self.berichten));
    env.self.berichten.length = 0;
    await vraagMet(env)(env.ORIGIN + '/icon.svg', 'no-cors');
    await env.tik(0);
    ok('bij een bijbestand niet: daar staat geen stempel in', env.self.berichten.length === 0,
       JSON.stringify(env.self.berichten));
    ok('de app luistert naar dat bericht',
       /navigator\.serviceWorker\.addEventListener\('message', \(e\)=>\{\s*\n\s*if\(e\.data && e\.data\.type === 'kopieVernieuwd'\) checkAppUpdate\(\);/.test(SCRIPT));
    ok('en houdt de controle na 4 s als vangnet', /setTimeout\(checkAppUpdate, 4000\);/.test(SCRIPT));
  }

  /* Stap 6: een ontbrekend bijbestand overnemen uit de nieuwste vorige eigen cache,
     op nummer (trends-v10 is nieuwer dan trends-v9), nooit uit die van een buurapp. */
  {
    const env = swOmgeving({server: ['./', './index.html', './trends.html']});
    env.store.set('trends-v9', new Map([[env.abs('./icon.svg'), {body: 'icoon v9'}]]));
    env.store.set('trends-v10', new Map([[env.abs('./icon.svg'), {body: 'icoon v10'}]]));
    env.store.set('golf-score-v41', new Map([[env.abs('./manifest.json'), {body: 'van golf'}]]));
    const fail = await installeer(env);
    ok('de installatie slaagt', fail === null, fail && fail.message);
    const c = env.store.get(huidige) || new Map();
    const icoon = c.get(env.abs('./icon.svg'));
    ok('het ontbrekende icoon komt uit de nieuwste vorige eigen cache', !!icoon && icoon.body === 'icoon v10',
       icoon ? icoon.body : 'ontbreekt');
    ok('en niets uit de cache van een buurapp', !c.has(env.abs('./manifest.json')));
  }

  /* Stap 7: een verzoek dat uitdrukkelijk vers wil, gaat langs de cache en wordt
     niet bewaard; en elk pad heeft één kopie, ook met een query. */
  {
    const env = swOmgeving();
    await installeer(env);
    const vraag = vraagMet(env);
    const voor = env.store.get(huidige).get(env.abs('./manifest.json'));
    const vers = await vraag(env.ORIGIN + '/manifest.json', 'cors', 'no-store');
    await env.tik(0);
    ok('no-store krijgt een antwoord van het netwerk', !!vers && vers.status === 200, vers && vers.status);
    ok('en wordt niet bewaard', env.store.get(huidige).get(env.abs('./manifest.json')) === voor);
    await vraag(env.ORIGIN + '/icon.svg?v=2', 'no-cors');
    await env.tik(0);
    ok('een query levert geen tweede kopie op', [...env.store.get(huidige).keys()].every(k => k.indexOf('?') < 0),
       [...env.store.get(huidige).keys()].filter(k => k.indexOf('?') >= 0).join());
    env.zetOffline();
    const ns = await vraag(env.ORIGIN + '/manifest.json', 'cors', 'no-store');
    ok('offline geeft no-store een fout en niet de oude kopie', !!ns && ns.status === 503, ns && ns.status);
    const rl = await vraag(env.ORIGIN + '/manifest.json', 'cors', 'reload');
    ok('reload ook', !!rl && rl.status === 503, rl && rl.status);
  }
}

/* ---------- 22. lezen zonder toegang, toegang pas bij het opslaan ---------- */
kop('22. Lezen uit de leeskopie, toegang pas bij het opslaan');
{
  /* Edge op Android onthoudt de toestemming voor de werkmap maar tot de app dicht
     is, en zonder toestemming kan Trends de bestanden niet eens lezen. Tot
     1352897-003 stond er dan 'Toegang autoriseren' en was er niets te zien. Nu
     leest Trends uit een leeskopie in de browser en vraagt het pas bij het
     opslaan om toegang. Sinds 1352898-020 schrijft alleen Trends in de bestanden:
     opslaan vergelijkt niets meer met het bestand. */
  const nodig = ['readJsonFromDir', 'writeJsonToDir', 'zorgVoorToegang', 'bewaarKopieVan'];
  const ontbreekt = nodig.filter(n => { try { haal(n); return false; } catch (e) { return true; } });
  ok('de functies voor de leeskopie bestaan', ontbreekt.length === 0, ontbreekt.join(', ') || 'alle');

  const T0 = Date.UTC(2026, 9, 16, 12, 0);
  const maakWerkmap = (bestanden, perm) => {
    const map = new Map(Object.entries(bestanden).map(([k, v]) => [k, {tekst: v, mtime: T0}]));
    const w = {
      map, perm, gevraagd: 0, gelezen: 0,
      async requestPermission(){ w.gevraagd++; if (w.perm === 'granted') w.toegang = true; return w.perm; },
      toegang: false,
      async getFileHandle(naam, opts){
        if (!w.toegang) throw Object.assign(new Error('geen toegang'), {name: 'NotAllowedError'});
        if (!map.has(naam) && !(opts && opts.create)) throw Object.assign(new Error('weg'), {name: 'NotFoundError'});
        return {
          getFile: async () => { w.gelezen++; const f = map.get(naam) || {tekst: '', mtime: T0};
            return {text: async () => f.tekst, lastModified: f.mtime, size: f.tekst.length}; },
          createWritable: async () => { let buf = ''; return {write: async t => { buf += t; },
            close: async () => { map.set(naam, {tekst: buf, mtime: (map.get(naam) || {mtime: T0}).mtime + 1000}); }, abort: async () => {}}; }
        };
      }
    };
    return w;
  };
  const bouw = (werkmap, idb, antwoord) => {
    const ctx = {vragen: [], idb};
    const fn = new Function('ctx', 'dirHandle', `
      let leesKopieModus = true;
      const __zonderKopie = new Set();
      let __pendingWrites = 0;
      const __writeChain = new Map();
      const idbGet = async (k) => ctx.idb.has(k) ? ctx.idb.get(k) : null;
      const idbSet = async (k, v) => { ctx.idb.set(k, v); return true; };
      const idbDelete = async (k) => { ctx.idb.delete(k); return true; };
      const showConfirm = (m) => { ctx.vragen.push(m); return Promise.resolve(${antwoord ? 'true' : 'false'}); };
      const maybeBackupFile = async () => {};
      const toonKopieStand = () => {};
      ${haal('writeHandleJson')}
      ${haal('bewaarKopieVan')}
      ${haal('zorgVoorToegang')}
      ${haal('readJsonFromDir')}
      ${haal('writeJsonToDir')}
      return { readJsonFromDir, writeJsonToDir, stand: () => leesKopieModus, zonderKopie: n => __zonderKopie.has(n) };
    `);
    return {ctx, ...fn(ctx, werkmap)};
  };
  const uitkomst = async (p) => { try { await p; return 'gelukt'; } catch (e) { return e.name || 'fout'; } };
  const KOPIE = JSON.stringify({D20261015T0800: 80.4}, null, '\t');
  const idbMet = (tekst) => new Map([['kopie:gewicht.json', {tekst, bestaat: true, tijd: T0}]]);
  /* een kopie zoals Trends die tot 019 bewaarde: met stempel (null: het bestand bestond niet) */
  const idbOud = (tekst, stempel) => new Map([['kopie:gewicht.json', {tekst, stempel, tijd: T0}]]);

  const koppelingen = () => {
    /* de koppelingen in de app */
    ok('zonder toegang start Trends uit de kopie als die er is',
       /idbGet\('kopie:' \+ META_FILENAME\)/.test(haal('bootDir')) && /leesKopieModus = true/.test(haal('bootDir')));
    ok('Vernieuwen vraagt zonder toegang eerst daarom',
       /btn-refresh-dir'\)\.addEventListener\('click', async \(\)=>\{\s*\n\s*if\(!dirHandle\) return;\s*\n\s*if\(!\(await zorgVoorToegang\(\)\)\)/.test(SCRIPT));
    ok('een geweigerde toegang heeft een eigen melding bij een meting',
       /ToegangGeweigerd/.test(haal('slaMetingOp')) && /Geen toegang tot /.test(haal('voerMetingUit')));
    ok('en bij de bronnenlijst', /ToegangGeweigerd/.test(haal('schrijfBronnenNu')) && /Geen toegang tot /.test(haal('toonBronUitkomst')));
    ok('de controle van de bronbestanden slaat de leeskopie over',
       /if\(leesKopieModus\) return;/.test(haal('validateBronnen')));
    /* De regel in het Bronnen-paneel: mapnaam en het moment van de kopie, als
       dd-mm-jjjj uu:mm, zonder verdere woorden. */
    let tijdTekst = '(geen kopieTijd)';
    try { tijdTekst = new Function(haal('kopieTijd') + '; return kopieTijd(new Date(2026, 9, 6, 9, 5).getTime());')(); } catch (e) {}
    ok('het moment van de kopie staat er als dd-mm-jjjj uu:mm', tijdTekst === '06-10-2026 09:05', tijdTekst);
    let paneel = ''; try { paneel = haal('toonKopieStand'); } catch (e) {}
    const kt = (ms, nu) => { try { return new Function('ms', 'nu', haal('kopieTijd') + '; return kopieTijd(ms, nu);')(ms, nu); } catch (e) { return '(fout)'; } };
    const NU = new Date(2026, 9, 16, 17, 51).getTime();
    ok('vandaag', kt(new Date(2026, 9, 16, 0, 5).getTime(), NU) === 'vandaag 00:05', kt(new Date(2026, 9, 16, 0, 5).getTime(), NU));
    ok('gisteren', kt(new Date(2026, 9, 15, 23, 59).getTime(), NU) === 'gisteren 23:59', kt(new Date(2026, 9, 15, 23, 59).getTime(), NU));
    ok('eergisteren als datum', kt(new Date(2026, 9, 14, 20, 3).getTime(), NU) === '14-10-2026 20:03');
    {
      /* 25 oktober 2026 duurt in Nederland 25 uur */
      const tzWas = process.env.TZ; process.env.TZ = 'Europe/Amsterdam';
      const uit = kt(new Date(2026, 9, 25, 23, 30).getTime(), new Date(2026, 9, 26, 23, 50).getTime());
      if (tzWas === undefined) delete process.env.TZ; else process.env.TZ = tzWas;
      ok('gisteren over de wisseling naar wintertijd heen', uit === 'gisteren 23:30', uit);
    }
    ok('gisteren over de maandgrens', kt(new Date(2026, 8, 30, 8, 0).getTime(), new Date(2026, 9, 1, 8, 0).getTime()) === 'gisteren 08:00');
    ok('het paneel toont het moment ook met toegang',
       !/leesKopieModus/.test(paneel) && /idbGet\('kopieLaatst'\)/.test(paneel));
    ok('een koppeling zet het moment er ook achter',
       /if\(prefix === 'dir'\) toonKopieStand\(\);/.test(haal('setFileLinkUI')));
    ok('elke nieuwe kopie zet dat moment en ververst het paneel',
       /idbSet\('kopieLaatst', tijd\)/.test(haal('bewaarKopieVan')) && /toonKopieStand\(\);/.test(haal('bewaarKopieVan')));
    ok('en de regel heeft verder alleen de mapnaam', /dirHandle\.name \+ \(wanneer \? ' · ' \+ wanneer : ''\)/.test(paneel) && !/leeskopie/.test(paneel.split('\n').filter(r => !/^\s*(\/\*|\*|\/\/)/.test(r)).join('\n')));
    ok('een bestand kiezen vraagt eerst om toegang',
       /await zorgVoorToegang\(\)/.test(haal('openBestandPicker')));
  };
  if (ontbreekt.length === 0) {
    (async () => {
      /* lezen zonder toegang: uit de kopie, zonder de map aan te raken */
      {
        const w = maakWerkmap({'gewicht.json': KOPIE}, 'granted');
        const t = bouw(w, idbMet(KOPIE, T0), true);
        const obj = await t.readJsonFromDir('gewicht.json');
        ok('zonder toegang komt de bron uit de leeskopie', !!obj && obj.D20261015T0800 === 80.4, JSON.stringify(obj));
        ok('zonder de map aan te raken of om toegang te vragen', w.gelezen === 0 && w.gevraagd === 0);
      }
      /* opslaan: nu pas de vraag, en het bestand was niet veranderd */
      {
        const w = maakWerkmap({'gewicht.json': KOPIE}, 'granted');
        const t = bouw(w, idbMet(KOPIE, T0), true);
        await t.readJsonFromDir('gewicht.json');
        const r = await uitkomst(t.writeJsonToDir('gewicht.json', {D20261015T0800: 80.4, D20261016T0800: 80.1}));
        ok('opslaan vraagt om toegang', w.gevraagd === 1, w.gevraagd + ' keer');
        ok('en schrijft dan weg', r === 'gelukt' && /D20261016T0800/.test(w.map.get('gewicht.json').tekst), r);
        ok('zonder vraag over overschrijven', t.ctx.vragen.length === 0, t.ctx.vragen.join(' | '));
        ok('daarna is de leeskopie-stand voorbij', t.stand() === false);
        const k = t.ctx.idb.get('kopie:gewicht.json');
        ok('en is de kopie gelijk aan het bestand', !!k && k.tekst === w.map.get('gewicht.json').tekst);
        ok('en weet dat het bestand bestaat', !!k && k.bestaat === true);
      }
      /* een bewerking buiten Trends om: wordt niet meer bewaakt (1352898-020) */
      {
        const w = maakWerkmap({'gewicht.json': KOPIE}, 'granted');
        w.map.set('gewicht.json', {tekst: JSON.stringify({D20261015T0800: 79.9}), mtime: T0 + 5000});
        const t = bouw(w, idbMet(KOPIE, T0), false);
        await t.readJsonFromDir('gewicht.json');
        const r = await uitkomst(t.writeJsonToDir('gewicht.json', {D20261016T0800: 80.1}));
        ok('na een bewerking buiten Trends om: gewoon geschreven, zonder vraag', t.ctx.vragen.length === 0 && r === 'gelukt', r);
        ok('wat er buiten Trends om stond, is overschreven', !/79\.9/.test(w.map.get('gewicht.json').tekst));
      }
      /* toegang geweigerd */
      {
        const w = maakWerkmap({'gewicht.json': KOPIE}, 'denied');
        const t = bouw(w, idbMet(KOPIE, T0), true);
        await t.readJsonFromDir('gewicht.json');
        const r = await uitkomst(t.writeJsonToDir('gewicht.json', {D20261016T0800: 80.1}));
        ok('geweigerd: de schrijfactie mislukt met een eigen reden', r === 'ToegangGeweigerd', r);
        ok('en het bestand is ongemoeid', w.map.get('gewicht.json').tekst === KOPIE);
        ok('en de stand blijft de leeskopie', t.stand() === true);
      }
      /* een bestand zonder kopie: dat weet Trends (en schrijft dan niet uit die tabel, zie groep 6) */
      {
        const w = maakWerkmap({'gewicht.json': KOPIE}, 'granted');
        const t = bouw(w, new Map(), false);
        const obj = await t.readJsonFromDir('gewicht.json');
        ok('zonder kopie: niets, en Trends weet dat het niet het bestand is', obj === null && t.zonderKopie('gewicht.json') === true);
        const w2 = maakWerkmap({'gewicht.json': KOPIE}, 'granted');
        const t2 = bouw(w2, idbMet(KOPIE), false);
        await t2.readJsonFromDir('gewicht.json');
        ok('met kopie: wel het bestand', t2.zonderKopie('gewicht.json') === false);
      }
      /* kopieën van vóór 020 (met stempel) blijven leesbaar */
      {
        const w = maakWerkmap({'gewicht.json': KOPIE}, 'granted');
        const t = bouw(w, idbOud(KOPIE, {lastModified: T0, size: KOPIE.length}), false);
        const obj = await t.readJsonFromDir('gewicht.json');
        ok('een oude kopie met stempel: gewoon gelezen', !!obj && obj.D20261015T0800 === 80.4);
        const t2 = bouw(maakWerkmap({}, 'granted'), idbOud('', null), false);
        ok('een oude kopie van een bestand dat niet bestond: niets', (await t2.readJsonFromDir('gewicht.json')) === null && t2.zonderKopie('gewicht.json') === false);
      }
      /* met toegang: lezen legt de kopie vast */
      {
        const w = maakWerkmap({'gewicht.json': KOPIE}, 'granted');
        w.toegang = true;
        const t = bouw(w, new Map(), true);
        await t.writeJsonToDir; // bestaat
        const fn2 = new Function('ctx', 'dirHandle', `
          let leesKopieModus = false;
          const __zonderKopie = new Set();
          const idbGet = async (k) => ctx.idb.has(k) ? ctx.idb.get(k) : null;
          const idbSet = async (k, v) => { ctx.idb.set(k, v); return true; };
          const toonKopieStand = () => {};
          ${haal('bewaarKopieVan')}
          ${haal('zorgVoorToegang')}
          ${haal('readJsonFromDir')}
          return readJsonFromDir;
        `);
        const ctx2 = {idb: new Map()};
        await fn2(ctx2, w)('gewicht.json');
        const k = ctx2.idb.get('kopie:gewicht.json');
        ok('lezen met toegang legt de kopie vast', !!k && k.tekst === KOPIE && k.bestaat === true);
      }

      koppelingen();

      /* 23. Alleen Trends schrijft in de bestanden (1352898-020): geen controle bij
         terugkeer, en bij het opslaan ook niet meer. */
      kop('23. Alleen Trends schrijft: geen botsingen meer');
      ok('bij terugkeer naar de app wordt het bestand niet gecontroleerd',
         !/function kijkExtern\s*\(/.test(SCRIPT) && !/kijkExtern\(/.test(SCRIPT) &&
         !/addEventListener\('focus'/.test(SCRIPT));
      const uit = haal('voerMetingUit');
      ok('de botsingen en Toch opslaan/verwijderen zijn weg, niet als dode bedrading',
         !/buiten de app/.test(SCRIPT) && !/ConflictError|forceer|zetBevestig|metingForceer|bronForceer|bronActie|metingActie|__bestandStempel|KOPIE_ONBEKEND|leesStempel|onleesbareRegels/.test(SCRIPT) &&
         !/Toch opslaan|Toch verwijderen|Opnieuw toevoegen/.test(SCRIPT));
      ok('na de review (1352898-021): geen dode code meer van de botsingen',
         !/herlaadUitBestanden|extern-oud|extern-actie|extern-annuleer/.test(SCRIPT) && !/\.actions \.btn\.compact\{white-space:normal/.test(HTML));
      ok('opslaan leest het bestand alleen als de tabel het niet volledig weergeeft',
         /if\(!tabelIsVolledig\(id\)\)\{/.test(haal('slaMetingOp')) && (haal('slaMetingOp').match(/readJsonFromDir\(/g) || []).length === 1);
      ok('de tabel telt als volledig als hij uit het bestand of een kopie kwam, of net zo is weggeschreven',
         /if\(!zonderKopie\) __volledigeTabel\.add\(norm\.data\);/.test(haal('laadData')) &&
         /dataCache\[id\] = vers; __volledigeTabel\.add\(vers\);/.test(haal('slaMetingOp')) &&
         /__volledigeTabel\.add\(norm\.data\);   \/\/ het bestand is nu deze tabel/.test(haal('herstelUitBackup')));
      ok('de bronnenlijst alleen vanuit een volledig ingelezen lijst',
         /if\(!bronnenVolledig\) return \{fout:'onvolledig'\};/.test(haal('schrijfBronnenNu')) &&
         /bronnenVolledig = !__zonderKopie\.has\(META_FILENAME\);/.test(haal('loadMetaFromDir')) &&
         /bronnen = \[\]; bronnenVolledig = false;/.test(haal('loadMetaFromDir')));
      ok('een venster gaat niet dicht tijdens het opslaan',
         /if\(vensterBezig && modalStack\.length\)\{ history\.pushState/.test(SCRIPT) &&
         /if\(e\.target\.id === 'datapoint-modal-overlay' && !vensterBezig\) closeDatapointModal\(\);/.test(SCRIPT) &&
         /annuleer\.disabled = true;/.test(uit));
      ok('kapot, toegang en mislukt hebben een eigen melding in het venster',
         /'Het bestand is onleesbaar\. Niet opgeslagen\. Vernieuwen biedt de back-up aan\.'/.test(uit) &&
         /Geen toegang tot /.test(uit) && /verwijder \? 'Verwijderen mislukt\.' : 'Opslaan mislukt\.'/.test(uit));
      ok('bij bewerken geen vraag of de meting zelf mag worden overschreven',
         /const bestaandeKey = sameDayKeys\.find\(k => tabel\[k\] != null && k !== editingDataKey\);/.test(SCRIPT));
      ok('de melding komt in beeld, ook onderaan een lang venster',
         /o\.scrollTop = o\.scrollHeight/.test(haal('toonVensterMelding')));
      ok('Annuleren staat links van de bevestigknop, in beide vensters',
         /id="btn-cancel-datapoint"[^\n]*\n\s*<button class="btn compact" id="btn-add-datapoint"/.test(HTML) &&
         /id="btn-cancel-edit"[^\n]*\n\s*<button class="btn compact" id="btn-save-source"/.test(HTML));
      {
        /* de balk onderaan is er alleen nog voor de volgorde van de bronnen */
        const ctx = {tekst: '', oud: 'none'};
        const onvolledig = /const BRONNEN_ONVOLLEDIG = '([^']*)';/.exec(SCRIPT);
        const fn = new Function('ctx', `
          const document = {getElementById: id => ({
            style: {set display(v){ if(id === 'volgorde-balk') ctx.oud = v; }},
            set textContent(v){ if(id === 'volgorde-tekst') ctx.tekst = v; }
          })};
          let volgordeBalk = null;
          const BRONNEN_ONVOLLEDIG = ${JSON.stringify(onvolledig ? onvolledig[1] : '(geen)')};
          ${haal('toonVolgordeBalk')}
          ${haal('verbergVolgordeBalk')}
          return {toon: toonVolgordeBalk, verberg: verbergVolgordeBalk};
        `);
        const t = fn(ctx);
        t.toon({fout: 'mislukt'}, 1);
        ok('volgorde mislukt: Volgorde niet opgeslagen.', ctx.tekst === 'Volgorde niet opgeslagen.' && ctx.oud === 'flex');
        t.toon({fout: 'onvolledig'}, 1);
        ok('volgorde vanuit een onvolledige lijst: dat staat er', !!onvolledig && ctx.tekst === onvolledig[1]);
        t.verberg();
        ok('en de balk kan weer weg', ctx.oud === 'none');
        ok('de knop op de balk is Opnieuw', /<button class="btn compact" id="volgorde-opnieuw">Opnieuw<\/button>/.test(HTML));
      }
      ok('de bron verschuift pas als de volgorde is opgeslagen',
         /volgordeBezig = false;\s*\n\s*if\(!res\.ok\)\{ toonVolgordeBalk\(res, dir, bron\); return; \}\s*\n\s*const idToKeep/.test(haal('moveSelectedSource')));
      ok('Opnieuw op de volgordebalk verschuift de bron die toen fout ging',
         /if\(bronId\) selectedSourceId = bronId;/.test(haal('moveSelectedSource')) &&
         /moveSelectedSource\(b\.dir, b\.bronId\)/.test(SCRIPT));
      ok('één back-up per dag, ook nu opslaan niet meer leest',
         /if\(last === today\) return;/.test(haal('maybeBackupFile')) &&
         /await maybeBackupFile\(name\);/.test(haal('writeJsonToDir')));

      /* tweede review (1352898-014) */
      {
        const ctx = {meldingen: [], json: {D20261001T1200: 80, D20261002T1200: '81,5', 'D2026-10-03': 82, D20261004T1200: null}};
        const fn = new Function('ctx', 'normalizeDataKeys', 'dataFileObj', `
          let dataCache = {}; const dirHandle = {};
          const getSource = () => ({bestand: 'g.json'});
          const readJsonFromDir = async () => ctx.json;
          const bumpDataVersion = () => {};
          const showAlert = m => { ctx.meldingen.push(m); };
          const console = {error(){}};
          let leesKopieModus = false; const __zonderKopie = new Set(); const __volledigeTabel = new WeakSet();
          const __writeChain = new Map(); const __restVan = new WeakMap(); ${haal('restVanBestand')}
          ${haal('ensureDataLoaded')}
          const __dataLaden = new Map(); const __geenKopie = new Set();
          ${haal('laadData')}
          return ensureDataLoaded('g').then(() => dataCache.g);
        `);
        const data = await fn(ctx, eval('(' + haal('normalizeDataKeys').replace(/^function /, 'function _') + ')'), eval('(' + haal('dataFileObj') + ')'));
        ok('inlezen: een waarde zonder getal wordt al gemeld, met de sleutel',
           ctx.meldingen.length === 1 && /zonder getal/.test(ctx.meldingen[0]) && /D20261002T1200/.test(ctx.meldingen[0]), ctx.meldingen);
        ok('inlezen: alle meldingen in één venster (een tweede zou de eerste overschrijven)',
           ctx.meldingen.length === 1 && /datumsleutel klopt niet/.test(ctx.meldingen[0]) && /zonder getal/.test(ctx.meldingen[0]));
        ok('en de leesbare meting staat in de tabel', data && data.D20261001 === 80);
      }
      const uit2 = haal('voerMetingUit');
      ok('na een melding staat de focus op de bevestigknop',
         (uit2.match(/ok\.focus\(\);/g) || []).length === 1 && /document\.getElementById\('btn-save-source'\)\.focus\(\);/.test(haal('toonBronUitkomst')));
      ok('sluiten van het bronvenster leest niets opnieuw in', !/herlaadUitBestanden/.test(haal('resetSourceForm')));
      ok('meer metingen per dag aan of uit: de metingen opnieuw inlezen',
         /oudBestand !== src\.bestand \|\| oudMeer !== !!src\.meerdere_metingen/.test(SCRIPT));
      ok('volgorde: dubbele tik doet niets, en een onmogelijke stap verbergt de balk',
         /if\(volgordeBezig\) return;/.test(haal('moveSelectedSource')) &&
         /if\(idx<0 \|\| newIdx<0 \|\| newIdx>=lijst\.length\) return null;/.test(haal('moveSelectedSource')) &&
         /verbergVolgordeBalk\(\);\s*\n\s*volgordeBezig = true;/.test(haal('moveSelectedSource')));
      ok('volgordebalk: Annuleren links van de actie',
         HTML.indexOf('id="volgorde-annuleer"') < HTML.indexOf('id="volgorde-opnieuw"'));
      ok('de ongebruikte kopie van de bronnenlijst is weg', !/__bronnenOpSchijf|onthoudBronnenOpSchijf/.test(SCRIPT));
      ok('derde review: de datum van de back-up in de eigen tijdzone (niet dateToKey, die rekent in UTC)',
         !/dateToKey\(new Date\(file\.lastModified\)\)/.test(haal('leesBackup')) && /d\.getFullYear\(\)/.test(haal('leesBackup')));
      eindregel();
    })().catch(e => omgevallen('groep 22', e));
  } else {
    koppelingen();
    eindregel();
  }
}
}
