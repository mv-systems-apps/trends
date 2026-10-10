#!/usr/bin/env node
/* Regressietests voor Trends.
   Draaien met:  node trends-tests.cjs   (vanuit dezelfde map als trends.html en sw-trends.js)

   De tests halen de functies letterlijk uit trends.html, zodat ze niet uit de pas kunnen
   lopen met de app. Browsergedrag (scrollen, dialogen, DOM) wordt hier NIET getest. */

const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, 'trends.html'), 'utf8');
const SW   = fs.readFileSync(path.join(__dirname, 'sw-trends.js'), 'utf8');
const SCRIPT = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

const haal = naam => {
  const m = SCRIPT.match(new RegExp('^(?:async )?function ' + naam + '\\([\\s\\S]*?\\n\\}', 'm'));
  if (!m) throw new Error('functie niet gevonden in trends.html: ' + naam);
  return m[0];
};
const KERN = ['keyToDate','keyToTimeMinutes','dateToKey','geldigeSleutel','getFlatEntries',
  'aggregateDayValue','getDailyFromFlat','normalizeDataKeys','dataFileObj','computeMeanSigma',
  'computeRBar','todayUTCDate','getWeekStart','getMonthStart','getQuarterStart','getYearStart','getGroupEnd',
  'aggregatePoints'].map(haal).join('\n');
eval(KERN);

let goed = 0, fout = 0;
const ok = (naam, voorwaarde, extra='') => {
  if (voorwaarde) { goed++; console.log('  OK   ' + naam + (extra ? '  — ' + extra : '')); }
  else { fout++; console.log('  FOUT ' + naam + (extra ? '  — ' + extra : '')); }
};
const kop = t => console.log('\n' + t);
const bijna = (a, b, marge=1e-9) => Math.abs(a - b) < marge;

/* Nagebootste serviceworker-omgeving met de echte semantiek van de Cache API:
   relatieve sleutels worden tegen de scope opgelost, de zoekstring hoort bij de
   sleutel tenzij er met ignoreSearch wordt gezocht, en een netwerkantwoord heeft
   een ok-vlag. Zonder die drie dingen toetsen de tests iets anders dan de browser doet. */
const ORIGIN = 'https://mv-systems-apps.github.io';
const SCOPE = ORIGIN + '/';
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
  const netwerk = async (req, init) => {
    const url = abs(req && req.url ? req.url : req);
    log.push({url, cache: init && init.cache});
    if (!online) throw new Error('offline');
    if (new URL(url).origin !== ORIGIN) return {ok: true, status: 200, type: 'cors', clone(){ return this; }};
    if (!server.has(url)) return {ok: false, status: 404, type: 'basic', clone(){ return this; }};
    return {ok: true, status: 200, type: 'basic', body: 'inhoud ' + url, clone(){ return this; }};
  };
  const handlers = {};
  const self = {
    location: {origin: ORIGIN, href: SCOPE},
    addEventListener: (t, f) => { (handlers[t] ||= []).push(f); },
    skipWaiting(){ self.skipWaitingAangeroepen = true; },
    clients: {claim(){}}
  };
  return {
    ORIGIN, SCOPE, abs, store, caches, handlers, self, log,
    zetOffline(){ online = false; },
    zetOnline(){ online = true; },
    maakSw(){ new Function('self', 'caches', 'fetch', SW)(self, caches, netwerk); }
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

/* ---------- 6. mislukte schrijfactie ---------- */
kop('6. Mislukte schrijfactie');
{
  const env = {meldingen: [], faalt: true};
  const t = new Function('env', [
    'const __nietOpgeslagen = new Set();',
    'const dataCache = {b:{}}; const dataFileExists = {}; const dirHandle = {};',
    'function getSource(){ return {bestand:"B.json"}; }',
    'function dataFileObj(d){ return d; }',
    'function showAlert(m){ env.meldingen.push(m); }',
    'async function writeJsonToDir(){ if(env.faalt) throw new Error("geen ruimte"); }',
    haal('syncDataFile'),
    'return { syncDataFile, waarschuwt: ()=> __nietOpgeslagen.size > 0 };'
  ].join('\n'))(env);
  return t.syncDataFile('b').then(async r => {
    ok('geeft false terug', r === false);
    ok('meldt het aan de gebruiker', env.meldingen.length === 1);
    ok('afsluitwaarschuwing blijft staan', t.waarschuwt());
    env.faalt = false;
    ok('na succes: true', await t.syncDataFile('b') === true);
    ok('waarschuwing verdwijnt', !t.waarschuwt());
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
    'function dateToKey(){ return "20261009"; }',
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
/* ---------- 8. externe wijziging ---------- */
kop('8. Externe bestandswijziging');
{
  const env = {schijf: new Map(), mtime: new Map(), vragen: [], klok: 1000, antwoord: false};
  const dirHandle = {
    async getFileHandle(name, opts){
      if (!env.schijf.has(name)) {
        if (!opts || !opts.create) throw Object.assign(new Error('weg'), {name: 'NotFoundError'});
        env.schijf.set(name, ''); env.mtime.set(name, ++env.klok);
      }
      return {
        async getFile(){ return {lastModified: env.mtime.get(name), size: env.schijf.get(name).length, async text(){ return env.schijf.get(name); }}; },
        async createWritable(){ return {async write(t){ env.schijf.set(name, t); env.mtime.set(name, ++env.klok); }, async close(){}}; }
      };
    }
  };
  const t = new Function('env', 'dirHandle', [
    'let __pendingWrites = 0; const __writeChain = new Map();',
    'async function maybeBackupFile(){}',
    'async function showConfirm(m){ env.vragen.push(m); return env.antwoord; }',
    'async function writeHandleJson(h,o){ const w=await h.createWritable(); await w.write(JSON.stringify(o)); await w.close(); }',
    'const __bestandStempel = new Map();',
    haal('leesStempel'), haal('readJsonFromDir'), haal('writeJsonToDir'),
    'return { readJsonFromDir, writeJsonToDir };'
  ].join('\n'))(env, dirHandle);

  (async () => {
    env.schijf.set('B.json', '{"a":1}'); env.mtime.set('B.json', 1001);
    await t.readJsonFromDir('B.json');
    env.schijf.set('B.json', '{"b":2}'); env.mtime.set('B.json', 2002);   // ander tabblad
    let fout = null;
    try { await t.writeJsonToDir('B.json', {c: 3}); } catch (e) { fout = e.name; }
    ok('conflict wordt gevraagd', env.vragen.length === 1);
    ok('bij weigeren niet overschreven', env.schijf.get('B.json') === '{"b":2}' && fout === 'ConflictError');

    env.antwoord = true;
    await t.writeJsonToDir('B.json', {c: 3});
    ok('bij toestemming wel overschreven', env.schijf.get('B.json') === '{"c":3}');

    const vragenVoor = env.vragen.length;
    await t.writeJsonToDir('B.json', {c: 4});
    ok('eigen schrijfactie geeft geen vals alarm', env.vragen.length === vragenVoor);
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
  const huidige = SW.match(/CACHE_VERSION = '([^']+)'/)[1];

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
  // namen van bronnen met een mislukte schrijfactie
  {
    const bronnen = [{id:'b1', titel:'Gewicht'}, {id:'b2', titel:'Km-stand'}];
    const getSource = id => bronnen.find(b => b.id === id);
    const __nietOpgeslagen = new Set();
    eval(haal('openstaandeSchrijfacties'));
    ok('niets open = lege lijst', openstaandeSchrijfacties().length === 0);
    __nietOpgeslagen.add('b2');
    ok('bron bij titel genoemd', openstaandeSchrijfacties().join() === 'Km-stand', openstaandeSchrijfacties().join());
    __nietOpgeslagen.add('__meta');
    ok('meta heet "instellingen" en staat vooraan', openstaandeSchrijfacties().join() === 'instellingen,Km-stand', openstaandeSchrijfacties().join());
    __nietOpgeslagen.add('onbekend');
    ok('onbekende bron valt terug op de id', openstaandeSchrijfacties().includes('onbekend'));
  }

  // de beslissing om te waarschuwen voor herladen
  {
    let herladen = 0, gevraagd = null, antwoord = true;
    const location = {reload: ()=>{ herladen++; }};
    const showConfirm = (msg)=>{ gevraagd = msg; return Promise.resolve(antwoord); };
    let __pendingWrites = 0;
    const __nietOpgeslagen = new Set();
    const getSource = () => null;
    eval(haal('openstaandeSchrijfacties'));
    eval(haal('herlaadVoorUpdate'));

    await herlaadVoorUpdate();
    ok('niets open: herladen zonder vraag', herladen === 1 && gevraagd === null);

    __pendingWrites = 1; gevraagd = null;
    await herlaadVoorUpdate();
    ok('lopende schrijfactie: eerst bevestigen', gevraagd !== null && /nog opgeslagen/.test(gevraagd));
    ok('na bevestiging wordt herladen', herladen === 2);

    antwoord = false; gevraagd = null;
    await herlaadVoorUpdate();
    ok('annuleren laat de pagina staan', herladen === 2 && gevraagd !== null);

    __pendingWrites = 0; antwoord = true; gevraagd = null;
    __nietOpgeslagen.add('b9');
    await herlaadVoorUpdate();
    ok('mislukte schrijfactie wordt in de vraag benoemd', /b9/.test(gevraagd || ''), gevraagd);
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
    ok('nieuwe versie geïnstalleerd = meteen controleren', /updatefound/.test(SCRIPT) && /state === 'installed'/.test(SCRIPT));
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
  const fn = new Function('ctx', 'normalizeDataKeys', 'dataFileObj', 'fmtDateNL', 'dateToKey', `
    const {dirHandle, dataCache, dataFileExists, getSource, showConfirm, showAlert, idbSet, bumpDataVersion, syncDataFile} = ctx;
    ${haal('backupFilename')}
    ${haal('beschadigdFilename')}
    ${haal('leesBackup')}
    ${haal('herstelUitBackup')}
    return herstelUitBackup;
  `);
  return {ctx, herstel: fn(ctx, normalizeDataKeys, dataFileObj, fmtDateNL, dateToKey)};
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
  ok('databestand is weer leesbaar', JSON.parse(ctx.dirHandle.map.get('gewicht.json')).D20261001T1200 === 80);
  ok('back-up zelf blijft ongemoeid', ctx.dirHandle.map.get('gewicht_backup.json') === GOED);
  ok('dataCache gevuld en bestand bestaat', Object.keys(ctx.dataCache.b1).length === 2 && ctx.dataFileExists.b1 === true);
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
  ok('beschadigd bestand wordt bij inlezen aangeboden',
     /if\(await herstelUitBackup\(id\)\) return;/.test(SCRIPT));
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
      let bronnen = [];
      const META_FILENAME = 'trends_meta.json';
      const readJsonFromDir = async ()=> ctx.json;
      const showAlert = m => ctx.meldingen.push(m);
      const renderSourceList = ()=>{}, renderSourceSelects = ()=>{}, validateBronnen = ()=>{};
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
  eval(haal('metaFileObj'));
  const uit = metaFileObj();
  ok('id gaat niet mee naar het bestand', uit.bronnen[0].id === undefined && uit.bronnen[0].titel === 'Gewicht');
  ok('bestand houdt de bronnen-sleutel', Array.isArray(uit.bronnen));
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
  ok('verwijderen wist dataCache, afgeleide cache en bestandsvlag',
     /delete dataCache\[id\];[\s\S]{0,120}derivedCache\.delete\(id\);[\s\S]{0,80}delete dataFileExists\[id\];/.test(SCRIPT));
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
  const document = {activeElement: body, body, contains: () => true};
  const history = {pushState(){}, back(){}};
  const modalStack = [];
  const focusVoorModal = [];
  let suppressNextPopstate = false;
  eval(haal('pushModal') + '\n' + haal('herstelFocus') + '\n' + haal('popModalForClose'));

  document.activeElement = knopA;
  pushModal({close(){}});
  document.activeElement = knopB;
  pushModal({close(){}});
  ok('twee dialogen open, twee onthouden focussen', modalStack.length === 2);
  popModalForClose();
  ok('bovenste dicht: focus terug naar B', gefocust.join() === 'B', gefocust.join());
  popModalForClose();
  ok('onderste dicht: focus terug naar A', gefocust.join() === 'B,A', gefocust.join());
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
  const huidige = SW.match(/CACHE_VERSION = '([^']+)'/)[1];

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

    /* Een gewoon bestand mag de query juist niet negeren: ?v=2 hoort opnieuw te worden
       gehaald. Offline levert dat geen oude kopie en ook geen undefined meer, maar een
       net 503-antwoord. */
    {
      const res = await vraag(ORIGIN + '/icon.svg?v=2', 'no-cors');
      ok('bestand met andere query valt niet terug op de oude kopie', !!res && res.status === 503, res && res.status);
    }
    ok('bestand zonder query komt wel uit de cache', !!(await vraag(ORIGIN + '/icon.svg', 'no-cors')));

    // en de bestaande afspraken blijven staan
    ok('ander domein blijft buiten de cache', (await vraag('https://cdn.example.com/x.js', 'no-cors')) === undefined);
    ok('niet-GET gaat de serviceworker voorbij', (await vraag(ORIGIN + '/trends.html', 'navigate', 'POST')) === undefined);
    ok('alleen navigaties negeren de query', /isNavigatie \? \{ ignoreSearch: true \}/.test(SW));

    await deel19();
  })();
}
}

/* ---------- 19. installatie en offline-terugval ---------- */
async function deel19(){
kop('19. Betrouwbare installatie en offline-terugval');

const huidige = SW.match(/CACHE_VERSION = '([^']+)'/)[1];
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
// een onbekende pagina offline valt terug op de bewaarde app
{
  const env = swOmgeving();
  await installeer(env);
  env.zetOffline();
  const onbekend = await vraagVan(env)(env.ORIGIN + '/nog-niet-bestaand.html', 'navigate');
  ok('onbekende pagina offline valt terug op de bewaarde app', !!onbekend && onbekend.status === 200, onbekend && onbekend.status);
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

console.log('\n' + '='.repeat(60));
console.log(goed + ' geslaagd, ' + fout + ' mislukt');
console.log('NIET getest (vereist een browser of toestel): scrollen, DOM-weergave,');
console.log('schermlezer en focusvolgorde, of de serviceworker werkelijk een nieuwe');
console.log('versie ophaalt, een gedwongen afsluiting door Android, ontbrekende');
console.log('maptoestemming en een werkelijk volle opslag.');
process.exit(fout ? 1 : 0);
}
