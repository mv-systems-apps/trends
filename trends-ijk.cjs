/* IJkmeting van de grafiek en de tabel van Trends: het vangnet bij het herschikken van
   code (zoals de ijkmeting van de statistieken in Golf Score).

   Tekent een vaste reeks weergaven (kaarten, XmR, groeperingen, lagen, een bron met meer
   metingen per dag) met verzonnen gegevens op een vaste datum, en legt per weergave drie
   vingerafdrukken vast: de pixels van de grafiek, de getallen in lastChartStats en de
   HTML van de tabel. Herschikken mag niets daaraan veranderen.

   Draaien:     node trends-ijk.cjs                 vergelijken met trends-ijk.json
                node trends-ijk.cjs --vastleggen    na een BEDOELDE wijziging opnieuw vastleggen
                MAP=/pad/naar/andere/versie node trends-ijk.cjs
   Bij een verschil staan de nieuwe grafieken als PNG in /tmp/trends-ijk/; teken de oude
   versie met MAP=... en --png om ze naast elkaar te leggen.
   Nodig:       playwright met Chromium. Exit-code: 0 als alles gelijk is, anders 1. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright');
const MAP = process.env.MAP ? path.resolve(process.env.MAP) : __dirname;
const IJK = path.join(__dirname, 'trends-ijk.json');
const VASTLEGGEN = process.argv.includes('--vastleggen'), PNG = process.argv.includes('--png');
const PNGMAP = '/tmp/trends-ijk';
const VANDAAG = '2026-11-01T10:00:00Z';

/* Verzonnen gegevens, vast: elke keer precies dezelfde reeks. */
function reeks(){
  let s = 12345; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 - 0.5; };
  const dag = {}, meer = {}, notities = {}, eind = Date.UTC(2026, 10, 1);
  const sleutel = (t, tijd) => { const d = new Date(t); return 'D' + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0') + (tijd || ''); };
  for(let i = 760; i >= 0; i--){
    const t = eind - i * 864e5, j = 760 - i;
    if(j % 17 === 5 || (j > 300 && j < 306)) continue;                     // gaten
    let v = 82 + 1.5 * Math.sin(j / 58) + rnd() * 0.9;
    if(j > 700 && j < 712) v -= 1.2;                                         // verschuiving
    if(j > 730 && j < 737) v = 81 + (j - 730) * 0.45;                        // trend
    if(j === 748 || j === 750) v = 85.6;                                     // twee van drie
    dag[sleutel(t)] = Math.round(v * 10) / 10;
    if(i < 120){ meer[sleutel(t, 'T0730')] = Math.round((v - 0.3) * 10) / 10; if(j % 3 === 0) meer[sleutel(t, 'T2100')] = Math.round((v + 0.4) * 10) / 10; }
  }
  [700, 731, 745, 755].forEach((j, n) => { notities[sleutel(eind - (760 - j) * 864e5)] = 'notitie ' + (n + 1); });
  notities[sleutel(eind - 8 * 864e5, 'T0730')] = 'met tijd';
  return {dag, meer, notities};
}

/* Elke weergave: [naam, instellingen]. bron: 'dag' of 'meer'. */
function weergaven(){
  const w = [];
  const kaarten = [['x', 'standard', false], ['xmr', 'standard', true], ['range', 'range', false], ['regr', 'regressie', false], ['regrxmr', 'regressie', true], ['prog', 'prognose', false]];
  for(const [kn, kaart, xmr] of kaarten){
    w.push([`dag-3m-${kn}`, {bron: 'dag', periode: '3m', agg: 'd', kaart, xmr}]);
    w.push([`dag-1j-${kn}-week`, {bron: 'dag', periode: '1y', agg: 'w', kaart, xmr}]);
    w.push([`dag-3m-${kn}-alle-lagen`, {bron: 'dag', periode: '3m', agg: 'd', kaart, xmr, lagen: {run: true, jaar: true}}]);
  }
  for(const agg of ['m', 'q', 'y']) w.push([`dag-alles-${agg}`, {bron: 'dag', periode: 'all', agg, kaart: 'standard'}]);
  w.push(['dag-alles-m-regr', {bron: 'dag', periode: 'all', agg: 'm', kaart: 'regressie'}]);
  w.push(['dag-6m-grenzen-uit', {bron: 'dag', periode: '6m', agg: 'd', kaart: 'standard', lagen: {grenzen: false}}]);
  w.push(['dag-6m-doel-uit-notities-uit', {bron: 'dag', periode: '6m', agg: 'd', kaart: 'standard', lagen: {doel: false, notities: false}}]);
  w.push(['dag-1m-gekozen-punt', {bron: 'dag', periode: '1m', agg: 'd', kaart: 'standard', kies: -3}]);
  w.push(['dag-9m-run', {bron: 'dag', periode: '9m', agg: 'd', kaart: 'standard', xmr: true, lagen: {run: true}}]);
  w.push(['dag-1w', {bron: 'dag', periode: '1w', agg: 'd', kaart: 'standard'}]);
  w.push(['dag-1m-gekozen-lege-dag', {bron: 'dag', periode: '1m', agg: 'd', kaart: 'standard', kiesLeeg: true}]);
  w.push(['dag-1m-regr-gekozen-lege-dag', {bron: 'dag', periode: '1m', agg: 'd', kaart: 'regressie', kiesLeeg: true}]);
  w.push(['dag-1y-zonder-puntjes', {bron: 'dag', periode: '1y', agg: 'd', kaart: 'standard', drempel: 100}]);
  for(const [kn, kaart, xmr] of [['x', 'standard', false], ['xmr', 'standard', true], ['regr', 'regressie', false]]){
    w.push([`meer-1m-${kn}-dag`, {bron: 'meer', periode: '1m', agg: 'd', kaart, xmr}]);
    w.push([`meer-1m-${kn}-tijd`, {bron: 'meer', periode: '1m', agg: 'p', kaart, xmr}]);
  }
  w.push(['meer-1m-range-tijd', {bron: 'meer', periode: '1m', agg: 'p', kaart: 'range'}]);
  w.push(['meer-1m-regr-tijd-gekozen', {bron: 'meer', periode: '1m', agg: 'p', kaart: 'regressie', kies: -5}]);
  w.push(['meer-3m-week-alle-lagen', {bron: 'meer', periode: '3m', agg: 'w', kaart: 'standard', lagen: {run: true}}]);
  w.push(['meer-1m-uitgeklapt', {bron: 'meer', periode: '1m', agg: 'd', kaart: 'standard', uitklappen: 2}]);
  return w;
}

const types = {'.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'};
const server = http.createServer((q, r) => {
  const f = path.join(MAP, decodeURIComponent(q.url.split('?')[0]));
  if(!f.startsWith(MAP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream'}); r.end(fs.readFileSync(f));
});
const sha = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);

server.listen(0, async () => {
  let browser, code = 0;
  try{
    browser = await chromium.launch();
    const ctx = await browser.newContext({viewport: {width: 360, height: 740}, deviceScaleFactor: 2, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL'});
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date(VANDAAG));
    const paginafouten = []; p.on('pageerror', e => paginafouten.push(e.message));
    await p.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await p.waitForTimeout(600);
    const {dag, meer, notities} = reeks();
    await p.evaluate(({dag, meer, notities}) => {
      document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; });
      const fout = n => Object.assign(new Error('x'), {name: n});
      dirHandle = {name: 'Trends', getFileHandle: async () => { throw fout('NotFoundError'); }, queryPermission: async () => 'granted', requestPermission: async () => 'granted', values: async function*(){}};
      leesKopieModus = false;
      bronnen = [{id: 'dag', titel: 'Proef per dag', bestand: 'dag.json', eenheid: 'kg', decimalen: 1, doel_x: 82, doel_r: 2, meerdere_metingen: false},
                 {id: 'meer', titel: 'Proef per meting', bestand: 'meer.json', eenheid: 'kg', decimalen: 1, meerdere_metingen: true}];
      bronnenVolledig = true; dataCache = {};
      for(const [id, d, n] of [['dag', dag, notities], ['meer', meer, {}]]){ const t = {...d}; zetTabel(id, t, n, {}); __volledigeTabel.add(t); bumpDataVersion(id); }
      try{ localStorage.clear(); }catch(e){}
      renderSourceList(); renderSourceSelects(); switchToView('data');
      dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
    }, {dag, meer, notities});

    const uit = {};
    for(const [naam, w] of weergaven()){
      const r = await p.evaluate(async (w) => {
        const sel = document.getElementById('data-source-select'); sel.value = w.bron;
        expandedMultiDays.clear(); selectedDataKey = null; selectedIsSubRow = false;
        for(const laag of ['grenzen', 'doel', 'notities', 'run', 'jaar']) vergeetLaag(laag, w.bron);
        bronnen[0].puntjes_drempel = w.drempel ?? null;
        zetXmr(!!w.xmr); dataPeriodFilter = w.periode; dataAggMode = w.agg; chartViewMode = w.kaart;
        for(const [laag, aan] of Object.entries(w.lagen || {})) zetLaag(laag, aan);
        await renderDataView(true);
        if(w.uitklappen){ const k = [...document.querySelectorAll('#data-table-body tr[data-k]')].map(t => t.dataset.k).filter(k => /^\d{8}$/.test(k))[w.uitklappen]; if(k){ expandedMultiDays.add(k); await renderDataView(true); } }
        if(w.kiesLeeg){ const tr = [...document.querySelectorAll('#data-table-body tr[data-k]')].find(t => t.querySelector('.val') && t.querySelector('.val').textContent.trim() === '–'); if(tr) tr.click(); }
        if(w.kies){ const rijen = [...document.querySelectorAll('#data-table-body tr[data-k]')]; const tr = rijen[rijen.length + w.kies] || rijen[0]; if(tr) tr.click(); }
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const c = document.getElementById('data-chart-canvas');
        const st = window.lastChartStats ? JSON.stringify(window.lastChartStats, (k, v) => typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : (v instanceof Date ? v.toISOString() : v)) : '';
        return {png: c.toDataURL('image/png'), stats: st, tabel: document.getElementById('data-table-body').innerHTML};
      }, w);
      uit[naam] = {grafiek: sha(r.png), stats: sha(r.stats), tabel: sha(r.tabel)};
      if(PNG || !VASTLEGGEN){ fs.mkdirSync(PNGMAP, {recursive: true}); fs.writeFileSync(path.join(PNGMAP, naam + '.png'), Buffer.from(r.png.split(',')[1], 'base64')); }
    }
    if(paginafouten.length){ console.log('fouten in de pagina: ' + paginafouten.join(' | ')); code = 1; }
    if(VASTLEGGEN){
      fs.writeFileSync(IJK, JSON.stringify(uit, null, 1) + '\n');
      console.log(`vastgelegd: ${Object.keys(uit).length} weergaven in ${path.basename(IJK)}`);
    } else {
      const ijk = JSON.parse(fs.readFileSync(IJK, 'utf8'));
      let verschil = 0;
      for(const naam of new Set([...Object.keys(ijk), ...Object.keys(uit)])){
        const a = ijk[naam], b = uit[naam];
        if(!a || !b){ console.log(`  ANDERS ${naam}: ${a ? 'niet meer getekend' : 'nieuw, niet in de ijkmeting'}`); verschil++; continue; }
        const delen = ['grafiek', 'stats', 'tabel'].filter(k => a[k] !== b[k]);
        if(delen.length){ console.log(`  ANDERS ${naam}: ${delen.join(', ')}`); verschil++; }
      }
      if(verschil){ console.log(`\n${verschil} van ${Object.keys(uit).length} weergaven anders; de nieuwe grafieken staan in ${PNGMAP}`); code = 1; }
      else console.log(`IDENTIEK — ${Object.keys(uit).length} weergaven: grafiek, getallen en tabel gelijk aan de ijkmeting`);
    }
  } catch(e){ console.log('ijkmeting liep niet tot het eind: ' + e.message); code = 1; }
  finally{ if(browser) await browser.close(); server.close(); process.exit(code); }
});
