import { readFile, writeFile } from 'node:fs/promises';
const dir = new URL('../website/links/', import.meta.url);
const content = JSON.parse(await readFile(new URL('content.json', dir), 'utf8'));
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const icons = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5.5" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>',
  tiktok: '<path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.47M14 3c.8 3.5 2.4 5 6 5"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  shop: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};
const svg = (name, className = '') => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const bySlug = Object.fromEntries(content.links.map((item) => [item.slug, item]));
const detail = {
  'lotti-shop': 'Liebevoll gestaltete Prints · zum Shop',
  'lotti-kanal': '@lottibaby.de · unsere App & mehr',
  instagram: '@lottismomlife · unser Familienalltag',
  koala: 'Für Schwangerschaft & Babyzeit',
  babyzimmer: 'Unsere Amazon-Liste',
  pullover: 'Mommy to Bee · Winnie Pooh',
  weltkarte: 'Fürs Kinderzimmer',
  babyessentials: 'Unsere Amazon-Liste',
  toniebox: 'Für die Toniebox',
  lampe: 'Fürs Babyzimmer',
};
const card = (slug, affiliate = false) => {
  const item = bySlug[slug];
  if (!item) throw new Error(`Missing link: ${slug}`);
  const image = ['instagram', 'lotti-kanal', 'lotti-shop'].includes(slug)
    ? `<span class="card-icon">${svg(slug === 'lotti-shop' ? 'shop' : 'instagram')}</span>`
    : `<img src="./assets/${slug}.webp" width="53" height="53" loading="lazy" decoding="async" alt="">`;
  return `<li><a class="link-card" href="${escape(item.url)}"${affiliate ? ' rel="sponsored noopener"' : ''}>${image}<span class="card-copy"><span class="card-title">${escape(item.title)}</span><span class="card-detail">${escape(detail[slug])}</span></span>${svg('arrow', 'arrow')}</a></li>`;
};
const social = (type, name, icon) => {
  const item = content.socialLinks.find((item) => item.type === type);
  if (!item) throw new Error(`Missing social: ${type}`);
  return `<a href="${escape(item.url)}">${svg(icon)}<span>${name}</span></a>`;
};
const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#faf8f5">
  <meta name="apple-itunes-app" content="app-id=6745569710">
  <title>Lottis Links – App, Familienalltag & Lieblingsstücke | Lotti Baby</title>
  <meta name="description" content="Alle Links von Lotti an einem Ort: die Lotti Baby App, Instagram, TikTok und Empfehlungen für euren Babyalltag. Direkt bei Lotti Baby.">
  <link rel="canonical" href="https://lottibaby.de/links/">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="de_DE">
  <meta property="og:title" content="Lottis Links · Lotti Baby">
  <meta property="og:description" content="Unsere App, unser Familienalltag und die Dinge, die ihr bei uns findet. Schön, dass du da bist.">
  <meta property="og:url" content="https://lottibaby.de/links/">
  <meta property="og:image" content="https://lottibaby.de/links/assets/familie.webp">
  <meta property="og:image:alt" content="Lotti und ihre Familie">
  <link rel="icon" href="./assets/lotti-app.webp" type="image/webp">
  <link rel="stylesheet" href="./styles.css?v=20260911">
</head>
<body>
  <a class="skip" href="#lieblingslinks">Zu den Links</a>
  <div class="page">
    <header class="masthead">
      <a class="brand" href="/" aria-label="Lotti Baby – zur Startseite">${svg('heart')}<span>Lotti Baby</span></a>
      <a class="home-link" href="/">Zur Website ${svg('arrow')}</a>
    </header>
    <main>
      <div class="hero">
        <div><p class="eyebrow">Lotti · Mama von Levi</p><h1>Schön, dass<br>du da bist.</h1></div>
        <img class="portrait" src="./assets/familie.webp" width="106" height="126" fetchpriority="high" alt="Lotti und ihre Familie">
        <p class="intro">Unsere App, unser Familienalltag und all die Dinge, nach denen ihr uns fragt. Hier findet ihr eure Links.</p>
      </div>
      <nav class="socials" aria-label="Lotti auf Social Media und Kontakt">
        ${social('INSTAGRAM', 'Instagram', 'instagram')}
        ${social('TIKTOK', 'TikTok', 'tiktok')}
        ${social('EMAIL_ADDRESS', 'E-Mail', 'email')}
      </nav>
      <div id="lieblingslinks">
        <a class="feature" href="${escape(bySlug['lotti-app'].url)}">
          <p class="eyebrow">Von Eltern. Für euren Alltag.</p>
          <div class="feature-main"><img class="app-icon" src="./assets/lotti-app.webp" width="62" height="62" alt=""><div><h2>Die Lotti Baby App</h2><p>Für Schwangerschaft & Babyalltag.</p></div></div>
          <span class="feature-cta">Im App Store entdecken ${svg('arrow')}</span>
        </a>
        <section class="section" aria-labelledby="shop-title">
          <div class="section-head"><h2 id="shop-title">Unser kleiner Shop</h2><span>Von uns für euch</span></div>
          <ul class="link-list">${card('lotti-shop')}</ul>
        </section>
        <section class="section" aria-labelledby="alltag-title">
          <div class="section-head"><h2 id="alltag-title">Ein bisschen näher</h2><span>Unser Alltag</span></div>
          <ul class="link-list">${card('instagram')}${card('lotti-kanal')}</ul>
        </section>
        <section class="section" aria-labelledby="lieblinge-title">
          <div class="section-head"><h2 id="lieblinge-title">Für euch entdeckt</h2><span>Werbung</span></div>
          <ul class="link-list">${['koala', 'babyzimmer', 'pullover', 'weltkarte', 'babyessentials', 'toniebox', 'lampe'].map((slug) => card(slug, true)).join('\n')}</ul>
          <p class="disclosure">Einige Links sind Affiliate-Links. Wenn ihr darüber etwas kauft, können wir eine Provision erhalten.</p>
        </section>
      </div>
      <aside class="note">${svg('heart')}<p>Mit Liebe von unserer Familie.</p><a href="/">Mehr von Lotti Baby entdecken →</a></aside>
    </main>
    <footer><nav aria-label="Rechtliche Informationen"><a href="/impressum?lang=de">Impressum</a><a href="/datenschutz?lang=de">Datenschutz</a><a href="mailto:business@zeppi.eu">Kontakt</a></nav><p>© 2026 Lotti Baby · Schön, dass ihr hier seid.</p></footer>
  </div>
</body>
</html>
`;
await writeFile(new URL('index.html', dir), html);
console.log(`Built Lotti links page: ${content.links.length} links; no JavaScript or third-party requests.`);
