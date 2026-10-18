// Validate the config actually used by EAS, without contacting App Store Connect.
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../store.config.json'), 'utf8'));
const limits = { title: 30, subtitle: 30, promoText: 170, description: 4000, releaseNotes: 4000 };
let failed = false;
for (const [locale, copy] of Object.entries(config.apple.info)) {
  const fail = message => { console.error(`${locale}: ${message}`); failed = true; };
  for (const [field, limit] of Object.entries(limits)) {
    if (typeof copy[field] !== 'string' || !copy[field].trim() || [...copy[field]].length > limit) fail(`Invalid ${field} (max ${limit})`);
  }
  const keywords = copy.keywords;
  if (!Array.isArray(keywords) || keywords.some(word => typeof word !== 'string' || !word || word !== word.trim() || word.includes(','))) {
    fail('Keywords must be nonempty individual terms'); continue;
  }
  const joined = keywords.join(',');
  if ([...joined].length > 100) fail('Keywords exceed 100 characters');
  // Conservative compatibility with upload tools that enforce a byte limit.
  if (Buffer.byteLength(joined, 'utf8') > 100) fail('Keywords exceed 100 UTF-8 bytes');
  if (new Set(keywords.map(word => word.toLowerCase())).size !== keywords.length) fail('Duplicate keywords');
  const named = `${copy.title} ${copy.subtitle}`.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  if (keywords.some(word => named.includes(word.toLowerCase()))) fail('Keyword repeated from title/subtitle');
  for (const field of ['supportUrl', 'privacyPolicyUrl']) {
    try { if (new URL(copy[field]).protocol !== 'https:') fail(`Invalid ${field}`); }
    catch { fail(`Invalid ${field}`); }
  }
  for (const [device, files] of Object.entries(copy.screenshots ?? {})) {
    if (!files.length || files.length > 10) fail(`Invalid screenshot count for ${device}`);
    for (const file of files) if (!fs.existsSync(path.resolve(__dirname, '..', file))) fail(`Missing screenshot: ${file}`);
  }
  for (const preview of Object.values(copy.previews ?? {})) {
    const file = path.resolve(__dirname, '..', preview.path);
    if (!fs.existsSync(file)) { fail(`Missing preview: ${preview.path}`); continue; }
    if (path.extname(file).toLowerCase() === '.mp4') {
      const descriptor = fs.openSync(file, 'r');
      const header = Buffer.alloc(12);
      try { fs.readSync(descriptor, header, 0, header.length, 0); }
      finally { fs.closeSync(descriptor); }
      if (header.toString('ascii', 4, 8) !== 'ftyp') fail(`Invalid MP4 preview (possibly an exported streaming playlist): ${preview.path}`);
    }
  }
  console.log(`${locale}: title ${[...copy.title].length}/30; subtitle ${[...copy.subtitle].length}/30; keywords ${[...joined].length}/100 characters (${Buffer.byteLength(joined)} bytes)`);
}
console.log(failed ? 'FAIL' : 'PASS: metadata limits and local assets');
if (failed) process.exitCode = 1;
