import { readFile, writeFile } from 'node:fs/promises';
import { renderDeletionCallout } from './privacy-deletion-callout.mjs';

// The app and the website hand-off use the same reviewed translations.
const root = new URL('../', import.meta.url);
const sections = JSON.parse(await readFile(new URL('lib/appPrivacySections.json', root), 'utf8'));
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const paragraph = (text) => escape(text).replace(/https:\/\/[^\s;]+/g, (match) => {
  const url = match.replace(/[.,]$/, '');
  return `<a href="${url}">${url}</a>${match.slice(url.length)}`;
});
const render = (locale) => sections[locale].map((section, i) => `<section id="app-privacy-${i + 1}">\n<h2>${escape(section.title)}</h2>\n${section.paragraphs.map((text) => `<p>${paragraph(text)}</p>`).join('\n')}\n</section>`).join('\n');
const file = new URL('Datenschutz.html', root);
let html = await readFile(file, 'utf8');
const start = '<!-- APP PRIVACY START -->';
const end = '<!-- APP PRIVACY END -->';
const block = `${start}\n${renderDeletionCallout('de')}\n${render('de')}\n${end}\n`;
if (html.includes(start)) {
  html = html.slice(0, html.indexOf(start)) + block + html.slice(html.indexOf(end) + end.length).replace(/^\n/, '');
} else {
  html = html.replace('<h2 id="mOverview">', block + '<h2 id="mOverview">');
}
const indexStart = '<!-- APP PRIVACY INDEX START -->';
const indexEnd = '<!-- APP PRIVACY INDEX END -->';
const index = `${indexStart}<li><a class="index-link" href="#konto-loeschen">Lotti Baby: Konto und Daten löschen</a></li>${sections.de.map((s, i) => `<li><a class="index-link" href="#app-privacy-${i + 1}">${escape(s.title)}</a></li>`).join('')}${indexEnd}`;
if (html.includes(indexStart)) {
  html = html.slice(0, html.indexOf(indexStart)) + index + html.slice(html.indexOf(indexEnd) + indexEnd.length);
} else {
  html = html.replace('<li><a class="index-link" href="#mOverview">', index + '<li><a class="index-link" href="#mOverview">');
}
const files = [[file, html]];
for (const locale of ['de', 'en', 'es']) {
  files.push([new URL(`docs/privacy/app-privacy-${locale}.html`, root), `<!-- App-specific supplement; retain the website/shop policy. Updated: 2026-09-11. -->\n${render(locale)}\n`]);
}
for (const [path, content] of files) {
  if (process.argv.includes('--check')) {
    if (await readFile(path, 'utf8').catch(() => '') !== content) throw new Error(`Privacy output is stale: ${path.pathname}`);
  } else {
    await writeFile(path, content);
  }
}
console.log('Privacy HTML matches the app translations (de/en/es).');
