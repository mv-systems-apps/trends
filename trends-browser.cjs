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

const types = {'.html':'text/html;charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml'};
const server = http.createServer((q, r) => {
  const f = path.join(MAP, decodeURIComponent(q.url.split('?')[0]));
  if(!f.startsWith(MAP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});

server.listen(0, async () => {
  let browser;
  try{
    browser = await chromium.launch();
    const p = await browser.newPage({viewport: {width: 360, height: 740}});
    const paginafouten = [];
    p.on('pageerror', e => paginafouten.push(e.message));
    await p.goto('http://127.0.0.1:' + server.address().port + '/trends.html');
    await p.waitForTimeout(600);

    /* Een schone werkmap met de bron Gewicht (één meting per dag) en twee metingen.
       window.__faal: schrijven mislukt (behalve de backup); window.__traag: schrijven
       duurt 300 ms (of zoveel ms als __traag een getal is). */
    const opzet = () => p.evaluate(() => {
      document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; });
      if(typeof modalStack !== 'undefined') modalStack.length = 0;
      const schijf = {}; let klok = 1000;
      window.__fs = schijf; window.__faal = false; window.__traag = false;
      const fout = naam => Object.assign(new Error('x'), {name: naam});
      const h = naam => ({name: naam,
        getFile: async () => { if(!schijf[naam]) throw fout('NotFoundError'); const f = schijf[naam]; return {lastModified: f.mtime, size: f.tekst.length, text: async () => f.tekst}; },
        createWritable: async () => {
          if(window.__traag) await new Promise(r => setTimeout(r, window.__traag === true ? 300 : window.__traag));
          if(window.__faal && !/_backup/.test(naam)) throw fout('NotAllowedError');
          let buf = '';
          return {write: async t => { buf += t; }, close: async () => { klok += 1000; schijf[naam] = {tekst: buf, mtime: klok}; }};
        }});
      dirHandle = {name: 'Trends',
        getFileHandle: async (naam, o) => { if(!schijf[naam] && !(o && o.create)) throw fout('NotFoundError'); return h(naam); },
        queryPermission: async () => 'granted', requestPermission: async () => 'granted', values: async function*(){}};
      leesKopieModus = false;
      bronnen = [{id:'g', titel:'Gewicht', bestand:'gewicht.json', eenheid:'kg', decimalen:1, meerdere_metingen:false}];
      schijf['trends.json'] = {tekst: JSON.stringify(metaFileObj()), mtime: 500};
      schijf['gewicht.json'] = {tekst: JSON.stringify({D20261016: 82.0, D20261017: 82.0}), mtime: 600};
      dataCache = {g: {D20261016: 82.0, D20261017: 82.0}}; bumpDataVersion('g');
      /* de tabel en de bronnenlijst zijn ingelezen uit het bestand. Werkt ook op 019 en
         eerder (MAP=…): daar heetten de onderdelen anders. */
      if(typeof __volledigeTabel !== 'undefined'){ __volledigeTabel.add(dataCache.g); bronnenVolledig = true; }
      if(typeof __bestandStempel !== 'undefined') __bestandStempel.set('trends.json', {lastModified: 500, size: schijf['trends.json'].tekst.length});
      if(typeof metingForceer !== 'undefined'){ metingForceer = false; metingForceerWObj = null; metingActie = 'opslaan'; }
      renderSourceList(); renderSourceSelects(); setFileLinkUI('dir', 'linked', {name: 'Trends'});
      document.getElementById('data-source-select').value = 'g';
      switchToView('data');
    });
    const wacht = ms => p.waitForTimeout(ms);
    const zien = id => p.evaluate(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && !e.hidden; }, id);
    const tekst = id => p.evaluate(id => { const e = document.getElementById(id); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : '(geen)'; }, id);
    const knop = id => p.evaluate(id => { const e = document.getElementById(id); return e.textContent.trim() + ' ' + (e.className.match(/\b(warn|danger)\b/) || ['gewoon'])[0]; }, id);
    const bestand = naam => p.evaluate(naam => window.__fs[naam] ? JSON.parse(window.__fs[naam].tekst) : null, naam);
    const focus = () => p.evaluate(() => document.activeElement && document.activeElement.id);
    const buiten = (naam, obj) => p.evaluate(([naam, obj]) => { window.__fs[naam] = {tekst: JSON.stringify(obj), mtime: 700 + Math.random()}; }, [naam, obj]);
    const meting = (key, waarde) => p.evaluate(([key, waarde]) => {
      openEditDatapointModal('g', key);
      document.getElementById('f-data-value').value = waarde;
      document.getElementById('btn-add-datapoint').click();
    }, [key, waarde]);

    console.log('Metingvenster');
    /* Sinds 1352898-020 schrijft alleen Trends in de bestanden: opslaan leest of
       vergelijkt het bestand niet meer. */
    // A. een bewerking buiten Trends om: gewoon overschreven, zonder vraag
    await opzet();
    await buiten('gewicht.json', {D20261016: 82.0, D20261017: 82.4});
    await meting('D20261017', '82.1'); await wacht(400);
    eis('bij bewerken vraagt de app niet of hij de meting zelf mag overschrijven', await zien('confirm-overlay'), false);
    eis('een bewerking buiten Trends om: opgeslagen en dicht, zonder melding', [await zien('datapoint-modal-overlay'), await tekst('data-melding')], [false, '(geen)']);
    eis('het bestand is de tabel met jouw waarde', await bestand('gewicht.json'), {D20261016: 82, D20261017: 82.1});
    // A1. opslaan raakt het bestand alleen om te schrijven (de back-up van vandaag is al gemaakt)
    await opzet();
    await p.evaluate(async () => { await idbSet('backup:gewicht.json', dateToKey(todayUTCDate()));
      window.__toegang = {opgezocht: 0, gelezen: 0}; const echt = dirHandle.getFileHandle;
      dirHandle.getFileHandle = async (n, o) => { window.__toegang.opgezocht++; const h = await echt(n, o); const g = h.getFile; h.getFile = async () => { window.__toegang.gelezen++; return g(); }; return h; }; });
    await meting('D20261018', '81.7'); await wacht(400);
    eis('opslaan: het bestand één keer opgezocht en niet gelezen', await p.evaluate(() => window.__toegang), {opgezocht: 1, gelezen: 0});
    eis('en de meting staat erin', (await bestand('gewicht.json')).D20261018, 81.7);
    // A3. een tabel zonder leeskopie overschrijft nooit een vol bestand
    await opzet(); await p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; });
    await p.evaluate(async () => { leesKopieModus = true; const echt = idbGet; idbGet = async (k) => k === 'kopie:gewicht.json' ? null : echt(k); window.__echtIdb = echt;
      delete dataCache.g; await ensureDataLoaded('g'); idbGet = echt; });
    eis('zonder leeskopie: de tabel is leeg', await p.evaluate(() => Object.keys(dataCache.g || {}).length), 0);
    await meting('D20261018', '81.6'); await wacht(500);
    eis('opslaan leest dan eerst het bestand: de metingen die er stonden blijven', await bestand('gewicht.json'), {D20261016: 82, D20261017: 82, D20261018: 81.6});
    eis('en de tabel is het bestand', await p.evaluate(() => Object.fromEntries(Object.entries(dataCache.g).sort())), {D20261016: 82, D20261017: 82, D20261018: 81.6});

    // A2. meer metingen per dag: een ANDERE meting overschrijven vraagt wel
    await opzet();
    await p.evaluate(() => { bronnen[0].meerdere_metingen = true; dataCache = {g: {D20261017T0800: 80.0, D20261017T2000: 81.0}}; bumpDataVersion('g');
      window.__fs['gewicht.json'] = {tekst: JSON.stringify(dataCache.g), mtime: 600};
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
    eis('de waarde staat in het bestand', (await bestand('gewicht.json')).D20261018, 81.5);

    // C. verwijderen met de prullenbak, ook na een bewerking buiten Trends om
    await opzet();
    await buiten('gewicht.json', {D20261016: 83.0, D20261017: 82.4});
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); verwijderMeting('g'); }); await wacht(400);
    eis('verwijderen: weg uit het bestand, het venster dicht', [await bestand('gewicht.json'), await zien('datapoint-modal-overlay')], [{D20261017: 82}, false]);

    // C2. 'Geen meting' is ook verwijderen
    await opzet();
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); }); await wacht(150);
    if(await zien('confirm-overlay')){ await p.evaluate(() => document.getElementById('confirm-ok').click()); }
    await wacht(400);
    eis("'geen meting' verwijdert hem", [await bestand('gewicht.json'), await zien('datapoint-modal-overlay')], [{D20261017: 82}, false]);

    // D. mislukte verwijdering; daarna slaat Opslaan op
    await opzet();
    await p.evaluate(() => { window.__faal = true; openEditDatapointModal('g', 'D20261016'); verwijderMeting('g'); }); await wacht(300);
    eis('mislukte verwijdering: Verwijderen mislukt.', await tekst('data-melding'), 'Verwijderen mislukt.');
    eis('de knop blijft Opslaan', await knop('btn-add-datapoint'), 'Opslaan gewoon');
    await p.evaluate(() => { window.__faal = false; document.getElementById('f-data-value').value = '79.9'; document.getElementById('btn-add-datapoint').click(); }); await wacht(300);
    eis('Opslaan slaat daarna op en verwijdert niets', (await bestand('gewicht.json')).D20261016, 79.9);

    // F. een regel die buiten Trends om in het bestand kwam: bij opslaan weg, in de back-up nog
    await opzet();
    await p.evaluate(() => idbDelete('backup:gewicht.json'));   // de eerste opslag van vandaag
    await buiten('gewicht.json', {D20261016: 82.0, D20261017: 82.0, D20261015: '81,5'});
    await meting('D20261018', '81.0'); await wacht(400);
    const naOpslaan = await bestand('gewicht.json');
    eis('opslaan: jouw meting erin, de regel van buiten eruit', [naOpslaan.D20261018, 'D20261015' in naOpslaan], [81, false]);
    eis('de eerste opslag van de dag zet het bestand van daarvoor in de back-up', /81,5/.test((await p.evaluate(() => window.__fs['gewicht_backup.json'] && window.__fs['gewicht_backup.json'].tekst)) || ''), true);

    // G. een kapot bestand
    await opzet();
    await p.evaluate(() => { window.__fs['gewicht.json'] = {tekst: '{"D20261016": 82,', mtime: 800}; });
    await meting('D20261018', '81.0'); await wacht(400);
    eis('kapot bestand, maar een volledige tabel: opgeslagen, het bestand is weer heel', await bestand('gewicht.json'), {D20261016: 82, D20261017: 82, D20261018: 81});
    await opzet();
    await p.evaluate(() => { window.__fs['gewicht.json'] = {tekst: '{"D20261016": 82,', mtime: 800}; dataCache.g = {...dataCache.g}; });
    await meting('D20261018', '81.0'); await wacht(400);
    eis('kapot bestand en een tabel die het niet weergeeft: niet opgeslagen, de melding wijst naar Vernieuwen', await tekst('data-melding'), 'Het bestand is onleesbaar. Niet opgeslagen. Vernieuwen biedt de back-up aan.');
    eis('en het bestand is ongemoeid', await p.evaluate(() => window.__fs['gewicht.json'].tekst), '{"D20261016": 82,');
    await p.evaluate(() => closeDatapointModal());

    // H. niet sluiten tijdens het opslaan
    await opzet();
    await p.evaluate(() => { window.__traag = true; openEditDatapointModal('g', 'D20261018'); document.getElementById('f-data-value').value = '81.0';
      document.getElementById('btn-add-datapoint').click(); document.getElementById('btn-cancel-datapoint').click(); document.getElementById('datapoint-modal-overlay').click(); });
    eis('tijdens het opslaan blijft het venster open', await zien('datapoint-modal-overlay'), true);
    await wacht(900);
    eis('daarna opgeslagen en dicht', (await bestand('gewicht.json')).D20261018 === 81 && !(await zien('datapoint-modal-overlay')), true);

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
    await buiten('gewicht.json', {D20261016: 82.0, D20261017: 82.0, D20261018: 70.0});
    await p.evaluate(() => { switchToView('meta'); editSource('g'); document.getElementById('f-meerdere-metingen').click(); document.getElementById('btn-save-source').click(); }); await wacht(400);
    await p.evaluate(() => ensureDataLoaded('g'));
    eis('meer metingen per dag veranderd: de metingen komen opnieuw uit het bestand', await p.evaluate(() => dataCache.g && Object.keys(dataCache.g).some(k => k.startsWith('D20261018') && dataCache.g[k] === 70)), true);

    console.log('Volgorde');
    const tweeBronnen = (extra) => p.evaluate((extra) => {
      bronnen = bronnen.concat([{id:'s', titel:'Stappen', bestand:'s.json', decimalen:0}].concat(extra ? [{id:'k', titel:'Km', bestand:'k.json', decimalen:0}] : []));
      window.__fs['trends.json'] = {tekst: JSON.stringify(metaFileObj()), mtime: 500};
      if(typeof __bestandStempel !== 'undefined') __bestandStempel.set('trends.json', {lastModified: 500, size: window.__fs['trends.json'].tekst.length});
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
    await p.evaluate(() => { window.__fs['gewicht.json'] = {tekst: JSON.stringify({D20261016: 82, D20261017: '81,5', 'D2026-10-03': 80}), mtime: 900}; delete dataCache.g; return ensureDataLoaded('g'); });
    await wacht(100);
    const alert = await tekst('alert-text');
    eis('inlezen: één melding met de regel zonder getal én de foute datumsleutel', /zonder getal \(D20261017\)/.test(alert) && /datumsleutel klopt niet/.test(alert), true);

    console.log('Derde review (1352898-015)');
    const alertWeg = () => p.evaluate(() => { const o = document.getElementById('alert-overlay'); if(o) o.style.display = 'none'; });
    // Q. bron wisselen terwijl de vorige nog laadt: de tabel hoort bij de gekozen bron
    await opzet(); await alertWeg();
    await p.evaluate(() => {
      bronnen = bronnen.concat([{id:'s', titel:'Stappen', bestand:'s.json', decimalen:0, meerdere_metingen:false}]);
      window.__fs['s.json'] = {tekst: JSON.stringify({D20261016: 5000}), mtime: 600};
      renderSourceSelects(); delete dataCache.g; delete dataCache.s;
      const echt = readJsonFromDir;
      readJsonFromDir = async (n) => { if(n === 'gewicht.json') await new Promise(r => setTimeout(r, 400)); return echt(n); };
      const sel = document.getElementById('data-source-select');
      sel.value = 'g'; renderDataView();
      setTimeout(() => { sel.value = 's'; renderDataView(); }, 50);
      window.__echtLezen = echt;
    });
    await wacht(800);
    await p.evaluate(() => { readJsonFromDir = window.__echtLezen; });
    eis('na een snelle wissel toont de tabel de gekozen bron', await p.evaluate(() => [document.getElementById('data-source-select').value, /5000/.test(document.getElementById('data-table-body').textContent), /82\.0/.test(document.getElementById('data-table-body').textContent)]), ['s', true, false]);
    // R. dubbel inlezen bij een wissel
    await opzet(); await alertWeg();
    const gelezen = await p.evaluate(async () => {
      let n = 0; const echt = readJsonFromDir;
      readJsonFromDir = async (x) => { if(x === 'gewicht.json') n++; return echt(x); };
      delete dataCache.g;
      await Promise.all([ensureDataLoaded('g'), ensureDataLoaded('g')]);
      readJsonFromDir = echt; return n;
    });
    eis('twee aanvragen tegelijk lezen het bestand één keer', gelezen, 1);
    // S. 'Geen meting' op een dag die niet in de tabel staat (daar kwam buiten Trends om een meting)
    await opzet(); await alertWeg();
    await buiten('gewicht.json', {D20261016: 82.0, D20261017: 82.0, D20261018: 79.0});
    await p.evaluate(() => openEditDatapointModal('g', 'D20261018'));   // niet in de tabel: toevoegen
    await p.evaluate(() => { editingDataKey = null; currentDatapointKey = 'D20261018'; setExplicitEmpty(true); document.getElementById('btn-add-datapoint').click(); });
    await wacht(200);
    if(await zien('confirm-overlay')) await p.evaluate(() => document.getElementById('confirm-ok').click());
    await wacht(400);
    eis("'Geen meting' op een dag die niet in de tabel staat: opgeslagen en dicht; het bestand is de tabel",
        [await bestand('gewicht.json'), await zien('datapoint-modal-overlay')], [{D20261016: 82, D20261017: 82}, false]);
    // T. bronvenster: wat geen getal is, wordt niet bewaard
    for (const [veld, waarde, melding] of [['f-decimalen', '-1', 'Decimalen'], ['f-doelx', '-', 'Doelwaarde'], ['f-min', '90', 'Min is groter']]) {
      await opzet(); await alertWeg();
      await p.evaluate(([veld, waarde]) => { switchToView('meta'); editSource('g'); if(veld === 'f-min') document.getElementById('f-max').value = '80'; document.getElementById(veld).value = waarde; document.getElementById('btn-save-source').click(); }, [veld, waarde]);
      await wacht(300);
      eis(`bronvenster: ${veld} = "${waarde}" wordt geweigerd met een melding`, [new RegExp(melding).test(await tekst('alert-text')), (await bestand('trends.json')).bronnen[0].decimalen], [true, 1]);
      await p.evaluate(() => closeSourceModal());
    }
    // U. meer metingen per dag aan en weer uit: de meting is weer te bewerken
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__fs['gewicht.json'] = {tekst: JSON.stringify({D20261016T1200: 82, D20261017T1200: 81}), mtime: 900}; delete dataCache.g; });
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
    eis('een verschil dat op 0 afrondt geeft een streepje, geen "↑ 0.0"', await p.evaluate(() => [verschilCel(0.04, 1), /0\.1/.test(verschilCel(0.06, 1)), fmtVal(-0.04, 1)]), ['–', true, '0.0']);
    // X. geen leeskopie van een bron: dat staat er
    await opzet(); await alertWeg();
    await p.evaluate(async () => { leesKopieModus = true; const echt = idbGet; idbGet = async (k) => k === 'kopie:gewicht.json' ? null : echt(k); delete dataCache.g; switchToView('data'); await renderDataView(); idbGet = echt; leesKopieModus = false; });
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
    eis('daarna opgeslagen en dicht', (await bestand('gewicht.json')).D20261018 === 81.2 && !(await zien('datapoint-modal-overlay')), true);
    eis('en het rondje is weg', await bezig('btn-add-datapoint'), false);
    // AB. snel opslaan: nooit een rondje
    await opzet(); await alertWeg();
    await bezigLog(['btn-add-datapoint']);
    await meting('D20261018', '81.3'); await wacht(400);
    eis('snel opslaan: opgeslagen, zonder dat er ooit een rondje was', [(await bestand('gewicht.json')).D20261018, await p.evaluate(() => window.__bezigOoit['btn-add-datapoint'])], [81.3, false]);
    // AC. traag verwijderen met de prullenbak: het rondje staat op de prullenbak
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = 800; });
    await bezigLog(['btn-add-datapoint', 'btn-delete-datapoint']);
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); verwijderMeting('g'); }); await wacht(450);
    eis('verwijderen via de prullenbak: het rondje staat op de prullenbak', [await bezig('btn-delete-datapoint'), await bezig('btn-add-datapoint')], [true, false]);
    eis('in plaats van het icoon', await p.evaluate(() => getComputedStyle(document.querySelector('#btn-delete-datapoint svg')).visibility), 'hidden');
    await wacht(600);
    await wacht(1200);
    eis('daarna verwijderd en geen rondje meer', ['D20261016' in (await bestand('gewicht.json')), await bezig('btn-delete-datapoint')], [false, false]);
    // AD. traag mislukt: rondje weg, knop gewoon terug
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = true; window.__faal = true; });
    await meting('D20261018', '81.4'); await wacht(900);
    eis('mislukt na wachten: melding, geen rondje, knop gewoon Opslaan', [await tekst('data-melding'), await bezig('btn-add-datapoint'), await knop('btn-add-datapoint')], ['Opslaan mislukt.', false, 'Opslaan gewoon']);
    await p.evaluate(() => { window.__faal = false; window.__traag = false; closeDatapointModal(); });
    // AE. traag opslaan na een bewerking buiten Trends om: gewoon opgeslagen, geen rondje achter
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = true; leesKopieModus = true; dirHandle.requestPermission = async () => { await new Promise(r => setTimeout(r, 500)); return 'granted'; }; });
    await buiten('gewicht.json', {D20261016: 82.0, D20261017: 82.4});
    await meting('D20261017', '82.1'); await wacht(1200);
    eis('traag, na een bewerking buiten Trends om: opgeslagen en dicht, geen rondje', [(await bestand('gewicht.json')).D20261017, await zien('datapoint-modal-overlay'), await bezig('btn-add-datapoint')], [82.1, false, false]);
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
      await idbSet('kopie:gewicht.json', {tekst: window.__fs['gewicht.json'].tekst, bestaat: true, tijd: 1});   // kopie = bestand
      const echt = idbSet; window.__echtIdbSet = echt;
      idbSet = async (k, v) => { if(k === 'kopie:gewicht.json') throw new Error('vol'); return echt(k, v); };
    });
    await meting('D20261018', '81.1'); await wacht(400);
    await p.evaluate(async () => { idbSet = window.__echtIdbSet; leesKopieModus = true; delete dataCache.g; await ensureDataLoaded('g'); });
    eis('kopie niet bij te werken: in de volgende sessie zonder toegang geldt er geen oude kopie',
        await p.evaluate(() => 'D20261018' in (dataCache.g || {}) || !tabelIsVolledig('g')), true);
    await meting('D20261019', '81.2'); await wacht(500);
    eis('en de volgende opslag houdt de meting van daarvoor', await bestand('gewicht.json'), {D20261016: 82, D20261017: 82, D20261018: 81.1, D20261019: 81.2});
    // VB. een ander bestand ingesteld terwijl het oude nog werd ingelezen
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__fs['ander.json'] = {tekst: JSON.stringify({D20260101: 70, D20260102: 71}), mtime: 1};
      const echt = readJsonFromDir; window.__echtLezen = echt;
      readJsonFromDir = async (n) => { const r = await echt(n); if(n === 'gewicht.json') await new Promise(r2 => setTimeout(r2, 800)); return r; };
      delete dataCache.g; ensureDataLoaded('g');
      switchToView('meta'); editSource('g'); document.getElementById('f-bestand').value = 'ander.json'; document.getElementById('btn-save-source').click(); });
    await wacht(1300);
    await p.evaluate(() => { readJsonFromDir = window.__echtLezen; switchToView('data'); return ensureDataLoaded('g'); }); await alertWeg();
    await meting('D20261018', '81.0'); await wacht(400);
    eis('ander bestand tijdens het inlezen: dat bestand houdt zijn eigen metingen', await bestand('ander.json'), {D20260101: 70, D20260102: 71, D20261018: 81});
    // VC. een bestand dat geen object met metingen is
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['gewicht.json'] = {tekst: JSON.stringify([{datum: '2026-10-16', waarde: 82}, {datum: '2026-10-17', waarde: 82}]), mtime: 900};
      delete dataCache.g; await ensureDataLoaded('g'); });
    await alertWeg(); await p.evaluate(() => { const o = document.getElementById('confirm-overlay'); if(o && o.style.display !== 'none') document.getElementById('confirm-cancel').click(); });
    await meting('D20261018', '81.0'); await wacht(400);
    eis('een lijst in plaats van metingen: niet opgeslagen, het bestand ongemoeid',
        [await tekst('data-melding'), Array.isArray(await bestand('gewicht.json'))], ['Het bestand is onleesbaar. Niet opgeslagen. Vernieuwen biedt de back-up aan.', true]);
    await p.evaluate(() => closeDatapointModal());
    // VD. regels die Trends niet kan lezen, blijven staan (ook de volgende dag)
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['gewicht.json'] = {tekst: JSON.stringify({D20261016: 82, D20261015: '81,5', X2026: 3, D20261017: 82}), mtime: 900};
      delete dataCache.g; await ensureDataLoaded('g'); });
    await alertWeg();
    await meting('D20261018', '81.0'); await wacht(400);
    eis('onleesbare regels: jouw meting erbij, en de regels die Trends niet kent, blijven ongewijzigd', await bestand('gewicht.json'),
        {D20261015: '81,5', D20261016: 82, D20261017: 82, D20261018: 81, X2026: 3});
    await p.evaluate(() => { openEditDatapointModal('g', 'D20261016'); verwijderMeting('g'); }); await wacht(400);
    eis('ook na nog een opslag (een verwijdering)', await bestand('gewicht.json'), {D20261015: '81,5', D20261017: 82, D20261018: 81, X2026: 3});
    await meting('D20261015', '81.5'); await wacht(400);
    eis('een meting op de dag van een onleesbare regel vervangt die regel', (await bestand('gewicht.json')).D20261015, 81.5);
    // VE. de bronnenlijst: eigen velden en ongeldige elementen blijven staan
    await opzet(); await alertWeg();
    await p.evaluate(async () => {
      window.__fs['trends.json'] = {tekst: JSON.stringify({versie: 7, bronnen: [{titel:'Gewicht', bestand:'gewicht.json', eenheid:'kg', decimalen:1, eigen_veld: 'x'}, 'geen bron', {titel:'Stappen', bestand:'s.json'}]}), mtime: 900};
      await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { switchToView('meta'); editSource('gewicht'); document.getElementById('f-titel').value = 'Gewicht 2'; document.getElementById('btn-save-source').click(); });
    await wacht(400);
    const meta = await bestand('trends.json');
    eis('bronnenlijst: jouw wijziging erin', meta.bronnen[0].titel, 'Gewicht 2');
    eis('en wat Trends niet kent, blijft: het eigen veld, het ongeldige element en de andere sleutel',
        [meta.bronnen[0].eigen_veld, meta.bronnen.includes('geen bron'), meta.versie, meta.bronnen.filter(b => b && b.titel === 'Stappen').length], ['x', true, 7, 1]);
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: {Gewicht: {bestand: 'gewicht.json'}}}), mtime: 950}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { switchToView('meta'); document.getElementById('btn-new-source') && document.getElementById('btn-new-source').click(); document.getElementById('f-titel').value = 'Nieuw'; document.getElementById('btn-save-source').click(); });
    await wacht(400);
    eis('"bronnen" is geen lijst: niets opgeslagen', JSON.stringify((await bestand('trends.json')).bronnen), JSON.stringify({Gewicht: {bestand: 'gewicht.json'}}));
    await p.evaluate(() => closeSourceModal());
    // VF. Vernieuwen terwijl een meting wordt opgeslagen
    await opzet(); await alertWeg();
    await p.evaluate(() => { window.__traag = 600; openEditDatapointModal('g', 'D20261018'); document.getElementById('f-data-value').value = '81.3';
      document.getElementById('btn-add-datapoint').click();
      setTimeout(() => { dataCache = {}; renderDataView(true); }, 100); });   // wat Vernieuwen doet, midden in het opslaan
    await wacht(1500);
    eis('Vernieuwen tijdens het opslaan: de meting staat in het bestand én in de tabel',
        [(await bestand('gewicht.json')).D20261018, await p.evaluate(() => dataCache.g && dataCache.g.D20261018)], [81.3, 81.3]);
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
    const laad = (obj) => p.evaluate(async (obj) => { window.__fs['gewicht.json'] = {tekst: JSON.stringify(obj), mtime: 900}; delete dataCache.g; await ensureDataLoaded('g'); }, obj);
    // WA. bron opslaan terwijl de volgorde nog wordt weggeschreven, en dan Annuleren
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: [{titel:'Gewicht', bestand:'gewicht.json', eenheid:'kg'}, {titel:'Stappen', bestand:'s.json'}]}), mtime: 1}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { window.__traag = 800; switchToView('meta'); selectedSourceId = 's'; moveSelectedSource(-1);
      editSource('gewicht'); document.getElementById('f-titel').value = 'Gewicht X'; document.getElementById('btn-save-source').click(); });
    await wacht(100);
    eis('tijdens het wachten staat het bronvenster vast', await p.evaluate(() => [document.getElementById('btn-save-source').disabled, document.getElementById('btn-cancel-edit').disabled, vensterBezig]), [true, true, true]);
    await p.evaluate(() => document.getElementById('btn-cancel-edit').click());
    await wacht(2500);
    eis('Annuleren werkt dan niet: geen dubbele bron, de volgorde én de nieuwe titel staan erin',
        (await bestand('trends.json')).bronnen.map(b => [b.titel, b.bestand]), [['Stappen', 's.json'], ['Gewicht X', 'gewicht.json']]);
    await p.evaluate(() => { window.__traag = false; closeSourceModal(); });
    // WB. verschuiven en een bron opslaan in dezelfde tik: allebei
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: [{titel:'Gewicht', bestand:'gewicht.json'}, {titel:'Stappen', bestand:'s.json'}]}), mtime: 1}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(() => { window.__traag = 300; switchToView('meta'); selectedSourceId = 's'; moveSelectedSource(-1);
      editSource('gewicht'); document.getElementById('f-titel').value = 'Gewicht Y'; document.getElementById('btn-save-source').click(); });
    await wacht(1500);
    eis('verschuiven en opslaan tegelijk: beide wijzigingen staan erin', (await bestand('trends.json')).bronnen.map(b => b.titel), ['Stappen', 'Gewicht Y']);
    await p.evaluate(() => { window.__traag = false; closeSourceModal(); });
    // WC. een lezing die door een opslag is ingehaald
    await opzet(); await alertWeg();
    await p.evaluate(() => { const echt = readJsonFromDir; window.__echtLezen = echt; let eerste = true;
      readJsonFromDir = async (n) => { const traag = eerste && n === 'gewicht.json'; eerste = false; const r = await echt(n); if(traag) await new Promise(r2 => setTimeout(r2, 800)); return r; };
      delete dataCache.g; ensureDataLoaded('g'); });
    await wacht(50);
    await meting('D20261018', '81.1'); await wacht(1200);
    await p.evaluate(() => { readJsonFromDir = window.__echtLezen; });
    eis('een trage lezing van vóór de opslag zet de oude stand niet terug', await p.evaluate(() => dataCache.g.D20261018), 81.1);
    await meting('D20261019', '80.9'); await wacht(400);
    eis('en de volgende opslag houdt de meting van daarvoor', (await bestand('gewicht.json')).D20261018, 81.1);
    // WD. een regel zonder getal op de dag waar een meting met tijd naartoe zou verhuizen
    await opzet(); await alertWeg();
    await laad({D20261015T0800: 80, D20261015: '81,5', D20261016: 82}); await alertWeg();
    await meting('D20261018', '79.0'); await wacht(400);
    eis('de regel zonder getal blijft, de meting met tijd ook', await bestand('gewicht.json'), {D20261015: '81,5', D20261015T0800: 80, D20261016: 82, D20261018: 79});
    // WE. herstel uit de back-up: de onleesbare regels van de back-up blijven
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['gewicht.json'] = {tekst: '{"D2026', mtime: 1}; window.__fs['gewicht_backup.json'] = {tekst: JSON.stringify({D20261010: 80, D20261011: '79,5'}), mtime: Date.now()}; delete dataCache.g; ensureDataLoaded('g'); });
    await wacht(300); await p.evaluate(() => document.getElementById('confirm-ok').click()); await wacht(500); await alertWeg();
    eis('herstel uit de back-up: ook de regel zonder getal', await bestand('gewicht.json'), {D20261010: 80, D20261011: '79,5'});
    // WF. een verwijderde bron geeft zijn eigen velden niet door aan een nieuwe met hetzelfde id
    await opzet(); await alertWeg();
    await p.evaluate(async () => { window.__fs['trends.json'] = {tekst: JSON.stringify({bronnen: [{titel:'Gewicht', bestand:'gewicht.json'}, {titel:'Oud', bestand:'oud.json', geheim:'van oud'}]}), mtime: 1}; await loadMetaFromDir(); });
    await alertWeg();
    await p.evaluate(async () => { await deleteSource('oud'); });
    await p.evaluate(() => { switchToView('meta'); resetSourceForm(); editingId = null; document.getElementById('f-titel').value = 'Nieuw'; document.getElementById('f-bestand').value = 'oud.json'; document.getElementById('btn-save-source').click(); });
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
    eis('leeskopie niet te wissen: Opslaan mislukt, het bestand ongemoeid', [await tekst('data-melding'), 'D20261018' in (await bestand('gewicht.json'))], ['Opslaan mislukt.', false]);
    await p.evaluate(() => { idbDelete = window.__echtDel; closeDatapointModal(); });

    console.log('Vangnet, derde review (1352898-023)');
    // XA. een als dubbel weggelaten meting blijft weggelaten, ook na een opslag
    await opzet(); await alertWeg();
    await laad({'20261015T0800': 80, D20261015T0800: 81, D20261016: 82}); await alertWeg();
    await meting('D20261018', '79.0'); await wacht(400);
    await p.evaluate(async () => { delete dataCache.g; await ensureDataLoaded('g'); }); await alertWeg();
    eis('na opslaan en opnieuw inlezen: op 15-10 nog steeds één meting', await p.evaluate(() => Object.keys(dataCache.g).filter(k => k.startsWith('D20261015')).length), 1);
    eis('en de weggelaten regel staat ongewijzigd in het bestand', (await bestand('gewicht.json'))['20261015T0800'], 80);
    // XB. Opslaan met een leeg veld terwijl de tabel nog laadt: de tabel komt daarna gewoon
    await opzet(); await alertWeg();
    await p.evaluate(() => { const echt = readJsonFromDir; window.__echtLezen = echt;
      readJsonFromDir = async (n) => { const r = await echt(n); if(n === 'gewicht.json') await new Promise(r2 => setTimeout(r2, 600)); return r; };
      delete dataCache.g; ensureDataLoaded('g');
      openEditDatapointModal('g', 'D20261018'); document.getElementById('f-data-value').value = ''; document.getElementById('btn-add-datapoint').click(); });
    await wacht(1000); await alertWeg();
    await p.evaluate(() => { readJsonFromDir = window.__echtLezen; closeDatapointModal(); });
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
    eis('de dag met de weggelaten dubbele meting opent als bewerken, met prullenbak', await p.evaluate(() => {
      openEditDatapointModal('g', 'D20261015');
      return [document.getElementById('datapoint-modal-title').textContent, getComputedStyle(document.getElementById('btn-delete-datapoint')).display !== 'none',
              document.getElementById('f-data-value').value]; }), ['Meting bewerken', true, '81.0']);
    await p.evaluate(() => { document.getElementById('f-data-value').value = '81.5'; document.getElementById('btn-add-datapoint').click(); });
    await wacht(400);
    eis('opslaan vraagt niet om de meting te overschrijven die je zelf bewerkt', await zien('confirm-overlay'), false);
    if(await zien('confirm-overlay')) await p.evaluate(() => document.getElementById('confirm-ok').click());
    await wacht(300); await alertWeg();
    eis('en de dag heeft daarna één meting: de nieuwe', await bestand('gewicht.json'), {D20261015: 81.5, D20261016: 82});
    // YB. opslaan terwijl de tabel nog laadt: een bestaande meting die dag wordt niet stil overschreven
    await opzet(); await alertWeg();
    await p.evaluate(() => { const echt = readJsonFromDir; window.__echtLezen = echt;
      readJsonFromDir = async (n) => { const r = await echt(n); if(n === 'gewicht.json') await new Promise(r2 => setTimeout(r2, 500)); return r; };
      delete dataCache.g; ensureDataLoaded('g');
      openEditDatapointModal('g', 'D20261016'); document.getElementById('f-data-value').value = '70'; document.getElementById('btn-add-datapoint').click(); });
    await wacht(900);
    const vraag = await zien('confirm-overlay');
    if(vraag) await p.evaluate(() => document.getElementById('confirm-cancel').click());
    await wacht(300); await alertWeg();
    await p.evaluate(() => { readJsonFromDir = window.__echtLezen; closeDatapointModal(); });
    eis('opslaan tijdens het laden: de app vraagt eerst of de meting van die dag weg mag', vraag, true);
    eis('en na Annuleren staat de oude meting er nog', (await bestand('gewicht.json')).D20261016, 82);

    console.log('Nieuwe dag (1352898-025)');
    /* De klok verzetten: window.__verschuif ms bij elke nieuwe Date() en Date.now(). */
    await p.evaluate(() => { if(window.__nepKlok) return; window.__nepKlok = true; window.__verschuif = 0;
      const Echt = Date;
      class Nep extends Echt { constructor(...a){ if(a.length) super(...a); else super(Echt.now() + window.__verschuif); }
        static now(){ return Echt.now() + window.__verschuif; } }
      window.Date = Nep; });
    const DAG = 864e5;
    const bovenste = () => p.evaluate(() => { const r = document.querySelector('#data-table-body tr'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
    /* twee metingen, 5 en 6 dagen geleden: bovenaan staat dan '⋯ 5 dagen ⋯' (de lege dagen t/m vandaag) */
    const klaarzetten = async () => {
      await opzet(); await alertWeg(); await p.evaluate(() => { window.__verschuif = 0; });
      await p.evaluate(async () => { const k = n => { const d = new Date(); d.setDate(d.getDate() - n); return 'D' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'); };
        const obj = {[k(5)]: 80, [k(6)]: 81}; window.__fs['gewicht.json'] = {tekst: JSON.stringify(obj), mtime: 900}; delete dataCache.g; await renderDataView(); });
      await wacht(300); await alertWeg();
    };
    const terug = async () => { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wacht(400); };
    // ZA. 's ochtends terughalen: de nieuwe dag staat er
    await klaarzetten();
    eis('vooraf: bovenaan de vijf lege dagen t/m vandaag', await bovenste(), '⋯ 5 dagen ⋯');
    await p.evaluate(d => { window.__verschuif = d; }, DAG);
    await terug();
    eis('na middernacht en terughalen: de nieuwe dag staat erbij', await bovenste(), '⋯ 6 dagen ⋯');
    // ZB. middernacht terwijl de app openstaat
    await klaarzetten();
    await p.evaluate(() => { const nu = new Date(); const m = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1); window.__verschuif += (m - nu) - 1500;
      if(typeof planMiddernacht === 'function') planMiddernacht(); });
    await wacht(4500);
    eis('middernacht terwijl de app openstaat: de nieuwe dag staat er vanzelf', await bovenste(), '⋯ 6 dagen ⋯');
    // ZC. een open venster: pas na het sluiten opnieuw tekenen
    await klaarzetten();
    await p.evaluate(() => { const r = document.querySelectorAll('#data-table-body tr')[1]; openEditDatapointModal('g', r.dataset.k); });
    await p.evaluate(d => { window.__verschuif += d; }, DAG);
    await terug();
    eis('venster open tijdens de wissel: de tabel blijft en het venster blijft open', [await bovenste(), await zien('datapoint-modal-overlay')], ['⋯ 5 dagen ⋯', true]);
    await p.evaluate(() => closeDatapointModal()); await wacht(500);
    eis('na het sluiten: de nieuwe dag staat erbij', await bovenste(), '⋯ 6 dagen ⋯');
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
    const vooraf = await p.evaluate(async () => { dataShowChart = true; dataPeriodFilter = '1m'; dataAggMode = 'd'; const c = document.getElementById('data-chart-canvas'); const box = document.getElementById('data-chart-preview'); box.style.display = 'none'; await renderDataChartPreview(); box.style.display = 'block'; const sel = await getChartPointsForSelection(dataPeriodFilter, 'data-range-from', 'data-range-to'); return sel ? sel.points.length : 0; });
    eis('de proef heeft punten om te tekenen', vooraf > 0, true);
    await wacht(300);
    const [na, breed] = await maat();
    eis('getekend zonder breedte, daarna zichtbaar: de grafiek past (pixels = breedte)', na, breed);
    // Z. draaien: de grafiek volgt de nieuwe breedte
    await p.setViewportSize({width: 740, height: 360}); await wacht(300);
    const [na2, breed2] = await maat();
    eis('na draaien past de grafiek weer', na2, breed2);
    await p.setViewportSize({width: 360, height: 740}); await wacht(300);

    console.log('Regressie (1352898-026)');
    // RA. twintig dagen die elke dag 0,1 dalen, tot vandaag: een perfecte lijn
    await opzet(); await alertWeg(); await wacht(300);
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 20; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 19 + i); d[dateToKey(x)] = Math.round((85 - 0.1*i)*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g');
      dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
      dataPeriodFilter = '1m'; dataAggMode = 'd'; chartViewMode = 'standard'; await renderDataView();
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
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(200);
    const st = await p.evaluate(() => { const s = window.lastChartStats, r = s.regressie;
      return r ? [s.chartMode, r.eenheid, +r.hellingPer.toFixed(3), +r.r.toFixed(3), +r.r2.toFixed(3), +r.verandering.toFixed(2)] : [s.chartMode, null]; });
    eis('regressieweergave: helling -0,7 per week, r=-1, r²=1, -1,9 over de periode', st, ['regressie', 'wk', -0.7, -1, 1, -1.9]);
    eis('de paarse lijn staat op de grafiek', (await pixels(OUDROZE)) > 300, true);
    const stipjes = () => p.evaluate(() => { const e = document.getElementById('weergave-stipjes');
      return [e.querySelectorAll('.stip').length, [...e.querySelectorAll('.stip')].findIndex(x => x.style.background !== 'rgb(58, 70, 80)'), (e.querySelector('.stip-naam') || {}).textContent || '', e.getAttribute('aria-label')]; });
    eis('onder de grafiek: vijf stipjes, de vierde gevuld, met Regressie (029)', await stipjes(), [5, 3, 'Regressie', 'Weergave 4 van 5: Regressie']);
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); }); await wacht(100);
    eis('bij de basiskaart het eerste stipje, met de naam x̄±σ (029)', await stipjes(), [5, 0, 'x±σ', 'Weergave 1 van 5: gemiddelde met sigma-grenzen']);
    const stipStand = () => p.evaluate(() => { const e = document.getElementById('weergave-stipjes'), c = document.getElementById('data-chart-canvas');
      return [Math.round(e.getBoundingClientRect().top - c.getBoundingClientRect().bottom), Math.round(e.getBoundingClientRect().height),
              getComputedStyle(e.querySelector('.stip-naam')).color, !!e.querySelector('.stip-naam .xstreep')]; });
    const basis = await stipStand();
    eis('de naam van de basiskaart in de kleur van x̄, met een streep boven de x (030)', basis.slice(2), ['rgb(79, 209, 197)', true]);
    eis('de streep staat vlak boven de x, niet bovenaan de regel (031)', await p.evaluate(() => {
      const x = document.querySelector('#weergave-stipjes .xstreep'); const st = getComputedStyle(x, '::before');
      return [st.position, parseFloat(st.top) > 0 && parseFloat(st.top) < 2 ? 'vlak boven' : st.top, x.getBoundingClientRect().top - document.getElementById('data-chart-canvas').getBoundingClientRect().bottom >= 6]; }), ['absolute', 'vlak boven', true]);
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(100);
    const trend = await stipStand();
    eis('de stipjes staan bij elke weergave even ver onder de grafiek en even hoog (030)', trend.slice(0, 2), basis.slice(0, 2));
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(100);
    eis('en de kop is paars (waarden en het label Regressie)', (await pixels(OUDROZE, true)) > 150, true);
    eis('alle punten op de lijn: de grenzen vallen samen met de lijn en worden niet getekend', await pixels(ROOD), 0);
    // RB. Analyse opent op de tab Regressie, met alleen wat bij de lijn hoort
    await p.evaluate(() => { window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    eis('Analyse: zonder de tab Kaart (de regelgrenzen staan niet in de grafiek)', await p.evaluate(() =>
      [...document.querySelectorAll('#chart-stats-tabs button')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.stattab)), ['stats', 'regressie']);
    eis('Analyse: de tab Regressie staat er en is open', await p.evaluate(() => {
      const t = document.getElementById('chart-stats-tab-regressie');
      return [getComputedStyle(t).display !== 'none', t.classList.contains('active'),
              getComputedStyle(document.getElementById('chart-stats-table-regressie')).visibility,
              getComputedStyle(document.getElementById('chart-stats-table-stats')).visibility]; }), [true, true, 'visible', 'hidden']);
    eis('met helling, Δ, lijn, r, r², spreiding en doel', await p.evaluate(() =>
      [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].map(r => [...r.cells].map(c => c.textContent.trim()).join(' '))),
      ['n 20 / 31', 'helling -0.70\u00a0/\u00a0wk', 'marge ±\u00a00.00', 'Δ -1.9', 'lijn begin 85.0', 'lijn eind 83.1', 'r\u00a0/\u00a0r² -1.00\u00a0/\u00a01.00', 'σ rond lijn 0.0', 'lijn ± 3σ ±\u00a00.0', 'lijn ± 2σ ±\u00a00.0', 'Doel –', 'doel bereikt –']);
    eis('de kop in een tint van oudroze en de actieve tab in oudroze (034)', await p.evaluate(() => [getComputedStyle(document.getElementById('chart-stats-kop')).backgroundColor,
      getComputedStyle(document.querySelector('#chart-stats-tabs button.active')).backgroundColor]), ['rgba(209, 154, 192, 0.16)', 'rgb(209, 154, 192)']);
    eis('de titel van Analyse is Regressie, in oudroze (033)', await p.evaluate(() => { const b = document.getElementById('chart-stats-titel'); return [b.textContent, getComputedStyle(b).color]; }), ['Regressie', 'rgb(209, 154, 192)']);
    await p.evaluate(() => closeChartStatsModal());
    // RC. terug naar standaard: geen derde tab meer, en het label weer blauw
    await p.evaluate(async () => { chartViewMode = 'xmr'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    eis('in een andere weergave de tab Kaart weer terug', await p.evaluate(() =>
      [...document.querySelectorAll('#chart-stats-tabs button')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.stattab)), ['stats', 'chart']);
    eis('in XmR geen tab Regressie, Statistieken open, en het label turquoise zoals x̄±σ (032)', await p.evaluate(() =>
      [getComputedStyle(document.getElementById('chart-stats-tab-regressie')).display, document.querySelector('#chart-stats-tabs button.active').dataset.stattab,
       getComputedStyle(document.getElementById('chart-stats-titel')).color, getComputedStyle(document.querySelector('#weergave-stipjes .stip-naam')).color]), ['none', 'stats', 'rgb(79, 209, 197)', 'rgb(79, 209, 197)']);
    await p.evaluate(() => closeChartStatsModal());
    // RC2. met spreiding rond de lijn: grenzen op 2σ en 3σ die met de lijn meelopen
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate(); const ruis = [0.3, -0.2, 0.1, -0.3, 0.2, 0, -0.1, 0.25, -0.25, 0.15];
      for(let i = 0; i < 20; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 19 + i); d[dateToKey(x)] = Math.round((85 - 0.1*i + ruis[i % 10])*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'regressie'; await renderDataView();
    }); await wacht(200);
    eis('trendkaart: rode en oranje grenzen rond de lijn', [(await pixels(ROOD)) > 100, (await pixels([240, 168, 79])) > 100], [true, true]);
    eis('en de spreiding rond de lijn is uitgerekend', await p.evaluate(() => window.lastChartStats.regressie.sRes > 0.1), true);
    // RE. de tabel kleurt in de trendkaart naar de lijn, net als de punten (review 026)
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate(); const ruis = [0.1, -0.1, 0.05, -0.05, 0, 0.1, -0.1, 0.05, -0.05, 0];
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - i/3 + ruis[i % 10] + (i === 15 ? 1.5 : 0))*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView();
    }); await wacht(200);
    const tabelKleuren = () => p.evaluate(() => [...document.querySelectorAll('#data-table-body td.val')].map(td => td.style.color).filter(Boolean));
    const std = await tabelKleuren();
    eis('standaard: een uitschieter boven de lijn, midden in een steile trend, valt niet op (naar het gemiddelde)', std.filter(c => /danger|warn/.test(c)), []);
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(200);
    eis('trendkaart: in de tabel wordt hij rood, net als het punt in de grafiek', (await tabelKleuren()).filter(c => /danger|warn/.test(c)), ['var(--danger)']);
    // RF. per week en per maand: de helling per groep, zonder fouten
    for(const [agg, periode, eenheid] of [['w', '3m', 'wk'], ['m', '1y', 'mnd']]){
      await p.evaluate(async ([agg, periode]) => {
        const d = {}; const t = todayUTCDate();
        for(let i = 0; i < 365; i += 2){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 364 + i); d[dateToKey(x)] = Math.round((95 - i/30 + (i % 7)/10)*10)/10; }
        dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = agg; dataPeriodFilter = periode; chartViewMode = 'regressie'; await renderDataView();
      }, [agg, periode]); await wacht(200);
      eis('regressie ' + (agg === 'w' ? 'per week' : 'per maand') + ': helling per ' + eenheid + ', dalend, met de lijn op de grafiek',
          [await p.evaluate(() => { const r = window.lastChartStats.regressie; return r && [r.eenheid, r.hellingPer < 0]; }), (await pixels(OUDROZE)) > 200], [[eenheid, true], true]);
    }
    await p.evaluate(() => { dataAggMode = 'd'; dataPeriodFilter = '1m'; });
    // RG. vier punten: wel een lijn, nog geen grenzen
    await p.evaluate(async () => { const d = {}; const t = todayUTCDate(); [80, 80.6, 79.9, 80.9].forEach((v, i) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - 3 + i); d[dateToKey(x)] = v; });
      dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'regressie'; await renderDataView(); }); await wacht(200);
    eis('vier punten: een lijn, maar nog geen grenzen', [(await pixels(OUDROZE)) > 100, await pixels(ROOD)], [true, 0]);
    // RH. 1352898-027: XmR-grenzen rond de lijn en de prognose
    await p.evaluate(async () => {
      bronnen[0].doel_x = 80;
      const d = {}; const t = todayUTCDate(); const ruis = [0.1, -0.1, 0.05, -0.05, 0, 0.1, -0.1, 0.05, -0.05, 0];
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - 0.1*i + ruis[i % 10])*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1m'; chartViewMode = 'regressie'; await renderDataView();
    }); await wacht(200);
    eis('een bron met doel en een dalende trend: de prognose staat achteraan in de veegvolgorde',
        await p.evaluate(() => grafiekWeergaven().join()), 'standard,xmr,range,regressie,regressieXmr,prognose');
    await p.evaluate(async () => { chartViewMode = 'regressieXmr'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(150);
    eis('Regressie XmR: het label, en in Analyse r̄ en de XmR-grenzen', await p.evaluate(() => [document.getElementById('chart-stats-titel').textContent,
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr td:first-child')].map(td => td.textContent.trim()).filter(t => /rond lijn|lijn ±/.test(t))]),
        ['Regressie XmR', ['r rond lijn', 'lijn ± 2.66r', 'lijn ± 1.77r']]);
    eis('met grenzen op de grafiek', (await pixels(ROOD)) > 100, true);
    await p.evaluate(() => closeChartStatsModal());
    await p.evaluate(async () => { dataAggMode = 'w'; await renderDataView(); });
    eis('per week geen XmR-variant: dan de gewone trendkaart', await p.evaluate(() => window.lastChartStats.chartMode), 'regressie');
    await p.evaluate(async () => { dataAggMode = 'd'; chartViewMode = 'prognose'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(150);
    const verwacht = await p.evaluate(() => { const r = window.lastChartStats.regressie; return fmtDateNL(dateToKey(new Date(Math.ceil((r.t0 + (80 - r.snijpunt)/r.helling*864e5)/864e5)*864e5))); });
    eis('Prognose: het label, de datum in Analyse, geen grenzen en geen gekleurde rijen', await p.evaluate(() => [document.getElementById('chart-stats-titel').textContent,
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].map(r => r.cells[0].textContent.trim() + ' ' + r.cells[1].textContent.trim()).find(t => /^doel bereikt/.test(t)),
        [...document.querySelectorAll('#data-table-body td.val')].map(td => td.style.color).filter(c => /danger|warn/.test(c)).length]),
        ['Prognose', 'doel bereikt ' + verwacht, 0]);
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
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'w'; dataPeriodFilter = '3m'; chartViewMode = 'prognose'; await renderDataView();
    }); await wacht(200);
    const pw = await p.evaluate(() => { const s = window.lastChartStats; return [s.chartMode, s.regressie.xProg > s.regressie.xEind + 1, s.prognose > todayUTCDate()]; });
    eis('prognose per week: het doel ligt na de laatste week', pw, ['prognose', true, true]);
    eis('en de stippellijn en het ringetje staan rechts, voorbij de metingen', (await pixelsRechts([180, 142, 240], 0.85)) > 0 && (await pixelsRechts(OUDROZE, 0.7)) > 0, true);
    const onderRechts = rgb => p.evaluate(rgb => {
      const c = document.getElementById('data-chart-canvas'), x = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
      const d = x.getImageData(Math.round(c.width*0.6), Math.round((220-36)*dpr), Math.round(c.width*0.4), Math.round(36*dpr)).data; let n = 0;
      for(let i = 0; i < d.length; i += 4) if(Math.abs(d[i]-rgb[0]) < 12 && Math.abs(d[i+1]-rgb[1]) < 12 && Math.abs(d[i+2]-rgb[2]) < 12) n++;
      return n; }, rgb);
    eis('de datum van de prognose staat rechts onder de grafiek, in de kleur van de lijn', (await onderRechts(OUDROZE)) > 20, true);
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(150);
    eis('in de gewone trendkaart daar een gewone datum', await onderRechts(OUDROZE), 0);
    // RH3. een prognose ver weg: de metingen blijven leesbaar breed
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - 0.01*i + [0.002, -0.002][i % 2])*1000)/1000; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1m'; chartViewMode = 'prognose'; await renderDataView();
    }); await wacht(200);
    eis('doel jaren weg: de as loopt hooguit drie keer de periode door (punten ook voorbij 15% van de breedte)',
        [await p.evaluate(() => window.lastChartStats.prognose.getUTCFullYear() > todayUTCDate().getUTCFullYear()), (await pixelsRechts([159, 216, 224], 0.15)) > 0], [true, true]);
    await p.evaluate(() => { closeChartStatsModal(); delete bronnen[0].doel_x; });
    // RJ. geen aantoonbare trend: een vraagteken, en geen prognose in de rij
    await p.evaluate(async () => { bronnen[0].doel_x = 70; const d = {}; const t = todayUTCDate(); [80, 81, 79.5, 80.5, 80.2, 79.8, 80.6].forEach((v, i) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - 6 + i); d[dateToKey(x)] = v; });
      dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'regressie'; await renderDataView(); });
    eis('schommelen zonder trend: niet aantoonbaar, en geen prognose', await p.evaluate(() => [window.lastChartStats.regressie.aantoonbaar, grafiekWeergaven().includes('prognose')]), [false, false]);
    // RK. een doel buiten de schaal: geen lijn door de datums onder de grafiek
    await p.evaluate(async () => { bronnen[0].doel_x = 60; chartViewMode = 'regressie'; await renderDataView(); }); await wacht(150);
    eis('een doel ver onder de metingen: niet getekend (eerder liep de lijn door de datums)', await pixels([180, 142, 240]), 0);
    await p.evaluate(() => { delete bronnen[0].doel_x; });
    // RL. review 029: een prognose die al voorbij is, telt niet; Prog valt dan terug naar Regr
    await p.evaluate(async () => {
      bronnen[0].doel_x = 80; const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 40; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 80 + i); d[dateToKey(x)] = Math.round((84 - 0.15*i + [0.1, -0.1][i % 2])*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '3m'; chartViewMode = 'prognose'; await renderDataView();
    }); await wacht(300);
    eis('het doel werd (volgens de lijn) al voor vandaag bereikt: geen prognose, terug naar Regr',
        await p.evaluate(() => [window.lastChartStats.prognose, chartViewMode, grafiekWeergaven().includes('prognose')]), [null, 'regressie', false]);
    // review 029: de gekozen rij blijft gekozen als Prog terugvalt naar Regr
    await p.evaluate(async () => { const k = Object.keys(dataCache.g).sort().pop(); selectedDataKey = k; window.__gekozen = k; chartViewMode = 'prognose'; await renderDataView(true); });
    await wacht(300);
    eis('na de terugval naar Regr is de gekozen rij nog gekozen', await p.evaluate(() => [chartViewMode, selectedDataKey === window.__gekozen]), ['regressie', true]);
    // review 029: grafiek verbergen terwijl je op Prog staat: terug naar Regr, en de tabel kleurt weer
    await p.evaluate(async () => { bronnen[0].doel_x = 70; const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((90 - 0.3*i + [0.1, -0.1, 0.05][i % 3] + (i === 15 ? 2 : 0))*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'prognose'; await renderDataView(true); await setDataShowChart(false); });
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
      bronnen[0].decimalen = 2; dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'regressie'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); });
    await wacht(150);
    eis('320 breed, twee decimalen: de tab Regressie past in het venster', await past(), true);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);   /* history.back eerst laten afronden */
    // 037: r en r² op één regel, ook met getallen van zes cijfers (kilometerstand) en in Regressie XmR
    await p.evaluate(async () => {
      const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i); d[dateToKey(x)] = Math.round((123456.78 + 41.3*i + [9.1, -7.4, 3.2][i % 3])*100)/100; }
      bronnen[0].decimalen = 2; dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'regressieXmr'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); });
    await wacht(150);
    eis('320 breed, zes cijfers, Regressie XmR: past, met één regel r / r²', [await past(), await p.evaluate(() =>
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr td:first-child')].map(td => td.textContent.trim()).filter(t => /^r(²|$|\u00a0\/)/.test(t)))],
      [true, ['r / r²']]);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); });
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
    await p.evaluate(async () => { const t = todayUTCDate(); dataCache = {g: {[dateToKey(t)]: 80}}; bumpDataVersion('g'); chartViewMode = 'regressie'; await renderDataView(); }); await wacht(200);
    eis('één punt: geen regressie en geen fout', await p.evaluate(() => [window.lastChartStats.chartMode, window.lastChartStats.regressie]), ['regressie', null]);
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); });
    // 038: geen blauwe pijltjes meer links en rechts van de grafiek; de stipjes eronder blijven
    await p.evaluate(async () => { const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 20; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 19 + i); d[dateToKey(x)] = 80 + (i % 3); }
      dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView(); }); await wacht(200);
    eis('geen blauwe pijltjes aan de randen, wel de stipjes', await p.evaluate(() => {
      const c = document.getElementById('data-chart-canvas'), ctx = c.getContext('2d'), s = c.width / c.clientWidth;
      const blauw = (x) => { const d = ctx.getImageData(Math.round(x*s), 0, Math.max(1, Math.round(6*s)), c.height).data;
        for(let i = 0; i < d.length; i += 4) if(d[i] < 110 && d[i+1] > 120 && d[i+2] > 210 && d[i+3] > 200) return true; return false; };
      return [blauw(0), blauw(c.clientWidth - 6), document.querySelectorAll('#weergave-stipjes .stip').length > 1];
    }), [false, false, true]);

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
