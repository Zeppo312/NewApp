// Reproduzierbarer Export der Store-Serie.
// Aufruf (siehe README): node render.cjs [locale ...]
// Liest series.json + template.html + captures/<locale>/<device>/<motiv>.png
// und schreibt export/<locale>/<format>/<NN-motiv>.png sowie export/pruefung.json.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const sharp = require('sharp');

const root = __dirname;
const series = JSON.parse(fs.readFileSync(path.join(root, 'series.json'), 'utf8'));
const locales = process.argv.slice(2).length ? process.argv.slice(2) : ['de-DE', 'en-US', 'es-ES'];
const brand = 'Lotti Baby';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const report = { generated: new Date().toISOString(), files: [], missingCaptures: [], problems: [] };
  for (const locale of locales) {
    for (const format of series.formats) {
      const page = await browser.newPage({ viewport: { width: format.w, height: format.h }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(path.join(root, 'template.html')).href);
      const outDir = path.join(root, 'export', locale, format.id);
      fs.mkdirSync(outDir, { recursive: true });
      for (const motif of series.motifs) {
        const capture = path.join(root, 'captures', locale, format.device, motif.id + '.png');
        if (!fs.existsSync(capture)) {
          report.missingCaptures.push({ locale, format: format.id, motif: motif.id, expected: path.relative(root, capture), needs: motif.capture });
          continue;
        }
        const text = motif.text[locale];
        await page.evaluate((spec) => window.renderSpec(spec), {
          w: format.w, h: format.h, device: format.device, layout: series.layouts[format.device],
          title: text.title, support: text.support, brand, lang: locale,
          image: pathToFileURL(capture).href,
        });
        await page.evaluate(() => document.fonts.ready);
        const m = await page.evaluate(() => window.measure());
        for (const line of m.lines) {
          if (line.left < m.copyLeft - 1 || line.right > m.copyRight + 1) {
            report.problems.push({ locale, format: format.id, motif: motif.id, problem: 'Text läuft über den Satzspiegel', text: line.text });
          }
        }
        if (m.copyBottom > m.deviceTop - 24) {
          report.problems.push({ locale, format: format.id, motif: motif.id, problem: 'Text kollidiert mit Geräterahmen' });
        }
        const raw = await page.screenshot({ type: 'png', omitBackground: false });
        const out = path.join(outDir, motif.id + '.png');
        // Ohne Alphakanal, sRGB, verlustfrei.
        await sharp(raw).removeAlpha().toColorspace('srgb').png({ compressionLevel: 9 }).toFile(out);
        const meta = await sharp(out).metadata();
        const entry = {
          file: path.relative(root, out), width: meta.width, height: meta.height, channels: meta.channels,
          hasAlpha: meta.hasAlpha, space: meta.space, bytes: fs.statSync(out).size,
          font: m.fontFamily.split(',')[0], capture: path.relative(root, capture),
          captureSha256: crypto.createHash('sha256').update(fs.readFileSync(capture)).digest('hex'),
        };
        if (meta.width !== format.w || meta.height !== format.h) report.problems.push({ file: entry.file, problem: 'Falsche Abmessungen' });
        if (meta.hasAlpha) report.problems.push({ file: entry.file, problem: 'Alphakanal vorhanden' });
        report.files.push(entry);
        console.log('ok', entry.file);
      }
      await page.close();
    }
  }
  await browser.close();
  const reportPath = path.join(root, 'export', 'pruefung.json');
  let previous = {};
  if (fs.existsSync(reportPath)) previous = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  // Bei Teil-Exporten (einzelne Sprachen) die übrigen Einträge erhalten.
  const keep = (list) => (list || []).filter((e) => !locales.some((l) => (e.file || e.locale || '').includes(l)));
  const merged = {
    generated: report.generated,
    files: [...keep(previous.files), ...report.files].sort((a, b) => a.file.localeCompare(b.file)),
    missingCaptures: [...keep(previous.missingCaptures), ...report.missingCaptures],
    problems: [...keep(previous.problems), ...report.problems],
  };
  fs.writeFileSync(reportPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(JSON.stringify({ rendered: report.files.length, missing: report.missingCaptures.length, problems: report.problems }, null, 2));
  if (report.problems.length) process.exitCode = 1;
  else if (report.missingCaptures.length) process.exitCode = 2;
})();
