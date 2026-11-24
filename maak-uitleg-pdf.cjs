/* Maakt uitleg-grafieken.pdf uit uitleg-grafieken.md: pandoc naar HTML, eigen opmaak erin,
   Chromium drukt af op A4 met paginanummers onderaan.
     NODE_PATH=$(npm root -g) node maak-uitleg-pdf.cjs
   Nodig: pandoc en playwright. Na het bijwerken van de md (en van 'Versie …' op regel 3). */
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { chromium } = require('playwright');
const STIJL = `@page { size: A4; margin: 18mm 16mm 16mm 16mm; }
body { font-family: 'DejaVu Sans', sans-serif; font-size: 9.6pt; line-height: 1.45; color: #222; }
h1 { color: #7a3b6a; font-size: 18pt; margin: 0 0 4pt; }
h1 + p { color: #595959; margin-top: 0; }
h2 { color: #7a3b6a; font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; margin-top: 18pt; }
h3 { font-size: 11pt; margin-top: 12pt; }
table { border-collapse: collapse; width: 100%; font-size: 8.4pt; margin: 6pt 0 10pt; }
th, td { border: 1px solid #ccc; padding: 4pt 6pt; vertical-align: top; text-align: left; }
th { background: #f5f5f5; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 8.6pt; }
ul { padding-left: 16pt; }`;
(async () => {
  const map = __dirname, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'uitleg-'));
  const html = path.join(tmp, 'uitleg.html');
  execFileSync('pandoc', [path.join(map, 'uitleg-grafieken.md'), '-s', '-o', html,
    '--metadata', 'title=Trends — grafieken en statistieken uitgelegd']);
  let s = fs.readFileSync(html, 'utf8');
  s = s.replace(/<style>[\s\S]*?<\/style>/, '<style>' + STIJL + '</style>')
       .replace(/<header id="title-block-header">[\s\S]*?<\/header>\s*/, '');
  fs.writeFileSync(html, s);
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + html); await p.waitForTimeout(300);
  await p.pdf({ path: path.join(map, 'uitleg-grafieken.pdf'), format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:7pt;width:100%;text-align:center;color:#555;font-family:DejaVu Sans"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
    margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' } });
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log('uitleg-grafieken.pdf gemaakt');
})();
