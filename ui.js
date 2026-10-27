// StockYan site behaviour: nav, scroll reveals, screenshot switchers, store
// links and the interactive widgets. Widgets are found by [data-widget] and
// read real NEPSE numbers from /data/market.json (refreshed on every build).
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const fmt = (n, d = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const lakh = (n) => Math.round(n).toLocaleString('en-IN');
  const track = (name, params) => { if (window.gtag) window.gtag('event', name, params || {}); };
  const onView = (node, fn, threshold = 0.35) => {
    if (!node) return;
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { io.disconnect(); fn(); } }), { threshold });
    io.observe(node);
  };
  const LOGOS = { NABIL: 1, KBL: 1, GHL: 1, HFIN: 1 };
  const badge = (sym, color) => LOGOS[sym]
    ? `<img class="lg" src="/assets/logos/${sym.toLowerCase()}.png" alt="">`
    : `<span class="lg" style="background:${color}">${sym.slice(0, 2)}</span>`;

  // ---------- nav ----------
  const nav = $('#nav');
  if (nav) addEventListener('scroll', () => nav.classList.toggle('stuck', scrollY > 10), { passive: true });
  const burger = $('#burger'), drawer = $('#drawer');
  if (burger) {
    const setMenu = (open) => {
      drawer.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
      burger.querySelector('use').setAttribute('href', open ? '#m-close' : '#menu');
    };
    burger.addEventListener('click', () => setMenu(drawer.hidden));
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  }

  // ---------- reveal + count up ----------
  $$('.rv').forEach((n) => { if (n.getBoundingClientRect().top > innerHeight) n.classList.add('wait'); });
  const rio = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.remove('wait'); rio.unobserve(en.target); } }), { threshold: 0.12 });
  $$('.rv.wait').forEach((n) => rio.observe(n));
  $$('[data-count]').forEach((b) => onView(b, () => {
    if (reduce) return;
    const to = +b.dataset.count, suf = b.dataset.suffix || '', t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1400); b.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }));
  // Phones: the side screens open out from behind the middle one as you scroll.
  const trio = $('#trio');
  if (trio && !reduce) {
    let ticking = false;
    const spread = () => {
      const sec = $('#phonesPin'), pinned = sec && getComputedStyle(sec.firstElementChild).position === 'sticky';
      let t;
      if (pinned) {
        // While the section is pinned: open over the first 70% of the scroll, then hold.
        const r = sec.getBoundingClientRect(), travel = r.height - innerHeight;
        t = Math.max(0, Math.min(1, -r.top / (travel * 0.7)));
      } else {
        const r = trio.getBoundingClientRect();
        t = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.8)));
      }
      trio.style.setProperty('--p', (1 - Math.pow(1 - t, 3)).toFixed(3));
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spread); } }, { passive: true });
    addEventListener('resize', spread);
    spread();
  }

  // ---------- screenshot switchers ----------
  $$('[data-switch]').forEach((seg) => {
    const target = $(seg.dataset.switch);
    $$('button', seg).forEach((b) => b.addEventListener('click', () => {
      $$('button', seg).forEach((x) => x.classList.toggle('on', x === b));
      $$('.shot', target).forEach((i) => i.classList.toggle('on', i.dataset.k === b.dataset.k));
    }));
  });

  // ---------- hero tilt ----------
  const stage = $('#heroStage');
  if (stage) {
    if (reduce) stage.style.setProperty('--tilt', '0deg');
    else {
      let tick = false;
      const tilt = () => {
        const r = stage.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.9)));
        stage.style.setProperty('--tilt', (14 * (1 - p)).toFixed(2) + 'deg');
        tick = false;
      };
      addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(tilt); } }, { passive: true });
      tilt();
    }
  }

  // ---------- feature tabs ----------
  const tabs = $$('#seg [role=tab]'), knob = $('#knob');
  if (tabs.length) {
    const placeKnob = () => { const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true'); knob.style.left = t.offsetLeft + 'px'; knob.style.width = t.offsetWidth + 'px'; };
    const pick = (t) => {
      tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; $('#' + x.getAttribute('aria-controls')).hidden = !on; });
      placeKnob();
      $$('[data-widget="import"]', $('#' + t.getAttribute('aria-controls'))).forEach((w) => w.dispatchEvent(new Event('shown')));
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(t));
      t.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = tabs[(i + 1) % tabs.length]; pick(n); n.focus(); } });
    });
    placeKnob(); addEventListener('resize', placeKnob);
    // "#portfolio" links open the Portfolio tab.
    const fromHash = () => { if (location.hash === '#portfolio') { const t = tabs.find((x) => x.id === 't-p'); if (t) pick(t); } };
    fromHash(); addEventListener('hashchange', fromHash);
  }

  // ---------- tool catalog tabs ----------
  $$('[data-catalog]').forEach((cat) => {
    const tabs = $$('[role=tab]', cat);
    const pick = (t) => tabs.forEach((x) => {
      const on = x === t, panel = $('#' + x.getAttribute('aria-controls'), cat);
      x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      panel.hidden = !on; panel.classList.toggle('on', on);
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(t));
      t.addEventListener('keydown', (e) => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; pick(n); n.focus();
      });
    });
  });

  // ---------- downloads: one tap, straight to the file or the store ----------
  const FILES = 'https://storage.googleapis.com/evernep.appspot.com/downloads/';
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'windows' : /Mac/.test(ua) ? 'mac' : /Linux/.test(ua) ? 'linux' : '';
  const OS_ICON = { ios: 'fa-apple', mac: 'fa-apple', android: 'fa-android', windows: 'fa-windows', linux: 'fa-linux' };
  // The install source goes to Google Play, so Android installs show where they came from.
  const playUrl = () => {
    const q = new URLSearchParams(location.search), r = new URLSearchParams();
    let host = ''; try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    r.set('utm_source', q.get('utm_source') || (host && !/stockyan\./.test(host) ? host : 'website'));
    r.set('utm_medium', q.get('utm_medium') || 'website');
    if (q.get('utm_campaign')) r.set('utm_campaign', q.get('utm_campaign'));
    if (q.get('ref')) r.set('ref', q.get('ref'));
    return 'https://play.google.com/store/apps/details?id=app.golden.stockyan&referrer=' + encodeURIComponent(r.toString());
  };
  // App Store campaign link: installs show up by source in App Store Connect > Campaigns.
  const appStoreUrl = () => {
    const q = new URLSearchParams(location.search);
    let host = ''; try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    const ct = (q.get('utm_campaign') || q.get('utm_source') || (host && !/stockyan\./.test(host) ? host : 'website')).slice(0, 40);
    return 'https://apps.apple.com/app/apple-store/id6757148688?pt=128639543&ct=' + encodeURIComponent(ct) + '&mt=8';
  };
  const DIRECT = {
    ios: appStoreUrl(),
    android: playUrl(),
    windows: FILES + 'StockYan-Setup-latest.exe',
    linux: FILES + 'StockYan-Linux-latest.tar.gz',
    mac: '',
  };
  const applyLinks = () => {
    // Platform-specific links: hidden when that platform has no published build.
    $$('[data-dl]').forEach((a) => {
      const url = DIRECT[a.dataset.dl];
      if (url) { a.href = url; a.hidden = false; } else if (a.dataset.dl === 'mac') a.hidden = true;
    });
    // "Download" buttons: this device's file or store; the download page when there is none.
    $$('[data-dl-btn]').forEach((b) => { b.href = (os && DIRECT[os]) || '/download/'; });
  };
  if (os) {
    $$('[data-dl-btn]').forEach((b) => b.insertAdjacentHTML('afterbegin', `<i class="fa-brands ${OS_ICON[os]}" aria-hidden="true"></i>`));
    $$(`.os-row [data-os="${os}"]`).forEach((a) => a.classList.add('on'));
    $$(`[data-plat] [data-os="${os}"]`).forEach((a) => { a.classList.replace('btn-ghost', 'btn-dark'); a.parentNode.prepend(a); });
    $$('[data-stores]').forEach((list) => { const mine = $(`[data-os="${os}"]`, list); if (mine) { mine.classList.add('me'); list.prepend(mine); } });
  }
  applyLinks();
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-dl], [data-dl-btn]');
    if (a) track('download_click', { platform: a.dataset.dl || os || 'unknown', place: location.pathname, transport_type: 'beacon' });
  });
  fetch(FILES + 'version.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((v) => {
      DIRECT.windows = v.windowsInstallerUrl || v.url || DIRECT.windows;
      DIRECT.linux = v.linuxUrl || DIRECT.linux;
      DIRECT.mac = v.macUrl || v.macosUrl || '';
      DIRECT.portable = v.windowsPortableUrl || '';
      applyLinks();
      $$('[data-version]').forEach((n) => { n.textContent = v.windowsVersion || v.version || ''; });
      window.dispatchEvent(new CustomEvent('stockyan:downloads', { detail: { ...DIRECT, version: v.windowsVersion || v.version, os } }));
    })
    .catch(() => window.dispatchEvent(new CustomEvent('stockyan:downloads', { detail: { ...DIRECT, os } })));

  // ---------- live data from the app's Firestore (public collections) ----------
  const DB = 'https://firestore.googleapis.com/v1/projects/evernep/databases/(default)/documents';
  const fsValue = (v) => {
    const [type, x] = Object.entries(v)[0];
    if (type === 'mapValue') return fsFields(x.fields || {});
    if (type === 'arrayValue') return (x.values || []).map(fsValue);
    if (type === 'integerValue') return Number(x);
    if (type === 'nullValue') return null;
    return x;
  };
  const fsFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fsValue(v)]));
  const fsList = (path) => fetch(`${DB}/${path}?pageSize=100`).then((r) => r.json())
    .then((d) => (d.documents || []).map((doc) => ({ id: doc.name.split('/').pop(), ...fsFields(doc.fields || {}) })));

  // Prices: the page ships with the prices from the last build; refresh them live.
  if ($('[data-pricing]')) {
    Promise.all([fsList('tiers'), fsList('subscription')]).then(([tiers, plans]) => {
      $$('[data-pricing] [data-tier]').forEach((card) => {
        const tier = tiers.find((t) => t.key === card.dataset.tier);
        const plan = tier && plans.filter((p) => p.isActive && p.tierId === tier.id).sort((a, b) => a.order - b.order)[0];
        if (!plan) return;
        const per = plan.duration === 12 ? 'year' : plan.duration === 1 ? 'month' : `${plan.duration} months`;
        $('[data-f="price"]', card).textContent = 'Rs ' + lakh(plan.price);
        $('[data-f="period"]', card).textContent = 'per ' + per;
        $('[data-f="pm"]', card).textContent = 'Rs ' + lakh(plan.perMonth || plan.price / plan.duration) + ' a month';
      });
    }).catch(() => {});
  }

  // Offer: the same promo banner the app pops up. Shown to visitors when one is
  // live (active, not expired, for everyone or free users). ?offer=preview shows
  // the latest banner even after it ends, for checking the design.
  (function offer() {
    const preview = new URLSearchParams(location.search).get('offer') === 'preview';
    fsList('app_config/promo_banners/items').then((items) => {
      const now = Date.now();
      const live = items
        .filter((b) => b.imageUrl && (preview || (b.isActive && b.expiresAt && Date.parse(b.expiresAt) > now && b.audience !== 'paid')))
        .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
      const b = live[0];
      if (!b) return;
      const code = (b.promoCode || '').toUpperCase();
      const title = (b.title || '').replace(/\s*\([^)]*\)/g, '').replace(/,.*$/, '').trim() || 'Limited-time offer';
      const q = new URLSearchParams({ utm_source: 'website', utm_medium: 'offer', utm_campaign: code || 'offer' });
      if (code) q.set('promo', code);
      if (b.tierKey) q.set('tier', b.tierKey);
      const claim = `https://stockyan.com/open/premium?${q}`;
      const bar = $('.bar a');
      if (bar) {
        bar.href = claim;
        bar.innerHTML = `<span class="pill">OFFER</span><b></b><span class="go">Claim →</span>`;
        bar.querySelector('b').textContent = title + (code ? ` · code ${code}` : '');
        bar.addEventListener('click', () => track('offer_claim', { code, place: 'bar' }));
      }
      const key = 'stockyan.offer.' + b.id;
      let last = 0;
      try { last = Number(localStorage.getItem(key)) || 0; } catch (e) {}
      const freq = b.frequency || 'once';
      const due = preview || !last || freq === 'everyLaunch' || (freq === 'daily' && now - last > 864e5);
      if (!due) return;
      setTimeout(() => {
        const box = document.createElement('div');
        box.className = 'offer';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', title);
        box.innerHTML = `<div class="offer-card">
          <button class="offer-x" type="button" aria-label="Close">×</button>
          <img alt="">
          <div class="offer-foot">
            ${code ? `<button class="offer-code" type="button" aria-label="Copy code ${code}"><span>Use code</span><b>${code}</b><small>Copy</small></button>` : ''}
            <a class="btn btn-dark btn-lg" href="${claim}"></a>
          </div></div>`;
        box.querySelector('img').src = b.imageUrl;
        box.querySelector('img').alt = title;
        box.querySelector('.offer-foot a').textContent = b.ctaLabel || 'Claim offer';
        const close = () => { box.classList.remove('on'); setTimeout(() => box.remove(), 300); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.offer-x')) close(); });
        document.addEventListener('keydown', onKey);
        box.querySelector('.offer-foot a').addEventListener('click', () => track('offer_claim', { code, place: 'popup' }));
        const copy = box.querySelector('.offer-code');
        if (copy) copy.addEventListener('click', () => {
          const done = () => { copy.querySelector('small').textContent = 'Copied'; };
          if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {}); else done();
        });
        document.body.append(box);
        requestAnimationFrame(() => box.classList.add('on'));
        box.querySelector('.offer-x').focus();
        try { localStorage.setItem(key, String(now)); } catch (e) {}
        track('offer_view', { code });
      }, preview ? 300 : 1800);
    }).catch(() => {});
  })();

  // Download rows: pointing at a platform shows that platform's screen.
  $$('[data-devices]').forEach((stage) => {
    const list = $(stage.dataset.devices);
    const show = (k) => $$('.dev', stage).forEach((d) => d.classList.toggle('on', d.dataset.dev === k));
    // No Linux screenshot yet, so Linux keeps whatever is showing.
    const devOf = (o) => ({ ios: 'phone', android: 'phone', windows: 'pc', mac: 'mac' })[o];
    const home = devOf(os) || 'phone';
    show(home);
    if (!list) return;
    $$('[data-os]', list).forEach((a) => {
      const go = () => { const d = devOf(a.dataset.os); if (d) show(d); };
      a.addEventListener('mouseenter', go);
      a.addEventListener('focus', go);
    });
    list.addEventListener('mouseleave', () => show(home));
  });

  // ---------- widgets ----------
  const widgets = $$('[data-widget]');
  const simple = { automation, donut, ipo };
  widgets.filter((w) => simple[w.dataset.widget]).forEach((w) => simple[w.dataset.widget](w));
  const needsData = widgets.some((w) => !simple[w.dataset.widget]) || $('.close-canvas') || $('.hero-candles');
  if (needsData) {
    fetch('/data/market.json').then((r) => r.json()).then((M) => {
      const fns = { fundamentals, levels, brokers, ai, import: importer, finder, accumulation, bulk, floorsheet };
      widgets.forEach((w) => { const fn = fns[w.dataset.widget]; if (fn) fn(w, M); });
      $$('.close-canvas').forEach((c) => closeLine(c, M));
      $$('.hero-candles').forEach((c) => heroCandles(c, M));
    }).catch(() => {});
  }

  function fundamentals(w, M) {
    const F = M.featured, f = (k) => $(`[data-f="${k}"]`, w);
    f('symbol').textContent = F.symbol;
    f('name').textContent = F.name.replace(/ Limited$/, '') + ' · Rs ' + fmt(F.ltp, 0);
    f('pe').textContent = F.pe.toFixed(1);
    f('dividend').textContent = F.dividendPct != null ? F.dividendPct + '%' : '-';
    f('low').textContent = lakh(F.low52); f('high').textContent = lakh(F.high52);
    f('pos').style.left = Math.round((F.ltp - F.low52) / (F.high52 - F.low52) * 100) + '%';
    const bars = f('bars');
    bars.innerHTML = F.years.map((y) => `<div><em></em><i></i><small>FY ${y.fy}</small></div>`).join('');
    const cols = $$(':scope > div', bars);
    cols.forEach((d) => { d.querySelector('em').style.bottom = '22px'; });
    const label = { profitCr: (v) => 'Rs ' + v + ' Cr', eps: (v) => v.toFixed(2), bookValue: (v) => 'Rs ' + Math.round(v) };
    const show = (k) => {
      const vals = F.years.map((y) => y[k]), max = Math.max(...vals);
      cols.forEach((d, i) => {
        const h = 18 + vals[i] / max * 66;
        d.querySelector('i').style.height = h + '%';
        const em = d.querySelector('em'); em.textContent = label[k](vals[i]); em.style.bottom = `calc(${h}% + 4px)`;
      });
      $$('button', f('seg')).forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    };
    $$('button', f('seg')).forEach((b) => b.addEventListener('click', () => show(b.dataset.k)));
    onView(bars, () => show('profitCr'));
  }

  function levels(w, M) {
    const S = M.prices[M.featured.symbol], n = Math.min(125, S.c.length);
    const o = S.o.slice(-n), h = S.h.slice(-n), l = S.l.slice(-n), c = S.c.slice(-n);
    const W = 560, H = 280, pad = 14, min = Math.min(...l) - 4, max = Math.max(...h) + 4;
    const y = (v) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2), bw = W / n;
    const svg = $('svg', w);
    for (let k = 0; k < 5; k++) svg.append(el('line', { x1: 0, x2: W, y1: pad + k * (H - pad * 2) / 4, y2: pad + k * (H - pad * 2) / 4, stroke: '#E6ECE8', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    c.forEach((cl, i) => {
      const col = cl >= o[i] ? '#009E72' : '#E5484D', x = i * bw + bw / 2;
      svg.append(el('line', { x1: x, x2: x, y1: y(h[i]), y2: y(l[i]), stroke: col, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
      svg.append(el('rect', { x: x - bw * 0.32, width: bw * 0.64, y: y(Math.max(o[i], cl)), height: Math.max(1, Math.abs(y(o[i]) - y(cl))), fill: col, rx: 0.6 }));
    });
    // Support: the 4th-lowest low of the last 90 sessions (ignores one-off spikes).
    const recentLows = l.slice(-90).slice().sort((a, b) => a - b);
    const sup = Math.round(recentLows[Math.min(3, recentLows.length - 1)]);
    const res = Math.round(Math.max(...h.slice(-90)));
    const mx = (n - 1) / 2, my = c.reduce((a, b) => a + b) / n;
    let num = 0, den = 0; c.forEach((v, i) => { num += (i - mx) * (v - my); den += (i - mx) ** 2; });
    const slope = num / den, t0 = my - slope * mx;
    const line = (key, y1, y2, x2, col, label) => {
      const g = el('g', { class: 'lvl', 'data-l': key });
      g.append(el('line', { x1: 0, y1, x2, y2, stroke: col, 'stroke-width': 2, 'stroke-dasharray': key === 'trend' ? '0' : '6 5', 'vector-effect': 'non-scaling-stroke' }));
      if (label) {
        g.append(el('rect', { x: W - 66, y: y2 - 11, width: 66, height: 22, rx: 6, fill: col }));
        const tx = el('text', { x: W - 33, y: y2 + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 12, 'font-weight': 600, 'font-family': 'Geist, sans-serif' });
        tx.textContent = label; g.append(tx);
      }
      svg.append(g);
    };
    line('res', y(res), y(res), W, '#E5484D', 'Rs ' + res);
    line('sup', y(sup), y(sup), W, '#009E72', 'Rs ' + sup);
    line('trend', y(t0), y(t0 + slope * (n - 1) * (W - 70) / W), W - 70, '#2F6FEB', '');
    $$('.tg', w).forEach((b) => b.addEventListener('click', () => {
      b.classList.toggle('on');
      $$(`.lvl[data-l="${b.dataset.l}"]`, svg).forEach((x) => x.classList.toggle('off', !b.classList.contains('on')));
    }));
  }

  function brokers(w, M) {
    const rowsBox = $('[data-f="rows"]', w), seg = $('[data-f="seg"]', w), verdict = $('[data-f="verdict"]', w);
    rowsBox.innerHTML = M.brokers.w.map(() => "<div><span class='who'></span><span class='neg'><i style='width:0'></i></span><span class='pos'><i style='width:0'></i></span><span class='val n'></span></div>").join('');
    const show = (k) => {
      const rows = M.brokers[k], max = Math.max(...rows.map((r) => Math.abs(r[1]))), net = rows.reduce((a, r) => a + r[1], 0);
      $$(':scope > div', rowsBox).forEach((d, i) => {
        const r = rows[i];
        d.hidden = !r; if (!r) return;
        const [who, v] = r;
        d.querySelector('.who').textContent = 'Broker ' + who;
        d.querySelector('.neg i').style.width = (v < 0 ? -v / max * 100 : 0) + '%';
        d.querySelector('.pos i').style.width = (v > 0 ? v / max * 100 : 0) + '%';
        const val = d.querySelector('.val'); val.textContent = (v > 0 ? '+' : '−') + lakh(Math.abs(v)); val.className = 'val n ' + (v > 0 ? 'up' : 'dn');
      });
      verdict.classList.toggle('sell', net < 0);
      verdict.querySelector('span').textContent = net >= 0 ? 'Top brokers are buying more than selling' : 'Top brokers are selling more than buying';
      $$('button', seg).forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    };
    $$('button', seg).forEach((b) => b.addEventListener('click', () => show(b.dataset.k)));
    onView(rowsBox, () => show('w'));
  }

  function ai(w, M) {
    const box = $('[data-f="lines"]', w), sumEl = $('[data-f="sum"]', w);
    let timers = [];
    const show = (sym) => {
      const c = M.prices[sym].c, last = c[c.length - 1], win = c.slice(-100), lo = Math.min(...win), hi = Math.max(...win);
      const pos = Math.round((last - lo) / (hi - lo) * 100), m20 = (last / c[c.length - 21] - 1) * 100;
      const avg50 = c.slice(-50).reduce((a, b) => a + b) / 50, up = m20 >= 0;
      const lines = [
        ['₨', '#E3F5ED', '#006B4E', `Price Rs ${fmt(last)}, ${pos}% of the way from its 5-month low to high.`],
        [up ? '↑' : '↓', up ? '#E3F5ED' : '#FDECEC', up ? '#006B4E' : '#E5484D', `${up ? 'Up' : 'Down'} ${Math.abs(m20).toFixed(1)}% over the last month.`],
        ['~', '#EEF2FF', '#2F6FEB', `Trading ${last >= avg50 ? 'above' : 'below'} its 50-day average of Rs ${fmt(avg50)}.`],
      ];
      const sum = last >= avg50 && up ? 'In short: steady strength, near the top of its range.' : last < avg50 && !up ? 'In short: under pressure lately.' : 'In short: mixed signals. Worth a closer look.';
      timers.forEach(clearTimeout); timers = [];
      box.innerHTML = lines.map(([ic, bg, fg, t]) => `<div class="ai-line"><i style="background:${bg};color:${fg}">${ic}</i><span>${t}</span></div>`).join('');
      sumEl.classList.remove('show'); sumEl.textContent = sum;
      $$('.ai-line', box).forEach((n, i) => timers.push(setTimeout(() => n.classList.add('show'), 250 + i * 450)));
      timers.push(setTimeout(() => sumEl.classList.add('show'), 250 + lines.length * 450));
      $$('[data-f="chips"] button', w).forEach((b) => b.classList.toggle('on', b.dataset.s === sym));
    };
    $$('[data-f="chips"] button', w).forEach((b) => b.addEventListener('click', () => show(b.dataset.s)));
    onView(w, () => show('NABIL'));
  }

  function importer(w) {
    const connect = (btn) => {
      if (btn.classList.contains('done') || btn.classList.contains('busy')) return;
      btn.classList.add('busy'); btn.innerHTML = "<svg><use href='#sync'/></svg>Syncing";
      setTimeout(() => {
        btn.classList.remove('busy'); btn.classList.add('done'); btn.innerHTML = "<svg><use href='#tick'/></svg>Synced";
        const msg = { ms: '4 stocks imported', tms: 'Trades imported' }[btn.dataset.src];
        const s = $(`[data-s="${btn.dataset.src}"]`, w); if (s && msg) s.textContent = msg;
        $('[data-f="prog"]', w).style.width = Math.min(100, $$('.cbtn.done', w).length / 2 * 100) + '%';
      }, 1300);
    };
    $$('.cbtn', w).forEach((b) => b.addEventListener('click', () => connect(b)));
    let started = false;
    const start = () => { if (started || !w.offsetParent) return; started = true; setTimeout(() => connect($('[data-src="ms"]', w)), 500); };
    w.addEventListener('shown', start);
    onView(w, start);
  }

  function donut(w) {
    // The four holdings on the portfolio screen shown on this page.
    const HOLD = [['JBLB', 128300, '+7.92%', '#009E72'], ['TAMOR', 120000, '+91.06%', '#2F6FEB'], ['BHDC', 42700, '+298.18%', '#7A5AF8'], ['NICSF', 1756, '−91.3%', '#F59E0B']];
    const svg = $('svg', w), R = 80, C = 2 * Math.PI * R, total = HOLD.reduce((a, h) => a + h[1], 0);
    let off = 0;
    HOLD.forEach(([n, v, , col]) => {
      const len = Math.max(v / total * C, 6);
      svg.append(el('circle', { cx: 100, cy: 100, r: R, stroke: col, 'stroke-dasharray': `${len - 3} ${C - len + 3}`, 'stroke-dashoffset': -off, 'data-n': n }));
      off += len;
    });
    const legend = $('[data-f="legend"]', w), v = $('[data-f="v"]', w), l = $('[data-f="l"]', w);
    legend.innerHTML = HOLD.map(([n, val, , col]) => `<button type="button" data-n="${n}"><i style="background:${col}"></i><span>${n}</span><b class="n">Rs ${lakh(val)}</b></button>`).join('');
    const hi = (n) => {
      $$('circle', svg).forEach((c) => { c.classList.toggle('hi', c.dataset.n === n); c.classList.toggle('dim', !!n && c.dataset.n !== n); });
      $$('button', legend).forEach((b) => b.classList.toggle('on', b.dataset.n === n));
      const h = HOLD.find((x) => x[0] === n);
      v.textContent = h ? h[2] : '+36.4%'; v.className = 'n ' + (h && h[2].startsWith('−') ? 'dn' : '');
      l.textContent = h ? n + ' return' : 'Total profit';
    };
    [...$$('circle', svg), ...$$('button', legend)].forEach((x) => {
      x.addEventListener('mouseenter', () => hi(x.dataset.n)); x.addEventListener('click', () => hi(x.dataset.n)); x.addEventListener('mouseleave', () => hi(null));
    });
  }

  function automation(w) {
    $$('.sw', w).forEach((s) => s.addEventListener('click', () => s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true'))));
  }

  function finder(w, M) {
    const NAMES = { NABIL: ['Nabil Bank', '#1E4FA0'], KBL: ['Kumari Bank', '#7A1F5C'], GHL: ['Ghalemdi Hydro', '#0E7C5A'], HFIN: ['Hotel Forest Inn', '#7A5AF8'], NICA: ['NIC Asia Bank', '#C2410C'], NTC: ['Nepal Telecom', '#B91C1C'], HIDCL: ['Hydroelectricity Inv.', '#0E7C5A'], UPPER: ['Upper Tamakoshi', '#2F6FEB'] };
    const near = Object.keys(NAMES).filter((s) => M.prices[s]).map((s) => {
      const c = M.prices[s].c.slice(-100), last = c[c.length - 1], lo = Math.min(...c);
      return [s, last, (last / lo - 1) * 100];
    }).sort((a, b) => a[2] - b[2]).slice(0, 5);
    $('[data-f="count"]', w).textContent = `${near.length} stocks close to their 5-month low`;
    $('[data-f="matches"]', w).innerHTML = near.map(([s, p, d], i) => `<div style="transition-delay:${0.15 + i * 0.12}s">${badge(s, NAMES[s][1])}<span><b>${s}</b><small>${NAMES[s][0]}</small></span><span class="r"><b class="n">${fmt(p)}</b><span class="fx-tag">${d.toFixed(1)}% above low</span></span></div>`).join('');

    // The phone screen is drawn at 340 x 740 and scaled to the frame.
    const screen = $('.fx-screen', w), ui = $('.fx-ui', w);
    new ResizeObserver(() => { ui.style.transform = `scale(${screen.clientWidth / 340})`; }).observe(screen);

    const steps = $$('.fx-steps li', w), scenes = $$('.fx-scene', w), syncs = $$('.fx-sync', w), value = $('[data-f="value"]', w);
    let cur = 0, timer, subs = [];
    const syncScene = () => {
      syncs.forEach((s) => { s.classList.remove('done'); s.innerHTML = "<svg><use href='#sync'/></svg>"; });
      syncs.forEach((s, i) => subs.push(setTimeout(() => { s.classList.add('done'); s.innerHTML = "<svg><use href='#tick'/></svg>"; }, 700 + i * 600)));
      const to = 292756, t0 = performance.now();
      const tick = (t) => { const k = Math.min(1, (t - t0) / 1600); value.textContent = 'Rs ' + lakh(to * (1 - Math.pow(1 - k, 3))); if (k < 1 && cur === 2) requestAnimationFrame(tick); };
      if (reduce) value.textContent = 'Rs ' + lakh(to); else requestAnimationFrame(tick);
    };
    const go = (i) => {
      cur = i; subs.forEach(clearTimeout); subs = [];
      steps.forEach((s, k) => {
        s.classList.toggle('on', k === i); s.classList.toggle('done', k < i);
        const bar = s.querySelector('.fx-rail i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
      });
      scenes.forEach((s, k) => s.classList.toggle('on', k === i));
      ui.classList.toggle('lock', i === 3);
      if (i === 2) syncScene();
      clearTimeout(timer); if (!reduce) timer = setTimeout(() => go((cur + 1) % steps.length), 5000);
    };
    steps.forEach((s, i) => s.querySelector('button').addEventListener('click', () => go(i)));
    onView(w, () => go(0), 0.3);
  }

  function accumulation(w, M) {
    const rows = $('[data-f="rows"]', w);
    rows.innerHTML = M.accumulation.map(([s, b, cr, pct]) => `<div><b>${s}<small>Broker ${b} · Rs ${cr.toFixed(2)} Cr</small></b><span class="tr"><i data-w="${pct}"></i></span><span class="pc n">${pct.toFixed(1)}%</span></div>`).join('');
    onView(rows, () => $$('i', rows).forEach((i, k) => setTimeout(() => { i.style.width = i.dataset.w + '%'; }, k * 120)));
  }

  function bulk(w, M) {
    const box = $('[data-f="rows"]', w);
    const money = (a) => a >= 1e7 ? 'Rs ' + (a / 1e7).toFixed(2) + ' Cr' : 'Rs ' + (a / 1e5).toFixed(1) + ' L';
    let i = 0;
    const add = () => {
      const [s, q, a, b, sl] = M.bulk[i++ % M.bulk.length];
      const d = document.createElement('div');
      d.innerHTML = `<b>${s}</b><span class="amt n">${money(a)}</span><small>${lakh(q)} shares</small><small style="text-align:right">Broker ${b} → ${sl}</small>`;
      box.prepend(d); while (box.children.length > 3) box.lastChild.remove();
    };
    add(); add(); add();
    onView(box, () => { if (!reduce) setInterval(add, 2800); });
  }

  function floorsheet(w, M) {
    const box = $('[data-f="rows"]', w);
    box.innerHTML = `<div class="h"><span>Buyer</span><span>Seller</span><span>Shares</span><span>Rate</span></div>`;
    let i = 0;
    const add = () => {
      const [b, s, q, r] = M.floorsheet[i++ % M.floorsheet.length];
      const d = document.createElement('div');
      d.innerHTML = `<span>Broker ${b}</span><span>Broker ${s}</span><span class="n">${lakh(q)}</span><span class="n">${fmt(r)}</span>`;
      box.children[0].after(d); while (box.children.length > 6) box.lastChild.remove();
    };
    for (let k = 0; k < 5; k++) add();
    onView(box, () => { if (!reduce) setInterval(add, 2200); });
  }

  function ipo(w) {
    onView(w, () => $$('.res', w).forEach((r, i) => setTimeout(() => {
      const yes = r.dataset.r === 'yes';
      r.classList.add(yes ? 'yes' : 'no'); r.textContent = yes ? '10 units' : 'Not allotted';
    }, 600 + i * 550)));
  }

  // Data check rows tick over one by one
  onView($('#checks'), () => $$('#checks .ok').forEach((o, i) => setTimeout(() => { o.classList.add('done'); o.lastChild.textContent = 'Up to date'; }, 400 + i * 450)));

  // NEPSE daily candles behind the hero headline, drawn in from the left.
  function heroCandles(cv, M) {
    const S = M.prices.NEPSE;
    if (!S || !S.c.length) return;
    const draw = (progress) => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      if (!r.width) return;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const x = cv.getContext('2d'); x.scale(dpr, dpr);
      const n = Math.min(S.c.length, Math.max(40, Math.round(r.width / 11)));
      const o = S.o.slice(-n), h = S.h.slice(-n), l = S.l.slice(-n), c = S.c.slice(-n);
      const lo = Math.min(...l), hi = Math.max(...h), pad = r.height * 0.1;
      const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (r.height - pad * 2);
      const step = r.width / n, bw = Math.max(3, step * 0.56);
      const upto = Math.max(1, Math.floor(n * progress));
      for (let i = 0; i < upto; i++) {
        const up = c[i] >= o[i], cx = i * step + step / 2;
        x.strokeStyle = x.fillStyle = up ? 'rgba(0, 158, 114, .55)' : 'rgba(229, 72, 77, .5)';
        x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx, y(h[i])); x.lineTo(cx, y(l[i])); x.stroke();
        const top = y(Math.max(o[i], c[i])), body = Math.max(1.5, Math.abs(y(o[i]) - y(c[i])));
        x.fillRect(cx - bw / 2, top, bw, body);
      }
    };
    if (reduce) { draw(1); } else {
      const t0 = performance.now();
      const f = (t) => { const k = Math.min(1, (t - t0) / 1800); draw(1 - Math.pow(1 - k, 2)); if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => draw(1), 150); });
  }

  function closeLine(cv, M) {
    const vals = M.prices[M.featured.symbol].c.slice(-200), mn = Math.min(...vals), mx = Math.max(...vals);
    const draw = (progress) => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const x = cv.getContext('2d'); x.scale(dpr, dpr);
      const upto = Math.max(2, Math.floor(vals.length * progress));
      const grad = x.createLinearGradient(0, 0, 0, r.height); grad.addColorStop(0, 'rgba(0,158,114,.25)'); grad.addColorStop(1, 'rgba(0,158,114,0)');
      x.beginPath();
      for (let i = 0; i < upto; i++) { const px = i / (vals.length - 1) * r.width, py = r.height * 0.15 + (1 - (vals[i] - mn) / (mx - mn)) * r.height * 0.8; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.strokeStyle = '#009E72'; x.lineWidth = 2; x.stroke();
      x.lineTo((upto - 1) / (vals.length - 1) * r.width, r.height); x.lineTo(0, r.height); x.fillStyle = grad; x.fill();
    };
    draw(1);
    onView(cv, () => { if (reduce) return; const t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / 2200); draw(1 - Math.pow(1 - k, 3)); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }, 0.2);
    addEventListener('resize', () => draw(1));
  }
})();
