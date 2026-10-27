// StockYan shared behaviour: nav, market status, platform-aware download
// buttons and live desktop release links. Loaded on every page.

const STORE = {
  ios: 'https://apps.apple.com/np/app/stockyan-nepal-share-market/id6757148688',
  android: 'https://play.google.com/store/apps/details?id=app.golden.stockyan',
};
const DOWNLOADS = 'https://storage.googleapis.com/evernep.appspot.com/downloads/';
const MANIFEST = DOWNLOADS + 'version.json';

// ========== Nav: border on scroll + mobile menu ==========
(function () {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const toggle = nav.querySelector('.nav-toggle');
  const menu = document.getElementById('mobileMenu');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (!toggle || !menu) return;
  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
})();

// ========== Platform detection ==========
function detectOS() {
  const ua = navigator.userAgent;
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/Mac/i.test(platform) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Win/i.test(platform)) return 'windows';
  if (/Mac/i.test(platform)) return 'mac';
  if (/Linux|X11/i.test(platform)) return 'linux';
  return null;
}

const OS = detectOS();

// Download buttons point at the visitor's platform. On the homepage desktop
// buttons mirror the download table (so manifest updates reach them); other
// pages fall back to the stable "latest" files.
(function () {
  if (!OS) return;

  const config = {
    ios: { label: 'Download for iPhone', icon: 'fa-apple', href: STORE.ios, external: true },
    android: { label: 'Download for Android', icon: 'fa-google-play', href: STORE.android, external: true },
    windows: { label: 'Download for Windows', icon: 'fa-windows', from: '[data-win-download]', href: DOWNLOADS + 'StockYan-Setup-latest.exe', file: true },
    mac: { label: 'Download for Mac', icon: 'fa-apple', from: '[data-mac-download]', href: '/#dl-mac' },
    linux: { label: 'Download for Linux', icon: 'fa-linux', from: '[data-linux-download]', href: DOWNLOADS + 'StockYan-Linux-latest.tar.gz', file: true },
  }[OS];

  document.querySelectorAll('[data-smart-cta]').forEach((cta) => {
    const label = cta.querySelector('[data-smart-label]');
    const icon = cta.querySelector('[data-smart-icon]');
    if (label) label.textContent = config.label;
    if (icon) icon.classList.add(config.icon);

    const source = config.from && document.querySelector(config.from);
    if (source) {
      const sync = () => {
        cta.href = source.getAttribute('href');
        if (source.hasAttribute('download')) cta.setAttribute('download', source.getAttribute('download'));
      };
      sync();
      new MutationObserver(sync).observe(source, { attributes: true, attributeFilter: ['href', 'download'] });
    } else {
      cta.href = config.href;
      if (config.external) {
        cta.target = '_blank';
        cta.rel = 'noopener';
      }
      if (config.file) cta.setAttribute('download', '');
    }
  });

  const row = document.querySelector('.platforms [data-os="' + OS + '"]');
  if (row) row.classList.add('is-you');
})();

// ========== Release manifest: live desktop versions and URLs ==========
(function () {
  if (!document.querySelector('[data-win-download], [data-linux-download], [data-mac-download]')) return;

  fetch(MANIFEST, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      const version = (data.windowsVersion || data.version || '').trim();
      const winUrl = (data.windowsInstallerUrl || data.url || '').trim();

      document.querySelectorAll('[data-win-download]').forEach((btn) => {
        if (winUrl) btn.setAttribute('href', winUrl);
        if (version) btn.setAttribute('download', 'StockYan-Setup-' + version + '.exe');
      });
      document.querySelectorAll('[data-win-version]').forEach((el) => {
        if (version) el.textContent = 'v' + version;
      });
      if (data.windowsPortableUrl) {
        document.querySelectorAll('[data-win-portable]').forEach((a) => a.setAttribute('href', data.windowsPortableUrl));
      }
      if (data.linuxUrl) {
        document.querySelectorAll('[data-linux-download]').forEach((a) => a.setAttribute('href', data.linuxUrl));
      }
      if (data.macUrl) {
        document.querySelectorAll('[data-mac-download]').forEach((a) => {
          a.setAttribute('href', data.macUrl);
          a.setAttribute('download', '');
        });
      }
    })
    .catch(() => {
      // Offline or manifest missing: the static "latest" links still work.
    });
})();

// ========== NEPSE market status + live index (regular session: Mon–Fri, 11:00–15:00 NPT) ==========
(function () {
  const el = document.querySelector('[data-market]');
  if (!el) return;
  const text = el.querySelector('[data-market-text]');
  const FEED = 'https://stockyan.astrixel.com/udf/history?symbol=NEPSE&resolution=1D';
  const OPEN = 11 * 60;
  const CLOSE = 15 * 60;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isTradingDay = (d) => d >= 1 && d <= 5; // Monday to Friday
  const num = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let index = null; // { close, change, pct, date: 'YYYY-MM-DD' }

  function nepalNow() {
    const now = new Date();
    // Nepal is UTC+5:45 year-round.
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 345 * 60000);
  }

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function session() {
    const npt = nepalNow();
    const day = npt.getDay();
    const mins = npt.getHours() * 60 + npt.getMinutes();
    let open = isTradingDay(day) && mins >= OPEN && mins < CLOSE;
    // No bar for today 15 minutes into the session means a public holiday.
    const holiday = open && mins >= OPEN + 15 && index && index.date !== ymd(npt);
    if (holiday) open = false;

    let status;
    if (open) {
      status = 'Live';
    } else if (isTradingDay(day) && mins < OPEN && !holiday) {
      status = 'Opens 11 AM';
    } else {
      let next = (day + 1) % 7;
      while (!isTradingDay(next)) next = (next + 1) % 7;
      status = 'Opens ' + (next === (day + 1) % 7 ? 'tomorrow' : DAYS[next]);
    }
    return { open, status };
  }

  function render() {
    const { open, status } = session();
    el.classList.toggle('is-open', open);
    text.textContent = '';

    if (!index) {
      text.textContent = 'NEPSE ' + (open ? 'open until 3:00 PM' : status.replace('Opens', 'opens'));
    } else {
      const dir = index.change > 0 ? 'up' : index.change < 0 ? 'down' : 'flat';
      const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';
      const label = document.createElement('span');
      label.textContent = 'NEPSE ';
      const value = document.createElement('strong');
      value.className = 'market-value';
      value.textContent = num.format(index.close);
      const chg = document.createElement('span');
      chg.className = 'market-chg is-' + dir;
      chg.textContent = arrow + num.format(Math.abs(index.pct)) + '%';
      const state = document.createElement('span');
      state.className = 'market-state';
      state.textContent = status;
      text.append(label, value, ' ', chg, state);

      const [y, m, d] = index.date.split('-').map(Number);
      el.title = (open ? 'Live, updated every minute' : 'Close on ' + d + ' ' + MONTHS[m - 1] + ' ' + y) +
        ' · ' + (index.change >= 0 ? '+' : '−') + num.format(Math.abs(index.change)) + ' pts' +
        ' · Session Mon–Fri, 11:00 AM–3:00 PM Nepal time';
    }
    if (!index) el.title = 'Regular session Mon–Fri, 11:00 AM–3:00 PM Nepal time.';
    el.hidden = false;
  }

  function load() {
    const to = Math.floor(Date.now() / 1000);
    return fetch(FEED + '&from=' + (to - 14 * 86400) + '&to=' + to)
      .then((r) => r.json())
      .then((bars) => {
        if (bars.s !== 'ok' || !bars.c || bars.c.length < 2) return;
        const n = bars.c.length;
        const close = bars.c[n - 1];
        const prev = bars.c[n - 2];
        index = {
          close,
          change: close - prev,
          pct: ((close - prev) / prev) * 100,
          // Daily bars are stamped at 00:00 UTC of the trading date.
          date: new Date(bars.t[n - 1] * 1000).toISOString().slice(0, 10),
        };
      })
      .catch(() => {
        // Feed unreachable: fall back to the schedule-only status.
      });
  }

  render();
  load().then(render);
  setInterval(() => {
    if (session().open) load().then(render);
    else render();
  }, 60000);
})();

// ========== Footer year ==========
(function () {
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
