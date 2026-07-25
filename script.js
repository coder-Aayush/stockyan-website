// ========== Navbar Scroll Effect ==========
// The listener is passive (never blocks scrolling) and the class toggle is
// batched into a rAF, so scrolling stays on the compositor and we touch the
// DOM at most once per frame instead of once per scroll event.
const nav = document.getElementById('nav');

(function () {
  let ticking = false;
  let scrolled = false;

  const update = () => {
    ticking = false;
    const next = window.scrollY > 50;
    if (next === scrolled) return;
    scrolled = next;
    nav.classList.toggle('scrolled', next);
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );

  update();
})();

// ========== Mobile Menu ==========
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');

const setMenu = (open) => {
  mobileMenu.classList.toggle('open', open);
  navToggle.querySelector('i').className = open
    ? 'fa-solid fa-xmark'
    : 'fa-solid fa-bars';
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  // stop the page behind the overlay from scrolling
  document.body.style.overflow = open ? 'hidden' : '';
};

navToggle.addEventListener('click', () => {
  setMenu(!mobileMenu.classList.contains('open'));
});

// Close mobile menu on link click
mobileMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mobileMenu.classList.contains('open')) setMenu(false);
});

// ========== Scroll Animations ==========
// Reveal-on-scroll. Elements are unobserved once shown (the animation is
// one-shot), and the stagger delay is capped and scoped per selector group so
// a card late in the page doesn't inherit a multi-second delay.
(function () {
  const animatableSelectors = [
    // .feature-card is excluded: the carousel owns its transform, and a
    // reveal transform on the same element would fight the featured scale
    '.premium-card',
    '.service-group',
    '.tabs-switcher',
    '.paper-trading-inner > *',
    '.download-content',
    '.section-header'
  ];

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const init = () => {
    const targets = [];
    animatableSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el, index) => {
        el.classList.add('fade-up');
        // cap the cascade at 6 steps (~0.3s) so nothing lags behind the scroll
        el.style.transitionDelay = `${Math.min(index, 6) * 0.05}s`;
        targets.push(el);
      });
    });

    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          obs.unobserve(entry.target); // one-shot; stop paying for it
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    targets.forEach((el) => observer.observe(el));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ========== Features Carousel ==========
// Auto-advancing infinite carousel. The card in the centre slot is marked
// featured (solid green, larger). Looping is done by cloning the card list on
// both sides and silently jumping back to the middle copy when a wrap is
// reached — with the transition disabled for that one frame, so the jump is
// invisible. Everything moves via a single transform on the track, so the
// carousel never triggers layout while running.
(function () {
  const slider = document.querySelector('.features-slider');
  if (!slider) return;

  const track = slider.querySelector('.features-grid');
  const dotsWrap = slider.querySelector('[data-features-dots]');
  if (!track) return;

  const originals = Array.from(track.children);
  const count = originals.length;
  if (!count) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INTERVAL = 3200;

  // Three copies: [clones][originals][clones]. We live in the middle set, so
  // there is always a full set of cards to slide into on either side.
  originals.forEach((el) => {
    const before = el.cloneNode(true);
    const after = el.cloneNode(true);
    before.setAttribute('aria-hidden', 'true');
    after.setAttribute('aria-hidden', 'true');
    track.insertBefore(before, track.firstChild);
    track.appendChild(after);
  });

  const cards = Array.from(track.children);
  const perView = () => {
    const v = parseInt(getComputedStyle(track).getPropertyValue('--cards'), 10);
    return Number.isFinite(v) && v > 0 ? v : 1;
  };

  let index = count; // start at the first card of the middle (real) set
  let timer = null;

  const step = () => {
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    return cards[0].getBoundingClientRect().width + gap;
  };

  const paint = (animate) => {
    track.style.transition = animate ? '' : 'none';
    track.style.transform = `translate3d(${-index * step()}px, 0, 0)`;

    const centre = index + Math.floor(perView() / 2);
    cards.forEach((c, i) => c.classList.toggle('is-featured', i === centre));

    if (dotsWrap) {
      // which of the real cards is centred, wrapped into the original range
      const active = ((centre % count) + count) % count;
      Array.from(dotsWrap.children).forEach((d, i) => {
        const on = i === active;
        if (on && !d.classList.contains('is-active')) {
          // re-trigger the countdown animation from zero on the new dot
          d.classList.remove('is-active');
          void d.offsetWidth;
        }
        d.classList.toggle('is-active', on);
      });
    }
  };

  const advance = (dir) => {
    index += dir;
    paint(true);
  };

  // After each slide, if we've wandered out of the middle set, jump back by
  // exactly one set width. Same visual position, so nothing is seen.
  track.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return;
    if (index >= count * 2) index -= count;
    else if (index < count) index += count;
    else return;
    paint(false);
    // force a reflow so the next transition starts from the jumped position
    void track.offsetWidth;
  });

  // keep the dot countdown in sync with the real advance interval
  slider.style.setProperty('--interval', INTERVAL + 'ms');

  const start = () => {
    slider.classList.remove('is-paused');
    if (reduced || timer) return;
    timer = setInterval(() => advance(1), INTERVAL);
  };
  const stop = () => {
    slider.classList.add('is-paused');
    clearInterval(timer);
    timer = null;
  };

  // pause while hovered or off-screen
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', start);
  document.addEventListener('visibilitychange', () =>
    document.hidden ? stop() : start()
  );

  const buildDots = () => {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider-dot';
      dot.setAttribute('aria-label', 'Go to feature ' + (i + 1));
      dot.addEventListener('click', () => {
        stop();
        index = count + i - Math.floor(perView() / 2);
        paint(true);
        start();
      });
      dotsWrap.appendChild(dot);
    }
  };

  let raf = null;
  window.addEventListener('resize', () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = null;
      paint(false);
    });
  });

  buildDots();
  paint(false);


  // only run while the section is actually on screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => entries.forEach((en) => (en.isIntersecting ? start() : stop())),
      { threshold: 0.2 }
    ).observe(slider);
  } else {
    start();
  }
})();

// ========== Stock Detail Tab Switcher ==========
(function () {
  const list = document.querySelector('.tabs-list');
  if (!list) return;

  const rows = Array.from(list.querySelectorAll('.tab-row'));
  const previewImg = document.getElementById('tab-preview-img');

  // Preload every preview so switching tabs never shows a blank frame while
  // the new screenshot downloads.
  rows.forEach((r) => {
    const src = r.getAttribute('data-img');
    if (src) new Image().src = src;
  });

  function activate(row, fromPointer) {
    if (row.classList.contains('is-active')) return;

    rows.forEach((r) => {
      const on = r === row;
      r.classList.toggle('is-active', on);
      r.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    const img = row.getAttribute('data-img');
    if (previewImg && img) {
      const title = row.querySelector('.tab-row-title');
      const alt = title ? 'StockYan ' + title.textContent + ' screen' : previewImg.alt;

      // Cross-fade: fade out, swap once the new file is decoded, fade back in.
      // Opacity-only, so the swap stays on the compositor.
      previewImg.classList.add('is-swapping');
      const swap = () => {
        previewImg.src = img;
        previewImg.alt = alt;
        requestAnimationFrame(() => previewImg.classList.remove('is-swapping'));
      };
      const pre = new Image();
      pre.onload = swap;
      pre.onerror = swap;
      pre.src = img;
      if (pre.complete) swap();
    }

    // On the mobile pill strip, keep the active pill in view. Only for real
    // taps/clicks — doing this on hover would drag the page under the cursor.
    if (fromPointer && list.scrollWidth > list.clientWidth) {
      row.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  // Hover-to-switch only on devices with a real pointer; on touch the
  // synthesised mouseenter would fight the tap handler.
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  rows.forEach((row, i) => {
    row.addEventListener('click', () => activate(row, true));
    if (canHover) row.addEventListener('mouseenter', () => activate(row, false));
    // Keyboard: arrow-key roving focus across the tablist
    row.addEventListener('keydown', (e) => {
      let next;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = rows[(i + 1) % rows.length];
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = rows[(i - 1 + rows.length) % rows.length];
      if (next) {
        e.preventDefault();
        next.focus();
        activate(next, true);
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
