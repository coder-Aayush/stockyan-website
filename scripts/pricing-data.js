// Refreshes data/pricing.json from the same Firestore collections the app's
// subscription page reads (`tiers` and `subscription`, both public). Feature
// names come from data/feature-names.json, copied from the app's services
// list. Keeps the committed file if Firestore can't be reached.

const fs = require('fs');
const path = require('path');

const DB = 'https://firestore.googleapis.com/v1/projects/evernep/databases/(default)/documents';
const OUT = path.join(__dirname, '..', 'data', 'pricing.json');
const NAMES = require('../data/feature-names.json');

function value(v) {
  const [type, x] = Object.entries(v)[0];
  if (type === 'mapValue') return fields(x.fields || {});
  if (type === 'arrayValue') return (x.values || []).map(value);
  if (type === 'integerValue') return Number(x);
  if (type === 'nullValue') return null;
  return x;
}
const fields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, value(v)]));

async function list(collection) {
  const res = await fetch(`${DB}/${collection}?pageSize=100`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${collection} → ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map((d) => ({ id: d.name.split('/').pop(), ...fields(d.fields) }));
}

async function build() {
  const [tiers, plans] = await Promise.all([list('tiers'), list('subscription')]);
  const paid = tiers.filter((t) => t.isActive && !t.isFree).sort((a, b) => a.order - b.order);
  let below = [];
  return paid.map((t) => {
    const own = (t.featureKeys || []).filter((k) => !below.includes(k));
    const features = own.filter((k) => NAMES[k]).map((k) => NAMES[k]);
    // Individual strategy keys (strategy_support_bounce, ...) have no display name in the app.
    const strategies = own.some((k) => (k.startsWith('strategy_') && !['strategy_builder', 'strategy_lab'].includes(k)) || k === 'strategies');
    const tier = {
      key: t.key, id: t.id, name: t.name, tagline: t.tagline, color: t.colorHex,
      featureCount: (t.featureKeys || []).length,
      includesPrevious: below.length > 0,
      features: strategies ? [...features, 'Ready-to-trade strategies'] : features,
      plans: plans.filter((p) => p.isActive && p.tierId === t.id).sort((a, b) => a.order - b.order)
        .map((p) => ({ id: p.id, name: p.name, months: p.duration, price: p.price, perMonth: p.perMonth || Math.round(p.price / p.duration) })),
    };
    below = below.concat(t.featureKeys || []);
    return tier;
  }).filter((t) => t.plans.length);
}

module.exports = async function refreshPricing() {
  try {
    const data = await build();
    if (!data.length) throw new Error('no active paid plans');
    fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), tiers: data }, null, 2));
    console.log(`  Pricing refreshed (${data.map((t) => `${t.name} ${t.plans.map((p) => 'Rs ' + p.price).join('/')}`).join(', ')})`);
  } catch (err) {
    console.log(`  Pricing not refreshed, keeping the committed file: ${err.message}`);
  }
};

if (require.main === module) module.exports();
