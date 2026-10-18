import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'website/seo');
const out = path.join(source, 'public');
const pages = JSON.parse(fs.readFileSync(path.join(source, 'features.json'), 'utf8'));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const store = 'https://apps.apple.com/de/app/lotti-baby/id6745569710';
fs.mkdirSync(path.join(out, 'assets/seo'), { recursive: true });
fs.copyFileSync(path.join(source, 'features.css'), path.join(out, 'assets/seo/features.css'));
for (const page of pages) {
  const url = `https://lottibaby.de/${page.slug}/`;
  const imageUrl = `https://lottibaby.de/assets/seo/${page.image}`;
  fs.copyFileSync(path.join(root, 'marketing/app-store-neugestaltung-2026-10-14/serie/export/de-DE/APP_IPHONE_67', page.image), path.join(out, 'assets/seo', page.image));
  const png = fs.readFileSync(path.join(out, 'assets/seo', page.image));
  const imageWidth = png.readUInt32BE(16), imageHeight = png.readUInt32BE(20);
  const structured = { '@context': 'https://schema.org', '@type': 'WebPage', name: page.title, description: page.description, url, inLanguage: 'de', isPartOf: { '@type': 'WebSite', name: 'Lotti Baby', url: 'https://lottibaby.de/' } };
  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escape(page.title)}</title>
  <meta name="description" content="${escape(page.description)}">
  <meta name="apple-itunes-app" content="app-id=6745569710">
  <meta name="theme-color" content="#faf8f5">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="de_DE">
  <meta property="og:title" content="${escape(page.title)}">
  <meta property="og:description" content="${escape(page.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:alt" content="${escape(page.imageAlt)}">
  <link rel="stylesheet" href="../assets/seo/features.css">
  <script type="application/ld+json">${JSON.stringify(structured).replaceAll('<', '\\u003c')}</script>
</head>
<body>
  <a class="skip" href="#inhalt">Zum Inhalt</a>
  <header class="nav"><a class="brand" href="https://lottibaby.de/">Lotti Baby<span>Für euren Familienalltag</span></a><a class="nav-app" href="https://lottibaby.de/app">Die App entdecken <span aria-hidden="true">↗</span></a></header>
  <main id="inhalt">
    <section class="hero">
      <div class="hero-copy"><p class="eyebrow"><span>${page.number}</span> ${escape(page.eyebrow)}</p><h1>${escape(page.heading)}</h1><p class="intro">${escape(page.intro)}</p><a class="button" href="${store}">Lotti Baby im App Store <span aria-hidden="true">↗</span></a><p class="terms">Für iPhone und iPad. Anmeldung erforderlich. Der Funktionsumfang hängt vom gewählten Abonnement ab; Preise und Laufzeiten seht ihr vor dem Kauf in der App.</p></div>
      <figure><img src="../assets/seo/${page.image}" width="${imageWidth}" height="${imageHeight}" alt="${escape(page.imageAlt)}" fetchpriority="high"><figcaption>Ein Einblick in Lotti Baby</figcaption></figure>
    </section>
    <section class="steps" aria-labelledby="schritte"><p class="eyebrow">IM ALLTAG</p><h2 id="schritte">${escape(page.stepsTitle)}</h2><ol>${page.steps.map(step => `<li><h3>${escape(step.title)}</h3><p>${escape(step.text)}</p></li>`).join('')}</ol></section>
    <section class="details"><h2>${escape(page.detailsTitle)}</h2><p>${escape(page.details)}</p><aside>${escape(page.note)}</aside></section>
    <nav class="related" aria-label="Weitere Funktionen"><p class="eyebrow">NOCH MEHR LOTTI BABY</p>${pages.filter(other => other.slug !== page.slug).map(other => `<a href="../${other.slug}/">${escape(other.eyebrow)} <span aria-hidden="true">↗</span></a>`).join('')}</nav>
  </main>
  <footer><a class="brand" href="https://lottibaby.de/">Lotti Baby</a><nav aria-label="Rechtliches"><a href="https://lottibaby.de/datenschutz">Datenschutz</a><a href="https://lottibaby.de/impressum">Impressum</a><a href="https://lottibaby.de/support">Support</a></nav></footer>
</body>
</html>
`;
  fs.mkdirSync(path.join(out, page.slug), { recursive: true });
  fs.writeFileSync(path.join(out, page.slug, 'index.html'), html);
  // Hostinger's root may use default.php. Override only within each new route.
  fs.writeFileSync(path.join(out, page.slug, '.htaccess'), 'DirectoryIndex index.html\n');
}
fs.writeFileSync(path.join(out, 'seo-sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(page => `  <url><loc>https://lottibaby.de/${page.slug}/</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Generated ${pages.length} pages in website/seo/public/`);
