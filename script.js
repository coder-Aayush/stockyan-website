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
  '.feature-card',
  '.premium-card',
  '.service-group',
  '.tab-item',
  '.paper-trading-inner > *',
  '.download-content',
  '.section-header'
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
      // Offline / manifest missing — leave the static latest.exe links as-is.
    });
})();
