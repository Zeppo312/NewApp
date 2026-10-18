// Prüfbild: bestehendes App-Icon in Store-typischen Größen auf hellem und dunklem Grund
// plus ein Vorschlag, der nur das vorhandene Baby-Motiv (ohne Schriftzug) vergrößert auf Creme stellt.
const path = require('node:path');
const sharp = require('sharp');
const repo = path.resolve(__dirname, '../../..');
const icon = path.join(repo, 'assets/images/icon.png');
const sizes = [180, 120, 87, 60, 40];
(async () => {
  // Vorschlag: nur das schlafende Baby (Schriftzug abgedeckt), Weiß per Multiplizieren zu Creme, Motiv größer.
  const cover = Buffer.from('<svg width="1024" height="1024"><rect x="0" y="440" width="500" height="584" fill="#fff"/><rect x="0" y="497" width="1024" height="527" fill="#fff"/></svg>');
  const covered = await sharp(icon).composite([{ input: cover }]).png().toBuffer();
  const babyOnly = await sharp(covered).extract({ left: 240, top: 112, width: 580, height: 385 }).resize({ width: 880 }).toBuffer();
  const proposal = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#F4ECF4' } })
    .composite([{ input: babyOnly, gravity: 'center', blend: 'multiply' }])
    .png().toBuffer();
  await sharp(proposal).toFile(path.join(__dirname, 'icon-vorschlag-ohne-schrift.png'));
  const row = async (src, bg) => {
    const pad = 30; const W = sizes.reduce((a, s) => a + s + pad, pad); const H = 180 + 2 * pad;
    const tiles = [];
    let x = pad;
    for (const s of sizes) {
      const r = Math.round(s * 0.2237);
      const mask = Buffer.from(`<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${r}" ry="${r}"/></svg>`);
      const t = await sharp(src).resize(s, s).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      tiles.push({ input: t, left: x, top: pad + (180 - s) });
      x += s + pad;
    }
    return sharp({ create: { width: W, height: H, channels: 4, background: bg } }).composite(tiles).png().toBuffer();
  };
  const rows = [await row(icon, '#FFFFFF'), await row(icon, '#1C1C1E'), await row(proposal, '#FFFFFF'), await row(proposal, '#1C1C1E')];
  const meta = await sharp(rows[0]).metadata();
  await sharp({ create: { width: meta.width, height: meta.height * 4, channels: 3, background: '#FFFFFF' } })
    .composite(rows.map((input, i) => ({ input, left: 0, top: i * meta.height })))
    .png().toFile(path.join(__dirname, 'icon-kleine-groessen.png'));
  console.log('ok');
})();
