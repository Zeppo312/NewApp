// Prüft store-texte.json gegen Apples Feldgrenzen (Name/Untertitel 30 Zeichen, Werbetext 170,
// Beschreibung 4000 Zeichen, Keywords konservativ auch 100 Bytes UTF-8) und auf Keyword-Dopplungen mit Titel/Untertitel.
const fs = require('node:fs');
const t = JSON.parse(fs.readFileSync(__dirname + '/store-texte.json', 'utf8'));
const limits = { title: 30, subtitle: 30, promoText: 170, description: 4000 };
let ok = true; const out = {};
for (const loc of ['de-DE', 'en-US', 'es-ES', 'en-GB']) {
  const x = t[loc]; const r = {};
  for (const [k, lim] of Object.entries(limits)) { const n = [...x[k]].length; r[k] = `${n}/${lim}`; if (n > lim) ok = false; }
  const kw = x.keywords.join(',');
  const bytes = Buffer.byteLength(kw, 'utf8'); r.keywords = `${bytes}/100 Bytes`; if (bytes > 100) ok = false;
  const named = (x.title + ' ' + x.subtitle).toLowerCase().split(/[^\p{L}]+/u);
  const dup = x.keywords.filter((k) => named.includes(k)); r.keywordDoppelt = dup; if (dup.length) ok = false;
  const short = x.keywords.filter((k) => [...k].length < 3); if (short.length) { r.zuKurz = short; ok = false; }
  out[loc] = r;
}
console.log(JSON.stringify(out, null, 2)); console.log(ok ? 'PASS' : 'FAIL'); if (!ok) process.exitCode = 1;
