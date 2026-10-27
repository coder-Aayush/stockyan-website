// Refreshes data/market.json, the real NEPSE numbers behind the homepage and
// feature page widgets (charts, broker positions, bulk deals, floor sheet).
// Runs on every build. If the API is down or returns nothing, the committed
// file stays as it is, so a deploy never ships empty widgets.

const fs = require('fs');
const path = require('path');

const API = 'https://stockyan.astrixel.com';
const OUT = path.join(__dirname, '..', 'data', 'market.json');
const FEATURED = 'NABIL';
const STOCKS = ['KBL', 'GHL', 'HFIN', 'NICA', 'NTC', 'HIDCL', 'UPPER'];

async function get(url) {
  const res = await fetch(API + url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const round = (n) => Math.round(n * 100) / 100;

async function history(symbol, pages) {
  let rows = [];
  for (let page = 1; page <= pages; page++) {
    const data = await get(`/api/price-history/by-symbol/${symbol}?page=${page}&size=50`);
    if (!data.content || !data.content.length) break;
    rows = rows.concat(data.content);
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return {
    d: rows.map((r) => r.date),
    o: rows.map((r) => round(r.open)),
    h: rows.map((r) => round(r.high)),
    l: rows.map((r) => round(r.low)),
    c: rows.map((r) => round(r.close)),
  };
}

// Latest four fiscal years: the audited annual report when there is one,
// otherwise the fourth-quarter (unaudited) result.
function fiscalYears(entries) {
  const byYear = new Map();
  for (const e of entries) {
    if (e.quarter !== 'Annual' && e.quarter !== 'Fourth Quarter') continue;
    const prev = byYear.get(e.fiscalYearNepali);
    if (!prev || (prev.quarter !== 'Annual' && e.quarter === 'Annual')) byYear.set(e.fiscalYearNepali, e);
  }
  return [...byYear.values()]
    .sort((a, b) => a.fiscalYearNepali.localeCompare(b.fiscalYearNepali))
    .slice(-4)
    .map((e) => ({
      fy: e.fiscalYearNepali.slice(1, 4) + '/' + e.fiscalYearNepali.slice(-2),
      profitCr: Math.round(e.profitAmount / 1e7),
      eps: e.eps,
      bookValue: e.netWorthPerShare,
    }));
}

// NEPSE index daily candles (the price history API covers stocks only).
async function nepseCandles() {
  const now = Math.floor(Date.now() / 1000);
  const res = await fetch(`${API}/udf/history?symbol=NEPSE&resolution=1D&from=${now - 400 * 86400}&to=${now}`, { signal: AbortSignal.timeout(20000) });
  const d = await res.json();
  if (d.s !== 'ok' || !d.t || d.t.length < 50) throw new Error('NEPSE history unavailable');
  const n = Math.min(160, d.t.length), cut = (a) => a.slice(-n).map(round);
  return { d: d.t.slice(-n).map((t) => new Date(t * 1000).toISOString().slice(0, 10)), o: cut(d.o), h: cut(d.h), l: cut(d.l), c: cut(d.c) };
}

async function brokerNet(symbol, duration) {
  const query = `duration=${duration}&symbol=${symbol}&size=100`;
  const [acc, dist] = await Promise.all([
    get(`/api/broker-analysis/accumulation?${query}`),
    get(`/api/broker-analysis/distribution?${query}`),
  ]);
  const buyers = acc.content.filter((r) => r.symbol === symbol)
    .sort((a, b) => b.accumulationQuantity - a.accumulationQuantity).slice(0, 3);
  const sellers = dist.content.filter((r) => r.symbol === symbol)
    .sort((a, b) => a.accumulationQuantity - b.accumulationQuantity).slice(0, 2).reverse();
  return [...buyers, ...sellers].map((r) => [r.brokerId, Math.round(r.accumulationQuantity)]);
}

async function build() {
  const [featured, detail, financials, ...rest] = await Promise.all([
    history(FEATURED, 6),
    get(`/api/stocks/${FEATURED}/detail`),
    get(`/api/stocks/${FEATURED}/financials`),
    ...STOCKS.map((s) => history(s, 2)),
  ]);
  const prices = { [FEATURED]: featured, NEPSE: await nepseCandles() };
  STOCKS.forEach((s, i) => { prices[s] = rest[i]; });

  const dividend = (detail.recentDividends || [])[0];
  const [d, w, m] = await Promise.all(['1D', '1W', '1M'].map((dur) => brokerNet(FEATURED, dur)));

  const acc = await get('/api/broker-analysis/accumulation?duration=1W&size=40');
  const seen = new Set();
  const accumulation = acc.content
    .filter((r) => !seen.has(r.symbol) && seen.add(r.symbol))
    .slice(0, 5)
    .map((r) => [r.symbol, r.brokerId, round(r.accumulationAmount / 1e7), round(r.accumulationPercentage)]);

  const bulkData = await get('/api/bulk-transactions?size=60');
  const bulk = bulkData.content
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7)
    .map((r) => [r.symbol, r.quantity, r.amount, r.buyerMemberId, r.sellerMemberId]);

  const floor = await get(`/api/floor-sheet?symbol=${FEATURED}&size=8`);
  const floorsheet = floor.content.map((r) => [r.buyerMemberId, r.sellerMemberId, r.quantity, r.rate]);

  return {
    asOf: detail.asOfDate,
    prices,
    featured: {
      symbol: FEATURED,
      name: detail.general.companyName,
      ltp: detail.today.ltp,
      pe: round(detail.performance.peRatio),
      bookValue: detail.performance.bookValue,
      high52: detail.general.fiftyTwoWeekHigh,
      low52: detail.general.fiftyTwoWeekLow,
      dividendPct: dividend ? dividend.totalDividendPct : null,
      years: fiscalYears(financials.entries),
    },
    brokers: { d, w, m },
    accumulation,
    bulk,
    bulkDate: bulkData.date,
    floorsheet,
  };
}

function usable(data) {
  return data.prices[FEATURED].c.length > 50 && data.featured.years.length >= 3 &&
    data.brokers.w.length >= 3 && data.accumulation.length >= 3 && data.bulk.length >= 3 && data.floorsheet.length >= 3;
}

module.exports = async function refreshMarketData() {
  try {
    const data = await build();
    if (!usable(data)) throw new Error('API returned too little data');
    fs.writeFileSync(OUT, JSON.stringify(data));
    console.log(`  Market data refreshed (as of ${data.asOf})`);
  } catch (err) {
    console.log(`  Market data not refreshed, keeping the committed file: ${err.message}`);
  }
};

if (require.main === module) module.exports();
