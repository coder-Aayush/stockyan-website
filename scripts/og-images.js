// Renders the social share cards (1200x630) in assets/og/: one for the home,
// download and index pages and one per feature and learn page.
// Run locally with `npm run og` and commit the images: it needs Google Chrome
// and macOS `sips`, which the Vercel build does not have. Cards whose content
// has not changed are skipped (assets/og/manifest.json); pass --force to redo all.

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { ROOT, esc, accent, mac, phone, render, readJson } = require('../build');

const OUT = path.join(ROOT, 'assets', 'og');
const TMP = path.join(ROOT, 'temp', 'og');
const MANIFEST = path.join(OUT, 'manifest.json');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const force = process.argv.includes('--force');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);

// The NEPSE index as a soft line along the bottom of every card.
function nepseLine() {
  const market = readJson(path.join(ROOT, 'data', 'market.json'));
  const c = market && market.prices && market.prices.NEPSE ? market.prices.NEPSE.c.slice(-120) : [];
  if (c.length < 20) return '';
  const lo = Math.min(...c), hi = Math.max(...c), w = 1200, h = 230;
  const pts = c.map((v, i) => [(i / (c.length - 1)) * w, h - 24 - ((v - lo) / (hi - lo || 1)) * (h - 70)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<svg class="line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id="ogFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00B383" stop-opacity=".13"/><stop offset="1" stop-color="#00B383" stop-opacity="0"/></linearGradient></defs>
  <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#ogFill)"/>
  <path d="${d}" fill="none" stroke="#00B383" stroke-opacity=".35" stroke-width="2.5"/>
</svg>`;
}

function devices(shot, extraPhone) {
  if (!shot) shot = 'mac2';
  if (shot.startsWith('ph')) return { cls: 'is-phone', html: `<div class="dev phone">${phone({ shot, label: '' })}</div>` };
  const m = `<div class="dev mac">${mac({ shots: shot, label: '' })}</div>`;
  if (!extraPhone) return { cls: 'is-mac', html: m };
  return { cls: 'is-both', html: m + `<div class="dev phone">${phone({ shot: extraPhone, label: '' })}</div>` };
}

function cards() {
  const pages = readJson(path.join(ROOT, 'data', 'pages.json')) || { features: [], learn: [] };
  const articles = (readJson(path.join(ROOT, 'data', 'articles.json')) || []).filter((a) => a.isPublished);
  const features = pages.features || [];
  const bySlug = Object.fromEntries(features.map((f) => [f.slug, f]));
  const devicesFoot = 'iPhone, Android and desktop';
  const list = [
    { key: 'home', eyebrow: 'The advanced NEPSE analysis app', title: 'NEPSE, <span class="g">simplified.</span>', lead: 'Complex market data, turned into clear and actionable information.', shot: 'mac2', extraPhone: 'ph2049', foot: devicesFoot },
    { key: 'download', eyebrow: 'Free download', title: 'Get <span class="g">StockYan.</span>', lead: 'The advanced NEPSE analysis app. One account on every device.', shot: 'mac2', extraPhone: 'ph2050', foot: devicesFoot },
    { key: 'features', eyebrow: 'Features', title: 'Everything in <span class="g">StockYan.</span>', lead: 'Research, portfolio and free tools for NEPSE. In one app.', shot: 'mac7', foot: devicesFoot },
    { key: 'learn', eyebrow: 'Learn NEPSE', title: 'Simple guides to <span class="g">NEPSE.</span>', lead: 'For first-time investors and full-time traders.', shot: 'mac1', foot: 'Free guides' },
    ...features.map((f) => ({ key: `feature-${f.slug}`, eyebrow: 'StockYan feature', title: accent(f.h1, f.accent), lead: esc(f.lead), shot: f.heroShot, foot: devicesFoot })),
    ...(pages.learn || []).map((l) => ({ key: `learn-${l.slug}`, eyebrow: `Guide · ${l.readMinutes || 4} min read`, title: accent(l.h1, l.accent), lead: esc(l.lead), shot: (bySlug[l.feature] || {}).heroShot, foot: 'Learn NEPSE' })),
    ...articles.map((a) => ({ key: `learn-${a.slug}`, eyebrow: `Guide · ${a.category}`, title: esc(a.title), lead: esc(a.metaDescription || ''), shot: 'mac5', foot: 'Learn NEPSE' })),
  ];
  const line = nepseLine();
  const template = fs.readFileSync(path.join(ROOT, 'templates', 'og.html'), 'utf8');
  return list.map((c) => {
    const dev = devices(c.shot, c.extraPhone);
    const html = render(template, {
      eyebrow: esc(c.eyebrow), title: c.title, lead: c.lead, foot: esc(c.foot), line,
      devices: dev.html, deviceClass: dev.cls, copyWidth: dev.cls === 'is-phone' ? 700 : 560,
    });
    // Screenshots are part of the hash so a new screenshot redraws its cards.
    const shots = [...html.matchAll(/\/assets\/img\/([\w.-]+)/g)].map((m) => fs.statSync(path.join(ROOT, 'assets', 'img', m[1])).mtimeMs).join();
    return { key: c.key, html, hash: crypto.createHash('md5').update(html + shots).digest('hex').slice(0, 10) };
  });
}

function serve() {
  const types = { '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript' };
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const run = (cmd, args) => new Promise((resolve, reject) => execFile(cmd, args, { timeout: 60000 }, (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout))));

async function shoot(port, card) {
  const htmlFile = path.join(TMP, `${card.key}.html`);
  const png = path.join(TMP, `${card.key}.png`);
  fs.writeFileSync(htmlFile, card.html);
  await run(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${path.join(TMP, 'chrome-' + card.key)}`,
    '--window-size=1200,630', '--virtual-time-budget=6000', `--screenshot=${png}`,
    `http://127.0.0.1:${port}/temp/og/${card.key}.html`,
  ]);
  if (!fs.existsSync(png)) throw new Error(`Chrome made no screenshot for ${card.key}`);
  await run('sips', ['-c', '630', '1200', '--cropOffset', '0', '0', png]);
  await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', png, '--out', path.join(OUT, `${card.key}.jpg`)]);
  return png;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const manifest = readJson(MANIFEST) || {};
  const all = cards();
  const todo = all.filter((c) => (!only || c.key === only) && (force || only || manifest[c.key] !== c.hash || !fs.existsSync(path.join(OUT, `${c.key}.jpg`))));
  console.log(`OG cards: ${todo.length} to render, ${all.length - todo.length} unchanged`);
  const server = await serve();
  const port = server.address().port;
  // One at a time: parallel headless Chrome runs exit without a screenshot.
  for (const c of todo) {
    const png = await shoot(port, c);
    if (c.key === 'home') fs.copyFileSync(png, path.join(ROOT, 'og-image.png'));
    manifest[c.key] = c.hash;
    console.log(`  ${c.key}.jpg`);
  }
  server.close();
  // Drop cards for pages that no longer exist.
  for (const key of Object.keys(manifest)) {
    if (all.some((c) => c.key === key)) continue;
    delete manifest[key];
    fs.rmSync(path.join(OUT, `${key}.jpg`), { force: true });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  fs.rmSync(TMP, { recursive: true, force: true });
}

main().catch((err) => { console.error(err); process.exit(1); });
