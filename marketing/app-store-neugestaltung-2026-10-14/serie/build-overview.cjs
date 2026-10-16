// Gesamtübersicht und Lesbarkeitsprüfung der exportierten Serie.
// Aufruf: node build-overview.cjs [locale ...]
// Schreibt export/uebersicht-<locale>.png (iPhone- und iPad-Reihe)
// und export/kleine-vorschau-<locale>.png (erste drei Motive in Store-Suchgröße).
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = __dirname;
const series = JSON.parse(fs.readFileSync(path.join(root, 'series.json'), 'utf8'));
const locales = process.argv.slice(2).length ? process.argv.slice(2) : ['de-DE', 'en-US', 'es-ES'];
const CREAM = '#F3ECE6';

async function row(files, tileW, gap) {
  const tiles = [];
  for (const f of files) tiles.push(await sharp(f).resize({ width: tileW }).toBuffer());
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const h = Math.max(...metas.map((m) => m.height));
  const w = tiles.length * tileW + (tiles.length - 1) * gap;
  const img = await sharp({ create: { width: w, height: h, channels: 3, background: CREAM } })
    .composite(tiles.map((input, i) => ({ input, left: i * (tileW + gap), top: 0 })))
    .png().toBuffer();
  return { img, w, h };
}

(async () => {
  for (const locale of locales) {
    const dir = (fmt) => path.join(root, 'export', locale, fmt);
    const files = (fmt) => series.motifs.map((m) => path.join(dir(fmt), m.id + '.png')).filter((f) => fs.existsSync(f));
    const iphone = files('APP_IPHONE_67');
    const ipad = files('APP_IPAD_PRO_3GEN_129');
    if (!iphone.length) { console.log('keine Exporte für', locale); continue; }
    const pad = 60, gap = 28;
    const r1 = await row(iphone, 300, gap);
    const parts = [{ input: r1.img, left: pad, top: pad }];
    let height = pad + r1.h + pad;
    let width = r1.w + 2 * pad;
    if (ipad.length) {
      const r2 = await row(ipad, Math.round((r1.w - gap * (ipad.length - 1)) / ipad.length), gap);
      parts.push({ input: r2.img, left: pad, top: height });
      height += r2.h + pad;
      width = Math.max(width, r2.w + 2 * pad);
    }
    await sharp({ create: { width, height, channels: 3, background: CREAM } })
      .composite(parts).png().toFile(path.join(root, 'export', `uebersicht-${locale}.png`));

    // Store-Suchergebnis: drei Hochformat-Screenshots nebeneinander, je ca. 118 pt breit.
    // Gerendert in 1x (118 px) und Retina (354 px), damit die Lesbarkeit realistisch geprüft wird.
    const first3 = iphone.slice(0, 3);
    const small1x = await row(first3, 118, 8);
    const small3x = await row(first3, 354, 24);
    await sharp({ create: { width: small3x.w + 80, height: small1x.h + small3x.h + 120, channels: 3, background: '#FFFFFF' } })
      .composite([{ input: small1x.img, left: 40, top: 40 }, { input: small3x.img, left: 40, top: small1x.h + 80 }])
      .png().toFile(path.join(root, 'export', `kleine-vorschau-${locale}.png`));
    console.log('ok', locale);
  }
})();
