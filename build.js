const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://stockyan.info';

// ── Learn (articles) ──
const ARTICLES_DATA_FILE = path.join(__dirname, 'data', 'articles.json');
const LEARN_DIR = path.join(__dirname, 'learn');
const ARTICLE_TEMPLATE = path.join(__dirname, 'templates', 'article.html');
const ARTICLES_LISTING_TEMPLATE = path.join(__dirname, 'templates', 'listing.html');

// ── Stocks ──
const STOCKS_DATA_FILE = path.join(__dirname, 'data', 'stocks.json');
const STOCKS_DIR = path.join(__dirname, 'stocks');
const STOCK_TEMPLATE = path.join(__dirname, 'templates', 'stock.html');
const STOCKS_LISTING_TEMPLATE = path.join(__dirname, 'templates', 'stocks-listing.html');

// ── Indexes ──
const INDEXES_DATA_FILE = path.join(__dirname, 'data', 'indexes.json');
const INDEXES_DIR = path.join(__dirname, 'indexes');
const INDEX_TEMPLATE = path.join(__dirname, 'templates', 'market-index.html');
const INDEXES_LISTING_TEMPLATE = path.join(__dirname, 'templates', 'indexes-listing.html');

const SITEMAP_FILE = path.join(__dirname, 'sitemap.xml');

// ── Helpers ──

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsonString(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function contentToHtml(content) {
  return content
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n        ');
}

function truncate(str, len) {
  if (str.length <= len) return str;
  return str.slice(0, len).replace(/\s+\S*$/, '') + '...';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoDate(dateStr) {
  return new Date(dateStr).toISOString();
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

// ── Build: Articles ──

function buildArticles() {
  if (!fs.existsSync(ARTICLES_DATA_FILE)) {
    console.log('No data/articles.json found — skipping learn page generation.');
    if (!fs.existsSync(LEARN_DIR)) fs.mkdirSync(LEARN_DIR, { recursive: true });
    return [];
  }

  const articles = JSON.parse(fs.readFileSync(ARTICLES_DATA_FILE, 'utf8'));
  const published = articles.filter(a => a.isPublished);

  if (published.length === 0) {
    console.log('No published articles — skipping learn page generation.');
    return [];
  }

  published.sort((a, b) => (a.order - b.order) || (new Date(b.createdAt) - new Date(a.createdAt)));

  const articleTemplate = fs.readFileSync(ARTICLE_TEMPLATE, 'utf8');
  const listingTemplate = fs.readFileSync(ARTICLES_LISTING_TEMPLATE, 'utf8');

  const categories = [...new Set(published.map(a => a.category))].sort();

  if (fs.existsSync(LEARN_DIR)) fs.rmSync(LEARN_DIR, { recursive: true });
  fs.mkdirSync(LEARN_DIR, { recursive: true });

  // ── Article pages ──
  for (const article of published) {
    const dir = path.join(LEARN_DIR, article.slug);
    fs.mkdirSync(dir, { recursive: true });

    const description = truncate(article.content.replace(/\n/g, ' '), 160);
    const articleHtml = contentToHtml(article.content);
    const canonical = `${SITE_URL}/learn/${article.slug}/`;
    const datePublished = isoDate(article.createdAt);
    const dateModified = article.updatedAt ? isoDate(article.updatedAt) : datePublished;

    const ogImage = article.imageUrl || `${SITE_URL}/og-image.png`;
    const heroImage = article.imageUrl
      ? `<div class="article-hero-image"><img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}"></div>`
      : '';

    const html = articleTemplate
      .replace(/{{jsonTitle}}/g, escapeJsonString(article.title))
      .replace(/{{jsonDescription}}/g, escapeJsonString(description))
      .replace(/{{jsonCategory}}/g, escapeJsonString(article.category))
      .replace(/{{jsonImage}}/g, escapeJsonString(ogImage))
      .replace(/{{title}}/g, escapeHtml(article.title))
      .replace(/{{description}}/g, escapeHtml(description))
      .replace(/{{ogImage}}/g, escapeHtml(ogImage))
      .replace(/{{canonical}}/g, canonical)
      .replace(/{{category}}/g, escapeHtml(article.category))
      .replace(/{{heroImage}}/g, heroImage)
      .replace(/{{content}}/g, articleHtml)
      .replace(/{{datePublished}}/g, datePublished)
      .replace(/{{dateModified}}/g, dateModified)
      .replace(/{{dateFormatted}}/g, formatDate(article.createdAt))
      .replace(/{{slug}}/g, article.slug);

    fs.writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`  Generated: /learn/${article.slug}/`);
  }

  // ── Articles listing page ──
  const articleCards = published.map(article => {
    const description = truncate(article.content.replace(/\n/g, ' '), 120);
    const thumbnail = article.imageUrl
      ? `<div class="article-thumbnail"><img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy"></div>`
      : '';
    return `
      <a href="/learn/${article.slug}/" class="article-card" data-category="${escapeHtml(article.category)}">
        ${thumbnail}
        <div class="article-card-body">
          <span class="article-category">${escapeHtml(article.category)}</span>
          <h3>${escapeHtml(article.title)}</h3>
          <p>${escapeHtml(description)}</p>
          <span class="article-date">${formatDate(article.createdAt)}</span>
        </div>
      </a>`;
  }).join('\n');

  const categoryPills = categories.map(cat =>
    `<button class="category-pill" data-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
  ).join('\n          ');

  const listingHtml = listingTemplate
    .replace(/{{articleCards}}/g, articleCards)
    .replace(/{{categoryPills}}/g, categoryPills)
    .replace(/{{articleCount}}/g, published.length);

  fs.writeFileSync(path.join(LEARN_DIR, 'index.html'), listingHtml);
  console.log(`  Generated: /learn/ (${published.length} articles)`);

  return published;
}

// ── Build: Stocks ──

function buildStocks() {
  if (!fs.existsSync(STOCKS_DATA_FILE)) {
    console.log('No data/stocks.json found — skipping stock page generation.');
    return [];
  }

  const stocks = JSON.parse(fs.readFileSync(STOCKS_DATA_FILE, 'utf8'));
  const published = stocks.filter(s => s.isPublished);

  if (published.length === 0) {
    console.log('No published stocks — skipping stock page generation.');
    return [];
  }

  published.sort((a, b) => (a.order || 0) - (b.order || 0) || a.symbol.localeCompare(b.symbol));

  const stockTemplate = fs.readFileSync(STOCK_TEMPLATE, 'utf8');
  const listingTemplate = fs.readFileSync(STOCKS_LISTING_TEMPLATE, 'utf8');

  const sectors = [...new Set(published.map(s => s.sector))].sort();

  if (fs.existsSync(STOCKS_DIR)) fs.rmSync(STOCKS_DIR, { recursive: true });
  fs.mkdirSync(STOCKS_DIR, { recursive: true });

  // ── Per-stock pages ──
  for (const stock of published) {
    const slug = stock.symbol.toLowerCase();
    const dir = path.join(STOCKS_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });

    const canonical = `${SITE_URL}/stocks/${slug}/`;
    const listedDateFormatted = stock.listedDate ? formatDate(stock.listedDate) : '—';
    const metaDescription = truncate(
      `${stock.name} (${stock.symbol}) is listed on NEPSE under ${stock.sector}. View live candlestick chart, sector data, and reference information.`,
      160
    );

    const highlightsHtml = (stock.highlights || [])
      .map(h => `<li>${escapeHtml(h)}</li>`)
      .join('\n          ');

    const html = stockTemplate
      .replace(/{{jsonName}}/g, escapeJsonString(stock.name))
      .replace(/{{jsonDescription}}/g, escapeJsonString(stock.description))
      .replace(/{{jsonSector}}/g, escapeJsonString(stock.sector))
      .replace(/{{symbol}}/g, escapeHtml(stock.symbol))
      .replace(/{{name}}/g, escapeHtml(stock.name))
      .replace(/{{sector}}/g, escapeHtml(stock.sector))
      .replace(/{{listedDateFormatted}}/g, escapeHtml(listedDateFormatted))
      .replace(/{{isin}}/g, escapeHtml(stock.isin || '—'))
      .replace(/{{lotSize}}/g, escapeHtml(stock.lotSize != null ? String(stock.lotSize) : '—'))
      .replace(/{{description}}/g, escapeHtml(stock.description || ''))
      .replace(/{{highlightsHtml}}/g, highlightsHtml)
      .replace(/{{metaDescription}}/g, escapeHtml(metaDescription))
      .replace(/{{canonical}}/g, canonical);

    fs.writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`  Generated: /stocks/${slug}/`);
  }

  // ── Stocks listing page ──
  const stockCards = published.map(stock => {
    const slug = stock.symbol.toLowerCase();
    return `
      <a href="/stocks/${slug}/" class="stock-card" data-sector="${escapeHtml(stock.sector)}">
        <span class="stock-card-symbol">${escapeHtml(stock.symbol)}</span>
        <span class="stock-card-name">${escapeHtml(stock.name)}</span>
        <span class="stock-card-sector">${escapeHtml(stock.sector)}</span>
      </a>`;
  }).join('\n');

  const sectorPills = sectors.map(sector =>
    `<button class="category-pill" data-filter="${escapeHtml(sector)}">${escapeHtml(sector)}</button>`
  ).join('\n          ');

  const listingHtml = listingTemplate
    .replace(/{{stockCards}}/g, stockCards)
    .replace(/{{sectorPills}}/g, sectorPills)
    .replace(/{{stockCount}}/g, published.length);

  fs.writeFileSync(path.join(STOCKS_DIR, 'index.html'), listingHtml);
  console.log(`  Generated: /stocks/ (${published.length} stocks)`);

  return published;
}

// ── Build: Indexes ──

function buildIndexes() {
  if (!fs.existsSync(INDEXES_DATA_FILE)) {
    console.log('No data/indexes.json found — skipping index page generation.');
    return [];
  }

  const indexes = JSON.parse(fs.readFileSync(INDEXES_DATA_FILE, 'utf8'));
  const published = indexes.filter(x => x.isPublished);

  // Always clean the indexes dir so removing entries doesn't leave stale pages
  if (fs.existsSync(INDEXES_DIR)) fs.rmSync(INDEXES_DIR, { recursive: true });

  if (published.length === 0) {
    console.log('No published indexes — skipping index page generation.');
    return [];
  }

  published.sort((a, b) => (a.order || 0) - (b.order || 0) || a.symbol.localeCompare(b.symbol));

  const indexTemplate = fs.readFileSync(INDEX_TEMPLATE, 'utf8');
  const listingTemplate = fs.readFileSync(INDEXES_LISTING_TEMPLATE, 'utf8');

  const kinds = [...new Set(published.map(x => x.kind))].sort();

  fs.mkdirSync(INDEXES_DIR, { recursive: true });

  for (const idx of published) {
    const slug = idx.symbol.toLowerCase();
    const dir = path.join(INDEXES_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });

    const canonical = `${SITE_URL}/indexes/${slug}/`;
    const metaDescription = truncate(
      `${idx.name} (${idx.symbol}) — live candlestick chart, key facts, and historical performance on the Nepal Stock Exchange (NEPSE).`,
      160
    );

    const highlightsHtml = (idx.highlights || [])
      .map(h => `<li>${escapeHtml(h)}</li>`)
      .join('\n          ');

    const html = indexTemplate
      .replace(/{{jsonName}}/g, escapeJsonString(idx.name))
      .replace(/{{jsonDescription}}/g, escapeJsonString(idx.description || ''))
      .replace(/{{symbol}}/g, escapeHtml(idx.symbol))
      .replace(/{{name}}/g, escapeHtml(idx.name))
      .replace(/{{kindLabel}}/g, escapeHtml(idx.kind))
      .replace(/{{description}}/g, escapeHtml(idx.description || ''))
      .replace(/{{highlightsHtml}}/g, highlightsHtml)
      .replace(/{{metaDescription}}/g, escapeHtml(metaDescription))
      .replace(/{{canonical}}/g, canonical);

    fs.writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`  Generated: /indexes/${slug}/`);
  }

  // ── Listing ──
  const indexCards = published.map(idx => {
    const slug = idx.symbol.toLowerCase();
    return `
      <a href="/indexes/${slug}/" class="stock-card" data-kind="${escapeHtml(idx.kind)}">
        <span class="stock-card-symbol">${escapeHtml(idx.symbol)}</span>
        <span class="stock-card-name">${escapeHtml(idx.name)}</span>
        <span class="stock-card-sector">${escapeHtml(idx.kind)}</span>
      </a>`;
  }).join('\n');

  const kindPills = kinds.map(k =>
    `<button class="category-pill" data-filter="${escapeHtml(k)}">${escapeHtml(k)}</button>`
  ).join('\n          ');

  const listingHtml = listingTemplate
    .replace(/{{indexCards}}/g, indexCards)
    .replace(/{{kindPills}}/g, kindPills)
    .replace(/{{indexCount}}/g, published.length);

  fs.writeFileSync(path.join(INDEXES_DIR, 'index.html'), listingHtml);
  console.log(`  Generated: /indexes/ (${published.length} indexes)`);

  return published;
}

// ── Build: Sitemap ──

function buildSitemap(publishedArticles, publishedStocks, publishedIndexes) {
  const articleUrls = publishedArticles.map(article => `  <url>
    <loc>${SITE_URL}/learn/${article.slug}/</loc>
    <lastmod>${(article.updatedAt || article.createdAt).split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');

  const stockUrls = publishedStocks.map(stock => `  <url>
    <loc>${SITE_URL}/stocks/${stock.symbol.toLowerCase()}/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');

  const indexUrls = publishedIndexes.map(idx => `  <url>
    <loc>${SITE_URL}/indexes/${idx.symbol.toLowerCase()}/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`).join('\n');

  const sections = [];
  sections.push(`  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`);

  if (publishedArticles.length > 0) {
    sections.push(`  <url>
    <loc>${SITE_URL}/learn/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    sections.push(articleUrls);
  }

  if (publishedStocks.length > 0) {
    sections.push(`  <url>
    <loc>${SITE_URL}/stocks/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
    sections.push(stockUrls);
  }

  if (publishedIndexes.length > 0) {
    sections.push(`  <url>
    <loc>${SITE_URL}/indexes/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
    sections.push(indexUrls);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sections.join('\n')}
</urlset>
`;
  fs.writeFileSync(SITEMAP_FILE, sitemap);
  console.log(`  Updated sitemap.xml (${publishedArticles.length} articles, ${publishedStocks.length} stocks, ${publishedIndexes.length} indexes)`);
}

// ── Run ──

console.log('Building StockYan pages...');
const articles = buildArticles();
const stocks = buildStocks();
const indexes = buildIndexes();
buildSitemap(articles, stocks, indexes);
console.log('Done.');
