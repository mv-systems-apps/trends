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
    // 13528A4-01B: het doel weghalen wist ook de opgeslagen stand van de laag Doel
    await opzet(); await alertWeg();
    await p.evaluate(() => { localStorage.setItem('trends.doel.g', '0'); localStorage.setItem('trends.doel.g.regressie', '0'); for(const k of Object.keys(__laagStand)) delete __laagStand[k]; switchToView('meta'); editSource('g'); document.getElementById('f-doelx').value = ''; document.getElementById('f-doelr').value = ''; document.getElementById('btn-save-source').click(); });
    await wacht(400);
    eis('het doel weghalen: de opgeslagen stand "Doel uit" is weg, zodat een nieuw doel weer zichtbaar is (01B)', await p.evaluate(() => [localStorage.getItem('trends.doel.g'), localStorage.getItem('trends.doel.g.regressie'), laagIsAan('doel')]), [null, null, true]);
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
    eis('onder de grafiek: drie stipjes, de derde gevuld, met Regressie (029, 13528A3-002)', await stipjes(), [3, 2, 'Regressie', 'Weergave 3 van 3: Regressie']);
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); }); await wacht(100);
    eis('bij de basiskaart het eerste stipje, met de naam x̄±σ (029)', await stipjes(), [3, 0, 'x±σ', 'Weergave 1 van 3: gemiddelde met sigma-grenzen']);
    // 13528A3-002: de XmR-schakelaar rechts; aan maakt dezelfde kaart met XmR-grenzen, links blijft x̄±σ
    const xmrStand = () => p.evaluate(() => { const k = document.getElementById('btn-xmr'), e = document.getElementById('weergave-stipjes'), c = document.getElementById('data-chart-canvas');
      return [k.disabled, k.classList.contains('aan'), k.getAttribute('aria-pressed'), effectieveWeergave(), e.querySelector('.stip-naam').textContent,
              k.getBoundingClientRect().right <= document.getElementById('lagen-knoppen').getBoundingClientRect().left + 1 && Math.abs(document.getElementById('lagen-knoppen').getBoundingClientRect().right - c.getBoundingClientRect().right) < 30, e.getBoundingClientRect().left - c.getBoundingClientRect().left < 20]; });
    eis('XmR-schakelaar rechts onder de grafiek (vóór de lagenknoppen), uit; de stipjes links', await xmrStand(), [false, false, 'false', 'standard', 'x±σ', true, true]);
    await p.click('#btn-xmr'); await wacht(150);
    eis('een tik: XmR aan, de kaart met XmR-grenzen, links nog steeds x̄±σ', await xmrStand(), [false, true, 'true', 'xmr', 'x±σ', true, true]);
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(100);
    eis('XmR blijft aan bij Regressie: Regressie XmR', await p.evaluate(() => effectieveWeergave()), 'regressieXmr');
    await p.evaluate(async () => { chartViewMode = 'range'; await renderDataView(); }); await wacht(100);
    eis('bij Range kan XmR niet: de schakelaar is uitgegrijsd', await p.evaluate(() => [document.getElementById('btn-xmr').disabled, effectieveWeergave()]), [true, 'range']);
    await p.evaluate(async () => { chartViewMode = 'standard'; dataAggMode = 'w'; await renderDataView(); }); await wacht(100);
    eis('per week kan XmR niet: uitgegrijsd en de gewone kaart', await p.evaluate(() => [document.getElementById('btn-xmr').disabled, effectieveWeergave()]), [true, 'standard']);
    await p.evaluate(async () => { dataAggMode = 'd'; await renderDataView(); }); await wacht(100);
    eis('de keuze is onthouden voor deze bron', await p.evaluate(() => [localStorage.getItem('trends.xmr.g'), effectieveWeergave()]), ['1', 'xmr']);
    await p.click('#btn-xmr'); await wacht(150);
    eis('nog een tik: XmR weer uit', await p.evaluate(() => [effectieveWeergave(), localStorage.getItem('trends.xmr.g')]), ['standard', '0']);
    // 13528A4-01F: vier lagenknoppen naast XmR (eerder één lagenknop met een menu, 13528A3-003)
    const GEEL = [232, 197, 71];
    /* per knop: + aan, - uit, / kan niet bij deze kaart */
    const lagen = () => p.evaluate(() => [...document.querySelectorAll('#lagen-knoppen .laag-knop')].map(b => b.dataset.laag +
      (b.getAttribute('aria-disabled') === 'true' ? '/' : b.getAttribute('aria-pressed') === 'true' && b.classList.contains('aan') ? '+' : b.getAttribute('aria-pressed') === 'false' && !b.classList.contains('aan') ? '-' : '?')).join());
    const melding = () => p.evaluate(() => document.getElementById('grafiek-melding').textContent);
    eis('vier lagenknoppen rechts naast XmR: grenzen aan, doel kan niet (geen doel), run-regels en vorig jaar uit (01F)', [await lagen(),
      await p.evaluate(() => document.getElementById('lagen-knoppen').getBoundingClientRect().left >= document.getElementById('btn-xmr').getBoundingClientRect().right - 1)], ['grenzen+,doel/,run-,jaar-', true]);
    eis('zonder run-regels geen gele punten', await pixels(GEEL), 0);
    await p.click('#lagen-knoppen [data-laag="run"]'); await wacht(200);
    eis('één tik zet de run-regels aan: knop turquoise en ingedrukt, geen venster, onthouden voor deze bron en deze kaart (01F)',
        [await lagen(), await p.evaluate(() => [modalStack.length, localStorage.getItem('trends.run.g.' + basisWeergave(chartViewMode))])], ['grenzen+,doel/,run+,jaar-', [0, '1']]);
    eis('de rechte daling: 7+ boven en 7+ onder x̄ en één trend over alles', await p.evaluate(() => { const r = window.lastChartStats.runs; return [r.kant.map(k => k.richting).join(), r.trend.length, r.trend[0].van, r.trend[0].tot === window.lastChartStats.n - 1]; }),
        ['1,-1', 1, 0, true]);
    eis('gele punten en strepen op de grafiek', (await pixels(GEEL)) > 300, true);
    eis('in de schermlezertekst: met run-regels', await p.evaluate(() => document.getElementById('weergave-stipjes').getAttribute('aria-label')), 'Weergave 1 van 3: gemiddelde met sigma-grenzen, met run-regels');
    await p.click('#data-chart-canvas'); await wacht(200);
    eis('een tik op de grafiek opent Analyse meteen (geen menu meer dat de tik opvangt)', await p.evaluate(() => document.getElementById('chart-stats-modal-overlay').style.display), 'flex');
    eis('Analyse, tab Kaart: hoe vaak elke run-regel voorkomt', await p.evaluate(() => [...document.querySelectorAll('#chart-stats-modal-body-chart tr')].slice(-2).map(r => r.textContent)), ['≥7 één kant2×', '≥6 op rij ↗↘1×']);
    await p.keyboard.press('Escape'); await wacht(200);
    await p.click('#lagen-knoppen [data-laag="doel"]', {force: true}); await wacht(150);  /* force: Playwright telt aria-disabled als niet klikbaar */
    eis('een tik op een uitgegrijsde laag: de reden, en er verandert niets (01F)', [await melding(), await lagen()], ['Deze bron heeft geen doel', 'grenzen+,doel/,run+,jaar-']);
    // toetsenbord: de knoppen staan gewoon in de tabvolgorde; Enter en Spatie schakelen
    await p.focus('#lagen-knoppen [data-laag="run"]'); await p.keyboard.press('Enter'); await wacht(150);
    const naEnter = await lagen(); await p.keyboard.press(' '); await wacht(150);
    eis('toetsenbord: Enter zet de run-regels uit, Spatie weer aan; de focus blijft op de knop (01F)',
        [naEnter, await lagen(), await p.evaluate(() => document.activeElement && document.activeElement.dataset.laag)], ['grenzen+,doel/,run-,jaar-', 'grenzen+,doel/,run+,jaar-', 'run']);
    await p.focus('#btn-xmr'); const tabs = [];
    for(let i = 0; i < 4; i++){ await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => document.activeElement && document.activeElement.dataset.laag)); }
    eis('Tab na XmR langs de vier lagen, ook de uitgegrijsde (die zegt waarom) (01F)', tabs, ['grenzen', 'doel', 'run', 'jaar']);
    eis('Prognose: alle vier uitgegrijsd; een tik op Grenzen zegt waarom (01F)', await p.evaluate(async () => {
      const oud = [bronnen[0].doel_x, bronnen[0].doel_r]; bronnen[0].doel_x = 70; bronnen[0].doel_r = undefined;
      chartViewMode = 'prognose'; await renderDataView(true);
      const st = [effectieveWeergave(), [...document.querySelectorAll('#lagen-knoppen .laag-knop')].map(b => b.getAttribute('aria-disabled')).join()];
      document.querySelector('#lagen-knoppen [data-laag="grenzen"]').click(); await new Promise(r => setTimeout(r, 120));
      st.push(document.getElementById('grafiek-melding').textContent);
      [bronnen[0].doel_x, bronnen[0].doel_r] = oud; chartViewMode = 'standard'; await renderDataView(true); return st; }), ['prognose', 'true,true,true,true', 'Prognose heeft geen grenzen']);
    eis('elke reden bij een uitgegrijsde laag; een tik verandert de opgeslagen stand niet (020)', await p.evaluate(async () => {
      const oud = [bronnen[0].doel_x, dataAggMode], uit = [], tik = async l => { const voor = JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('trends.')).sort().map(k => k + '=' + localStorage.getItem(k)));
        document.querySelector(`#lagen-knoppen [data-laag="${l}"]`).click(); await new Promise(r => setTimeout(r, 100));
        const na = JSON.stringify(Object.keys(localStorage).filter(k => k.startsWith('trends.')).sort().map(k => k + '=' + localStorage.getItem(k)));
        uit.push(document.getElementById('grafiek-melding').textContent + (voor === na ? '' : ' (stand veranderd)')); };
      bronnen[0].doel_x = 70; chartViewMode = 'range'; await renderDataView(true); await tik('doel'); await tik('run'); await tik('jaar');
      dataAggMode = 'y'; chartViewMode = 'standard'; await renderDataView(true); await tik('jaar');
      [bronnen[0].doel_x, dataAggMode] = oud; chartViewMode = 'standard'; await renderDataView(true); return uit; }),
      ['Range heeft geen doel', 'Run-regels alleen bij x̄±σ en Regressie', 'Vorig jaar alleen bij x̄±σ en Regressie', 'Vorig jaar kan niet per jaar']);
    eis('Prognose: de knop Doel staat aan (het doel is er altijd), wel uitgegrijsd (020)', await p.evaluate(async () => {
      const oud = bronnen[0].doel_x; bronnen[0].doel_x = 70; chartViewMode = 'prognose'; await renderDataView(true);
      const k = document.querySelector('#lagen-knoppen [data-laag="doel"]'), r = [effectieveWeergave(), k.getAttribute('aria-pressed'), k.getAttribute('aria-disabled'), k.classList.contains('aan')];
      bronnen[0].doel_x = oud; chartViewMode = 'standard'; await renderDataView(true); return r; }), ['prognose', 'true', 'true', true]);
    for(const breed of [280, 250]){
      await p.setViewportSize({width: breed, height: 740}); await wacht(150);
      eis(`${breed} breed: de langste melding blijft binnen het scherm (020)`, await p.evaluate(async () => { chartViewMode = 'range'; await renderDataView(true);
        document.querySelector('#lagen-knoppen [data-laag="run"]').click(); await new Promise(r => setTimeout(r, 120));
        const m = document.querySelector('#grafiek-melding .melding-tekst').getBoundingClientRect(); chartViewMode = 'standard'; await renderDataView(true);
        return [m.left >= 0, m.right <= innerWidth]; }), [true, true]);
    }
    await p.setViewportSize({width: 360, height: 740}); await wacht(150);
    // 01F/020: de naam van de kaart wordt korter als het smal wordt; de stipjes blijven (vaste maat)
    {
      /* per kaart: de naam, ! als de rij overloopt, > als de knoppen buiten de kaart vallen, ~ als een stipje niet 7 px is, het aantal stipjes, ^ als de naam over twee regels breekt */
      const namen = metDoel => p.evaluate(async metDoel => { const uit = [], oud = bronnen[0].doel_x;
        if(metDoel) bronnen[0].doel_x = Math.round(window.lastChartStats.minVal - 3);
        for(const w of ['standard', 'range', 'regressie', 'prognose']){ chartViewMode = w; await renderDataView(true);
          if(basisWeergave(chartViewMode) !== w) continue;
          const el = document.getElementById('weergave-stipjes'), st = [...el.querySelectorAll('.stip')], kn = document.getElementById('lagen-knoppen').getBoundingClientRect(), kaart = document.getElementById('data-chart-preview').getBoundingClientRect();
          uit.push(el.querySelector('.stip-naam').textContent + (el.scrollWidth > el.clientWidth + 0.5 ? '!' : '') + (kn.right > Math.min(kaart.right, innerWidth) + 0.5 ? '>' : '') +
            (st.every(x => Math.abs(x.getBoundingClientRect().width - 7) < 0.1) ? '' : '~') + st.length + (el.querySelector('.stip-naam').getBoundingClientRect().height > 20 ? '^' : '')); }
        bronnen[0].doel_x = oud; chartViewMode = 'standard'; await renderDataView(true); return uit.join(); }, metDoel);
      const uit = {};
      for(const breed of [360, 320, 300, 280]){ await p.setViewportSize({width: breed, height: 740}); await wacht(150); uit[breed] = [await namen(false), await namen(true)]; }
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      eis('360 breed: de volle namen, stipjes van 7 px, drie of vier kaarten (01F/020)', uit[360], ['x±σ3,Range3,Regressie3', 'x±σ4,Range4,Regressie4,Prognose4']);
      eis('320 breed: met vier kaarten eerst Regressie naar Regr (020)', uit[320], ['x±σ3,Range3,Regressie3', 'x±σ4,Range4,Regr4,Prognose4']);
      eis('300 breed: Regr en Prog; de stipjes blijven 7 px, niets loopt over of breekt (020)', uit[300], ['x±σ3,Range3,Regr3', 'x±σ4,Range4,Regr4,Prog4']);
      eis('280 breed: Rng en x̄; met vier kaarten R en P, en waar niets past alleen de stipjes (020)', uit[280], ['x±σ3,Rng3,Regr3', 'x4,4,R4,P4']);
      eis('weer breed: weer de volle naam (01F)', await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(true); const t = document.querySelector('#weergave-stipjes .stip-naam').textContent; chartViewMode = 'standard'; await renderDataView(true); return t; }), 'Regressie');
      eis('naam past zich aan bij een smaller venster, ook zonder nieuwe render (resize) (020)', await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(true); return true; })
        .then(async () => { await p.setViewportSize({width: 300, height: 740}); await wacht(200); const t = await p.evaluate(() => document.querySelector('#weergave-stipjes .stip-naam').textContent);
          await p.setViewportSize({width: 360, height: 740}); await wacht(200); const t2 = await p.evaluate(() => document.querySelector('#weergave-stipjes .stip-naam').textContent);
          await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(true); }); return [t, t2]; }), ['Regr', 'Regressie']);
      eis('opnieuw tekenen zonder verandering schrijft de naam niet opnieuw (020)', await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(true);
        const n = document.querySelector('#weergave-stipjes .stip-naam'); let m = 0; const ob = new MutationObserver(r => { m += r.length; }); ob.observe(n, {childList: true, characterData: true, subtree: true});
        await renderDataView(true); await new Promise(r => setTimeout(r, 30)); ob.disconnect(); chartViewMode = 'standard'; await renderDataView(true); return m; }), 0);
    }
    eis('per meting, drie dagen met gelijke daggemiddelden: niet aantoonbaar, een streepje bij marge (13528A4-004/005)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen], t = todayUTCDate(), d = {};
      [[2, '0700', 80.0], [2, '2200', 80.4], [1, '0700', 80.1], [1, '2200', 80.3], [0, '0700', 80.0], [0, '2200', 80.4]].forEach(([terug, tijd, v]) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - terug); d[dateToKey(x) + 'T' + tijd] = v; });
      bronnen[0].meerdere_metingen = true; dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'p'; chartViewMode = 'regressie'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal();
      const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'marge');
      const uit = [rij && rij.cells[1].textContent, window.lastChartStats.regressie && window.lastChartStats.regressie.aantoonbaar];
      closeChartStatsModal(); [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen] = oud; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView(); return uit; }), ['–', false]);
    await wacht(200);
    eis('per meting, ochtend en avond: kop, Analyse en de lijn door de daggemiddelden zeggen dezelfde helling (13528A4-005/007)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen], t = todayUTCDate(), d = {};
      for(let i = 0; i < 10; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 9 + i); const m = 82 - 0.05*i + [0.1, -0.1, 0.05][i % 3];
        d[dateToKey(x) + 'T0700'] = Math.round((m - 1)*10)/10; if(i % 4 !== 2) d[dateToKey(x) + 'T2200'] = Math.round((m + 1)*10)/10; }
      bronnen[0].meerdere_metingen = true; dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'p'; chartViewMode = 'regressie';
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
      const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(t => t.cells[0].textContent === 'helling').cells[1].textContent.replace(/\s/g, '');
      closeChartStatsModal(); [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen] = oud; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView();
      return [Math.abs(r.helling - b) < 1e-9, kop.length === 1 && kop[0].replace(/\s/g, '') === rij]; }), [true, true]);
    await wacht(200);
    eis('de opgeslagen stand van de oude knik-laag wordt opgeruimd (13528A4-003)', await p.evaluate(() => {
      if(typeof ruimOudeLagenOp !== 'function') return ['geen ruimOudeLagenOp'];
      localStorage.setItem('trends.knik.g', '1'); localStorage.setItem('trends.run.x', '1'); ruimOudeLagenOp();
      const r = [localStorage.getItem('trends.knik.g'), localStorage.getItem('trends.run.x')]; localStorage.removeItem('trends.run.x'); return r; }), [null, '1']);
    await wacht(200);
    // 13528A4-001: de live region alleen bijwerken als er iets verandert; de stipjes zelf verborgen voor de schermlezer
    eis('opnieuw tekenen zonder verandering: de live region blijft ongemoeid; stipjes en naam aria-hidden', await p.evaluate(async () => {
      const el = document.getElementById('weergave-stipjes'), voor = el.firstChild; await renderDataView(true);
      return [el.firstChild === voor, el.firstChild.getAttribute('aria-hidden'), el.querySelectorAll('.sr-alleen').length]; }), [true, 'true', 1]);
    eis('de stand staat als tekst in de live region (niet alleen in aria-label)', await p.evaluate(() => document.querySelector('#weergave-stipjes .sr-alleen').textContent),
        'Weergave 1 van 3: gemiddelde met sigma-grenzen, met run-regels');
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(150);
    eis('lagen per kaart: run-regels aan bij x̄±σ staan bij Regressie nog uit; daar zelf aan te zetten (01D)', await p.evaluate(async () => {
      const r = [laagIsAan('run'), document.querySelector('#lagen-knoppen [data-laag="run"]').classList.contains('aan')]; zetLaag('run', true); await renderDataView();
      r.push(laagIsAan('run'), localStorage.getItem('trends.run.g.regressie')); return r; }), [false, false, true, '1']);
    eis('bij Regressie rond de lijn: een rechte lijn door alle punten, dus geen runs', await p.evaluate(() => { const r = window.lastChartStats.runs; return [r.kant.length, r.trend.length]; }), [0, 0]);
    await p.evaluate(async () => { chartViewMode = 'range'; await renderDataView(); }); await wacht(150);
    eis('bij Range geen run-regels: die laag uitgegrijsd (Grenzen kan wel), geen geel (01A/01F)', [await lagen(), await p.evaluate(() => window.lastChartStats.runs || null), await pixels(GEEL)], ['grenzen+,doel/,run/,jaar/', null, 0]);
    await p.evaluate(async () => { chartViewMode = 'standard'; dataAggMode = 'w'; await renderDataView(); }); await wacht(150);
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
    await p.evaluate(async () => { dataAggMode = 'd'; chartViewMode = 'regressie'; await renderDataView(); }); await wacht(150);
    eis('bij Regressie rond de lijn: geen runs, dus ook in de tabel geen geel', (await tabelGeel())[0], 0);
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); }); await wacht(150);
    await p.evaluate(async () => { dataAggMode = 'd'; await renderDataView(); }); await wacht(150);
    await p.click('#lagen-knoppen [data-laag="run"]'); await wacht(200);
    eis('nog eens: run-regels uit, geen geel meer', [await lagen(), await p.evaluate(() => localStorage.getItem('trends.run.g.' + basisWeergave(chartViewMode))), await pixels(GEEL)], ['grenzen+,doel/,run-,jaar-', '0', 0]);
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
    eis('vier lagenknoppen, geen knik meer; zonder doel is Doel grijs (13528A3-007, 01A/01F)', await items(), 'grenzen+,doel-,run+,jaar+');
    const bewaard = await p.evaluate(async () => {
      const oud = dataCache.g; const d = {}; const t = todayUTCDate(); const ruis = [0.2, -0.15, 0.1, -0.1, 0.05];
      for(let i = 0; i < 31; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 30 + i);
        d[dateToKey(x)] = Math.round((84.3 + (i > 18 ? -0.12*(i - 18) : 0) + ruis[i % 5])*10)/10;
        const v = new Date(x); v.setUTCFullYear(v.getUTCFullYear() - 1); d[dateToKey(v)] = 86 + (i % 3)*0.1; }
      dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'regressie'; await renderDataView(); return oud; });
    await wacht(150);
    eis('bij Regressie kunnen grenzen, run-regels en vorig jaar', await items(), 'grenzen+,doel-,run+,jaar+');
    const pastAnalyse = (breed) => p.evaluate(async () => { zetLaag('run', true); await renderDataView(true); openChartStatsModal();
      const b = document.querySelector('#chart-stats-modal-overlay .modal-box').getBoundingClientRect(), t = document.getElementById('chart-stats-table-regressie').getBoundingClientRect();
      const r = [t.right <= b.right + 0.5, document.querySelectorAll('#chart-stats-modal-body-regressie tr').length];
      closeChartStatsModal(); zetLaag('run', false); await renderDataView(true); return r; });
    eis('360 breed, run-regels aan: de tabel Regressie past in het venster', await pastAnalyse(), [true, 14]);
    await p.setViewportSize({width: 320, height: 700}); await wacht(250);
    eis('320 breed: ook', (await pastAnalyse())[0], true);
    await p.setViewportSize({width: 360, height: 740}); await wacht(250);
    await p.evaluate(async () => { bronnen[0].doel_x = 82; chartViewMode = 'prognose'; await renderDataView(); }); await wacht(150);
    eis('bij de Prognose kan geen laag: alle lagenknoppen uitgegrijsd', [await p.evaluate(() => window.lastChartStats.chartMode), await items()], ['prognose', 'grenzen-,doel-,run-,jaar-']);
    await p.evaluate(async () => { delete bronnen[0].doel_x; chartViewMode = 'standard'; await renderDataView(); }); await wacht(150);
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
    eis('per jaar kan vorig jaar niet', [await items(), await p.evaluate(() => window.lastChartStats.vorigJaar)], ['grenzen+,doel-,run+,jaar-', undefined]);
    // 13528A4-021: de trend van vorig jaar bij Regressie
    {
      const vj = await p.evaluate(async () => {
        const oud = [dataCache.g, dataPeriodFilter, dataAggMode], d = {}, t = todayUTCDate();
        /* vorig jaar stijgend (0,02 per dag), dit jaar dalend; elke derde dag geen meting */
        for(let i = 0; i < 760; i++){ if(i % 3 === 1) continue; const x = new Date(t); x.setUTCDate(x.getUTCDate() - 759 + i);
          d[dateToKey(x)] = Math.round((i < 394 ? 80 + 0.02*i : 87.88 - 0.03*(i - 394)) * 10 + [2, -1, 1, -2, 0][i % 5]) / 10; }
        dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1y'; dataAggMode = 'd'; chartViewMode = 'regressie'; zetLaag('jaar', true);
        const uit = {};
        await renderDataView(true); const st = window.lastChartStats, tr = st.vorigJaarTrend;
        /* nagerekend: de kleinste-kwadratenlijn door de punten van vorig jaar die in de grafiek staan */
        const lbl = []; const echt = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(tk){ if(/^vorig jaar/.test(tk)) lbl.push(tk); return echt.apply(this, arguments); };
        try{ await renderDataView(true); } finally { CanvasRenderingContext2D.prototype.fillText = echt; }
        uit.jaar = [!!tr, tr && +(tr.hellingPer).toFixed(3), tr && tr.aantoonbaar, lbl[0]];
        window.chartSwipeJustHappened = false; openChartStatsModal();
        const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'vorig jaar');
        uit.rij = rij ? rij.cells[1].textContent.replace(/\s/g, ' ') : null; closeChartStatsModal();
        dataAggMode = 'w'; await renderDataView(true); uit.week = [!!window.lastChartStats.vorigJaarTrend, window.lastChartStats.vorigJaarTrend && +window.lastChartStats.vorigJaarTrend.hellingPer.toFixed(2)];
        dataAggMode = 'd'; dataPeriodFilter = '1m'; await renderDataView(true); uit.kort = window.lastChartStats.vorigJaarTrend;
        window.chartSwipeJustHappened = false; openChartStatsModal();
        const rij2 = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'vorig jaar');
        uit.kortRij = rij2 ? rij2.cells[1].textContent : null; closeChartStatsModal();
        dataPeriodFilter = '1y'; chartViewMode = 'standard'; await renderDataView(true); uit.std = window.lastChartStats.vorigJaarTrend;
        chartViewMode = 'regressie'; zetLaag('jaar', false); await renderDataView(true); uit.uit = window.lastChartStats.vorigJaarTrend;
        [dataCache.g, dataPeriodFilter, dataAggMode] = oud; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView(true);
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
          chartViewMode = w || 'regressie'; zetLaag('jaar', true); await renderDataView(true); return window.lastChartStats.vorigJaarTrend; };
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
        zetXmr(true); uit.xmr = [!!await zet(vjMet(30, 150), '6m'), effectieveWeergave()]; zetXmr(false);
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
        const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'vorig jaar');
        uit.rij = rij ? /\(\?\)$/.test(rij.cells[1].textContent) : null; closeChartStatsModal();
        [dataCache.g, dataPeriodFilter, dataAggMode, bronnen[0].decimalen] = oud; bumpDataVersion('g'); chartViewMode = 'regressie'; zetLaag('jaar', false); chartViewMode = 'standard'; await renderDataView(true);
        return uit; });
      for(const breed of [300, 320]){
        await p.setViewportSize({width: breed, height: 740}); await wacht(150);
        eis(`${breed} breed, vorig jaar met (?) en run-regels, waarden rond 12.345,67: de tabel Regressie binnen het venster (022)`, await p.evaluate(async () => {
          const oud = [dataCache.g, dataPeriodFilter, dataAggMode, bronnen[0].decimalen], t = todayUTCDate(), d = {}; let z = 3; const rnd = () => (z = (z*1103515245 + 12345) % 2147483648)/2147483648;
          for(let i = 0; i < 560; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - i); d[dateToKey(x)] = Math.round((12345.67 + (i < 365 ? -0.5*i : 0) + (rnd() - 0.5)*400)*100)/100; }
          dataCache = {g: d}; bumpDataVersion('g'); bronnen[0].decimalen = 2; dataPeriodFilter = '6m'; dataAggMode = 'd'; chartViewMode = 'regressie'; zetLaag('jaar', true); zetLaag('run', true); await renderDataView(true);
          window.chartSwipeJustHappened = false; openChartStatsModal();
          const box = document.querySelector('#chart-stats-modal-overlay .modal-box'), cs = getComputedStyle(box), t2 = document.getElementById('chart-stats-table-regressie').getBoundingClientRect();
          const rij = [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].find(r => r.cells[0].textContent === 'vorig jaar');
          const r = [!!rij && /\(\?\)/.test(rij.cells[1].textContent), t2.right <= box.getBoundingClientRect().right - parseFloat(cs.paddingRight) + 0.5];
          closeChartStatsModal(); zetLaag('jaar', false); zetLaag('run', false); [dataCache.g, dataPeriodFilter, dataAggMode, bronnen[0].decimalen] = oud; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView(true); return r; }), [true, true]);
      }
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      eis('per week met een gat van 6 weken vorig jaar: de helling op de weken van de as, zoals nagerekend (022)', [vj2.gat[0], vj2.gat[0] === vj2.gat[1]], [vj2.gat[1], true]);
      eis('grenzen: 9 metingen nee, 10 ja (over 100 dagen); 30 metingen over 70 dagen nee, over 85 dagen ja (022)', vj2.grens, [false, true, false, true]);
      eis('per maand over 6 maanden: de metingen van vorig jaar tellen, niet de 6 punten (022)', vj2.maand, true);
      eis('ook bij Regressie XmR (022)', vj2.xmr, [true, 'regressieXmr']);
      eis('periode Alles of een eigen periode van 2 jaar: Vorig jaar uitgegrijsd met de reden, niet getekend; bij 1 jaar weer aan (023)', await p.evaluate(async () => {
        const oud = [dataPeriodFilter, document.getElementById('data-range-from').value, document.getElementById('data-range-to').value, dataAggMode], uit = []; dataAggMode = 'd';
        const k = document.querySelector('#lagen-knoppen [data-laag="jaar"]'), stand = () => [k.getAttribute('aria-disabled'), window.lastChartStats.vorigJaar === undefined];
        chartViewMode = 'standard'; zetLaag('jaar', true); dataPeriodFilter = 'all'; await renderDataView(true); uit.push(...stand());
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
        dataCache = {g: d}; bumpDataVersion('g'); chartViewMode = 'standard'; bronnen[0].meerdere_metingen = false;
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
      const std = await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView();
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
        eis(`${breed} breed: XmR en de vier lagenknoppen naast elkaar, binnen de kaart en het scherm (01F)`, await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView();
          const kn = [...document.querySelectorAll('#lagen-knoppen .laag-knop')].map(b => b.getBoundingClientRect()), x = document.getElementById('btn-xmr').getBoundingClientRect(), k = document.getElementById('data-chart-preview').getBoundingClientRect();
          return [kn.every((r, i) => Math.abs(r.top - x.top) < 1 && (i === 0 ? r.left >= x.right - 0.5 : r.left >= kn[i-1].right - 0.5)), kn[3].right <= Math.min(k.right, innerWidth) + 0.5]; }), [true, true]);
      }
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      /* 01B: de tabel met Grenzen uit, ook per week, per meting, bij Range en bij XmR */
      eis('Grenzen uit: geen rode of oranje waarden in de tabel per meting, bij Range en bij XmR; met Grenzen aan wel (01B)', await p.evaluate(async () => {
        const kleur = () => [...document.querySelectorAll('#view-data td')].filter(td => /--danger|--warn/.test(td.getAttribute('style') || '')).length, uit = [];
        for(const [agg, w, xmr] of [['p', 'standard', false], ['d', 'range', false], ['d', 'standard', true]]){
          dataAggMode = agg; chartViewMode = w; zetXmr(xmr); zetLaag('grenzen', true); await renderDataView(); const aan = kleur();
          zetLaag('grenzen', false); await renderDataView(); uit.push(aan > 0, kleur()); }
        zetXmr(false); dataAggMode = 'd'; chartViewMode = 'standard'; zetLaag('grenzen', true); await renderDataView(); return uit; }), [true, 0, true, 0, true, 0]);
      eis('Grenzen uit: XmR grijs; een tik zegt "Zet grenzen aan" en verandert niets; de live region noemt geen XmR-grenzen (01B)', await p.evaluate(async () => {
        zetXmr(true); zetLaag('grenzen', false); chartViewMode = 'standard'; await renderDataView();
        const k = document.getElementById('btn-xmr'), voor = effectieveWeergave(); k.click(); await new Promise(r => setTimeout(r, 120));
        const uit = [k.getAttribute('aria-disabled'), k.classList.contains('aan'), document.getElementById('grafiek-melding').textContent, effectieveWeergave() === voor,
                     /XmR-grenzen/.test(document.querySelector('#weergave-stipjes .sr-alleen').textContent)];
        zetLaag('grenzen', true); await renderDataView(); uit.push(k.getAttribute('aria-disabled'), k.classList.contains('aan'));
        zetXmr(false); await renderDataView(); return uit; }), ['true', false, 'Zet grenzen aan', true, false, null, true]);
      eis('per bron: Grenzen uit bij deze bron staat bij een andere bron gewoon aan (01B)', await p.evaluate(() => {
        zetLaag('grenzen', false); const hier = laagIsAan('grenzen'); const sel = document.getElementById('data-source-select'), oud = sel.value;
        bronnen.push({id: 'h', titel: 'Ander', bestand: 'ander.json'}); const o = document.createElement('option'); o.value = 'h'; sel.appendChild(o); sel.value = 'h';
        const daar = laagIsAan('grenzen'); sel.value = oud; o.remove(); bronnen.pop(); zetLaag('grenzen', true); return [hier, daar]; }), [false, true]);
      /* 01D: de lagen per kaart (bijvoorbeeld km-stand: geen grenzen bij x̄±σ, wel bij Regressie) */
      eis('per kaart: Grenzen uit bij x̄±σ; Range en Regressie houden hun grenzen; XmR alleen bij x̄±σ grijs (01D)', await p.evaluate(async () => {
        vergeetLaag('grenzen', 'g'); vergeetLaag('doel', 'g'); dataAggMode = 'd'; zetXmr(true); const r = [];
        chartViewMode = 'standard'; zetLaag('grenzen', false); await renderDataView();
        const k = document.getElementById('btn-xmr'), lk = document.querySelector('#lagen-knoppen [data-laag="grenzen"]');
        r.push(laagIsAan('grenzen'), k.getAttribute('aria-disabled'), effectieveWeergave(), lagenTekst());
        for(const w of ['range', 'regressie']){ chartViewMode = w; await renderDataView(); r.push(laagIsAan('grenzen'), lk.getAttribute('aria-pressed')); }
        r.push(k.getAttribute('aria-disabled'), effectieveWeergave());
        zetXmr(false); vergeetLaag('grenzen', 'g'); chartViewMode = 'standard'; await renderDataView(); return r; }),
        [false, 'true', 'standard', 'zonder grenzen', true, 'true', true, 'true', null, 'regressieXmr']);
      eis('per kaart: Regressie zonder grenzen tekent geen rood; x̄±σ ernaast nog wel (01D)', await (async () => {
        await p.evaluate(async () => { vergeetLaag('grenzen', 'g'); chartViewMode = 'regressie'; zetLaag('grenzen', false); await renderDataView(); }); await wacht(80);
        const reg = await pixels(ROOD);
        await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); }); await wacht(80);
        const std = await pixels(ROOD); await p.evaluate(async () => { vergeetLaag('grenzen', 'g'); await renderDataView(); }); return [reg, std > 50]; })(), [0, true]);
      eis('een stand van vóór 01D (per bron) geldt voor elke kaart, tot je per kaart iets kiest (01D)', await p.evaluate(async () => {
        vergeetLaag('grenzen', 'g'); localStorage.setItem('trends.grenzen.g', '0'); const r = [];
        for(const w of ['standard', 'range', 'regressie']){ chartViewMode = w; r.push(laagIsAan('grenzen')); }
        zetLaag('grenzen', true); r.push(laagIsAan('grenzen')); chartViewMode = 'standard'; r.push(laagIsAan('grenzen'));
        vergeetLaag('grenzen', 'g'); r.push(localStorage.getItem('trends.grenzen.g'), localStorage.getItem('trends.grenzen.g.regressie'), laagIsAan('grenzen'));
        await renderDataView(); return r; }), [false, false, false, true, false, null, null, true]);
      /* 01E: de reviewpunten van 01D */
      eis('de keuze per kaart wint van een oude stand per bron, ook na herstarten (opnieuw gelezen uit de opslag) (01E)', await p.evaluate(async () => {
        vergeetLaag('grenzen', 'g'); localStorage.setItem('trends.grenzen.g', '0'); chartViewMode = 'regressie'; zetLaag('grenzen', true);
        for(const k of Object.keys(__laagStand)) delete __laagStand[k];
        const r = [laagIsAan('grenzen')]; chartViewMode = 'standard'; r.push(laagIsAan('grenzen'));
        vergeetLaag('grenzen', 'g'); await renderDataView(); return r; }), [true, false]);
      eis('het doel weghalen bij bron g laat de keuzes van bron g_2 staan (01E)', await p.evaluate(() => {
        localStorage.setItem('trends.doel.g_2', '0'); localStorage.setItem('trends.doel.g_2.standard', '0'); localStorage.setItem('trends.doel.g.standard', '0');
        vergeetLaag('doel', 'g');
        const r = [localStorage.getItem('trends.doel.g.standard'), localStorage.getItem('trends.doel.g_2'), localStorage.getItem('trends.doel.g_2.standard')];
        localStorage.removeItem('trends.doel.g_2'); localStorage.removeItem('trends.doel.g_2.standard'); return r; }), [null, '0', '0']);
      eis('een bron verwijderen wist zijn lagen en XmR: een nieuwe bron met dezelfde naam begint met de standaard (01E)', await p.evaluate(async () => {
        const sel = document.getElementById('data-source-select'), oud = sel.value, stand = [dataPeriodFilter, dataAggMode];
        bronnen.push({id: 'tmpx', titel: 'Tijdelijk', bestand: 'tmpx.json'});
        for(const k of ['trends.doel.tmpx.standard', 'trends.run.tmpx.regressie', 'trends.grenzen.tmpx', 'trends.xmr.tmpx']) localStorage.setItem(k, k.endsWith('regressie') || k.endsWith('xmr.tmpx') ? '1' : '0');
        __laagStand['doel.tmpx.standard'] = false; __xmrStand.tmpx = true;
        await verwijderBron('tmpx');
        const over = Object.keys(localStorage).filter(k => /\.tmpx(\.|$)/.test(k));
        const r = [bronnen.some(b => b.id === 'tmpx'), over.length, 'doel.tmpx.standard' in __laagStand, 'tmpx' in __xmrStand];
        sel.value = oud; [dataPeriodFilter, dataAggMode] = stand; syncPeriodButtonsActive(); chartViewMode = 'standard'; await renderDataView(); return r; }), [false, 0, false, false]);
      /* 01C: de reviewpunten van 01B */
      const doelZonder = await p.evaluate(async () => {
        const oud = [bronnen[0].doel_x, bronnen[0].doel_r]; chartViewMode = 'standard'; dataAggMode = 'd'; zetLaag('doel', true); zetLaag('grenzen', false);
        await renderDataView(); bronnen[0].doel_x = Math.round((window.lastChartStats.maxVal + 0.3)*10)/10; bronnen[0].doel_r = null; await renderDataView();
        return [bronnen[0].doel_x, document.getElementById('data-chart-canvas').__schaal.slice(), oud]; });
      const paarsZonder = await pixels(PAARS);
      eis('doel zonder bereik, Grenzen uit en Doel aan: het doel in beeld en getekend (01C)', [doelZonder[1][1] > doelZonder[0], paarsZonder > 20], [true, true]);
      eis('doel zonder bereik, Doel uit: de as hoeft niet tot het doel (01C)', await p.evaluate(async () => { zetLaag('doel', false); await renderDataView();
        const sch = document.getElementById('data-chart-canvas').__schaal; zetLaag('doel', true); return sch[1] < bronnen[0].doel_x; }), true);
      await p.evaluate(async (oud) => { [bronnen[0].doel_x, bronnen[0].doel_r] = oud; zetLaag('grenzen', true); await renderDataView(); }, doelZonder[2]);
      eis('x̄±σ met Grenzen uit: de schermlezer zegt "gemiddelde, zonder grenzen", niet "met sigma-grenzen" (01C)', await p.evaluate(async () => {
        chartViewMode = 'standard'; zetLaag('grenzen', false); await renderDataView(); const t = document.querySelector('#weergave-stipjes .sr-alleen').textContent;
        zetLaag('grenzen', true); await renderDataView(); return [/: gemiddelde, zonder grenzen/.test(t), /sigma-grenzen/.test(t)]; }), [true, false]);
      eis('XmR gekozen, dan Grenzen uit: Analyse rekent zonder XmR; Grenzen weer aan: weer XmR (01C)', await p.evaluate(async () => {
        chartViewMode = 'standard'; dataAggMode = 'd'; zetXmr(true); zetLaag('grenzen', false); await renderDataView();
        window.chartSwipeJustHappened = false; openChartStatsModal(); await new Promise(r => setTimeout(r, 100));
        const titel = document.getElementById('chart-stats-titel').textContent, w = effectieveWeergave();
        history.back(); await new Promise(r => setTimeout(r, 150)); zetLaag('grenzen', true); await renderDataView();
        const terug = effectieveWeergave(); zetXmr(false); await renderDataView(); return [/XmR/.test(titel), w, terug]; }), [false, 'standard', 'xmr']);
      eis('Grenzen uit, snelle dubbele tik op XmR: één melding (01C)', await p.evaluate(async () => {
        zetLaag('grenzen', false); chartViewMode = 'standard'; await renderDataView(); const k = document.getElementById('btn-xmr');
        k.click(); await new Promise(r => setTimeout(r, 20)); k.click(); await new Promise(r => setTimeout(r, 150));
        const n = document.querySelectorAll('#grafiek-melding .melding-tekst').length; zetLaag('grenzen', true); await renderDataView(); return n; }), 1);
      eis('Grenzen uit: geen rode of oranje waarden in de tabel per week en bij Regressie; met Grenzen aan wel (01C)', await p.evaluate(async () => {
        const kleur = () => [...document.querySelectorAll('#view-data td')].filter(td => /--danger|--warn/.test(td.getAttribute('style') || '')).length, uit = [];
        /* een week ver boven de rest, zodat ook het weekgemiddelde buiten de grenzen valt */
        const bewaar = dataCache.g, d = Object.assign({}, bewaar), sleutels = Object.keys(d).sort().slice(-10, -3);
        for(const k of sleutels) d[k] = d[k] + 3; dataCache = {g: d}; bumpDataVersion('g');
        for(const [agg, w] of [['w', 'standard'], ['d', 'regressie']]){
          dataAggMode = agg; chartViewMode = w; zetLaag('grenzen', true); await renderDataView(); const aan = kleur();
          zetLaag('grenzen', false); await renderDataView(); uit.push(aan > 0, kleur()); }
        dataCache = {g: bewaar}; bumpDataVersion('g');
        dataAggMode = 'd'; chartViewMode = 'standard'; zetLaag('grenzen', true); await renderDataView(); return uit; }), [true, 0, true, 0]);
      await p.evaluate(async () => { chartViewMode = 'range'; zetLaag('grenzen', true); await renderDataView(); }); await wacht(80); const rangeAan = await pixels(ROOD);
      await p.evaluate(async () => { zetLaag('grenzen', false); await renderDataView(); }); await wacht(80); const rangeUit = await pixels(ROOD);
      eis('Range: Grenzen uit haalt de rode grens weg (01C)', [rangeAan > 50, rangeUit], [true, 0]);
      eis('XmR gekozen met Grenzen en Doel uit: de as alleen rond de metingen (01C)', await p.evaluate(async () => {
        chartViewMode = 'standard'; zetXmr(true); zetLaag('doel', false); zetLaag('grenzen', false); await renderDataView();
        const s = document.getElementById('data-chart-canvas').__schaal, st = window.lastChartStats, m = 0.1*(st.maxVal - st.minVal);
        const uit = s[0] >= st.minVal - m && s[1] <= st.maxVal + m; zetXmr(false); zetLaag('doel', true); zetLaag('grenzen', true); await renderDataView(); return uit; }), true);
      await p.setViewportSize({width: 360, height: 740}); await wacht(150);
      await p.evaluate(async (oud) => { zetLaag('grenzen', true); zetLaag('doel', true);
        vergeetLaag('grenzen', 'g'); vergeetLaag('doel', 'g');
        [dataCache.g, bronnen[0].doel_x, bronnen[0].doel_r, dataPeriodFilter] = oud; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView(); }, bewaardG);
      await wacht(150);
    }

    await p.evaluate(async (oud) => { dataCache = {g: oud}; bumpDataVersion('g'); chartViewMode = 'standard'; await renderDataView(); }, bewaard); await wacht(150);
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
    await p.evaluate(async () => { dataAggMode = 'd'; chartViewMode = 'range'; await renderDataView(); }); await wacht(150);
    eis('bij Range geen Week en Jaar, ook niet grijs (017)', (await tabStand())[0], 'stats,chart');
    await p.evaluate(async () => { chartViewMode = 'xmr'; await renderDataView(); }); await wacht(150);
    eis('bij XmR wel Week en Jaar (017)', (await tabStand())[0], 'stats,chart,week,jaar-');
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); });
    // 13528A4-009: reviewpunten 008
    eis('per meting, periode Alles: de eerste dag (met een tijd) telt mee in Patroon', await p.evaluate(async () => {
      const oud = [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen, dataPeriodFilter], t = todayUTCDate(), d = {};
      [[15, '0700', 80.0], [15, '2200', 80.4], ...[...Array(15).keys()].map(i => [14 - i, '0700', 80 + i*0.01])].forEach(([terug, tijd, v]) => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - terug); d[dateToKey(x) + 'T' + tijd] = v; });
      bronnen[0].meerdere_metingen = true; dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'p'; dataPeriodFilter = 'all'; chartViewMode = 'standard'; await renderDataView();
      const pt = window.lastChartStats.patroon, uit = pt ? pt.b - pt.a : 0;
      [dataCache.g, dataAggMode, bronnen[0].meerdere_metingen, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), 16);
    await wacht(150);
    eis('eigen periode: de einddatum telt mee en de dag erna niet (00A)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], d = {}, t = todayUTCDate();
      for(let i = 0; i < 30; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 29 + i); d[dateToKey(x)] = 80 + i*0.01; }
      const iso = n => { const x = new Date(t); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'custom'; dataAggMode = 'd'; chartViewMode = 'standard';
      document.getElementById('data-range-from').value = iso(20); document.getElementById('data-range-to').value = iso(5);
      await renderDataView();
      const pt = window.lastChartStats.patroon, uit = [pt ? pt.b - pt.a : 0, pt ? dateToKey(pt.daily[pt.b - 1].date) === iso(5).replace(/-/g, '') : false];
      document.getElementById('data-range-from').value = ''; document.getElementById('data-range-to').value = '';
      [dataCache.g, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), [16, true]);
    {
      /* de oude keuze van de tab Patroon wordt bij het laden opgeruimd (017) */
      const ctxL = await browser.newContext({viewport: {width: 360, height: 740}});
      await ctxL.addInitScript(() => { try{ if(!sessionStorage.getItem('gezet')){ localStorage.setItem('trends.patroon', 'maand'); sessionStorage.setItem('gezet', '1'); } }catch(e){} });
      const pl = await ctxL.newPage(); const foutenL = []; pl.on('pageerror', e => foutenL.push(e.message));
      await pl.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await pl.waitForTimeout(400);
      eis('de oude opgeslagen keuze trends.patroon is na het laden weg, zonder fouten (017)', [await pl.evaluate(() => localStorage.getItem('trends.patroon')), foutenL.length], [null, 0]);
      await ctxL.close();
    }
    // 13528A4-010: app-brede review
    eis('Week pas vanaf 14 dagen: 13 dagen per dag Week grijs, 14 dagen te kiezen (010/017)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], t = todayUTCDate(), uit = [];
      for(const n of [13, 14]){ const d = {}; for(let i = 0; i < n; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - n + 1 + i); d[dateToKey(x)] = 80 + i*0.01; }
        dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; chartViewMode = 'standard'; await renderDataView(); uit.push(!!(window.lastChartStats.patroon && window.lastChartStats.patroon.weekdag)); }
      [dataCache.g, dataPeriodFilter] = oud; bumpDataVersion('g'); await renderDataView(); return uit; }), [false, true]);
    for(const breed of [360, 300]){
      await p.setViewportSize({width: breed, height: 740}); await wacht(150);
      eis(`${breed} breed: de tabel Patroon past ook bij een kilometerstand rond 120.000 (0 decimalen, Maand) en bij 12.345,67 (2 decimalen, Weekdag) (010)`, await p.evaluate(async () => {
        const oud = [dataCache.g, dataPeriodFilter, bronnen[0].decimalen], t = todayUTCDate(), uit = [];
        for(const [basis, dec, keus] of [[120000, 0, 'maand'], [12345.67, 2, 'weekdag']]){
          const d = {}; for(let i = 0; i < 800; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 799 + i); d[dateToKey(x)] = Math.round((basis + 40*i + ((i*7919) % 13)*3.37)*100)/100; }
          bronnen[0].decimalen = dec; dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'all'; dataAggMode = 'd'; chartViewMode = 'standard'; await renderDataView();
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
    eis('run-regels: het label "N op rij" staat gecentreerd boven het midden van de run (011; in 010 een halve labelbreedte te ver naar links)', await p.evaluate(async () => {
      const oud = [dataCache.g, dataPeriodFilter], t = todayUTCDate(), d = {};
      for(let i = 0; i < 30; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 29 + i); d[dateToKey(x)] = 80 + (i >= 10 && i < 20 ? 0.3 : (i % 2 ? 0.3 : -0.3)); }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; chartViewMode = 'standard'; zetLaag('run', true);
      const P = CanvasRenderingContext2D.prototype, echt = {f: P.fillText, m: P.moveTo, l: P.lineTo}, lijn = [], tekst = [];
      P.fillText = function(tk, x, y){ if(/op rij/.test(tk)) tekst.push([x, this.measureText(tk).width]); return echt.f.apply(this, arguments); };
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
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '1m'; dataAggMode = 'd'; chartViewMode = 'standard'; await renderDataView();
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
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = '3m'; chartViewMode = 'standard'; await renderDataView();   /* 017: Week alleen bij x̄±σ, de trend telt toch niet mee */
      window.chartSwipeJustHappened = false; openChartStatsModal(); setStatsTab('week');
      const rijen = [...document.querySelectorAll('#chart-stats-modal-body-patroon tr')].slice(0, 7);
      const kleuren = rijen.map(r => getComputedStyle(r.querySelector('.wd-deel') || r.querySelector('.wd-balk span:last-child')).backgroundColor);
      const uit = [rijen[0].cells[0].textContent, kleuren[0], kleuren.slice(1).every(k => k === 'rgb(93, 107, 115)'), !document.querySelector('.wd-noot'),
        document.getElementById('chart-stats-table-patroon').style.visibility];
      closeChartStatsModal(); dataCache = {g: oud}; bumpDataVersion('g'); dataPeriodFilter = '1m'; chartViewMode = 'standard'; await renderDataView(); return uit; });
    eis('91 dagen, maandag 0,3 zwaarder, met een dalende trend: in x̄±σ, rond de trendlijn, alleen maandag buiten de grens (in de kleur van de kaart), de rest grijs',
        wd91, ['ma', 'rgb(79, 209, 197)', true, true, 'visible']);
    await wacht(200);
    await p.setViewportSize({width: 300, height: 700}); await wacht(200);
    eis('300 breed: de vier tabs van x̄±σ (Statistieken, Kaart, Week, Jaar) passen in hun knop, de tabel Week en in Regressie de tabel Regressie in het venster (017)', await p.evaluate(async () => {
      const past = sel => [...document.querySelectorAll(sel)].filter(b => b.style.display !== 'none').map(b => b.scrollWidth <= b.clientWidth + 1);
      const box = () => document.querySelector('#chart-stats-modal-overlay .modal-box').getBoundingClientRect().right + 0.5;
      chartViewMode = 'standard'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal();
      const r = past('#chart-stats-tabs button'); setStatsTab('week');
      const wdPast = document.getElementById('chart-stats-table-patroon').getBoundingClientRect().right <= box(); closeChartStatsModal();
      chartViewMode = 'regressie'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal();
      const regPast = document.getElementById('chart-stats-table-regressie').getBoundingClientRect().right <= box();
      closeChartStatsModal(); chartViewMode = 'standard'; await renderDataView(); return [r.length, r.every(Boolean), wdPast, regPast]; }), [4, true, true, true]);
    await p.setViewportSize({width: 360, height: 740}); await wacht(200);
    // drie jaar, licht dalend, met een seizoen: per maand, ook in x̄±σ rond de trendlijn (00C)
    const seizoen = await p.evaluate(async () => {
      const oud = dataCache.g, d = {}, t = todayUTCDate();
      for(let i = 0; i < 365*3; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 365*3 + 1 + i); const m = x.getUTCMonth();
        d[dateToKey(x)] = Math.round((84 - 0.002*i + (m === 0 || m === 1 ? 0.8 : m === 6 || m === 7 ? -0.8 : 0) + 0.1*Math.sin(i*1.3))*10)/10; }
      dataCache = {g: d}; bumpDataVersion('g'); dataPeriodFilter = 'all'; dataAggMode = 'm'; chartViewMode = 'standard'; await renderDataView();
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
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(100);
    const trend = await stipStand();
    eis('de stipjes staan bij elke weergave even ver onder de grafiek en even hoog (030)', trend.slice(0, 2), basis.slice(0, 2));
    await p.evaluate(async () => { chartViewMode = 'regressie'; await renderDataView(); }); await wacht(100);
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
          zetXmr(w === 'regressieXmr'); chartViewMode = basisWeergave(w); await renderDataView();
          CanvasRenderingContext2D.prototype.fillText = echt;
          uit[w] = (effectieveWeergave() === w ? '' : 'getekend als ' + effectieveWeergave() + ': ') + log.filter(([t, vet]) => vet).map(([t, vet, k]) => k).join();
          uit[w + ' r²'] = (log[log.findIndex(([t]) => t === 'r²=') + 1] || []).slice(1).join();
        }
      } finally { CanvasRenderingContext2D.prototype.fillText = echt; zetXmr(false); chartViewMode = was[0]; bronnen[0].doel_x = was[1]; await renderDataView(); }
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
      ['n 20 / 31', 'helling -0.70\u00a0/\u00a0wk', 'marge ±\u00a00.00', 'Δ -1.9', 'lijn begin 85.0', 'lijn eind 83.1', 'r\u00a0/\u00a0r² -1.00\u00a0/\u00a01.00', 'σ rond lijn 0.0', 'lijn ± 3σ ±\u00a00.0', 'lijn ± 2σ ±\u00a00.0', 'Doel –', 'doel bereikt –']);
    // 13528A1-003: de kleur van elke waarde past bij wat de grafiek toont
    const kl003 = (id) => p.evaluate(id => Object.fromEntries([...document.querySelectorAll('#' + id + ' tr')].map(r =>
      [r.cells[0].textContent.trim(), getComputedStyle(r.cells[1]).color])), id);
    const RZ3 = 'rgb(209, 154, 192)', WIT = 'rgb(231, 237, 240)', RD = 'rgb(239, 91, 91)', OR = 'rgb(240, 168, 79)';
    const reg3 = await kl003('chart-stats-modal-body-regressie');
    eis('Regressie: helling, lijn begin en eind oudroze; marge, Δ, r en σ wit; banden rood en oranje; geen doel: wit (004)',
        [reg3['helling'], reg3['marge'], reg3['Δ'], reg3['lijn begin'], reg3['lijn eind'], reg3['r\u00a0/\u00a0r²'], reg3['σ rond lijn'], reg3['lijn ± 3σ'], reg3['lijn ± 2σ'], reg3['Doel'], reg3['doel bereikt'], reg3['n']],
        [RZ3, WIT, WIT, RZ3, RZ3, WIT, WIT, RD, OR, WIT, WIT, WIT]);
    eis('Statistieken bij regressie: x̄ wit, want er is geen gemiddelde lijn', Object.values(await kl003('chart-stats-modal-body'))[1], WIT);
    eis('de kop in een tint van oudroze en de actieve tab in oudroze (034)', await p.evaluate(() => [getComputedStyle(document.getElementById('chart-stats-kop')).backgroundColor,
      getComputedStyle(document.querySelector('#chart-stats-tabs button.active')).backgroundColor]), ['rgba(209, 154, 192, 0.16)', 'rgb(209, 154, 192)']);
    eis('de titel van Analyse is Regressie, in oudroze (033)', await p.evaluate(() => { const b = document.getElementById('chart-stats-titel'); return [b.textContent, getComputedStyle(b).color]; }), ['Regressie', 'rgb(209, 154, 192)']);
    await p.evaluate(() => closeChartStatsModal());
    // 13528A1-003: in de gewone kaart x̄ turquoise; Doel lavendel met een waarde, anders een witte –
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    const std3 = await kl003('chart-stats-modal-body'), kaart3 = await kl003('chart-stats-modal-body-chart');
    eis('gewone kaart: x̄ turquoise, geen doel: witte –', [Object.values(std3)[1], kaart3['Doel'], kaart3['Doel·min']], ['rgb(79, 209, 197)', WIT, WIT]);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    await p.evaluate(async () => { chartViewMode = 'range'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    const rng3 = await kl003('chart-stats-modal-body-chart');
    eis('Range: UCL rood, UWL en LWL zonder waarde een witte –', [rng3['UCL(3.267×r)'] || Object.values(rng3)[0], Object.values(rng3)[1], Object.values(rng3)[2]], [RD, WIT, WIT]);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    await p.evaluate(async () => { chartViewMode = 'standard'; await renderDataView(); }); await wacht(100);
    await p.evaluate(async () => { bronnen[0].doel_x = 80; bronnen[0].doel_r = 2; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
    const kaart23 = await kl003('chart-stats-modal-body-chart');
    eis('met een doel: lavendel', [kaart23['Doel'], kaart23['Doel·bereik']], ['rgb(180, 142, 240)', 'rgb(180, 142, 240)']);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    await p.evaluate(async () => { delete bronnen[0].doel_x; delete bronnen[0].doel_r; chartViewMode = 'regressie'; await renderDataView(); }); await wacht(100);
    // RC. terug naar standaard: geen derde tab meer, en het label weer blauw
    await p.evaluate(async () => { chartViewMode = 'xmr'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(100);
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
        await p.evaluate(() => grafiekWeergaven().join()), 'standard,range,regressie,prognose');
    await p.evaluate(async () => { zetXmr(true); chartViewMode = 'regressie'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(150);
    eis('Regressie XmR: het label, en in Analyse r̄ en de XmR-grenzen', await p.evaluate(() => [document.getElementById('chart-stats-titel').textContent,
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr td:first-child')].map(td => td.textContent.trim()).filter(t => /rond lijn|lijn ±/.test(t))]),
        ['Regressie XmR', ['r rond lijn', 'lijn ± 2.66r', 'lijn ± 1.77r']]);
    eis('met grenzen op de grafiek', (await pixels(ROOD)) > 100, true);
    await p.evaluate(() => closeChartStatsModal());
    await p.evaluate(async () => { dataAggMode = 'w'; await renderDataView(); });
    eis('per week geen XmR-variant: dan de gewone trendkaart', await p.evaluate(() => window.lastChartStats.chartMode), 'regressie');
    await p.evaluate(async () => { zetXmr(false); dataAggMode = 'd'; chartViewMode = 'prognose'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); }); await wacht(150);
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
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '3m'; chartViewMode = 'prognose'; await renderDataView();
    }); await wacht(300);
    eis('het doel zou (volgens de lijn) tussen de laatste meting en vandaag bereikt zijn: geen prognose, terug naar Regr',
        await p.evaluate(() => [window.lastChartStats.prognose, chartViewMode, grafiekWeergaven().includes('prognose')]), [null, 'regressie', false]);
    // review 029: de gekozen rij blijft gekozen als Prog terugvalt naar Regr
    await p.evaluate(async () => { const k = Object.keys(dataCache.g).sort().pop(); selectedDataKey = k; window.__gekozen = k; chartViewMode = 'prognose'; await renderDataView(true); });
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
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'd'; dataPeriodFilter = '1w'; chartViewMode = 'prognose'; await renderDataView();
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
    eis('in Analyse: doel bereikt met die dag', await p.evaluate(() => [...document.querySelectorAll('#chart-stats-modal-body-regressie tr')].map(r => r.cells[0].textContent + ' ' + r.cells[1].textContent).find(t => /^doel bereikt/.test(t))), 'doel bereikt ' + st6[5]);
    await p.evaluate(() => closeChartStatsModal()); await wacht(150);
    // ook gegroepeerd per week: het snijpunt tussen de groepen
    await p.evaluate(async () => {
      bronnen[0].doel_x = 85; const d = {}; const t = todayUTCDate();
      for(let i = 0; i < 56; i++){ const x = new Date(t); x.setUTCDate(x.getUTCDate() - 55 + i); d[dateToKey(x)] = Math.round((88 - 0.1*i + [0.2, -0.2, 0.1][i % 3])*100)/100; }
      dataCache = {g: d}; bumpDataVersion('g'); dataAggMode = 'w'; dataPeriodFilter = '3m'; chartViewMode = 'prognose'; await renderDataView();
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
      bronnen[0].decimalen = 2; dataCache = {g: d}; bumpDataVersion('g'); zetXmr(true); chartViewMode = 'regressie'; await renderDataView(); window.chartSwipeJustHappened = false; openChartStatsModal(); });
    await wacht(150);
    eis('320 breed, zes cijfers, Regressie XmR: past, met één regel r / r²', [await past(), await p.evaluate(() =>
        [...document.querySelectorAll('#chart-stats-modal-body-regressie tr td:first-child')].map(td => td.textContent.trim()).filter(t => /^r(²|$|\u00a0\/)/.test(t)))],
      [true, ['r / r²']]);
    await p.evaluate(() => { closeChartStatsModal(); zetXmr(false); }); await wacht(150);
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
      await idbSet('backup:gewicht.json', 'nooit'); await maybeBackupFile('gewicht.json');
    }); await sluitMelding();
    eis('een mislukte backup: stip op Bronnen en een oranje regel', await stand(), [true, '9px', '\u26a0 Backup van gewicht.json mislukt (QuotaExceededError)']);
    await p.evaluate(async () => { dirHandle.getFileHandle = window.__echtFH; await maybeBackupFile('gewicht.json'); });
    eis('de volgende backup lukt: weer niets', await stand(), [false, 'auto', '']);
    await p.evaluate(async () => {
      window.__echtIdbSet = idbSet;
      idbSet = async (k, v) => { if(/^kopie:/.test(k)) throw Object.assign(new Error('vol'), {name: 'QuotaExceededError'}); return window.__echtIdbSet(k, v); };
      await bewaarKopieVan('gewicht.json', '{}', true);
    });
    eis('een leeskopie die niet bij te werken is: stip en regel', await stand(), [true, '9px', '\u26a0 Leeskopie van gewicht.json niet bijgewerkt (QuotaExceededError)']);
    await p.evaluate(async () => { idbSet = window.__echtIdbSet; await bewaarKopieVan('gewicht.json', '{}', true); });
    eis('lukt de kopie weer: niets', await stand(), [false, 'auto', '']);
    eis('offline werken niet actief: stip en regel', await p.evaluate(async () => {
      const sw = navigator.serviceWorker, echt = sw.getRegistration;
      sw.getRegistration = async () => null;
      const r = await swControle();
      sw.getRegistration = echt; return r;
    }), 'Offline werken en updates: niet actief \u2014 sluit de app en open hem opnieuw');
    eis('en dat staat ook onderaan Bronnen', (await stand())[2], '\u26a0 Offline werken en updates: niet actief \u2014 sluit de app en open hem opnieuw');
    await p.evaluate(() => { __swProbleem = ''; tekenProblemen(); });
    await p.evaluate(() => renderBronValidationBanner([{titel: 'Gewicht', tekst: 'Bestand ontbreekt (gewicht.json).'}]));
    eis('een bron met een probleem: wel de stip, de regel staat al in de banner bovenaan', await stand(), [true, '9px', '']);
    await p.evaluate(() => renderBronValidationBanner([]));
    eis('opgelost: stip weg', await stand(), [false, 'auto', '']);

    // review 006: per meting, in de Nederlandse tijd (met de overgang naar wintertijd op 25-10)
    {
      const ctxA = await browser.newContext({viewport: {width: 360, height: 740}, timezoneId: 'Europe/Amsterdam'});
      const pa = await ctxA.newPage(); const foutenA = []; pa.on('pageerror', e => foutenA.push(e.message));
      await pa.clock.install({time: new Date('2026-10-26T10:00:00+01:00')});
      await pa.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await pa.waitForTimeout(600);
      /* zeven dagen, elke ochtend om 07:00, precies 0,3 per dag omlaag; het doel raakt de lijn vandaag om 22:00 */
      const zet = doel => pa.evaluate(async doel => {
        document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; });
        dirHandle = {name: 'Trends', getFileHandle: async n => ({name: n, getFile: async () => ({lastModified: 1, size: 2, text: async () => '{}'})}), queryPermission: async () => 'granted', values: async function*(){}};
        leesKopieModus = false;
        bronnen = [{id: 'g', titel: 'Gewicht', bestand: 'gewicht.json', eenheid: 'kg', decimalen: 2, meerdere_metingen: true, doel_x: doel}];
        const d = {}; for(let i = 0; i < 7; i++) d['D202610' + (20 + i) + 'T0700'] = Math.round((85 - 0.3*i)*100)/100;
        dataCache = {g: d}; bumpDataVersion('g'); renderSourceList(); renderSourceSelects(); setFileLinkUI('dir', 'linked', {name: 'Trends'});
        document.getElementById('data-source-select').value = 'g'; switchToView('data');
        dataShowChart = true; document.getElementById('data-chart-preview').style.display = 'block';
        dataAggMode = 'p'; dataPeriodFilter = '1w'; chartViewMode = 'prognose';
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
      const tp = await tc.newPage();
      await tp.goto('http://127.0.0.1:' + server.address().port + '/trends.html'); await tp.waitForTimeout(600);
      await tp.evaluate(async () => {
        document.querySelectorAll('.modal-overlay').forEach(o => { o.style.display = 'none'; });
        dirHandle = {name: 'Trends', getFileHandle: async n => ({name: n, getFile: async () => ({lastModified: 1, size: 2, text: async () => '{}'})}), queryPermission: async () => 'granted', values: async function*(){}};
        leesKopieModus = false;
        bronnen = [{id: 'g', titel: 'Gewicht', bestand: 'gewicht.json', eenheid: 'kg', decimalen: 1, meerdere_metingen: false}];
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
