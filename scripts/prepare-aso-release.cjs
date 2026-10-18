// Create a local release config with one ASO variable group changed at a time.
// Baseline must be a fresh App Store Connect export, not a historical repo file.
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (!['visuals', 'keywords'].includes(option('--phase')) ||
    !args.includes('--baseline') || !args.includes('--output') || !args.includes('--version')) {
  console.error('Usage: node scripts/prepare-aso-release.cjs --phase visuals|keywords --baseline baseline.json --version VERSION --output output.json');
  process.exit(1);
}
const baseline = JSON.parse(fs.readFileSync(option('--baseline'), 'utf8'));
const target = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../store.config.json'), 'utf8'));
if (!baseline.apple?.info || !Object.keys(baseline.apple.info).length) throw new Error('Baseline has no Apple localizations');
target.apple.version = option('--version');
if (option('--phase') === 'visuals') {
  for (const locale of Object.keys(target.apple.info)) {
    const old = baseline.apple.info[locale];
    // Introduce en-GB with the keyword phase so the visuals phase keeps search fields stable.
    if (!old) { delete target.apple.info[locale]; continue; }
    for (const field of ['title', 'subtitle', 'keywords']) {
      if (old[field] === undefined) throw new Error(`Baseline missing ${locale}.${field}`);
      target.apple.info[locale][field] = structuredClone(old[field]);
    }
  }
  for (const [locale, copy] of Object.entries(baseline.apple.info)) {
    if (!target.apple.info[locale]) target.apple.info[locale] = structuredClone(copy);
  }
} else {
  for (const [locale, copy] of Object.entries(target.apple.info)) {
    const old = baseline.apple.info[locale] ?? (locale === 'en-GB' ? baseline.apple.info['en-US'] : null);
    if (!old) throw new Error(`Baseline missing media for ${locale}`);
    for (const field of ['screenshots', 'previews']) {
      if (old[field] === undefined) delete copy[field];
      else copy[field] = structuredClone(old[field]);
    }
  }
  for (const [locale, copy] of Object.entries(baseline.apple.info)) {
    if (!target.apple.info[locale]) target.apple.info[locale] = structuredClone(copy);
  }
}
// EAS metadata:pull can save an HLS playlist under an .mp4 filename. Never
// propagate such an export into another upload; use the original validated MP4.
for (const [locale, copy] of Object.entries(target.apple.info)) {
  for (const preview of Object.values(copy.previews ?? {})) {
    if (path.extname(preview.path).toLowerCase() !== '.mp4') continue;
    const candidates = [path.resolve(preview.path), path.resolve(path.dirname(option('--baseline')), preview.path)];
    const file = candidates.find(candidate => fs.existsSync(candidate));
    if (!file) throw new Error(`Missing MP4 preview for ${locale}: ${preview.path}`);
    const bytes = fs.readFileSync(file);
    if (bytes.toString('ascii', 4, 8) !== 'ftyp') throw new Error(`Invalid MP4 export for ${locale}; replace the playlist with the original MP4 before uploading`);
  }
}
fs.writeFileSync(option('--output'), JSON.stringify(target, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Prepared ${option('--phase')} config for ${target.apple.version}. No upload performed.`);
