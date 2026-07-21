// ========== Navbar Scroll Effect ==========
const nav = document.getElementById('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  if (currentScroll > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  lastScroll = currentScroll;
});

// ========== Mobile Menu ==========
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');

navToggle.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
  const icon = navToggle.querySelector('i');
  if (mobileMenu.classList.contains('open')) {
    icon.className = 'fa-solid fa-xmark';
  } else {
    icon.className = 'fa-solid fa-bars';
  }
});

// Close mobile menu on link click
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    navToggle.querySelector('i').className = 'fa-solid fa-bars';
  });
});

// ========== Scroll Animations ==========
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

// Add fade-up class to animatable elements
const animatableSelectors = [
  '.bp-card',
  '.bp-split-copy',
  '.bp-split-visual',
  '.tabs-switcher',
  '.bp-head',
  '.bp-stats-grid > *'
];

document.addEventListener('DOMContentLoaded', () => {
  animatableSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, index) => {
      el.classList.add('fade-up');
      el.style.transitionDelay = `${index * 0.05}s`;
      observer.observe(el);
    });
  });
});

// ========== Stock Detail Tab Switcher ==========
(function () {
  const list = document.querySelector('.tabs-list');
  if (!list) return;

  const rows = Array.from(list.querySelectorAll('.tab-row'));
  const previewImg = document.getElementById('tab-preview-img');

  function activate(row) {
    if (row.classList.contains('is-active')) return;

    rows.forEach((r) => {
      const on = r === row;
      r.classList.toggle('is-active', on);
      r.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    const img = row.getAttribute('data-img');
    if (previewImg && img) {
      previewImg.src = img;
      const title = row.querySelector('.tab-row-title');
      if (title) previewImg.alt = 'StockYan ' + title.textContent + ' screen';
    }

    // On the mobile pill strip, keep the active pill in view
    if (list.scrollWidth > list.clientWidth) {
      row.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  rows.forEach((row, i) => {
    row.addEventListener('click', () => activate(row));
    row.addEventListener('mouseenter', () => activate(row));
    // Keyboard: arrow-key roving focus across the tablist
    row.addEventListener('keydown', (e) => {
      let next;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = rows[(i + 1) % rows.length];
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = rows[(i - 1 + rows.length) % rows.length];
      if (next) {
        e.preventDefault();
        next.focus();
        activate(next);
      }
    });
  });
})();

// ========== Services: collapsible categories ==========
(function () {
  const groups = document.querySelectorAll('.service-group');
  if (!groups.length) return;

  groups.forEach((group) => {
    const btn = group.querySelector('.service-group-title');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const open = group.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
})();

// ========== Smooth Scroll for Anchor Links ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ========== Scroll Spy: highlight the nav link for the visible section ==========
// Uses the same 80px offset as the smooth scroll above, so a link marks itself
// current exactly when its section lands where the click would have parked it.
(function () {
  const links = Array.from(
    document.querySelectorAll('.nav-links a[href^="#"], .mobile-menu a[href^="#"]')
  ).filter(a => a.getAttribute('href').length > 1);
  if (!links.length) return;

  const sections = links
    .map(link => ({ link, section: document.querySelector(link.getAttribute('href')) }))
    .filter(pair => pair.section);
  if (!sections.length) return;

  let current = null;

  const sync = () => {
    const line = window.scrollY + 80 + 1;
    let active = null;

    for (const pair of sections) {
      if (pair.section.offsetTop <= line) active = pair.section;
    }

    // Past the last section (footer/closer), keep the final link lit.
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
      active = sections[sections.length - 1].section;
    }

    if (active === current) return;
    current = active;

    for (const pair of sections) {
      pair.link.classList.toggle('is-current', pair.section === active);
    }
  };

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sync();
        ticking = false;
      });
    },
    { passive: true }
  );
  window.addEventListener('resize', sync);
  sync();
})();

// ========== Windows Download: live version from Firebase ==========
// The desktop CI publishes downloads/version.json on every release, so the
// site shows the current version and a clean versioned download filename
// without ever editing this page. Buttons already work without JS (they point
// at the stable latest.exe); this just enhances them.
(function () {
  const MANIFEST =
    'https://storage.googleapis.com/evernep.appspot.com/downloads/version.json';
  const buttons = document.querySelectorAll('[data-win-download]');
  if (!buttons.length) return;

  fetch(MANIFEST, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      const version = (data.version || '').trim();
      const url = (data.url || '').trim();
      if (!version) return;

      buttons.forEach((btn) => {
        const tag = btn.querySelector('[data-win-version]');
        if (tag) tag.textContent = 'v' + version;
        if (url) btn.setAttribute('href', url);
        btn.setAttribute('download', 'StockYan-Setup-' + version + '.exe');
      });
    })
    .catch(() => {
      // Offline / manifest missing: leave the static latest.exe links as-is.
    });
})();

// Windows "blocked app" info popover.
(function () {
  const toggle = document.querySelector('.win-help-toggle');
  const popover = document.getElementById('win-help-popover');
  if (!toggle || !popover) return;

  const open = () => {
    popover.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    popover.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.hidden ? open() : close();
  });

  document.addEventListener('click', (e) => {
    if (!popover.hidden && !popover.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popover.hidden) {
      close();
      toggle.focus();
    }
  });
})();
