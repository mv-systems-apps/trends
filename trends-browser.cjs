/* trends.html echt in Chromium, op telefoonformaat (360x740), via een eigen
   http-server. De werkmap is nagebootst in het geheugen van de pagina (zelfde
   vorm als de File System Access API: getFileHandle, getFile, createWritable),
   zodat te zien is wat er werkelijk in de bestanden komt.

   Wat dit test en trends-tests.cjs niet kan: de vensters zelf. Welke melding er
   staat, welke knop met welke kleur, of de prullenbak weg is, of het venster open
   blijft, waar de focus staat, en wat er na het opslaan in het bestand staat.

   Draaien:   node trends-browser.cjs            (map = de map van dit script)
              MAP=/pad/naar/oude/versie node trends-browser.cjs
   Nodig:     playwright met Chromium (require('playwright'); zet NODE_PATH als
              het niet in deze map is geinstalleerd).
   Exit-code: 0 als alles goed is, anders 1. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const MAP = process.env.MAP ? path.resolve(process.env.MAP) : __dirname;

const fouten = []; let n = 0;
function eis(naam, kreeg, verwacht){
  n++;
  const ok = JSON.stringify(kreeg) === JSON.stringify(verwacht);
  console.log((ok ? '  OK   ' : '  FOUT ') + naam + (ok ? '' : '  — kreeg ' + JSON.stringify(kreeg) + ', verwacht ' + JSON.stringify(verwacht)));
  if(!ok) fouten.push(naam);
}

const types = {'.html':'text/html;charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png'};
const server = http.createServer((q, r) => {
  const f = path.join(MAP, decodeURIComponent(q.url.split('?')[0]));
  if(!f.startsWith(MAP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});

/* een kaart kiezen in de pagina (zie __zetKaart); op elke pagina die de tests openen */
const ZETKAART = () => {
  /* een kaart kiezen; xmr en regressieXmr zijn sinds 13528F4-001 x̄ of ŷ met de laag XmR.
     Bij x̄ en ŷ zonder XmR gaat die laag uit, zodat een eerdere test niet doorwerkt. */
  window.__zetKaart = w => { const b = basisWeergave(w); chartViewMode = b;
    if(b === 'standard' || b === 'regressie'){ if(w !== b){ zetLaag('grenzen', true); zetLaag('xmr', true); } else if(laagIsAan('xmr')) zetLaag('xmr', false); } };
};

server.listen(0, async () => {
  let browser;
  try{
    browser = await chromium.launch();
    /* Elke controle faalt los: een evaluate of klik die omvalt (bv. tegen een oudere versie
       zonder die functie of knop) geeft 'FOUT: …' terug in plaats van de hele run te stoppen */
    /* Een vaste dag: veel controles gebruiken metingen van oktober en november 2026 in de periode
       '1 maand' en vielen anders rond december om. De pagina's denken dat het 8 november 2026 is,
       10:00; de klok loopt vanaf daar gewoon door. Een andere dag: DATUM=2026-12-20. */
    const VASTE_DAG = process.env.DATUM || '2026-11-08';
    const veilig = async (pg, klok = true) => { const ev = pg.evaluate.bind(pg), kl = pg.click.bind(pg);
      if(klok) await pg.clock.install({time: new Date(VASTE_DAG + 'T10:00:00')});
      pg.evaluate = (...a) => ev(...a).catch(e => 'FOUT: ' + String(e && e.message).split('\n')[0]);
      pg.click = (...a) => kl(a[0], Object.assign({timeout: 4000}, a[1] || {})).catch(e => 'FOUT: ' + String(e && e.message).split('\n')[0]);
      return pg; };
    const p = await veilig(await browser.newPage({viewport: {width: 360, height: 740}}));
    const paginafouten = [];
    p.on('pageerror', e => paginafouten.push(e.message));
    await p.addInitScript(ZETKAART);
    await p.goto('http://127.0.0.1:' + server.address().port + '/trends.html');
    await p.waitForTimeout(600);

    /* Een schone werkmap met de bron Gewicht (één meting per dag) en twee metingen.
       window.__faal: schrijven mislukt (behalve de backup); window.__traag: schrijven
       duurt 300 ms (of zoveel ms als __traag een getal is). */
    const opzetFn = () => {
      /* Het databestand is tekst (13528F3-003): __data maakt er een van een object zoals de
         tests het opschrijven, __leesData leest het terug. Eigen code, los van de app. */
      window.__data = obj => Object.keys(obj).sort().map(k => { const v = obj[k];
        if(v && typeof v === 'object') return k + ';' + (v.waarde == null ? '' : v.waarde) + (v.notitie ? ';' + v.notitie : '');
        return k + ';' + v; }).join('\n') + '\n';
      window.__leesData = t => { const o = {}; t.split(/\r?\n/).filter(r => r !== '').forEach(r => {
        const d = r.split(';'), k = d[0], w = d[1], n = d[2]; let v = r;
        if(d.length <= 3 && /^D/.test(k) && /^-?\d+(\.\d+)?$/.test(w || '')) v = n ? {waarde: +w, notitie: n} : +w;
        else if(d.length === 3 && w === '' && n) v = {notitie: n};
        o[k in o ? k + '#2' : k] = v; }); return o; };
      document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; });
      if(typeof modalStack !== 'undefined') modalStack.length = 0;
      const schijf = {}; let klok = 1000;
      window.__fs = schijf; window.__faal = false; window.__traag = false;
      const fout = naam => Object.assign(new Error('x'), {name: naam});
      const h = naam => ({name: naam,
        getFile: async () => { if(!schijf[naam]) throw fout('NotFoundError'); const f = schijf[naam];
          /* f.bytes: een bestand dat geen UTF-8 is (13528F3-003) */
          const b = f.bytes || new TextEncoder().encode(f.tekst);
          return {lastModified: f.mtime, size: b.length, text: async () => f.tekst, arrayBuffer: async () => b.slice().buffer}; },
        createWritable: async () => {
          if(window.__traag) await new Promise(r => setTimeout(r, window.__traag === true ? 300 : window.__traag));
          if(window.__faal && !/_backup/.test(naam)) throw fout('NotAllowedError');
          let buf = '';
          /* bytes (een back-up of het bewaarde beschadigde bestand) blijven bytes */
          let bytes = null;
          return {write: async t => { if(typeof t === 'string') buf += t; else bytes = new Uint8Array(t instanceof ArrayBuffer ? t : t.buffer).slice(); },
            close: async () => { klok += 1000; schijf[naam] = bytes ? {tekst: new TextDecoder().decode(bytes), bytes, mtime: klok} : {tekst: buf, mtime: klok}; }};
        }});
      dirHandle = {name: 'Trends',
        getFileHandle: async (naam, o) => { if(!schijf[naam] && !(o && o.create)) throw fout('NotFoundError'); return h(naam); },
        queryPermission: async () => 'granted', requestPermission: async () => 'granted', values: async function*(){}};
      leesKopieModus = false;
      bronnen = [{id:'g', titel:'Gewicht', bestand:'gewicht.txt', eenheid:'kg', decimalen:1, meerdere_metingen:false}];
      schijf['trends.json'] = {tekst: JSON.stringify(metaFileObj()), mtime: 500};
      schijf['gewicht.txt'] = {tekst: __data({D20261016: 82.0, D20261017: 82.0}), mtime: 600};
      dataCache = {g: {D20261016: 82.0, D20261017: 82.0}}; bumpDataVersion('g');
      /* de tabel en de bronnenlijst zijn ingelezen uit het bestand. Werkt ook op 019 en
         eerder (MAP=…): daar heetten de onderdelen anders. */
      if(typeof __volledigeTabel !== 'undefined'){ __volledigeTabel.add(dataCache.g); bronnenVolledig = true; }
      if(typeof __bestandStempel !== 'undefined') __bestandStempel.set('trends.json', {lastModified: 500, size: schijf['trends.json'].tekst.length});
      /* en de tekst die het las (13528F3-002) */
      if(typeof __tekstVan !== 'undefined'){ __tekstVan.clear(); for(const n of ['trends.json', 'gewicht.txt']) __tekstVan.set(n, schijf[n].tekst); }
      if(typeof metingForceer !== 'undefined'){ metingForceer = false; metingForceerWObj = null; metingActie = 'opslaan'; }
      renderSourceList(); renderSourceSelects(); setFileLinkUI('dir', 'linked', {name: 'Trends'});
      document.getElementById('data-source-select').value = 'g';
      switchToView('data');
    };
    const opzet = () => p.evaluate(opzetFn);
    const wacht = ms => p.waitForTimeout(ms);
    const zien = id => p.evaluate(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden; }, id);
    const tekst = id => p.evaluate(id => { const e = document.getElementById(id); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : '(geen)'; }, id);
    const knop = id => p.evaluate(id => { const e = document.getElementById(id); return e.textContent.trim() + ' ' + (e.className.match(/\b(warn|danger)\b/) || ['gewoon'])[0]; }, id);
    const bestand = naam => p.evaluate(naam => !window.__fs[naam] ? null : /^trends/.test(naam) ? JSON.parse(window.__fs[naam].tekst) : __leesData(window.__fs[naam].tekst), naam);
    const focus = () => p.evaluate(() => document.activeElement && document.activeElement.id);
    const buiten = (naam, obj) => p.evaluate(([naam, obj]) => { window.__fs[naam] = {tekst: /^trends/.test(naam) ? JSON.stringify(obj) : __data(obj), mtime: 700 + Math.random()}; }, [naam, obj]);
    const meting = (key, waarde) => p.evaluate(([key, waarde]) => {
      openEditDatapointModal('g', key);
      document.getElementById('f-data-value').value = waarde;
      document.getElementById('btn-add-datapoint').click();
    }, [key, waarde]);

    console.log('Notities (13528A7-002)');
    {
      /* Elke stap vangt zijn eigen fout op: op een versie zonder notities telt elke controle
         apart als fout, in plaats van dat de hele test bij de eerste afbreekt. */
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      /* een bron met notities in het bestand: met meting, zonder meting, en een lange van buiten */
      const lang = 'x'.repeat(300);
      const zetBestand = (obj, extra) => pe(async ([obj, extra]) => {
        Object.assign(bronnen[0], extra || {});
        window.__fs['gewicht.txt'] = {tekst: __data(obj), mtime: 900};
        dataCache = {}; await ensureDataLoaded('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; __zetKaart('standard');
        selectedDataKey = null; await renderDataView();
      }, [obj, extra]);
      const meldingen = () => pe(() => document.getElementById('alert-overlay').style.display !== 'none' ? document.getElementById('alert-text').textContent : '');
      const rij = k => pe(k => { const tr = document.querySelector(`#data-table-body tr[data-k="${k}"]`); return tr ? [tr.querySelector('.val').textContent.trim(), tr.classList.contains('met-notitie')] : null; }, k);
      const kies = k => pe(k => { document.querySelector(`#data-table-body tr[data-k="${k}"]`).click(); }, k);
      const notitieRij = () => pe(() => { const r = document.querySelector('#data-table-body tr.notitie-rij'); return r ? r.textContent : null; });
      const open = k => pe(k => { openEditDatapointModal('g', k); return [document.getElementById('f-data-value').value, isExplicitEmpty, document.getElementById('f-data-notitie').value, document.getElementById('datapoint-modal-title').textContent]; }, k);
      const zetVeld = (waarde, notitie) => pe(([waarde, notitie]) => {
        if(waarde !== null){ const v = document.getElementById('f-data-value'); v.value = waarde; v.dispatchEvent(new Event('input')); }
        if(notitie !== null){ const n = document.getElementById('f-data-notitie'); n.value = notitie; n.dispatchEvent(new Event('input')); }
      }, [waarde, notitie]);
      const ok = async () => { await pe(() => document.getElementById('btn-add-datapoint').click()); await wacht(300); };
      const sluitVenster = async () => { await pe(() => { closeDatapointModalInner(); modalStack.length = 0; }); await wacht(100); };
      const bevestig = async () => { await pe(() => document.getElementById('confirm-ok').click()); await wacht(300); };

      /* gegroepeerd (week, maand, jaar): het hoekje op de groep met een notitie, en aangetikt
         de notities van die periode met de datum ervoor (13528ED-003) */
      await opzet();
      await zetBestand({D20230310: 80.0, D20240514: {waarde: 81.0, notitie: 'nieuwe banden'}, D20240902: {notitie: 'lease verlengd'}, D20241120: 82.0,
        D20250601: 83.0, D20260115: 84.0, D20220704: {notitie: 'alleen een notitie'}, D20210301: 79.0});
      const perJaar = async (agg) => { await pe(async (agg) => { dataPeriodFilter = 'all'; dataAggMode = agg; selectedDataKey = null; await renderDataView(); }, agg); };
      await perJaar('y');
      /* de samengevouwen reeks waar datum k in valt: heeft hij het hoekje (null: geen reeks),
         en hem uitvouwen */
      const reeksMet = k => pe(k => { const r = [...document.querySelectorAll('#data-table-body tr.gap-summary-row')].find(r => { const [a, b] = r.dataset.gapRun.split('_'); return a <= k && k <= b; });
        return r ? r.classList.contains('met-notitie') : null; }, k);
      const vouwOpen = k => pe(async k => { const r = [...document.querySelectorAll('#data-table-body tr.gap-summary-row')].find(r => { const [a, b] = r.dataset.gapRun.split('_'); return a <= k && k <= b; });
        if(r){ r.click(); await new Promise(z => setTimeout(z, 150)); } }, k);
      eis('per jaar: een jaar met een notitie krijgt het hoekje, een jaar zonder niet', [(await rij('20241231'))[1], (await rij('20251231'))[1], (await rij('20231231'))[1]], [true, false, false]);
      eis('per jaar: een los leeg jaar met alleen een notitie (tussen twee metingen) staat er, met streepje en hoekje', await rij('20221231'), ['–', true]);
      await kies('20241231');
      eis('per jaar: het jaar aangetikt toont zijn notities, met de datum ervoor, oud naar nieuw', await notitieRij(), '14-05-2024  nieuwe banden\n02-09-2024  lease verlengd');
      await kies('20241231');
      eis('nog een tik: de notitieregel weg', await notitieRij(), null);
      await perJaar('m');
      eis('per maand: alleen de maanden met een notitie', [(await rij('20240531'))[1], (await rij('20241130'))[1]], [true, false]);
      /* een maand met alleen een notitie blijft in de ingeklapte reeks lege maanden; die regel
         krijgt het hoekje, en uitgevouwen staat de maand er met zijn hoekje */
      eis('per maand: een maand met alleen een notitie zit in de ingeklapte reeks, met het hoekje op de regel', [await rij('20240930'),
        await reeksMet('20240930')], [null, true]);
      await vouwOpen('20240930');
      eis('per maand: uitgevouwen staat de maand er, met streepje en hoekje', await rij('20240930'), ['–', true]);
      await kies('20240930');
      eis('per maand: de notitie van die maand', await notitieRij(), '02-09-2024  lease verlengd');
      eis('het hoekje is lichtgrijs, de kleur van de driehoekjes in de grafiek', await pe(() => getComputedStyle(document.querySelector('#data-table-body tr.met-notitie td'), '::before').borderTopColor), 'rgb(200, 210, 215)');
      await pe(async () => { zetLaag('notities', false); await renderDataView(true); });
      eis('per maand, laag Notities uit: geen hoekjes (ook niet op een ingeklapte reeks) en geen notitieregel', await pe(() => [document.querySelectorAll('#data-table-body tr.met-notitie').length, !!document.querySelector('#data-table-body tr.notitie-rij')]), [0, false]);
      await pe(async () => { zetLaag('notities', true); vergeetLaag('notities', 'g'); dataAggMode = 'd'; dataPeriodFilter = '1m'; selectedDataKey = null; await renderDataView(); });

      await opzet();
      await zetBestand({D20261020: 81.0, D20261021: {waarde: 81.4, notitie: 'Terug van vakantie, twee dagen niet gewogen'}, D20261023: {notitie: 'dieet gestart'}, D20261025: {waarde: 80.9, notitie: lang}});
      eis('inlezen: een notitie is geen "regel zonder getal"', await meldingen(), '');
      eis('de tabel: meting met notitie heeft het hoekje, zonder notitie niet', [await rij('20261021'), await rij('20261020')], [['81.4', true], ['81.0', false]]);
      /* een dag met alleen een notitie blijft in de ingeklapte reeks lege dagen (de lijst blijft
         compact); de regel '⋯ n dagen ⋯' krijgt het hoekje, uitgevouwen staat de dag er */
      eis('een dag met alleen een notitie: in de ingeklapte reeks, en die regel heeft het hoekje', [await rij('20261023'), await reeksMet('20261023')], [null, true]);
      eis('een reeks lege dagen zonder notitie: geen hoekje', await pe(() => [...document.querySelectorAll('#data-table-body tr.gap-summary-row')].filter(r => !r.classList.contains('met-notitie')).length > 0), true);
      await vouwOpen('20261023');
      eis('de regels ⋯ samenvouwen ⋯ en ⋯ n dagen ⋯ zijn even hoog als een gewone rij', await pe(() => {
        const h = sel => [...document.querySelectorAll('#data-table-body ' + sel)].map(r => Math.round(r.getBoundingClientRect().height));
        const rij = h('tr[data-k]:not(.today-row)')[0]; return [h('tr.gap-collapse-row').length > 0 && h('tr.gap-collapse-row').every(x => x === rij), h('tr.gap-summary-row').length > 0 && h('tr.gap-summary-row').every(x => x === rij)]; }), [true, true]);
      eis('uitgevouwen: de dag met een streepje en het hoekje', await rij('20261023'), ['–', true]);
      eis('alleen een notitie telt niet mee: n is het aantal metingen', await pe(() => window.lastChartStats.n), 3);
      await kies('20261021');
      eis('de gekozen rij toont de notitie eronder, met de regel zoals getypt', await notitieRij(), 'Terug van vakantie, twee dagen niet gewogen');
      await kies('20261020');
      eis('een rij zonder notitie: geen notitieregel', await notitieRij(), null);
      eis('het hoekje: linksboven in de datumcel, de waardekolom zonder icoon', await pe(() => { const tr = document.querySelector('#data-table-body tr.met-notitie[data-k="20261021"]');
        if(!tr) return null; const td = tr.cells[0], h = getComputedStyle(td, '::before');
        return [h.content, h.borderTopWidth, h.left, h.top, tr.querySelectorAll('.val svg').length]; }), ['""', '9px', '0px', '0px', 0]);
      eis('het hoekje op de rij van vandaag staat over de balk van vandaag, zoals bij de andere rijen (13528ED-003)', await pe(async () => {
        const k = dateToKey(todayUTCDate()); const vandaag = 'D' + k; const n = {...notitiesVan('g')}; n[vandaag] = 'vandaag'; __notitiesVan.set(dataCache.g, n); await renderDataView();
        const tr = document.querySelector(`#data-table-body tr[data-k="${k}"]`); const r = tr ? [tr.classList.contains('today-row'), getComputedStyle(tr.cells[0], '::before').left, getComputedStyle(tr.cells[0]).boxShadow.includes('3px 0px 0px')] : null;
        delete n[vandaag]; __notitiesVan.set(dataCache.g, n); await renderDataView(); return r; }), [true, '0px', true]);

      /* de focus bij openen: in het veld Waarde, met de cursor achter de waarde (13528EF-002; eerst geselecteerd); bij alleen lezen niet */
      const focusBij = (k, lezen) => pe(([k, lezen]) => { bronnen[0].bewerken_in_trends = !lezen; openEditDatapointModal('g', k);
        const a = document.activeElement, v = document.getElementById('f-data-value');
        const r = [a === v, a === v && v.value !== '' ? [v.selectionStart, v.selectionEnd] : null];
        closeDatapointModalInner(); modalStack.length = 0; bronnen[0].bewerken_in_trends = true; return r; }, [k, lezen]);
      eis('bewerken: de focus in Waarde, de cursor achter de waarde (13528EF-002)', await focusBij('20261021', false), [true, [4, 4]]);
      eis('een dag met alleen een notitie: de focus in Waarde', await focusBij('20261023', false), [true, null]);
      eis('toevoegen op een lege dag: de focus in Waarde, de cursor achter het voorstel (13528EF-002)', await pe(() => { const r = (() => { openEditDatapointModal('g', '20261027');
        const v = document.getElementById('f-data-value'); return [document.activeElement === v, v.value !== '' && v.selectionStart === v.value.length && v.selectionEnd === v.value.length]; })();
        closeDatapointModalInner(); modalStack.length = 0; return r; }), [true, true]);
      eis('alleen lezen: geen focus in Waarde', (await focusBij('20261021', true))[0], false);

      /* terugzetten per veld, naar wat er stond bij het openen (13528EE-001) */
      const uk = () => pe(() => { const v = document.getElementById('f-data-value'), n = document.getElementById('f-data-notitie');
        return {w: !document.getElementById('btn-undo-waarde').disabled, n: !document.getElementById('btn-undo-notitie').disabled,
                waarde: v.value, leeg: isExplicitEmpty, ph: v.placeholder, notitie: n.value}; });
      const tik = id => pe(id => document.getElementById(id).click(), id);
      await open('20261021');
      eis('net geopend: beide pijltjes uit', (await uk()), {w: false, n: false, waarde: '81.4', leeg: false, ph: '', notitie: 'Terug van vakantie, twee dagen niet gewogen'});
      await zetVeld('80', null);
      eis('een andere waarde getypt: het pijltje bij Waarde aan, bij Notitie niet', [(await uk()).w, (await uk()).n], [true, false]);
      await tik('btn-undo-waarde');
      eis('terug: de oude waarde, cursor achteraan, en het pijltje weer uit', [await uk(), await pe(() => { const v = document.getElementById('f-data-value'); return document.activeElement === v && v.selectionStart === v.value.length && v.selectionEnd === v.value.length; })],
        [{w: false, n: false, waarde: '81.4', leeg: false, ph: '', notitie: 'Terug van vakantie, twee dagen niet gewogen'}, true]);
      await tik('btn-no-measurement'); eis('het streepje: het pijltje bij Waarde aan', (await uk()).w, true);
      await tik('btn-undo-waarde'); eis('terug na het streepje: de waarde, zonder – geen meting –', (await uk()), {w: false, n: false, waarde: '81.4', leeg: false, ph: '', notitie: 'Terug van vakantie, twee dagen niet gewogen'});
      await tik('btn-no-notitie'); eis('het kruisje: het pijltje bij Notitie aan, bij Waarde niet', [(await uk()).n, (await uk()).w], [true, false]);
      await tik('btn-undo-notitie'); eis('terug na het kruisje: de notitie terug, het pijltje uit', [(await uk()).notitie, (await uk()).n, await pe(() => document.getElementById('f-data-notitie').placeholder)], ['Terug van vakantie, twee dagen niet gewogen', false, '– geen notitie –']);   // de placeholder is er altijd, maar onzichtbaar naast tekst (13528F3-001)
      await zetVeld(null, 'anders'); await tik('btn-undo-notitie');
      eis('een getypte notitie terug: de oude tekst', (await uk()).notitie, 'Terug van vakantie, twee dagen niet gewogen');
      eis('alles terug: het venster is niet gewijzigd (sluiten vraagt niets)', await pe(() => modalStack[modalStack.length - 1].isDirty()), false);
      await sluitVenster();
      const voorstelLeeg = (await open('20261027'))[0];
      await tik('btn-no-measurement'); await tik('btn-undo-waarde');
      eis('toevoegen: het streepje en terug geeft het voorstel weer', [(await uk()).waarde, (await uk()).leeg], [voorstelLeeg, false]);
      await sluitVenster();
      await open('20261023'); await zetVeld('80.5', null);
      eis('een dag met alleen een notitie: een getypte waarde, het pijltje aan', (await uk()).w, true);
      await tik('btn-undo-waarde');
      eis('terug: weer – geen meting –', [(await uk()).waarde, (await uk()).leeg, (await uk()).ph, (await uk()).w], ['', true, '– geen meting –', false]);
      eis('het tijdveld heeft dezelfde achtergrond als de andere velden', await pe(() => { const c = id => getComputedStyle(document.getElementById(id)).backgroundColor; return c('f-data-time') === c('f-data-value'); }), true);
      eis('de knoppen staan onder elkaar: de pijltjes en het streepje met het kruisje', await pe(() => { const x = id => Math.round(document.getElementById(id).getBoundingClientRect().left);
        return [x('btn-undo-waarde') === x('btn-undo-notitie'), x('btn-no-measurement') === x('btn-no-notitie')]; }), [true, true]);
      await sluitVenster();

      eis('bewerken: de datum als tekst, de tijd en de waarde in een vakje, niets breder dan Notitie (13528EE-005)', await pe(() => { bronnen[0].meerdere_metingen = true; openEditDatapointModal('g', 'D20261021T0800');
        const c = id => getComputedStyle(document.getElementById(id)).backgroundColor; const rechts = id => Math.round(document.getElementById(id).getBoundingClientRect().right);
        const r = [c('f-data-date-display'), c('f-data-time') !== 'rgba(0, 0, 0, 0)', c('f-data-value') !== 'rgba(0, 0, 0, 0)', rechts('f-data-time') <= rechts('f-data-notitie') && rechts('f-data-value') === rechts('f-data-notitie')];
        closeDatapointModalInner(); modalStack.length = 0; bronnen[0].meerdere_metingen = false; return r; }), ['rgba(0, 0, 0, 0)', true, true, true]);
      eis('meer metingen per dag: datum en tijd op één regel, de datum heel (zoals in Golf Score)', await pe(() => { bronnen[0].meerdere_metingen = true; openEditDatapointModal('g', 'D20261021T0800');
        const t = document.getElementById('f-data-time'), d = document.getElementById('f-data-date-display'), tx = document.getElementById('f-data-date-text');
        const r = [Math.round(t.getBoundingClientRect().top) === Math.round(d.getBoundingClientRect().top), tx.scrollWidth <= d.clientWidth];
        closeDatapointModalInner(); modalStack.length = 0; bronnen[0].meerdere_metingen = false; return r; }), [true, true]);
      // de waarde wijzigen laat de notitie staan
      eis('venster op een meting met notitie: waarde en notitie', await open('20261021'), ['81.4', false, 'Terug van vakantie, twee dagen niet gewogen', 'Meting bewerken']);
      await zetVeld('81.2', null); await ok();
      eis('alleen de waarde gewijzigd: de notitie blijft in het bestand', (await bestand('gewicht.txt')).D20261021, {waarde: 81.2, notitie: 'Terug van vakantie, twee dagen niet gewogen'});
      await open('20261025'); await zetVeld('80.7', null); await ok();
      eis('een notitie van 300 tekens (van buiten) wordt niet ingekort bij het wijzigen van de waarde', (await bestand('gewicht.txt')).D20261025, {waarde: 80.7, notitie: lang});

      // een notitie toevoegen aan een meting
      await open('20261020'); await zetVeld(null, '  na de sportschool  '); await ok();
      eis('notitie toevoegen: in het bestand als object, zonder spaties eromheen', (await bestand('gewicht.txt')).D20261020, {waarde: 81.0, notitie: 'na de sportschool'});

      // alleen een notitie: openen zonder voorgestelde waarde, OK verzint geen meting
      eis('een dag met alleen een notitie opent met een lege waarde, Geen meting aan', await open('20261023'), ['', true, 'dieet gestart', 'Meting toevoegen']);
      await ok();
      eis('en OK zonder iets te wijzigen voegt geen meting toe', (await bestand('gewicht.txt')).D20261023, {notitie: 'dieet gestart'});

      // een lege dag: waarde leeg en een notitie
      const leeg = await open('20261027');
      eis('een lege dag stelt nog steeds een waarde voor', leeg[0] !== '' && leeg[1] === false && leeg[2] === '', true);
      await zetVeld('', 'nieuwe weegschaal'); await ok();
      eis('waarde leeg met een notitie: alleen de notitie wordt bewaard', (await bestand('gewicht.txt')).D20261027, {notitie: 'nieuwe weegschaal'});

      // Geen meting: de waarde weg, de notitie blijft
      await open('20261021');
      await pe(() => document.getElementById('btn-no-measurement').click());
      await ok(); await bevestig();
      eis('Geen meting op een meting met notitie: de waarde weg, de notitie blijft', (await bestand('gewicht.txt')).D20261021, {notitie: 'Terug van vakantie, twee dagen niet gewogen'});
      // waarde en notitie leeg: de dag helemaal weg
      await open('20261021'); await zetVeld(null, ''); await ok();
      eis('Geen meting en de notitie leeg: de dag is helemaal weg', 'D20261021' in (await bestand('gewicht.txt')), false);

      /* geen prullenbak meer: verwijderen gaat met Geen meting en Geen notitie, en dan Opslaan (13528ED-002) */
      eis('er is geen prullenbak meer in het metingvenster', await pe(() => document.getElementById('btn-delete-datapoint')), null);
      await open('20261020');
      eis('Geen notitie (×) staat in de kop van het veld, de teller onder het veld, rechts (13528EE-002)', await pe(() => { const b = document.getElementById('btn-no-notitie'), t = document.getElementById('f-data-notitie-teller'), v = document.getElementById('f-data-notitie');
        const rb = t.getBoundingClientRect(), rv = v.getBoundingClientRect(), rk = b.getBoundingClientRect();
        return b ? [b.title, rk.bottom <= rv.top, rb.top >= rv.bottom - 1, Math.abs(rb.right - rv.right) < 2] : null; }), ['Geen notitie', true, true, true]);
      eis('datum en tijd zijn twee velden naast elkaar, met dezelfde rand als Waarde (13528EE-003)', await pe(() => { const t = document.getElementById('f-data-time'), d = document.getElementById('f-data-date-display');
        const c = (e, k) => getComputedStyle(e)[k]; return [d.contains(t), c(t, 'borderTopColor') === c(document.getElementById('f-data-value'), 'borderTopColor')]; }), [false, true]);
      await pe(() => document.getElementById('btn-no-notitie').click());
      eis('× maakt het veld leeg, de teller op 0, en bewaart nog niets', [await pe(() => document.getElementById('f-data-notitie').value), await tekst('f-data-notitie-teller'), (await bestand('gewicht.txt')).D20261020],
        ['', '0 / 250', {waarde: 81.0, notitie: 'na de sportschool'}]);
      /* grijze actieknoppen: geen kleur, een tweede tik doet niets terug; het veld zegt het (13528ED-002) */
      const knopStand = () => pe(() => { const n = document.getElementById('f-data-notitie'), v = document.getElementById('f-data-value'),
        kleur = id => getComputedStyle(document.getElementById(id)).backgroundColor;
        return [n.value, n.placeholder, v.value, v.placeholder, kleur('btn-no-notitie') === kleur('btn-no-measurement'),
          document.getElementById('btn-no-notitie').classList.contains('active'), document.getElementById('btn-no-measurement').classList.contains('active')]; });
      eis('na ×: het veld zegt – geen notitie –, de knop kleurt niet', await knopStand(), ['', '– geen notitie –', '81.0', '', true, false, false]);
      await pe(() => document.getElementById('btn-no-notitie').click());
      eis('een tweede tik op × zet niets terug', (await knopStand()).slice(0, 2), ['', '– geen notitie –']);
      await zetVeld(null, 'n');
      eis('typen: de tekst staat erin, de placeholder blijft (en is dan onzichtbaar) (13528F3-001)', (await knopStand()).slice(0, 2), ['n', '– geen notitie –']);
      await pe(() => document.getElementById('btn-no-measurement').click());
      eis('het streepje: de waarde leeg, het veld zegt – geen meting –, de knop kleurt niet', (await knopStand()).slice(2), ['', '– geen meting –', true, false, false]);
      await pe(() => document.getElementById('btn-no-measurement').click());
      eis('een tweede tik op het streepje: nog steeds geen meting', [(await knopStand())[2], await pe(() => isExplicitEmpty)], ['', true]);
      await pe(() => closeDatapointModalInner()); await wacht(150);
      await open('20261020');
      eis('opnieuw geopend: de notitie en de waarde er weer, zonder – geen meting – (de notitie-placeholder staat er, onzichtbaar naast tekst)', (await knopStand()).slice(0, 4), ['na de sportschool', '– geen notitie –', '81.0', '']);
      await pe(() => document.getElementById('btn-no-notitie').click());
      await ok();
      eis('× en Opslaan: de notitie weg, de meting blijft', (await bestand('gewicht.txt')).D20261020, 81.0);
      await open('20261023'); await pe(() => document.getElementById('btn-no-notitie').click()); await ok();
      eis('alleen een notitie: × en Opslaan, de dag is weg zonder vraag of melding', ['D20261023' in (await bestand('gewicht.txt')), await meldingen(), await pe(() => document.getElementById('confirm-overlay').style.display === 'flex')], [false, '', false]);
      await open('20261020'); await pe(() => document.getElementById('btn-no-measurement').click()); await ok();
      eis('Geen meting en Opslaan: eerst de vraag', await tekst('confirm-text'), 'Er staat al een meting op 20-10-2026. Wil je die verwijderen?');
      await bevestig();
      eis('na ja: de meting weg', 'D20261020' in (await bestand('gewicht.txt')), false);

      // een getypte notitie maakt het venster 'gewijzigd': terug vraagt eerst
      await open('20261025'); await zetVeld(null, lang + ' en meer');
      await pe(() => history.back()); await wacht(250);
      eis('terug na het typen van een notitie: eerst de vraag of je wilt sluiten', await pe(() => document.getElementById('confirm-overlay').style.display !== 'none'), true);
      await pe(() => document.getElementById('confirm-ok').click()); await wacht(250);
      eis('de teller telt mee, ook boven 250 (oranje)', await pe(() => { openEditDatapointModal('g', 'D20261025'); const t = document.getElementById('f-data-notitie-teller'); const r = [t.textContent, t.classList.contains('te-lang'), document.getElementById('f-data-notitie').maxLength]; closeDatapointModal(); return r; }), ['300 / 250', true, 250]);
      await wacht(150);

      // Bewerken in Trends uit: alleen lezen
      await zetBestand({D20261019: 81.0, D20261021: {waarde: 81.4, notitie: 'Clubcompetitie'}}, {bewerken_in_trends: false});
      const lees = await pe(() => { openEditDatapointModal('g', '20261021'); const r = {
        titel: document.getElementById('datapoint-modal-title').textContent, ro: document.getElementById('f-data-value').readOnly,
        ok: document.getElementById('btn-add-datapoint').style.display, weg: ['btn-undo-waarde','btn-no-measurement','btn-undo-notitie','btn-no-notitie'].map(id => { const k = document.getElementById(id); return [k.getBoundingClientRect().width > 0, k.disabled]; }),
        /* het pijltje van de tijdkiezer is onzichtbaar (zoals in Golf Score), en het veld staat uit */
        tijdkiezer: [...document.styleSheets].flatMap(z => [...z.cssRules]).filter(r => r.selectorText === '#f-data-time::-webkit-calendar-picker-indicator').map(r => r.style.opacity).join() + (document.getElementById('f-data-time').disabled ? ' uit' : ' aan'),
        sluit: document.getElementById('btn-cancel-datapoint').textContent,
        veld: document.getElementById('f-data-notitie').hidden, lees: document.getElementById('f-data-notitie-lees').textContent,
        vakjes: ['f-data-date-display', 'f-data-time', 'f-data-value', 'f-data-notitie-lees'].map(id => getComputedStyle(document.getElementById(id)).backgroundColor),
        hint: !document.getElementById('f-data-alleen-lezen').hidden && document.getElementById('f-data-alleen-lezen').textContent === 'Alleen lezen: bewerken in Trends staat uit bij deze bron.' }; closeDatapointModal(); return r; });
      eis('Bewerken in Trends uit: het venster toont alleen, met de notitie te lezen; de knoppen staan er, grijs (13528EE-001)', lees,
        {titel: 'Meting', ro: true, ok: 'none', weg: [[true, true], [true, true], [true, true], [true, true]], tijdkiezer: '0 uit', sluit: 'Sluiten', veld: true, lees: 'Clubcompetitie', vakjes: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'], hint: true});
      await wacht(150);
      await kies('20261020');
      eis('Bewerken in Trends uit: een lege dag kun je niet openen', await pe(() => document.getElementById('btn-edit-selected-datapoint').disabled), true);
      await kies('20261021');
      eis('maar een meting wel, om te bekijken', await pe(() => document.getElementById('btn-edit-selected-datapoint').disabled), false);
      eis('na sluiten is het venster weer gewoon te bewerken', await pe(() => { bronnen[0].bewerken_in_trends = true; openEditDatapointModal('g', '20261021');
        const r = [document.getElementById('f-data-value').readOnly, document.getElementById('btn-add-datapoint').style.display, document.getElementById('btn-cancel-datapoint').textContent, document.getElementById('f-data-notitie').hidden]; closeDatapointModal(); return r; }), [false, '', 'Annuleren', false]);
      await wacht(150);

      // meer metingen per dag: een notitie per tijdstip
      await zetBestand({D20261021T0800: {waarde: 81.4, notitie: 'nuchter'}, D20261021T2000: 82.0, D20261022T0700: {notitie: 'griep'}}, {meerdere_metingen: true});
      await pe(async () => { expandedMultiDays.add('20261021'); expandedMultiDays.add('20261022'); await renderDataView(); });
      eis('meer per dag: een dag met alleen een notitie zit in de ingeklapte reeks, met het hoekje', await reeksMet('20261022'), true);
      await vouwOpen('20261022');
      eis('meer per dag: + meting toevoegen is even hoog als een dagrij', await pe(() => {
        const a = document.querySelector('#data-table-body tr.add-submeting-row'), d = document.querySelector('#data-table-body tr[data-k="20261021"]');
        return a && d ? Math.round(a.getBoundingClientRect().height) === Math.round(d.getBoundingClientRect().height) : 'geen rij'; }), true);
      eis('meer per dag: een dagrij met een aantal (2 ⌄) is even hoog als een dagrij zonder', await pe(() => {
        const rijen = [...document.querySelectorAll('#data-table-body tr[data-k]:not(.today-row):not(.submeting-row)')];
        const met = rijen.find(r => r.querySelector('.multi-indicator')?.textContent.trim()), zonder = rijen.find(r => !r.querySelector('.multi-indicator')?.textContent.trim());
        return met && zonder ? [met.getBoundingClientRect().height, zonder.getBoundingClientRect().height].map(Math.round) : 'geen rijen'; }).then(x => Array.isArray(x) && x[0] === x[1]), true);
      /* de tabel is virtueel: met elke dag erbij schuift 21-10 verder naar beneden, uit het
         getekende stuk. Daarom eerst naar beneden scrollen (de test faalde vanaf 8-11-2026). */
      await pe(async () => { const b = document.getElementById('data-table-scroll'); b.scrollTop = b.scrollHeight; b.dispatchEvent(new Event('scroll')); await new Promise(r => setTimeout(r, 150)); });
      eis('meer per dag: elke tijd met een notitie heeft het hoekje', [await rij('D20261021T0800'), await rij('D20261021T2000')], [['81.4', true], ['82.0', false]]);
      eis('meer per dag: een tijd met alleen een notitie krijgt een regel met een streepje', await rij('D20261022T0700'), ['–', true]);
      eis('meer per dag: de dagrij heeft het hoekje als een van de metingen een notitie heeft', (await rij('20261021'))[1], true);
      await kies('20261022');
      eis('een uitgeklapte dagrij gekozen: geen notitieregel, de notitie staat bij de tijd', await notitieRij(), null);
      await kies('D20261022T0700');
      eis('de tijd gekozen: de notitie van die tijd eronder', await notitieRij(), 'griep');
      await pe(async () => { expandedMultiDays.clear(); await renderDataView(); });
      await kies('20261021');
      eis('een ingeklapte dagrij gekozen: de notities van die dag met de tijd', await notitieRij(), '08:00  nuchter');

      // meer per dag uit: een notitie op een tijdstip verhuist mee naar de dag
      const om = await pe(() => { const r = leesBestand({D20261021T0800: {waarde: 81.4, notitie: 'nuchter'}, D20261022T0700: {notitie: 'griep'}}, {meerdere_metingen: false});
        const sorteer = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]])); return [sorteer(r.data), sorteer(r.notities)]; });
      eis('meer per dag uit: meting en notitie gaan samen naar de dagsleutel', om, [{D20261021: 81.4}, {D20261021: 'nuchter', D20261022: 'griep'}]);
      const aan = await pe(() => { const r = leesBestand({D20261021: {waarde: 81.4, notitie: 'nuchter'}, D20261022: {notitie: 'griep'}}, {meerdere_metingen: true});
        const sorteer = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]])); return [sorteer(r.data), sorteer(r.notities)]; });
      eis('meer per dag aan: meting en notitie krijgen samen T1200', aan, [{D20261021T1200: 81.4}, {D20261021T1200: 'nuchter', D20261022T1200: 'griep'}]);
      eis('een ongeldig object blijft rest, zoals voorheen', await pe(() => { const r = leesBestand({D20261021: {waarde: '81', notitie: 'x'}, D20261022: {notitie: 'y', extra: 1}, D20261023: {}}, {});
        return [Object.keys(r.data).length, Object.keys(r.notities).length, Object.keys(r.rest).sort()]; }), [0, 0, ['D20261021', 'D20261022', 'D20261023']]);
      await pe(async () => { bronnen[0].meerdere_metingen = false; });

      // terugzetten uit de back-up: de notities komen mee terug
      await pe(() => { window.__fs['gewicht.txt'] = {tekst: '{"D20261020": 81,', mtime: 950};
        window.__fs[backupFilename('gewicht.txt')] = {tekst: __data({D20261020: {waarde: 81.0, notitie: 'uit de back-up'}, D20261022: {notitie: 'los'}}), mtime: 940}; });
      const herstel = pe(() => herstelUitBackup('g'));
      await wacht(200); await pe(() => document.getElementById('confirm-ok').click()); await herstel; await wacht(200);
      eis('terugzetten uit de back-up: met de notities', await bestand('gewicht.txt'), {D20261020: {waarde: 81.0, notitie: 'uit de back-up'}, D20261022: {notitie: 'los'}});
      await pe(() => { const a = document.getElementById('alert-ok'); if(document.getElementById('alert-overlay').style.display !== 'none') a.click(); }); await wacht(150);

      /* Bewerken in Trends uit: ook Geen notitie (verborgen) wist niets (13528ED-002) */
      await zetBestand({D20261021: {waarde: 81.4, notitie: 'Clubcompetitie'}}, {bewerken_in_trends: false, meerdere_metingen: false});
      eis('alleen lezen: Geen notitie (ook al is hij verborgen) wist niets', await pe(async () => { openEditDatapointModal('g', '20261021');
        document.getElementById('btn-no-notitie').click(); await new Promise(r => setTimeout(r, 150));
        const r = [document.getElementById('f-data-notitie').value, __leesData(window.__fs['gewicht.txt'].tekst).D20261021];
        closeDatapointModal(); return r; }), ['Clubcompetitie', {waarde: 81.4, notitie: 'Clubcompetitie'}]);
      await wacht(150);
      /* terugzetten uit de back-up mag ook bij alleen lezen, met de waarschuwing erbij (13528A7-009) */
      await pe(() => { window.__fs['gewicht.txt'] = {tekst: '{"D20261020": 81,', mtime: 960};
        window.__fs[backupFilename('gewicht.txt')] = {tekst: __data({D20261020: 81.0}), mtime: 955}; });
      const herstelLees = pe(() => herstelUitBackup('g'));
      await wacht(200);
      const vraag = await tekst('confirm-text');
      await pe(() => document.getElementById('confirm-ok').click()); await herstelLees; await wacht(200);
      eis('alleen lezen: terugzetten kan, en de vraag zegt dat een andere app het bestand later weer kan overschrijven',
        [/buiten Trends/.test(vraag), (await bestand('gewicht.txt')).D20261020], [true, 81.0]);
      await pe(() => { const a = document.getElementById('alert-ok'); if(document.getElementById('alert-overlay').style.display !== 'none') a.click(); bronnen[0].bewerken_in_trends = true; }); await wacht(150);

      /* Een notitie op het tijdstip waar je opslaat, gaat nooit stil verloren (13528A7-007).
         Het venster laadt de notitie van het gekozen tijdstip; een meting die je erheen
         verplaatst, neemt haar eigen notitie mee en de bestaande komt eronder. */
      console.log('Notitie op het gekozen tijdstip (13528A7-007)');
      const zetTijd = t => pe(t => { const e = document.getElementById('f-data-time'); e.value = t; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); return document.getElementById('f-data-notitie').value; }, t);
      const sluit = async () => { await pe(() => { if(document.getElementById('datapoint-modal-overlay').style.display !== 'none') closeDatapointModalInner(); modalStack.length = 0; }); await wacht(100); };

      // B: meer per dag, '+ meting' op een dag met om 12:00 alleen een notitie (en de dag ervoor een meting, zodat er een waarde voor te stellen is)
      await zetBestand({D20261020T0800: 80.0, D20261021T1200: {notitie: 'afspraak'}}, {meerdere_metingen: true});
      const b = await open('20261021');
      eis('B: de dag openen met om 12:00 een notitie: die notitie staat in het veld', [b[2], await pe(() => document.getElementById('f-data-time').value)], ['afspraak', '12:00']);
      eis('B: en het waardeveld leeg, Geen meting aan: geen verzonnen meting (13528A7-00A)', [b[0], b[1]], ['', true]);
      await zetVeld('80.0', null); await ok();
      eis('B: een meting om 12:00 opslaan houdt de notitie', (await bestand('gewicht.txt')).D20261021T1200, {waarde: 80.0, notitie: 'afspraak'});
      await sluit();

      // B2: dezelfde dag, maar de tijd verzet naar een leeg tijdstip zonder in het veld te typen
      await zetBestand({D20261020T0800: 80.0, D20261021T1200: {notitie: 'afspraak'}}, {meerdere_metingen: true});
      await open('20261021');
      eis('B2: de tijd verzet naar 07:30: het veld toont de notitie van 07:30 (geen)', await zetTijd('07:30'), '');
      eis('B2: op 07:30 weer een voorgestelde waarde (daar staat geen notitie) (13528A7-00A)', await pe(() => [document.getElementById('f-data-value').value !== '', isExplicitEmpty]), [true, false]);
      eis('B2: en terug naar 12:00: weer de notitie van 12:00', await zetTijd('12:00'), 'afspraak');
      eis('B2: op 12:00 het waardeveld weer leeg (13528A7-00A)', await pe(() => [document.getElementById('f-data-value').value, isExplicitEmpty]), ['', true]);
      /* zelf precies de voorgestelde waarde getypt: die blijft staan (13528A7-00C) */
      await zetTijd('07:30'); const voorstel = await pe(() => document.getElementById('f-data-value').value);
      await zetVeld(voorstel, null); await zetTijd('12:00');
      eis('B2: zelf de voorgestelde waarde getypt, dan naar 12:00: de getypte waarde blijft', await pe(() => [document.getElementById('f-data-value').value, isExplicitEmpty]), [voorstel, false]);
      await zetTijd('07:30');
      await zetTijd('07:30'); await zetVeld('79.5', null); await ok();
      const b2 = await bestand('gewicht.txt');
      eis('B2: de meting om 07:30, de notitie van 12:00 blijft waar ze was', [b2.D20261021T0730, b2.D20261021T1200], [79.5, {notitie: 'afspraak'}]);
      await sluit();

      // B3: de geladen notitie aangepast en dan de tijd verzet: ze verhuist mee (13528A7-00A)
      await zetBestand({D20261021T1200: {notitie: 'afspraak'}}, {meerdere_metingen: true});
      await open('20261021'); await zetVeld(null, 'afspraak tandarts');
      eis('B3: aangepast en de tijd verzet: het veld houdt de aangepaste tekst', await zetTijd('07:30'), 'afspraak tandarts');
      await zetVeld('79.5', null); await ok();
      const b3 = await bestand('gewicht.txt');
      eis('B3: de aangepaste notitie staat bij 07:30, en 12:00 is leeg (niet twee keer)', [b3.D20261021T0730, 'D20261021T1200' in b3], [{waarde: 79.5, notitie: 'afspraak tandarts'}, false]);
      await sluit();

      // B4: alleen lezen, meer per dag: de notitie van het voorgestelde tijdstip te lezen, geen voorgestelde waarde (13528A7-00A)
      await zetBestand({D20261020T0800: 80.0, D20261021T1200: {notitie: 'afspraak'}}, {meerdere_metingen: true, bewerken_in_trends: false});
      eis('B4: alleen lezen: de notitie te lezen en geen voorgestelde waarde', await pe(() => { openEditDatapointModal('g', '20261021');
        const r = [document.getElementById('f-data-notitie-lees').textContent, document.getElementById('f-data-value').value]; closeDatapointModal(); return r; }), ['afspraak', '']);
      await wacht(150); await pe(() => { bronnen[0].bewerken_in_trends = true; });

      // A: een meting met notitie verplaatsen naar een tijdstip met alleen een notitie
      await zetBestand({D20261021T0800: {waarde: 81.0, notitie: 'ochtend'}, D20261021T0900: {notitie: 'wandeling'}}, {meerdere_metingen: true});
      await open('D20261021T0800');
      eis('A: de tijd verzet: de eigen notitie van de meting blijft in het veld', await zetTijd('09:00'), 'ochtend');
      await ok();
      const a = await bestand('gewicht.txt');
      eis('A: verplaatst: de eigen notitie en de bestaande samen, 08:00 is leeg', [a.D20261021T0900, 'D20261021T0800' in a], [{waarde: 81.0, notitie: 'ochtend wandeling'}, false]);
      await sluit();

      // A2: een meting zonder notitie verplaatsen naar een tijdstip met een notitie
      await zetBestand({D20261021T0800: 81.0, D20261021T0900: {notitie: 'wandeling'}}, {meerdere_metingen: true});
      await open('D20261021T0800');
      eis('A2: het veld was leeg: na het verzetten staat de notitie van 09:00 erin', await zetTijd('09:00'), 'wandeling');
      await ok();
      eis('A2: verplaatst: de notitie van 09:00 blijft', (await bestand('gewicht.txt')).D20261021T0900, {waarde: 81.0, notitie: 'wandeling'});
      await sluit();

      // A3: ook als het veld bij het verzetten leeg blijft (geen invoer-gebeurtenis), gaat de bestaande niet verloren
      await zetBestand({D20261021T0800: 81.0, D20261021T0900: {notitie: 'wandeling'}}, {meerdere_metingen: true});
      await pe(() => { openEditDatapointModal('g', 'D20261021T0800'); document.getElementById('f-data-time').value = '09:00'; });
      await ok();
      eis('A3: opslaan op 09:00 zonder dat het venster de notitie liet zien: ze blijft', (await bestand('gewicht.txt')).D20261021T0900, {waarde: 81.0, notitie: 'wandeling'});
      await sluit();

      // C: één meting per dag, met een meting om 08:00 en een losse notitie om 09:00 (oude stand)
      const zetC = () => pe(async () => { bronnen[0].meerdere_metingen = false; const d = {D20261021T0800: 81.0}; dataCache = {g: d};
        zetTabel('g', d, {D20261021T0900: 'los'}, {}); __volledigeTabel.add(d); bumpDataVersion('g');
        window.__fs['gewicht.txt'] = {tekst: __data(bestandsInhoud(d, {})), mtime: 990}; await renderDataView(); });
      await zetC();
      eis('C: de dag openen: de losse notitie van die dag staat in het veld', (await open('20261021'))[2], 'los');
      await zetVeld('80.0', null); await ok(); await bevestig();
      const c = await bestand('gewicht.txt');
      eis('C: na overschrijven: de meting en de notitie samen op de dag', [c.D20261021, 'D20261021T0800' in c, 'D20261021T0900' in c], [{waarde: 80.0, notitie: 'los'}, false, false]);
      await sluit();
      await zetC();
      await open('20261021'); await zetVeld('80.0', ''); await ok(); await bevestig();
      eis('C2: het veld zelf leeggemaakt: dan is de notitie bewust weg', await bestand('gewicht.txt'), {D20261021: 80.0});
      await sluit();
      await zetC();
      /* C4: de meting heeft een eigen notitie én er staat een losse: beide in het veld (13528A7-00A) */
      await pe(async () => { bronnen[0].meerdere_metingen = false; const d = {D20261021: 81.0}; dataCache = {g: d};
        zetTabel('g', d, {D20261021: 'eigen', D20261021T0900: 'los'}, {}); __volledigeTabel.add(d); bumpDataVersion('g');
        window.__fs['gewicht.txt'] = {tekst: __data(bestandsInhoud(d, {})), mtime: 991}; await renderDataView(); });
      eis('C4: de meting met eigen notitie: ook de losse notitie van die dag staat in het veld', (await open('20261021'))[2], 'eigen los');
      await ok();
      eis('C4: na OK: één notitie op de dag, met beide regels', await bestand('gewicht.txt'), {D20261021: {waarde: 81.0, notitie: 'eigen los'}});
      await sluit();
      /* C5: de meting onder een tijd, de notitie onder de dag (zoals 11-10 bij Gewicht Mark):
         het venster opent als bewerken van die meting, met de notitie erin (13528ED-002) */
      const zetC5 = () => pe(async () => { const d = {D20261011T0730: 82.3}; dataCache = {g: d};
        zetTabel('g', d, {D20261011: 'kort'}, {}); __volledigeTabel.add(d); bumpDataVersion('g');
        window.__fs['gewicht.txt'] = {tekst: __data(bestandsInhoud(d, {D20261011: 'kort'})), mtime: 992}; await renderDataView(); });
      await zetC5();
      eis('C5: meting onder een tijd en notitie onder de dag: Meting bewerken, met waarde en notitie', await open('20261011'), ['82.3', false, 'kort', 'Meting bewerken']);
      await pe(() => document.getElementById('btn-no-notitie').click()); await ok();
      eis('C5: Geen notitie en Opslaan: zonder vraag, de meting blijft, de notitie weg', [await pe(() => document.getElementById('confirm-overlay').style.display === 'flex'), await bestand('gewicht.txt')], [false, {D20261011: 82.3}]);
      await sluit();
      await zetC5();
      await open('20261011'); await zetVeld(null, 'langer'); await ok();
      eis('C5: de notitie aanpassen en Opslaan: zonder vraag, meting en notitie samen op de dag', [await pe(() => document.getElementById('confirm-overlay').style.display === 'flex'), await bestand('gewicht.txt')], [false, {D20261011: {waarde: 82.3, notitie: 'langer'}}]);
      await sluit();
      /* R: een regel die Trends niet kan lezen, blijft staan: alleen een notitie bewaart dan
         niets, met een melding; een getypte waarde vervangt hem wel (13528A7-00E) */
      await zetBestand({D20261017: 80.0, D20261018: '81x'}, {meerdere_metingen: false});
      await pe(() => { const a = document.getElementById('alert-ok'); if(document.getElementById('alert-overlay').style.display !== 'none') a.click(); }); await wacht(100);
      await open('20261018'); await zetVeld('', 'na het etentje'); await ok();
      const r1 = [await pe(() => document.getElementById('alert-overlay').style.display === 'flex' ? document.getElementById('alert-text').textContent : ''), (await bestand('gewicht.txt')).D20261018];
      await pe(() => { const a = document.getElementById('alert-ok'); if(document.getElementById('alert-overlay').style.display !== 'none') a.click(); }); await wacht(100);
      eis('R: alleen een notitie op een dag met een onleesbare regel: een melding, en de regel blijft', r1,
        ['Op deze dag staat een regel die Trends niet kan lezen (D20261018;81x). Pas die eerst aan in het bestand.', 'D20261018;81x']);
      await zetVeld('81.5', null); await ok();
      eis('R: een getypte waarde vervangt de onleesbare regel wel', (await bestand('gewicht.txt')).D20261018, {waarde: 81.5, notitie: 'na het etentje'});
      await sluit();
      await zetC();
      eis('C3: opslaan zonder dat de notitie in het venster stond: ze verhuist mee, ook bij een leeg veld', await pe(async () => {
        await slaMetingOp('g', {weg: [], zet: {D20261021: 80.0}, hoofd: 'D20261021', notitie: {D20261021: null}}); return __leesData(window.__fs['gewicht.txt'].tekst); }),
        {D20261021: {waarde: 80.0, notitie: 'los'}});
      await sluit();
    }

    console.log('Notities in de grafiek (13528A7-003)');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      await opzet();
      const klaar = (agg, w) => pe(async ([agg, w]) => {
        const t = todayUTCDate(), d = {}, n = {};
        for(let i = 0; i < 40; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); d['D' + dateToKey(x)] = 80 + (i % 5) * 0.2; }
        const dag = i => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); return 'D' + dateToKey(x); };
        n[dag(3)] = 'drie'; n[dag(10)] = 'tien'; n[dag(17)] = 'zeventien'; n[dag(200)] = 'buiten de periode';
        const tabel = {...d}; zetTabel('g', tabel, n, {}); __volledigeTabel.add(tabel); bumpDataVersion('g');
        dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
        dataPeriodFilter = '1m'; dataAggMode = agg; chartViewMode = w; await renderDataView(true);
        const c = document.getElementById('data-chart-canvas'), k = document.querySelector('#lagen-knoppen [data-laag="notities"]');
        return [c.__notities, k.getAttribute('aria-pressed'), k.getAttribute('aria-disabled')];
      }, [agg, w]);
      const kleur = () => pe(() => { const c = document.getElementById('data-chart-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
        for(let i = 0; i < d.length; i += 4) if(Math.abs(d[i]-200) < 8 && Math.abs(d[i+1]-210) < 8 && Math.abs(d[i+2]-215) < 8) n++; return n; });
      eis('de laag Notities staat standaard aan: drie lijntjes in de maand, niet die van buiten de periode', await klaar('d', 'standard'), [3, 'true', null]);
      eis('de lijntjes en driehoekjes staan op de grafiek', (await kleur()) > 40, true);
      eis('ook bij Range, Regressie en per week (op de echte datum)', [(await klaar('d', 'range'))[0], (await klaar('d', 'regressie'))[0], (await klaar('w', 'standard'))[0]], [3, 3, 3]);
      /* de plek van de lijntjes: op de echte datum, ook per week (13528A7-009). Notities op
         17, 10, 5 en 3 dagen terug: de afstanden staan als 7 : 5 : 2. */
      const plek = (agg, w) => pe(async ([agg, w]) => {
        const t = todayUTCDate(), dag = i => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); return 'D' + dateToKey(x); };
        const n = {...notitiesVan('g')}; n[dag(5)] = 'vijf'; __notitiesVan.set(dataCache.g, n);
        dataAggMode = agg; chartViewMode = w; await renderDataView(true);
        const xs = (document.getElementById('data-chart-canvas').__notitieX || []).slice().sort((a, b) => a - b);
        delete n[dag(5)]; __notitiesVan.set(dataCache.g, n);
        if(xs.length !== 4) return 'lijntjes: ' + xs.length;
        const e = xs[1] - xs[0];
        return [(xs[2] - xs[1])/e, (xs[3] - xs[2])/e].map(v => Math.abs(v - [5/7, 2/7][0]) < 0.08 || Math.abs(v - 2/7) < 0.08 ? Math.round(v*7) : v);
      }, [agg, w]);
      await klaar('d', 'standard');
      eis('de lijntjes per dag staan op hun datum (afstanden 7 : 5 : 2)', await plek('d', 'standard'), [5, 2]);
      eis('ook per week: op de echte datum, niet op het begin van de week', await plek('w', 'standard'), [5, 2]);
      eis('ook bij Regressie', await plek('d', 'regressie'), [5, 2]);
      await pe(async () => { dataAggMode = 'd'; __zetKaart('standard'); await renderDataView(true); });
      /* eerst met de laag aan: de rij van drie dagen terug bestaat, heeft het hoekje en
         aangetikt de notitieregel; anders zegt de controle met de laag uit niets */
      const rijDrieTerug = () => { const t = todayUTCDate(), x = new Date(t); x.setUTCDate(x.getUTCDate() - 3); return dateToKey(x); };
      eis('laag Notities aan: de rij met een notitie heeft het hoekje en aangetikt de notitieregel', await pe(async (k) => {
        const tr = document.querySelector(`#data-table-body tr[data-k="${k}"]`); if(!tr) return 'geen rij ' + k;
        const hoekje = tr.classList.contains('met-notitie'); tr.click(); await new Promise(r => setTimeout(r, 50));
        const regel = !!document.querySelector('#data-table-body tr.notitie-rij');
        document.querySelector(`#data-table-body tr[data-k="${k}"]`).click(); await new Promise(r => setTimeout(r, 50));
        return [hoekje, regel]; }, await pe(rijDrieTerug)), [true, true]);
      await pe(() => document.querySelector('#lagen-knoppen [data-laag="notities"]').click()); await wacht(200);
      eis('een tik zet de laag uit: geen lijntjes, en onthouden voor deze bron en kaart', await pe(() => [document.getElementById('data-chart-canvas').__notities,
        document.querySelector('#lagen-knoppen [data-laag="notities"]').getAttribute('aria-pressed'), localStorage.getItem('trends.notities.g.standard')]), [0, 'false', '0']);
      eis('zonder de laag ook geen lichtgrijze pixels van de notities', await kleur(), 0);
      /* de tabel volgt de laag, zoals bij Grenzen en Run-regels: geen hoekjes en geen notitieregel */
      eis('laag Notities uit: in de tabel geen hoekjes en bij een aangetikte rij geen notitieregel', await pe(async () => {
        const t = todayUTCDate(), x = new Date(t); x.setUTCDate(x.getUTCDate() - 3); const k = dateToKey(x);
        const tr = document.querySelector(`#data-table-body tr[data-k="${k}"]`); if(!tr) return 'geen rij ' + k;
        tr.click(); await new Promise(r => setTimeout(r, 50));
        const r = [document.querySelectorAll('#data-table-body tr.met-notitie').length, !!document.querySelector('#data-table-body tr.notitie-rij')];
        document.querySelector(`#data-table-body tr[data-k="${k}"]`).click(); return r; }), [0, false]);
      eis('laag Notities uit: een losse dag met alleen een notitie (tussen twee metingen) staat er als lege dag, zonder hoekje', await pe(async () => {
        const t = todayUTCDate(), x = new Date(t); x.setUTCDate(x.getUTCDate() - 3); const k = dateToKey(x);
        const tab = {...dataCache.g}; delete tab['D' + k]; zetTabel('g', tab, notitiesVan('g'), {}); __volledigeTabel.add(tab); bumpDataVersion('g');
        await renderDataView(true); const tr = document.querySelector(`#data-table-body tr[data-k="${k}"]`);
        return tr ? [tr.querySelector('.val').textContent.trim(), tr.classList.contains('met-notitie')] : 'geen rij ' + k; }), ['–', false]);
      await pe(async () => { document.querySelector('#lagen-knoppen [data-laag="notities"]').click(); await new Promise(r => setTimeout(r, 150)); });
      eis('en weer aan: de hoekjes terug', await pe(() => document.querySelectorAll('#data-table-body tr.met-notitie').length > 0), true);
      await pe(async () => { document.querySelector('#lagen-knoppen [data-laag="notities"]').click(); await new Promise(r => setTimeout(r, 150)); });
      eis('bij een andere kaart staat hij nog aan (per kaart)', (await klaar('d', 'regressie')).slice(0, 2), [3, 'true']);
      await pe(async () => { __zetKaart('standard'); zetLaag('notities', true); vergeetLaag('notities', 'g'); await renderDataView(true); });

      // de overloop: pas als zelfs de kortste naam niet past
      await p.setViewportSize({width: 250, height: 740}); await wacht(250);
      const smal = await pe(async () => { __zetKaart('regressie'); await renderDataView(true); const m = document.getElementById('lagen-meer');
        return [document.querySelector('#weergave-stipjes .stip-naam').textContent !== '', m.hidden, document.querySelectorAll('#lagen-knoppen .laag-knop.in-menu').length >= 2, m.classList.contains('aan'),
          document.getElementById('weergave-rij').scrollWidth <= document.getElementById('weergave-rij').clientWidth + 1]; });
      eis('250 breed: de naam blijft, de laatste knoppen in het menu achter ⋯, dat teal is (Notities staat aan), niets loopt over', smal, [true, false, true, true, true]);
      await pe(() => document.getElementById('lagen-meer').click()); await wacht(150);
      const menu = await pe(() => { const m = document.getElementById('lagen-menu'), b = m.getBoundingClientRect();
        const weg = [...document.querySelectorAll('#lagen-knoppen .laag-knop.in-menu')].map(k => k.getAttribute('aria-label'));
        return [!m.hidden, [...m.querySelectorAll('button')].map(k => k.querySelector('.nm').textContent + ' ' + k.querySelector('.st').textContent).join(), weg.map(l => l + ' ' + (l === 'Notities' ? 'aan' : 'uit')).join(), weg[weg.length - 1], b.left >= 0 && b.right <= innerWidth, document.getElementById('lagen-meer').getAttribute('aria-expanded')]; });
      eis('het menu opent binnen het scherm, met de laatste lagen (die niet pasten) en hun stand', [menu[0], menu[1] === menu[2], menu[3], menu[4], menu[5]], [true, true, 'Notities', true, 'true']);
      await pe(() => [...document.querySelectorAll('#lagen-menu button')].find(k => /Notities/.test(k.textContent)).click()); await wacht(250);
      eis('een keuze in het menu zet de laag om en sluit het menu; ⋯ niet meer teal', await pe(() => [document.getElementById('lagen-menu').hidden, laagIsAan('notities'),
        document.getElementById('data-chart-canvas').__notities, document.getElementById('lagen-meer').classList.contains('aan')]), [true, false, 0, false]);
      await pe(() => document.getElementById('lagen-meer').click()); await wacht(100);
      await pe(() => document.body.click()); await wacht(100);
      eis('een tik buiten het menu sluit het', await pe(() => document.getElementById('lagen-menu').hidden), true);
      /* toetsenbord, Escape en de terugknop (13528A7-009) */
      await p.focus('#lagen-meer'); await p.keyboard.press('Enter'); await wacht(150);
      const knopNaam = () => pe(() => { const a = document.activeElement; return a && a.closest('#lagen-menu') ? a.querySelector('.nm').textContent : a ? (a.id || a.tagName) : null; });
      const eerste = await knopNaam(); await p.keyboard.press('ArrowDown'); await wacht(50);
      const tweede = await knopNaam(); await p.keyboard.press('ArrowUp'); await wacht(50);
      eis('het menu openen zet de focus op de eerste laag; pijl omlaag en omhoog lopen door het menu',
        [eerste !== null && eerste !== 'lagen-meer', tweede !== eerste, await knopNaam()], [true, true, eerste]);
      /* Home en End (13528A7-00B) */
      await p.keyboard.press('End'); await wacht(50); const naEnd = await knopNaam();
      await p.keyboard.press('Home'); await wacht(50); const naHome = await knopNaam();
      eis('End naar de laatste laag in het menu, Home naar de eerste', await pe(([e, h]) => { const k = [...document.querySelectorAll('#lagen-menu button .nm')].map(x => x.textContent); return [e === k[k.length - 1], h === k[0], k.length >= 2]; }, [naEnd, naHome]), [true, true, true]);
      await p.keyboard.press('Escape'); await wacht(250);
      eis('Escape sluit het menu, de focus terug op ⋯, en de app blijft open', await pe(() => [document.getElementById('lagen-menu').hidden, document.activeElement && document.activeElement.id,
        location.pathname.endsWith('trends.html'), modalStack.length]), [true, 'lagen-meer', true, 0]);
      await pe(() => document.getElementById('lagen-meer').click()); await wacht(150);
      await pe(() => history.back()); await wacht(300);
      eis('de terugknop sluit het menu en laat de app open', await pe(() => [document.getElementById('lagen-menu').hidden, location.pathname.endsWith('trends.html'),
        document.getElementById('view-data').classList.contains('active') || getComputedStyle(document.getElementById('view-data')).display !== 'none']), [true, true, true]);
      await pe(() => document.getElementById('lagen-meer').click()); await wacht(150);
      eis('een nieuwe render terwijl het menu open is, bouwt het niet opnieuw op', await pe(async () => { const k = document.querySelector('#lagen-menu button'); await renderDataView(true);
        return [document.querySelector('#lagen-menu button') === k, !document.getElementById('lagen-menu').hidden]; }), [true, true]);
      /* het menu wordt opnieuw opgebouwd (smaller scherm, er komt een laag bij): de focus blijft op dezelfde laag (13528A7-00C) */
      await pe(() => document.getElementById('lagen-menu').hidden || sluitLagenMenu()); await wacht(150);
      await p.setViewportSize({width: 255, height: 740}); await wacht(300);
      const herbouw = await pe(async () => {
        if(document.getElementById('lagen-meer').hidden) return 'geen menu op 255';
        document.getElementById('lagen-meer').click(); await new Promise(r => setTimeout(r, 150));
        const k = [...document.querySelectorAll('#lagen-menu button')]; k[k.length - 1].focus();
        return [k.length, k[k.length - 1].querySelector('.nm').textContent];
      });
      await p.setViewportSize({width: 215, height: 740}); await wacht(400);
      const naHerbouw = await pe(() => [document.querySelectorAll('#lagen-menu button').length, document.activeElement && document.activeElement.querySelector && document.activeElement.querySelector('.nm') ? document.activeElement.querySelector('.nm').textContent : null]);
      eis('herbouw van het menu: er komt een laag bij en de focus blijft op dezelfde laag', Array.isArray(herbouw) ? [naHerbouw[0] > herbouw[0], naHerbouw[1] === herbouw[1]] : herbouw, [true, true]);
      await pe(() => sluitLagenMenu()); await wacht(150);
      await p.setViewportSize({width: 250, height: 740}); await wacht(300);
      await pe(() => document.getElementById('lagen-meer').click()); await wacht(150);
      const gekozen = await pe(() => document.querySelector('#lagen-menu button .nm').textContent);
      await p.focus('#lagen-menu button'); await p.keyboard.press('Enter'); await wacht(300);
      eis('een keuze met Enter: het menu dicht, de focus op ⋯ (niet op een verborgen knop)', await pe(() => [document.getElementById('lagen-menu').hidden, document.activeElement && document.activeElement.id, modalStack.length]), [true, 'lagen-meer', 0]);
      await pe(async naam => { const b = [...document.querySelectorAll('#lagen-knoppen .laag-knop')].find(k => k.getAttribute('aria-label') === naam); const l = b.dataset.laag; zetLaag(l, !laagIsAan(l)); await renderDataView(true); }, gekozen);
      /* M1: menu open en dan een venster: het menu verdwijnt van de stapel (13528A7-00A) */
      await pe(() => document.getElementById('lagen-meer').click()); await wacht(150);
      await p.click('#data-chart-canvas', {position: {x: 30, y: 40}, force: true}); await wacht(250);
      const naGrafiek = await pe(() => [document.getElementById('chart-stats-modal-overlay').style.display, document.getElementById('lagen-menu').hidden, modalStack.length]);
      await pe(() => closeChartStatsModal()); await wacht(250);
      eis('menu open en dan een tik op de grafiek: het venster open, het menu dicht; na sluiten niets meer op de stapel', [naGrafiek, await pe(() => modalStack.length)], [['flex', true, 1], 0]);
      /* Tab uit het menu sluit het (13528A7-00A) */
      await p.focus('#lagen-meer'); await p.keyboard.press('Enter'); await wacht(150);
      await pe(() => { const k = [...document.querySelectorAll('#lagen-menu button')]; k[k.length - 1].focus(); }); await p.keyboard.press('Tab'); await wacht(250);
      eis('Tab uit het menu: het menu dicht en van de stapel', await pe(() => [document.getElementById('lagen-menu').hidden, modalStack.length]), [true, 0]);
      eis('Tab uit het menu: de focus gaat naar het volgende element, niet terug naar ⋯ (13528A7-00C)', await pe(() => [!!document.activeElement && document.activeElement !== document.body, document.activeElement && document.activeElement.id !== 'lagen-meer']), [true, true]);
      /* Shift+Tab vanaf de eerste laag naar ⋯: ook dan dicht (13528A7-00C) */
      await p.focus('#lagen-meer'); await p.keyboard.press('Enter'); await wacht(150);
      await p.keyboard.press('Shift+Tab'); await wacht(250);
      eis('Shift+Tab van de eerste laag naar ⋯: het menu dicht en van de stapel, de focus op ⋯', await pe(() => [document.getElementById('lagen-menu').hidden, modalStack.length, document.activeElement && document.activeElement.id]), [true, 0, 'lagen-meer']);
      /* een melding terwijl het menu open is: de focus blijft in de melding (13528A7-00C) */
      await p.focus('#lagen-meer'); await p.keyboard.press('Enter'); await wacht(150);
      eis('een melding terwijl het menu open is: het menu dicht, de focus blijft in de melding (niet terug naar ⋯)', await pe(async () => { showAlert('proef'); await new Promise(r => setTimeout(r, 200));
        const r = [document.getElementById('lagen-menu').hidden, modalStack.length, document.getElementById('alert-overlay').contains(document.activeElement)]; document.getElementById('alert-ok').click(); return r; }), [true, 0, true]);
      await wacht(150);
      /* het menu verdwijnt door een breder scherm: de focus gaat niet naar het niets (13528A7-00A) */
      await p.focus('#lagen-meer'); await p.keyboard.press('Enter'); await wacht(150);
      await p.setViewportSize({width: 360, height: 740}); await wacht(400);
      eis('het menu verdwijnt bij een breder scherm: de focus op een knop, niet op de pagina, en niets op de stapel', await pe(() => [document.getElementById('lagen-menu').hidden,
        !!document.activeElement && document.activeElement !== document.body, modalStack.length]), [true, true, 0]);
      await p.setViewportSize({width: 250, height: 740}); await wacht(250);
      await pe(async () => { zetLaag('notities', true); vergeetLaag('notities', 'g'); __zetKaart('standard'); await renderDataView(true); });
      await p.setViewportSize({width: 360, height: 740}); await wacht(250);
      eis('weer 360 breed: geen menu, alle vijf de knoppen op de regel', await pe(() => [document.getElementById('lagen-meer').hidden, document.querySelectorAll('#lagen-knoppen .laag-knop.in-menu').length]), [true, 0]);
    }

    console.log('Snelkoppeling Meting toevoegen (13528A7-004)');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      const basis = 'http://127.0.0.1:' + server.address().port + '/trends.html';
      // zonder werkmap: de app opent, met een melding; 'snel' gaat uit het adres, de rest blijft
      await p.goto(basis + '?x=1&snel=meting'); await wacht(700);
      eis('via de snelkoppeling zonder werkmap: een melding, en alleen snel uit het adres', await pe(() => [location.search, document.getElementById('alert-overlay').style.display !== 'none',
        document.getElementById('alert-text').textContent]), ['?x=1', true, 'Meting toevoegen: koppel eerst een werkmap en maak een bron (tabblad Bronnen).']);
      await pe(() => document.getElementById('alert-ok').click()); await wacht(150);
      await p.goto(basis); await wacht(600);
      eis('gewoon opstarten: geen melding', await pe(() => document.getElementById('alert-overlay').style.display === 'none'), true);
      // met een werkmap en een bron: het invoervenster voor vandaag, met de naam van de bron
      await opzet();
      const r = await pe(async () => { await voerSnelOpdrachtUit('meting'); await new Promise(r => setTimeout(r, 150));
        return [document.getElementById('datapoint-modal-overlay').style.display, document.getElementById('datapoint-modal-title').textContent,
          document.getElementById('datapoint-modal-bron').textContent, document.getElementById('f-data-date-text').textContent === fmtDateNL(dateToKey(todayUTCDate())),
          document.querySelector('.view.active') ? document.querySelector('.view.active').id : document.getElementById('view-data').style.display]; });
      eis('met werkmap en bron: het invoervenster voor vandaag, met de naam van de bron eronder', r, ['flex', 'Meting toevoegen', 'Gewicht', true, 'view-data']);
      await pe(() => closeDatapointModal()); await wacht(150);
      // meer metingen per dag: de tijd van nu
      const tijd = await pe(async () => { bronnen[0].meerdere_metingen = true; await voerSnelOpdrachtUit('meting'); await new Promise(r => setTimeout(r, 150));
        const t = document.getElementById('f-data-time').value, d = new Date(), nu = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        closeDatapointModal(); bronnen[0].meerdere_metingen = false; return t === nu; });
      eis('meer metingen per dag: de tijd staat op nu, niet op 12:00', tijd, true);
      await wacht(150);
      eis('ook gewoon openen toont de bron onder de titel', await pe(() => { openEditDatapointModal('g', 'D20261017'); const t = document.getElementById('datapoint-modal-bron').textContent; closeDatapointModal(); return t; }), 'Gewicht');
      await wacht(150);
      eis('Bewerken in Trends uit: geen invoervenster, wel een melding', await pe(async () => { bronnen[0].bewerken_in_trends = false; await voerSnelOpdrachtUit('meting'); await new Promise(r => setTimeout(r, 150));
        const r = [document.getElementById('datapoint-modal-overlay').style.display, document.getElementById('alert-text').textContent]; bronnen[0].bewerken_in_trends = true;
        document.getElementById('alert-ok').click(); return r; }), ['none', 'Meting toevoegen: bij Gewicht staat Bewerken in Trends uit.']);
      await wacht(150);
      eis('het manifest heeft de snelkoppeling met een PNG-icoon van 192', await pe(async () => { const m = await (await fetch('manifest.json')).json(); const s = (m.shortcuts || [])[0] || {};
        const i = (s.icons || [])[0] || {}; const png = await fetch(i.src || 'x'); return [s.name, s.url, i.type, i.sizes, png.ok, (s.icons || []).map(x => x.purpose).join()]; }), ['Meting toevoegen', './trends.html?snel=meting', 'image/png', '192x192', true, 'any,maskable']);   // twee regels, any en maskable, sinds 13528A7-00B
      eis('het hoofdicoon twee keer: any, en een maskable met de achtergrond tot de rand (13528A7-00D)', await pe(async () => { const m = await (await fetch('manifest.json')).json();
        const r = (m.icons || []).map(x => x.src + ':' + x.purpose).join(); const svg = await (await fetch('icon-maskable.svg')).text();
        return [r, /<rect width="512" height="512"(?! rx)/.test(svg), /scale\(0\.8\)/.test(svg)]; }), ['icon.svg:any,icon-maskable.svg:maskable', true, true]);   // de tekening op 80%: binnen de veilige zone (13528A7-00E)

      /* De werkmap is gekoppeld, maar Edge vraagt na een herstart opnieuw om toegang en er is
         geen leeskopie: de juiste melding, en na Autoriseren alsnog het venster (13528A7-008). */
      await opzet();
      const auth = await pe(async () => { dirHandle.queryPermission = async () => 'prompt'; bronnen = []; dataCache = {}; renderSourceSelects();
        setFileLinkUI('dir', 'auth', {name: 'Trends'}); await voerSnelOpdrachtUit('meting'); await new Promise(r => setTimeout(r, 150));
        const r = [document.getElementById('alert-overlay').style.display !== 'none', document.getElementById('alert-text').textContent];
        document.getElementById('alert-ok').click(); return r; });
      eis('toegang nodig: de melding zegt dat, niet "koppel eerst een werkmap"', auth, [true, 'Meting toevoegen: geef eerst toegang tot de werkmap (Toegang autoriseren, tabblad Bronnen).']);
      await wacht(150);
      const naAuth = await pe(async () => { dirHandle.queryPermission = async () => 'granted'; document.getElementById('btn-authorize-dir').click();
        for(let i = 0; i < 30 && document.getElementById('datapoint-modal-overlay').style.display !== 'flex'; i++) await new Promise(r => setTimeout(r, 50));
        const r = [document.getElementById('datapoint-modal-overlay').style.display, document.getElementById('datapoint-modal-title').textContent, document.getElementById('datapoint-modal-bron').textContent];
        if(r[0] === 'flex') closeDatapointModal(); return r; });
      eis('na Autoriseren opent het invoervenster alsnog, bij de bron', naAuth, ['flex', 'Meting toevoegen', 'Gewicht']);
      await wacht(150);
      /* Via het adres, met een werkmap zonder toegang maar met leeskopie: de opdracht loopt
         pas als het opstarten de bron heeft (13528A7-009). Het opstarten zelf is nagebootst:
         een echte map kan een test niet in de opslag van de browser zetten. */
      const snelAdres = u => u.pathname.endsWith('/trends.html') && u.search.includes('snel=meting');
      await p.route(snelAdres, async route => {
        const r = await route.fetch(); let html = await r.text();
        html = html.replace('async function bootDir(){', 'async function bootDir(){ if(window.__nepBoot) return window.__nepBoot();');
        html = html.replace('<head>', `<head><script>window.__nepBoot = async () => {
          await new Promise(r => setTimeout(r, 200));   /* het opstarten duurt even */
          dirHandle = {name: 'Trends', queryPermission: async () => 'prompt', requestPermission: async () => 'prompt', getFileHandle: async () => { throw Object.assign(new Error('x'), {name: 'NotAllowedError'}); }};
          leesKopieModus = true;
          bronnen = [{id: 'g', titel: 'Gewicht', bestand: 'gewicht.txt', eenheid: 'kg', decimalen: 1}];
          const d = {D20261016: 82.0}; dataCache = {g: d}; zetTabel('g', d, {}, {}); __volledigeTabel.add(d);
          renderSourceSelects(); document.getElementById('data-source-select').value = 'g'; setFileLinkUI('dir', 'linked', {name: 'Trends'});
        };</script>`);
        await route.fulfill({response: r, body: html});
      });
      /* de service worker zou de pagina uit zijn cache geven, langs de nabootsing heen */
      await pe(async () => { for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
      await p.goto(basis + '?snel=meting'); await wacht(900);
      eis('via het adres met een leeskopie: na het opstarten het invoervenster voor vandaag bij de bron, en snel uit het adres', await pe(() => [location.search,
        document.getElementById('datapoint-modal-overlay').style.display, document.getElementById('datapoint-modal-bron').textContent, document.getElementById('alert-overlay').style.display === 'flex' && document.getElementById('alert-text').textContent]),
        ['', 'flex', 'Gewicht', false]);
      await p.unroute(snelAdres);
      await p.goto(basis); await wacht(600);
      await opzet();
      await pe(async () => { dirHandle.queryPermission = async () => 'granted'; });
      eis('en een tweede keer autoriseren opent het niet nog eens', await pe(async () => { document.getElementById('btn-authorize-dir').click(); await new Promise(r => setTimeout(r, 400));
        return document.getElementById('datapoint-modal-overlay').style.display; }), 'none');
      /* na twee minuten vervalt de wachtende snelkoppeling (13528A7-00A; test 13528A7-00C) */
      await opzet();
      eis('de wachtende snelkoppeling vervalt na twee minuten', await pe(async () => {
        dirHandle.queryPermission = async () => 'prompt'; bronnen = []; dataCache = {}; renderSourceSelects();
        setFileLinkUI('dir', 'auth', {name: 'Trends'}); await voerSnelOpdrachtUit('meting'); await new Promise(r => setTimeout(r, 100)); document.getElementById('alert-ok').click();
        snelNaToegang.tijd -= 130000;
        dirHandle.queryPermission = async () => 'granted'; dirHandle.requestPermission = async () => 'granted';
        document.getElementById('btn-authorize-dir').click();
        for(let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 50));
        const r = document.getElementById('datapoint-modal-overlay').style.display; if(r === 'flex') closeDatapointModal(); return r; }), 'none');
      /* geweigerd en later alsnog toegang: dan geen onverwacht invoervenster meer (13528A7-00A) */
      await opzet();
      eis('toegang geweigerd: de wachtende snelkoppeling vervalt, ook als je later wel toegang geeft', await pe(async () => {
        dirHandle.queryPermission = async () => 'prompt'; dirHandle.requestPermission = async () => 'denied'; bronnen = []; dataCache = {}; renderSourceSelects();
        setFileLinkUI('dir', 'auth', {name: 'Trends'}); await voerSnelOpdrachtUit('meting'); await new Promise(r => setTimeout(r, 100)); document.getElementById('alert-ok').click();
        document.getElementById('btn-authorize-dir').click(); await new Promise(r => setTimeout(r, 300));
        dirHandle.queryPermission = async () => 'granted'; dirHandle.requestPermission = async () => 'granted';
        document.getElementById('btn-authorize-dir').click();
        for(let i = 0; i < 12; i++) await new Promise(r => setTimeout(r, 50));
        const r = document.getElementById('datapoint-modal-overlay').style.display; if(r === 'flex') closeDatapointModal(); return r; }), 'none');
    }

    console.log('Het ⋯-menu bij aanraken (13528A7-00C)');
    {
      /* Op een telefoon: menu open, tik op de grafiek, venster dicht. De app moet open blijven
         en de geschiedenis moet kloppen met de stapel. Een muis verbergt dit: die geeft tijd
         tussen indrukken en loslaten. */
      const tc = await browser.newContext({hasTouch: true, isMobile: true, viewport: {width: 250, height: 740}});
      const tp = await veilig(await tc.newPage()); await tp.addInitScript(ZETKAART);
      const fouten2 = []; tp.on('pageerror', e => fouten2.push(e.message));
      const pe2 = (fn, arg) => tp.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      await tp.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await tp.waitForTimeout(600);
      await tp.evaluate(opzetFn);
      await pe2(async () => { const t = todayUTCDate(), d = {}; for(let i = 0; i < 30; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); d['D' + dateToKey(x)] = 80 + (i % 5)/10; }
        zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g'); dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
        dataPeriodFilter = '1m'; __zetKaart('regressie'); await renderDataView(true); });
      await tp.waitForTimeout(300);
      const midden = sel => pe2(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; }, sel);
      const m = await midden('#lagen-meer');
      if(Array.isArray(m)){ await tp.touchscreen.tap(m[0], m[1]); await tp.waitForTimeout(250); }
      const open = await pe2(() => [!document.getElementById('lagen-menu').hidden, modalStack.length]);
      const c = await pe2(() => { const r = document.getElementById('data-chart-canvas').getBoundingClientRect(); return [r.left + 30, r.top + 40]; });
      if(Array.isArray(c)){ await tp.touchscreen.tap(c[0], c[1]); await tp.waitForTimeout(400); }
      const na = await pe2(() => [document.getElementById('chart-stats-modal-overlay').style.display, document.getElementById('lagen-menu').hidden, modalStack.length, history.state && history.state.trendsModal]);
      eis('aanraken: menu open, dan een tik op de grafiek: het venster open, het menu dicht, de geschiedenis klopt met de stapel', [open, na], [[true, 1], ['flex', true, 1, 1]]);
      const x = await midden('#chart-stats-modal-close');
      if(Array.isArray(x)){ await tp.touchscreen.tap(x[0], x[1]); await tp.waitForTimeout(500); }
      eis('aanraken: het venster dicht met het kruisje: de app blijft open', await pe2(() => [location.pathname.endsWith('trends.html'), document.getElementById('chart-stats-modal-overlay').style.display, modalStack.length]), [true, 'none', 0]);
      /* menu open, dan een tik op een zichtbare laagknop: de focus op die knop, niet op ⋯ (13528A7-00E) */
      const m2 = await midden('#lagen-meer');
      if(Array.isArray(m2)){ await tp.touchscreen.tap(m2[0], m2[1]); await tp.waitForTimeout(250); }
      const g = await midden('#lagen-knoppen .laag-knop:not(.in-menu)');
      const laag = await pe2(() => document.querySelector('#lagen-knoppen .laag-knop:not(.in-menu)').dataset.laag);
      if(Array.isArray(g)){ await tp.touchscreen.tap(g[0], g[1]); await tp.waitForTimeout(400); }
      eis('aanraken: menu open, dan een tik op een andere laagknop: het menu dicht, de focus op die knop', await pe2(l => [document.getElementById('lagen-menu').hidden, modalStack.length,
        document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.laag : null, history.state && history.state.trendsModal ? 1 : 0], laag), [true, 0, laag, 0]);
      eis('aanraken: geen fouten in de pagina', fouten2, []);
      await tc.close();
    }

    console.log('De tabel verspringt niet door de notitieregel (13528A7-008)');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      await opzet();
      /* 300 dagen, en vijf dagen terug een notitie van 240 tekens: de notitieregel is dan
         veel hoger dan een rij. */
      const r = await pe(async () => {
        const t = todayUTCDate(), d = {}, n = {};
        for(let i = 0; i < 300; i++){ const k = 'D' + dateToKey(new Date(t.getTime() - i*864e5)); d[k] = 80 + (i % 7) / 10; }
        const kn = dateToKey(new Date(t.getTime() - 5*864e5)); n['D' + kn] = 'lange notitie '.repeat(17).slice(0, 240);
        dataCache = {g: d}; zetTabel('g', d, n, {}); __volledigeTabel.add(d); bumpDataVersion('g');
        dataPeriodFilter = 'all'; dataAggMode = 'd'; __zetKaart('standard'); selectedDataKey = null; await renderDataView();
        const box = document.getElementById('data-table-scroll'), wacht = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        box.scrollTop = 0; await wacht();
        document.querySelector(`#data-table-body tr[data-k="${kn}"]`).click(); await wacht();
        const notitieH = document.querySelector('#data-table-body tr.notitie-rij').offsetHeight;
        const hoog0 = box.scrollHeight;
        box.scrollTop = 4000; await wacht(); await wacht();
        const hoogVer = box.scrollHeight, weg = !document.querySelector('#data-table-body tr.notitie-rij');
        /* een rij ver beneden: staat hij op dezelfde plek als je er nog eens heen scrolt */
        const doel = document.querySelector('#data-table-body tr[data-k]:nth-child(20)'), dk = doel.dataset.k;
        const y1 = doel.getBoundingClientRect().top;
        box.scrollTop = 0; await wacht(); await wacht();
        const terug = !!document.querySelector('#data-table-body tr.notitie-rij'), hoogTerug = box.scrollHeight;
        box.scrollTop = 4000; await wacht(); await wacht();
        const y2 = document.querySelector(`#data-table-body tr[data-k="${dk}"]`).getBoundingClientRect().top;
        return {notitieH, verschilVer: hoogVer - hoog0, weg, terug, verschilTerug: hoogTerug - hoog0, verschuiving: Math.round(y2 - y1)};
      });
      eis('de notitieregel is echt hoger dan een rij (anders test dit niets)', typeof r === 'object' && r.notitieH > 100, true);
      eis('ver naar beneden: de notitieregel is uit de DOM, maar de tabel houdt dezelfde hoogte', r && [r.weg, r.verschilVer], [true, 0]);
      eis('terug naar boven: de notitieregel is er weer, nog steeds dezelfde hoogte', r && [r.terug, r.verschilTerug], [true, 0]);
      eis('een rij ver beneden staat na heen en weer scrollen op dezelfde plek', r && r.verschuiving, 0);
      /* een andere rij kiezen terwijl de notitieregel uit beeld is: niets verspringt (13528A7-00A) */
      const w = await pe(async () => {
        const box = document.getElementById('data-table-scroll'), wacht = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        selectedDataKey = null; await renderDataView(); box.scrollTop = 0; await wacht();
        const kaal = box.scrollHeight;
        const t = todayUTCDate(), kn = dateToKey(new Date(t.getTime() - 5*864e5));
        document.querySelector(`#data-table-body tr[data-k="${kn}"]`).click(); await wacht();
        box.scrollTop = 4000; await wacht(); await wacht();
        const rij = document.querySelector('#data-table-body tr[data-k]:nth-child(20)'), y0 = rij.getBoundingClientRect().top, rk = rij.dataset.k;
        rij.click(); await wacht();
        box.scrollTop += 1; await wacht(); await wacht();
        const y1 = document.querySelector(`#data-table-body tr[data-k="${rk}"]`).getBoundingClientRect().top;
        return {hoogte: box.scrollHeight - kaal, schuif: Math.round(y1 - y0)};
      });
      eis('een andere rij kiezen terwijl de notitieregel uit beeld is: de tabel krijgt weer zijn gewone hoogte en de gekozen rij blijft staan', w && [w.hoogte, Math.abs(w.schuif + 1) <= 1], [0, true]);
      /* de laag Notities uit terwijl de notitieregel uit beeld is: geen lege strook (13528ED-002) */
      const l = await pe(async () => {
        const box = document.getElementById('data-table-scroll'), wacht = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        selectedDataKey = null; await renderDataView(); box.scrollTop = 0; await wacht();
        const kaal = box.scrollHeight;
        const t = todayUTCDate(), kn = dateToKey(new Date(t.getTime() - 5*864e5));
        document.querySelector(`#data-table-body tr[data-k="${kn}"]`).click(); await wacht();
        box.scrollTop = 4000; await wacht(); await wacht();
        const met = box.scrollHeight - kaal;
        zetLaag('notities', false); await renderDataView(true); await wacht(); await wacht();
        const zonder = box.scrollHeight - kaal;
        zetLaag('notities', true); vergeetLaag('notities', 'g'); selectedDataKey = null; await renderDataView(true);
        return [met > 100, zonder];
      });
      eis('laag Notities uit met de notitieregel uit beeld: de tabel krijgt zijn gewone hoogte, zonder lege strook', l, [true, 0]);
    }

    console.log('Tabel: selectie, lopende periode en rijhoogte (13528F1-002)');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      await opzet();
      const vandaag = await pe(() => todayUTCDate().getTime());
      const dag = i => new Date(vandaag - i*864e5).toISOString().slice(0, 10).replace(/-/g, '');
      const zet = (d, n, extra) => pe(async ([d, n, extra]) => { Object.assign(bronnen[0], {meerdere_metingen: false}, extra || {});
        dataCache = {g: d}; zetTabel('g', d, n || {}, {}); __volledigeTabel.add(d); bumpDataVersion('g');
        dataPeriodFilter = '1m'; dataAggMode = 'd'; __zetKaart('standard'); selectedDataKey = null; expandedGapRuns.clear(); expandedMultiDays.clear(); document.getElementById('data-table-scroll').scrollTop = 0; await renderDataView();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, [d, n, extra]);
      /* een reeks uit- of samenvouwen laat de gekozen rij (en zijn notitieregel) staan */
      const d1 = {}; [1, 2, 7, 8, 9].forEach(i => { d1['D' + dag(i)] = 80 + i/10; });
      await zet(d1, {['D' + dag(2)]: 'een notitie'});
      const keuze = await pe(async k => { document.querySelector(`#data-table-body tr[data-k="${k}"]`).click(); await new Promise(r => setTimeout(r, 50));
        document.querySelector('#data-table-body tr.gap-summary-row').click(); await new Promise(r => setTimeout(r, 150));
        const a = [selectedDataKey, !!document.querySelector('#data-table-body tr.notitie-rij')];
        document.querySelector('#data-table-body tr.gap-collapse-row').click(); await new Promise(r => setTimeout(r, 150));
        return [a, [selectedDataKey, !!document.querySelector('#data-table-body tr.notitie-rij')]]; }, dag(2));
      eis('een reeks uitvouwen en weer samenvouwen: de gekozen rij en zijn notitieregel blijven', keuze, [[dag(2), true], [dag(2), true]]);
      /* per week: de lopende week blijft staan, ook zonder meting (zoals vandaag bij de dagen) */
      const d2 = {}; [30, 31, 32, 33].forEach(i => { d2['D' + dag(i)] = 80; });
      await zet(d2);
      eis('per week zonder recente meting: de lopende week staat er, niet in een ingeklapte reeks', await pe(async () => { dataAggMode = 'w'; dataPeriodFilter = '3m'; await renderDataView();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const eerste = document.querySelector('#data-table-body tr:not([aria-hidden])'); return !!eerste && eerste.classList.contains('today-row'); }), true);
      /* meer metingen per dag: een nieuwe meting via het potlood is na opslaan gekozen, zijn dag uitgeklapt */
      const d3 = {}; [1, 2].forEach(i => { d3['D' + dag(i) + 'T0800'] = 80; d3['D' + dag(i) + 'T2000'] = 81; });
      await zet(d3, {}, {meerdere_metingen: true});
      const nieuw = await pe(async () => { document.getElementById('btn-edit-selected-datapoint').click(); await new Promise(r => setTimeout(r, 100));
        document.getElementById('f-data-value').value = '79.5'; document.getElementById('btn-add-datapoint').click(); await new Promise(r => setTimeout(r, 400));
        const tr = selectedDataKey && document.querySelector(`#data-table-body tr[data-k="${selectedDataKey}"]`);
        return [!!selectedDataKey, !!tr && tr.classList.contains('selected'), expandedMultiDays.has(dateToKey(todayUTCDate()))]; });
      eis('meer per dag: een nieuwe meting is na opslaan gekozen, met zijn dag uitgeklapt', nieuw, [true, true, true]);
      /* de rijhoogte wordt op een gewone rij gemeten, niet op een tijdregel (die is lager) */
      const d4 = {}; for(let i = 1; i < 200; i++){ d4['D' + dag(i) + 'T0800'] = 80; d4['D' + dag(i) + 'T2000'] = 81; }
      await zet(d4, {}, {meerdere_metingen: true});
      const hoogte = await pe(async () => { dataPeriodFilter = 'all'; for(let i = 1; i < 200; i++){ const t = todayUTCDate(); expandedMultiDays.add(dateToKey(new Date(t.getTime() - i*864e5))); }
        await renderDataView(); const box = document.getElementById('data-table-scroll'), w = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await w(); const rij = document.querySelector('#data-table-body tr[data-k]:not(.today-row):not(.submeting-row)').getBoundingClientRect().height;
        const metingen = [];
        for(const st of [box.scrollHeight * 0.3, box.scrollHeight * 0.5, box.scrollHeight * 0.7]){ box.scrollTop = Math.round(st); await w(); measuredRowHeight = null; await renderDataView(true); await w(); metingen.push(Math.round(measuredRowHeight)); }
        return metingen.every(h => h === Math.round(rij)) || [Math.round(rij), metingen]; });
      eis('de rijhoogte is die van een gewone rij, ook als het zichtbare stuk met een tijdregel begint', hoogte, true);
      const hoogtes = sel => pe(sel => [...document.querySelectorAll('#data-table-body ' + sel)].map(r => Math.round(r.getBoundingClientRect().height)), sel);
      const dagrij = () => pe(() => { const r = [...document.querySelectorAll('#data-table-body tr[data-k]:not(.today-row):not(.submeting-row)')][0]; return r ? Math.round(r.getBoundingClientRect().height) : null; });
      /* 2: de tijdregels onder een uitgeklapte dag zijn even hoog als een dagrij */
      await zet(d3, {}, {meerdere_metingen: true});
      await pe(async k => { expandedMultiDays.add(k); await renderDataView(true); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, dag(1));
      const h2 = await dagrij();
      eis('de tijdregels zijn even hoog als een dagrij', (await hoogtes('tr.submeting-row')).every(h => h === h2) && h2 > 30, true);
      /* 3: grote getallen op een smal scherm: de datum breekt over twee regels; de regels
         '⋯ n dagen ⋯', '+ meting toevoegen' en de tijdregels worden even hoog als de dagrij */
      const d5 = {}; [1, 5, 9, 13].forEach(i => { d5['D' + dag(i) + 'T0700'] = 1061000 + i*60; d5['D' + dag(i) + 'T1900'] = 1061020 + i*60; });
      await zet(d5, {}, {meerdere_metingen: true, duizendtal: true, decimalen: 0});
      await pe(async k => { expandedMultiDays.add(k); await renderDataView(true); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, dag(5));
      const h3 = await dagrij();
      const anders3 = [...await hoogtes('tr.gap-summary-row'), ...await hoogtes('tr.add-submeting-row'), ...await hoogtes('tr.submeting-row')];
      eis('datum over twee regels: alle regels even hoog als de dagrij', [h3 > 50, anders3.length >= 3, anders3.every(h => h === h3)], [true, true, true]);
      await pe(() => { Object.assign(bronnen[0], {duizendtal: false, decimalen: 1}); });
      /* 4: de zebrastreep hoort bij de rij: een rij verder scrollen of een notitieregel
         eronder verandert de streep van een rij niet */
      const d6 = {}; for(let i = 1; i < 300; i++) d6['D' + dag(i)] = 80 + (i % 7) / 10;
      await zet(d6, {['D' + dag(6)]: 'een notitie'});
      const streep = await pe(async ([k, kn]) => { dataPeriodFilter = 'all'; await renderDataView(); const box = document.getElementById('data-table-scroll'), w = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const kleur = () => { const r = document.querySelector(`#data-table-body tr[data-k="${k}"]`); return r ? getComputedStyle(r.cells[0]).backgroundColor : null; };
        const rh = document.querySelector('#data-table-body tr[data-k]:not(.today-row)').getBoundingClientRect().height, uit = [];
        for(const y of [0, 1, 2, 3, 4, 5]){ box.scrollTop = Math.round(y * rh); await w(); uit.push(kleur()); }
        box.scrollTop = 0; await w(); document.querySelector(`#data-table-body tr[data-k="${kn}"]`).click(); await w(); uit.push(kleur());
        document.querySelector(`#data-table-body tr[data-k="${kn}"]`).click(); await w();
        return uit; }, [dag(12), dag(6)]);
      eis('de zebrastreep van een rij blijft gelijk bij scrollen en onder een notitieregel', Array.isArray(streep) && streep.every(c => c && c === streep[0]), true);
      /* 6 en 10: per tijd een tijdstip met alleen een notitie als rij, en vandaag gemarkeerd */
      const d7 = {}; [0, 1, 2].forEach(i => { d7['D' + dag(i) + 'T0800'] = 80; d7['D' + dag(i) + 'T2000'] = 81; });
      await zet(d7, {['D' + dag(1) + 'T1500']: 'alleen een notitie'}, {meerdere_metingen: true});
      const tijd = await pe(async ([kn, kv]) => { dataAggMode = 'p'; await renderDataView(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = document.querySelector(`#data-table-body tr[data-k="${kn}"]`), v = document.querySelector('#data-table-body tr.today-row');
        return [r ? [r.querySelector('.val').textContent.trim(), r.classList.contains('met-notitie')] : null, v ? v.dataset.k : null]; }, ['D' + dag(1) + 'T1500', 'D' + dag(0) + 'T2000']);
      eis('per tijd: een tijdstip met alleen een notitie heeft een rij met streepje en hoekje, en de nieuwste meting van vandaag de balk', tijd, [['–', true], 'D' + dag(0) + 'T2000']);
      const d8 = {}; [1, 2].forEach(i => { d8['D' + dag(i) + 'T0800'] = 80; });
      await zet(d8, {}, {meerdere_metingen: true});
      eis('per tijd zonder meting vandaag: bovenaan een lege rij voor vandaag met de balk, niet te kiezen', await pe(async () => { dataAggMode = 'p'; await renderDataView(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = document.querySelector('#data-table-body tr:not([aria-hidden])'); return r ? [r.classList.contains('today-row'), r.hasAttribute('data-k'), r.cells[0].textContent.includes(formatDateCell(dateToKey(todayUTCDate())).replace(/<br>/g, '').slice(0, 5))] : null; }), [true, false, true]);
      /* 7: Alles loopt tot en met een notitie na de laatste meting */
      const d9 = {}; [3, 4, 5].forEach(i => { d9['D' + dag(i)] = 80; });
      await zet(d9, {['D' + dag(0)]: 'alleen vandaag een notitie'});
      eis('Alles: een notitie na de laatste meting staat in de tabel, met het hoekje', await pe(async k => { dataPeriodFilter = 'all'; await renderDataView(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = document.querySelector(`#data-table-body tr[data-k="${k}"]`); return r ? r.classList.contains('met-notitie') : null; }, dag(0)), true);
      eis('Alles met de laag Notities uit: de tabel loopt tot de laatste meting, niet tot de notitie', await pe(async k => { zetLaag('notities', false); await renderDataView(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = !!document.querySelector(`#data-table-body tr[data-k="${k}"].met-notitie`); zetLaag('notities', true); vergeetLaag('notities', 'g'); return r; }, dag(0)), false);
      await zet(d7, {['D' + dag(1) + 'T1500']: 'alleen een notitie'}, {meerdere_metingen: true});
      eis('per tijd met de laag Notities uit: geen rij voor een tijdstip met alleen een notitie', await pe(async kn => { dataAggMode = 'p'; zetLaag('notities', false); await renderDataView(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = !!document.querySelector(`#data-table-body tr[data-k="${kn}"]`); zetLaag('notities', true); vergeetLaag('notities', 'g'); return r; }, 'D' + dag(1) + 'T1500'), false);
      await pe(() => { Object.assign(bronnen[0], {meerdere_metingen: false}); expandedMultiDays.clear(); expandedGapRuns.clear(); dataPeriodFilter = '1m'; dataAggMode = 'd'; });
    }

    console.log('Geen lampje meer (13528ED-001)');
    {
      await opzet();
      eis('het statistiekenvenster heeft geen lampje en geen kader met zinnen meer', await p.evaluate(() => [!!document.getElementById('chart-stats-lamp'), !!document.getElementById('chart-stats-analyse'), typeof window.analyseZinnen]), [false, false, 'undefined']);
    }

    console.log('Twee van drie (13528A7-006)');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      await opzet();
      /* 40 dagen ruis rond 80; vandaag en eergisteren een stuk hoger, tussen oranje en rood */
      const r = await pe(async () => {
        const t = todayUTCDate(), ruis = [0.12,-0.08,0.03,-0.11,0.07,-0.02,0.09,-0.06,0.01,-0.04,0.10,-0.09];
        let d = null, x = 0;
        for(x = 0.1; x < 2; x += 0.01){
          d = {}; for(let i = 0; i < 40; i++){ const y = new Date(t); y.setUTCDate(y.getUTCDate() - i); d['D' + dateToKey(y)] = Math.round((80 + (i === 0 || i === 2 ? x : ruis[i % 12]))*100)/100; }
          const v = Object.values(d), m = v.reduce((a, b) => a + b)/v.length, s = Math.sqrt(v.reduce((a, b) => a + (b - m)*(b - m), 0)/(v.length - 1));
          const hoog = [0, 2].map(i => { const y = new Date(t); y.setUTCDate(y.getUTCDate() - i); return d['D' + dateToKey(y)]; });
          if(hoog.every(h => h > m + 2*s + 0.02 && h < m + 3*s - 0.02)) break;
        }
        Object.assign(bronnen[0], {doel_x: null, doel_r: null, decimalen: 2});
        const tabel = {...d}; zetTabel('g', tabel, {}, {}); __volledigeTabel.add(tabel); bumpDataVersion('g');
        dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
        dataPeriodFilter = '3m'; dataAggMode = 'd'; __zetKaart('standard'); vergeetLaag('run', 'g'); await renderDataView(true);
        const geel = () => { const c = document.getElementById('data-chart-canvas'), q = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
          for(let i = 0; i < q.length; i += 4) if(Math.abs(q[i]-232) < 14 && Math.abs(q[i+1]-197) < 14 && Math.abs(q[i+2]-71) < 14) n++; return n; };
        const uit = {zonderLaag: [window.lastChartStats.runs, geel()]};
        zetLaag('run', true); await renderDataView(true);
        uit.metLaag = [(window.lastChartStats.runs.tweeVanDrie || []).map(k => k.van + '-' + k.tot + (k.richting > 0 ? '+' : '-')).join(), geel() > 30];
        uit.label = (document.getElementById('data-chart-canvas').__runLabels || []).filter(t => / van /.test(t));
        window.chartSwipeJustHappened = false; openChartStatsModal(); await new Promise(r => setTimeout(r, 80));
        uit.rij = [...document.querySelectorAll('#chart-stats-modal-body-chart tr')].map(tr => tr.cells[0].textContent + '=' + tr.cells[1].textContent).find(s => /2 van 3/.test(s));
        document.getElementById('chart-stats-modal-close').click(); await new Promise(r => setTimeout(r, 120));
        zetLaag('run', false); vergeetLaag('run', 'g'); __zetKaart('range'); zetLaag('run', true); await renderDataView(true);
        uit.range = window.lastChartStats.runs;
        zetLaag('run', false); vergeetLaag('run', 'g'); __zetKaart('standard'); Object.assign(bronnen[0], {decimalen: 1}); await renderDataView(true);
        return uit;
      });
      eis('zonder de laag Run-regels: geen run-regels en geen geel in de grafiek', r.zonderLaag, [null, 0]);
      eis('met de laag: twee van drie over de laatste drie punten, en de gele haak met het label', r.metLaag, ['37-39+', true]);
      eis('het label in de grafiek telt de punten onder de haak: twee voorbij oranje met één ertussen is 2 van 3 (13528ED-004)', r.label, ['2 van 3']);
      eis('de tab Kaart telt het: 2 van 3 oranje = 1×', r.rij, '2 van 3 oranje=1×');
      eis('bij Range geen run-regels, dus ook geen twee van drie', r.range, null);
    }

    console.log('Eigen periode');
    // 13528A7-001: de melding bij een eigen periode zonder metingen zegt 'periode', niet 'bereik'
    await opzet();
    await p.evaluate(() => { document.getElementById('data-range-from').value = '2026-09-01'; document.getElementById('data-range-to').value = '2026-09-30';
      document.getElementById('data-range-apply').click(); });
    await wacht(200);
    eis('een eigen periode vóór de eerste meting: de melding zegt "Deze periode" (13528A7-001)', await tekst('warn-text'), 'Deze periode ligt geheel vóór de eerste meting (16-10-2026).');
    await p.evaluate(() => document.getElementById('warn-cancel').click()); await wacht(150);

    console.log('Metingvenster');
    /* Sinds 1352898-020 schrijft alleen Trends in de bestanden: opslaan leest of
       vergelijkt het bestand niet meer. */
    // A. een bewerking buiten Trends om: eerst opnieuw ingelezen, dan jouw wijziging (13528F2-004)
    await opzet();
    await buiten('gewicht.txt', {D20261016: 82.3, D20261017: 82.4});
    await meting('D20261017', '82.1'); await wacht(400);
    eis('bij bewerken vraagt de app niet of hij de meting zelf mag overschrijven', await zien('confirm-overlay'), false);
    eis('een bewerking buiten Trends om: opgeslagen en dicht', [await zien('datapoint-modal-overlay'), await tekst('data-melding')], [false, '(geen)']);
    eis('het bestand is het nieuwe bestand met jouw waarde: 82,3 van buiten blijft (13528F2-004)', await bestand('gewicht.txt'), {D20261016: 82.3, D20261017: 82.1});
    eis('en de tabel ook', await p.evaluate(() => Object.fromEntries(Object.entries(dataCache.g).sort())), {D20261016: 82.3, D20261017: 82.1});
    eis('een melding zegt dat het bestand opnieuw is ingelezen (13528F2-004)', [await zien('alert-overlay'), /gewicht\.txt was intussen buiten dit venster gewijzigd/.test(await tekst('alert-text'))], [true, true]);
    await p.evaluate(() => document.getElementById('alert-ok').click()); await wacht(100);
    // A4. daarna weer gewoon: de tweede opslag leest niet opnieuw en meldt niets
    await meting('D20261018', '81.9'); await wacht(400);
    eis('een tweede opslag: geen melding meer, want het bestand is wat Trends schreef', [await zien('alert-overlay'), (await bestand('gewicht.txt')).D20261018], [false, 81.9]);
    // A1. opslaan raakt het bestand alleen om te schrijven (de back-up van vandaag is al gemaakt)
    await opzet();
    await p.evaluate(async () => { await idbSet('backup:gewicht.txt', dateToKey(todayUTCDate()));
      window.__toegang = {opgezocht: 0, gelezen: 0}; const echt = dirHandle.getFileHandle;
      window.__toegang.stand = 0;
      dirHandle.getFileHandle = async (n, o) => { window.__toegang.opgezocht++; const h = await echt(n, o); const g = h.getFile;
        h.getFile = async () => { window.__toegang.stand++; const f = await g(); const t = f.arrayBuffer; f.arrayBuffer = async () => { window.__toegang.gelezen++; return t(); }; return f; }; return h; }; });
    await meting('D20261018', '81.7'); await wacht(400);
    /* 13528F3-005: vóór het schrijven één keer de inhoud lezen om te vergelijken (zoals Events), dan schrijven */
    eis('opslaan: één keer gelezen om te vergelijken, dan geschreven', await p.evaluate(() => window.__toegang), {opgezocht: 2, gelezen: 1, stand: 1});
    eis('en de meting staat erin', (await bestand('gewicht.txt')).D20261018, 81.7);
    // A3. een tabel zonder leeskopie overschrijft nooit een vol bestand
    await opzet(); await p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; });
    await p.evaluate(async () => { leesKopieModus = true; const echt = idbGet; idbGet = async (k) => k === 'kopie:gewicht.txt' ? null : echt(k); window.__echtIdb = echt;
      delete dataCache.g; await ensureDataLoaded('g'); idbGet = echt; });
    eis('zonder leeskopie: de tabel is leeg', await p.evaluate(() => Object.keys(dataCache.g || {}).length), 0);
    await meting('D20261018', '81.6'); await wacht(500);
    eis('opslaan leest dan eerst het bestand: de metingen die er stonden blijven', await bestand('gewicht.txt'), {D20261016: 82, D20261017: 82, D20261018: 81.6});
    eis('en de tabel is het bestand', await p.evaluate(() => Object.fromEntries(Object.entries(dataCache.g).sort())), {D20261016: 82, D20261017: 82, D20261018: 81.6});

    // A2. meer metingen per dag: een ANDERE meting overschrijven vraagt wel
    await opzet();
    await p.evaluate(() => { bronnen[0].meerdere_metingen = true; dataCache = {g: {D20261017T0800: 80.0, D20261017T2000: 81.0}}; bumpDataVersion('g');
      window.__fs['gewicht.txt'] = {tekst: __data(dataCache.g), mtime: 600};
      openEditDatapointModal('g', 'D20261017T0800'); document.getElementById('f-data-time').value = '20:00'; document.getElementById('btn-add-datapoint').click(); });
    await wacht(200);
    eis('een andere meting overschrijven vraagt nog wel', await zien('confirm-overlay'), true);
    await p.evaluate(() => document.getElementById('confirm-cancel').click()); await wacht(100);
    await p.evaluate(() => closeDatapointModal());

    // B. opslaan mislukt
    await opzet();
    await p.evaluate(() => { window.__faal = true; }); await meting('D20261018', '81.5'); await wacht(300);
    eis('mislukt: het venster blijft open', await zien('datapoint-modal-overlay'), true);
    eis('met Opslaan mislukt.', await tekst('data-melding'), 'Opslaan mislukt.');
    eis('de knop blijft Opslaan', await knop('btn-add-datapoint'), 'Opslaan gewoon');
    eis('de waarde staat niet in de tabel', await p.evaluate(() => 'D20261018' in dataCache.g), false);
    await p.evaluate(() => { window.__faal = false; document.getElementById('btn-add-datapoint').click(); }); await wacht(300);
    eis('nog eens Opslaan lukt en sluit', await zien('datapoint-modal-overlay'), false);
    eis('de waarde staat in het bestand', (await bestand('gewicht.txt')).D20261018, 81.5);

    // C. verwijderen met Geen meting, ook na een bewerking buiten Trends om
    await opzet();
    await buiten('gewicht.txt', {D20261016: 83.0, D20261017: 82.4});
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); setTimeout(() => document.getElementById('confirm-ok').click(), 50); }); await wacht(400);
    eis('verwijderen: weg uit het bestand, 82,4 van buiten blijft, het venster dicht (13528F2-004)', [await bestand('gewicht.txt'), await zien('datapoint-modal-overlay')], [{D20261017: 82.4}, false]);
    await p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; });

    // C2. 'Geen meting' is ook verwijderen
    await opzet();
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); }); await wacht(150);
    if(await zien('confirm-overlay')){ await p.evaluate(() => document.getElementById('confirm-ok').click()); }
    await wacht(400);
    eis("'geen meting' verwijdert hem", [await bestand('gewicht.txt'), await zien('datapoint-modal-overlay')], [{D20261017: 82}, false]);

    // D. mislukte verwijdering; daarna slaat Opslaan op
    await opzet();
    await p.evaluate(() => { window.__faal = true; openEditDatapointModal('g', 'D20261016'); setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); setTimeout(() => document.getElementById('confirm-ok').click(), 50); }); await wacht(300);
    eis('mislukte verwijdering: Verwijderen mislukt.', await tekst('data-melding'), 'Verwijderen mislukt.');
    eis('de knop blijft Opslaan', await knop('btn-add-datapoint'), 'Opslaan gewoon');
    await p.evaluate(() => { window.__faal = false; const v = document.getElementById('f-data-value'); v.value = '79.9'; v.dispatchEvent(new Event('input')); document.getElementById('btn-add-datapoint').click(); }); await wacht(300);
    eis('Opslaan slaat daarna op en verwijdert niets', (await bestand('gewicht.txt')).D20261016, 79.9);

    // F. een regel die buiten Trends om in het bestand kwam: blijft staan, zoals bij openen (13528F2-004)
    await opzet();
    await p.evaluate(() => idbDelete('backup:gewicht.txt'));   // de eerste opslag van vandaag
    await buiten('gewicht.txt', {D20261016: 82.0, D20261017: 82.0, D20261015: '81x'});
    await meting('D20261018', '81.0'); await wacht(400);
    const naOpslaan = await bestand('gewicht.txt');
    eis('opslaan: jouw meting erin, de onleesbare regel van buiten blijft ongewijzigd', [naOpslaan.D20261018, naOpslaan.D20261015], [81, 'D20261015;81x']);
    await p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; });
    eis('de eerste opslag van de dag zet het bestand van daarvoor in de back-up', /81x/.test((await p.evaluate(() => window.__fs['gewicht_backup.txt'] && window.__fs['gewicht_backup.txt'].tekst)) || ''), true);

    // G. een bestand dat niet in UTF-8 is opgeslagen (een editor in een oude Windows-tekenset): nooit overschrijven (13528F3-003)
    const geenUtf8 = () => p.evaluate(() => { window.__fs['gewicht.txt'] = {tekst: '?', bytes: new Uint8Array([...new TextEncoder().encode('D20261016;82.0;caf'), 0xE9, 10]), mtime: 800}; });
    const geenUtf8Tekst = 'Het bestand is niet in UTF-8 opgeslagen. Niet opgeslagen: sla het in je editor op als UTF-8, of zet de back-up terug.';
    await opzet(); await geenUtf8();
    await meting('D20261018', '81.0'); await wacht(400);
    eis('geen UTF-8, ook met een volledige tabel: niet opgeslagen, met de melding', await tekst('data-melding'), geenUtf8Tekst);
    eis('en het bestand is ongemoeid (de bytes ook)', await p.evaluate(() => [window.__fs['gewicht.txt'].tekst, window.__fs['gewicht.txt'].bytes.length]), ['?', 20]);
    await p.evaluate(() => closeDatapointModal());
    await opzet(); await geenUtf8(); await p.evaluate(() => { dataCache.g = {...dataCache.g}; });
    await meting('D20261018', '81.0'); await wacht(400);
    eis('geen UTF-8 en een tabel die het niet weergeeft: ook niet opgeslagen', await tekst('data-melding'), geenUtf8Tekst);
    await p.evaluate(() => closeDatapointModal());

    // H. niet sluiten tijdens het opslaan
    await opzet();
    await p.evaluate(() => { window.__traag = true; openEditDatapointModal('g', 'D20261018'); document.getElementById('f-data-value').value = '81.0';
      document.getElementById('btn-add-datapoint').click(); document.getElementById('btn-cancel-datapoint').click(); document.getElementById('datapoint-modal-overlay').click(); });
    eis('tijdens het opslaan blijft het venster open', await zien('datapoint-modal-overlay'), true);
    await wacht(900);
    eis('daarna opgeslagen en dicht', (await bestand('gewicht.txt')).D20261018 === 81 && !(await zien('datapoint-modal-overlay')), true);

    console.log('Bronvenster');
    const bronOpslaan = () => p.evaluate(() => { switchToView('meta');
      editSource('g'); document.getElementById('f-titel').value = 'Gewicht nieuw'; document.getElementById('btn-save-source').click(); });
    // I. bronnenlijst buiten Trends om gewijzigd: gewoon opgeslagen
    await opzet();
    await p.evaluate(() => { window.__fs['trends.json'] = {tekst: window.__fs['trends.json'].tekst.replace('Gewicht', 'Gewicht (pc)'), mtime: 900}; });
    await bronOpslaan(); await wacht(400);
    eis('bronnenlijst na een bewerking buiten Trends om: opgeslagen, zonder melding', [await tekst('bron-melding'), (await bestand('trends.json')).bronnen[0].titel], ['(geen)', 'Gewicht nieuw']);
    // J. een bronnenlijst die niet volledig is ingelezen, wordt niet weggeschreven
    await opzet();
    await p.evaluate(() => { bronnenVolledig = false; });
    await bronOpslaan(); await wacht(400);
    eis('niet volledig ingelezen: niets opgeslagen, en dat staat er', [await tekst('bron-melding'), (await bestand('trends.json')).bronnen[0].titel],
        ['De bronnenlijst is niet volledig ingelezen; er is niets opgeslagen. Vernieuw eerst, of herstel trends.json uit de back-up.', 'Gewicht']);
    await p.evaluate(() => closeSourceModal());

    // K. meer metingen per dag aan: de metingen opnieuw inlezen
    await opzet();
    await buiten('gewicht.txt', {D20261016: 82.0, D20261017: 82.0, D20261018: 70.0});
    await p.evaluate(() => { switchToView('meta'); editSource('g'); document.getElementById('f-meerdere-metingen').click(); document.getElementById('btn-save-source').click(); }); await wacht(400);
    await p.evaluate(() => ensureDataLoaded('g'));
    eis('meer metingen per dag veranderd: de metingen komen opnieuw uit het bestand', await p.evaluate(() => dataCache.g && Object.keys(dataCache.g).some(k => k.startsWith('D20261018') && dataCache.g[k] === 70)), true);

    console.log('Volgorde');
    const tweeBronnen = (extra) => p.evaluate((extra) => {
      bronnen = bronnen.concat([{id:'s', titel:'Stappen', bestand:'s.txt', decimalen:0}].concat(extra ? [{id:'k', titel:'Km', bestand:'k.txt', decimalen:0}] : []));
      window.__fs['trends.json'] = {tekst: JSON.stringify(metaFileObj()), mtime: 500};
      if(typeof __bestandStempel !== 'undefined') __bestandStempel.set('trends.json', {lastModified: 500, size: window.__fs['trends.json'].tekst.length});
      if(typeof __tekstVan !== 'undefined') __tekstVan.set('trends.json', window.__fs['trends.json'].tekst);
      switchToView('meta'); renderSourceList(); selectedSourceId = 's';
    }, extra);
    // L. mislukt, Opnieuw
    await opzet(); await tweeBronnen(false);
    await p.evaluate(() => { window.__faal = true; moveSelectedSource(-1); }); await wacht(200);
    eis('mislukt: de balk', await tekst('volgorde-tekst'), 'Volgorde niet opgeslagen.');
    eis('Annuleren staat links van de actie', await p.evaluate(() => { const a = document.getElementById('volgorde-annuleer'), b = document.getElementById('volgorde-opnieuw'); return a.getBoundingClientRect().left < b.getBoundingClientRect().left; }), true);
    eis('de volgorde in beeld is niet veranderd', await p.evaluate(() => bronnen.map(b => b.id).join()), 'g,s');
    await p.evaluate(() => { window.__faal = false; document.getElementById('volgorde-opnieuw').click(); }); await wacht(300);
    eis('Opnieuw lukt', await p.evaluate(() => bronnen.map(b => b.id).join()), 's,g');
    eis('en de balk is weg', await zien('volgorde-balk'), false);
    // M. Opnieuw verschuift de bron die fout ging
    await opzet(); await tweeBronnen(true);
    await p.evaluate(() => { window.__faal = true; moveSelectedSource(1); }); await wacht(200);
    await p.evaluate(() => { selectedSourceId = 'g'; window.__faal = false; document.getElementById('volgorde-opnieuw').click(); }); await wacht(300);
    eis('Opnieuw verschuift Stappen, niet de nu gekozen bron', await p.evaluate(() => bronnen.map(b => b.id).join()), 'g,k,s');
    // N. twee snelle tikken
    await opzet(); await tweeBronnen(true);
    await p.evaluate(() => { window.__traag = true; moveSelectedSource(1); moveSelectedSource(1); }); await wacht(900);
    eis('twee snelle tikken: één stap', await p.evaluate(() => bronnen.map(b => b.id).join()), 'g,k,s');
    eis('in het bestand ook', (await bestand('trends.json')).bronnen.map(b => b.titel).join(), 'Gewicht,Km,Stappen');
    // O. een stap die niet kan, verbergt de balk
    await opzet(); await tweeBronnen(false);
    await p.evaluate(() => { window.__faal = true; moveSelectedSource(-1); }); await wacht(200);
    await p.evaluate(() => { window.__faal = false; selectedSourceId = 'g'; volgordeBalk.dir = -1; volgordeBalk.bronId = 'g'; document.getElementById('volgorde-opnieuw').click(); }); await wacht(300);
    eis('Opnieuw voor een stap die niet meer kan: de balk verdwijnt', await zien('volgorde-balk'), false);

    console.log('Inlezen');
    // P. een waarde die geen getal is, wordt al bij het inlezen gemeld
    await opzet();
    await p.evaluate(() => { window.__fs['gewicht.txt'] = {tekst: __data({D20261016: 82, D20261017: '81x', 'D2026-10-03': 80}), mtime: 900}; delete dataCache.g; return ensureDataLoaded('g'); });
    await wacht(100);
    const alert = await tekst('alert-text');
    eis('inlezen: één melding met de regel zonder getal én de foute datumsleutel, zoals ze er staan (13528F3-003)', /niet te lezen \((D20261017;81x · D2026-10-03;80|D2026-10-03;80 · D20261017;81x)\)/.test(alert), true);

    console.log('Derde review (1352898-015)');
    const alertWeg = () => p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; });
    // Q. bron wisselen terwijl de vorige nog laadt: de tabel hoort bij de gekozen bron
    await opzet(); await alertWeg();
    await p.evaluate(() => {
      bronnen = bronnen.concat([{id:'s', titel:'Stappen', bestand:'s.txt', decimalen:0, meerdere_metingen:false}]);
      window.__fs['s.txt'] = {tekst: __data({D20261016: 5000}), mtime: 600};
      renderSourceSelects(); delete dataCache.g; delete dataCache.s;
      const echt = leesDataVanDir;
      leesDataVanDir = async (n) => { if(n === 'gewicht.txt') await new Promise(r => setTimeout(r, 400)); return echt(n); };
      const sel = document.getElementById('data-source-select');
      sel.value = 'g'; renderDataView();
      setTimeout(() => { sel.value = 's'; renderDataView(); }, 50);
      window.__echtLezen = echt;
    });
    await wacht(800);
    await p.evaluate(() => { leesDataVanDir = window.__echtLezen; });
    eis('na een snelle wissel toont de tabel de gekozen bron', await p.evaluate(() => [document.getElementById('data-source-select').value, /5000/.test(document.getElementById('data-table-body').textContent), /82\.0/.test(document.getElementById('data-table-body').textContent)]), ['s', true, false]);
    // R. dubbel inlezen bij een wissel
    await opzet(); await alertWeg();
    const gelezen = await p.evaluate(async () => {
      let n = 0; const echt = leesDataVanDir;
      leesDataVanDir = async (x) => { if(x === 'gewicht.txt') n++; return echt(x); };
      delete dataCache.g;
      await Promise.all([ensureDataLoaded('g'), ensureDataLoaded('g')]);
      leesDataVanDir = echt; return n;
    });
    eis('twee aanvragen tegelijk lezen het bestand één keer', gelezen, 1);
    // S. 'Geen meting' op een dag die niet in de tabel staat (daar kwam buiten Trends om een meting)
    await opzet(); await alertWeg();
    await buiten('gewicht.txt', {D20261016: 82.0, D20261017: 82.0, D20261018: 79.0});
    await p.evaluate(() => openEditDatapointModal('g', 'D20261018'));   // niet in de tabel: toevoegen
    await p.evaluate(() => { editingDataKey = null; currentDatapointKey = 'D20261018'; setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); });
    await wacht(200);
    if(await zien('confirm-overlay')) await p.evaluate(() => document.getElementById('confirm-ok').click());
    await wacht(400);
    eis("'Geen meting' op een dag die niet in de tabel staat: opgeslagen en dicht; het bestand is de tabel",
        [await bestand('gewicht.txt'), await zien('datapoint-modal-overlay')], [{D20261016: 82, D20261017: 82}, false]);
    // T. bronvenster: wat geen getal is, wordt niet bewaard
    for (const [veld, waarde, melding] of [['f-decimalen', '-1', 'Decimalen'], ['f-doelx', '-', 'Doelwaarde'], ['f-min', '90', 'Min is groter']]) {
      await opzet(); await alertWeg();
      await p.evaluate(([veld, waarde]) => { switchToView('meta'); editSource('g'); if(veld === 'f-min') document.getElementById('f-max').value = '80'; document.getElementById(veld).value = waarde; document.getElementById('btn-save-source').click(); }, [veld, waarde]);
      await wacht(300);
      eis(`bronvenster: ${veld} = "${waarde}" wordt geweigerd met een melding`, [new RegExp(melding).test(await tekst('alert-text')), (await bestand('trends.json')).bronnen[0].decimalen], [true, 1]);
      await p.evaluate(() => closeSourceModal());
    }
    // 13528A4-01B: het doel weghalen wist ook de opgeslagen stand van de laag Doel
    await opzet(); await alertWeg();
    await p.evaluate(() => { localStorage.setItem('trends.doel.g', '0'); localStorage.setItem('trends.doel.g.regressie', '0'); for(const k of Object.keys(__laagStand)) delete __laagStand[k]; switchToView('meta'); editSource('g'); document.getElementById('f-doelx').value = ''; document.getElementById('f-doelr').value = ''; document.getElementById('btn-save-source').click(); });
    await wacht(400);
    eis('het doel weghalen: de opgeslagen stand "Doel uit" is weg, zodat een nieuw doel weer zichtbaar is (01B)', await p.evaluate(() => [localStorage.getItem('trends.doel.g'), localStorage.getItem('trends.doel.g.regressie'), laagIsAan('doel')]), [null, null, true]);
    // U. meer metingen per dag aan en weer uit: de meting is weer te bewerken
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__fs['gewicht.txt'] = {tekst: __data({D20261016T1200: 82, D20261017T1200: 81}), mtime: 900}; delete dataCache.g; });
    await p.evaluate(() => ensureDataLoaded('g'));
    await p.evaluate(() => { switchToView('data'); openEditDatapointModal('g', 'D20261016'); });
    eis('na meer metingen uit: de meting van die dag opent als bewerken', await p.evaluate(() => [editingDataKey, document.getElementById('f-data-value').value]), ['D20261016', '82.0']);
    await p.evaluate(() => closeDatapointModal());
    // V. eigen periode openen en annuleren
    await opzet(); await alertWeg();
    await p.evaluate(() => { document.getElementById('data-range-from').value = '2026-09-01'; document.getElementById('data-range-to').value = '2026-09-30'; dataPeriodFilter = 'custom'; openDataRangeModal(); document.getElementById('data-range-cancel').click(); });
    eis('eigen periode openen en annuleren laat de periode staan', await p.evaluate(() => [document.getElementById('data-range-from').value, document.getElementById('data-range-to').value]), ['2026-09-01', '2026-09-30']);
    // W. verschil 0,04 op één decimaal: geen pijl met 0.0
    await opzet(); await alertWeg();
    eis('een verschil dat op 0 afrondt geeft een streepje, geen "↑ 0.0"', await p.evaluate(() => [verschilCel(0, 0.04, 1, '--muted'), /0\.1/.test(verschilCel(0, 0.06, 1, '--muted')), fmtVal(-0.04, 1), verschilCel(5, 5.04, 1, '--good')]), ['–', true, '0.0', '–']);
    // W2. Pijlkleur: zonder sleutel volg doel, te kiezen in het bronvenster en bewaard
    await opzet(); await alertWeg();
    const pijlen = () => p.evaluate(() => [...document.querySelectorAll('#data-table-body td.actions-cell svg')].map(s => s.style.stroke));
    await p.evaluate(async () => { bronnen[0].doel_x = 80; dataPeriodFilter = 'all'; const d = {D20261016: 84.0, D20261017: 83.0};
      window.__fs['gewicht.txt'] = {tekst: __data(d), mtime: 700}; dataCache.g = d; bumpDataVersion('g');
      if(typeof __volledigeTabel !== 'undefined') __volledigeTabel.add(d); await renderDataView(); });
    eis('zonder sleutel: volg doel, dalen richting 80 is groen', await pijlen(), ['var(--good)']);
    await p.evaluate(async () => { bronnen[0].doel_x = null; await renderDataView(); });
    eis('volg doel zonder doelwaarde: grijs', await pijlen(), ['var(--muted)']);
    await p.evaluate(() => { editSource('g'); document.getElementById('f-pijlkleur-btn').click(); });
    eis('de keuzelijst: vier opties, volg doel geselecteerd', await p.evaluate(() => [...document.querySelectorAll('#keuze-lijst .source-row')].map(r => r.classList.contains('selected'))), [false, false, false, true]);
    eis('de keuzelijst: per keuze de pijltjes en de naam, zonder toelichting; volg doel met het doelsymbool', await p.evaluate(() => [...document.querySelectorAll('#keuze-lijst .source-row')].map(r =>
      [r.textContent.trim(), [...r.querySelectorAll('.keuze-symbool svg')].map(s => s.style.stroke || 'doel')])),
      [['neutraal', ['var(--muted)', 'var(--muted)']], ['hoger is beter', ['var(--good)', 'var(--danger)']], ['lager is beter', ['var(--danger)', 'var(--good)']], ['volg doel', ['var(--muted)', 'var(--muted)', 'var(--text)']]]);
    await p.evaluate(() => { document.querySelectorAll('#keuze-lijst .source-row')[1].click(); document.getElementById('keuze-ok').click(); });
    eis('na OK: de knop toont de pijltjes van hoger is beter (↑ groen, ↓ rood), met de naam als label',
      await p.evaluate(() => { const k = document.getElementById('f-pijlkleur-btn'); return [[...k.querySelectorAll('#f-pijlkleur-label svg')].map(s => s.style.stroke), k.getAttribute('aria-label'), document.getElementById('f-pijlkleur-label').textContent.trim()]; }),
      [['var(--good)', 'var(--danger)'], 'Pijlkleur: hoger is beter', '']);
    await p.evaluate(() => document.getElementById('btn-save-source').click()); await wacht(600); await alertWeg();
    eis('opgeslagen in trends.json', await p.evaluate(() => JSON.parse(window.__fs['trends.json'].tekst).bronnen[0].pijlkleur), 'hoger');
    await p.evaluate(async () => { switchToView('data'); await renderDataView(); });
    eis('hoger is beter: een daling is rood', await pijlen(), ['var(--danger)']);
    // X. geen leeskopie van een bron: dat staat er
    await opzet(); await alertWeg();
    await p.evaluate(async () => { leesKopieModus = true; const echt = idbGet; idbGet = async (k) => k === 'kopie:gewicht.txt' ? null : echt(k); delete dataCache.g; switchToView('data'); await renderDataView(); idbGet = echt; leesKopieModus = false; });
    eis('zonder leeskopie zegt de tabel dat, niet "geen metingen"', /geen leeskopie/.test(await tekst('data-empty')), true);

    console.log('Draaiend rondje tijdens het opslaan (1352898-019)');
    /* Opslaan kan op de telefoon even duren: eerst de vraag om toegang tot de werkmap,
       dan het bestand. Tot 018 ging de knop dan alleen grijs. Nu: na 250 ms een draaiend
       rondje op de knop waarop je tikte; sneller klaar is geen flits. bezigLog legt vast
       of de knop ooit de klasse 'bezig' kreeg. */
    const bezigLog = ids => p.evaluate(ids => { window.__bezigOoit = {}; ids.forEach(id => { const k = document.getElementById(id); window.__bezigOoit[id] = false;
      new MutationObserver(() => { if(k.classList.contains('bezig')) window.__bezigOoit[id] = true; }).observe(k, {attributes: true, attributeFilter: ['class']}); }); }, ids);
    const bezig = id => p.evaluate(id => { const k = document.getElementById(id); return k.classList.contains('bezig'); }, id);
    const rondje = id => p.evaluate(id => { const k = document.getElementById(id); const voor = getComputedStyle(k, '::before');
      return [voor.animationName, getComputedStyle(k).opacity]; }, id);
    // AA. traag opslaan: eerst geen rondje, na 250 ms wel, daarna weer weg
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = true; const echt = dirHandle.requestPermission; leesKopieModus = true;
      dirHandle.requestPermission = async () => { await new Promise(r => setTimeout(r, 500)); return 'granted'; }; });
    await bezigLog(['btn-add-datapoint']);
    const maatKnop = () => p.evaluate(() => { const r = document.getElementById('btn-add-datapoint').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261018'); }); const maatVoor = await maatKnop(); await p.evaluate(() => closeDatapointModal());
    await meting('D20261018', '81.2'); await wacht(120);
    eis('traag opslaan: na 120 ms nog geen rondje (geen flits bij snel opslaan)', await bezig('btn-add-datapoint'), false);
    await wacht(330);
    eis('na 450 ms draait het rondje op Opslaan', await bezig('btn-add-datapoint'), true);
    eis('in volle kleur, en het draait', await rondje('btn-add-datapoint'), ['bezig-draai', '1']);
    eis('de tekst blijft in de knop (voor schermlezers), de knop meldt dat hij bezig is', await p.evaluate(() => { const k = document.getElementById('btn-add-datapoint'); return [k.textContent.trim(), k.getAttribute('aria-busy')]; }), ['Opslaan', 'true']);
    eis('de knop houdt zijn maat', await maatKnop(), maatVoor);
    await wacht(1000);
    eis('daarna opgeslagen en dicht', (await bestand('gewicht.txt')).D20261018 === 81.2 && !(await zien('datapoint-modal-overlay')), true);
    eis('en het rondje is weg', await bezig('btn-add-datapoint'), false);
    // AB. snel opslaan: nooit een rondje
    await opzet(); await alertWeg();
    await bezigLog(['btn-add-datapoint']);
    await meting('D20261018', '81.3'); await wacht(400);
    eis('snel opslaan: opgeslagen, zonder dat er ooit een rondje was', [(await bestand('gewicht.txt')).D20261018, await p.evaluate(() => window.__bezigOoit['btn-add-datapoint'])], [81.3, false]);
    // AC. traag verwijderen met Geen meting: het rondje staat op Opslaan
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = 800; });
    await bezigLog(['btn-add-datapoint']);
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); setTimeout(() => document.getElementById('confirm-ok').click(), 50); }); await wacht(450);
    eis('verwijderen via Geen meting: het rondje staat op Opslaan', await bezig('btn-add-datapoint'), true);
    await wacht(600);
    await wacht(1200);
    eis('daarna verwijderd en geen rondje meer', ['D20261016' in (await bestand('gewicht.txt')), await bezig('btn-add-datapoint')], [false, false]);
    // AD. traag mislukt: rondje weg, knop gewoon terug
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = true; window.__faal = true; });
    await meting('D20261018', '81.4'); await wacht(900);
    eis('mislukt na wachten: melding, geen rondje, knop gewoon Opslaan', [await tekst('data-melding'), await bezig('btn-add-datapoint'), await knop('btn-add-datapoint')], ['Opslaan mislukt.', false, 'Opslaan gewoon']);
    await p.evaluate(() => { window.__faal = false; window.__traag = false; closeDatapointModal(); });
    // AE. traag opslaan na een bewerking buiten Trends om: gewoon opgeslagen, geen rondje achter
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = true; leesKopieModus = true; dirHandle.requestPermission = async () => { await new Promise(r => setTimeout(r, 500)); return 'granted'; }; });
    await buiten('gewicht.txt', {D20261016: 82.0, D20261017: 82.4});
    await meting('D20261017', '82.1'); await wacht(1200);
    eis('traag, na een bewerking buiten Trends om: opgeslagen en dicht, geen rondje', [(await bestand('gewicht.txt')).D20261017, await zien('datapoint-modal-overlay'), await bezig('btn-add-datapoint')], [82.1, false, false]);
    // AF. bron opslaan, traag: het rondje op Opslaan van het bronvenster
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = 800; switchToView('meta'); editSource('g'); document.getElementById('f-titel').value = 'Gewicht 2'; document.getElementById('btn-save-source').click(); });
    await wacht(450);
    eis('bron opslaan, traag: het rondje draait op Opslaan', await bezig('btn-save-source'), true);
    await wacht(2000);
    eis('daarna opgeslagen en geen rondje meer', [(await bestand('trends.json')).bronnen[0].titel, await bezig('btn-save-source')], ['Gewicht 2', false]);
    await p.evaluate(() => { window.__traag = false; });

    console.log('Vangnet: nooit schrijven uit een tabel die het bestand niet is (1352898-021)');
    /* Sinds 020 schrijft opslaan de tabel zoals die in de app staat. Een tabel die als
       volledig geldt maar het bestand niet weergeeft, kostte dan stil metingen. De vijf
       routes uit de review, elk langs de echte weg (laadData, loadMetaFromDir). */
    // VA. de leeskopie kon na het schrijven niet worden bijgewerkt
    await opzet(); await alertWeg();
    await p.evaluate(async () => {
      await idbSet('kopie:gewicht.txt', {tekst: window.__fs['gewicht.txt'].tekst, bestaat: true, tijd: 1});   // kopie = bestand
      const echt = idbSet; window.__echtIdbSet = echt;
      idbSet = async (k, v) => { if(k === 'kopie:gewicht.txt') throw new Error('vol'); return echt(k, v); };
    });
    await meting('D20261018', '81.1'); await wacht(400);
    await p.evaluate(async () => { idbSet = window.__echtIdbSet; leesKopieModus = true; delete dataCache.g; await ensureDataLoaded('g'); });
    eis('kopie niet bij te werken: in de volgende sessie zonder toegang geldt er geen oude kopie',
        await p.evaluate(() => 'D20261018' in (dataCache.g || {}) || !tabelIsVolledig('g')), true);
    await meting('D20261019', '81.2'); await wacht(500);
    eis('en de volgende opslag houdt de meting van daarvoor', await bestand('gewicht.txt'), {D20261016: 82, D20261017: 82, D20261018: 81.1, D20261019: 81.2});
    // VB. een ander bestand ingesteld terwijl het oude nog werd ingelezen
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__fs['ander.txt'] = {tekst: __data({D20260101: 70, D20260102: 71}), mtime: 1};
      const echt = leesDataVanDir; window.__echtLezen = echt;
      leesDataVanDir = async (n) => { const r = await echt(n); if(n === 'gewicht.txt') await new Promise(r2 => setTimeout(r2, 800)); return r; };
      delete dataCache.g; ensureDataLoaded('g');
      switchToView('meta'); editSource('g'); document.getElementById('f-bestand').value = 'ander.txt'; document.getElementById('btn-save-source').click(); });
    await wacht(1300);
    await p.evaluate(() => { leesDataVanDir = window.__echtLezen; switchToView('data'); return ensureDataLoaded('g'); }); await alertWeg();
    await meting('D20261018', '81.0'); await wacht(400);
    eis('ander bestand tijdens het inlezen: dat bestand houdt zijn eigen metingen', await bestand('ander.txt'), {D20260101: 70, D20260102: 71, D20261018: 81});
    // VC. een bestand dat helemaal geen metingen bevat (bijvoorbeeld nog de oude JSON): alle regels blijven staan (13528F3-003)
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['gewicht.txt'] = {tekst: '{\n\t"D20261016": 82\n}\n', mtime: 900};
      delete dataCache.g; await ensureDataLoaded('g'); });
    eis('geen enkele leesbare regel: de melding noemt ze', /zijn 3 regels niet te lezen/.test(await tekst('alert-text')), true);
    await alertWeg();
    await meting('D20261018', '81.0'); await wacht(400);
    eis('opslaan: de meting erbij, de regels die Trends niet kent ongewijzigd erin', await p.evaluate(() => window.__fs['gewicht.txt'].tekst), '\t"D20261016": 82\nD20261018;81.0\n{\n}\n');
    await p.evaluate(() => closeDatapointModal());
    // VD. regels die Trends niet kan lezen, blijven staan (ook de volgende dag)
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['gewicht.txt'] = {tekst: __data({D20261016: 82, D20261015: '81x', X2026: 3, D20261017: 82}), mtime: 900};
      delete dataCache.g; await ensureDataLoaded('g'); });
    await alertWeg();
    await meting('D20261018', '81.0'); await wacht(400);
    eis('onleesbare regels: jouw meting erbij, en de regels die Trends niet kent, blijven ongewijzigd', await bestand('gewicht.txt'),
        {D20261015: 'D20261015;81x', D20261016: 82, D20261017: 82, D20261018: 81, X2026: 'X2026;3'});
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); setTimeout(() => document.getElementById('confirm-ok').click(), 50); }); await wacht(400);
    eis('ook na nog een opslag (een verwijdering)', await bestand('gewicht.txt'), {D20261015: 'D20261015;81x', D20261017: 82, D20261018: 81, X2026: 'X2026;3'});
    await meting('D20261015', '81.5'); await wacht(400);
    eis('een meting op de dag van een onleesbare regel vervangt die regel', (await bestand('gewicht.txt')).D20261015, 81.5);
    // VE. de bronnenlijst: eigen velden en ongeldige elementen blijven staan
    await opzet(); await alertWeg();
    await p.evaluate(async () => {
      window.__fs['trends.json'] = {tekst: JSON.stringify({versie: 7, bronnen: [{titel:'Gewicht', bestand:'gewicht.txt', eenheid:'kg', decimalen:1, eigen_veld: 'x'}, 'geen bron', {titel:'Stappen', bestand:'s.txt'}]}), mtime: 900};
      await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { switchToView('meta'); editSource('gewicht'); document.getElementById('f-titel').value = 'Gewicht 2'; document.getElementById('btn-save-source').click(); });
    await wacht(400);
    const meta = await bestand('trends.json');
    eis('bronnenlijst: jouw wijziging erin', meta.bronnen[0].titel, 'Gewicht 2');
    eis('en wat Trends niet kent, blijft: het eigen veld, het ongeldige element en de andere sleutel',
        [meta.bronnen[0].eigen_veld, meta.bronnen.includes('geen bron'), meta.versie, meta.bronnen.filter(b => b && b.titel === 'Stappen').length], ['x', true, 7, 1]);
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: {Gewicht: {bestand: 'gewicht.txt'}}}), mtime: 950}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { switchToView('meta'); document.getElementById('btn-new-source') && document.getElementById('btn-new-source').click(); document.getElementById('f-titel').value = 'Nieuw'; document.getElementById('btn-save-source').click(); });
    await wacht(400);
    eis('"bronnen" is geen lijst: niets opgeslagen', JSON.stringify((await bestand('trends.json')).bronnen), JSON.stringify({Gewicht: {bestand: 'gewicht.txt'}}));
    await p.evaluate(() => closeSourceModal());
    // VF. Vernieuwen terwijl een meting wordt opgeslagen
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = 600; openEditDatapointModal('g', 'D20261018'); document.getElementById('f-data-value').value = '81.3';
      document.getElementById('btn-add-datapoint').click();
      setTimeout(() => { dataCache = {}; renderDataView(true); }, 100); });   // wat Vernieuwen doet, midden in het opslaan
    await wacht(1500);
    eis('Vernieuwen tijdens het opslaan: de meting staat in het bestand én in de tabel',
        [(await bestand('gewicht.txt')).D20261018, await p.evaluate(() => dataCache.g && dataCache.g.D20261018)], [81.3, 81.3]);
    await p.evaluate(() => { window.__traag = false; });
    // VG. een tweede tik tijdens het opslaan doet niets
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = 600; openEditDatapointModal('g', 'D20261018'); document.getElementById('f-data-value').value = '81.4';
      document.getElementById('btn-add-datapoint').click(); });
    await wacht(400);
    const tweede = await p.evaluate(async () => { const r = await voerMetingUit('g', {weg: [], zet: {D20261019: 1}, hoofd: 'D20261019'}, () => {});
      return [document.getElementById('btn-add-datapoint').disabled, vensterBezig, document.getElementById('btn-add-datapoint').classList.contains('bezig'), r.fout]; });
    eis('tweede opslag tijdens de eerste: knoppen blijven uit, het rondje blijft, en hij doet niets', tweede, [true, true, true, 'bezig']);
    await wacht(900); await p.evaluate(() => { window.__traag = false; });

    console.log('Vangnet, tweede review (1352898-022)');
    const laad = (obj) => p.evaluate(async (obj) => { window.__fs['gewicht.txt'] = {tekst: __data(obj), mtime: 900}; delete dataCache.g; await ensureDataLoaded('g'); }, obj);
    // WA. bron opslaan terwijl de volgorde nog wordt weggeschreven, en dan Annuleren
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: [{titel:'Gewicht', bestand:'gewicht.txt', eenheid:'kg'}, {titel:'Stappen', bestand:'s.txt'}]}), mtime: 1}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { window.__traag = 800; switchToView('meta'); selectedSourceId = 's'; moveSelectedSource(-1);
      editSource('gewicht'); document.getElementById('f-titel').value = 'Gewicht X'; document.getElementById('btn-save-source').click(); });
    await wacht(100);
    eis('tijdens het wachten staat het bronvenster vast', await p.evaluate(() => [document.getElementById('btn-save-source').disabled, document.getElementById('btn-cancel-edit').disabled, vensterBezig]), [true, true, true]);
    await p.evaluate(() => document.getElementById('btn-cancel-edit').click());
    await wacht(2500);
    eis('Annuleren werkt dan niet: geen dubbele bron, de volgorde én de nieuwe titel staan erin',
        (await bestand('trends.json')).bronnen.map(b => [b.titel, b.bestand]), [['Stappen', 's.txt'], ['Gewicht X', 'gewicht.txt']]);
    await p.evaluate(() => { window.__traag = false; closeSourceModal(); });
    // WB. verschuiven en een bron opslaan in dezelfde tik: allebei
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: [{titel:'Gewicht', bestand:'gewicht.txt'}, {titel:'Stappen', bestand:'s.txt'}]}), mtime: 1}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { window.__traag = 300; switchToView('meta'); selectedSourceId = 's'; moveSelectedSource(-1);
      editSource('gewicht'); document.getElementById('f-titel').value = 'Gewicht Y'; document.getElementById('btn-save-source').click(); });
    await wacht(1500);
    eis('verschuiven en opslaan tegelijk: beide wijzigingen staan erin', (await bestand('trends.json')).bronnen.map(b => b.titel), ['Stappen', 'Gewicht Y']);
    await p.evaluate(() => { window.__traag = false; closeSourceModal(); });
    // WC. een lezing die door een opslag is ingehaald
    await opzet(); await alertWeg();
    await p.evaluate(() => { const echt = leesDataVanDir; window.__echtLezen = echt; let eerste = true;
      leesDataVanDir = async (n) => { const traag = eerste && n === 'gewicht.txt'; eerste = false; const r = await echt(n); if(traag) await new Promise(r2 => setTimeout(r2, 800)); return r; };
      delete dataCache.g; ensureDataLoaded('g'); });
    await wacht(50);
    await meting('D20261018', '81.1'); await wacht(1200);
    await p.evaluate(() => { leesDataVanDir = window.__echtLezen; });
    eis('een trage lezing van vóór de opslag zet de oude stand niet terug', await p.evaluate(() => dataCache.g.D20261018), 81.1);
    await meting('D20261019', '80.9'); await wacht(400);
    eis('en de volgende opslag houdt de meting van daarvoor', (await bestand('gewicht.txt')).D20261018, 81.1);
    // WD. een regel zonder getal op de dag waar een meting met tijd naartoe zou verhuizen
    await opzet(); await alertWeg();
    await laad({D20261015T0800: 80, D20261015: '81x', D20261016: 82}); await alertWeg();
    await meting('D20261018', '79.0'); await wacht(400);
    eis('de regel zonder getal blijft, de meting met tijd ook', await bestand('gewicht.txt'), {D20261015: 'D20261015;81x', D20261015T0800: 80, D20261016: 82, D20261018: 79});
    // WE. herstel uit de back-up: de onleesbare regels van de back-up blijven
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['gewicht.txt'] = {tekst: '?', bytes: new Uint8Array([0x44, 0xE9, 10]), mtime: 1}; window.__fs['gewicht_backup.txt'] = {tekst: __data({D20261010: 80, D20261011: '79x'}), mtime: Date.now()}; delete dataCache.g; ensureDataLoaded('g'); });
    await wacht(300);
    eis('geen UTF-8: de vraag noemt het, en biedt de back-up aan (13528F3-003)', /niet in UTF-8 opgeslagen.*De back-up van .* bevat 1 meting/.test(await tekst('confirm-text')), true);
    await p.evaluate(() => document.getElementById('confirm-ok').click()); await wacht(500); await alertWeg();
    eis('herstel uit de back-up: ook de regel zonder getal', await bestand('gewicht.txt'), {D20261010: 80, D20261011: 'D20261011;79x'});
    eis('en het bestand van daarvoor is bewaard, met zijn bytes', await p.evaluate(() => { const b = window.__fs['gewicht_beschadigd.txt']; return b && b.bytes && [...b.bytes]; }), [0x44, 0xE9, 10]);
    // WF. een verwijderde bron geeft zijn eigen velden niet door aan een nieuwe met hetzelfde id
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: [{titel:'Gewicht', bestand:'gewicht.txt'}, {titel:'Oud', bestand:'oud.txt', geheim:'van oud'}]}), mtime: 1}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(async () => { await deleteSource('oud'); });
    await p.evaluate(() => { switchToView('meta'); resetSourceForm(); editingId = null; document.getElementById('f-titel').value = 'Nieuw'; document.getElementById('f-bestand').value = 'oud.txt'; document.getElementById('btn-save-source').click(); });
    await wacht(400);
    eis('een nieuwe bron erft niets van een verwijderde', (await bestand('trends.json')).bronnen.find(b => b.titel === 'Nieuw').geheim, undefined);
    await p.evaluate(() => closeSourceModal());
    // WG. schrijven mislukt: de leeskopie blijft (het bestand is ongewijzigd)
    await opzet(); await alertWeg();
    await p.evaluate(async () => { await idbSet('kopie:trends.json', {tekst: window.__fs['trends.json'].tekst, bestaat: true, tijd: 1}); window.__faal = true; });
    await p.evaluate(() => { switchToView('meta'); editSource('g'); document.getElementById('f-titel').value = 'Y'; document.getElementById('btn-save-source').click(); }); await wacht(400);
    eis('mislukte schrijfactie: Opslaan mislukt, en de leeskopie is er nog', [await tekst('bron-melding'), await p.evaluate(async () => !!(await idbGet('kopie:trends.json')))], ['Opslaan mislukt.', true]);
    await p.evaluate(() => { window.__faal = false; closeSourceModal(); });
    // WH. kopie niet te wissen: niet schrijven, Opslaan mislukt
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__echtDel = idbDelete; idbDelete = async (k) => { if(k.startsWith('kopie:')) throw new Error('x'); return window.__echtDel(k); }; });
    await meting('D20261018', '81.0'); await wacht(400);
    eis('leeskopie niet te wissen: Opslaan mislukt, het bestand ongemoeid', [await tekst('data-melding'), 'D20261018' in (await bestand('gewicht.txt'))], ['Opslaan mislukt.', false]);
    await p.evaluate(() => { idbDelete = window.__echtDel; closeDatapointModal(); });

    console.log('Vangnet, derde review (1352898-023)');
    // XA. een als dubbel weggelaten meting blijft weggelaten, ook na een opslag
    await opzet(); await alertWeg();
    await laad({'20261015T0800': 80, D20261015T0800: 81, D20261016: 82}); await alertWeg();
    await meting('D20261018', '79.0'); await wacht(400);
    await p.evaluate(async () => { delete dataCache.g; await ensureDataLoaded('g'); }); await alertWeg();
    eis('na opslaan en opnieuw inlezen: op 15-10 nog steeds één meting', await p.evaluate(() => Object.keys(dataCache.g).filter(k => k.startsWith('D20261015')).length), 1);
    eis('en de weggelaten regel staat ongewijzigd in het bestand', (await bestand('gewicht.txt'))['20261015T0800'], '20261015T0800;80');
    // XB. Opslaan met een leeg veld terwijl de tabel nog laadt: de tabel komt daarna gewoon
    await opzet(); await alertWeg();
    await p.evaluate(() => { const echt = leesDataVanDir; window.__echtLezen = echt;
      leesDataVanDir = async (n) => { const r = await echt(n); if(n === 'gewicht.txt') await new Promise(r2 => setTimeout(r2, 600)); return r; };
      delete dataCache.g; ensureDataLoaded('g');
      openEditDatapointModal('g', 'D20261018'); document.getElementById('f-data-value').value = ''; document.getElementById('btn-add-datapoint').click(); });
    await wacht(1000); await alertWeg();
    await p.evaluate(() => { leesDataVanDir = window.__echtLezen; closeDatapointModal(); });
    eis('een lege opslagpoging tijdens het laden: daarna staat de tabel er (volledig)', await p.evaluate(() => [Object.keys(dataCache.g || {}).length, tabelIsVolledig('g')]), [2, true]);
    // XC. de bronnenlijst inlezen terwijl er een bron wordt opgeslagen
    await opzet(); await alertWeg();
    await p.evaluate(() => { const echt = readJsonFromDir; window.__echtLezen = echt; let eerste = true;
      readJsonFromDir = async (n) => { const traag = eerste && n === 'trends.json'; if(traag) eerste = false; const r = await echt(n); if(traag) await new Promise(r2 => setTimeout(r2, 800)); return r; };
      loadMetaFromDir();   // wat Vernieuwen doet
      setTimeout(() => { switchToView('meta'); editSource('g'); document.getElementById('f-titel').value = 'Gewicht Z'; document.getElementById('btn-save-source').click(); }, 100); });
    await wacht(1500); await alertWeg();
    await p.evaluate(() => { readJsonFromDir = window.__echtLezen; closeSourceModal(); });
    eis('een trage lezing van de bronnenlijst zet de oude lijst niet terug', [await p.evaluate(() => bronnen[0].titel), (await bestand('trends.json')).bronnen[0].titel], ['Gewicht Z', 'Gewicht Z']);

    console.log('Herreview 023 (1352898-024)');
    // YA. een dag waarvan een dubbele meting is weggelaten: gewoon bewerken, zonder vraag
    await opzet(); await alertWeg();
    await laad({'20261015T0800': 80, D20261015T0800: 81, D20261016: 82}); await alertWeg();
    eis('de dag met de weggelaten dubbele meting opent als bewerken, met Geen meting', await p.evaluate(() => {
      openEditDatapointModal('g', 'D20261015');
      return [document.getElementById('datapoint-modal-title').textContent, getComputedStyle(document.getElementById('btn-no-measurement')).display !== 'none',
              document.getElementById('f-data-value').value]; }), ['Meting bewerken', true, '81.0']);
    await p.evaluate(() => { document.getElementById('f-data-value').value = '81.5'; document.getElementById('btn-add-datapoint').click(); });
    await wacht(400);
    eis('opslaan vraagt niet om de meting te overschrijven die je zelf bewerkt', await zien('confirm-overlay'), false);
    if(await zien('confirm-overlay')) await p.evaluate(() => document.getElementById('confirm-ok').click());
    await wacht(300); await alertWeg();
    eis('en de dag heeft daarna één meting: de nieuwe', await bestand('gewicht.txt'), {D20261015: 81.5, D20261016: 82});
    // YB. opslaan terwijl de tabel nog laadt: een bestaande meting die dag wordt niet stil overschreven
    await opzet(); await alertWeg();
    await p.evaluate(() => { const echt = leesDataVanDir; window.__echtLezen = echt;
      leesDataVanDir = async (n) => { const r = await echt(n); if(n === 'gewicht.txt') await new Promise(r2 => setTimeout(r2, 500)); return r; };
      delete dataCache.g; ensureDataLoaded('g');
      openEditDatapointModal('g', 'D20261016'); document.getElementById('f-data-value').value = '70'; document.getElementById('btn-add-datapoint').click(); });
    await wacht(900);
    const vraag = await zien('confirm-overlay');
    if(vraag) await p.evaluate(() => document.getElementById('confirm-cancel').click());
    await wacht(300); await alertWeg();
    await p.evaluate(() => { leesDataVanDir = window.__echtLezen; closeDatapointModal(); });
    eis('opslaan tijdens het laden: de app vraagt eerst of de meting van die dag weg mag', vraag, true);
    eis('en na Annuleren staat de oude meting er nog', (await bestand('gewicht.txt')).D20261016, 82);

    console.log('Nieuwe dag (1352898-025)');
    /* De klok verzetten: window.__verschuif ms bij elke nieuwe Date() en Date.now(). */
    await p.evaluate(() => { if(window.__nepKlok) return; window.__nepKlok = true; window.__verschuif = 0;
      const Echt = Date;
      class Nep extends Echt { constructor(...a){ if(a.length) super(...a); else super(Echt.now() + window.__verschuif); }
        static now(){ return Echt.now() + window.__verschuif; } }
      window.Date = Nep; });
    const DAG = 864e5;
    /* Vandaag staat altijd als eigen rij bovenaan, ook zonder meting; daaronder de
       ingeklapte reeks lege dagen. bovenste() geeft die reeks, vandaagBoven() de datum
       van de eerste rij tegen die van vandaag (met de verschoven klok). */
    const bovenste = () => p.evaluate(() => { const r = document.querySelector('#data-table-body tr.gap-summary-row'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
    const vandaagBoven = () => p.evaluate(() => { const r = document.querySelector('#data-table-body tr'); return !!r && r.dataset.k === dateToKey(todayUTCDate()); });
    /* twee metingen, 5 en 6 dagen geleden: bovenaan vandaag, dan '⋯ 4 dagen ⋯' (de lege dagen ervoor) */
    const klaarzetten = async () => {
      await opzet(); await alertWeg(); await p.evaluate(() => { window.__verschuif = 0; });
      await p.evaluate(async () => { const k = n => { const d = new Date(); d.setDate(d.getDate() - n); return 'D' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'); };
        const obj = {[k(5)]: 80, [k(6)]: 81}; window.__fs['gewicht.txt'] = {tekst: __data(obj), mtime: 900}; delete dataCache.g; await renderDataView(); });
      await wacht(300); await alertWeg();
    };
    const terug = async () => { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wacht(400); };
    // ZA. 's ochtends terughalen: de nieuwe dag staat er
    await klaarzetten();
    eis('vooraf: bovenaan vandaag, ook zonder meting', await vandaagBoven(), true);
    eis('vooraf: daaronder de vier lege dagen ervoor', await bovenste(), '⋯ 4 dagen ⋯');
    await p.evaluate(d => { window.__verschuif = d; }, DAG);
    await terug();
    eis('na middernacht en terughalen: de nieuwe dag bovenaan, gisteren bij de lege dagen', [await vandaagBoven(), await bovenste()], [true, '⋯ 5 dagen ⋯']);
    // ZB. middernacht terwijl de app openstaat
    await klaarzetten();
    await p.evaluate(() => { const nu = new Date(); const m = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1); window.__verschuif += (m - nu) - 1500;
      if(typeof planMiddernacht === 'function') planMiddernacht(); });
    await wacht(4500);
    eis('middernacht terwijl de app openstaat: de nieuwe dag staat er vanzelf', [await vandaagBoven(), await bovenste()], [true, '⋯ 5 dagen ⋯']);
    // ZC. een open venster: pas na het sluiten opnieuw tekenen
    await klaarzetten();
    await p.evaluate(() => { const r = [...document.querySelectorAll('#data-table-body tr[data-k]')].find(x => x.querySelector('.val') && x.querySelector('.val').textContent.trim() !== '–'); openEditDatapointModal('g', r.dataset.k); });
    await p.evaluate(d => { window.__verschuif += d; }, DAG);
    await terug();
    eis('venster open tijdens de wissel: de tabel blijft en het venster blijft open', [await bovenste(), await zien('datapoint-modal-overlay')], ['⋯ 4 dagen ⋯', true]);
    await p.evaluate(() => closeDatapointModal()); await wacht(500);
    eis('na het sluiten: de nieuwe dag staat erbij', [await vandaagBoven(), await bovenste()], [true, '⋯ 5 dagen ⋯']);
    // ZD. een eigen periode die 'tot vandaag' liep schuift mee; een eerdere einddatum blijft
    for(const [naam, totDagen, verwacht] of [['tot vandaag', 0, 1], ['tot eergisteren', -2, -2]]){
      await opzet(); await alertWeg(); await p.evaluate(() => { window.__verschuif = 0; });
      await p.evaluate(t => { const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
        document.getElementById('data-range-from').value = iso(-20); document.getElementById('data-range-to').value = iso(t);
        dataPeriodFilter = 'custom'; renderDataView(); }, totDagen);
      await wacht(300);
      const voor = await p.evaluate(() => document.getElementById('data-range-to').value);
      await p.evaluate(d => { window.__verschuif += d; }, DAG);
      await terug();
      const na = await p.evaluate(() => document.getElementById('data-range-to').value);
      const verwachtIso = await p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n - 1); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }, verwacht);
      eis(`eigen periode ${naam}: einddatum na de nieuwe dag`, na, naam === 'tot vandaag' ? verwachtIso : voor);
    }
    await p.evaluate(() => { window.__verschuif = 0; dataPeriodFilter = '1m'; });

    console.log('Grafiek zonder breedte (1352898-018)');
    // Y. getekend terwijl de grafiek nog geen breedte had: zodra hij die krijgt, opnieuw.
    //    Tot 017 tekende drawChart dan 880 pixels breed, en perste de browser dat in de
    //    echte breedte: smalle, samengedrukte letters tot de volgende swipe.
    await opzet(); await alertWeg(); await wacht(300);   // het tekenen van opzet() eerst laten eindigen
    const maat = () => p.evaluate(() => { const c = document.getElementById('data-chart-canvas'); return [c.width, Math.round(c.clientWidth * (window.devicePixelRatio || 1))]; });
    const vooraf = await p.evaluate(async () => { dataShowChart = true; dataPeriodFilter = '1m'; dataAggMode = 'd'; const c = document.getElementById('data-chart-canvas'); const box = document.getElementById('data-chart-preview'); box.style.display = 'none'; await renderDataChartPreview(); box.style.display = 'block'; const sel = await getChartPointsForSelection(); return sel ? sel.points.length : 0; });
    eis('de proef heeft punten om te tekenen', vooraf > 0, true);
    await wacht(300);
    const [na, breed] = await maat();
    eis('getekend zonder breedte, daarna zichtbaar: de grafiek past (pixels = breedte)', na, breed);
    // Z. draaien: de grafiek volgt de nieuwe breedte
    await p.setViewportSize({width: 740, height: 360}); await wacht(300);
    const [na2, breed2] = await maat();
    eis('na draaien past de grafiek weer', na2, breed2);
    await p.setViewportSize({width: 360, height: 740}); await wacht(300);

    console.log('Controle vóór opslaan (13528F2-004)');
    const alertDicht = () => p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; });
    /* de tabel komt uit de leeskopie van de browser, het bestand is intussen nieuwer */
    const uitKopie = (kopie) => p.evaluate(async (kopie) => {
      await idbSet('kopie:gewicht.txt', kopie);
      leesKopieModus = true; delete dataCache.g; await ensureDataLoaded('g'); leesKopieModus = false;
    }, kopie);
    const oud = await p.evaluate(() => __data({D20261016: 82.0, D20261017: 82.0}));
    const nieuw = {D20261016: {waarde: 82.0, notitie: 'Voorjaarsvakantie'}, D20261017: 82.0, D20261019: 81.2};
    // S1. een verouderde leeskopie (met stand) overschrijft het nieuwere bestand niet
    await opzet();
    await uitKopie({tekst: oud, bestaat: true, tijd: Date.now(), stand: {m: 600, s: oud.length}});
    await buiten('gewicht.txt', nieuw);
    eis('de tabel komt uit de verouderde kopie: zonder de notitie', await p.evaluate(() => Object.keys(notitiesVan('g')).length), 0);
    await meting('D20261018', '81.7'); await wacht(400);
    eis('verouderde leeskopie: de notitie en de meting van buiten blijven, jouw meting erbij', await bestand('gewicht.txt'),
        {D20261016: {waarde: 82, notitie: 'Voorjaarsvakantie'}, D20261017: 82, D20261018: 81.7, D20261019: 81.2});
    eis('en de melding dat het bestand opnieuw is ingelezen', await zien('alert-overlay'), true);
    await alertDicht();
    // S2. een leeskopie van vóór deze versie (zonder stand): eerst opnieuw lezen
    await opzet();
    await uitKopie({tekst: oud, bestaat: true, tijd: Date.now()});
    await buiten('gewicht.txt', nieuw);
    await meting('D20261018', '81.7'); await wacht(400);
    eis('een oude leeskopie zonder stand: ook dan blijft de notitie', ((await bestand('gewicht.txt')).D20261016 || {}).notitie, 'Voorjaarsvakantie');
    await alertDicht();
    // S3. een gewijzigde notitie van buiten blijft, ook als jij die dag een andere waarde geeft
    await opzet();
    await buiten('gewicht.txt', {D20261016: {waarde: 82.0, notitie: 'van de telefoon'}, D20261017: 82.0});
    await meting('D20261016', '81.4'); await wacht(400);
    eis('jouw waarde op een dag met een notitie van buiten: de notitie blijft', (await bestand('gewicht.txt')).D20261016, {waarde: 81.4, notitie: 'van de telefoon'});
    await alertDicht();
    // S3b. typ je zelf een notitie, dan wint die
    await opzet();
    await buiten('gewicht.txt', {D20261016: {waarde: 82.0, notitie: 'van de telefoon'}, D20261017: 82.0});
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); document.getElementById('f-data-notitie').value = 'mijn notitie';
      document.getElementById('btn-add-datapoint').click(); }); await wacht(400);
    eis('een notitie die je zelf typte, gaat voor', (await bestand('gewicht.txt')).D20261016, {waarde: 82, notitie: 'mijn notitie'});
    await alertDicht();
    // S4. het bestand is er even niet (synchronisatie): de tabel blijft, niet alleen jouw meting
    await opzet();
    await p.evaluate(() => { delete window.__fs['gewicht.txt']; });
    await meting('D20261018', '81.7'); await wacht(400);
    eis('het bestand even weg: de tabel met jouw meting, zonder melding', [await bestand('gewicht.txt'), await zien('alert-overlay')],
        [{D20261016: 82, D20261017: 82, D20261018: 81.7}, false]);
    // S5. trends.json buiten dit venster gewijzigd: een bron erbij blijft staan
    await opzet();
    await p.evaluate(() => { const m = JSON.parse(window.__fs['trends.json'].tekst);
      m.bronnen.push({titel: 'Stappen', bestand: 'stappen.txt', decimalen: 0});
      window.__fs['trends.json'] = {tekst: JSON.stringify(m), mtime: 910}; });
    await bronOpslaan(); await wacht(400);
    eis('bronnenlijst van buiten aangevuld: jouw wijziging én de nieuwe bron staan erin', (await bestand('trends.json')).bronnen.map(b => b.titel), ['Gewicht nieuw', 'Stappen']);
    eis('en Trends toont ze allebei', await p.evaluate(() => bronnen.map(b => b.titel)), ['Gewicht nieuw', 'Stappen']);
    // S6. ongewijzigd trends.json: niet opnieuw gelezen
    await opzet();
    await p.evaluate(() => { window.__metaGelezen = 0; const echt = dirHandle.getFileHandle;
      dirHandle.getFileHandle = async (n, o) => { const h = await echt(n, o); const g = h.getFile;
        h.getFile = async () => { const f = await g(); const t = f.arrayBuffer; f.arrayBuffer = async () => { if(n === 'trends.json') window.__metaGelezen++; return t(); }; return f; }; return h; }; });
    await bronOpslaan(); await wacht(400);
    eis('ongewijzigd trends.json: één keer gelezen om te vergelijken, en opgeslagen (13528F3-005)', [await p.evaluate(() => window.__metaGelezen), (await bestand('trends.json')).bronnen[0].titel], [1, 'Gewicht nieuw']);
    await p.evaluate(() => closeSourceModal());

    console.log('Databestand als tekst (13528F3-003)');
    const ruw = () => p.evaluate(() => window.__fs['gewicht.txt'].tekst);
    const zetRuw = (t, extra) => p.evaluate(async ([t, extra]) => { Object.assign(bronnen[0], extra || {});
      window.__fs['gewicht.txt'] = typeof t === 'string' ? {tekst: t, mtime: 900} : {tekst: '?', bytes: new Uint8Array(t), mtime: 900};
      delete dataCache.g; await ensureDataLoaded('g'); }, [t, extra]);
    const tabel = () => p.evaluate(() => [Object.fromEntries(Object.entries(dataCache.g).sort()), Object.fromEntries(Object.entries(notitiesVan('g')).sort())]);
    // T1. het formaat: gesorteerd, de decimalen van de bron, geen puntkomma aan het eind, LF
    await opzet(); await meting('D20261015', '81.7'); await wacht(400);
    eis('opslaan: één regel per meting, gesorteerd, met de decimalen van de bron', await ruw(), 'D20261015;81.7\nD20261016;82.0\nD20261017;82.0\n');
    // T2. notities: met een meting, en alleen een notitie
    await opzet(); await zetRuw('D20261016;82.0;Na het eten\nD20261017;;Seminar\n'); await alertWeg();
    eis('inlezen: een meting met notitie en alleen een notitie', await tabel(), [{D20261016: 82}, {D20261016: 'Na het eten', D20261017: 'Seminar'}]);
    await meting('D20261018', '81.0'); await wacht(400);
    eis('terugschrijven: precies zo, met de nieuwe meting', await ruw(), 'D20261016;82.0;Na het eten\nD20261017;;Seminar\nD20261018;81.0\n');
    // T3. Windows: CRLF blijft, geen regeleinde aan het eind blijft, de BOM gaat eruit
    await opzet();
    await zetRuw([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('D20261016;82.0\r\nD20261017;82.0')]); await alertWeg();
    eis('met een BOM: de eerste regel gewoon gelezen', await tabel(), [{D20261016: 82, D20261017: 82}, {}]);
    await meting('D20261018', '81.0'); await wacht(400);
    eis('CRLF en geen regeleinde aan het eind blijven, de BOM is weg', await ruw(), 'D20261016;82.0\r\nD20261017;82.0\r\nD20261018;81.0');
    // T4. met de hand getypt: een komma, minder of meer decimalen, spaties, lege regels
    await opzet(); await zetRuw('D20261014;81,5\n\nD20261015 ; 81.25 \nD20261016;82\n   \n'); await alertWeg();
    eis('inlezen: komma, meer decimalen en spaties gaan goed, lege regels tellen niet', await tabel(), [{D20261014: 81.5, D20261015: 81.25, D20261016: 82}, {}]);
    await meting('D20261018', '81.0'); await wacht(400);
    eis('terugschrijven: een punt, nooit afgerond, lege regels weg', await ruw(), 'D20261014;81.5\nD20261015;81.25\nD20261016;82.0\nD20261018;81.0\n');
    // T5. regels die Trends niet kan lezen: gemeld, en ongewijzigd teruggeschreven
    await opzet();
    await zetRuw('D20261016;82.0\nD20261016;83.0\n20261017;80\nD20261018;1;2;3\nD20261019;;\nD20261020;tachtig\n');
    eis('één melding: vijf regels, waarvan één een tweede regel voor dezelfde datum', /zijn 5 regels niet te lezen .* Daarvan is 1 regel een tweede regel voor dezelfde datum\./.test(await tekst('alert-text')), true);
    await alertWeg();
    eis('de eerste regel voor een datum telt', await tabel(), [{D20261016: 82}, {}]);
    await meting('D20261021', '81.0'); await wacht(400);
    eis('terugschrijven: de onleesbare regels staan er nog, zoals ze waren', await ruw(), '20261017;80\nD20261016;82.0\nD20261016;83.0\nD20261018;1;2;3\nD20261019;;\nD20261020;tachtig\nD20261021;81.0\n');
    // T6. een notitie met een puntkomma of een regeleinde breekt het bestand niet
    await opzet();
    await p.evaluate(async () => { await slaMetingOp('g', {weg: [], zet: {D20261018: 81.0}, hoofd: 'D20261018', notitie: {D20261018: 'a;b\nc'}}); });
    eis('een puntkomma wordt een komma, een regeleinde een spatie', (await ruw()).split('\n')[2], 'D20261018;81.0;a,b c');
    // T7. meer metingen per dag: sleutels met tijd
    await opzet(); await zetRuw('D20261016T0715;82.0\nD20261016T2230;82.9;avond\n', {meerdere_metingen: true}); await alertWeg();
    eis('met tijden: beide metingen en de notitie', await tabel(), [{D20261016T0715: 82, D20261016T2230: 82.9}, {D20261016T2230: 'avond'}]);
    // T8. alleen andere regeleindes (een editor): geen wijziging, geen melding
    await opzet(); await p.evaluate(() => { bronnen[0].meerdere_metingen = false; });
    await p.evaluate(() => { const f = window.__fs['gewicht.txt']; window.__fs['gewicht.txt'] = {tekst: f.tekst.replace(/\n/g, '\r\n'), mtime: f.mtime + 5000}; });
    await meting('D20261018', '81.0'); await wacht(400);
    eis('alleen CRLF in plaats van LF: opgeslagen zonder melding, en de CRLF blijft', [await zien('alert-overlay'), await ruw()], [false, 'D20261016;82.0\r\nD20261017;82.0\r\nD20261018;81.0\r\n']);
    // T9. trends.json blijft JSON
    await opzet(); await bronOpslaan(); await wacht(400);
    eis('trends.json blijft JSON', await p.evaluate(() => JSON.parse(window.__fs['trends.json'].tekst).bronnen[0].titel), 'Gewicht nieuw');
    await p.evaluate(() => closeSourceModal());

    console.log('Altijd vergelijken, zoals Events (13528F3-005)');
    // V1. met de hand bewerkt, maar datum en grootte gelijk (een editor die de datum terugzet): toch gezien
    await opzet(); await alertWeg();
    await p.evaluate(() => { const f = window.__fs['gewicht.txt']; window.__fs['gewicht.txt'] = {tekst: f.tekst.replace('D20261016;82', 'D20261016;83'), mtime: f.mtime}; });
    await meting('D20261018', '81.0'); await wacht(400);
    eis('zelfde datum en grootte, andere inhoud: opnieuw ingelezen, 83 blijft, met melding', [(await bestand('gewicht.txt')).D20261016, await zien('alert-overlay')], [83, true]);
    await alertWeg();
    const telLezenV = () => p.evaluate(() => { window.__gelezen = 0; window.__gelezenPer = {}; const echt = dirHandle.getFileHandle;
      dirHandle.getFileHandle = async (n, o) => { const h = await echt(n, o); const g = h.getFile;
        h.getFile = async () => { const f = await g(); const t = f.arrayBuffer; f.arrayBuffer = async () => { window.__gelezen++; window.__gelezenPer[n] = (window.__gelezenPer[n] || 0) + 1; return t(); }; return f; }; return h; }; });
    // V1b. een gewijzigd bestand wordt maar één keer gelezen: de vergelijking geeft de tekst door (13528F3-006)
    await opzet(); await alertWeg(); await telLezenV();
    await buiten('gewicht.txt', {D20261016: 82.3, D20261017: 82.0});
    await meting('D20261018', '81.0'); await wacht(400);
    eis('gewijzigd bestand: één keer gelezen, 82,3 blijft', [await p.evaluate(() => window.__gelezen), (await bestand('gewicht.txt')).D20261016], [1, 82.3]);
    await alertWeg();
    await opzet(); await alertWeg(); await telLezenV();
    await p.evaluate(() => { const f = window.__fs['trends.json']; window.__fs['trends.json'] = {tekst: f.tekst.replace('"eenheid":"kg"', '"eenheid":"KG"'), mtime: f.mtime + 1}; window.__gelezen = 0; window.__gelezenPer = {}; });
    await bronOpslaan(); await wacht(400);
    eis('gewijzigd trends.json: ook één keer gelezen', await p.evaluate(() => window.__gelezenPer['trends.json']), 1);
    await p.evaluate(() => closeSourceModal());
    // V1c. trends.json met de hand kapot bewerkt: niet opgeslagen, ook niet bij een tweede poging (13528F3-007)
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__fs['trends.json'] = {tekst: '{"bronnen": [', mtime: 2}; });
    await bronOpslaan(); await wacht(400);
    const kapot1 = [await tekst('bron-melding'), await p.evaluate(() => window.__fs['trends.json'].tekst)];
    await p.evaluate(() => document.getElementById('btn-save-source').click()); await wacht(400);
    eis('kapot trends.json: twee keer Opslaan mislukt, het bestand ongemoeid', [kapot1, [await tekst('bron-melding'), await p.evaluate(() => window.__fs['trends.json'].tekst)]],
        [['Opslaan mislukt.', '{"bronnen": ['], ['Opslaan mislukt.', '{"bronnen": [']]);
    await p.evaluate(() => closeSourceModal()); await alertWeg();
    // V2. trends.json met de hand bewerkt, datum en grootte gelijk: de wijziging blijft
    await opzet(); await alertWeg();
    await p.evaluate(() => { const f = window.__fs['trends.json']; window.__fs['trends.json'] = {tekst: f.tekst.replace('"eenheid":"kg"', '"eenheid":"KG"'), mtime: f.mtime}; });
    await p.evaluate(() => { window.__verwerkt = 0; const echt = window.verwerkMeta; window.verwerkMeta = (j) => { window.__verwerkt++; return echt(j); };
      switchToView('meta'); editSource('g'); document.getElementById('f-titel').value = 'Gewicht nieuw'; document.getElementById('btn-save-source').click(); }); await wacht(400);
    eis('trends.json, zelfde datum en grootte: eerst opnieuw ingelezen, dan opgeslagen', [await p.evaluate(() => window.__verwerkt), (await bestand('trends.json')).bronnen[0].titel], [1, 'Gewicht nieuw']);
    await p.evaluate(() => closeSourceModal());

    console.log('Bestandsbeheer .txt (13528F3-004)');
    // B1. de bestandskiezer: alleen .txt, zonder back-ups en bewaarde beschadigde bestanden
    await opzet(); await alertWeg();
    const kiezer = await p.evaluate(async () => {
      for(const n of ['b.txt', 'a.txt', 'a_backup.txt', 'a_beschadigd.txt', 'oud.json', 'trends.json', 'C.TXT']) window.__fs[n] = {tekst: '', mtime: 1};
      dirHandle.entries = async function*(){ for(const n of Object.keys(window.__fs)) yield [n, {kind: 'file'}]; };
      switchToView('meta'); editSource('g'); await openBestandPicker();
      const r = [...document.querySelectorAll('#bestand-picker-list .source-row .title')].map(e => e.textContent);
      closeBestandPicker(); closeSourceModal(); return r; });
    eis('de bestandskiezer toont alleen de .txt-bestanden, zonder back-ups', kiezer, ['a.txt', 'b.txt', 'C.TXT', 'gewicht.txt']);
    // B2. een nieuwe naam krijgt .txt
    await opzet(); await alertWeg();
    await p.evaluate(() => { switchToView('meta'); resetSourceForm(); openSourceModal(); });
    eis('een nieuwe bestandsnaam krijgt .txt (in het kiesvenster, 13528F4-001)', await p.evaluate(async () => {
      dirHandle.entries = async function*(){};
      await openBestandPicker(); const v = document.getElementById('bestand-nieuwe-naam'); v.value = 'Slaap'; v.dispatchEvent(new Event('input'));
      document.getElementById('bestand-picker-ok').click();
      const r = document.getElementById('f-bestand').value; closeSourceModal(); return r; }).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]), 'Slaap.txt');
    await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; }); modalStack.length = 0; });
    // B3. een nieuwe bron zonder gekozen bestand: de titel met liggende streepjes, .txt
    await opzet(); await alertWeg();
    await p.evaluate(() => { switchToView('meta'); resetSourceForm(); editingId = null; document.getElementById('f-titel').value = 'Bloeddruk Mark';
      document.getElementById('f-bestand').value = ''; document.getElementById('btn-save-source').click(); }); await wacht(400);
    eis('een nieuwe bron zonder bestand: Bloeddruk_Mark.txt', (await bestand('trends.json')).bronnen.map(b => b.bestand), ['gewicht.txt', 'Bloeddruk_Mark.txt']);
    await p.evaluate(() => closeSourceModal());
    // B5. de back-up heet _backup.txt
    await opzet(); await alertWeg(); await p.evaluate(() => idbDelete('backup:gewicht.txt'));
    await meting('D20261018', '81.0'); await wacht(400);
    eis('de dagelijkse back-up heet gewicht_backup.txt', await p.evaluate(() => (window.__fs['gewicht_backup.txt'] || {}).tekst), 'D20261016;82\nD20261017;82\n');

    console.log('Notitie: één regel, geen puntkomma (13528F3-007)');
    await opzet(); await alertWeg();
    await p.evaluate(() => openEditDatapointModal('g', 'D20261017')); await wacht(200);
    await p.focus('#f-data-notitie'); await p.keyboard.type('Na het eten'); await p.keyboard.press('Enter'); await p.keyboard.type('; laat');
    eis('typen: Enter en de puntkomma doen niets', await p.evaluate(() => document.getElementById('f-data-notitie').value), 'Na het eten laat');
    await p.evaluate(() => { const v = document.getElementById('f-data-notitie'); v.value = ''; v.dispatchEvent(new Event('input'));
      const dt = new DataTransfer(); dt.setData('text/plain', 'regel een\r\nregel twee; drie'); v.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); });
    eis('plakken: een regeleinde wordt een spatie, een puntkomma een komma', await p.evaluate(() => document.getElementById('f-data-notitie').value), 'regel een regel twee, drie');
    eis('plakken met een regeleinde blijft binnen de 250 tekens van het veld', await p.evaluate(() => { const v = document.getElementById('f-data-notitie'); v.value = 'abc'; v.setSelectionRange(3, 3);
      const dt = new DataTransfer(); dt.setData('text/plain', 'x'.repeat(200) + '\n' + 'y'.repeat(200)); v.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
      return [v.value.length, v.value.slice(0, 4)]; }), [250, 'abcx']);
    await p.evaluate(() => { const v = document.getElementById('f-data-notitie'); v.value = 'a;b\nc'; v.dispatchEvent(new Event('input')); });
    eis('vangnet (een toetsenbord dat het omzeilt): geen puntkomma, geen regeleinde', await p.evaluate(() => document.getElementById('f-data-notitie').value), 'ab c');
    await p.evaluate(() => document.getElementById('btn-add-datapoint').click()); await wacht(400);
    eis('opgeslagen als één regel', (await bestand('gewicht.txt')).D20261017, {waarde: 82, notitie: 'ab c'});

    console.log('Synctool: zelfde inhoud, nieuwe datum (13528F3-002)');
    const telLezen = () => p.evaluate(() => { window.__gelezen = 0; const echt = dirHandle.getFileHandle;
      dirHandle.getFileHandle = async (n, o) => { const h = await echt(n, o); const g = h.getFile;
        h.getFile = async () => { const f = await g(); const t = f.arrayBuffer; f.arrayBuffer = async () => { window.__gelezen++; return t(); }; return f; }; return h; }; });
    const aangeraakt = naam => p.evaluate(naam => { const f = window.__fs[naam]; window.__fs[naam] = {tekst: f.tekst, mtime: f.mtime + 5000}; }, naam);
    // Y1. gewicht.txt opnieuw neergezet met dezelfde inhoud
    await opzet(); await telLezen(); await aangeraakt('gewicht.txt');
    await meting('D20261018', '81.7'); await wacht(400);
    eis('zelfde inhoud, nieuwe datum: opgeslagen, zonder melding', [(await bestand('gewicht.txt')).D20261018, await zien('alert-overlay')], [81.7, false]);
    eis('de inhoud één keer gelezen, om te vergelijken', await p.evaluate(() => window.__gelezen), 1);
    // Y2. daarna kent Trends de stand weer: niet meer lezen
    await p.evaluate(() => { window.__gelezen = 0; });
    await meting('D20261019', '81.5'); await wacht(400);
    eis('de volgende opslag leest weer één keer om te vergelijken, zonder melding (13528F3-005)', [await p.evaluate(() => window.__gelezen), (await bestand('gewicht.txt')).D20261019, await zien('alert-overlay')], [1, 81.5, false]);
    // Y3. trends.json opnieuw neergezet met dezelfde inhoud: de bronnenlijst niet opnieuw verwerkt
    await opzet(); await aangeraakt('trends.json');
    await p.evaluate(() => { window.__verwerkt = 0; const echt = window.verwerkMeta; window.verwerkMeta = (j) => { window.__verwerkt++; return echt(j); }; });
    await bronOpslaan(); await wacht(400);
    eis('trends.json met dezelfde inhoud: niet opnieuw verwerkt, wel opgeslagen', [await p.evaluate(() => window.__verwerkt), (await bestand('trends.json')).bronnen[0].titel, await zien('alert-overlay')], [0, 'Gewicht nieuw', false]);
    await p.evaluate(() => { closeSourceModal(); });
    // Y4. echt andere inhoud: nog steeds opnieuw ingelezen, met melding
    await opzet(); await buiten('gewicht.txt', {D20261016: 82.3, D20261017: 82.0});
    await meting('D20261018', '81.7'); await wacht(400);
    eis('echt andere inhoud: opnieuw ingelezen (82,3 blijft), met melding', [(await bestand('gewicht.txt')).D20261016, await zien('alert-overlay')], [82.3, true]);
    await alertDicht();

    console.log('Placeholder notitie (13528F3-001)');
    await opzet();
    await p.evaluate(() => openEditDatapointModal('g', 'D20261017')); await wacht(200);
    const plek = () => p.evaluate(() => { const n = document.getElementById('f-data-notitie'); return [n.value, n.placeholder]; });
    eis('bij openen zonder notitie: het lege veld zegt – geen notitie –', await plek(), ['', '– geen notitie –']);
    await p.evaluate(() => { const n = document.getElementById('f-data-notitie'); n.value = 'x'; n.dispatchEvent(new Event('input')); n.value = ''; n.dispatchEvent(new Event('input')); });
    eis('alles weggetypt: weer – geen notitie –', await plek(), ['', '– geen notitie –']);
    await p.evaluate(() => document.getElementById('btn-undo-notitie').click());
    eis('het pijltje terug naar een lege notitie: ook – geen notitie –', await plek(), ['', '– geen notitie –']);
    await p.evaluate(() => closeDatapointModal()); await wacht(150);

    console.log('Regressie (1352898-026)');
    // RA. twintig dagen die elke dag 0,1 dalen, tot vandaag: een perfecte lijn
    await opzet(); await alertWeg(); await wacht(300);
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 20; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 19 + i); d[dateToKey(x)] = Math.round((85 - 0.1*i)*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g');
      dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
      dataPeriodFilter = '1m'; dataAggMode = 'd'; __zetKaart('standard'); await renderDataView();
    });
    await wacht(200);
    /* pixels van een kleur op de grafiek, optioneel alleen in de bovenste strook (de kop) */
    const pixels = (rgb, alleenKop) => p.evaluate(([rgb, alleenKop]) => {
      const c = document.getElementById('data-chart-canvas'), x = c.getContext('2d');
      const h = alleenKop ? Math.round(30 * (window.devicePixelRatio || 1)) : c.height;
      const d = x.getImageData(0, 0, c.width, h).data; let n = 0;
      for(let i = 0; i < d.length; i += 4) if(Math.abs(d[i]-rgb[0]) < 12 && Math.abs(d[i+1]-rgb[1]) < 12 && Math.abs(d[i+2]-rgb[2]) < 12) n++;
      return n;
    }, [rgb, !!alleenKop]);
    const OUDROZE = [209, 154, 192], ROOD = [239, 91, 91];
    eis('standaardweergave: geen paarse regressielijn', await pixels(OUDROZE), 0);
    eis('standaardweergave: wel de rode regelgrenzen', (await pixels(ROOD)) > 50, true);
    await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(); }); await wacht(200);
    const st = await p.evaluate(() => { const s = window.lastChartStats, r = s.regressie;
      return r ? [s.chartMode, r.eenheid, +r.hellingPer.toFixed(3), +r.r.toFixed(3), +r.r2.toFixed(3), +r.verandering.toFixed(2)] : [s.chartMode, null]; });
    eis('regressieweergave: helling -0,7 per week, r=-1, r²=1, -1,9 over de periode', st, ['regressie', 'wk', -0.7, -1, 1, -1.9]);
    eis('de paarse lijn staat op de grafiek', (await pixels(OUDROZE)) > 300, true);
    const stipjes = () => p.evaluate(() => { const e = document.getElementById('weergave-stipjes');
      return [e.querySelectorAll('.stip').length, [...e.querySelectorAll('.stip')].findIndex(x => x.style.background !== 'rgb(93, 107, 115)'), (e.querySelector('.stip-naam') || {}).textContent || '', (document.getElementById('weergave-spraak') || {}).textContent]; });
    eis('onder de grafiek: drie stipjes, de derde gevuld, met ŷ±σ (029, 13528F4-001)', await stipjes(), [3, 2, 'ŷ±σ', 'Weergave 3 van 3: regressie met sigma-grenzen']);
    await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); }); await wacht(100);
    eis('bij de basiskaart het eerste stipje, met de naam x̄±σ (029)', await stipjes(), [3, 0, 'x±σ', 'Weergave 1 van 3: gemiddelde met sigma-grenzen']);
    // 13528F4-001: σ en XmR zijn twee lagen die elkaar uitsluiten; vegen blijft x̄±σ, Range, ŷ±σ
    eis('de veegvolgorde: x̄±σ, Range, ŷ±σ; geen XmR-schakelaar meer', await p.evaluate(() => [grafiekWeergaven(), !!document.getElementById('btn-xmr')]), [['standard', 'range', 'regressie'], false]);
    const grens = () => p.evaluate(() => [effectieveWeergave(), document.querySelector('#weergave-stipjes .stip-naam').textContent,
      ...['grenzen', 'xmr'].map(l => { const b = document.querySelector(`#lagen-knoppen [data-laag="${l}"]`); return (b.classList.contains('aan') ? '+' : '-') + (b.getAttribute('aria-pressed') === 'true' ? 'p' : '') + (b.getAttribute('aria-disabled') ? '/' : ''); })]);
    const tikL = async l => { await p.click(`#lagen-knoppen [data-laag="${l}"]`, {force: true}); await wacht(150); };
    eis('standaard: σ aan, mR uit', await grens(), ['standard', 'x±σ', '+p', '-']);
    await tikL('xmr');
    eis('een tik op mR: de mR-grenzen, σ gaat uit, de naam x̄±mR', await grens(), ['xmr', 'x±mR', '-', '+p']);
    eis('de knop heet XmR-grenzen (ook in het ⋯-menu) en is getekend: een stap met een pijl, geen tekst (13528F4-001)', await p.evaluate(() => {
      const k = document.querySelector('#lagen-knoppen [data-laag="xmr"]'), s = k.querySelector('svg');
      return [k.getAttribute('aria-label'), !!s.querySelector('text'), s.querySelectorAll('line').length, s.getAttribute('width')]; }), ['XmR-grenzen', false, 3, '19']);
    eis('mR onthouden voor deze bron en deze kaart', await p.evaluate(() => [localStorage.getItem('trends.xmr.g.standard'), localStorage.getItem('trends.grenzen.g.standard')]), ['1', '1']);
    await tikL('xmr');
    eis('een tik op mR als die aan staat: terug naar σ (13528F4-001)', await grens(), ['standard', 'x±σ', '+p', '-']);
    await tikL('grenzen');
    eis('een tik op σ als die aan staat: geen grenzen, de naam x̄', await grens(), ['standard', 'x', '-', '-']);
    await tikL('xmr');
    eis('zonder grenzen een tik op mR: de mR-grenzen', await grens(), ['xmr', 'x±mR', '-', '+p']);
    await tikL('grenzen');
    eis('een tik op σ terwijl mR aan staat: σ', await grens(), ['standard', 'x±σ', '+p', '-']);
    await tikL('xmr');
    for(const [agg, naam] of [['w', 'per week'], ['m', 'per maand'], ['p', 'per meting']]){
      await p.evaluate(async agg => { if(agg === 'p') bronnen[0].meerdere_metingen = true; dataAggMode = agg; await renderDataView(); }, agg); await wacht(100);
      eis(`${naam} kan mR ook (13528F4-001)`, await grens(), ['xmr', 'x±mR', '-', '+p']);
    }
    await p.evaluate(async () => { bronnen[0].meerdere_metingen = false; dataAggMode = 'd'; await renderDataView(); }); await wacht(100);
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(100);
    eis('mR per kaart: bij ŷ±σ staat mR nog uit', await grens(), ['regressie', 'ŷ±σ', '+p', '-']);
    await tikL('xmr');
    eis('bij ŷ: een tik op mR geeft ŷ±mR', await grens(), ['regressieXmr', 'ŷ±mR', '-', '+p']);
    await p.evaluate(async () => { chartViewMode = 'range'; await renderDataView(); }); await wacht(100);
    eis('bij de Range-kaart: de mR-knop zet de grenzen, σ is grijs met de reden (13528F4-001)', [await grens(), await tikL('grenzen').then(() => p.evaluate(() => document.getElementById('grafiek-melding').textContent))],
      [['range', 'mR', '-/', '+p'], 'De Range-kaart heeft geen σ-grenzen']);
    await tikL('xmr');
    eis('bij de Range-kaart een tik op mR: de grenzen uit, en weer aan', [await grens(), await tikL('xmr').then(() => grens())], [['range', 'mR', '-/', '-'], ['range', 'mR', '-/', '+p']]);
    eis('vegen vanaf ŷ±mR gaat naar de buren van ŷ, niet terug naar het begin', await p.evaluate(async () => {
      chartViewMode = 'regressie'; await renderDataView(true);
      const c = document.getElementById('data-chart-canvas'), r = c.getBoundingClientRect(), y = r.top + r.height / 2;
      const veeg = (x1, x2) => { const t = (x, type) => new Touch({identifier: 1, target: c, clientX: x, clientY: y});
        c.dispatchEvent(new TouchEvent('touchstart', {touches: [t(x1)], changedTouches: [t(x1)], bubbles: true}));
        c.dispatchEvent(new TouchEvent('touchmove', {touches: [t(x2)], changedTouches: [t(x2)], bubbles: true}));
        c.dispatchEvent(new TouchEvent('touchend', {touches: [], changedTouches: [t(x2)], bubbles: true})); };
      const voor = effectieveWeergave(); veeg(r.left + r.width * 0.3, r.left + r.width * 0.8); await new Promise(z => setTimeout(z, 100));
      const na = chartViewMode; chartViewMode = 'regressie'; await renderDataView(true); return [voor, na]; }), ['regressieXmr', 'range']);
    eis('de terugzetknop laat mR staan (een laag), de kaart naar x̄', await p.evaluate(async () => {
      chartViewMode = 'standard'; zetLaag('xmr', true); chartViewMode = 'regressie'; await renderDataView(true);
      document.querySelector('#data-period-filter button[data-period="3m"]').click(); await new Promise(z => setTimeout(z, 100));
      document.getElementById('btn-weergave-standaard').click(); await new Promise(z => setTimeout(z, 150));
      return [effectieveWeergave(), document.getElementById('btn-weergave-standaard').hidden]; }), ['xmr', true]);
    eis('een oude XmR-keuze van de schakelaar (per bron) wordt bij de start de keuze voor x̄ en ŷ, en de oude sleutel verdwijnt', await p.evaluate(() => {
      vergeetLaag('xmr', 'g'); localStorage.setItem('trends.xmr.g', '1'); localStorage.setItem('trends.xmr.g.regressie', '0'); ruimOudeLagenOp();
      const r = [localStorage.getItem('trends.xmr.g'), localStorage.getItem('trends.xmr.g.standard'), localStorage.getItem('trends.xmr.g.regressie')]; vergeetLaag('xmr', 'g'); return r; }), [null, '1', '0']);
    await p.evaluate(async () => { vergeetLaag('xmr', 'g'); vergeetLaag('grenzen', 'g'); __zetKaart('standard'); await renderDataView(); }); await wacht(100);
    // 13528A4-01F: vijf lagenknoppen naast XmR (eerder één lagenknop met een menu, 13528A3-003)
    const GEEL = [232, 197, 71];
    /* per knop: + aan, - uit, / kan niet bij deze kaart */
    const lagen = () => p.evaluate(() => [...document.querySelectorAll('#lagen-knoppen .laag-knop')].map(b => b.dataset.laag +
      (b.getAttribute('aria-disabled') === 'true' ? '/' : b.getAttribute('aria-pressed') === 'true' && b.classList.contains('aan') ? '+' : b.getAttribute('aria-pressed') === 'false' && !b.classList.contains('aan') ? '-' : '?')).join());
    const melding = () => p.evaluate(() => document.getElementById('grafiek-melding').textContent);
    eis('zes lagenknoppen rechts onder de grafiek: σ aan, XmR uit, doel kan niet (geen doel), run-regels en vorig jaar uit (01F, 13528F4-001)', [await lagen(),
      await p.evaluate(() => Math.abs(document.getElementById('lagen-knoppen').getBoundingClientRect().right - document.getElementById('data-chart-canvas').getBoundingClientRect().right) < 30)], ['grenzen+,xmr-,doel/,run-,jaar-,notities+', true]);
    eis('zonder run-regels geen gele punten', await pixels(GEEL), 0);
    await p.click('#lagen-knoppen [data-laag="run"]'); await wacht(200);
    eis('één tik zet de run-regels aan: knop turquoise en ingedrukt, geen venster, onthouden voor deze bron en deze kaart (01F)',
        [await lagen(), await p.evaluate(() => [modalStack.length, localStorage.getItem('trends.run.g.' + basisWeergave(chartViewMode))])], ['grenzen+,xmr-,doel/,run+,jaar-,notities+', [0, '1']]);
    eis('de rechte daling: 7+ boven en 7+ onder x̄ en één trend over alles', await p.evaluate(() => { const r = window.lastChartStats.runs; return [r.kant.map(k => k.richting).join(), r.trend.length, r.trend[0].van, r.trend[0].tot === window.lastChartStats.n - 1]; }),
        ['1,-1', 1, 0, true]);
    eis('gele punten en strepen op de grafiek', (await pixels(GEEL)) > 300, true);
    eis('in de schermlezertekst: met run-regels', await p.evaluate(() => document.getElementById('weergave-spraak').textContent), 'Weergave 1 van 3: gemiddelde met sigma-grenzen, met run-regels');
    await p.click('#data-chart-canvas'); await wacht(200);
    eis('een tik op de grafiek opent Analyse meteen (geen menu meer dat de tik opvangt)', await p.evaluate(() => document.getElementById('chart-stats-modal-overlay').style.display), 'flex');
    eis('Analyse, tab Kaart: hoe vaak elke run-regel voorkomt', await p.evaluate(() => [...document.querySelectorAll('#chart-stats-modal-body-chart tr')].slice(-3).map(r => r.textContent)), ['≥7 < of > x2×', '≥6 ↗ of ↘1×', '2 van 3 oranje0×']);   // de derde regel sinds 13528A7-006; de tekens van de grafiek sinds 13528F4-003; het label sinds 13528A7-009
    await p.keyboard.press('Escape'); await wacht(200);
    await p.click('#lagen-knoppen [data-laag="doel"]', {force: true}); await wacht(150);  /* force: Playwright telt aria-disabled als niet klikbaar */
    eis('een tik op een uitgegrijsde laag: de reden, en er verandert niets (01F)', [await melding(), await lagen()], ['Deze bron heeft geen doel', 'grenzen+,xmr-,doel/,run+,jaar-,notities+']);
    // toetsenbord: de knoppen staan gewoon in de tabvolgorde; Enter en Spatie schakelen
    await p.focus('#lagen-knoppen [data-laag="run"]'); await p.keyboard.press('Enter'); await wacht(150);
    const naEnter = await lagen(); await p.keyboard.press(' '); await wacht(150);
    eis('toetsenbord: Enter zet de run-regels uit, Spatie weer aan; de focus blijft op de knop (01F)',
        [naEnter, await lagen(), await p.evaluate(() => document.activeElement && document.activeElement.dataset.laag)], ['grenzen+,xmr-,doel/,run-,jaar-,notities+', 'grenzen+,xmr-,doel/,run+,jaar-,notities+', 'run']);
    await p.focus('#lagen-knoppen [data-laag="grenzen"]'); const tabs = ['grenzen'];
    for(let i = 0; i < 5; i++){ await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => document.activeElement && document.activeElement.dataset.laag)); }
    eis('Tab langs de zes lagen, ook de uitgegrijsde (die zegt waarom) (01F, 13528F4-001)', tabs, ['grenzen', 'xmr', 'doel', 'run', 'jaar', 'notities']);
    eis('Prognose: Grenzen, Doel, Run-regels en Vorig jaar uitgegrijsd, Notities niet; een tik op Grenzen zegt waarom (01F)', await p.evaluate(async () => {
      const oud = [bronnen[0].doel_x, bronnen[0].doel_r]; bronnen[0].doel_x = 70; bronnen[0].doel_r = undefined;
      __zetKaart('prognose'); await renderDataView(true);
      const st = [effectieveWeergave(), [...document.querySelectorAll('#lagen-knoppen .laag-knop')].map(b => b.getAttribute('aria-disabled')).join()];
      document.querySelector('#lagen-knoppen [data-laag="grenzen"]').click(); await new Promise(r => setTimeout(r, 120));
      st.push(document.getElementById('grafiek-melding').textContent);
      [bronnen[0].doel_x, bronnen[0].doel_r] = oud; __zetKaart('standard'); await renderDataView(true); return st; }), ['prognose', 'true,true,true,true,true,', 'De prognose heeft geen grenzen']);
    eis('elke reden bij een uitgegrijsde laag; een tik verandert de opgeslagen stand niet (020)', await p.evaluate(async () => {
      const oud = [bronnen[0].doel_x, dataAggMode], uit = [], tik = async l => { const voor = JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('trends.')).sort().map(k => k + '=' + localStorage.getItem(k)));
        document.querySelector(`#lagen-knoppen [data-laag="${l}"]`).click(); await new Promise(r => setTimeout(r, 100));
        const na = JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('trends.')).sort().map(k => k + '=' + localStorage.getItem(k)));
        uit.push(document.getElementById('grafiek-melding').textContent + (voor === na ? '' : ' (stand veranderd)')); };
      bronnen[0].doel_x = 70; __zetKaart('range'); await renderDataView(true); await tik('doel'); await tik('run'); await tik('jaar');
      dataAggMode = 'y'; __zetKaart('standard'); await renderDataView(true); await tik('jaar');
      [bronnen[0].doel_x, dataAggMode] = oud; __zetKaart('standard'); await renderDataView(true); return uit; }),
      ['De Range-kaart heeft geen doel', 'Run-regels alleen bij het gemiddelde en de trend', 'Vorig jaar alleen bij het gemiddelde en de trend', 'Vorig jaar kan niet per jaar']);
    eis('Prognose: de knop Doel staat aan (het doel is er altijd), wel uitgegrijsd (020)', await p.evaluate(async () => {
      const oud = bronnen[0].doel_x; bronnen[0].doel_x = 70; __zetKaart('prognose'); await renderDataView(true);
      const k = document.querySelector('#lagen-knoppen [data-laag="doel"]'), r = [effectieveWeergave(), k.getAttribute('aria-pressed'), k.getAttribute('aria-disabled'), k.classList.contains('aan')];
      bronnen[0].doel_x = oud; __zetKaart('standard'); await renderDataView(true); return r; }), ['prognose', 'true', 'true', true]);
    for(const breed of [280, 250]){
      await p.setViewportSize({width: breed, height: 740}); await wacht(150);
      eis(`${breed} breed: de langste melding blijft binnen het scherm (020)`, await p.evaluate(async () => { __zetKaart('range'); await renderDataView(true);
        document.querySelector('#lagen-knoppen [data-laag="run"]').click(); await new Promise(r => setTimeout(r, 120));
        const m = document.querySelector('#grafiek-melding .melding-tekst').getBoundingClientRect(); __zetKaart('standard'); await renderDataView(true);
        return [m.left >= 0, m.right <= innerWidth]; }), [true, true]);
    }
    await p.setViewportSize({width: 360, height: 740}); await wacht(150);
    // 01F/020: de naam van de kaart wordt korter als het smal wordt; de stipjes blijven (vaste maat)
    {
      /* per kaart: de naam, ! als de rij overloopt, > als de knoppen buiten de kaart vallen, ~ als een stipje niet 7 px is, het aantal stipjes, ^ als de naam over twee regels breekt */
      const namen = metDoel => p.evaluate(async metDoel => { const uit = [], oud = bronnen[0].doel_x;
        if(metDoel) bronnen[0].doel_x = Math.round(window.lastChartStats.minVal - 3);
        for(const w of ['standard', 'xmr', 'range', 'regressie', 'regressieXmr', 'prognose']){ __zetKaart(w); await renderDataView(true);
          if(effectieveWeergave() !== w) continue;
          const el = document.getElementById('weergave-stipjes'), st = [...el.querySelectorAll('.stip')], kn = document.getElementById('lagen-knoppen').getBoundingClientRect(), kaart = document.getElementById('data-chart-preview').getBoundingClientRect();
          uit.push(el.querySelector('.stip-naam').textContent + (el.scrollWidth > el.clientWidth + 0.5 ? '!' : '') + (kn.right > Math.min(kaart.right, innerWidth) + 0.5 ? '>' : '') +
            (st.every(x => Math.abs(x.getBoundingClientRect().width - 7) < 0.1) ? '' : '~') + st.length + (el.querySelector('.stip-naam').getBoundingClientRect().height > 20 ? '^' : '') +
            (document.querySelectorAll('#lagen-knoppen .laag-knop.in-menu').length ? '⋯' + document.querySelectorAll('#lagen-knoppen .laag-knop.in-menu').length : '')); }
        bronnen[0].doel_x = oud; __zetKaart('standard'); await renderDataView(true); return uit.join(); }, metDoel);
      const uit = {};
      for(const breed of [412, 390, 360, 320, 300, 280]){ await p.setViewportSize({width: breed, height: 740}); await wacht(150); uit[breed] = [await namen(false), await namen(true)]; }
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      /* Met vijf laagknoppen (13528A7-003) wordt de naam eerder korter; past zelfs de kortste niet,
         dan gaan de laatste knoppen naar het menu achter ⋯ (⋯2: twee knoppen in het menu). Nooit
         alleen de stipjes. Met het menu is er weer ruimte, en dan mag de naam weer langer. */
      /* sinds 13528F4-001 zes kaarten (XmR in het vegen) met korte namen: x̄±σ, XmR, Range, ŷ±σ, ŷ XmR, Prognose */
      /* sinds 13528F4-001: de naam noemt ook de grenzen (x̄±σ, x̄±mR, ŷ±σ, ŷ±mR); mR is een laag, dus drie of vier stipjes */
      eis('412 en 390 breed: de korte namen, stipjes van 7 px, geen menu (13528F4-001)', [uit[412], uit[390]], [['x±σ3,x±mR3,mR3,ŷ±σ3,ŷ±mR3', 'x±σ4,x±mR4,mR4,ŷ±σ4,ŷ±mR4,ŷ→⊙4'], ['x±σ3,x±mR3,mR3,ŷ±σ3,ŷ±mR3', 'x±σ4,x±mR4,mR4,ŷ±σ4,ŷ±mR4,ŷ→⊙4']]);
      eis('360 en 320 breed: idem, geen menu (13528F4-001)', [uit[360], uit[320]], [['x±σ3,x±mR3,mR3,ŷ±σ3,ŷ±mR3', 'x±σ4,x±mR4,mR4,ŷ±σ4,ŷ±mR4,ŷ→⊙4'], ['x±σ3,x±mR3,mR3,ŷ±σ3,ŷ±mR3', 'x±σ4,x±mR4,mR4,ŷ±σ4,ŷ±mR4,ŷ→⊙4']]);
      eis('300 breed: niets ingekort; met doel bij x̄±mR en ŷ±mR het menu (13528F4-001)', uit[300], ['x±σ3,x±mR3,mR3,ŷ±σ3,ŷ±mR3', 'x±σ4,x±mR4⋯2,mR4,ŷ±σ4,ŷ±mR4⋯2,ŷ→⊙4']);
      eis('280 breed: het menu, nooit alleen de stipjes; niets loopt over of breekt (13528F4-001)', uit[280], ['x±σ3⋯2,x±mR3⋯2,mR3,ŷ±σ3⋯2,ŷ±mR3⋯2', 'x±σ4⋯2,x±mR4⋯2,mR4⋯2,ŷ±σ4⋯2,ŷ±mR4⋯2,ŷ→⊙4⋯2']);
      eis('weer 360 breed: weer ŷ±σ, het menu weg (01F, 13528F4-001)', await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(true); const t = [document.querySelector('#weergave-stipjes .stip-naam').textContent, document.getElementById('lagen-meer').hidden]; __zetKaart('standard'); await renderDataView(true); return t; }), ['ŷ±σ', true]);
      eis('het menu past zich aan bij een smaller venster, ook zonder nieuwe render (resize) (020, 13528F4-001)', await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(true); return true; })
        .then(async () => { await p.setViewportSize({width: 280, height: 740}); await wacht(200); const t = await p.evaluate(() => document.getElementById('lagen-meer').hidden);
          await p.setViewportSize({width: 360, height: 740}); await wacht(200); const t2 = await p.evaluate(() => document.getElementById('lagen-meer').hidden);
          await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(true); }); return [t, t2]; }), [false, true]);
      eis('opnieuw tekenen zonder verandering schrijft de naam niet opnieuw (020)', await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(true);
        const n = document.querySelector('#weergave-stipjes .stip-naam'); let m = 0; const ob = new MutationObserver(r => { m += r.length; }); ob.observe(n, {childList: true, characterData: true, subtree: true});
        await renderDataView(true); await new Promise(r => setTimeout(r, 30)); ob.disconnect(); __zetKaart('standard'); await renderDataView(true); return m; }), 0);
    }
    eis('per meting, drie dagen met gelijke daggemiddelden: niet aantoonbaar, een streepje bij marge (13528A4-004/005)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen], t = todayUTCDate(), d = {};
      [[2, '0700', 80.0], [2, '2200', 80.4], [1, '0700', 80.1], [1, '2200', 80.3], [0, '0700', 80.0], [0, '2200', 80.4]].forEach(([terug, tijd, v]) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - terug); d[dateToKey(x) + 'T' + tijd] = v; });
      bronnen[0].meerdere_metingen = true; dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'p'; __zetKaart('regressie'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal();
      const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'Marge');
      const uit = [rij && rij.cells[1].textContent, window.lastChartStats.regressie && window.lastChartStats.regressie.aantoonbaar];
      closeChartStatsModal(); [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen] = oud; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView(); return uit; }), ['–', false]);
    await wacht(200);
    eis('per meting, ochtend en avond: kop, Analyse en de lijn door de daggemiddelden zeggen dezelfde helling (13528A4-005/007)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen], t = todayUTCDate(), d = {};
      for(let i = 0; i < 10; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 9 + i); const m = 82 - 0.05*i + [0.1, -0.1, 0.05][i % 3];
        d[dateToKey(x) + 'T0700'] = Math.round((m - 1)*10)/10; if(i % 4 !== 2) d[dateToKey(x) + 'T2200'] = Math.round((m + 1)*10)/10; }
      bronnen[0].meerdere_metingen = true; dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'p'; __zetKaart('regressie');
      const echt = CanvasRenderingContext2D.prototype.fillText, kop = [];
      CanvasRenderingContext2D.prototype.fillText = function(tk, x, y){ if(y < 40 && /\/wk/.test(tk)) kop.push(tk); return echt.apply(this, arguments); };
      try{ await renderDataView(); } finally { CanvasRenderingContext2D.prototype.fillText = echt; }
      const r = window.lastChartStats.regressie;
      /* nagerekend: per dag gemiddelde x (dagen sinds de eerste meting) en y */
      const pts = Object.entries(d).map(([k, v]) => ({t: keyToDate(k).getTime() + keyToTimeMinutes(k)*60000, v})).sort((a, b) => a.t - b.t);
      const per = new Map(); pts.forEach(q => { const dg = Math.floor(q.t/864e5); const v = per.get(dg) || [0, 0, 0]; v[0] += (q.t - pts[0].t)/864e5; v[1] += q.v; v[2]++; per.set(dg, v); });
      const xs = [...per.values()].map(v => v[0]/v[2]), ys = [...per.values()].map(v => v[1]/v[2]);
      const mx = xs.reduce((a, b) => a + b)/xs.length, my = ys.reduce((a, b) => a + b)/ys.length;
      const b = xs.reduce((a, x, i) => a + (x - mx)*(ys[i] - my), 0)/xs.reduce((a, x) => a + (x - mx)*(x - mx), 0);
      window.chartSwipeJustHappened = false; openChartStatsModal();
      const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(t => t.cells[0].textContent === 'Helling').cells[1].textContent.replace(/\s/g, '');
      closeChartStatsModal(); [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen] = oud; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView();
      return [Math.abs(r.helling - b) < 1e-9, kop.length === 1 && kop[0].replace(/\s/g, '') === rij]; }), [true, true]);
    await wacht(200);
    eis('de opgeslagen stand van de oude knik-laag wordt opgeruimd (13528A4-003)', await p.evaluate(() => {
      if(typeof ruimOudeLagenOp !== 'function') return ['geen ruimOudeLagenOp'];
      localStorage.setItem('trends.knik.g', '1'); localStorage.setItem('trends.run.x', '1'); ruimOudeLagenOp();
      const r = [localStorage.getItem('trends.knik.g'), localStorage.getItem('trends.run.x')]; localStorage.removeItem('trends.run.x'); return r; }), [null, '1']);
    await wacht(200);
    // 13528A4-001: de live region alleen bijwerken als er iets verandert; de stipjes zelf verborgen voor de schermlezer
    eis('opnieuw tekenen zonder verandering: de live region blijft ongemoeid; stipjes en naam aria-hidden', await p.evaluate(async () => {
      const el = document.getElementById('weergave-stipjes'), sp = document.getElementById('weergave-spraak'), voor = el.firstChild, tv = sp.firstChild; await renderDataView(true);
      return [el.firstChild === voor && sp.firstChild === tv, el.querySelector('.stipjes-knop > span').getAttribute('aria-hidden'), sp.getAttribute('aria-live')]; }), [true, 'true', 'polite']);
    eis('de stand staat als tekst in de live region (niet alleen in aria-label)', await p.evaluate(() => document.getElementById('weergave-spraak').textContent),
        'Weergave 1 van 3: gemiddelde met sigma-grenzen, met run-regels');
    await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(); }); await wacht(150);
    eis('lagen per kaart: run-regels aan bij x̄±σ staan bij Regressie nog uit; daar zelf aan te zetten (01D)', await p.evaluate(async () => {
      const r = [laagIsAan('run'), document.querySelector('#lagen-knoppen [data-laag="run"]').classList.contains('aan')]; zetLaag('run', true); await renderDataView();
      r.push(laagIsAan('run'), localStorage.getItem('trends.run.g.regressie')); return r; }), [false, false, true, '1']);
    eis('bij Regressie rond de lijn: een rechte lijn door alle punten, dus geen runs', await p.evaluate(() => { const r = window.lastChartStats.runs; return [r.kant.length, r.trend.length]; }), [0, 0]);
    await p.evaluate(async () => { __zetKaart('range'); await renderDataView(); }); await wacht(150);
    eis('bij Range geen run-regels: die laag uitgegrijsd, σ ook, de mR-knop zet de grenzen (13528F4-001), geen geel', [await lagen(), await p.evaluate(() => window.lastChartStats.runs || null), await pixels(GEEL)], ['grenzen/,xmr+,doel/,run/,jaar/,notities+', null, 0]);
    await p.evaluate(async () => { __zetKaart('standard'); dataAggMode = 'w'; await renderDataView(); }); await wacht(150);
    eis('per week wel: run-regels op de weekpunten', await p.evaluate(() => !!window.lastChartStats.runs), true);
    // 13528A3-005: de tabel kleurt mee met de run-regels
    const tabelGeel = () => p.evaluate(() => { const v = [...document.querySelectorAll('#data-table-body td.val')].filter(td => td.textContent.trim());
      const k = v.map(td => getComputedStyle(td).color);
      return [k.filter(c => c === 'rgb(232, 197, 71)').length, k.filter(c => c === 'rgb(231, 237, 240)').length, v.length]; });
    const wk = await tabelGeel(), wkGrafiek = await p.evaluate(() => window.lastChartStats.runs.punten.filter(Boolean).length);
    eis('per week: de tabel kleurt zoals de grafiek (vier weken: te weinig voor een run, dus niets geel)', [wk[0], wkGrafiek], [0, 0]);
    const langWk = await p.evaluate(async () => { const oud = dataCache.g, d = {}, t = todayUTCDate();
      for(let i = 0; i < 120; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 119 + i); d[dateToKey(x)] = 90 - 0.05*i; }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '6m'; await renderDataView();
      const k = [...document.querySelectorAll('#data-table-body td.val')].filter(td => td.textContent.trim()).map(td => getComputedStyle(td).color);
      const r = [k.filter(c => c === 'rgb(232, 197, 71)').length, window.lastChartStats.runs.punten.filter(Boolean).length];
      dataCache = {g: oud}; bumpDataVersion('g'); dataPeriodFilter = '1m'; await renderDataView(); return r; });
    eis('per week over 18 weken: de tabel kleurt geel waar de grafiek geel is', [langWk[0] > 5, langWk[0] <= langWk[1]], [true, true]);
    await p.evaluate(async () => { dataAggMode = 'd'; await renderDataView(); }); await wacht(150);
    const dg = await tabelGeel();
    eis('per dag: de tabel kleurt mee, rood en oranje blijven (geen wit getal)', [dg[0] > 10, dg[1]], [true, 0]);
    /* per rij: de vlaggen uit de grafiek (drawChart onderschept) naast de kleur in de tabel (13528A3-006) */
    eis('per dag, per rij: geel in de tabel precies waar de grafiek een run heeft; rood of oranje wint', await p.evaluate(async () => {
      const echt = window.drawChart; let vang = null;
      window.drawChart = function(...a){ vang = {points: a[2], runs: a[14]}; return echt.apply(this, a); };
      try{ await renderDataView(true); } finally { window.drawChart = echt; }
      const vlag = new Map(vang.points.map((p, i) => [dateToKey(p.date), vang.runs.punten[i]]));
      let fout = 0, gezien = 0, voorrang = 0;
      document.querySelectorAll('#data-table-body tr[data-k]').forEach(tr => {
        const k = dateToKey(keyToDate(tr.dataset.k)), td = tr.querySelector('td.val'); if(!td || !vlag.has(k)) return;
        gezien++; const c = getComputedStyle(td).color, geel = c === 'rgb(232, 197, 71)', roodOranje = c === 'rgb(239, 91, 91)' || c === 'rgb(240, 168, 79)';
        if(vlag.get(k) ? !(geel || roodOranje) : geel) fout++;
        if(vlag.get(k) && roodOranje) voorrang++;
      });
      return [gezien >= 15, fout];
    }), [true, 0]);
    eis('een punt dat zowel in een run ligt als buiten de grens: oranje of rood, niet geel', await p.evaluate(async () => {
      const oud = dataCache.g, d = {}, t = todayUTCDate();
      const w = [80, 80.2, 79.9, 80.1, 80, 79.8, 80.2, 80.1, 82, 82.1, 81.9, 82, 85, 82.1, 82, 81.9];
      w.forEach((v, i) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - w.length + 1 + i); d[dateToKey(x)] = v; });
      dataCache = {g: d}; bumpDataVersion('g'); await renderDataView();
      const t85 = new Date(t); t85.setUTCDate(t85.getUTCDate() - 3);
      const td = document.querySelector('#data-table-body tr[data-k="' + dateToKey(t85) + '"] td.val');
      const kleur = getComputedStyle(td).color, inRun = window.lastChartStats.runs.punten[12];
      dataCache = {g: oud}; bumpDataVersion('g'); await renderDataView();
      return [td.textContent.trim(), inRun, kleur === 'rgb(240, 168, 79)' || kleur === 'rgb(239, 91, 91)'];
    }), ['85.0', true, true]);
    await p.evaluate(async () => { dataAggMode = 'p'; await renderDataView(); }); await wacht(150);
    const pm = await tabelGeel();
    eis('per meting: de tabel kleurt mee', [pm[0] > 10, pm[1]], [true, 0]);
    await p.evaluate(async () => { dataAggMode = 'd'; __zetKaart('regressie'); await renderDataView(); }); await wacht(150);
    eis('bij Regressie rond de lijn: geen runs, dus ook in de tabel geen geel', (await tabelGeel())[0], 0);
    await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); }); await wacht(150);
    await p.evaluate(async () => { dataAggMode = 'd'; await renderDataView(); }); await wacht(150);
    await p.click('#lagen-knoppen [data-laag="run"]'); await wacht(200);
    eis('nog eens: run-regels uit, geen geel meer', [await lagen(), await p.evaluate(() => localStorage.getItem('trends.run.g.' + basisWeergave(chartViewMode))), await pixels(GEEL)], ['grenzen+,xmr-,doel/,run-,jaar-,notities+', '0', 0]);
    eis('run-regels uit: ook in de tabel geen geel meer', (await tabelGeel())[0], 0);
    // 13528A3-005: de datums onder de grafiek lopen op een smal scherm niet in elkaar over
    const asDatums = (breed) => p.evaluate(async (breed) => {
      const echt = CanvasRenderingContext2D.prototype.fillText, gezien = [];
      CanvasRenderingContext2D.prototype.fillText = function(t, x, y){ if(/^\d\d-\d\d-\d{4}$/.test(t)){ const w = this.measureText(t).width; const a = this.textAlign;
        gezien.push(a === 'left' ? [x, x + w] : a === 'right' ? [x - w, x] : [x - w/2, x + w/2]); } return echt.apply(this, arguments); };
      try{ await renderDataView(true); } finally { CanvasRenderingContext2D.prototype.fillText = echt; }
      gezien.sort((a, b) => a[0] - b[0]);
      return [gezien.length, gezien.every((g, i) => i === 0 || g[0] >= gezien[i-1][1] + 6)];
    }, breed);
    eis('360 breed: drie datums, niet over elkaar', await asDatums(360), [3, true]);
    await p.setViewportSize({width: 300, height: 700}); await wacht(250);
    eis('300 breed: het midden valt weg, links en rechts blijven, niet over elkaar', await asDatums(300), [2, true]);
    await p.setViewportSize({width: 360, height: 740}); await wacht(250);
    // 13528A3-004: vorig jaar (de knik is er in 13528A3-007 weer uit)
    const items = () => p.evaluate(() => [...document.querySelectorAll('#lagen-knoppen .laag-knop')].map(b => b.dataset.laag + (b.getAttribute('aria-disabled') === 'true' ? '-' : '+')).join());
    eis('zes lagenknoppen, geen knik meer; zonder doel is Doel grijs (13528A3-007, 01A/01F)', await items(), 'grenzen+,xmr+,doel-,run+,jaar+,notities+');
    const bewaard = await p.evaluate(async () => {
      const oud = dataCache.g; const d = {}; const t = todayUTCDate(); const ruis = [0.2, -0.15, 0.1, -0.1, 0.05];
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i);
        d[dateToKey(x)] = Math.round((84.3 + (i > 18 ? -0.12*(i - 18) : 0) + ruis[i % 5])*10)/10;
        const v = new Date(x); v.setUTCFullYear(v.getUTCFullYear() - 1); d[dateToKey(v)] = 86 + (i % 3)*0.1; }
      dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('regressie'); await renderDataView(); return oud; });
    await wacht(150);
    eis('bij Regressie kunnen grenzen, run-regels en vorig jaar', await items(), 'grenzen+,xmr+,doel-,run+,jaar+,notities+');
    const pastAnalyse = (breed) => p.evaluate(async () => { zetLaag('run', true); await renderDataView(true); openChartStatsModal();
      const b = document.querySelector('#chart-stats-modal-overlay .modal-box').getBoundingClientRect(), t = document.getElementById('chart-stats-table-regressie').getBoundingClientRect();
      const r = [t.right <= b.right + 0.5, document.querySelectorAll('#chart-stats-modal-body-regressie tr').length];
      closeChartStatsModal(); zetLaag('run', false); await renderDataView(true); return r; });
    eis('360 breed, run-regels aan: de tabel Regressie past in het venster', await pastAnalyse(), [true, 18]);   // 18: met 2 van 3 (13528A7-006), … vanaf en … tot (13528F4-001/003), r en r² apart (13528F4-003)
    await p.setViewportSize({width: 320, height: 700}); await wacht(250);
    eis('320 breed: ook', (await pastAnalyse())[0], true);
    await p.setViewportSize({width: 360, height: 740}); await wacht(250);
    await p.evaluate(async () => { bronnen[0].doel_x = 82; __zetKaart('prognose'); await renderDataView(); }); await wacht(150);
    eis('bij de Prognose kan alleen de laag Notities', [await p.evaluate(() => window.lastChartStats.chartMode), await items()], ['prognose', 'grenzen-,xmr-,doel-,run-,jaar-,notities+']);
    await p.evaluate(async () => { delete bronnen[0].doel_x; __zetKaart('standard'); await renderDataView(); }); await wacht(150);
    eis('zonder vorig jaar: geen vorig jaar in Analyse', await p.evaluate(() => window.lastChartStats.vorigJaar), undefined);
    await p.click('#lagen-knoppen [data-laag="jaar"]'); await wacht(200);
    eis('vorig jaar aan: het gemiddelde van dezelfde 31 dagen een jaar eerder, en geen run-regels', await p.evaluate(() => [+window.lastChartStats.vorigJaar.toFixed(2), window.lastChartStats.vorigJaarN, window.lastChartStats.runs || null]), [86.1, 31, null]);
    eis('de schaal loopt mee tot vorig jaar (86,2 in beeld, de metingen gaan tot 84,5)', await p.evaluate(() => document.getElementById('data-chart-canvas').__schaal[1] > 86.2), true);
    await p.click('#data-chart-canvas'); await wacht(200);
    eis('Analyse, tab Statistieken: x̄ vorig jaar met het aantal punten', await p.evaluate(() => { const r = [...document.querySelectorAll('#chart-stats-modal-body tr')].pop(); return [...r.cells].map(c => c.textContent).join('|'); }), 'x vorig jaar|86.1 (31)');
    await p.keyboard.press('Escape'); await wacht(200);
    await p.evaluate(async () => { dataAggMode = 'w'; await renderDataView(); }); await wacht(150);
    eis('per week: vorig jaar in weken, op de weken van nu (evenveel als de weken van die dagen vorig jaar)', await p.evaluate(() => {
      /* onafhankelijk nageteld: de weken van vorig jaar, een jaar verder, voor zover die week nu op de as staat */
      const t = todayUTCDate(), nu = new Set(), weken = new Set();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); nu.add(getWeekStart(x).getTime()); }
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); x.setUTCFullYear(x.getUTCFullYear() - 1);
        const w = getWeekStart(x); w.setUTCFullYear(w.getUTCFullYear() + 1); const g = getWeekStart(w).getTime(); if(nu.has(g)) weken.add(g); }
      return [window.lastChartStats.vorigJaarN, weken.size]; }).then(([a, b]) => a === b && a >= 4), true);
    await p.evaluate(async () => { dataAggMode = 'y'; await renderDataView(); }); await wacht(150);
    eis('per jaar kan vorig jaar niet; mR wel (13528F4-001)', [await items(), await p.evaluate(() => window.lastChartStats.vorigJaar)], ['grenzen+,xmr+,doel-,run+,jaar-,notities+', undefined]);
    // 13528A4-021: de trend van vorig jaar bij Regressie
    {
      const vj = await p.evaluate(async () => {
        const oud = [dataCache.g, dataPeriodFilter, dataAggMode], d = {}, t = todayUTCDate();
        /* vorig jaar stijgend (0,02 per dag), dit jaar dalend; elke derde dag geen meting */
        for(let i = 0; i < 760; i++){ if(i % 3 === 1) continue; const x = new Date(t); x.setUTCDate(x.getUTCDate() - 759 + i);
          d[dateToKey(x)] = Math.round((i < 394 ? 80 + 0.02*i : 87.88 - 0.03*(i - 394)) * 10 + [2, -1, 1, -2, 0][i % 5]) / 10; }
        dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1y'; dataAggMode = 'd'; __zetKaart('regressie'); zetLaag('jaar', true);
        const uit = {};
        await renderDataView(true); const st = window.lastChartStats, tr = st.vorigJaarTrend;
        /* nagerekend: de kleinste-kwadratenlijn door de punten van vorig jaar die in de grafiek staan */
        const lbl = []; const echt = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(tk){ if(/^vorig jaar/.test(tk)) lbl.push(tk); return echt.apply(this, arguments); };
        try{ await renderDataView(true); } finally { CanvasRenderingContext2D.prototype.fillText = echt; }
        uit.jaar = [!!tr, tr && +(tr.hellingPer).toFixed(3), tr && tr.aantoonbaar, lbl[0]];
        window.chartSwipeJustHappened = false; openChartStatsModal();
        const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'Vorig jaar');
        uit.rij = rij ? rij.cells[1].textContent.replace(/\s/g, ' ') : null; closeChartStatsModal();
        dataAggMode = 'w'; await renderDataView(true); uit.week = [!!window.lastChartStats.vorigJaarTrend, window.lastChartStats.vorigJaarTrend && +window.lastChartStats.vorigJaarTrend.hellingPer.toFixed(2)];
        dataAggMode = 'd'; dataPeriodFilter = '1m'; await renderDataView(true); uit.kort = window.lastChartStats.vorigJaarTrend;
        window.chartSwipeJustHappened = false; openChartStatsModal();
        const rij2 = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'Vorig jaar');
        uit.kortRij = rij2 ? rij2.cells[1].textContent : null; closeChartStatsModal();
        dataPeriodFilter = '1y'; __zetKaart('standard'); await renderDataView(true); uit.std = window.lastChartStats.vorigJaarTrend;
        __zetKaart('regressie'); zetLaag('jaar', false); await renderDataView(true); uit.uit = window.lastChartStats.vorigJaarTrend;
        [dataCache.g, dataPeriodFilter, dataAggMode] = oud; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView(true);
        return uit; });
      eis('1 jaar per dag: de trend van vorig jaar, +0.14/wk (0,02 per dag), aantoonbaar, in het label (021)', vj.jaar, [true, 0.14, true, 'vorig jaar +0.14/wk']);
      eis('Analyse, tab Regressie: een regel vorig jaar met die helling (021)', vj.rij, '+0.14 / wk');
      eis('per week: ook een trend van vorig jaar, per week (021)', vj.week, [true, 0.14]);
      eis('1 maand: te kort voor een trend van vorig jaar; in Analyse een streepje (021)', [vj.kort, vj.kortRij], [null, '–']);
      eis('bij x̄±σ geen trend van vorig jaar, en zonder de laag ook niet (021)', [vj.std, vj.uit], [null, null]);
      // 13528A4-022: de reviewpunten van 021
      const vj2 = await p.evaluate(async () => {
        const oud = [dataCache.g, dataPeriodFilter, dataAggMode, bronnen[0].decimalen], t = todayUTCDate(), uit = {};
        const zet = async (maak, per, agg, w) => { const d = {}; maak(d); dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = per; dataAggMode = agg || 'd';
          __zetKaart(w || 'regressie'); zetLaag('jaar', true); await renderDataView(true); return window.lastChartStats.vorigJaarTrend; };
        const dag = n => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - n); return dateToKey(x); };
        /* nu elke dag een meting; vorig jaar (365+ dagen terug) wat de test vraagt */
        const nu = d => { for(let i = 0; i < 200; i++) d[dag(i)] = 80 + (i % 4)*0.1; };
        /* (1) per week met een gat van 6 weken vorig jaar: de helling op de weken van de as, onafhankelijk nagerekend */
        await zet(d => { nu(d); for(let i = 366; i < 366 + 180; i++){ if(i >= 366 + 60 && i < 366 + 102) continue; d[dag(i)] = 90 - 0.02*(i - 366) + [0.3, -0.2, 0.1, -0.3, 0.2, 0, -0.1][i % 7]; } }, '6m', 'w');
        const tr = window.lastChartStats.vorigJaarTrend;
        { /* nagerekend: weekgemiddelden van vorig jaar op de week van nu waarin ze vallen; x = het weeknummer, dus het gat telt mee */
          const groep = new Map();
          for(const [k, v] of Object.entries(dataCache.g)){ const x = keyToDate(k); if(x > eenJaarVerder(todayUTCDate(), -1)) continue;
            const wk = getWeekStart(eenJaarVerder(getWeekStart(x))).getTime(); const g = groep.get(wk) || [0, 0]; g[0] += v; g[1]++; groep.set(wk, g); }
          const xs = [...groep.keys()].map(w => w/(7*864e5)), ys = [...groep.values()].map(g => g[0]/g[1]);
          const mx = xs.reduce((a, b) => a + b)/xs.length, my = ys.reduce((a, b) => a + b)/ys.length;
          const b = xs.reduce((a, x, i) => a + (x - mx)*(ys[i] - my), 0)/xs.reduce((a, x) => a + (x - mx)*(x - mx), 0);
          uit.gat = [tr ? +tr.hellingPer.toFixed(4) : null, +b.toFixed(4), groep.size]; }
        /* (2) grenzen: 9 tegen 10 metingen over 100 dagen, 70 tegen 85 dagen met 30 metingen */
        const vjMet = (n, over) => d => { nu(d); for(let k = 0; k < n; k++) d[dag(366 + Math.round(k*over/(n - 1)))] = 85 - 0.01*k*over/(n - 1) + (k % 2)*0.2; };
        uit.grens = [!!await zet(vjMet(9, 100), '6m'), !!await zet(vjMet(10, 100), '6m'), !!await zet(vjMet(30, 70), '6m'), !!await zet(vjMet(30, 85), '6m')];
        /* (3) per maand over 6 maanden: de metingen tellen, niet de 6 maanden */
        uit.maand = !!await zet(vjMet(150, 170), '6m', 'm');
        /* (4) Regressie XmR */
        uit.xmr = [!!await zet(vjMet(30, 150), '6m', 'd', 'regressieXmr'), effectieveWeergave()];
        /* (5) niet aantoonbaar: (?) in het label en in Analyse; (6) de lijn wordt getekend; (7) het label in een donker vakje */
        const echtS = CanvasRenderingContext2D.prototype.stroke, echtT = CanvasRenderingContext2D.prototype.fillText, echtR = CanvasRenderingContext2D.prototype.roundRect;
        let lijn = 0, vak = 0; const lbl = [];
        CanvasRenderingContext2D.prototype.stroke = function(){ if(this.strokeStyle === 'rgba(159, 216, 224, 0.75)' && this.lineWidth === 2 && !this.getLineDash().length) lijn++; return echtS.apply(this, arguments); };
        CanvasRenderingContext2D.prototype.fillText = function(tk){ if(/^vorig jaar/.test(tk)) lbl.push(tk); return echtT.apply(this, arguments); };
        CanvasRenderingContext2D.prototype.roundRect = function(){ vak++; return echtR.apply(this, arguments); };
        let ruis = 7; const rnd = () => (ruis = (ruis*1103515245 + 12345) % 2147483648)/2147483648;
        try{ await zet(d => { nu(d); for(let i = 366; i < 366 + 180; i++) d[dag(i)] = 84 + (rnd() - 0.5)*3; }, '6m'); }
        finally { CanvasRenderingContext2D.prototype.stroke = echtS; CanvasRenderingContext2D.prototype.fillText = echtT; CanvasRenderingContext2D.prototype.roundRect = echtR; }
        const t2 = window.lastChartStats.vorigJaarTrend;
        uit.vraag = [!!t2, t2 && t2.aantoonbaar, /\(\?\)$/.test(lbl[0] || ''), lijn, vak >= 1];
        window.chartSwipeJustHappened = false; openChartStatsModal();
        const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'Vorig jaar');
        uit.rij = rij ? /\(\?\)$/.test(rij.cells[1].textContent) : null; closeChartStatsModal();
        [dataCache.g, dataPeriodFilter, dataAggMode, bronnen[0].decimalen] = oud; bumpDataVersion('g'); __zetKaart('regressie'); zetLaag('jaar', false); __zetKaart('standard'); await renderDataView(true);
        return uit; });
      for(const breed of [300, 320]){
        await p.setViewportSize({width: breed, height: 740}); await wacht(150);
        eis(`${breed} breed, vorig jaar met (?) en run-regels, waarden rond 12.345,67: de tabel Regressie binnen het venster (022)`, await p.evaluate(async () => {
          const oud = [dataCache.g, dataPeriodFilter, dataAggMode, bronnen[0].decimalen], t = todayUTCDate(), d = {}; let z = 3; const rnd = () => (z = (z*1103515245 + 12345) % 2147483648)/2147483648;
          for(let i = 0; i < 560; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); d[dateToKey(x)] = Math.round((12345.67 + (i < 365 ? -0.5*i : 0) + (rnd() - 0.5)*400)*100)/100; }
          dataCache = {g: d}; bumpDataVersion('g'); bronnen[0].decimalen = 2; dataPeriodFilter = '6m'; dataAggMode = 'd'; __zetKaart('regressie'); zetLaag('jaar', true); zetLaag('run', true); await renderDataView(true);
          window.chartSwipeJustHappened = false; openChartStatsModal();
          const box = document.querySelector('#chart-stats-modal-overlay .modal-box'), cs = getComputedStyle(box), t2 = document.getElementById('chart-stats-table-regressie').getBoundingClientRect();
          const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'Vorig jaar');
          const r = [!!rij && /\(\?\)/.test(rij.cells[1].textContent), t2.right <= box.getBoundingClientRect().right - parseFloat(cs.paddingRight) + 0.5];
          closeChartStatsModal(); zetLaag('jaar', false); zetLaag('run', false); [dataCache.g, dataPeriodFilter, dataAggMode, bronnen[0].decimalen] = oud; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView(true); return r; }), [true, true]);
      }
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      eis('per week met een gat van 6 weken vorig jaar: de helling op de weken van de as, zoals nagerekend (022)', [vj2.gat[0], vj2.gat[0] === vj2.gat[1]], [vj2.gat[1], true]);
      eis('grenzen: 9 metingen nee, 10 ja (over 100 dagen); 30 metingen over 70 dagen nee, over 85 dagen ja (022)', vj2.grens, [false, true, false, true]);
      eis('per maand over 6 maanden: de metingen van vorig jaar tellen, niet de 6 punten (022)', vj2.maand, true);
      eis('ook bij Regressie XmR (022)', vj2.xmr, [true, 'regressieXmr']);
      eis('periode Alles of een eigen periode van 2 jaar: Vorig jaar uitgegrijsd met de reden, niet getekend; bij 1 jaar weer aan (023)', await p.evaluate(async () => {
        const oud = [dataPeriodFilter, document.getElementById('data-range-from').value, document.getElementById('data-range-to').value, dataAggMode], uit = []; dataAggMode = 'd';
        const k = document.querySelector('#lagen-knoppen [data-laag="jaar"]'), stand = () => [k.getAttribute('aria-disabled'), window.lastChartStats.vorigJaar === undefined];
        __zetKaart('standard'); zetLaag('jaar', true); dataPeriodFilter = 'all'; await renderDataView(true); uit.push(...stand());
        k.click(); await new Promise(r => setTimeout(r, 120)); uit.push(document.getElementById('grafiek-melding').textContent, laagIsAan('jaar'));
        const t = todayUTCDate(), van = new Date(t); van.setUTCDate(van.getUTCDate() - 730);
        dataPeriodFilter = 'custom'; document.getElementById('data-range-from').value = keyToIsoDate(dateToKey(van)); document.getElementById('data-range-to').value = keyToIsoDate(dateToKey(t)); await renderDataView(true); uit.push(...stand());
        dataPeriodFilter = '1y'; await renderDataView(true); uit.push(...stand());
        zetLaag('jaar', false); [dataPeriodFilter, document.getElementById('data-range-from').value, document.getElementById('data-range-to').value, dataAggMode] = oud; await renderDataView(true); return uit; }),
        ['true', true, 'Vorig jaar alleen bij een periode tot 1 jaar', true, 'true', true, null, false]);
      // 13528A4-025: één periodeberekening voor tabel, telling en grafiek
      const per = await p.evaluate(async () => {
        const oud = [dataCache.g, dataPeriodFilter, dataAggMode, document.getElementById('data-range-from').value, document.getElementById('data-range-to').value, chartViewMode, bronnen[0].meerdere_metingen];
        const t = todayUTCDate(), d = {}, dag = n => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - n); return x; };
        /* ruim 3 jaar, elke tweede dag, plus één meting een week in de toekomst */
        for(let i = 0; i < 1200; i += 2) d[dateToKey(dag(i))] = 80 + (i % 7)*0.1;
        d[dateToKey(dag(-7))] = 81;
        dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('standard'); bronnen[0].meerdere_metingen = false;
        const iso = x => keyToIsoDate(dateToKey(x)), sl = Object.keys(d).sort().reverse();
        const uit = [], fouten = [];
        const gevallen = [];
        for(const pf of ['1w', '1m', '3m', '6m', '9m', '1y', 'all']) for(const ag of ['d', 'w', 'm', 'q', 'y']) gevallen.push([pf, ag, '', '']);
        for(const ag of ['d', 'w', 'm']) gevallen.push(['custom', ag, iso(dag(400)), iso(dag(100))], ['custom', ag, iso(dag(400)), ''], ['custom', ag, '', iso(dag(100))], ['custom', ag, '', '']);
        for(const [pf, ag, van, tot] of gevallen){
          dataPeriodFilter = pf; dataAggMode = ag; document.getElementById('data-range-from').value = van; document.getElementById('data-range-to').value = tot;
          const b = getDataPeriodBounds(sl), tabel = getShownDataKeys(sl).map(k => keyToDate(k).getTime());
          const g = await getChartPointsForSelection();
          const gd = g.points.map(q => q.date.getTime());
          const naam = pf + '/' + ag + (pf === 'custom' ? '/' + (van ? 'van' : '-') + (tot ? 'tot' : '-') : '');
          /* tabel en grafiek dezelfde dagen; alles binnen de grenzen; de grafiek eindigt waar de grenzen eindigen */
          const zelfde = tabel.length === gd.length && tabel.slice().sort().join() === gd.slice().sort().join();
          const binnen = tabel.every(x => x >= b.cutoff.getTime() && x <= b.rangeEnd.getTime());
          if(!zelfde || !binnen || g.rangeEnd.getTime() !== b.rangeEnd.getTime()) fouten.push(naam + (zelfde ? '' : ' tabel≠grafiek') + (binnen ? '' : ' buiten') + (g.rangeEnd.getTime() === b.rangeEnd.getTime() ? '' : ' einde'));
          uit.push(naam + '=' + dateToKey(b.cutoff) + '..' + dateToKey(b.rangeEnd) + ':' + tabel.length);
        }
        /* 026: een lege bron met alleen 'tot': de periode van 'tot' tot 'tot', zoals vóór 025 */
        dataPeriodFilter = 'custom'; dataAggMode = 'd'; document.getElementById('data-range-from').value = ''; document.getElementById('data-range-to').value = iso(dag(100));
        const leeg = getDataPeriodBounds([]);
        const leegG = dateToKey(leeg.cutoff) + '..' + dateToKey(leeg.rangeEnd);
        [dataCache.g, dataPeriodFilter, dataAggMode, document.getElementById('data-range-from').value, document.getElementById('data-range-to').value, chartViewMode, bronnen[0].meerdere_metingen] = oud;
        bumpDataVersion('g'); await renderDataView(true);
        const K = n => dateToKey(dag(n));
        const grenzen = Object.fromEntries(uit.filter(x => /^(custom\/d\/|all\/d=)/.test(x)).map(x => [x.split('=')[0], x.split('=')[1].split(':')[0]]));
        grenzen.leeg = leegG;
        const grenzenVerwacht = {'all/d': K(1198) + '..' + K(-7), 'custom/d/vantot': K(400) + '..' + K(100), 'custom/d/van-': K(400) + '..' + K(0),
          'custom/d/-tot': K(1198) + '..' + K(100), 'custom/d/--': K(1198) + '..' + K(0), leeg: K(100) + '..' + K(100)};
        const verwacht = {};   /* onafhankelijk: het begin van de periode */
        const v = n => dateToKey(dag(n - 1)), w = dateToKey(getWeekStart(t)), m = dateToKey(getMonthStart(t)), q = dateToKey(getQuarterStart(t)), y = dateToKey(getYearStart(t));
        return {fouten, uit, grenzen, grenzenVerwacht, begin: Object.fromEntries(uit.filter(x => /^(1w\/[dw]|1m\/[dm]|3m\/[dq]|1y\/[dy]|all\/d)=/.test(x)).map(x => [x.split('=')[0], x.split('=')[1].split('..')[0]])),
                verwacht: {'1w/d': v(7), '1w/w': w, '1m/d': v(31), '1m/m': m, '3m/d': v(91), '3m/q': q, '1y/d': v(365), '1y/y': y, 'all/d': dateToKey(dag(1198))}};
      });
      eis('tabel, telling en grafiek: dezelfde dagen en hetzelfde einde bij elke periode en groepering, ook een eigen periode zonder van of tot (025)', per.fouten, []);
      eis('begin en einde: Alles van de eerste tot de laatste meting (ook in de toekomst); een eigen periode zonder van vanaf de eerste meting, zonder tot tot vandaag; een lege bron met alleen tot: van tot tot (026)', per.grenzen, per.grenzenVerwacht);
      eis('het begin van de periode: n dagen terug, of het begin van de week/maand/kwartaal/jaar als periode en groepering gelijk zijn; Alles vanaf de eerste meting (025)', per.begin, per.verwacht);
      eis('de vragen: knoppen en een tik naast het venster geven de juiste waarde; daarna de focus terug (024/026)', await p.evaluate(async () => {
        const r = [], knop = document.createElement('button'); knop.textContent = 'proef'; document.body.appendChild(knop); knop.focus(); r.push(document.activeElement === knop);
        const tik = id => new Promise(res => setTimeout(() => { document.getElementById(id).click(); res(); }, 30));
        let v = showConfirm('x'); await tik('confirm-overlay'); r.push(await v, document.activeElement === knop);
        v = showConfirm('x'); await tik('confirm-ok'); r.push(await v);
        v = showConfirm('x'); await tik('confirm-cancel'); r.push(await v);
        v = showWarningConfirm('x', 'Doorgaan'); await tik('warn-cancel'); r.push(await v);
        v = showWarningConfirm('x', 'Doorgaan'); await tik('warn-overlay'); r.push(await v);
        v = showWarningConfirm('x', 'Doorgaan'); await tik('warn-ok'); r.push(await v, document.activeElement === knop);
        v = showAlert('x'); await tik('alert-ok'); r.push(await v === undefined, document.activeElement === knop); knop.remove();
        return r; }), [true, false, true, true, false, false, false, true, true, true, true]);
      eis('niet aantoonbaar: (?) in label en Analyse; de lijn wordt getekend; het label in een donker vakje (022)', [vj2.vraag, vj2.rij], [[true, false, true, 1, true], true]);
    }
    await p.evaluate(() => { dataAggMode = 'd'; zetLaag('jaar', false); });
    // 13528A4-01A: de lagen Grenzen en Doel
    {
      const ORANJE = [240, 168, 79], PAARS = [180, 142, 240];
      const zet = (grenzen, doel, weergave) => p.evaluate(async ([grenzen, doel, weergave]) => {
        chartViewMode = weergave || 'standard'; zetLaag('grenzen', grenzen); zetLaag('doel', doel); await renderDataView();
        const c = document.getElementById('data-chart-canvas'), knop = l => document.querySelector(`#lagen-knoppen [data-laag="${l}"]`);
        const tabel = [...document.querySelectorAll('#view-data td.val')].filter(td => /--danger|--warn/.test(td.getAttribute('style') || '')).length;
        return {schaal: c.__schaal.slice(), min: window.lastChartStats.minVal, max: window.lastChartStats.maxVal, label: lagenTekst(), tabel,
                checked: ['grenzen', 'doel'].map(l => knop(l).getAttribute('aria-pressed') + (knop(l).classList.contains('aan') ? '' : '-grijs')).join()}; }, [grenzen, doel, weergave]);
      const bewaardG = await p.evaluate(async () => {
        const oud = [dataCache.g, bronnen[0].doel_x, bronnen[0].doel_r, dataPeriodFilter], d = {}, t = todayUTCDate();
        for(let i = 0; i < 60; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 59 + i); d[dateToKey(x)] = Math.round((84.5 - 0.02*i + [0.2, -0.15, 0.1, -0.1, 0.05][i % 5] + (i === 55 ? 1.5 : 0))*10)/10; }
        bronnen[0].doel_x = 80; bronnen[0].doel_r = 1; dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '3m'; dataAggMode = 'd';
        vergeetLaag('grenzen', 'g'); vergeetLaag('doel', 'g');
        return oud; });
      const std = await p.evaluate(async () => { __zetKaart('standard'); await renderDataView();
        return [laagIsAan('grenzen'), laagIsAan('doel'), ['grenzen', 'doel'].map(l => document.querySelector(`#lagen-knoppen [data-laag="${l}"]`).getAttribute('aria-pressed')).join()]; });
      eis('standaard staan Grenzen en Doel aan: beide knoppen ingedrukt (01A/01F)', std, [true, true, 'true,true']);
      const aan = await zet(true, true); const rood1 = await pixels(ROOD), oranje1 = await pixels(ORANJE), paars1 = await pixels(PAARS);
      eis('alles aan: rode en oranje grenzen, het doel in paars, en gekleurde waarden in de tabel (01A)', [rood1 > 50, oranje1 > 20, paars1 > 50, aan.tabel > 0, aan.checked], [true, true, true, true, 'true,true']);
      const geenG = await zet(false, true); const rood2 = await pixels(ROOD), oranje2 = await pixels(ORANJE), paars2 = await pixels(PAARS);
      eis('Grenzen uit: geen rood en oranje in de grafiek (lijnen en stippen), geen kleur in de tabel, het doel blijft; de knop Grenzen grijs, "zonder grenzen" voor de schermlezer (01A/01F)',
          [rood2, oranje2, paars2 > 50, geenG.tabel, geenG.label, geenG.checked], [0, 0, true, 0, 'zonder grenzen', 'false-grijs,true']);
      const geenD = await zet(true, false); const paars3 = await pixels(PAARS);
      eis('Doel uit: geen paars, de as reikt niet meer tot het doel (80) en zoomt in op de metingen; de grenzen blijven (01A)',
          [paars3, geenD.schaal[0] > 81, aan.schaal[0] < 80, (await pixels(ROOD)) > 50, geenD.label], [0, true, true, true, 'zonder doel']);
      const geenBeide = await zet(false, false);
      const marge = 0.1*(geenBeide.max - geenBeide.min);
      eis('beide uit: de as alleen rond de metingen (hooguit 10% ruimte boven en onder), nauwer dan met grenzen (01A)',
          [geenBeide.schaal[0] >= geenBeide.min - marge && geenBeide.schaal[1] <= geenBeide.max + marge, geenBeide.schaal[1] - geenBeide.schaal[0] < geenD.schaal[1] - geenD.schaal[0]], [true, true]);
      eis('de keuze wordt per bron onthouden (01A)', await p.evaluate(() => [localStorage.getItem('trends.grenzen.g.standard'), localStorage.getItem('trends.doel.g.standard')]), ['0', '0']);
      const prog = await zet(true, false, 'prognose');
      eis('Prognose: het doel staat er altijd, ook met Doel uit; de lagen Grenzen en Doel kunnen daar niet (01A)',
          [await p.evaluate(() => effectieveWeergave()), (await pixels(PAARS)) > 20, await p.evaluate(() => ['grenzen', 'doel'].map(l => document.querySelector(`#lagen-knoppen [data-laag="${l}"]`).getAttribute('aria-disabled')).join())], ['prognose', true, 'true,true']);
      await zet(true, true, 'regressie');
      const regAan = await pixels(ROOD); await zet(false, true, 'regressie');
      eis('Regressie: Grenzen uit haalt ook de grenzen rond de lijn weg (01A)', [regAan > 50, await pixels(ROOD)], [true, 0]);
      for(const breed of [300, 360, 420]){
        await p.setViewportSize({width: breed, height: 740}); await wacht(150);
        eis(`${breed} breed: de stipjes en de lagenknoppen naast elkaar, binnen de kaart en het scherm (01F)`, await p.evaluate(async () => { __zetKaart('standard'); await renderDataView();
          const kn = [...document.querySelectorAll('#lagen-knoppen .laag-knop:not(.in-menu)')].map(b => b.getBoundingClientRect()), x = document.getElementById('weergave-stipjes').getBoundingClientRect(), k = document.getElementById('data-chart-preview').getBoundingClientRect();
          return [kn.every((r, i) => Math.abs(r.top + r.height / 2 - (x.top + x.height / 2)) < 2 && (i === 0 ? r.left >= x.right - 0.5 : r.left >= kn[i-1].right - 0.5)), kn[kn.length - 1].right <= Math.min(k.right, innerWidth) + 0.5]; }), [true, true]);
      }
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      /* 01B: de tabel met Grenzen uit, ook per week, per meting, bij Range en bij XmR */
      eis('Grenzen uit: geen rode of oranje waarden in de tabel per meting en bij Range; met Grenzen aan wel (01B)', await p.evaluate(async () => {
        const kleur = () => [...document.querySelectorAll('#view-data td')].filter(td => /--danger|--warn/.test(td.getAttribute('style') || '')).length, uit = [];
        for(const [agg, w] of [['p', 'standard'], ['d', 'range']]){
          dataAggMode = agg; chartViewMode = w; zetLaag('grenzen', true); await renderDataView(); const aan = kleur();
          zetLaag('grenzen', false); await renderDataView(); uit.push(aan > 0, kleur()); }
        dataAggMode = 'd'; __zetKaart('standard'); zetLaag('grenzen', true); await renderDataView(); return uit; }), [true, 0, true, 0]);
      eis('per bron: Grenzen uit bij deze bron staat bij een andere bron gewoon aan (01B)', await p.evaluate(() => {
        zetLaag('grenzen', false); const hier = laagIsAan('grenzen'); const sel = document.getElementById('data-source-select'), oud = sel.value;
        bronnen.push({id: 'h', titel: 'Ander', bestand: 'ander.txt'}); const o = document.createElement('option'); o.value = 'h'; sel.appendChild(o); sel.value = 'h';
        const daar = laagIsAan('grenzen'); sel.value = oud; o.remove(); bronnen.pop(); zetLaag('grenzen', true); return [hier, daar]; }), [false, true]);
      /* 01D: de lagen per kaart (bijvoorbeeld km-stand: geen grenzen bij x̄±σ, wel bij Regressie) */
      eis('per kaart: Grenzen uit bij x̄±σ; Range en ŷ±σ houden hun grenzen, bij Range is σ grijs (13528F4-001)', await p.evaluate(async () => {
        vergeetLaag('grenzen', 'g'); vergeetLaag('doel', 'g'); dataAggMode = 'd'; const r = [];
        __zetKaart('standard'); zetLaag('grenzen', false); await renderDataView();
        const lk = document.querySelector('#lagen-knoppen [data-laag="grenzen"]');
        r.push(laagIsAan('grenzen'), effectieveWeergave(), lagenTekst());
        for(const w of ['range', 'regressie']){ chartViewMode = w; await renderDataView(); r.push(laagIsAan('grenzen'), lk.getAttribute('aria-pressed')); }
        vergeetLaag('grenzen', 'g'); __zetKaart('standard'); await renderDataView(); return r; }),
        [false, 'standard', 'zonder grenzen', true, 'false', true, 'true']);
      eis('per kaart: Regressie zonder grenzen tekent geen rood; x̄±σ ernaast nog wel (01D)', await (async () => {
        await p.evaluate(async () => { vergeetLaag('grenzen', 'g'); __zetKaart('regressie'); zetLaag('grenzen', false); await renderDataView(); }); await wacht(80);
        const reg = await pixels(ROOD);
        await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); }); await wacht(80);
        const std = await pixels(ROOD); await p.evaluate(async () => { vergeetLaag('grenzen', 'g'); await renderDataView(); }); return [reg, std > 50]; })(), [0, true]);
      eis('een stand van vóór 01D (per bron) geldt voor elke kaart, tot je per kaart iets kiest (01D)', await p.evaluate(async () => {
        vergeetLaag('grenzen', 'g'); localStorage.setItem('trends.grenzen.g', '0'); const r = [];
        for(const w of ['standard', 'range', 'regressie']){ chartViewMode = w; r.push(laagIsAan('grenzen')); }
        zetLaag('grenzen', true); r.push(laagIsAan('grenzen')); __zetKaart('standard'); r.push(laagIsAan('grenzen'));
        vergeetLaag('grenzen', 'g'); r.push(localStorage.getItem('trends.grenzen.g'), localStorage.getItem('trends.grenzen.g.regressie'), laagIsAan('grenzen'));
        await renderDataView(); return r; }), [false, false, false, true, false, null, null, true]);
      /* 01E: de reviewpunten van 01D */
      eis('de keuze per kaart wint van een oude stand per bron, ook na herstarten (opnieuw gelezen uit de opslag) (01E)', await p.evaluate(async () => {
        vergeetLaag('grenzen', 'g'); localStorage.setItem('trends.grenzen.g', '0'); __zetKaart('regressie'); zetLaag('grenzen', true);
        for(const k of Object.keys(__laagStand)) delete __laagStand[k];
        const r = [laagIsAan('grenzen')]; __zetKaart('standard'); r.push(laagIsAan('grenzen'));
        vergeetLaag('grenzen', 'g'); await renderDataView(); return r; }), [true, false]);
      eis('het doel weghalen bij bron g laat de keuzes van bron g_2 staan (01E)', await p.evaluate(() => {
        localStorage.setItem('trends.doel.g_2', '0'); localStorage.setItem('trends.doel.g_2.standard', '0'); localStorage.setItem('trends.doel.g.standard', '0');
        vergeetLaag('doel', 'g');
        const r = [localStorage.getItem('trends.doel.g.standard'), localStorage.getItem('trends.doel.g_2'), localStorage.getItem('trends.doel.g_2.standard')];
        localStorage.removeItem('trends.doel.g_2'); localStorage.removeItem('trends.doel.g_2.standard'); return r; }), [null, '0', '0']);
      eis('een bron verwijderen wist zijn lagen: een nieuwe bron met dezelfde naam begint met de standaard (01E)', await p.evaluate(async () => {
        const sel = document.getElementById('data-source-select'), oud = sel.value, stand = [dataPeriodFilter, dataAggMode];
        bronnen.push({id: 'tmpx', titel: 'Tijdelijk', bestand: 'tmpx.txt'});
        for(const k of ['trends.doel.tmpx.standard', 'trends.run.tmpx.regressie', 'trends.grenzen.tmpx']) localStorage.setItem(k, k.endsWith('regressie') ? '1' : '0');
        __laagStand['doel.tmpx.standard'] = false;
        await verwijderBron('tmpx');
        const over = Object.keys(localStorage).filter(k => /\.tmpx(\.|$)/.test(k));
        const r = [bronnen.some(b => b.id === 'tmpx'), over.length, 'doel.tmpx.standard' in __laagStand];
        sel.value = oud; [dataPeriodFilter, dataAggMode] = stand; syncPeriodButtonsActive(); __zetKaart('standard'); await renderDataView(); return r; }), [false, 0, false]);
      /* 01C: de reviewpunten van 01B */
      const doelZonder = await p.evaluate(async () => {
        const oud = [bronnen[0].doel_x, bronnen[0].doel_r]; __zetKaart('standard'); dataAggMode = 'd'; zetLaag('doel', true); zetLaag('grenzen', false);
        await renderDataView(); bronnen[0].doel_x = Math.round((window.lastChartStats.maxVal + 0.3)*10)/10; bronnen[0].doel_r = null; await renderDataView();
        return [bronnen[0].doel_x, document.getElementById('data-chart-canvas').__schaal.slice(), oud]; });
      const paarsZonder = await pixels(PAARS);
      eis('doel zonder bereik, Grenzen uit en Doel aan: het doel in beeld en getekend (01C)', [doelZonder[1][1] > doelZonder[0], paarsZonder > 20], [true, true]);
      eis('doel zonder bereik, Doel uit: de as hoeft niet tot het doel (01C)', await p.evaluate(async () => { zetLaag('doel', false); await renderDataView();
        const sch = document.getElementById('data-chart-canvas').__schaal; zetLaag('doel', true); return sch[1] < bronnen[0].doel_x; }), true);
      await p.evaluate(async (oud) => { [bronnen[0].doel_x, bronnen[0].doel_r] = oud; zetLaag('grenzen', true); await renderDataView(); }, doelZonder[2]);
      eis('x̄±σ met Grenzen uit: de schermlezer zegt "gemiddelde, zonder grenzen", niet "met sigma-grenzen" (01C)', await p.evaluate(async () => {
        __zetKaart('standard'); zetLaag('grenzen', false); await renderDataView(); const t = document.getElementById('weergave-spraak').textContent;
        zetLaag('grenzen', true); await renderDataView(); return [/: gemiddelde, zonder grenzen/.test(t), /sigma-grenzen/.test(t)]; }), [true, false]);
      eis('Grenzen uit bij x̄±σ, dan de XmR-kaart: Analyse rekent met XmR (13528F4-001)', await p.evaluate(async () => {
        __zetKaart('standard'); dataAggMode = 'd'; zetLaag('grenzen', false); __zetKaart('xmr'); await renderDataView();
        window.chartSwipeJustHappened = false; openChartStatsModal(); await new Promise(r => setTimeout(r, 100));
        const titel = document.getElementById('chart-stats-titel').textContent, w = effectieveWeergave();
        history.back(); await new Promise(r => setTimeout(r, 150)); __zetKaart('standard'); zetLaag('grenzen', true); await renderDataView(); return [titel, w]; }), ['XmR (x±mR)', 'xmr']);
      eis('snelle dubbele tik op een uitgegrijsde laag: één melding (01C)', await p.evaluate(async () => {
        __zetKaart('xmr'); await renderDataView(); const k = document.querySelector('#lagen-knoppen [data-laag="grenzen"]');
        k.click(); await new Promise(r => setTimeout(r, 20)); k.click(); await new Promise(r => setTimeout(r, 150));
        const n = document.querySelectorAll('#grafiek-melding .melding-tekst').length; __zetKaart('standard'); await renderDataView(); return n; }), 1);
      eis('Grenzen uit: geen rode of oranje waarden in de tabel per week en bij Regressie; met Grenzen aan wel (01C)', await p.evaluate(async () => {
        const kleur = () => [...document.querySelectorAll('#view-data td')].filter(td => /--danger|--warn/.test(td.getAttribute('style') || '')).length, uit = [];
        /* een hele kalenderweek ver boven de rest, zodat ook het weekgemiddelde buiten de grenzen
           valt. Een hele week, niet zeven willekeurige dagen: die vallen meestal in twee weken, en
           op zaterdag en zondag kwam dan geen van beide weekgemiddelden boven de grens (13528A7-001) */
        const bewaar = dataCache.g, d = Object.assign({}, bewaar), ws = getWeekStart(todayUTCDate()), sleutels = [];
        for(let i = 0; i < 7; i++){ const x = new Date(ws); x.setUTCDate(x.getUTCDate() - 14 + i); sleutels.push(dateToKey(x)); }
        for(const k of sleutels) d[k] = d[k] + 3; dataCache = {g: d}; bumpDataVersion('g');
        for(const [agg, w] of [['w', 'standard'], ['d', 'regressie']]){
          dataAggMode = agg; chartViewMode = w; zetLaag('grenzen', true); await renderDataView(); const aan = kleur();
          zetLaag('grenzen', false); await renderDataView(); uit.push(aan > 0, kleur()); }
        dataCache = {g: bewaar}; bumpDataVersion('g');
        dataAggMode = 'd'; __zetKaart('standard'); zetLaag('grenzen', true); await renderDataView(); return uit; }), [true, 0, true, 0]);
      await p.evaluate(async () => { __zetKaart('range'); zetLaag('grenzen', true); await renderDataView(); }); await wacht(80); const rangeAan = await pixels(ROOD);
      await p.evaluate(async () => { zetLaag('grenzen', false); await renderDataView(); }); await wacht(80); const rangeUit = await pixels(ROOD);
      eis('Range: Grenzen uit haalt de rode grens weg (01C)', [rangeAan > 50, rangeUit], [true, 0]);
      eis('Grenzen en Doel uit: de as alleen rond de metingen (01C)', await p.evaluate(async () => {
        __zetKaart('standard'); zetLaag('doel', false); zetLaag('grenzen', false); await renderDataView();
        const s = document.getElementById('data-chart-canvas').__schaal, st = window.lastChartStats, m = 0.1*(st.maxVal - st.minVal);
        const uit = s[0] >= st.minVal - m && s[1] <= st.maxVal + m; zetLaag('doel', true); zetLaag('grenzen', true); await renderDataView(); return uit; }), true);
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      await p.evaluate(async (oud) => { zetLaag('grenzen', true); zetLaag('doel', true);
        vergeetLaag('grenzen', 'g'); vergeetLaag('doel', 'g');
        [dataCache.g, bronnen[0].doel_x, bronnen[0].doel_r, dataPeriodFilter] = oud; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView(); }, bewaardG);
      await wacht(150);
    }

    await p.evaluate(async (oud) => { dataCache = {g: oud}; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView(); }, bewaard); await wacht(150);
    // 13528A4-006 t/m 017: de tabs Week en Jaar in Analyse (alleen bij x̄±σ en XmR, grijs als ze niet kunnen)
    const tabStand = () => p.evaluate(() => { window.chartSwipeJustHappened = false; openChartStatsModal();
      const tabs = [...document.querySelectorAll('#chart-stats-tabs button')].filter(b => b.style.display !== 'none').map(b => b.dataset.stattab + (b.getAttribute('aria-disabled') === 'true' ? '-' : '')).join();
      const titels = ['week', 'jaar'].map(t => document.getElementById('chart-stats-tab-' + t).title);
      closeChartStatsModal(); return [tabs, ...titels]; });
    const openTab = (tab) => p.evaluate((tab) => { window.chartSwipeJustHappened = false; openChartStatsModal();
      document.querySelector(`#chart-stats-tabs button[data-stattab="${tab}"]`).click();
      const actief = document.querySelector('#chart-stats-tabs button.active').dataset.stattab, body = document.getElementById('chart-stats-modal-body-patroon');
      const rijen = [...body.querySelectorAll('tr')].map(tr => tr.cells[0].textContent + ' ' + (tr.cells[2] ? tr.cells[2].textContent : ''));
      const uit = [actief, rijen, getComputedStyle(document.getElementById('chart-stats-table-patroon')).visibility, !body.querySelector('#patroon-keuze, .wd-noot, td[colspan]')];
      closeChartStatsModal(); return uit; }, tab);
    eis('x̄±σ per dag, 20 dagen: tabs Statistieken, Kaart, Week, Jaar; Jaar grijs met de reden als tooltip (017)', await tabStand(),
        ['stats,chart,week,jaar-', '', 'Jaar: pas als elke maand minstens twee keer heel in de periode ligt, met metingen (ruim twee jaar data).']);
    let ot = await openTab('week'); await wacht(150);
    eis('een tik op Week: 7 rijen met getallen, zonder keuzerij en zonder noot (017)', [ot[0], ot[1].length, ot[1].every(r => /^(ma|di|wo|do|vr|za|zo) [+-]?\d+\.\d+$/.test(r)), ot[2], ot[3]], ['week', 7, true, 'visible', true]);
    ot = await openTab('jaar'); await wacht(150);
    eis('een tik op de grijze tab Jaar opent hem niet: Statistieken blijft open (017)', [ot[0], ot[2]], ['stats', 'hidden']);
    eis('een tik op de grijze tab Jaar toont kort de reden onder de tabs (niet eroverheen, in een live-regio die er altijd is), de knop is focusbaar; na 4 s weg; ook via de code gaat Jaar niet open (018/019)', await p.evaluate(async () => {
      window.chartSwipeJustHappened = false; openChartStatsModal();
      const r = document.getElementById('chart-stats-reden'), voor = r.textContent, jaar = document.getElementById('chart-stats-tab-jaar');
      jaar.focus(); const focusbaar = document.activeElement === jaar;
      jaar.click(); await new Promise(k => setTimeout(k, 120));
      const tekst = r.textContent, live = [r.getAttribute('role'), r.getAttribute('aria-live'), getComputedStyle(r).display !== 'none'];
      /* 019: de melding begint onder de tabs, niet eroverheen */
      const onder = r.querySelector('.reden-tekst').getBoundingClientRect().top >= document.getElementById('chart-stats-tabs').getBoundingClientRect().bottom;
      setStatsTab('jaar'); const actief = document.querySelector('#chart-stats-tabs button.active').dataset.stattab;
      await new Promise(k => setTimeout(k, 4200)); const na = r.textContent;
      jaar.click(); await new Promise(k => setTimeout(k, 120));
      document.getElementById('chart-stats-tab-week').click(); const naWeek = [document.querySelector('#chart-stats-tabs button.active').dataset.stattab, r.textContent];
      closeChartStatsModal(); return [voor, tekst, focusbaar, ...live, onder, actief, na, ...naWeek]; }),
      ['', 'Jaar: pas als elke maand minstens twee keer heel in de periode ligt, met metingen (ruim twee jaar data).', true, 'status', 'polite', true, true, 'stats', '', 'week', '']);
    await p.evaluate(async () => { dataAggMode = 'w'; await renderDataView(); }); await wacht(150);
    eis('per week, 20 dagen: Week en Jaar allebei grijs, met de reden als tooltip; ze staan er wel (017)', await tabStand(),
        ['stats,chart,week-,jaar-', 'Week: alleen per dag of per meting, vanaf 14 dagen met metingen.', 'Jaar: pas als elke maand minstens twee keer heel in de periode ligt, met metingen (ruim twee jaar data).']);
    eis('vegen slaat grijze tabs over: van Kaart naar rechts blijft Kaart (017)', await p.evaluate(() => { window.chartSwipeJustHappened = false; openChartStatsModal(); setStatsTab('chart');
      const box = document.querySelector('#chart-stats-modal-overlay .modal-box'), maak = (x) => new Touch({identifier: 1, target: box, clientX: x, clientY: 300});
      box.dispatchEvent(new TouchEvent('touchstart', {touches: [maak(250)], changedTouches: [maak(250)]}));
      box.dispatchEvent(new TouchEvent('touchend', {touches: [], changedTouches: [maak(100)]}));
      const a = document.querySelector('#chart-stats-tabs button.active').dataset.stattab; closeChartStatsModal(); return a; }), 'chart');
    eis('per week, 760 dagen: Week grijs, Jaar te kiezen, met 12 rijen met getallen (017)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], d = {}, t = todayUTCDate();
      for(let i = 0; i < 760; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 759 + i); d[dateToKey(x)] = 80 + (i % 5)*0.1; }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'all'; await renderDataView();
      window.chartSwipeJustHappened = false; openChartStatsModal(); document.getElementById('chart-stats-tab-jaar').click();
      const body = document.getElementById('chart-stats-modal-body-patroon');
      const uit = [document.getElementById('chart-stats-tab-week').getAttribute('aria-disabled') === 'true', document.getElementById('chart-stats-tab-jaar').getAttribute('aria-disabled') === 'true',
        [...body.querySelectorAll('tr')].filter(tr => /\d/.test(tr.cells[2].textContent)).length, body.querySelector('tr td').textContent];
      closeChartStatsModal(); [dataCache.g, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), [true, false, 12, 'jan']);
    await p.evaluate(async () => { dataAggMode = 'd'; __zetKaart('range'); await renderDataView(); }); await wacht(150);
    eis('bij Range geen Week en Jaar, ook niet grijs (017)', (await tabStand())[0], 'stats,chart');
    await p.evaluate(async () => { __zetKaart('xmr'); await renderDataView(); }); await wacht(150);
    eis('bij XmR wel Week en Jaar (017)', (await tabStand())[0], 'stats,chart,week,jaar-');
    await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); });
    // 13528A4-009: reviewpunten 008
    eis('per meting, periode Alles: de eerste dag (met een tijd) telt mee in Patroon', await p.evaluate(async () => {
      const oud = [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen, dataPeriodFilter], t = todayUTCDate(), d = {};
      [[15, '0700', 80.0], [15, '2200', 80.4], ...[...Array(15).keys()].map(i => [14 - i, '0700', 80 + i*0.01])].forEach(([terug, tijd, v]) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - terug); d[dateToKey(x) + 'T' + tijd] = v; });
      bronnen[0].meerdere_metingen = true; dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'p'; dataPeriodFilter = 'all'; __zetKaart('standard'); await renderDataView();
      const pt = window.lastChartStats.patroon, uit = pt ? pt.b - pt.a : 0;
      [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), 16);
    await wacht(150);
    eis('eigen periode: de einddatum telt mee en de dag erna niet (00A)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], d = {}, t = todayUTCDate();
      for(let i = 0; i < 30; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 29 + i); d[dateToKey(x)] = 80 + i*0.01; }
      const iso = n => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'custom'; dataAggMode = 'd'; __zetKaart('standard');
      document.getElementById('data-range-from').value = iso(20); document.getElementById('data-range-to').value = iso(5);
      await renderDataView();
      const pt = window.lastChartStats.patroon, uit = [pt ? pt.b - pt.a : 0, pt ? dateToKey(pt.daily[pt.b - 1].date) === iso(5).replace(/-/g, '') : false];
      document.getElementById('data-range-from').value = ''; document.getElementById('data-range-to').value = '';
      [dataCache.g, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), [16, true]);
    {
      /* de oude keuze van de tab Patroon wordt bij het laden opgeruimd (017) */
      const ctxL = await browser.newContext({viewport: {width: 360, height: 740}});
      await ctxL.addInitScript(() => { try{ if(!sessionStorage.getItem('gezet')){ localStorage.setItem('trends.patroon', 'maand'); sessionStorage.setItem('gezet', '1'); } }catch(e){} });
      const pl = await veilig(await ctxL.newPage()); await pl.addInitScript(ZETKAART); const foutenL = []; pl.on('pageerror', e => foutenL.push(e.message));
      await pl.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await pl.waitForTimeout(400);
      eis('de oude opgeslagen keuze trends.patroon is na het laden weg, zonder fouten (017)', [await pl.evaluate(() => localStorage.getItem('trends.patroon')), foutenL.length], [null, 0]);
      await ctxL.close();
    }
    // 13528A4-010: app-brede review
    eis('Week pas vanaf 14 dagen: 13 dagen per dag Week grijs, 14 dagen te kiezen (010/017)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], t = todayUTCDate(), uit = [];
      for(const n of [13, 14]){ const d = {}; for(let i = 0; i < n; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - n + 1 + i); d[dateToKey(x)] = 80 + i*0.01; }
        dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; __zetKaart('standard'); await renderDataView(); uit.push(!!(window.lastChartStats.patroon && window.lastChartStats.patroon.weekdag)); }
      [dataCache.g, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), [false, true]);
    for(const breed of [360, 300]){
      await p.setViewportSize({width: breed, height: 740}); await wacht(150);
      eis(`${breed} breed: de tabel Patroon past ook bij een kilometerstand rond 120.000 (0 decimalen, Maand) en bij 12.345,67 (2 decimalen, Weekdag) (010)`, await p.evaluate(async () => {
        const oud = [dataCache.g, dataPeriodFilter, bronnen[0].decimalen], t = todayUTCDate(), uit = [];
        for(const [basis, dec, keus] of [[120000, 0, 'maand'], [12345.67, 2, 'weekdag']]){
          const d = {}; for(let i = 0; i < 800; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 799 + i); d[dateToKey(x)] = Math.round((basis + 40*i + ((i*7919) % 13)*3.37)*100)/100; }
          bronnen[0].decimalen = dec; dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'all'; dataAggMode = 'd'; __zetKaart('standard'); await renderDataView();
          window.chartSwipeJustHappened = false; openChartStatsModal(); setStatsTab(keus === 'weekdag' ? 'week' : 'jaar');
          const box = document.querySelector('#chart-stats-modal-overlay .modal-box'), tab = document.getElementById('chart-stats-table-patroon');
          uit.push(tab.getBoundingClientRect().right <= box.getBoundingClientRect().right - parseFloat(getComputedStyle(box).paddingRight) + 0.5 && box.scrollWidth <= box.clientWidth + 1);
          closeChartStatsModal(); }
        [dataCache.g, dataPeriodFilter, bronnen[0].decimalen] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), [true, true]);
    }
    eis('300 breed: de gekleurde kop past in het venster (marge −14, niets breder dan het venster) (010)', await p.evaluate(() => {
      window.chartSwipeJustHappened = false; openChartStatsModal();
      const kop = getComputedStyle(document.getElementById('chart-stats-kop')), box = document.querySelector('#chart-stats-modal-overlay .modal-box');
      const uit = [kop.marginLeft, box.scrollWidth <= box.clientWidth + 1]; closeChartStatsModal(); return uit; }), ['-14px', true]);
    await p.setViewportSize({width: 360, height: 740}); await wacht(150);
    // 13528A4-011: review 010
    eis('run-regels: het label "7 < x̄" staat gecentreerd boven het midden van de run (011; in 010 een halve labelbreedte te ver naar links)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], t = todayUTCDate(), d = {};
      for(let i = 0; i < 30; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 29 + i); d[dateToKey(x)] = 80 + (i >= 10 && i < 20 ? 0.3 : (i % 2 ? 0.3 : -0.3)); }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; __zetKaart('standard'); zetLaag('run', true);
      const P = CanvasRenderingContext2D.prototype, echt = {f: P.fillText, m: P.moveTo, l: P.lineTo}, lijn = [], tekst = [];
      P.fillText = function(tk, x, y){ if(/^\d+ [<>] [x̄ŷ]/.test(tk)) tekst.push([x, this.measureText(tk).width]); return echt.f.apply(this, arguments); };
      P.moveTo = function(x, y){ if(Math.abs(this.lineWidth - 3.2) < 1e-3) lijn.push(x); return echt.m.apply(this, arguments); };
      P.lineTo = function(x, y){ if(Math.abs(this.lineWidth - 3.2) < 1e-3) lijn.push(x); return echt.l.apply(this, arguments); };
      try{ await renderDataView(true); } finally { P.fillText = echt.f; P.moveTo = echt.m; P.lineTo = echt.l; }
      zetLaag('run', false); [dataCache.g, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView();
      if(tekst.length !== 1 || lijn.length !== 2) return ['labels ' + tekst.length + ', lijnstukken ' + lijn.length];
      return [Math.abs(tekst[0][0] + tekst[0][1]/2 - (lijn[0] + lijn[1])/2) < 1]; }), [true]);
    // 13528A4-012: decimalen in het Analyse-venster: hooguit zeven cijfers
    for(const breed of [300, 320, 360, 420]){
      await p.setViewportSize({width: breed, height: 740}); await wacht(150);
      eis(`${breed} breed, met duizendtal-komma's: Analyse bij 84,37 / 123.456,78 / 1.234.567,89 / net onder 100.000 / net onder 1 mln / ±500.000 (2 decimalen): x̄ met 2 / 1 / 0 / 1 / 0 / 0 decimalen, en in elke tab past elke tabel (012/013/016)`, await p.evaluate(async () => {
        const oud = [dataCache.g, dataPeriodFilter, bronnen[0].decimalen, chartViewMode, bronnen[0].duizendtal], t = todayUTCDate(), uit = [];
        bronnen[0].duizendtal = true;
        for(const basis of [84.37, 123456.78, 1234567.89, 99000.37, 990000.4, -1]){
          const d = {}; for(let i = 0; i < 800; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 799 + i); const w = (x.getUTCDay() + 6) % 7;
            /* -1: om en om ±500.000, met grenzen rond ±1,5 mln (016: het label Doel·bereik mag op twee regels) */
            d[dateToKey(x)] = basis < 0 ? Math.round(((i % 2 ? 1 : -1)*5e5*(0.9 + 0.1*(((i*7919) % 13)/13)))*100)/100 : Math.round((basis*(1 + 0.00002*i) + basis*0.015*(w === 0 ? -1 : w === 5 ? 0.8 : 0) + basis*0.008*(((i*7919) % 13)/13 - 0.5))*100)/100; }
          bronnen[0].decimalen = 2; dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'all'; dataAggMode = 'd';
          let goed = true, xbar = '';
          for(const [weergave, tabs] of [['standard', ['stats', 'chart', 'week']], ['regressie', ['stats', 'regressie']]]){
            chartViewMode = weergave; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal();
            const box = document.querySelector('#chart-stats-modal-overlay .modal-box'), ruimte = box.clientWidth - 2*parseFloat(getComputedStyle(box).paddingRight);
            for(const tab of tabs){ setStatsTab(tab);
              const tabel = document.getElementById('chart-stats-table-' + (tab === 'week' ? 'patroon' : tab)); tabel.style.width = 'min-content';
              const nodig = tabel.getBoundingClientRect().width; tabel.style.width = '100%';
              if(nodig > ruimte + 0.5) goed = false; }
            if(weergave === 'standard'){ setStatsTab('stats'); xbar = document.querySelector('#chart-stats-modal-body strong').textContent; }
            if(box.scrollWidth > box.clientWidth + 1) goed = false;
            closeChartStatsModal(); }
          uit.push((xbar.split('.')[1] || '').length, goed); }
        [dataCache.g, dataPeriodFilter, bronnen[0].decimalen, chartViewMode, bronnen[0].duizendtal] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), [2, true, 1, true, 0, true, 1, true, 0, true, 0, true]);
    }
    await p.setViewportSize({width: 360, height: 740}); await wacht(150);
    eis('een afwijking van 0,04 bij 1 decimaal (in beeld 0.0 of +0.0): hooguit een klein balkje (≤ 3 van 31 px), niet 25 px (011)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], t = todayUTCDate(), d = {};
      for(let i = 0; i < 28; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 27 + i); d[dateToKey(x)] = 80 + (((x.getUTCDay() + 6) % 7) === 0 ? 0.04 : 0); }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; __zetKaart('standard'); await renderDataView();
      window.chartSwipeJustHappened = false; openChartStatsModal(); setStatsTab('week');
      const breedtes = [...document.querySelectorAll('#chart-stats-modal-body-patroon .wd-balk span[style*="border-radius"]')].map(e => parseFloat(e.style.width));
      closeChartStatsModal(); [dataCache.g, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView();
      return [breedtes.length === 7, Math.max(...breedtes) <= 3]; }), [true, true]);
    await wacht(150);
    const wd91 = await p.evaluate(async () => {
      const oud = dataCache.g, d = {}, t = todayUTCDate();
      /* ruis uit een vaste reeks (009: een sinus is geen ruis, die geeft de weekdagen een eigen patroon) */
      let zaad = 12345; const rnd = () => (zaad = (zaad*1103515245 + 12345) % 2147483648)/2147483648;
      for(let i = 0; i < 91; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 90 + i); const w = (x.getUTCDay() + 6) % 7;
        d[dateToKey(x)] = Math.round((84 + (w === 0 ? 0.3 : 0) + (rnd() - 0.5)*0.3 - 0.01*i)*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '3m'; __zetKaart('standard'); await renderDataView();   /* 017: Week alleen bij x̄±σ, de trend telt toch niet mee */
      window.chartSwipeJustHappened = false; openChartStatsModal(); setStatsTab('week');
      const rijen = [...document.querySelectorAll('#chart-stats-modal-body-patroon tr')].slice(0, 7);
      const kleuren = rijen.map(r => getComputedStyle(r.querySelector('.wd-deel') || r.querySelector('.wd-balk span:last-child')).backgroundColor);
      const uit = [rijen[0].cells[0].textContent, kleuren[0], kleuren.slice(1).every(k => k === 'rgb(93, 107, 115)'), !document.querySelector('.wd-noot'),
        document.getElementById('chart-stats-table-patroon').style.visibility];
      closeChartStatsModal(); dataCache = {g: oud}; bumpDataVersion('g'); dataPeriodFilter = '1m'; __zetKaart('standard'); await renderDataView(); return uit; });
    eis('91 dagen, maandag 0,3 zwaarder, met een dalende trend: in x̄±σ, rond de trendlijn, alleen maandag buiten de grens (in de kleur van de kaart), de rest grijs',
        wd91, ['ma', 'rgb(79, 209, 197)', true, true, 'visible']);
    await wacht(200);
    await p.setViewportSize({width: 300, height: 700}); await wacht(200);
    eis('300 breed: de vier tabs van x̄±σ (Statistieken, Kaart, Week, Jaar) passen in hun knop, de tabel Week en in Regressie de tabel Regressie in het venster (017)', await p.evaluate(async () => {
      const past = sel => [...document.querySelectorAll(sel)].filter(b => b.style.display !== 'none').map(b => b.scrollWidth <= b.clientWidth + 1);
      const box = () => document.querySelector('#chart-stats-modal-overlay .modal-box').getBoundingClientRect().right + 0.5;
      __zetKaart('standard'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal();
      const r = past('#chart-stats-tabs button'); setStatsTab('week');
      const wdPast = document.getElementById('chart-stats-table-patroon').getBoundingClientRect().right <= box(); closeChartStatsModal();
      __zetKaart('regressie'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal();
      const regPast = document.getElementById('chart-stats-table-regressie').getBoundingClientRect().right <= box();
      closeChartStatsModal(); __zetKaart('standard'); await renderDataView(); return [r.length, r.every(Boolean), wdPast, regPast]; }), [4, true, true, true]);
    await p.setViewportSize({width: 360, height: 740}); await wacht(200);
    // drie jaar, licht dalend, met een seizoen: per maand, ook in x̄±σ rond de trendlijn (00C)
    const seizoen = await p.evaluate(async () => {
      const oud = dataCache.g, d = {}, t = todayUTCDate();
      for(let i = 0; i < 365*3; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 365*3 + 1 + i); const m = x.getUTCMonth();
        d[dateToKey(x)] = Math.round((84 - 0.002*i + (m === 0 || m === 1 ? 0.8 : m === 6 || m === 7 ? -0.8 : 0) + 0.1*Math.sin(i*1.3))*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'all'; dataAggMode = 'm'; __zetKaart('standard'); await renderDataView();
      const lees = (keus) => { window.chartSwipeJustHappened = false; openChartStatsModal(); setStatsTab(keus === 'weekdag' ? 'week' : 'jaar');
        const rijen = [...document.querySelectorAll('#chart-stats-modal-body-patroon tr')].filter(tr => tr.cells.length === 3);
        const r = rijen.map(tr => tr.cells[0].textContent + ' ' + tr.cells[2].textContent);
        const kl = rijen.map(tr => getComputedStyle(tr.querySelector('.wd-deel') || tr.querySelector('.wd-balk span:last-child') || r.querySelector('.wd-balk span:last-child')).backgroundColor);
        const pt = window.lastChartStats.patroon, lijn = Array.isArray(pt.__mid) && pt.__mid.length === pt.dagen.length;
        closeChartStatsModal(); return [r, !document.querySelector('.wd-noot'), kl, lijn]; };
      const m = lees('maand');
      dataCache = {g: oud}; bumpDataVersion('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; await renderDataView();
      const getal = t => parseFloat(t.split(' ')[1]);
      return [m[0].length, m[0][0].startsWith('jan') && getal(m[0][0]) > 0.6, m[0][6].startsWith('jul') && getal(m[0][6]) < -0.6, m[1],
              m[2][0] !== 'rgb(93, 107, 115)' && m[2][6] !== 'rgb(93, 107, 115)', m[3]]; });
    eis('drie jaar, dalend, per maand in x̄±σ: januari hoger en juli lager, allebei gekleurd, rond de trendlijn (een waarde per dag) (00C; in 00B rond x̄ alles grijs)', seizoen, [12, true, true, true, true, true]);
    await wacht(200);
    const stipStand = () => p.evaluate(() => { const e = document.getElementById('weergave-stipjes'), c = document.getElementById('data-chart-canvas');
      return [Math.round(e.getBoundingClientRect().top - c.getBoundingClientRect().bottom), Math.round(e.getBoundingClientRect().height),
              getComputedStyle(e.querySelector('.stip-naam')).color, !!e.querySelector('.stip-naam .xstreep')]; });
    const basis = await stipStand();
    eis('de naam van de basiskaart in de kleur van x̄, met een streep boven de x (030)', basis.slice(2), ['rgb(79, 209, 197)', true]);
    eis('de streep staat vlak boven de x, niet bovenaan de regel (031)', await p.evaluate(() => {
      const x = document.querySelector('#weergave-stipjes .xstreep'); const st = getComputedStyle(x, '::before');
      return [st.position, parseFloat(st.top) > 0 && parseFloat(st.top) < 2 ? 'vlak boven' : st.top, x.getBoundingClientRect().top - document.getElementById('data-chart-canvas').getBoundingClientRect().bottom >= 6]; }), ['absolute', 'vlak boven', true]);
    await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(); }); await wacht(100);
    const trend = await stipStand();
    eis('de stipjes staan bij elke weergave even ver onder de grafiek en even hoog (030)', trend.slice(0, 2), basis.slice(0, 2));
    await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(); }); await wacht(100);
    eis('en de kop is paars (waarden en het label Regressie)', (await pixels(OUDROZE, true)) > 150, true);
    // 13528A1-005: in de kop van alle drie de trendweergaven alleen de helling vet en roze
    eis('kop van Regressie, Regressie XmR en Prognose: alleen de helling vet en roze', await p.evaluate(async () => {
      const echt = CanvasRenderingContext2D.prototype.fillText, uit = {};
      const was = [chartViewMode, bronnen[0].doel_x];
      bronnen[0].doel_x = 70;   /* een doel onder de dalende lijn: dan is er een prognose */
      try {
        for(const w of ['regressie', 'regressieXmr', 'prognose']){
          const log = [];
          CanvasRenderingContext2D.prototype.fillText = function(t, x, y){ if(y < 40) log.push([t, /700|bold/.test(this.font), this.fillStyle]); return echt.apply(this, arguments); };
          __zetKaart(w); await renderDataView();
          CanvasRenderingContext2D.prototype.fillText = echt;
          uit[w] = (effectieveWeergave() === w ? '' : 'getekend als ' + effectieveWeergave() + ': ') + log.filter(([t, vet]) => vet).map(([t, vet, k]) => k).join();
          uit[w + ' r²'] = (log[log.findIndex(([t]) => t === 'r²=') + 1] || []).slice(1).join();
        }
      } finally { CanvasRenderingContext2D.prototype.fillText = echt; __zetKaart('regressie'); chartViewMode = was[0]; bronnen[0].doel_x = was[1]; await renderDataView(); }
      return uit;
    }), {regressie: '#d19ac0', 'regressie r²': 'false,#e7edf0', regressieXmr: '#d19ac0', 'regressieXmr r²': 'false,#e7edf0', prognose: '#d19ac0', 'prognose r²': 'false,#e7edf0'});
    // 13528A1-004: in de kop alleen de helling roze; r² is een getal en wit
    eis('kop: de helling roze, r² wit', await p.evaluate(() => { const c = document.getElementById('data-chart-canvas'), x = c.getContext('2d'), h = Math.round(30*(window.devicePixelRatio||1));
      const tel = (van, tot) => { const d = x.getImageData(Math.round(c.width*van), 0, Math.round(c.width*(tot-van)), h).data; let n = 0;
        for(let i = 0; i < d.length; i += 4) if(Math.abs(d[i]-209) < 12 && Math.abs(d[i+1]-154) < 12 && Math.abs(d[i+2]-192) < 12) n++; return n; };
      return [tel(0.3, 0.6) > 100, tel(0.7, 0.9)]; }), [true, 0]);
    eis('alle punten op de lijn: de grenzen vallen samen met de lijn en worden niet getekend', await pixels(ROOD), 0);
    // RB. Analyse opent op de tab Regressie, met alleen wat bij de lijn hoort
    await p.evaluate(() => { window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    eis('Analyse: zonder de tab Kaart (de regelgrenzen staan niet in de grafiek), en zonder Week en Jaar (017)', await p.evaluate(() =>
      [...document.querySelectorAll('#chart-stats-tabs button')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.stattab)), ['stats', 'regressie']);
    eis('Analyse: de tab Regressie staat er en is open', await p.evaluate(() => {
      const t = document.getElementById('chart-stats-tab-regressie');
      return [getComputedStyle(t).display !== 'none', t.classList.contains('active'),
              getComputedStyle(document.getElementById('chart-stats-table-regressie')).visibility,
              getComputedStyle(document.getElementById('chart-stats-table-stats')).visibility]; }), [true, true, 'visible', 'hidden']);
    eis('met helling, Δ, lijn, r, r², spreiding en doel', await p.evaluate(() =>
      [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].map(r => [...r.cells].map(c => c.textContent.trim()).join(' '))),
      ['n 20 / 31', 'Helling -0.70\u00a0/\u00a0wk', 'Marge ±\u00a00.00', 'Δ -1.9', 'Lijn begin 85.0', 'Lijn eind 83.1', 'r -1.00', 'r² 1.00', 'σ rond lijn 0.0', 'Lijn ± 3σ ±\u00a00.0', 'Lijn ± 2σ ±\u00a00.0', 'Doel –', '… bereikt –', '… vanaf –', '… tot –']);
    // 13528A1-003: de kleur van elke waarde past bij wat de grafiek toont
    const kl003 = (id) => p.evaluate(id => Object.fromEntries([...document.querySelectorAll('#' + id + ' tr')].map(r =>
      [r.cells[0].textContent.trim(), getComputedStyle(r.cells[1]).color])), id);
    const RZ3 = 'rgb(209, 154, 192)', WIT = 'rgb(231, 237, 240)', RD = 'rgb(239, 91, 91)', OR = 'rgb(240, 168, 79)';
    const reg3 = await kl003('chart-stats-modal-body-regressie');
    eis('Regressie: helling, lijn begin en eind oudroze; marge, Δ, r en σ wit; banden rood en oranje; geen doel: wit (004)',
        [reg3['Helling'], reg3['Marge'], reg3['Δ'], reg3['Lijn begin'], reg3['Lijn eind'], reg3['r'], reg3['r²'], reg3['σ rond lijn'], reg3['Lijn ± 3σ'], reg3['Lijn ± 2σ'], reg3['Doel'], reg3['… bereikt'], reg3['… vanaf'], reg3['… tot'], reg3['n']],
        [RZ3, WIT, WIT, RZ3, RZ3, WIT, WIT, WIT, RD, OR, WIT, WIT, WIT, WIT, WIT]);
    eis('Statistieken bij regressie: x̄ wit, want er is geen gemiddelde lijn', Object.values(await kl003('chart-stats-modal-body'))[1], WIT);
    eis('de kop in een tint van oudroze en de actieve tab in oudroze (034)', await p.evaluate(() => [getComputedStyle(document.getElementById('chart-stats-kop')).backgroundColor,
      getComputedStyle(document.querySelector('#chart-stats-tabs button.active')).backgroundColor]), ['rgba(209, 154, 192, 0.16)', 'rgb(209, 154, 192)']);
    eis('de titel van Analyse is Regressie, in oudroze (033)', await p.evaluate(() => { const b = document.getElementById('chart-stats-titel'); return [b.textContent, getComputedStyle(b).color]; }), ['Regressie', 'rgb(209, 154, 192)']);
    await p.evaluate(() => closeChartStatsModal());
    // 13528A1-003: in de gewone kaart x̄ turquoise; Doel lavendel met een waarde, anders een witte –
    await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    const std3 = await kl003('chart-stats-modal-body'), kaart3 = await kl003('chart-stats-modal-body-chart');
    eis('gewone kaart: x̄ turquoise, geen doel: witte –', [Object.values(std3)[1], kaart3['Doel'], kaart3['Doel·min']], ['rgb(79, 209, 197)', WIT, WIT]);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    await p.evaluate(async () => { __zetKaart('range'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    const rng3 = await kl003('chart-stats-modal-body-chart');
    eis('Range: UCL rood, UWL en LWL zonder waarde een witte –', [rng3['UCL(3.267×r)'] || Object.values(rng3)[0], Object.values(rng3)[1], Object.values(rng3)[2]], [RD, WIT, WIT]);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); }); await wacht(100);
    await p.evaluate(async () => { bronnen[0].doel_x = 80; bronnen[0].doel_r = 2; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    const kaart23 = await kl003('chart-stats-modal-body-chart');
    eis('met een doel: lavendel', [kaart23['Doel'], kaart23['Doel·bereik']], ['rgb(180, 142, 240)', 'rgb(180, 142, 240)']);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    await p.evaluate(async () => { delete bronnen[0].doel_x; delete bronnen[0].doel_r; __zetKaart('regressie'); await renderDataView(); }); await wacht(100);
    // RC. terug naar standaard: geen derde tab meer, en het label weer blauw
    await p.evaluate(async () => { __zetKaart('xmr'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    eis('in een andere weergave de tab Kaart weer terug (en Week en Jaar)', await p.evaluate(() =>
      [...document.querySelectorAll('#chart-stats-tabs button')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.stattab)), ['stats', 'chart', 'week', 'jaar']);
    eis('in XmR geen tab Regressie, Statistieken open, en het label turquoise zoals x̄±σ (032)', await p.evaluate(() =>
      [getComputedStyle(document.getElementById('chart-stats-tab-regressie')).display, document.querySelector('#chart-stats-tabs button.active').dataset.stattab,
       getComputedStyle(document.getElementById('chart-stats-titel')).color, getComputedStyle(document.querySelector('#weergave-stipjes .stip-naam')).color]), ['none', 'stats', 'rgb(79, 209, 197)', 'rgb(79, 209, 197)']);
    await p.evaluate(() => closeChartStatsModal());
    // RC2. met spreiding rond de lijn: grenzen op 2σ en 3σ die met de lijn meelopen
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate(); const ruis = [0.3, -0.2, 0.1, -0.3, 0.2, 0, -0.1, 0.25, -0.25, 0.15];
      for(let i = 0; i < 20; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 19 + i); d[dateToKey(x)] = Math.round((85 - 0.1*i + ruis[i % 10])*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('regressie'); await renderDataView();
    }); await wacht(200);
    eis('trendkaart: rode en oranje grenzen rond de lijn', [(await pixels(ROOD)) > 100, (await pixels([240, 168, 79])) > 100], [true, true]);
    eis('en de spreiding rond de lijn is uitgerekend', await p.evaluate(() => window.lastChartStats.regressie.sRes > 0.1), true);
    // RE. de tabel kleurt in de trendkaart naar de lijn, net als de punten (review 026)
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate(); const ruis = [0.1, -0.1, 0.05, -0.05, 0, 0.1, -0.1, 0.05, -0.05, 0];
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - i/3 + ruis[i % 10] + (i === 15 ? 1.5 : 0))*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView();
    }); await wacht(200);
    const tabelKleuren = () => p.evaluate(() => [...document.querySelectorAll('#data-table-body td.val')].map(td => td.style.color).filter(Boolean));
    const std = await tabelKleuren();
    eis('standaard: een uitschieter boven de lijn, midden in een steile trend, valt niet op (naar het gemiddelde)', std.filter(c => /danger|warn/.test(c)), []);
    await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(); }); await wacht(200);
    eis('trendkaart: in de tabel wordt hij rood, net als het punt in de grafiek', (await tabelKleuren()).filter(c => /danger|warn/.test(c)), ['var(--danger)']);
    // RF. per week en per maand: de helling per groep, zonder fouten
    for(const [agg, periode, eenheid] of [['w', '3m', 'wk'], ['m', '1y', 'mnd']]){
      await p.evaluate(async ([agg, periode]) => {
        const d = {}; const t = todayUTCDate();
        for(let i = 0; i < 365; i += 2){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 364 + i); d[dateToKey(x)] = Math.round((95 - i/30 + (i % 7)/10)*10)/10; }
        dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = agg; dataPeriodFilter = periode; __zetKaart('regressie'); await renderDataView();
      }, [agg, periode]); await wacht(200);
      eis('regressie ' + (agg === 'w' ? 'per week' : 'per maand') + ': helling per ' + eenheid + ', dalend, met de lijn op de grafiek',
          [await p.evaluate(() => { const r = window.lastChartStats.regressie; return r && [r.eenheid, r.hellingPer < 0]; }), (await pixels(OUDROZE)) > 200], [[eenheid, true], true]);
    }
    await p.evaluate(() => { dataAggMode = 'd'; dataPeriodFilter = '1m'; });
    // RG. vier punten: wel een lijn, nog geen grenzen
    await p.evaluate(async () => { const d = {}; const t = todayUTCDate(); [80, 80.6, 79.9, 80.9].forEach((v, i) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - 3 + i); d[dateToKey(x)] = v; });
      dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('regressie'); await renderDataView(); }); await wacht(200);
    eis('vier punten: een lijn, maar nog geen grenzen', [(await pixels(OUDROZE)) > 100, await pixels(ROOD)], [true, 0]);
    // RH. 1352898-027: XmR-grenzen rond de lijn en de prognose
    await p.evaluate(async () => {
      bronnen[0].doel_x = 80;
      const d = {}; const t = todayUTCDate(); const ruis = [0.1, -0.1, 0.05, -0.05, 0, 0.1, -0.1, 0.05, -0.05, 0];
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - 0.1*i + ruis[i % 10])*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1m'; __zetKaart('regressie'); await renderDataView();
    }); await wacht(200);
    eis('een bron met doel en een dalende trend: de prognose staat achteraan in de veegvolgorde',
        await p.evaluate(() => grafiekWeergaven().join()), 'standard,range,regressie,prognose');
    await p.evaluate(async () => { __zetKaart('regressieXmr'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(150);
    eis('ŷ XmR: in Analyse voluit Regressie XmR, en in Analyse m̄R en de XmR-grenzen', await p.evaluate(() => [document.getElementById('chart-stats-titel').textContent,
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr td:first-child')].map(td => td.textContent.trim()).filter(t => /rond lijn|Lijn ±/.test(t))]),
        ['Regressie XmR (ŷ±mR)', ['mR rond lijn', 'Lijn ± 2.66mR', 'Lijn ± 1.77mR']]);
    eis('met grenzen op de grafiek', (await pixels(ROOD)) > 100, true);
    await p.evaluate(() => closeChartStatsModal());
    await p.evaluate(async () => { dataAggMode = 'w'; await renderDataView(); });
    eis('per week ook de XmR-variant van de trend (13528F4-001)', await p.evaluate(() => window.lastChartStats.chartMode), 'regressieXmr');
    await p.evaluate(async () => { dataAggMode = 'd'; __zetKaart('prognose'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(150);
    const verwacht = await p.evaluate(() => { const r = window.lastChartStats.regressie; return fmtDateNL(dateToKey(new Date(Math.ceil((r.t0 + (80 - r.snijpunt)/r.helling*864e5)/864e5)*864e5))); });
    eis('Prognose: het label (voluit, met ŷ→⊙), de datum in Analyse, geen grenzen en geen gekleurde rijen', await p.evaluate(() => [document.getElementById('chart-stats-titel').textContent,
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].map(r => r.cells[0].textContent.trim() + ' ' + r.cells[1].textContent.trim()).find(t => /^… bereikt/.test(t)),
        [...document.querySelectorAll('#data-table-body td.val')].map(td => td.style.color).filter(c => /danger|warn/.test(c)).length]),
        ['Prognose (ŷ→⊙)', '… bereikt ' + verwacht, 0]);
    eis('geen grenzen in de prognose, en het doel wordt na vandaag bereikt', [await pixels(ROOD), await p.evaluate(() => window.lastChartStats.prognose > todayUTCDate())], [0, true]);
    await p.evaluate(() => closeChartStatsModal());
    // RH2. review 027: de prognose per week loopt naar rechts door, tot het doel
    const pixelsRechts = (rgb, vanaf) => p.evaluate(([rgb, vanaf]) => {
      const c = document.getElementById('data-chart-canvas'), x = c.getContext('2d'), x0 = Math.round(c.width*vanaf);
      const d = x.getImageData(x0, 0, c.width - x0, c.height).data; let n = 0;
      for(let i = 0; i < d.length; i += 4) if(Math.abs(d[i]-rgb[0]) < 12 && Math.abs(d[i+1]-rgb[1]) < 12 && Math.abs(d[i+2]-rgb[2]) < 12) n++;
      return n; }, [rgb, vanaf]);
    await p.evaluate(async () => {
      bronnen[0].doel_x = 80; const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 91; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 90 + i); d[dateToKey(x)] = Math.round((90 - 0.04*i + [0.1, -0.1, 0.05][i % 3])*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'w'; dataPeriodFilter = '3m'; __zetKaart('prognose'); await renderDataView();
    }); await wacht(200);
    const pw = await p.evaluate(() => { const s = window.lastChartStats; return [s.chartMode, s.regressie.xProg > s.regressie.xEind + 1, s.prognose > todayUTCDate()]; });
    eis('prognose per week: het doel ligt na de laatste week', pw, ['prognose', true, true]);
    // review 006: het ringetje vooruit per week precies op xProg (de punten staan op de groepen)
    eis('prognose per week: het ringetje precies op het snijpunt voorbij de laatste week', await p.evaluate(async () => {
      const C = CanvasRenderingContext2D.prototype, arc = C.arc; let ring = null; const pt = [];
      C.arc = function(x, y, r){ if(Math.abs(r - 4.5) < 0.01) ring = x; else if(r > 1.5 && r < 4.4) pt.push(Math.round(x*100)/100); return arc.apply(this, arguments); };
      try { await renderDataView(); } finally { C.arc = arc; }
      const sel = await getChartPointsForSelection();
      const pts = aggregatePoints(sel.points, 'w');
      const xmin = new Date(Math.min(sel.chartXMin.getTime(), pts[0].date.getTime())), xmax = new Date(Math.max(sel.rangeEnd.getTime(), pts[pts.length-1].date.getTime()));
      const k0 = fillAggregationGaps(pts, 'w', xmin, xmax).findIndex(sl => sl.date.getTime() === pts[0].date.getTime());
      const u = [...new Set(pt)].sort((a, b) => a - b), stap = u[1] - u[0];
      /* zelf uitgerekend uit de lijn en het doel, niet overgenomen uit de app (review 006) */
      const g = window.lastChartStats.regressie, xs = (bronnen[0].doel_x - g.snijpunt)/g.helling;
      return ring !== null && Math.abs(ring - (u[0] + (xs - k0)*stap)) < 1; }), true);
    eis('en de stippellijn en het ringetje staan rechts, voorbij de metingen', (await pixelsRechts([180, 142, 240], 0.85)) > 0 && (await pixelsRechts(OUDROZE, 0.7)) > 0, true);
    const onderRechts = rgb => p.evaluate(rgb => {
      const c = document.getElementById('data-chart-canvas'), x = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
      const d = x.getImageData(Math.round(c.width*0.6), Math.round((220-36)*dpr), Math.round(c.width*0.4), Math.round(36*dpr)).data; let n = 0;
      for(let i = 0; i < d.length; i += 4) if(Math.abs(d[i]-rgb[0]) < 12 && Math.abs(d[i+1]-rgb[1]) < 12 && Math.abs(d[i+2]-rgb[2]) < 12) n++;
      return n; }, rgb);
    eis('de datum van de prognose staat rechts onder de grafiek, in de kleur van de lijn', (await onderRechts(OUDROZE)) > 20, true);
    await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(); }); await wacht(150);
    eis('in de gewone trendkaart daar een gewone datum', await onderRechts(OUDROZE), 0);
    // 13528F4-001: het bereik van de prognose, als waaier en in Analyse
    {
      const waaier = () => p.evaluate(async () => {
        const C = CanvasRenderingContext2D.prototype, fill = C.fill; let n = 0;
        C.fill = function(){ if(/^rgba\(209, ?154, ?192, ?0\.13\)$/.test(String(this.fillStyle))) n++; return fill.apply(this, arguments); };
        try { await renderDataView(); } finally { C.fill = fill; } return n; });
      eis('in de gewone trendkaart geen waaier', await waaier(), 0);
      await p.evaluate(async () => { __zetKaart('prognose'); await renderDataView(); }); await wacht(150);
      eis('bij de prognose een waaier van het laatste punt naar het doel (13528F4-001)', (await waaier()) > 0, true);
      eis('het bereik volgens Fieller, zelf nagerekend door de as af te lopen; vroegst ≤ prognose ≤ laatst, vroegst niet vóór morgen (13528F4-001)', await p.evaluate(() => {
        const g = window.lastChartStats.regressie, doel = bronnen[0].doel_x, ym = g.snijpunt + g.helling*g.mx, n = g.nLijn ?? g.n;
        let lo = null, hi = null;
        for(let x = g.xEind; x <= g.xEind + 3000; x += 0.01){ const u = x - g.mx; if((doel - ym - g.helling*u)**2 <= g.marge**2*(g.sxx/n + u*u)){ if(lo === null) lo = x; hi = x; } }
        const b = g.bereik || {}, pr = window.lastChartStats.prognose, morgen = todayUTCDate().getTime() + 864e5;
        return [!!g.bereik, Math.abs(b.xVroeg - lo) < 0.02 && Math.abs(b.xLaat - hi) < 0.02, b.vroeg <= pr && pr <= b.laat, b.vroeg >= morgen]; }), [true, true, true, true]);
      eis('in Analyse: Doel, … bereikt, … vanaf, … tot onder elkaar; volledige datums, … vanaf ≤ … bereikt ≤ … tot, op één regel en oudroze (13528F4-003)', await p.evaluate(async () => {
        document.getElementById('data-chart-canvas').click(); await new Promise(r => setTimeout(r, 200));
        const rijen = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')], namen = rijen.map(r => r.cells[0].textContent.trim());
        const i = namen.indexOf('Doel'); if(i < 0){ closeChartStatsModal(); return namen; } const t = rijen.slice(i + 1, i + 4), gewoon = rijen[i].getBoundingClientRect().height;
        const dag = r => { const [d, m, j] = r.cells[1].textContent.trim().split('-').map(Number); return Date.UTC(j, m - 1, d); }, [b, v, z] = t.map(dag);
        const r = [namen.slice(i, i + 4), t.every(x => /^\d\d-\d\d-\d{4}$/.test(x.cells[1].textContent.trim())), v <= b && b <= z,
          t.every(x => getComputedStyle(x.cells[1]).color === 'rgb(209, 154, 192)'), t.every(x => x.getBoundingClientRect().height <= gewoon + 1)];
        closeChartStatsModal(); return r; }), [['Doel', '… bereikt', '… vanaf', '… tot'], true, true, true, true]);
      /* de as loopt tot net voorbij de prognose, niet tot de laatste dag van de waaier: het ringetje
         staat rechts in het grafiekvlak, de waaier loopt de grafiek uit; met een streep op het doel */
      const hoek = agg => p.evaluate(async agg => {
        /* een korte, onrustige reeks: een breed bereik, dat voorbij de as van alleen de prognose valt */
        const d = {}, t = todayUTCDate(); let s = 3; const rnd = () => { s = (s*16807) % 2147483647; return s/2147483647 - 0.5; };
        for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((84 - 0.06*i + rnd()*1.6)*10)/10; }
        dataCache = {g: d}; bumpDataVersion('g'); bronnen[0].doel_x = 81.5; dataPeriodFilter = agg === 'w' ? '3m' : '1m';
        dataAggMode = agg; __zetKaart('prognose');
        const C = CanvasRenderingContext2D.prototype, arc = C.arc, st = C.stroke; let ring = null, streep = 0;
        C.arc = function(x, y, r){ if(Math.abs(r - 4.5) < 0.01) ring = x; return arc.apply(this, arguments); };
        C.stroke = function(){ if(this.lineWidth === 3 && String(this.strokeStyle).toLowerCase() === '#d19ac0') streep++; return st.apply(this, arguments); };
        try { await renderDataView(); } finally { C.arc = arc; C.stroke = st; }
        const c = document.getElementById('data-chart-canvas'), links = 54, rechts = c.clientWidth - 16, b = window.lastChartStats.regressie?.bereik;
        return [!!b, ring !== null && ring <= rechts + 0.5 && ring >= links + (rechts - links)*0.8, b ? (b.laat - window.lastChartStats.prognose)/864e5 > 7 : null, streep > 0]; }, agg);
      eis('per dag: de as tot net voorbij de prognose, ook als de waaier veel verder loopt; een streep op het doel (13528F4-001)', await hoek('d'), [true, true, true, true]);
      eis('per week ook (13528F4-001)', await hoek('w'), [true, true, true, true]);
      await p.evaluate(async () => { dataAggMode = 'd'; }); await wacht(50);
      await p.evaluate(async () => { __zetKaart('regressie'); await renderDataView(); }); await wacht(100);
    }
    // RH3. een prognose ver weg: de metingen blijven leesbaar breed
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - 0.01*i + [0.002, -0.002][i % 2])*1000)/1000; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1m'; __zetKaart('prognose'); await renderDataView();
    }); await wacht(200);
    eis('doel jaren weg: de as loopt hooguit drie keer de periode door (punten ook voorbij 15% van de breedte)',
        [await p.evaluate(() => window.lastChartStats.prognose.getUTCFullYear() > todayUTCDate().getUTCFullYear()), (await pixelsRechts([159, 216, 224], 0.15)) > 0], [true, true]);
    await p.evaluate(() => { closeChartStatsModal(); delete bronnen[0].doel_x; });
    // RJ. geen aantoonbare trend: een vraagteken, en geen prognose in de rij
    await p.evaluate(async () => { bronnen[0].doel_x = 70; const d = {}; const t = todayUTCDate(); [80, 81, 79.5, 80.5, 80.2, 79.8, 80.6].forEach((v, i) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - 6 + i); d[dateToKey(x)] = v; });
      dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('regressie'); await renderDataView(); });
    eis('schommelen zonder trend: niet aantoonbaar, en geen prognose', await p.evaluate(() => [window.lastChartStats.regressie.aantoonbaar, grafiekWeergaven().includes('prognose')]), [false, false]);
    // RK. een doel buiten de schaal: geen lijn door de datums onder de grafiek
    await p.evaluate(async () => { bronnen[0].doel_x = 60; __zetKaart('regressie'); await renderDataView(); }); await wacht(150);
    /* sinds 01C staat een doel zonder bereik in beeld zolang de laag Doel aan staat; uit: niet getekend */
    eis('een doel ver onder de metingen: met Doel aan binnen de schaal en getekend, maar niet door de datums onder de grafiek (01C/01D)',
        [await p.evaluate(() => { const s = document.getElementById('data-chart-canvas').__schaal; return s[0] < 60 && s[1] > 60; }), (await pixels([180, 142, 240])) > 20, await onderRechts([180, 142, 240])], [true, true, 0]);
    await p.evaluate(async () => { vergeetLaag('doel', bronnen[0].id); });
    await p.evaluate(() => { delete bronnen[0].doel_x; });
    // RL. review 029: een prognose die al voorbij is, telt niet; Prog valt dan terug naar Regr.
    // Het doel (77) wordt na de laatste meting en vóór vandaag geraakt: niet binnen de metingen (006).
    await p.evaluate(async () => {
      bronnen[0].doel_x = 77; const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 40; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 80 + i); d[dateToKey(x)] = Math.round((84 - 0.15*i + [0.1, -0.1][i % 2])*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '3m'; __zetKaart('prognose'); await renderDataView();
    }); await wacht(300);
    eis('het doel zou (volgens de lijn) tussen de laatste meting en vandaag bereikt zijn: geen prognose, terug naar Regr',
        await p.evaluate(() => [window.lastChartStats.prognose, chartViewMode, grafiekWeergaven().includes('prognose')]), [null, 'regressie', false]);
    // review 029: de gekozen rij blijft gekozen als Prog terugvalt naar Regr
    await p.evaluate(async () => { const k = Object.keys(dataCache.g).sort().pop(); selectedDataKey = k; window.__gekozen = k; __zetKaart('prognose'); await renderDataView(true); });
    await wacht(300);
    eis('na de terugval naar Regr is de gekozen rij nog gekozen', await p.evaluate(() => [chartViewMode, selectedDataKey === window.__gekozen]), ['regressie', true]);
    // 006: het doel al binnen de metingen gekruist: wel een prognose, met het ringetje op het
    // snijpunt, de datum eronder, geen stippellijn, en een asdatum die botst valt weg
    const tekening = () => p.evaluate(async () => {
      const C = CanvasRenderingContext2D.prototype, ft = C.fillText, arc = C.arc, lt = C.lineTo, log = {tekst: [], ring: null, stippel: 0};
      C.fillText = function(t, x, y){ log.tekst.push([String(t), Math.round(x), this.textAlign, this.fillStyle]); return ft.apply(this, arguments); };
      log.punten = [];
      C.arc = function(x, y, r){ if(Math.abs(r - 4.5) < 0.01) log.ring = [x, y]; else if(r > 1.5 && r < 4.4) log.punten.push(x); return arc.apply(this, arguments); };
      C.lineTo = function(){ if(this.getLineDash().join() === '2,4') log.stippel++; return lt.apply(this, arguments); };
      try { await renderDataView(); } finally { C.fillText = ft; C.arc = arc; C.lineTo = lt; }
      return log;
    });
    await p.evaluate(async () => {
      bronnen[0].doel_x = 83.5; bronnen[0].doel_r = 1; const d = {}; const t = todayUTCDate();
      [84.7, 84.5, 84.5, 84.7, 83.8, 82.2, 83.3].forEach((v, i) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - 6 + i); d[dateToKey(x)] = v; });
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1w'; __zetKaart('prognose'); await renderDataView();
    }); await wacht(200);
    const st6 = await p.evaluate(() => { const s = window.lastChartStats, r = s.regressie;
      const x = (83.5 - r.snijpunt)/r.helling, verwacht = new Date(todayUTCDate().getTime() + (Math.ceil(x) - 6)*864e5);
      return [chartViewMode, grafiekWeergaven().includes('prognose'), r.doelBereikt, s.prognose ? dateToKey(s.prognose) : null, dateToKey(verwacht), s.prognose ? fmtDateNL(dateToKey(s.prognose)) : '–']; });
    eis('al bereikt: de prognose blijft, op de dag dat de lijn het doel kruiste', st6.slice(0, 4), ['prognose', true, true, st6[4]]);
    const t6 = await tekening();
    const lab6 = t6.tekst.find(([t]) => t === st6[5]);
    eis('het ringetje staat op het snijpunt, binnen de metingen, zonder stippellijn', await p.evaluate(ring => {
      const r = window.lastChartStats.regressie; return [!!ring, ring && ring[0] < document.getElementById('data-chart-canvas').clientWidth - 30]; }, t6.ring).then(x => x.concat(t6.stippel)), [true, true, 0]);
    /* het ringetje precies op het snijpunt: tussen de twee punten eromheen, naar rato (review 006) */
    const opSnijpunt = (log, x) => { const pt = [...new Set(log.punten.map(v => Math.round(v*100)/100))].sort((a, b) => a - b), i = Math.floor(x);
      if(!log.ring || i < 0 || i + 1 >= pt.length) return null; return Math.abs(log.ring[0] - (pt[i] + (x - i)*(pt[i+1] - pt[i]))) < 1; };
    eis('per dag: het ringetje precies op het snijpunt, niet op de afgeronde dag', opSnijpunt(t6, await p.evaluate(() => window.lastChartStats.regressie.xDoel)), true);
    eis('de datum staat in roze onder het ringetje', lab6 && t6.ring ? [lab6[2], lab6[3], Math.abs(lab6[1] - Math.round(t6.ring[0])) <= 1] : null, ['center', '#d19ac0', true]);
    eis('geen asdatum die over de roze datum heen valt', await p.evaluate(([tekst, lab]) => {
      const c = document.createElement('canvas').getContext('2d'); c.font = '11px ui-monospace, monospace';
      const w = t => c.measureText(t).width, links = (t, x, a) => a === 'left' ? x : a === 'right' ? x - w(t) : x - w(t)/2;
      if(!lab) return 'geen roze datum';
      const pl = links(lab[0], lab[1], 'center'), pr = pl + w(lab[0]);
      return tekst.filter(([t, , , k]) => /^\d\d-\d\d-\d{4}$/.test(t) && k === '#e7edf0').filter(([t, x, a]) => links(t, x, a) < pr && links(t, x, a) + w(t) > pl).length; }, [t6.tekst, lab6]), 0);
    /* de datum blijft binnen de grafiek: bij een ringetje vlak bij de rand schuift hij naar binnen (review 006) */
    for(const [doel, kant] of [[84.9, 'links'], [83.0, 'rechts']]){
      await p.evaluate(d => { bronnen[0].doel_x = d; }, doel);
      const tr = await tekening();
      const lab = await p.evaluate(() => window.lastChartStats.prognose && fmtDateNL(dateToKey(window.lastChartStats.prognose)));
      const l = tr.tekst.find(([t]) => t === lab);
      eis('ringetje vlak bij de rand ' + kant + ': de datum schuift naar binnen en blijft in beeld', await p.evaluate(([l, ring, kant]) => {
        if(!l || !ring) return 'geen datum of ringetje';
        const c = document.getElementById('data-chart-canvas'), x = document.createElement('canvas').getContext('2d'); x.font = '11px ui-monospace, monospace';
        const w = x.measureText(l[0]).width, links = l[1] - w/2, rechts = l[1] + w/2;
        return [kant === 'links' ? l[1] > ring[0] + 1 : l[1] < ring[0] - 1, links >= 0, rechts <= c.clientWidth]; }, [l, tr.ring, kant]), [true, true, true]);
    }
    await p.evaluate(async () => { bronnen[0].doel_x = 83.5; await renderDataView(); }); await wacht(100);
    await p.evaluate(() => { window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    eis('in Analyse: doel bereikt met die dag', await p.evaluate(() => [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].map(r => r.cells[0].textContent + ' ' + r.cells[1].textContent).find(t => /^… bereikt/.test(t))), '… bereikt ' + st6[5]);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    // ook gegroepeerd per week: het snijpunt tussen de groepen
    await p.evaluate(async () => {
      bronnen[0].doel_x = 85; const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 56; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 55 + i); d[dateToKey(x)] = Math.round((88 - 0.1*i + [0.2, -0.2, 0.1][i % 3])*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'w'; dataPeriodFilter = '3m'; __zetKaart('prognose'); await renderDataView();
    }); await wacht(200);
    const tw = await tekening();
    eis('per week: de datum binnen de groep waarin de lijn het doel raakt (niet geschat met 7 dagen per groep)', await p.evaluate(async () => {
      const sel = await getChartPointsForSelection();
      const pts = aggregatePoints(sel.points, 'w');
      const xmin = new Date(Math.min(sel.chartXMin.getTime(), pts[0].date.getTime())), xmax = new Date(Math.max(sel.rangeEnd.getTime(), pts[pts.length-1].date.getTime()));
      const g = window.lastChartStats.regressie;
      const slots = fillAggregationGaps(pts, 'w', xmin, xmax), x = (bronnen[0].doel_x - g.snijpunt)/g.helling, i = Math.floor(x);
      const a = slots[i].date.getTime(), b = slots[i+1].date.getTime();
      window.__k0 = slots.findIndex(sl => sl.date.getTime() === pts[0].date.getTime());
      return [dateToKey(window.lastChartStats.prognose), dateToKey(new Date(Math.ceil((a + (x - i)*(b - a))/864e5)*864e5))]; }).then(([k, v]) => k === v ? true : k + ' ≠ ' + v), true);
    /* de punten staan op de groepen met metingen; de as begint eerder (lege weken) */
    eis('per week: het ringetje precies op het snijpunt tussen de groepen', await p.evaluate(() => { const g = window.lastChartStats.regressie;
      return [(bronnen[0].doel_x - g.snijpunt)/g.helling, window.__k0]; }).then(([x, k0]) =>
      opSnijpunt(tw, x - k0)), true);
    eis('per week: al bereikt, het ringetje binnen de grafiek, de datum eronder, geen stippellijn', await p.evaluate(ring => {
      const s = window.lastChartStats; const lab = s.prognose && fmtDateNL(dateToKey(s.prognose));
      return [chartViewMode, s.regressie ? s.regressie.doelBereikt : null, !!ring, !!s.prognose && s.prognose < todayUTCDate(), lab]; }, tw.ring).then(x => {
        const l = tw.tekst.find(([t]) => t === x[4]); return x.slice(0, 4).concat(!!l && !!tw.ring && Math.abs(l[1] - Math.round(tw.ring[0])) <= 1, tw.stippel); }),
      ['prognose', true, true, true, true, 0]);
    await p.evaluate(async () => { bronnen[0].doel_x = 80; delete bronnen[0].doel_r; dataAggMode = 'd'; });
    // review 029: grafiek verbergen terwijl je op Prog staat: terug naar Regr, en de tabel kleurt weer
    await p.evaluate(async () => { bronnen[0].doel_x = 70; const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - 0.3*i + [0.1, -0.1, 0.05][i % 3] + (i === 15 ? 2 : 0))*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('prognose'); await renderDataView(true); await setDataShowChart(false); });
    await wacht(200);
    eis('verborgen grafiek op Prog: terug naar Regr, de tabel kleurt naar de lijn',
        await p.evaluate(() => [chartViewMode, [...document.querySelectorAll('#data-table-body td.val')].some(td => /danger|warn/.test(td.style.color))]), ['regressie', true]);
    await p.evaluate(async () => { await setDataShowChart(true); bronnen[0].doel_x = 80; });
    await p.evaluate(() => { delete bronnen[0].doel_x; });
    // RM. review 029: Analyse past op een smalle telefoon, ook daarna in de gewone kaart
    await p.setViewportSize({width: 320, height: 700});
    const past = () => p.evaluate(() => { const box = document.querySelector('#chart-stats-modal-overlay .modal-box').getBoundingClientRect();
      return [...document.querySelectorAll('#chart-stats-modal-overlay table')].every(t => t.getBoundingClientRect().right <= box.right + 0.5); });
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((1234.56 - 0.911*i + [0.4, -0.3, 0.2][i % 3])*100)/100; }
      bronnen[0].decimalen = 2; dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('regressie'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); });
    await wacht(150);
    eis('320 breed, twee decimalen: de tab Regressie past in het venster', await past(), true);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);   /* history.back eerst laten afronden */
    // 037: r en r² op één regel, ook met getallen van zes cijfers (kilometerstand) en in Regressie XmR
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((123456.78 + 41.3*i + [9.1, -7.4, 3.2][i % 3])*100)/100; }
      bronnen[0].decimalen = 2; dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('regressieXmr'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); });
    await wacht(150);
    eis('320 breed, zes cijfers, Regressie XmR: past, met r en r² elk op een eigen regel (13528F4-003)', [await past(), await p.evaluate(() =>
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr td:first-child')].map(td => td.textContent.trim()).filter(t => /^r(²|$|\u00a0\/)/.test(t)))],
      [true, ['r', 'r²']]);
    await p.evaluate(() => { closeChartStatsModal(); __zetKaart('regressie'); }); await wacht(150);
    await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); });
    await wacht(150);
    eis('en daarna past Statistieken in de gewone kaart ook (de verborgen tabel is leeg)', [await past(), await p.evaluate(() => document.getElementById('chart-stats-modal-body-regressie').innerHTML)], [true, '']);
    await p.evaluate(() => { closeChartStatsModal(); bronnen[0].decimalen = 1; });
    // RN. het label in Analyse: voluit, ingekort als het niet naast de titel past, pas dan een regel lager
    const kopLabel = (breedte, aantal) => p.evaluate(async ([aantal]) => {
      const echt = window.lastChartStats;
      window.lastChartStats = Object.assign({}, echt, {totalCount: aantal, chartMode: 'regressieXmr', regressie: null, prognose: null});
      window.chartSwipeJustHappened = false; openChartStatsModal();
      const t = document.getElementById('chart-stats-titel'), b = document.getElementById('chart-stats-shown-count'), box = document.querySelector('#chart-stats-modal-overlay .modal-box').getBoundingClientRect();
      const uit = [t.textContent, b.offsetTop <= t.offsetTop + 4, b.getBoundingClientRect().right <= box.right && t.getBoundingClientRect().right <= box.right];
      window.lastChartStats = echt; closeChartStatsModal(); return uit; }, [aantal]);
    await p.setViewportSize({width: 360, height: 740}); await wacht(100);
    eis('360 breed, klein aantal: Regressie XmR voluit naast de titel', await kopLabel(360, 120), ['Regressie XmR', true, true]); await wacht(150);
    eis('360 breed, groot aantal: voluit, met het aantal op dezelfde regel (033)', await kopLabel(360, 123456), ['Regressie XmR', true, true]); await wacht(150);
    await p.setViewportSize({width: 320, height: 700}); await wacht(100);
    eis('320 breed, groot aantal: voluit op één regel met het aantal (035)', await kopLabel(320, 123456), ['Regressie XmR', true, true]);
    eis('300 breed, zeer groot aantal: eerst ingekort tot Regr XmR (033)', (await p.setViewportSize({width: 300, height: 700}), await wacht(100), await kopLabel(300, 12345678))[0], 'Regr XmR'); await wacht(150);
    await p.setViewportSize({width: 320, height: 700}); await wacht(100); await wacht(150);
    // review 029: draaien met Analyse open past het label opnieuw
    await p.setViewportSize({width: 300, height: 700}); await wacht(100);
    await p.evaluate(() => { window.__echt = window.lastChartStats; window.lastChartStats = Object.assign({}, window.__echt, {totalCount: 12345678, chartMode: 'regressieXmr', regressie: null, prognose: null});
      window.chartSwipeJustHappened = false; openChartStatsModal(); });
    await wacht(100);
    const voor = await p.evaluate(() => document.getElementById('chart-stats-titel').textContent);
    await p.setViewportSize({width: 700, height: 360}); await wacht(200);
    eis('Analyse open, gedraaid naar breed: weer voluit', [voor, await p.evaluate(() => document.getElementById('chart-stats-titel').textContent)], ['Regr XmR', 'Regressie XmR']);
    await p.evaluate(() => { closeChartStatsModal(); window.lastChartStats = window.__echt; }); await wacht(150);
    await p.setViewportSize({width: 320, height: 700}); await wacht(100);
    await p.setViewportSize({width: 360, height: 740});
    // RD. te weinig punten: geen lijn, de kop zegt –
    await p.evaluate(async () => { const t = todayUTCDate(); dataCache = {g: {[dateToKey(t)]: 80}}; bumpDataVersion('g'); __zetKaart('regressie'); await renderDataView(); }); await wacht(200);
    eis('één punt: geen regressie en geen fout', await p.evaluate(() => [window.lastChartStats.chartMode, window.lastChartStats.regressie]), ['regressie', null]);
    await p.evaluate(async () => { __zetKaart('standard'); await renderDataView(); });
    // 038: geen blauwe pijltjes meer links en rechts van de grafiek; de stipjes eronder blijven
    await p.evaluate(async () => { const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 20; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 19 + i); d[dateToKey(x)] = 80 + (i % 3); }
      dataCache = {g: d}; bumpDataVersion('g'); __zetKaart('standard'); await renderDataView(); }); await wacht(200);
    eis('geen blauwe pijltjes aan de randen, wel de stipjes', await p.evaluate(() => {
      const c = document.getElementById('data-chart-canvas'), ctx = c.getContext('2d'), s = c.width / c.clientWidth;
      const blauw = (x) => { const d = ctx.getImageData(Math.round(x*s), 0, Math.max(1, Math.round(6*s)), c.height).data;
        for(let i = 0; i < d.length; i += 4) if(d[i] < 110 && d[i+1] > 120 && d[i+2] > 210 && d[i+3] > 200) return true; return false; };
      return [blauw(0), blauw(c.clientWidth - 6), document.querySelectorAll('#weergave-stipjes .stip').length > 1];
    }), [false, false, true]);

    // 13528A1-002: een oranje stip op Bronnen en een regel onderaan, alleen als er iets mis is
    await opzet(); await p.evaluate(() => switchToView('meta')); await wacht(100);
    const stand = () => p.evaluate(() => {
      const t = document.getElementById('tab-meta'), r = document.getElementById('bron-problemen');
      return [!!t && t.classList.contains('heeft-stip'), !!t && getComputedStyle(t, '::after').width,
              r ? (r.hidden ? '' : r.textContent) : 'geen regel'];
    });
    const sluitMelding = () => p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; if(typeof modalStack !== 'undefined') modalStack.length = 0; });
    await p.evaluate(() => { if(typeof __backupFout !== 'undefined'){ __backupFout.clear(); __kopieFout.clear(); __swProbleem = ''; __bronIssues = 0; tekenProblemen(); } });
    eis('niets mis: geen stip en geen regel onderaan Bronnen', await stand(), [false, 'auto', '']);
    eis('opslag niet vastgezet: alleen het woord nee is oranje, geen stip', await p.evaluate(() => {
      opslagVast = false; toonOpslagVast();
      const el = document.getElementById('opslag-vast'), w = el.querySelector('.oranje');
      const kleur = x => getComputedStyle(x).color;
      return [el.textContent, w ? w.textContent : null, !!w && kleur(w) !== kleur(el), document.getElementById('tab-meta').classList.contains('heeft-stip')];
    }), ['Opslag vastgezet: nee', 'nee', true, false]);
    await p.evaluate(async () => {
      window.__echtFH = dirHandle.getFileHandle;
      dirHandle.getFileHandle = async (naam, o) => { if(/_backup/.test(naam)) throw Object.assign(new Error('vol'), {name: 'QuotaExceededError'}); return window.__echtFH(naam, o); };
      await idbSet('backup:gewicht.txt', 'nooit'); await maybeBackupFile('gewicht.txt');
    }); await sluitMelding();
    eis('een mislukte backup: stip op Bronnen en een oranje regel', await stand(), [true, '9px', '\u26a0 Backup van gewicht.txt mislukt (QuotaExceededError)']);
    await p.evaluate(async () => { dirHandle.getFileHandle = window.__echtFH; await maybeBackupFile('gewicht.txt'); });
    eis('de volgende backup lukt: weer niets', await stand(), [false, 'auto', '']);
    await p.evaluate(async () => {
      window.__echtIdbSet = idbSet;
      idbSet = async (k, v) => { if(/^kopie:/.test(k)) throw Object.assign(new Error('vol'), {name: 'QuotaExceededError'}); return window.__echtIdbSet(k, v); };
      await bewaarKopieVan('gewicht.txt', '{}', true);
    });
    eis('een leeskopie die niet bij te werken is: stip en regel', await stand(), [true, '9px', '\u26a0 Leeskopie van gewicht.txt niet bijgewerkt (QuotaExceededError)']);
    await p.evaluate(async () => { idbSet = window.__echtIdbSet; await bewaarKopieVan('gewicht.txt', '{}', true); });
    eis('lukt de kopie weer: niets', await stand(), [false, 'auto', '']);
    eis('offline werken niet actief: stip en regel', await p.evaluate(async () => {
      const sw = navigator.serviceWorker, echt = sw.getRegistration;
      sw.getRegistration = async () => null;
      const r = await swControle();
      sw.getRegistration = echt; return r;
    }), 'Offline werken en updates: niet actief \u2014 sluit de app en open hem opnieuw');
    eis('en dat staat ook onderaan Bronnen', (await stand())[2], '\u26a0 Offline werken en updates: niet actief \u2014 sluit de app en open hem opnieuw');
    /* een mislukte registratie (geen bereik bij het ophalen van het script) terwijl de vorige
       worker gewoon draait: geen melding; zonder actieve worker wel, met de fout erbij */
    eis('mislukte registratie met een actieve worker: geen melding; zonder actieve worker wel', await p.evaluate(async () => {
      const sw = navigator.serviceWorker, echt = sw.getRegistration, uit = [];
      __swFout = 'TypeError: Failed to register a ServiceWorker: An unknown error occurred when fetching the script.';
      sw.getRegistration = async () => ({active: {}}); uit.push(/niet actief/.test(await swControle()));
      sw.getRegistration = async () => null; uit.push(/niet actief \u2014 TypeError/.test(await swControle()));
      sw.getRegistration = echt; __swFout = ''; __swProbleem = ''; tekenProblemen(); return uit; }), [false, true]);
    await p.evaluate(() => { __swProbleem = ''; tekenProblemen(); });
    await p.evaluate(() => renderBronValidationBanner([{titel: 'Gewicht', tekst: 'Bestand ontbreekt (gewicht.txt).'}]));
    eis('een bron met een probleem: wel de stip, de regel staat al in de banner bovenaan', await stand(), [true, '9px', '']);
    await p.evaluate(() => renderBronValidationBanner([]));
    eis('opgelost: stip weg', await stand(), [false, 'auto', '']);

    // review 006: per meting, in de Nederlandse tijd (met de overgang naar wintertijd op 25-10)
    {
      const ctxA = await browser.newContext({viewport: {width: 360, height: 740}, timezoneId: 'Europe/Amsterdam'});
      const pa = await veilig(await ctxA.newPage(), false);   /* eigen klok, verderop */ await pa.addInitScript(ZETKAART); const foutenA = []; pa.on('pageerror', e => foutenA.push(e.message));
      await pa.clock.install({time: new Date('2026-10-26T10:00:00+01:00')});
      await pa.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await pa.waitForTimeout(600);
      /* zeven dagen, elke ochtend om 07:00, precies 0,3 per dag omlaag; het doel raakt de lijn vandaag om 22:00 */
      const zet = doel => pa.evaluate(async doel => {
        document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; });
        dirHandle = {name: 'Trends', getFileHandle: async n => ({name: n, getFile: async () => ({lastModified: 1, size: 2, text: async () => '{}', arrayBuffer: async () => new TextEncoder().encode('{}').buffer})}), queryPermission: async () => 'granted', values: async function*(){}};
        leesKopieModus = false;
        bronnen = [{id: 'g', titel: 'Gewicht', bestand: 'gewicht.txt', eenheid: 'kg', decimalen: 2, meerdere_metingen: true, doel_x: doel}];
        const d = {}; for(let i = 0; i < 7; i++) d['D202610' + (20 + i) + 'T0700'] = Math.round((85 - 0.3*i)*100)/100;
        dataCache = {g: d}; bumpDataVersion('g'); renderSourceList(); renderSourceSelects(); setFileLinkUI('dir', 'linked', {name: 'Trends'});
        document.getElementById('data-source-select').value = 'g'; switchToView('data');
        dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
        dataAggMode = 'p'; dataPeriodFilter = '1w'; __zetKaart('prognose');
        const C = CanvasRenderingContext2D.prototype, arc = C.arc, ft = C.fillText; let ring = null, lab = null;
        C.arc = function(x, y, r){ if(Math.abs(r - 4.5) < 0.01) ring = x; return arc.apply(this, arguments); };
        C.fillText = function(t, x){ if(this.fillStyle === '#d19ac0' && /\d\d-\d\d-\d{4}/.test(t)) lab = String(t); return ft.apply(this, arguments); };
        try { await renderDataView(); } finally { C.arc = arc; C.fillText = ft; }
        const s = window.lastChartStats, w = document.getElementById('data-chart-canvas').clientWidth;
        return [chartViewMode, s.regressie && s.regressie.doelBereikt, s.prognose ? dateToKey(s.prognose) : null, ring !== null && ring < w - 10, lab];
      }, doel);
      eis('per meting: doel vandaag om 22:00, nu 10:00: prognose vandaag, ringetje in beeld, zonder pijl',
          await zet(Math.round((85 - 0.3*(6 + 15/24))*10000)/10000), ['prognose', false, '20261026', true, '26-10-2026']);
      const ver = await zet(60);
      eis('per meting: een doel ver weg: het ringetje buiten beeld en de datum rechts met een pijl', [ver[0], ver[3], /^→/.test(ver[4] || '')], ['prognose', false, true]);
      eis('geen fouten in de pagina (Amsterdam)', foutenA, []);
      await ctxA.close();
    }

    // 13528A3-001: op een telefoon blijft :hover na een tik hangen; na deselecteren moet een
    // regel zijn eigen achtergrond terugkrijgen. In telefoonmodus, met echte tikken.
    {
      const tc = await browser.newContext({viewport: {width: 360, height: 740}, hasTouch: true, isMobile: true});
      const tp = await veilig(await tc.newPage()); await tp.addInitScript(ZETKAART);
      await tp.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await tp.waitForTimeout(600);
      await tp.evaluate(async () => {
        document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; });
        dirHandle = {name: 'Trends', getFileHandle: async n => ({name: n, getFile: async () => ({lastModified: 1, size: 2, text: async () => '{}', arrayBuffer: async () => new TextEncoder().encode('{}').buffer})}), queryPermission: async () => 'granted', values: async function*(){}};
        leesKopieModus = false;
        bronnen = [{id: 'g', titel: 'Gewicht', bestand: 'gewicht.txt', eenheid: 'kg', decimalen: 1, meerdere_metingen: false}];
        const d = {}, t = todayUTCDate(); for(let i = 0; i < 5; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); d[dateToKey(x)] = 80 + i/10; }
        dataCache = {g: d}; bumpDataVersion('g'); renderSourceList(); renderSourceSelects(); setFileLinkUI('dir', 'linked', {name: 'Trends'});
        document.getElementById('data-source-select').value = 'g'; switchToView('data'); dataAggMode = 'd'; dataPeriodFilter = '1w'; await renderDataView();
      }); await tp.waitForTimeout(200);
      const rij = () => tp.evaluate(() => { const r = document.querySelector('#data-table-body tr[data-k]'); const b = r.getBoundingClientRect();
        return {bg: getComputedStyle(r.querySelector('td')).backgroundColor, x: b.left + b.width/2, y: b.top + b.height/2, sel: r.classList.contains('selected')}; });
      const voor = await rij();
      await tp.touchscreen.tap(voor.x, voor.y); await tp.waitForTimeout(150);
      const gekozen = (await rij()).sel;
      await tp.touchscreen.tap(voor.x, voor.y); await tp.waitForTimeout(150);
      const na = await rij();
      eis('telefoon: na selecteren en deselecteren weer de eigen achtergrond (geen hangende hover)', [gekozen, na.sel, na.bg], [true, false, voor.bg]);
      await tc.close();
    }

    /* 13528EF-001: ronde stappen op de y-as, en een lege grafiek zegt dat er niets is */
    {
      await opzet();
      eis('y-as: ronde stappen, minstens vier getallen, nooit fijner dan de decimalen (13528EF-001)', await p.evaluate(() => typeof asStap !== 'function' ? 'geen asStap' :
        [asStap(81.8, 83.2, 1), asStap(80.1, 87.2, 1), asStap(78.9, 90.7, 1), asStap(10, 13, 0), asStap(0.02, 0.05, 1), asStap(5, 5, 1)]
          .map(x => x == null ? null : Math.round(x * 1000) / 1000)), [0.2, 1, 2, 1, 0.1, null]);
      eis('y-as: een klein bereik geeft minder getallen, nooit dubbele (13528EF-003)', await p.evaluate(() => [asStap(6, 8, 0), asStap(82.0, 82.2, 1)].map(x => Math.round(x * 1000) / 1000)), [1, 0.1]);
      const asGetallen = await p.evaluate(async () => {
        const echt = CanvasRenderingContext2D.prototype.fillText, tekst = [];
        CanvasRenderingContext2D.prototype.fillText = function(t, x, y){ tekst.push({ t: String(t), x }); return echt.apply(this, arguments); };
        try {
          const d = {}; for(let i = 0; i < 7; i++) d['D202610' + String(20 + i) + 'T0800'] = [82.6, 82.4, 82.5, 82.3, 82.2, 82.4, 82.1][i];
          dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g');
          document.getElementById('data-source-select').value = 'g'; switchToView('data'); await renderDataView(); await setDataShowChart(true); await renderDataChartPreview();
        } finally { CanvasRenderingContext2D.prototype.fillText = echt; }
        const links = Math.min(...tekst.map(x => x.x));
        return tekst.filter(x => x.x === links && /^\d+\.\d$/.test(x.t)).map(x => x.t);
      });
      const stappen = [...new Set(asGetallen)].map(Number).sort((a, b) => a - b).map((v, i, a) => i ? Math.round((v - a[i - 1]) * 10) / 10 : null).slice(1);
      eis('y-as in de echte grafiek: gelijke ronde stappen', [asGetallen.length >= 4, new Set(stappen).size === 1, asGetallen.every(t => Math.round(Number(t) * 10) % 2 === 0)], [true, true, true]);
      const legeTekst = d => p.evaluate(async (d) => {
        const echt = CanvasRenderingContext2D.prototype.fillText, tekst = [];
        CanvasRenderingContext2D.prototype.fillText = function(t){ tekst.push(String(t)); return echt.apply(this, arguments); };
        try {
          dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(dataCache.g); bumpDataVersion('g');
          await renderDataView(); await setDataShowChart(true); await renderDataChartPreview();
        } finally { CanvasRenderingContext2D.prototype.fillText = echt; }
        return [...new Set(tekst)];
      }, d);
      eis('lege periode: de grafiek zegt het (13528EF-001)', await legeTekst({ D20200101: 80.0 }), ['Geen metingen in deze periode']);
      eis('een bron zonder metingen: nog geen metingen (13528EF-003)', await legeTekst({}), ['Nog geen metingen']);
      await opzet();
    }

    /* 13528EF-002: het kruisje in Waarde, de voorgestelde waarde, de tikfoutvraag, Enter,
       het potlood zonder selectie en de tijd van nu bij meer metingen per dag */
    {
      await opzet();
      const st = () => p.evaluate(() => { const v = document.getElementById('f-data-value');
        return { kruis: !document.getElementById('btn-wis-waarde').hidden, waarde: v.value, focus: document.activeElement === v,
                 cursor: v.selectionStart === v.value.length && v.selectionEnd === v.value.length }; });
      await p.evaluate(() => openEditDatapointModal('g', '20261021'));
      const begin = (await st()).waarde;
      eis('kruisje: staat er bij openen, met de cursor achter de waarde (13528EF-002)', [await st(), begin !== ''], [{ kruis: true, waarde: begin, focus: true, cursor: true }, true]);
      await p.focus('#f-data-value'); await p.keyboard.press('Backspace');
      eis('kruisje: weg zodra je typt', (await st()).kruis, false);
      await p.click('#btn-undo-waarde');
      eis('kruisje: weer terug na terugzetten', await st(), { kruis: true, waarde: begin, focus: true, cursor: true });
      await p.click('#btn-wis-waarde');
      eis('kruisje: een tik maakt het veld leeg, de focus blijft, het kruisje weg', await st(), { kruis: false, waarde: '', focus: true, cursor: true });
      eis('kruisje: dat is iets anders dan geen meting', await p.evaluate(() => [isExplicitEmpty, document.getElementById('f-data-value').placeholder]), [false, '']);
      await p.click('#btn-undo-waarde'); await p.click('#btn-no-measurement');
      eis('kruisje: weg bij – geen meting –', (await st()).kruis, false);
      await p.evaluate(() => { closeDatapointModalInner(); modalStack.length = 0; });

      eis('voorgestelde waarde: de laatste meting vóór die dag, niet het gemiddelde (13528EF-002)', await p.evaluate(() => {
        const d = { D20260901: 90.0, D20261001: 80.0, D20261010: 82.4 };
        dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g');
        return [getDefaultDatapointValue('g', '2026-10-14'), getDefaultDatapointValue('g', '2026-10-05'), getDefaultDatapointValue('g', '2026-08-01'), getDefaultDatapointValue('g', '2026-10-10')]; }),
        [82.4, 80.0, null, 82.4]);

      eis('tikfout: de grens is 5 × r̄ over de laatste 30 verschillen vóór het nieuwe tijdstip (13528EF-003)', await p.evaluate(() => {
        const zet = d => { dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g'); };
        const t = { D20261001: 82.0, D20261002: 82.4, D20261003: 82.0, D20261004: 82.4, D20261005: 82.0 };   /* r̄ = 0.4, grens 2.0 */
        zet(t);
        const r = (num, k = 'D20261006', bew = null) => { const x = waarschijnlijkeTikfout('g', k, num, bew); return x ? Math.round(x.verschil * 10) / 10 : null; };
        const uit = [r(8.2), r(84.1), r(79.9), r(83.9), r(81.0, 'D20261003', 'D20261003')];
        /* een onrustige periode lang geleden telt niet mee: alleen de laatste 30 verschillen */
        const lang = {}; for(let i = 0; i < 40; i++) lang['D2025' + String(1001 + i)] = i % 2 ? 70 : 90;
        for(let i = 0; i < 31; i++){ const d = new Date(Date.UTC(2026, 8, 1 + i)); lang['D' + dateToKey(d)] = i % 2 ? 82.2 : 82.0; }
        zet(lang);
        uit.push(r(84.5, 'D20261005'));
        zet({ D20261001: 1, D20261002: 2 });
        uit.push(waarschijnlijkeTikfout('g', 'D20261003', 50, null));
        return uit; }),
        [-73.8, 2.1, -2.1, null, null, 2.5, null]);


      /* in het venster: Enter = Opslaan, en dan eerst de vraag */
      await opzet();
      await p.evaluate(async () => {
        const d = {}; const t0 = todayUTCDate().getTime(); [82.0, 82.4, 82.0, 82.4, 82.0, 82.4].forEach((w, i) => { d['D' + dateToKey(new Date(t0 - (6 - i) * 864e5))] = w; });
        dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g'); await renderDataView(); });
      await p.evaluate(() => openEditDatapointModal('g', 'D' + dateToKey(todayUTCDate())));
      await p.fill('#f-data-value', '8.1'); await p.focus('#f-data-value'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
      const vraag = await p.evaluate(() => [getComputedStyle(document.getElementById('warn-overlay')).display !== 'none', document.getElementById('warn-text').textContent, document.getElementById('warn-cancel').textContent, document.getElementById('warn-ok').textContent]);
      eis('Enter = Opslaan, en bij een tikfout eerst de vraag Klopt dit? (13528EF-002)', [vraag[0], /^8\.1 kg is [\d.]+ lager dan de vorige meting \([\d.]+ op \d\d-\d\d-\d{4}\)\. Klopt dit\?$/.test(vraag[1]), vraag[2], vraag[3]], [true, true, 'Aanpassen', 'Toch opslaan']);
      await p.evaluate(() => document.getElementById('warn-cancel').click()); await p.waitForTimeout(150);
      eis('Aanpassen: terug in het veld, de waarde blijft', await st(), { kruis: false, waarde: '8.1', focus: true, cursor: true });
      eis('Enter staat als Gereed op het toetsenbord', await p.evaluate(() => document.getElementById('f-data-value').enterKeyHint), 'done');
      await p.keyboard.press('Enter'); await p.waitForTimeout(200);
      await p.evaluate(() => document.getElementById('warn-ok').click()); await p.waitForTimeout(500);
      eis('Toch opslaan: de waarde staat in het bestand (13528EF-003)', await p.evaluate(() => [dataCache.g[vandaagSleutel()], getComputedStyle(document.getElementById('datapoint-modal-overlay')).display]), [8.1, 'none']);
      await p.evaluate(() => openEditDatapointModal('g', vandaagSleutel()));
      await p.fill('#f-data-notitie', 'alleen de notitie'); await p.evaluate(() => document.getElementById('btn-add-datapoint').click()); await p.waitForTimeout(500);
      eis('alleen de notitie aangepast: niet opnieuw Klopt dit?', await p.evaluate(() => [getComputedStyle(document.getElementById('warn-overlay')).display === 'none', getComputedStyle(document.getElementById('datapoint-modal-overlay')).display]), [true, 'none']);
      await p.evaluate(() => { closeDatapointModalInner(); modalStack.length = 0; });

      /* het potlood zonder geselecteerde rij */
      const potlood = () => p.evaluate(async () => { selectedDataKey = null; updateEditSelectedButton(); const b = document.getElementById('btn-edit-selected-datapoint'); return !b.disabled; });
      await opzet();
      eis('potlood zonder selectie: aan als er vandaag nog niets is (13528EF-002)', await p.evaluate(async () => {
        const d = { ...dataCache.g }; Object.keys(d).forEach(k => { if(k.slice(0, 9) === 'D' + dateToKey(todayUTCDate())) delete d[k]; });
        dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g'); await renderDataView(); selectedDataKey = null; updateEditSelectedButton();
        const b = document.getElementById('btn-edit-selected-datapoint'); const aan = !b.disabled; b.click();
        const r = [aan, document.getElementById('datapoint-modal-title').textContent, currentDatapointKey && currentDatapointKey.slice(0, 9) === 'D' + dateToKey(todayUTCDate())];
        closeDatapointModalInner(); modalStack.length = 0; return r; }), [true, 'Meting toevoegen', true]);
      eis('potlood zonder selectie: uit als er vandaag al een meting is (niets per ongeluk aanpassen)', await p.evaluate(async () => {
        const d = { ...dataCache.g, [vandaagSleutel()]: 82.0 };
        dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g'); await renderDataView(); selectedDataKey = null; updateEditSelectedButton();
        const b = document.getElementById('btn-edit-selected-datapoint'); return [b.disabled, b.title]; }), [true, 'Kies eerst een rij']);
      eis('potlood zonder selectie: bij meer metingen per dag mag er vandaag een bij (13528EF-003)', await p.evaluate(() => {
        bronnen[0].meerdere_metingen = true; selectedDataKey = null; updateEditSelectedButton();
        const aan = !document.getElementById('btn-edit-selected-datapoint').disabled; bronnen[0].meerdere_metingen = false; updateEditSelectedButton(); return aan; }), true);
      eis('potlood zonder selectie: uit bij weekgroepering en bij alleen lezen', await p.evaluate(async () => {
        const d = { ...dataCache.g }; delete d[vandaagSleutel()];
        dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g'); await renderDataView(); selectedDataKey = null;
        const b = document.getElementById('btn-edit-selected-datapoint'), oud = dataAggMode;
        dataAggMode = 'w'; updateEditSelectedButton(); const week = b.disabled; dataAggMode = oud;
        bronnen[0].bewerken_in_trends = false; updateEditSelectedButton(); const lezen = b.disabled; bronnen[0].bewerken_in_trends = true; updateEditSelectedButton();
        return [week, lezen, b.disabled]; }), [true, true, false]);
      eis('snelkoppeling: er staat vandaag al een meting, dan wordt die niet geopend maar gezegd (13528EF-003)', await p.evaluate(async () => {
        const d = { ...dataCache.g, [vandaagSleutel()]: 82.0 };
        dataCache = { g: d }; zetTabel('g', d, {}, {}); __volledigeTabel.add(d); bumpDataVersion('g');
        await voerSnelOpdrachtUit('meting'); await new Promise(r => setTimeout(r, 100));
        const r = [getComputedStyle(document.getElementById('datapoint-modal-overlay')).display === 'none', /^Er staat vandaag al een meting \(82\.0/.test(document.getElementById('alert-text').textContent)];
        document.getElementById('alert-ok').click(); return r; }), [true, true]);

      /* meer metingen per dag: vandaag de tijd van nu, een eerdere dag 12:00 */
      eis('meer metingen: vandaag de tijd van nu, eerder 12:00 (13528EF-002)', await p.evaluate(() => {
        bronnen[0].meerdere_metingen = true;
        openEditDatapointModal('g', 'D' + dateToKey(todayUTCDate())); const nu = document.getElementById('f-data-time').value; closeDatapointModalInner(); modalStack.length = 0;
        openEditDatapointModal('g', 'D20261001'); const eerder = document.getElementById('f-data-time').value; closeDatapointModalInner(); modalStack.length = 0;
        bronnen[0].meerdere_metingen = false;
        const min = t => +t.slice(0, 2) * 60 + +t.slice(3);   /* binnen een minuut: rond een minuutwissel */
        return [Math.abs(min(nu) - min(tijdNu())) <= 1, eerder]; }), [true, '12:00']);
      await opzet();
    }

    console.log('\nTerug naar de standaardweergave (13528F4-001)');
    {
      /* elke stap vangt zijn eigen fout op, maar een mislukte opzet laat de hele groep falen */
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      const klaar = () => p.waitForFunction(() => !window.__bezig, null, {timeout: 2000}).catch(() => {});
      await opzet();
      /* 60 dagen metingen, zodat de XmR-kaarten en de lagen kunnen */
      const opgezet = await pe(async () => { const d = {}; const t = todayUTCDate();
        for(let i = 0; i < 60; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); d['D' + dateToKey(x)] = 80 + (i % 7) / 10; }
        dataCache = {g: d}; __volledigeTabel.add(d); bumpDataVersion('g');
        Object.keys(localStorage).filter(k => /^trends\./.test(k)).forEach(k => localStorage.removeItem(k));
        for(const k of Object.keys(__laagStand)) delete __laagStand[k];
        await zetWeergaveVanBron(getSource('g')); return 'ok'; });
      eis('opzet: de bron opent zoals de eerste keer', opgezet, 'ok');
      /* de stand zoals je hem ziet; null als er geen terugzetknop is */
      const stand = () => pe(() => { const k = document.getElementById('btn-weergave-standaard');
        return k ? {knop: !k.hidden && getComputedStyle(k).display !== 'none', periode: dataPeriodFilter, groep: dataAggMode, kaart: chartViewMode, grafiek: dataShowChart} : null; });
      const knop = async () => (await stand() || {}).knop;
      const klikStd = () => pe(async () => { document.getElementById('btn-weergave-standaard').click(); await renderDataView(true); });
      const zet = fn => pe(async fn => { await new Function('return (async () => {' + fn + '})()')(); await renderDataView(true); }, fn);
      const thuis = {knop: false, periode: '1m', groep: 'd', kaart: 'standard', grafiek: true};
      eis('bij het openen van de bron: geen terugzetknop', await stand(), thuis);
      eis('het icoon: een cirkelpijl (terug naar de beginstand, zoals in Events), geen haakpijl (13528F5-002)', await pe(() => [...document.querySelectorAll('#btn-weergave-standaard svg path')].map(e => e.getAttribute('d'))),
        ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5']);
      await pe(() => document.querySelector('#data-period-filter button[data-period="3m"]').click()); await klaar();
      eis('een andere periode gekozen: de knop verschijnt', await knop(), true);
      await klikStd();
      eis('tikken: periode terug op 1 m, de knop weg', await stand(), thuis);
      eis('en de knop 1 m staat weer aan', await pe(() => document.querySelector('#data-period-filter button.active')?.dataset.period), '1m');
      eis('na de tik heeft de bronkeuze de focus (de knop is weg)', await pe(async () => {
        document.querySelector('#data-period-filter button[data-period="3m"]').click(); await renderDataView(true);
        const k = document.getElementById('btn-weergave-standaard'); k.focus(); k.click(); await renderDataView(true); return document.activeElement && document.activeElement.id; }), 'data-source-picker-btn');
      await pe(() => document.querySelector('#data-agg-filter button[data-agg="w"]').click()); await klaar();
      eis('een andere groepering: de knop verschijnt', await knop(), true);
      await klikStd();
      eis('tikken: groepering terug op dag', await stand(), thuis);
      await zet("__zetKaart('xmr');");
      eis('XmR aan is een laag: geen terugzetknop, en XmR blijft staan', [await knop(), await pe(() => effectieveWeergave())], [false, 'xmr']);
      await zet("__zetKaart('standard');");
      await zet("__zetKaart('range');");
      eis('een andere kaart telt niet: geen knop (13528F4-001)', await knop(), false);
      await zet("__zetKaart('standard');");
      await pe(() => setDataShowChart(false));
      eis('de grafiek verborgen: de knop verschijnt', await knop(), true);
      await klikStd();
      eis('tikken: de grafiek weer zichtbaar', await stand(), thuis);
      /* een laag telt niet mee en blijft staan: Run-regels aan bij ŷ±σ */
      await zet("__zetKaart('regressie'); zetLaag('run', true); __zetKaart('standard');");
      eis('Run-regels aan op een andere kaart: geen knop (de lagen tellen niet mee)', await knop(), false);
      await zet("__zetKaart('regressie');");
      await klikStd();
      eis('tikken laat de lagen staan: Run-regels bij ŷ±σ blijft aan', await pe(() => { __zetKaart('regressie'); const r = laagIsAan('run'); __zetKaart('standard'); return r; }), true);
      await zet("zetLaag('run', true);");
      eis('een laag aan op deze kaart: geen knop', await knop(), false);
      await zet("zetLaag('run', false);");
      /* een eigen periode die precies 1 maand tot vandaag is, is gewoon 1 m */
      eis('een eigen periode van precies 1 maand tot vandaag: geen afwijking', await pe(async () => {
        const t = todayUTCDate(), van = new Date(t); van.setUTCDate(van.getUTCDate() - 30);
        document.getElementById('data-range-from').value = dateToKey(van).replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3');
        document.getElementById('data-range-to').value = dateToKey(t).replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3');
        dataPeriodFilter = 'custom'; syncPeriodButtonsActive(); await renderDataView(true);
        const r = [document.querySelector('#data-period-filter button.active')?.dataset.period, !document.getElementById('btn-weergave-standaard').hidden];
        await zetWeergaveVanBron(getSource('g')); return r; }), ['1m', false]);
      /* een standaardgroepering die bij de standaardperiode niet kan: dan per dag, en dat is de standaard */
      await pe(async () => { const b = getSource('g'); b.standaard_periode = '1w'; b.standaard_groepering = 'm'; await zetWeergaveVanBron(b); });
      eis('standaard 1 w per maand (kan niet, dus per dag): geen knop', [(await stand() || {}).knop, (await stand() || {}).groep], [false, 'd']);
      await pe(async () => { const b = getSource('g'); delete b.standaard_periode; delete b.standaard_groepering; await zetWeergaveVanBron(b); });
      /* bron opslaan en verwijderen gebruiken dezelfde terugzetfunctie: ook de kaart en de grafiek */
      eis('een bron verwijderen: de volgende bron opent op x̄±σ, met zijn eigen grafiekinstelling', await pe(async () => {
        bronnen.push({id: 'h', titel: 'Ander', bestand: 'ander.txt'}); renderSourceSelects();
        const sel = document.getElementById('data-source-select'); sel.value = 'h'; __zetKaart('range'); await setDataShowChart(false);
        await verwijderBron('h'); await renderDataView(true);
        return [sel.value, chartViewMode, dataShowChart, document.getElementById('btn-weergave-standaard').hidden]; }), ['g', 'standard', true, true]);
      eis('een bron opslaan: ook dan de kaart terug op x̄±σ', await pe(async () => {
        __zetKaart('range'); await renderDataView(true); switchToView('meta'); editSource('g'); document.getElementById('btn-save-source').click();
        await new Promise(r => setTimeout(r, 400)); switchToView('data'); await renderDataView(true); return chartViewMode; }), 'standard');
      eis('de knop: even hoog als de bronkeuze, in de kleuren van een gewone knop', await pe(async () => {
        document.querySelector('#data-period-filter button[data-period="3m"]').click(); await renderDataView(true);
        const k = document.getElementById('btn-weergave-standaard'), c = getComputedStyle(k), gewoon = getComputedStyle(document.querySelector('#data-period-filter button:not(.active)'));
        const r = [Math.round(k.getBoundingClientRect().height) === Math.round(document.getElementById('data-source-picker-btn').getBoundingClientRect().height),
          c.backgroundColor === gewoon.backgroundColor, c.color === gewoon.color];
        k.click(); return r; }), [true, true, true]);
      eis('één keer tekenen bij terugzetten (niet eerst de grafiek en dan alles nog eens)', await pe(async () => {
        document.querySelector('#data-period-filter button[data-period="3m"]').click(); await renderDataView(true);
        const echt = renderDataChartPreview; let n = 0; renderDataChartPreview = async function(){ n++; return echt.apply(this, arguments); };
        try{ await zetWeergaveVanBron(getSource('g')); } finally { renderDataChartPreview = echt; } return n; }), 1);
      await opzet();
    }

    console.log('\nHet bronvenster in inklapbare secties (13528F4-001)');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      await opzet();
      const secties = () => pe(() => ['Bestand', 'Waarden', 'Doel', 'Weergave'].map(n => {
        const k = document.getElementById('kop' + n); return [!document.getElementById('vak' + n).hidden, k.getAttribute('aria-expanded') === 'true', document.getElementById('samen' + n).textContent]; }));
      await pe(() => { switchToView('meta'); Object.assign(getSource('g'), {min: 70, max: 95, doel_x: 80, doel_r: 0.5}); editSource('g'); });
      await wacht(100);
      eis('bewerken: alles dicht, in elke kop de samenvatting', await secties(),
        [[false, false, 'gewicht.txt'], [false, false, 'kg · 70–95'], [false, false, '80 ± 0.5'], [false, false, '1 maand · dag']]);
      await pe(() => document.getElementById('kopWaarden').click());
      eis('een tik op een kop klapt die sectie open', (await secties())[1].slice(0, 2), [true, true]);
      await pe(() => document.getElementById('kopWaarden').click());
      eis('nog een tik: weer dicht', (await secties())[1].slice(0, 2), [false, false]);
      eis('Bestand openklappen: het bestandsveld is zo hoog als de naam (verborgen gemeten was het 0)', await pe(() => {
        document.getElementById('kopBestand').click(); const el = document.getElementById('f-bestand');
        const r = el.offsetHeight >= el.scrollHeight && el.offsetHeight > 20; document.getElementById('kopBestand').click(); return r; }), true);
      await pe(() => { const v = document.getElementById('f-max'); v.value = '1250000'; v.dispatchEvent(new Event('input', {bubbles: true})); });
      eis('een veld wijzigen: de samenvatting volgt', (await secties())[1][2], 'kg · 70–1250000');
      await pe(() => { const v = document.getElementById('f-max'); v.value = '1234567890123456789'; v.dispatchEvent(new Event('input', {bubbles: true})); });
      eis('een lange samenvatting past in de kop: afgekapt, de kop niet breder dan het venster', await pe(() => {
        const k = document.getElementById('kopWaarden'), z = document.getElementById('samenWaarden'), box = k.closest('.modal-box');
        return [k.getBoundingClientRect().right <= box.getBoundingClientRect().right, z.scrollWidth > z.clientWidth || z.getBoundingClientRect().right <= k.getBoundingClientRect().right]; }), [true, true]);
      await pe(() => { setFormStandaardPeriode('3m'); setFormStandaardGroepering('w'); });
      eis('een andere periode en groepering: de samenvatting volgt', (await secties())[3][2], '3 maanden · week');
      await pe(() => { const v = document.getElementById('f-doelx'); v.value = ''; v.dispatchEvent(new Event('input', {bubbles: true})); });
      eis('zonder doel: "geen"', (await secties())[2][2], 'geen');
      /* een fout bij Opslaan in een dichte sectie: die gaat open */
      await pe(() => { const v = document.getElementById('f-max'); v.value = 'abc'; document.getElementById('btn-save-source').click(); });
      await wacht(100);
      eis('Max is geen getal: de sectie Waarden gaat open, met de melding', await pe(() => [!document.getElementById('vakWaarden').hidden, document.getElementById('alert-text').textContent]), [true, 'Max is geen getal.']);
      await pe(() => document.getElementById('alert-ok').click());
      await pe(() => { const v = document.getElementById('f-max'); v.value = '95'; document.getElementById('f-min').value = '100'; zetSectie('Waarden', false); document.getElementById('btn-save-source').click(); });
      await wacht(100);
      eis('Min groter dan Max: ook dan Waarden open', await pe(() => [!document.getElementById('vakWaarden').hidden, document.getElementById('alert-text').textContent]), [true, 'Min is groter dan Max.']);
      await pe(() => { document.getElementById('alert-ok').click(); document.getElementById('f-doelr').value = 'x'; document.getElementById('f-min').value = '70'; document.getElementById('btn-save-source').click(); });
      await wacht(100);
      eis('Doel-spreiding geen getal: de sectie Doel open', await pe(() => [!document.getElementById('vakDoel').hidden, document.getElementById('alert-text').textContent]), [true, 'Doel-spreiding is geen getal.']);
      await pe(() => { document.getElementById('alert-ok').click(); modalStack.length = 0; document.getElementById('source-modal-overlay').style.display = 'none'; resetSourceForm(); });
      await pe(() => { resetSourceForm(); openSourceModal(); });
      eis('nieuwe bron: alleen Bestand open, de samenvattingen van een leeg venster', await secties(),
        [[true, true, 'nieuw bestand'], [false, false, ''], [false, false, 'geen'], [false, false, '1 maand · dag']]);
      await pe(async () => { dirHandle.entries = async function*(){}; await openBestandPicker(); const v = document.getElementById('bestand-nieuwe-naam'); v.value = 'Bloeddruk'; v.dispatchEvent(new Event('input')); document.getElementById('bestand-picker-ok').click(); });
      eis('een nieuwe bestandsnaam: de samenvatting volgt', (await secties())[0][2], 'Bloeddruk.txt');
      eis('in Bestand het metabestand, alleen te lezen, en geen + of mapknop meer', await pe(() => {
        const m = document.getElementById('f-metabestand'); return [m.textContent, m.tagName, !!document.getElementById('btn-new-bestand-name'), !!document.getElementById('btn-pick-bestand')]; }), ['trends.json', 'DIV', false, false]);
      const kies = await pe(async () => {
        dirHandle.entries = async function*(){ for(const n of ['a.txt', 'gewicht.txt']) yield [n, {kind: 'file'}]; };
        document.getElementById('f-bestand').value = 'gewicht.txt';
        document.getElementById('f-bestand').click(); await new Promise(r => setTimeout(r, 100));
        const ok = document.getElementById('bestand-picker-ok'), v = document.getElementById('bestand-nieuwe-naam'), gekozen = () => [...document.querySelectorAll('#bestand-picker-list .source-row.selected .title')].map(e => e.textContent);
        const r = {open: getComputedStyle(document.getElementById('bestand-picker-modal-overlay')).display !== 'none', zoek: !!document.getElementById('btn-toggle-bestand-search'), begin: [gekozen(), ok.disabled, v.value]};
        v.value = 'Hartslag'; v.dispatchEvent(new Event('input')); r.naam = [gekozen(), ok.disabled];
        document.querySelector('#bestand-picker-list .source-row').click(); r.rij = [gekozen(), v.value, ok.disabled];
        v.value = '  '; v.dispatchEvent(new Event('input')); r.spaties = [gekozen(), ok.disabled];
        v.value = 'Hartslag.TXT'; v.dispatchEvent(new Event('input')); v.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
        r.enter = [document.getElementById('f-bestand').value, getComputedStyle(document.getElementById('bestand-picker-modal-overlay')).display]; return r; });
      eis('een tik op het bestandsveld opent het kiesvenster, zonder zoekknop, het huidige bestand gekozen', [kies.open, kies.zoek, kies.begin], [true, false, [['gewicht.txt'], false, '']]);
      eis('een nieuwe naam typen: de keuze in de lijst vervalt, OK blijft aan', kies.naam, [[], false]);
      eis('daarna een bestand aantikken: het naamveld wordt leeg', kies.rij, [['a.txt'], '', false]);
      eis('alleen spaties typen: geen naam, dus de keuze in de lijst blijft en OK aan', kies.spaties, [['a.txt'], false]);
      eis('Enter in het naamveld is OK; een naam op .TXT krijgt er geen .txt bij', kies.enter, ['Hartslag.TXT', 'none']);
      eis('een lege werkmap: de melding, en een nieuwe naam kan gewoon', await pe(async () => {
        dirHandle.entries = async function*(){}; document.getElementById('f-bestand').value = ''; await openBestandPicker();
        const r = [getComputedStyle(document.getElementById('bestand-picker-empty')).display, getComputedStyle(document.getElementById('bestand-nieuwe-naam')).display !== 'none', document.getElementById('bestand-picker-ok').disabled];
        closeBestandPicker(); return r; }), ['block', true, true]);
      eis('het bestandsveld is een keuzeknop: alleen te lezen, met een pijltje (13528F4-001)', await pe(() => {
        const f = document.getElementById('f-bestand'); return [f.readOnly, f.getAttribute('aria-haspopup'), !!f.parentElement.querySelector('.chev')]; }), [true, 'dialog', true]);
      eis('het kiesvenster zet de focus op het gekozen bestand; Enter op een rij kiest die (13528F4-001)', await pe(async () => {
        dirHandle.entries = async function*(){ for(const n of ['a.txt', 'gewicht.txt']) yield [n, {kind: 'file'}]; };
        document.getElementById('f-bestand').value = 'gewicht.txt'; await openBestandPicker(); await new Promise(r => setTimeout(r, 50));
        const a = document.activeElement, r = [a.classList.contains('source-row'), a.querySelector('.title')?.textContent, a.getAttribute('role')];
        const rij = document.querySelector('#bestand-picker-list .source-row'); rij.focus(); rij.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        r.push([...document.querySelectorAll('#bestand-picker-list .source-row.selected .title')].map(e => e.textContent).join()); closeBestandPicker(); return r; }), [true, 'gewicht.txt', 'option', 'a.txt']);
      eis('grafiek verborgen: "grafiek uit" vooraan in de kop van Weergave, en op 360 px helemaal te zien (13528F4-001)', await pe(() => {
        setFormToonGrafiek(false); const z = document.getElementById('samenWeergave'), t = z.textContent;
        /* het stuk tot en met "grafiek uit" past: de breedte van die woorden alleen is kleiner dan wat er zichtbaar is */
        const r = document.createRange(), tn = z.firstChild; r.setStart(tn, 0); r.setEnd(tn, 'grafiek uit'.length);
        const past = r.getBoundingClientRect().right <= z.getBoundingClientRect().right;
        setFormToonGrafiek(true); return [t.startsWith('grafiek uit · '), past, z.textContent.includes('grafiek uit')]; }), [true, true, false]);
      eis('360 breed, een bron bewerken (drie knoppen): Opslaan blijft binnen het venster (13528F4-001)', await (async () => {
        await p.setViewportSize({width: 360, height: 740}); await pe(() => { modalStack.length = 0; document.getElementById('source-modal-overlay').style.display = 'none'; resetSourceForm(); editSource('g'); }); await wacht(100);
        const r = await pe(() => { const b = document.getElementById('btn-save-source'), box = b.closest('.modal-box'), cs = getComputedStyle(box);
          const knoppen = [...b.parentElement.querySelectorAll('button')].filter(k => k.offsetParent).length;
          return [knoppen, b.getBoundingClientRect().right <= box.getBoundingClientRect().right - parseFloat(cs.paddingRight) + 0.5]; });
        return r; })(), [3, true]);
      eis('het openen en dichtklappen telt niet als een wijziging (geen vraag bij Annuleren)', await pe(() => { const voor = snapshotSourceForm(); zetSectie('Weergave', true); zetSectie('Doel', true); return snapshotSourceForm() === voor; }), true);
      await pe(() => { modalStack.length = 0; document.getElementById('source-modal-overlay').style.display = 'none'; resetSourceForm(); });
      await opzet();
    }

    console.log('\nmR per meting: de sprongen tussen de daggemiddelden (13528F4-001)');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg).catch(e => 'FOUT: ' + String(e.message).split('\n')[0]);
      await opzet();
      /* dag 1: 80 en 82 (81), dag 2: 84 en 86 (85), dag 3: 83. Tussen de dagen 4 en 2: m̄R 3.
         Tussen de metingen 2, 2, 2, 3: dat zou 2,25 zijn, en dan zijn de grenzen te smal (binnen een dag varieert het minder) */
      const st = w => pe(async w => { bronnen[0].meerdere_metingen = true;
        dataCache = {g: {D20261101T0800: 80, D20261101T2000: 82, D20261102T0800: 84, D20261102T2000: 86, D20261103T0800: 83}}; bumpDataVersion('g');
        dataAggMode = 'p'; __zetKaart(w[0]); zetLaag('grenzen', true); zetLaag('xmr', w[1]); await renderDataView(true);
        const s = window.lastChartStats; return [s.chartMode, +s.rBar.toFixed(2), s.ucl == null ? null : +s.ucl.toFixed(2)]; }, w);
      eis('x̄±mR per meting: m̄R tussen de daggemiddelden, de grenzen rond het gemiddelde van alle metingen', await st(['standard', true]), ['xmr', 3, +(83 + 2.66 * 3).toFixed(2)]);
      eis('de Range-kaart per meting: per dag, dus ook m̄R 3 en de bovengrens 3,267 × 3', await st(['range', false]), ['range', 3, +(3.267 * 3).toFixed(2)]);
      eis('de Range-kaart per meting: de tabel per dag (drie rijen)', await pe(() => [...document.querySelectorAll('#data-table-body tr[data-k]')].map(r => r.dataset.k).filter(k => /^2026110[1-3]$/.test(k)).length), 3);
      await pe(async () => { vergeetLaag('xmr', 'g'); vergeetLaag('grenzen', 'g'); bronnen[0].meerdere_metingen = false; dataAggMode = 'd'; __zetKaart('standard'); });
      await opzet();
    }

    console.log('\nReview 13528F4-001: per meting, tikvlak, toegankelijkheid en bronvenster');
    {
      const pe = (fn, arg) => p.evaluate(fn, arg);
      await opzet();
      /* per meting: een vast verschil tussen ochtend (+0,6) en avond (−0,6) rond een rustig niveau */
      const zetMeer = () => pe(async () => { bronnen[0].meerdere_metingen = true; const d = {}, t = todayUTCDate();
        for(let i = 0; i < 20; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 19 + i); const k = dateToKey(x), basis = 80 + [0.1, -0.1, 0.05, 0][i % 4];
          d[k + 'T0700'] = Math.round((basis + 0.6)*100)/100; d[k + 'T2100'] = Math.round((basis - 0.6)*100)/100; }
        dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'p'; dataPeriodFilter = '1m'; });
      await zetMeer();
      eis('x̄±mR per meting: de daggemiddelden als punten (20 dagen, niet 40 metingen), geen rode punten door ochtend/avond (13528F4-001)', await pe(async () => {
        __zetKaart('standard'); zetLaag('grenzen', true); zetLaag('xmr', true); await renderDataView(true);
        const C = CanvasRenderingContext2D.prototype, arc = C.arc; let n = 0, rood = 0;
        C.arc = function(x, y, r){ if(r > 1.5 && r < 4.4) n++; return arc.apply(this, arguments); };
        const fs = Object.getOwnPropertyDescriptor(C, 'fillStyle'); try { await renderDataView(true); } finally { C.arc = arc; }
        return [window.lastChartStats.chartMode, n, aggVoorKaart()]; }), ['xmr', 20, 'd']);
      eis('ŷ±mR per meting ook op daggemiddelden; x̄±σ per meting houdt de losse metingen', await pe(async () => {
        __zetKaart('regressie'); zetLaag('grenzen', true); zetLaag('xmr', true); await renderDataView(true); const a = aggVoorKaart(); zetLaag('xmr', false);
        zetLaag('xmr', false); __zetKaart('standard'); await renderDataView(true); return [a, aggVoorKaart()]; }), ['d', 'p']);
      eis('de tabel bij x̄±mR per meting: per dag (20 rijen met een datum)', await pe(async () => { zetLaag('xmr', true); await renderDataView(true);
        const n = document.querySelectorAll('#data-table-body tr[data-k]').length; zetLaag('xmr', false); await renderDataView(true); return n >= 20 && n <= 21; }), true);
      eis('run-regels per meting op de daggemiddelden: ochtend en avond om en om geven geen "2 van 3" en geen vals signaal (13528F4-001)', await pe(async () => {
        zetLaag('run', true); __zetKaart('standard'); await renderDataView(true); const r = window.lastChartStats.runs;
        const uit = [r.dagPunten.length, r.tweeVanDrie.length, r.punten.length]; zetLaag('run', false); await renderDataView(true); return uit; }), [20, 0, 40]);
      eis('run per meting: acht dagen hoger geeft een verschuiving over dagen; ochtend en avond van een dag zijn allebei geel of allebei niet', await pe(async () => {
        const d = dataCache.g; Object.keys(d).sort().slice(-16).forEach(k => d[k] += 1); bumpDataVersion('g');
        zetLaag('run', true); await renderDataView(true); const r = window.lastChartStats.runs;
        const uit = [r.kant.length > 0, r.punten.some(Boolean), r.punten.every((v, i) => v === r.punten[i ^ 1])]; zetLaag('run', false); await renderDataView(true); return uit; }), [true, true, true]);
      await pe(async () => { bronnen[0].meerdere_metingen = false; dataAggMode = 'd'; }); await opzet();
      eis('run-labels kort en verschillend: "7 < x̄" voor de verschuiving, "↗ 6" voor de trend (de gelijke waarde telt niet) (13528F4-001)', await pe(async () => {
        const w = {D20261009: 83.4, D20261018: 85.0, D20261019: 84.7, D20261020: 84.5, D20261021: 84.5, D20261022: 84.7, D20261023: 83.8, D20261024: 82.2, D20261025: 83.3,
          D20261026: 83.5, D20261027: 83.8, D20261028: 83.8, D20261029: 83.9, D20261031: 84.7, D20261101: 84.1, D20261105: 85.2, D20261106: 84.8, D20261107: 84.0, D20261108: 83.3};
        dataCache = {g: w}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1m'; __zetKaart('standard'); zetLaag('grenzen', true); zetLaag('xmr', false); zetLaag('run', true);
        const P = CanvasRenderingContext2D.prototype, f = P.fillText, tk = []; P.fillText = function(t){ tk.push(String(t)); return f.apply(this, arguments); };
        try { await renderDataView(true); } finally { P.fillText = f; }
        zetLaag('run', false); await renderDataView(true); return [tk.includes('7 < x̄'), tk.includes('↗ 6'), tk.some(t => /op rij/.test(t))]; }), [true, true, false]);
      eis('Analyse op 360×640: kop, tabs en Sluiten staan vast, alleen de tabel scrolt; onderaan een vervaging zolang er meer is; een korte tab scrolt niet in het lege (13528F4-002)', await (async () => {
        await p.setViewportSize({width: 360, height: 640}); await wacht(100);
        const r = await pe(async () => {
          const w = {}, t = todayUTCDate(); for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); w['D' + dateToKey(x)] = Math.round((84 + Math.sin(i/2)*0.8)*10)/10; }
          dataCache = {g: w}; bumpDataVersion('g'); bronnen[0].doel_x = 83.5; dataAggMode = 'd'; dataPeriodFilter = '1m'; __zetKaart('regressie'); zetLaag('run', true); await renderDataView(true);
          window.chartSwipeJustHappened = false; openChartStatsModal();
          const sc = document.getElementById('chart-stats-scroll'), box = sc.closest('.modal-box').getBoundingClientRect(), dicht = document.getElementById('chart-stats-modal-close').getBoundingClientRect();
          const uit = [box.bottom <= innerHeight, dicht.bottom <= innerHeight, sc.scrollHeight > sc.clientHeight, sc.classList.contains('meer')];
          sc.scrollTop = sc.scrollHeight; sc.dispatchEvent(new Event('scroll')); uit.push(sc.classList.contains('meer'));
          const hReg = sc.clientHeight; setStatsTab('stats'); uit.push(sc.clientHeight === hReg, sc.scrollHeight <= sc.clientHeight + 1, sc.scrollTop);
          closeChartStatsModal(); zetLaag('run', false); delete bronnen[0].doel_x; return uit; });
        await p.setViewportSize({width: 360, height: 740}); await wacht(100); return r; })(), [true, true, true, true, false, true, true, 0]);
      eis('Analyse: de run-regels met de tekens van de grafiek, x̄ bij de basiskaart en ŷ bij de trend; op 360 px elk op één regel (13528F4-003)', await pe(async () => {
        const w = {}, t = todayUTCDate(); for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); w['D' + dateToKey(x)] = Math.round((84 + Math.sin(i/2)*0.8)*10)/10; }
        dataCache = {g: w}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1m'; zetLaag('run', true);
        const lees = async (kaart, tab) => { __zetKaart(kaart); zetLaag('run', true); await renderDataView(true); window.chartSwipeJustHappened = false; openChartStatsModal(); setStatsTab(tab);
          const rs = [...document.querySelectorAll('#chart-stats-modal-body-' + (tab === 'chart' ? 'chart' : 'regressie') + ' tr')].filter(r => /^(≥7|≥6|2 van 3)/.test(r.cells[0].textContent));
          const uit = [rs.map(r => r.cells[0].textContent), rs.every(r => r.getBoundingClientRect().height < 50)]; closeChartStatsModal(); return uit; };
        const a = await lees('standard', 'chart'), b = await lees('regressie', 'regressie'); zetLaag('run', false); await renderDataView(true); return [a, b]; }),
        [[['≥7 < of > x', '≥6 ↗ of ↘', '2 van 3 oranje'], true], [['≥7 < of > ŷ', '≥6 ↗ of ↘', '2 van 3 oranje'], true]]);
      eis('terug op de voorgrond of het canvas terug van Chrome: de grafiek opnieuw getekend, de tabel niet; een nieuwe dag tekent alles één keer (13528F5-001)', await pe(async () => {
        __zetKaart('standard'); await renderDataView(true);
        const echtG = window.renderDataChartPreview, echtV = window.renderDataView; let g = 0, v = 0;
        window.renderDataChartPreview = function(){ g++; return echtG.apply(this, arguments); }; window.renderDataView = function(){ v++; return echtV.apply(this, arguments); };
        const r = [];
        try {
          document.getElementById('data-chart-canvas').dispatchEvent(new Event('contextrestored')); await new Promise(z => setTimeout(z, 50)); r.push([g, v]);
          document.dispatchEvent(new Event('visibilitychange')); await new Promise(z => setTimeout(z, 50)); r.push([g, v]);
          const oud = __getekendeDag; __getekendeDag = '20000101'; g = 0; v = 0;
          document.dispatchEvent(new Event('visibilitychange')); await new Promise(z => setTimeout(z, 100)); r.push([g > 0, v]);
        } finally { window.renderDataChartPreview = echtG; window.renderDataView = echtV; }
        return r; }), [[1, 0], [2, 0], [true, 1]]);
      eis('tikvlak: elke laagknop 44 px hoog (onzichtbaar), de knop zelf even groot als voorheen', await pe(() => {
        const b = document.querySelector('#lagen-knoppen [data-laag="grenzen"]'); return [getComputedStyle(b, '::before').height, Math.round(b.getBoundingClientRect().width)]; }), ['44px', 32]);
      eis('twee tikken op XmR voordat er getekend is: weer uit (op de stand, niet op de knop)', await pe(async () => {
        __zetKaart('standard'); zetLaag('grenzen', true); zetLaag('xmr', false); await renderDataView(true);
        const b = document.querySelector('#lagen-knoppen [data-laag="xmr"]'); b.click(); b.click(); await new Promise(r => setTimeout(r, 100)); return effectieveWeergave(); }), 'standard');
      eis('op de Range-kaart heet de XmR-knop "Grenzen van de Range-kaart" (ook in het menu)', await pe(async () => {
        __zetKaart('range'); await renderDataView(true); const a = document.querySelector('#lagen-knoppen [data-laag="xmr"]').getAttribute('aria-label');
        __zetKaart('standard'); await renderDataView(true); return [a, document.querySelector('#lagen-knoppen [data-laag="xmr"]').getAttribute('aria-label')]; }), ['Grenzen van de Range-kaart', 'XmR-grenzen']);
      eis('een tik op de stipjes of de naam: de volgende weergave; een knop voor de schermlezer', await pe(async () => {
        __zetKaart('standard'); await renderDataView(true); const k = document.querySelector('#weergave-stipjes .stipjes-knop'); k.click(); await new Promise(r => setTimeout(r, 100));
        const na = chartViewMode; __zetKaart('standard'); await renderDataView(true); return [k.tagName, /^Volgende weergave\. Weergave 1 van/.test(k.getAttribute('aria-label')), na]; }), ['BUTTON', true, 'range']);
      eis('de grafiek met het toetsenbord: → de volgende weergave, ← terug, Enter opent Analyse', await pe(async () => {
        __zetKaart('standard'); await renderDataView(true); const c = document.getElementById('data-chart-canvas'), toets = k => c.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true}));
        const r = [c.getAttribute('tabindex'), c.getAttribute('role')]; toets('ArrowRight'); await new Promise(z => setTimeout(z, 80)); r.push(chartViewMode);
        toets('ArrowLeft'); await new Promise(z => setTimeout(z, 80)); r.push(chartViewMode); window.chartSwipeJustHappened = false; toets('Enter'); await new Promise(z => setTimeout(z, 150));
        r.push(getComputedStyle(document.getElementById('chart-stats-modal-overlay')).display !== 'none'); closeChartStatsModal(); return r; }), ['0', 'button', 'range', 'standard', true]);
      /* De streep boven m̄R (13528F6-001): minstens 2,5 px boven de bovenkant van de letters,
         zoals bij x̄; die blijft op 14 px. Opgenomen van het echte canvas: na het tekenen van
         'x' of 'mR' de eerstvolgende lijn. In het Analyse-venster 2 px hoger dan voorheen. */
      eis('de streep boven x̄ en m̄R in de kopregel: evenveel ruimte boven de letters, x̄ ongewijzigd (13528F6-002)', await pe(async () => {
        const P = CanvasRenderingContext2D.prototype, echtF = P.fillText, echtM = P.moveTo, log = [];
        P.fillText = function(t, x, y){ if(this.canvas.id === 'data-chart-canvas' && (t === 'x' || t === 'mR')) log.push({t, y, asc: this.measureText(t).actualBoundingBoxAscent}); return echtF.apply(this, arguments); };
        P.moveTo = function(x, y){ const l = log[log.length - 1]; if(l && l.lijn == null && this.canvas.id === 'data-chart-canvas') l.lijn = y; return echtM.apply(this, arguments); };
        try { __zetKaart('standard'); await renderDataView(true); } finally { P.fillText = echtF; P.moveTo = echtM; }
        const x = log.find(l => l.t === 'x'), r = log.find(l => l.t === 'mR');
        if(!x || !r) return 'niet getekend';
        const ruimte = l => l.y - l.lijn - l.asc;
        /* 13528F6-002: de ruimte boven m̄R gelijk aan die boven x̄ (vaste 2,5 px was op de telefoon te krap) */
        return [x.y - x.lijn, Math.abs(ruimte(r) - ruimte(x)) < 0.05, r.y - r.lijn >= 14]; }), [14, true, true]);
      eis('m̄R in het Analyse-venster: de streep 2 px hoger dan voorheen (13528F6-001)', await pe(async () => {
        __zetKaart('xmr'); await renderDataView(true); openChartStatsModal();
        const i = [...document.querySelectorAll('#chart-stats-modal-overlay span > i')].find(e => e.parentElement.textContent === 'mR');
        const r = i ? getComputedStyle(i).top : null; closeChartStatsModal(); __zetKaart('standard'); await renderDataView(true); return r; }), '-1px');
      /* De pijlen (13528F5-002, gelijk aan Events): Vernieuwen en de updatebalk met de klok mee,
         de standaardweergave hun spiegelbeeld (tegen de klok in), het meetvenster haakpijlen. */
      eis('de pijlen: Vernieuwen en de updatebalk met de klok mee, de standaardknop gespiegeld, terugzetten een haakpijl (13528F5-002)', await pe(() => {
        const d = sel => [...document.querySelectorAll(sel + ' path')].map(e => e.getAttribute('d')).join(' ') + (document.querySelectorAll(sel + ' polyline').length ? ' +polyline' : '');
        return [d('#btn-refresh-dir svg'), d('#update-bar svg'), d('#btn-weergave-standaard svg'), d('#btn-undo-waarde svg').split(' ')[0] + ' ' + d('#btn-undo-notitie svg').split(' ')[0]]; }),
        ['M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5', 'M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5', 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5', 'M9 M9']);
      eis('het bestandsveld is voor de schermlezer een knop; een tik op het label zet de schakelaar om', await pe(() => {
        switchToView('meta'); editSource('g'); const f = document.getElementById('f-bestand'), sw = document.getElementById('f-meerdere-metingen'), l = document.querySelector('label[for="f-meerdere-metingen"]');
        const voor = sw.classList.contains('active'); l.click(); const na = sw.classList.contains('active'); l.click();
        return [f.getAttribute('role'), !!l, voor !== na]; }), ['button', true, true]);
      eis('een open sectie: geen samenvatting in de kop, en een lijn links langs de velden', await pe(() => {
        zetSectie('Waarden', true); const z = getComputedStyle(document.getElementById('samenWaarden')).display, v = getComputedStyle(document.getElementById('vakWaarden')).borderLeftWidth;
        zetSectie('Waarden', false); const z2 = getComputedStyle(document.getElementById('samenWaarden')).display;
        modalStack.length = 0; document.getElementById('source-modal-overlay').style.display = 'none'; resetSourceForm(); return [z, v, z2 !== 'none']; }), ['none', '2px', true]);
      await opzet();
    }

    eis('geen fouten in de pagina', paginafouten, []);
  }catch(e){
    console.log('  FOUT de browsertest liep niet tot het eind — ' + (e && e.message));
    fouten.push('omgevallen');
  }finally{
    if(browser) await browser.close();
    server.close();
    console.log('\n' + (fouten.length ? fouten.length + ' van ' + n + ' FOUT' : 'alle ' + n + ' controles goed'));
    process.exitCode = fouten.length ? 1 : 0;
  }
});
