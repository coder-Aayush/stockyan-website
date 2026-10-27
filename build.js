// Builds the StockYan site from templates/:
//   index.html, /download/, /open/ (app links), /features/<slug>/, /learn/<slug>/,
//   /features/, /learn/ and sitemap.xml.
// Content: data/pages.json (feature + learn pages), data/articles.json (older
// guides) and data/market.json (real NEPSE numbers, refreshed here first).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const refreshMarketData = require('./scripts/market-data');
const refreshPricing = require('./scripts/pricing-data');

const SITE_URL = 'https://stockyan.info';
// App links must use the domain the apps are associated with.
const APP_LINK_HOST = 'https://stockyan.com';
const ROOT = __dirname;
const T = (...p) => path.join(ROOT, 'templates', ...p);
const read = (p) => fs.readFileSync(p, 'utf8');
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(read(p)) : null);

// Screenshot keys used in templates and data/pages.json.
const SHOTS = {
  mac2: 'desktop-dashboard-light.jpg',
  mac5: 'desktop-dashboard-dark.jpg',
  mac1: 'desktop-dashboard-candles.jpg',
  mac3: 'desktop-workspace.jpg',
  mac4: 'desktop-heatmap.jpg',
  mac7: 'desktop-all-tools-light.jpg',
  menubar: 'desktop-menubar.jpg',
  ph2049: 'phone-market.jpg',
  ph2050: 'phone-portfolio.jpg',
  ph2051: 'phone-ipo-results.jpg',
  ph2052: 'phone-ipo-allotted.jpg',
  win: 'windows-dashboard.jpg',
};
const TILE_WIDGETS = new Set(['accumulation', 'bulk', 'floorsheet', 'ipo']);

// ── Helpers ──

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function truncate(str, len) {
  if (str.length <= len) return str;
  return str.slice(0, len).replace(/\s+\S*$/, '') + '...';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function hash(file) {
  return crypto.createHash('md5').update(read(path.join(ROOT, file))).digest('hex').slice(0, 10);
}

// The h1 with its accent phrase in green.
function accent(h1, phrase) {
  const safe = esc(h1);
  if (!phrase || !h1.includes(phrase)) return safe;
  return safe.replace(esc(phrase), `<span class="g">${esc(phrase)}</span>`);
}

function attrs(str) {
  const out = {};
  str.replace(/(\w+)="([^"]*)"/g, (_, k, v) => { out[k] = v; });
  return out;
}

function shotImage(file, extra, box) {
  return `<image${extra} href="/assets/img/${file}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="${box.fit}"${box.clip || ''}/>`;
}

// MacBook frame (the owner's design; lid made taller to fit Mac screenshots).
function mac({ shots, label }) {
  const box = { x: 60, y: 37, w: 680, h: 442, fit: 'xMidYMin slice' };
  const images = shots.split(',').map((pair, i) => {
    const [key, shot] = pair.includes(':') ? pair.split(':') : [pair, pair];
    return shotImage(SHOTS[shot], ` class="shot${i === 0 ? ' on' : ''}" data-k="${key}"`, box);
  }).join('');
  return `<svg class="mac-svg" viewBox="0 0 800 542" role="img" aria-label="${esc(label)}">
  <g filter="url(#ultraSlimShadow)">
    <rect x="50" y="20" width="700" height="470" rx="14" fill="url(#spaceGrayMetal)" stroke="#111111" stroke-width="1.5"/>
    <rect x="56" y="26" width="688" height="458" rx="9" fill="#050505"/>
    <path d="M 356 26 L 356 33 A 4 4 0 0 0 360 37 L 440 37 A 4 4 0 0 0 444 33 L 444 26 Z" fill="#050505"/>
    <circle cx="400" cy="31.5" r="1.5" fill="#151922"/>
    <rect x="60" y="37" width="680" height="442" rx="3" fill="#1C1C1E"/>
    <g clip-path="url(#macClip)">${images}</g>
    <path d="M 14 490 L 786 490 A 4 4 0 0 1 790 494 L 787 498 A 8 8 0 0 1 779 503 L 21 503 A 8 8 0 0 1 13 498 L 10 494 A 4 4 0 0 1 14 490 Z" fill="url(#aluminumBase)"/>
    <path d="M 12 490 L 788 490" stroke="#FFFFFF" stroke-width="0.75" opacity="0.25" stroke-linecap="round"/>
    <path d="M 354 490 L 358 496 A 3 3 0 0 0 361 498 L 439 498 A 3 3 0 0 0 442 496 L 446 490 Z" fill="#111111"/>
  </g>
</svg>`;
}

// Windows laptop: the MacBook frame without the notch, with a 16:9 screen.
function pc({ shots, label }) {
  const box = { x: 60, y: 30, w: 680, h: 382, fit: 'xMidYMid slice' };
  const images = shots.split(',').map((s) => shotImage(SHOTS[s], '', box)).join('');
  return `<svg class="mac-svg" viewBox="0 0 800 472" role="img" aria-label="${esc(label)}">
  <g filter="url(#ultraSlimShadow)">
    <rect x="50" y="20" width="700" height="400" rx="14" fill="url(#spaceGrayMetal)" stroke="#111111" stroke-width="1.5"/>
    <rect x="56" y="26" width="688" height="388" rx="9" fill="#050505"/>
    <circle cx="400" cy="28" r="1.3" fill="#151922"/>
    <rect x="60" y="30" width="680" height="382" rx="3" fill="#1C1C1E"/>
    <g clip-path="url(#pcClip)">${images}</g>
    <path d="M 14 420 L 786 420 A 4 4 0 0 1 790 424 L 787 428 A 8 8 0 0 1 779 433 L 21 433 A 8 8 0 0 1 13 428 L 10 424 A 4 4 0 0 1 14 420 Z" fill="url(#aluminumBase)"/>
    <path d="M 12 420 L 788 420" stroke="#FFFFFF" stroke-width="0.75" opacity="0.25" stroke-linecap="round"/>
    <path d="M 354 420 L 358 426 A 3 3 0 0 0 361 428 L 439 428 A 3 3 0 0 0 442 426 L 446 420 Z" fill="#111111"/>
  </g>
</svg>`;
}

// iPhone frame (the owner's design).
function phone({ shot, label }) {
  const box = { x: 20, y: 20, w: 340, h: 740, fit: 'xMidYMid slice', clip: ' clip-path="url(#phoneClip)"' };
  return `<svg class="phone-svg" viewBox="0 0 380 780" role="img" aria-label="${esc(label)}">
  <g filter="url(#iphoneProShadow)">
    <rect x="10" y="10" width="360" height="760" rx="54" fill="url(#titaniumFrame)" stroke="#1C1C1E" stroke-width="2"/>
    <rect x="15" y="15" width="350" height="750" rx="49" fill="#0A0A0C" stroke="url(#innerBezelHighlight)" stroke-width="1"/>
    <rect x="20" y="20" width="340" height="740" rx="44" fill="#1C1C1E"/>
    ${shotImage(SHOTS[shot], '', box)}
    <rect x="133" y="34" width="114" height="30" rx="15" fill="#000000"/>
    <circle cx="231" cy="49" r="4.5" fill="#10141B"/>
    <circle cx="232" cy="50" r="1.5" fill="#243242" opacity="0.6"/>
    <rect x="120" y="744" width="140" height="4.5" rx="2.25" fill="#FFFFFF" opacity="0.35"/>
  </g>
</svg>`;
}

const partials = {};
for (const f of fs.readdirSync(T('partials'))) partials[f.replace(/\.html$/, '')] = read(T('partials', f));
const components = {};
for (const f of fs.readdirSync(T('components'))) components[f.replace(/\.html$/, '')] = read(T('components', f));

let globals = {};

function render(template, vars = {}) {
  let out = template;
  for (let i = 0; i < 4 && /{{> /.test(out); i++) {
    out = out.replace(/{{> ([\w-]+)}}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
      return partials[name];
    });
  }
  out = out
    .replace(/{{c:([\w-]+)}}/g, (_, name) => {
      if (!(name in components)) throw new Error(`Unknown component: ${name}`);
      return components[name];
    })
    .replace(/{{mac ([^}]*)}}/g, (_, a) => mac(attrs(a)))
    .replace(/{{pc ([^}]*)}}/g, (_, a) => pc(attrs(a)))
    .replace(/{{phone ([^}]*)}}/g, (_, a) => phone(attrs(a)));
  const all = { ...globals, ...vars };
  return out.replace(/{{([\w:.-]+)}}/g, (whole, key) => {
    if (key.startsWith('v:')) return hash(key.slice(2));
    if (!(key in all)) throw new Error(`Missing template value: ${key}`);
    return all[key];
  });
}

function write(rel, html) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  console.log(`  Generated: /${rel.replace(/index\.html$/, '')}`);
}

function openUrl(openPath, campaign) {
  const p = (openPath || '/open/home').replace(/^\/?/, '/');
  return `${APP_LINK_HOST}${p}?utm_source=website&utm_medium=feature&utm_campaign=${encodeURIComponent(campaign)}`;
}

function faqSection(faq, heading = 'Questions') {
  if (!faq || !faq.length) return '';
  return `<section class="fp-sec">
  <div class="wrap fp-faq">
    <h2 class="fp-h2 rv">${heading}</h2>
    <div class="faq-list">${faq.map((f, i) => `
      <details class="qa"${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
    </div>
  </div>
</section>`;
}

// Heading row with a link to the full list, then cards.
function relatedRow(title, href, label, cards) {
  return `<section class="fp-sec tint"><div class="wrap"><div class="fp-row-head rv"><h2 class="fp-h2">${title}</h2><a href="${href}">${label} ${arrow}</a></div><div class="cards">${cards}</div></div></section>`;
}

function faqLd(faq) {
  if (!faq || !faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
  };
}

// ── Search and share tags (templates/partials/meta.html) ──

const INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const OG_DIR = path.join(ROOT, 'assets', 'og');
const ogManifest = readJson(path.join(OG_DIR, 'manifest.json')) || {};

// The page's share card from scripts/og-images.js, or the default one.
function ogImage(key) {
  return ogManifest[key] && fs.existsSync(path.join(OG_DIR, `${key}.jpg`))
    ? `${SITE_URL}/assets/og/${key}.jpg?v=${ogManifest[key]}`
    : `${SITE_URL}/og-image.png`;
}

// Values are already escaped by the caller.
function seo({ title, description, canonical, og, alt, ogTitle, ogType = 'website', robots = INDEX, extra = '' }) {
  const image = ogImage(og);
  return {
    title, description, canonical, robots, ogType, ogTitle: ogTitle || title, ogAlt: alt || ogTitle || title,
    ogImage: image, ogImageType: image.includes('.jpg') ? 'image/jpeg' : 'image/png', ogExtra: extra,
  };
}

const arrow = '<svg><use href="#arrow"/></svg>';

function card(href, title, text, more) {
  return `<a class="card" href="${href}"><h3>${esc(title)}</h3><p>${esc(text)}</p><span class="more">${more} ${arrow}</span></a>`;
}


// ── Pricing (live plans from the app's Firestore, see scripts/pricing-data.js) ──

// Pro's long list opens with the tools people ask about most.
const PRICING_LEADS = ['Smart Money', 'RSI Filter', 'MACD Signal', 'Broker Heatmap', 'Support & Resistance', 'Swing Trades', 'Strategy Builder', 'Technicals tab (all indicators)'];
const FREE_FEATURES = ['Live NEPSE prices and indices', 'Portfolio with MeroShare import', 'Watchlist and price alerts', 'Broker activity and broker focus', 'Accumulation, bulk deals and floor sheet', 'IPO results for the whole family'];
const rs = (n) => 'Rs ' + Number(n).toLocaleString('en-IN');
const period = (m) => (m === 12 ? 'year' : m === 1 ? 'month' : `${m} months`);

// Free plus every paid plan, for the SoftwareApplication schema.
function appOffers(pricing) {
  const offer = (name, price, extra = {}) => ({ '@type': 'Offer', name, price: String(price), priceCurrency: 'NPR', availability: 'https://schema.org/InStock', ...extra });
  return [
    offer('Free', 0),
    ...((pricing && pricing.tiers) || []).flatMap((t) => t.plans.map((p) => offer(`${t.name}, ${period(p.months)}`, p.price, { category: 'subscription', url: `${SITE_URL}/#pricing` }))),
  ];
}

function pricingSection(pricing) {
  if (!pricing || !pricing.tiers || !pricing.tiers.length) return '';
  const tick = '<svg><use href="#tick"/></svg>';
  const list = (items) => `<ul class="price-list">${items.map((f) => `<li>${tick}${esc(f)}</li>`).join('')}</ul>`;
  const free = `<div class="price-card rv">
        <div class="price-top"><h3>Free</h3><p>Everything you need to start.</p></div>
        <div class="price-amt"><b class="n">Rs 0</b><span>forever</span></div>
        <a class="btn btn-ghost btn-lg" href="/download/" data-dl-btn>Download free</a>
        ${list(FREE_FEATURES)}
        <p class="price-more">Plus 40+ free tools</p>
      </div>`;
  const paid = pricing.tiers.map((t, i) => {
    const top = i === pricing.tiers.length - 1;
    const plan = t.plans[0];
    const lead = t.includesPrevious ? t.features : [...PRICING_LEADS.filter((f) => t.features.includes(f)), ...t.features.filter((f) => !PRICING_LEADS.includes(f))];
    // Higher plans list all their extras; the first plan shows 7 and folds the rest.
    const shown = t.includesPrevious ? lead : lead.slice(0, 7), rest = t.includesPrevious ? [] : lead.slice(7);
    const prev = t.includesPrevious ? `<p class="price-inc">Everything in ${esc(pricing.tiers[i - 1].name.replace(/^StockYan /, ''))}, plus:</p>` : '';
    const more = rest.length ? `<details class="price-all"><summary>See all ${t.featureCount} features</summary>${list(rest)}</details>` : '';
    const url = `${APP_LINK_HOST}/open/premium?tier=${encodeURIComponent(t.key)}&utm_source=website&utm_medium=pricing&utm_campaign=${encodeURIComponent(t.key)}`;
    return `<div class="price-card${top ? ' featured' : ''} rv" data-tier="${esc(t.key)}" style="--c:${esc(t.color || '#009E72')}">
        ${top ? '<span class="price-badge">Most complete</span>' : ''}
        <div class="price-top"><h3>${esc(t.name.replace(/^StockYan /, ''))}</h3><p>${esc(t.tagline || '')}</p></div>
        <div class="price-amt"><b class="n" data-f="price">${rs(plan.price)}</b><span data-f="period">per ${period(plan.months)}</span></div>
        <p class="price-pm n" data-f="pm">${rs(plan.perMonth)} a month</p>
        <a class="btn ${top ? 'btn-light' : 'btn-dark'} btn-lg" href="${esc(url)}">Get ${esc(t.name.replace(/^StockYan /, ''))}</a>
        ${prev}${list(shown)}${more}
      </div>`;
  }).join('\n      ');
  return `<section class="sec" id="pricing">
  <div class="wrap">
    <div class="head rv">
      <p class="eyebrow">Pricing</p>
      <h2 class="h2">Start free.<br><span class="g">Upgrade when you're ready.</span></h2>
      <p class="lead">Live data and dozens of tools are free. Pro and Max unlock every scanner, smart money tracking and ready-to-trade setups.</p>
    </div>
    <div class="price-grid" data-pricing>
      ${free}
      ${paid}
    </div>
    <p class="price-note">Prices in Nepali rupees. Pay with eSewa, Fonepay or the App Store.</p>
  </div>
</section>`;
}

// ── Older guides (data/articles.json) ──

function isHeading(block) {
  return !block.includes('\n') && block.length <= 90 && !/[.,;:!]$/.test(block);
}

function articleBody(content, title) {
  const blocks = content.split('\n\n').map((p) => p.trim()).filter(Boolean);
  if (blocks.length && isHeading(blocks[0]) && blocks[0].toLowerCase() === title.toLowerCase()) blocks.shift();
  return blocks
    .map((p) => (isHeading(p) ? `<h2>${esc(p)}</h2>` : `<p>${esc(p).replace(/\n/g, '<br>')}</p>`))
    .join('\n');
}

function readMinutes(text) {
  return Math.max(2, Math.round(text.split(/\s+/).length / 200));
}

// ── Build ──

async function build() {
  await refreshMarketData();
  await refreshPricing();

  const pages = readJson(path.join(ROOT, 'data', 'pages.json')) || { features: [], learn: [] };
  const articles = (readJson(path.join(ROOT, 'data', 'articles.json')) || []).filter((a) => a.isPublished);
  articles.sort((a, b) => (a.order - b.order) || (new Date(b.createdAt) - new Date(a.createdAt)));
  const features = pages.features || [];
  const learnPages = pages.learn || [];
  const featureBySlug = Object.fromEntries(features.map((f) => [f.slug, f]));

  // Learn entries from both sources, the structured guides first.
  const learnAll = [
    ...learnPages.map((l) => ({ slug: l.slug, title: l.h1, text: l.lead })),
    ...articles.map((a) => ({ slug: a.slug, title: a.title, text: a.metaDescription || truncate(a.content.replace(/\n/g, ' '), 140) })),
  ];

  globals = {
    site: SITE_URL,
    pricing: pricingSection(readJson(path.join(ROOT, 'data', 'pricing.json'))),
    year: String(new Date().getFullYear()),
    ogHome: ogImage('home'),
    appOffers: JSON.stringify(appOffers(readJson(path.join(ROOT, 'data', 'pricing.json')))),
    footerFeatures: features.slice(0, 5).map((f) => `<li><a href="/features/${f.slug}/">${esc(f.h1)}</a></li>`).join('') ||
      '<li><a href="/#research">Research</a></li><li><a href="/#portfolio">Portfolio</a></li><li><a href="/#free">Free tools</a></li>',
    footerLearn: learnAll.slice(0, 4).map((l) => `<li><a href="/learn/${l.slug}/">${esc(truncate(l.title, 34))}</a></li>`).join(''),
  };

  write('index.html', render(read(T('home.html')), seo({
    title: 'StockYan: Advanced NEPSE Analysis App for Nepal Investors',
    ogTitle: 'StockYan: The Advanced NEPSE Analysis App',
    description: 'StockYan turns complex NEPSE data into clear, actionable information. Stock scanners, smart money tracking, live data and portfolio tools in one app.',
    canonical: `${SITE_URL}/`, og: 'home', alt: 'StockYan on a MacBook and an iPhone: become a confident NEPSE investor.',
  })));
  write('download/index.html', render(read(T('download.html')), seo({
    title: 'Download StockYan: NEPSE App for iPhone, Android, Windows, Linux',
    ogTitle: 'Download StockYan: free on every device',
    description: 'Get StockYan free on iPhone, Android, Windows and Linux. The advanced NEPSE analysis app: complex market data turned into clear, actionable information.',
    canonical: `${SITE_URL}/download/`, og: 'download', alt: 'Get StockYan, the advanced NEPSE analysis app.',
  })));
  write('open/index.html', render(read(T('open.html')), seo({
    title: 'Open in StockYan', ogTitle: 'Open in StockYan',
    description: 'Open this in the StockYan app, or get the app free.',
    canonical: `${SITE_URL}/open/`, og: 'home', alt: 'StockYan, the advanced NEPSE analysis app.', robots: 'noindex, follow',
  })));

  // ── Feature pages ──
  if (fs.existsSync(path.join(ROOT, 'features'))) fs.rmSync(path.join(ROOT, 'features'), { recursive: true });
  for (const f of features) {
    const canonical = `${SITE_URL}/features/${f.slug}/`;
    const isPhone = !!f.heroShot && f.heroShot.startsWith('ph');
    const shot = f.heroShot && SHOTS[f.heroShot]
      ? (isPhone ? phone({ shot: f.heroShot, label: f.h1 }) : mac({ shots: f.heroShot, label: f.h1 }))
      : '';
    // The live widget beside the points; the stock finder is wide, so it sits above them.
    const widget = f.component && components[f.component];
    const demo = !widget ? ''
      : f.component === 'finder' ? `<div class="fp-demo fp-wide">${widget}</div>`
        : TILE_WIDGETS.has(f.component) ? `<div class="fp-demo rv"><div class="bento">${widget}</div></div>`
          : `<div class="fp-demo rv">${widget}</div>`;
    const howClass = !widget ? 'fp-how fp-solo' : f.component === 'finder' ? 'fp-how fp-stack' : 'fp-how';
    const sections = (f.sections || []).map((s, i) => `
      <div class="fp-point"><span class="fp-num">${String(i + 1).padStart(2, '0')}</span><div><h2>${esc(s.h2)}</h2><p>${esc(s.text)}</p>${s.points && s.points.length ? `<ul class="ticks">${s.points.map((p) => `<li><svg><use href="#tick"/></svg>${esc(p)}</li>`).join('')}</ul>` : ''}</div></div>`).join('');
    const relatedCards = [
      ...(f.related || []).filter((s) => featureBySlug[s]).map((s) => card(`/features/${s}/`, featureBySlug[s].h1, featureBySlug[s].lead, 'See feature')),
      ...(f.learn || []).map((s) => learnAll.find((l) => l.slug === s)).filter(Boolean).map((l) => card(`/learn/${l.slug}/`, l.title, l.text, 'Read guide')),
    ].slice(0, 6).join('');
    const ld = [
      { '@context': 'https://schema.org', '@type': 'WebPage', name: f.title, description: f.metaDescription, url: canonical, inLanguage: 'en', isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/#app` }, primaryImageOfPage: { '@type': 'ImageObject', url: ogImage(`feature-${f.slug}`), width: 1200, height: 630 }, keywords: f.keyword },
      breadcrumbLd([['Home', `${SITE_URL}/`], ['Features', `${SITE_URL}/features/`], [f.h1, canonical]]),
      faqLd(f.faq),
    ].filter(Boolean).map(jsonLd).join('\n');
    write(`features/${f.slug}/index.html`, render(read(T('feature.html')), {
      ...seo({ title: esc(f.title), description: esc(f.metaDescription), canonical, og: `feature-${f.slug}`, alt: esc(`${f.h1}: ${f.lead}`) }),
      crumb: esc(f.h1), slug: esc(f.slug),
      h1: accent(f.h1, f.accent), lead: esc(f.lead), openUrl: esc(openUrl(f.openPath, f.slug)),
      shot, shotClass: isPhone ? 'is-phone' : 'is-mac', demo, howClass, sections,
      faqSection: faqSection(f.faq),
      relatedSection: relatedCards ? relatedRow('Keep <span class="g">exploring.</span>', '/features/', 'All features', relatedCards) : '',
      jsonld: ld,
    }));
  }
  if (features.length) {
    write('features/index.html', render(read(T('index-grid.html')), {
      ...seo({
        title: 'StockYan Features: NEPSE Research, Portfolio and Free Tools',
        description: 'Everything in StockYan: NEPSE scanners, broker analysis, smart portfolio with MeroShare and TMS import, pro charts, IPO tools and free market data.',
        canonical: `${SITE_URL}/features/`, og: 'features', alt: 'Everything in StockYan: research, portfolio and free tools for NEPSE.',
      }),
      crumb: 'Features',
      h1: 'Everything in <span class="g">StockYan.</span>', lead: 'Research, portfolio and free tools for NEPSE. In one app.',
      cards: features.map((f) => card(`/features/${f.slug}/`, f.h1, f.lead, 'See feature')).join(''),
      jsonld: jsonLd(breadcrumbLd([['Home', `${SITE_URL}/`], ['Features', `${SITE_URL}/features/`]])),
    }));
  }

  // ── Learn pages ──
  const learnDir = path.join(ROOT, 'learn');
  if (fs.existsSync(learnDir)) fs.rmSync(learnDir, { recursive: true });
  const downloadCard = `<div class="card"><h3>Try it in StockYan</h3><p>Free on iPhone, Android, Windows, macOS and Linux.</p><a class="btn btn-dark" href="/download/?utm_source=website&amp;utm_medium=learn">Download free</a></div>`;
  const learnRelated = (slug) => {
    const cards = learnAll.filter((l) => l.slug !== slug).slice(0, 3).map((l) => card(`/learn/${l.slug}/`, l.title, l.text, 'Read guide')).join('');
    return relatedRow('Keep <span class="g">learning.</span>', '/learn/', 'All guides', cards);
  };

  for (const l of learnPages) {
    const canonical = `${SITE_URL}/learn/${l.slug}/`;
    const feature = featureBySlug[l.feature];
    const body = (l.body || []).map((b) => `<h2>${esc(b.h2)}</h2>${(b.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}${b.points && b.points.length ? `<ul>${b.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}`).join('\n') +
      (l.example ? `<div class="example"><h2>${esc(l.example.h2)}</h2>${(l.example.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : '');
    const aside = (feature
      ? `<div class="card"><h3>${esc(feature.h1)}</h3><p>${esc(feature.lead)}</p><a class="btn btn-dark" href="/features/${feature.slug}/">See how it works</a><a class="btn btn-ghost" href="${esc(openUrl(l.openPath || feature.openPath, l.slug))}">Open in app</a></div>`
      : '') + downloadCard;
    const ld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: l.h1, description: l.metaDescription, url: canonical, mainEntityOfPage: canonical, inLanguage: 'en', keywords: l.keyword, dateModified: today(), author: { '@type': 'Organization', name: 'StockYan', url: `${SITE_URL}/` }, publisher: { '@id': `${SITE_URL}/#organization` }, image: { '@type': 'ImageObject', url: ogImage(`learn-${l.slug}`), width: 1200, height: 630 } },
      breadcrumbLd([['Home', `${SITE_URL}/`], ['Learn', `${SITE_URL}/learn/`], [l.h1, canonical]]),
      faqLd(l.faq),
    ].filter(Boolean).map(jsonLd).join('\n');
    write(`learn/${l.slug}/index.html`, render(read(T('learn.html')), {
      ...seo({ title: esc(l.title), description: esc(l.metaDescription), canonical, og: `learn-${l.slug}`, ogType: 'article', alt: esc(`${l.h1}: ${l.lead}`), extra: `<meta property="article:section" content="Learn NEPSE">` }),
      crumb: esc(l.h1),
      h1: accent(l.h1, l.accent), lead: esc(l.lead), meta: `${l.readMinutes || 4} min read`,
      body, aside, faqSection: faqSection(l.faq), relatedSection: learnRelated(l.slug), jsonld: ld,
    }));
  }

  for (const a of articles) {
    const canonical = `${SITE_URL}/learn/${a.slug}/`;
    const description = a.metaDescription || truncate(a.content.replace(/\n/g, ' '), 155);
    const published = new Date(a.createdAt).toISOString(), modified = new Date(a.updatedAt || a.createdAt).toISOString();
    const ld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description, url: canonical, mainEntityOfPage: canonical, inLanguage: 'en', datePublished: published, dateModified: modified, articleSection: a.category, author: { '@type': 'Organization', name: 'StockYan', url: `${SITE_URL}/` }, publisher: { '@id': `${SITE_URL}/#organization` }, image: { '@type': 'ImageObject', url: ogImage(`learn-${a.slug}`), width: 1200, height: 630 } },
      breadcrumbLd([['Home', `${SITE_URL}/`], ['Learn', `${SITE_URL}/learn/`], [a.title, canonical]]),
    ].map(jsonLd).join('\n');
    write(`learn/${a.slug}/index.html`, render(read(T('learn.html')), {
      ...seo({
        title: esc(`${a.title} | StockYan`), ogTitle: esc(a.title), description: esc(description), canonical, og: `learn-${a.slug}`, ogType: 'article', alt: esc(a.title),
        extra: [['published_time', published], ['modified_time', modified], ['section', a.category]].map(([k, v]) => `<meta property="article:${k}" content="${esc(v)}">`).join('\n'),
      }),
      crumb: esc(a.title),
      h1: esc(a.title), lead: esc(truncate(description, 160)), meta: `${esc(a.category)} · ${formatDate(a.createdAt)} · ${readMinutes(a.content)} min read`,
      body: articleBody(a.content, a.title), aside: downloadCard, faqSection: '', relatedSection: learnRelated(a.slug), jsonld: ld,
    }));
  }

  write('learn/index.html', render(read(T('index-grid.html')), {
    ...seo({
      title: 'Learn NEPSE: Simple Guides to Stocks, Charts and Brokers | StockYan',
      description: 'Free, simple guides to the Nepal share market: RSI, support and resistance, broker data, circuit breakers, IPOs and more.',
      canonical: `${SITE_URL}/learn/`, og: 'learn', alt: 'Simple guides to NEPSE from StockYan.',
    }),
    crumb: 'Learn',
    h1: 'Learn <span class="g">NEPSE.</span>', lead: 'Simple guides for first-time investors and full-time traders.',
    cards: learnAll.map((l) => card(`/learn/${l.slug}/`, l.title, l.text, 'Read guide')).join(''),
    jsonld: jsonLd(breadcrumbLd([['Home', `${SITE_URL}/`], ['Learn', `${SITE_URL}/learn/`]])),
  }));

  // ── Sitemap ──
  const urls = [
    ['/', 'weekly', '1.0', 'home'], ['/download/', 'monthly', '0.9', 'download'],
    ...(features.length ? [['/features/', 'weekly', '0.8', 'features']] : []),
    ...features.map((f) => [`/features/${f.slug}/`, 'monthly', '0.8', `feature-${f.slug}`]),
    ['/learn/', 'weekly', '0.8', 'learn'],
    ...learnPages.map((l) => [`/learn/${l.slug}/`, 'monthly', '0.7', `learn-${l.slug}`]),
    ...articles.map((a) => [`/learn/${a.slug}/`, 'monthly', '0.6', `learn-${a.slug}`]),
    ['/terms/', 'yearly', '0.3'],
  ];
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(([u, freq, pri, og]) => `  <url>
    <loc>${SITE_URL}${u}</loc>
    <lastmod>${today()}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>${og && ogManifest[og] ? `
    <image:image><image:loc>${SITE_URL}/assets/og/${og}.jpg</image:loc></image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`);
  console.log(`  Updated sitemap.xml (${urls.length} URLs)`);

  // ── llms.txt: a plain map of the site for AI answer engines ──
  const link = (u, name, text) => `- [${name}](${SITE_URL}${u})${text ? `: ${text}` : ''}`;
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), [
    '# StockYan',
    '',
    '> StockYan is an advanced NEPSE (Nepal Stock Exchange) analysis app. It turns complex NEPSE data into clear, actionable information: stock scanners, broker and smart money tracking, AI scores, pro charts, live prices and a portfolio that imports from MeroShare and TMS. Free on iPhone, Android, Windows and Linux, with paid Pro and Max plans. Made by Investo Nepal.',
    '',
    '## Main pages',
    link('/', 'Home', 'what StockYan does, free tools and pricing'),
    link('/download/', 'Download', 'App Store, Google Play and desktop downloads'),
    link('/features/', 'Features', 'every StockYan feature'),
    link('/learn/', 'Learn NEPSE', 'simple guides to the Nepal share market'),
    '',
    '## Features',
    ...features.map((f) => link(`/features/${f.slug}/`, f.h1, f.lead)),
    '',
    '## Guides',
    ...learnPages.map((l) => link(`/learn/${l.slug}/`, l.h1, l.lead)),
    ...articles.map((a) => link(`/learn/${a.slug}/`, a.title, a.metaDescription)),
    '',
    '## Apps',
    '- [StockYan on the App Store](https://apps.apple.com/np/app/stockyan-nepal-share-market/id6757148688)',
    '- [StockYan on Google Play](https://play.google.com/store/apps/details?id=app.golden.stockyan)',
    '',
  ].join('\n'));
  console.log('  Updated llms.txt');
}

// scripts/og-images.js reuses the frames and page data.
module.exports = { SITE_URL, ROOT, SHOTS, esc, accent, mac, phone, render, readJson, partials };

if (require.main === module) {
  console.log('Building StockYan site...');
  build().then(() => console.log('Done.')).catch((err) => { console.error(err); process.exit(1); });
}
