const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://stockyan.heyaayush.com';
const DATA_FILE = path.join(__dirname, 'data', 'articles.json');
const LEARN_DIR = path.join(__dirname, 'learn');
const ARTICLE_TEMPLATE = path.join(__dirname, 'templates', 'article.html');
const LISTING_TEMPLATE = path.join(__dirname, 'templates', 'listing.html');
const SITEMAP_FILE = path.join(__dirname, 'sitemap.xml');

// ── Helpers ──

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsonString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
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

// ── Build ──

function build() {
  // Gracefully skip if no articles data
  if (!fs.existsSync(DATA_FILE)) {
    console.log('No data/articles.json found — skipping learn page generation.');
    // Still ensure learn dir exists for clean deploys
    if (!fs.existsSync(LEARN_DIR)) fs.mkdirSync(LEARN_DIR, { recursive: true });
    return;
  }

  const articles = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const published = articles.filter(a => a.isPublished);

  if (published.length === 0) {
    console.log('No published articles — skipping learn page generation.');
    return;
  }

  // Sort by order (ascending), then by createdAt (newest first)
  published.sort((a, b) => (a.order - b.order) || (new Date(b.createdAt) - new Date(a.createdAt)));

  const articleTemplate = fs.readFileSync(ARTICLE_TEMPLATE, 'utf8');
  const listingTemplate = fs.readFileSync(LISTING_TEMPLATE, 'utf8');

  // Collect categories
  const categories = [...new Set(published.map(a => a.category))].sort();

  // Clean and recreate learn dir
  if (fs.existsSync(LEARN_DIR)) fs.rmSync(LEARN_DIR, { recursive: true });
  fs.mkdirSync(LEARN_DIR, { recursive: true });

  // ── Generate article pages ──
  for (const article of published) {
    const dir = path.join(LEARN_DIR, article.slug);
    fs.mkdirSync(dir, { recursive: true });

    const description = truncate(article.content.replace(/\n/g, ' '), 160);
    const articleHtml = contentToHtml(article.content);
    const canonical = `${SITE_URL}/learn/${article.slug}/`;
    const datePublished = isoDate(article.createdAt);
    const dateModified = article.updatedAt ? isoDate(article.updatedAt) : datePublished;

    const html = articleTemplate
      .replace(/{{jsonTitle}}/g, escapeJsonString(article.title))
      .replace(/{{jsonDescription}}/g, escapeJsonString(description))
      .replace(/{{jsonCategory}}/g, escapeJsonString(article.category))
      .replace(/{{title}}/g, escapeHtml(article.title))
      .replace(/{{description}}/g, escapeHtml(description))
      .replace(/{{canonical}}/g, canonical)
      .replace(/{{category}}/g, escapeHtml(article.category))
      .replace(/{{content}}/g, articleHtml)
      .replace(/{{datePublished}}/g, datePublished)
      .replace(/{{dateModified}}/g, dateModified)
      .replace(/{{dateFormatted}}/g, formatDate(article.createdAt))
      .replace(/{{slug}}/g, article.slug);

    fs.writeFileSync(path.join(dir, 'index.html'), html);
    console.log(`  Generated: /learn/${article.slug}/`);
  }

  // ── Generate listing page ──
  const articleCards = published.map(article => {
    const description = truncate(article.content.replace(/\n/g, ' '), 120);
    return `
      <a href="/learn/${article.slug}/" class="article-card" data-category="${escapeHtml(article.category)}">
        <span class="article-category">${escapeHtml(article.category)}</span>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(description)}</p>
        <span class="article-date">${formatDate(article.createdAt)}</span>
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

  // ── Regenerate sitemap ──
  const articleUrls = published.map(article => `  <url>
    <loc>${SITE_URL}/learn/${article.slug}/</loc>
    <lastmod>${(article.updatedAt || article.createdAt).split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/learn/</loc>
    <lastmod>${todayIso()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
${articleUrls}
</urlset>
`;
  fs.writeFileSync(SITEMAP_FILE, sitemap);
  console.log(`  Updated sitemap.xml with ${published.length} article URLs`);
}

console.log('Building StockYan learn pages...');
build();
console.log('Done.');
