import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { addDeletionCalloutToPhp } from './privacy-deletion-callout.mjs';

// Input: a fresh download of datenschutz.php and lang/{de,en,es}.php.
// Output: only those four changed files. Upload is deliberately a separate step.
const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg) throw new Error('Usage: node scripts/prepare-website-privacy.mjs SOURCE DESTINATION');
const source = resolve(sourceArg);
const destination = resolve(destinationArg);
if (source === destination) throw new Error('Keep the downloaded originals as a separate backup.');
const sections = JSON.parse(await readFile(new URL('../lib/appPrivacySections.json', import.meta.url), 'utf8'));
const copy = JSON.parse(await readFile(new URL('../docs/privacy/website-copy.json', import.meta.url), 'utf8'));
const escapePhp = (value) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const meta = {
  de: ['Stand: 26. Juni 2026', 'Stand: 11. September 2026', 'Verantwortlicher', 'Internationale Datentransfers', 'Allgemeine Informationen zur Datenspeicherung und Löschung', 'Datenschutzerklärung'],
  en: ['Last updated: 26 June 2026', 'Last updated: 11 September 2026', 'Controller', 'International data transfers', 'General information on data storage and erasure', 'privacy policy'],
  es: ['Última actualización: 26 de junio de 2026', 'Última actualización: 11 de septiembre de 2026', 'Responsable', 'Transferencias internacionales de datos', 'Información general sobre la conservación y supresión de datos', 'política de privacidad'],
};
let policy = await readFile(join(source, 'datenschutz.php'), 'utf8');
let localesChanged = 0;
policy = policy.replace(/(\$policies\["(de|en|es)"\] = <<<'POLICY'\n)([\s\S]*?)(\nPOLICY;)/g, (_, start, locale, text, end) => {
  const [oldDate, newDate, controller, transfers, retention] = meta[locale];
  if (!text.includes(oldDate)) throw new Error(`Unexpected policy version: ${locale}`);
  const marker = 'support@lottibaby.de\n\n';
  if (!text.includes(marker)) throw new Error(`Missing controller contact: ${locale}`);
  text = text.replace(oldDate, newDate);
  // Replace the unsupported blanket DPF/SCC guarantee while preserving shop text.
  const from = text.indexOf(`\n${transfers}\n\n`);
  const to = text.indexOf(`\n${retention}\n\n`, from);
  if (from < 0 || to < 0) throw new Error(`Missing transfer section: ${locale}`);
  text = text.slice(0, from) + `\n${transfers}\n\n${sections[locale][6].paragraphs[1]}\n` + text.slice(to);
  const supplement = sections[locale].map((s) => [s.title, ...s.paragraphs].join('\n\n')).join('\n\n');
  text = text.replace(marker, marker + supplement + '\n\n');
  text = text.replace(`\n${controller}\n`, `\n${controller}\n${sections[locale].map((s) => s.title).join('\n')}\n`);
  localesChanged++;
  return start + text + end;
});
if (localesChanged !== 3) throw new Error('Expected exactly three website policies.');
await mkdir(join(destination, 'lang'), { recursive: true });
await writeFile(join(destination, 'datenschutz.php'), addDeletionCalloutToPhp(policy));
for (const locale of ['de', 'en', 'es']) {
  let text = await readFile(join(source, 'lang', `${locale}.php`), 'utf8');
  const values = {
    'app.faq_q5': copy[locale].question,
    'app.faq_a5': copy[locale].answer,
    'app.faq_a5_html': `${copy[locale].answer} <a href="/datenschutz?lang=${locale}">${meta[locale][5]}</a>.`,
    'home.trust_1_text': copy[locale].trust,
  };
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`('${key.replaceAll('.', '\\.')}'\\s*=>\\s*)'(?:\\\\.|[^'\\\\])*'`, 'g');
    let count = 0;
    text = text.replace(pattern, (_, prefix) => { count++; return `${prefix}'${escapePhp(value)}'`; });
    if (count !== 1) throw new Error(`Expected one ${locale}:${key}, found ${count}`);
  }
  await writeFile(join(destination, 'lang', `${locale}.php`), text);
}
console.log('Prepared datenschutz.php and lang/de.php, lang/en.php, lang/es.php; original downloads preserved.');
