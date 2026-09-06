import { projects, categories, stats } from '../data/projects.js';

/* ============================================================
   Constants & Storage Keys
   ============================================================ */
const LIKES_URL = 'https://script.google.com/macros/s/AKfycbyPJaijoApyNZhdEa8oTiMy-dzsmelCkbqQ15ATMCPm8uj4l23y8P7-gIPXnsC3otI8NA/exec';
const LIKE_STORAGE_KEY = 'levtov_liked_projects';
const VISITOR_STORAGE_KEY = 'levtov_visitor_id';
const CONSENT_STORAGE_KEY = 'levtov_consent';
const THEME_KEY = 'theme';
const CAT_LABELS = Object.fromEntries(categories.map((c) => [c.id, c.label]));

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const finePointer = () => window.matchMedia('(pointer: fine)').matches;

/* ============================================================
   Privacy Consent & Tracking Control
   ============================================================ */
function getConsent() {
  return localStorage.getItem(CONSENT_STORAGE_KEY); // 'agreed' | 'declined' | null
}

let TRACKING_ALLOWED = getConsent() !== 'declined';

function disableTracking() {
  TRACKING_ALLOWED = false;
  document.body.classList.add('counts-disabled');
}

function initConsentBanner() {
  const banner = $('#cookie-banner');
  if (!banner) return;
  const consent = getConsent();
  if (consent) {
    banner.remove();
    if (consent === 'declined') disableTracking();
    return;
  }
  banner.classList.add('show');
  $('#cookie-accept')?.addEventListener('click', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'agreed');
    banner.remove();
  });
  $('#cookie-decline')?.addEventListener('click', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, 'declined');
    banner.remove();
    disableTracking();
    try { delete window.levtovCountsCb; } catch (e) {}
  });
}

/* ============================================================
   Likes & Views Server (Google Apps Script + Google Sheets)
   ============================================================ */
let PROJECT_LIKES = {};
let PROJECT_VIEWS = {};
let activeProjectId = null;

function getVisitorId() {
  if (!TRACKING_ALLOWED) return '';
  let v = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (!v) {
    v = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(VISITOR_STORAGE_KEY, v);
  }
  return v;
}

function getLikedMap() {
  try {
    return JSON.parse(localStorage.getItem(LIKE_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function isProjectLiked(id) {
  return !!getLikedMap()[id];
}

function setProjectLiked(id, val) {
  const m = getLikedMap();
  if (val) m[id] = true;
  else delete m[id];
  try {
    localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(m));
  } catch {}
}

/**
 * טעינת ספירות מהשרת (JSONP עוקף CORS עבור Google Apps Script)
 */
function loadCounts() {
  if (!LIKES_URL || !TRACKING_ALLOWED) {
    document.body.classList.add('counts-disabled');
    return;
  }
  const cb = 'levtovCountsCb';
  window[cb] = function (data) {
    PROJECT_LIKES = (data && data.likes) || {};
    PROJECT_VIEWS = (data && data.views) || {};
    updateAllCounters();
    try { delete window[cb]; } catch {}
  };
  const s = document.createElement('script');
  s.src = `${LIKES_URL}?action=counts&callback=${cb}`;
  s.onerror = function () {
    try { delete window[cb]; } catch {}
  };
  document.head.appendChild(s);
}

/**
 * שליחת ביקון GET לשרת Apps Script
 */
function sendBeacon(action, id) {
  if (!LIKES_URL || !TRACKING_ALLOWED) return;
  try {
    new Image().src = `${LIKES_URL}?action=${encodeURIComponent(action)}&id=${encodeURIComponent(id)}&visitor=${encodeURIComponent(getVisitorId())}`;
  } catch {}
}

function toggleLike(id) {
  if (!LIKES_URL || !TRACKING_ALLOWED) return;
  const project = projects.find((p) => p.id === id);
  if (!project) return;

  const currentlyLiked = isProjectLiked(id);
  const nextLiked = !currentlyLiked;
  setProjectLiked(id, nextLiked);

  PROJECT_LIKES[id] = Math.max(0, (PROJECT_LIKES[id] || 0) + (nextLiked ? 1 : -1));
  sendBeacon(nextLiked ? 'like' : 'unlike', id);
  updateAllCounters();

  // אם המגירה פתוחה, נוסיף אפקט פופ
  if (activeProjectId === id) {
    const btn = $('#like-btn');
    if (nextLiked && btn && !prefersReducedMotion()) {
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
      setTimeout(() => btn.classList.remove('pop'), 480);
    }
  }
}

function registerView(id) {
  if (!LIKES_URL || !TRACKING_ALLOWED) return;
  const key = 'levtov_viewed_session';
  let viewed = {};
  try {
    viewed = JSON.parse(sessionStorage.getItem(key)) || {};
  } catch {}
  if (viewed[id]) return;
  viewed[id] = true;
  try {
    sessionStorage.setItem(key, JSON.stringify(viewed));
  } catch {}
  PROJECT_VIEWS[id] = (PROJECT_VIEWS[id] || 0) + 1;
  sendBeacon('view', id);
  updateAllCounters();
}

function updateAllCounters() {
  if (!LIKES_URL) return;

  // עדכון כפתורי לייקים בכרטיסים
  $$('.card-like-btn').forEach((btn) => {
    const id = btn.getAttribute('data-id');
    const num = btn.querySelector('.lk-num');
    const liked = isProjectLiked(id);
    if (num) num.textContent = String(PROJECT_LIKES[id] || 0);
    btn.classList.toggle('liked', liked);
    const icon = btn.querySelector('i');
    if (icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  });

  // עדכון מונה צפיות בכרטיסים
  $$('.vc-num').forEach((el) => {
    const id = el.getAttribute('data-id');
    el.textContent = String(PROJECT_VIEWS[id] || 0);
  });

  // עדכון מגירת הפרויקט אם פתוחה
  if (activeProjectId) {
    updateDrawerStats(activeProjectId);
  }
}

function updateDrawerStats(id) {
  const statsEl = $('#drawer-stats');
  const likeBtn = $('#like-btn');
  const likeCountEl = $('#like-count');
  if (!id) return;

  if (statsEl) {
    if (!LIKES_URL || !TRACKING_ALLOWED) {
      statsEl.hidden = true;
    } else {
      statsEl.hidden = false;
      statsEl.innerHTML = `
        <span><i class="fa-solid fa-heart" aria-hidden="true"></i> <strong>${PROJECT_LIKES[id] || 0}</strong> אהבו</span>
        <span><i class="fa-regular fa-eye" aria-hidden="true"></i> <strong>${PROJECT_VIEWS[id] || 0}</strong> צפיות</span>
      `;
    }
  }

  const liked = isProjectLiked(id);
  if (likeBtn) {
    likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    const icon = likeBtn.querySelector('i');
    if (icon) icon.className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  }
  if (likeCountEl) {
    likeCountEl.textContent = String(PROJECT_LIKES[id] || 0);
  }
}

/* ============================================================
   Work Clock GitHub Releases Auto-Updater
   ============================================================ */
async function initWorkClockLatestRelease() {
  try {
    const CACHE_KEY = 'wc_latest_release_v2';
    let data = null;
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      data = JSON.parse(cached);
    } else {
      const res = await fetch('https://api.github.com/repos/Lev-Good/work-clock-releases/releases/latest');
      if (res.ok) {
        data = await res.json();
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    }

    if (data && data.assets) {
      const p = projects.find((x) => x.id === 'work-clock');
      if (!p) return;
      const exeAsset = data.assets.find((a) => a.name.endsWith('.exe') && !a.name.endsWith('.blockmap'));
      if (exeAsset) {
        const tag = data.tag_name ? data.tag_name.replace(/^v/, '') : '1.0.6';
        if (p.links && p.links[0]) {
          p.links[0].url = exeAsset.browser_download_url;
          p.links[0].text = `הורדה ישירה ל-Windows (v${tag}) <i class="fa-solid fa-download"></i>`;
        }

        // אם המגירה בדיוק מציגה את work-clock, נערוך מיידית את הכפתור ב-DOM
        if (activeProjectId === 'work-clock') {
          const firstLink = $('#drawer-links a');
          if (firstLink) {
            firstLink.href = exeAsset.browser_download_url;
            firstLink.innerHTML = p.links[0].text;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Auto update of work-clock release failed:', e);
  }
}

/* ============================================================
   Theme Switcher
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  applyTheme(theme, false);
  $('#theme-toggle')?.addEventListener('click', () => {
    const next =
      document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next, true);
    localStorage.setItem(THEME_KEY, next);
  });
}

function applyTheme(theme, animate = false) {
  const root = document.documentElement;
  if (animate && !prefersReducedMotion()) {
    root.classList.add('theme-animating');
    window.setTimeout(() => root.classList.remove('theme-animating'), 480);
  }
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  const icon = $('#theme-toggle i');
  if (icon) icon.className = theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f8fafc' : '#030712';
}

/* ============================================================
   Intro Overlay Loader
   ============================================================ */
function initIntro() {
  const overlay = $('#intro-overlay');
  if (!overlay) return;
  const fill = $('#intro-fill');
  const skip = $('#intro-skip');
  const reduce = prefersReducedMotion();
  const seen = sessionStorage.getItem('levtov_intro_seen');

  const exit = () => {
    if (overlay.classList.contains('exit') || overlay.classList.contains('gone')) return;
    overlay.classList.add('exit');
    sessionStorage.setItem('levtov_intro_seen', '1');
    const done = () => {
      overlay.classList.add('gone');
      document.dispatchEvent(new CustomEvent('intro:done'));
      startCountUpStats();
    };
    if (reduce) {
      done();
      return;
    }
    setTimeout(done, 700);
  };

  skip?.addEventListener('click', exit);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.intro-mark')) exit();
  });

  if (seen || reduce) {
    overlay.classList.add('gone');
    document.dispatchEvent(new CustomEvent('intro:done'));
    startCountUpStats();
    return;
  }

  let p = 0;
  const timer = setInterval(() => {
    p += 5;
    if (fill) fill.style.width = `${Math.min(p, 100)}%`;
    if (p >= 100) {
      clearInterval(timer);
      setTimeout(exit, 160);
    }
  }, 26);
}

/* ============================================================
   Scroll Progress Bar
   ============================================================ */
function initScrollProgress() {
  const bar = $('#scroll-progress-bar');
  const wrap = $('#scroll-progress');
  if (!bar || !wrap) return;

  let ticking = false;
  const update = () => {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
    bar.style.width = `${pct}%`;
    wrap.setAttribute('aria-valuenow', String(Math.round(pct)));
    ticking = false;
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
}

/* ============================================================
   Navigation & Mobile Menu
   ============================================================ */
function initNav() {
  const nav = $('#navbar');
  const toggle = $('#menu-toggle');
  const links = $('#nav-links');
  const hero = $('#hero');

  const onScroll = () => {
    const threshold = hero ? Math.max(48, hero.offsetHeight * 0.55) : 80;
    nav?.classList.toggle('scrolled', window.scrollY > threshold);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  toggle?.addEventListener('click', () => {
    const open = links?.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const icon = toggle.querySelector('i');
    if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
  });

  links?.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
      const icon = toggle?.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-bars';
    });
  });
}

/* ============================================================
   Parallax Ambient Glows
   ============================================================ */
function initParallax() {
  if (prefersReducedMotion()) return;
  const glows = $$('.glow[data-parallax]');
  if (!glows.length) return;

  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    glows.forEach((el) => {
      const rate = parseFloat(el.dataset.parallax || '0');
      el.style.transform = `translate3d(0, ${y * rate}px, 0)`;
    });
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(onScroll);
    },
    { passive: true }
  );
}

/* ============================================================
   Scroll Reveals
   ============================================================ */
function initReveal() {
  if (prefersReducedMotion()) {
    $$('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );

  $$('[data-reveal]').forEach((el) => observer.observe(el));
}

/* ============================================================
   Pointer Glow on Hero & Cards
   ============================================================ */
function initPointerPolish() {
  if (prefersReducedMotion() || !finePointer()) return;

  const hero = $('#hero');
  const spotlight = $('#hero-spotlight');
  hero?.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (spotlight) {
      spotlight.style.opacity = '1';
      spotlight.style.transform = `translate3d(${x - 220}px, ${y - 220}px, 0)`;
    }
  });
  hero?.addEventListener('pointerleave', () => {
    if (spotlight) spotlight.style.opacity = '0';
  });
}

/* ============================================================
   Stats Count-Up Animation
   ============================================================ */
let statsStarted = false;
function startCountUpStats() {
  if (statsStarted) return;
  statsStarted = true;

  const targets = $$('.stat-num[data-count]');
  targets.forEach((el) => {
    const end = parseInt(el.dataset.count || '0', 10);
    if (prefersReducedMotion() || !end) {
      el.textContent = String(end);
      return;
    }
    const duration = 1200;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(ease * end));
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = String(end);
    };
    requestAnimationFrame(tick);
  });
}

function initStats() {
  const sec = $('#stats');
  if (!sec) return;
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          startCountUpStats();
          obs.disconnect();
        }
      });
    },
    { threshold: 0.25 }
  );
  obs.observe(sec);
}

/* ============================================================
   Portfolio: Filtering, Search, & Card Rendering
   ============================================================ */
let activeCategory = 'all';
let searchQuery = '';

function renderFilters() {
  const container = $('#filters');
  if (!container) return;
  container.innerHTML = categories
    .map(
      (c) => `
    <button type="button" class="filter-btn ${c.id === activeCategory ? 'active' : ''}" data-cat="${c.id}" role="tab" aria-selected="${c.id === activeCategory}">
      <i class="${c.icon}" aria-hidden="true"></i>
      <span>${c.label}</span>
    </button>`
    )
    .join('');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    $$('.filter-btn', container).forEach((b) => {
      const on = b.dataset.cat === activeCategory;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderCards(true);
  });
}

function filterProjects() {
  const q = searchQuery.trim().toLowerCase();
  return projects.filter((p) => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    if (!matchCat) return false;
    if (!q) return true;
    const haystack = `${p.title} ${p.subtitle} ${p.description} ${CAT_LABELS[p.category] || ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

function renderCards(isUserFilter = false) {
  const root = $('#bento');
  const empty = $('#empty-state');
  if (!root) return;

  const list = filterProjects();
  if (!list.length) {
    root.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const doStagger = isUserFilter && !prefersReducedMotion();

  root.innerHTML = list
    .map(
      (p) => `
    <article class="project-card accent-${p.colorClass || 'bl'} scroll-reveal ${doStagger ? 'is-entering' : ''}" data-id="${p.id}" tabindex="0" role="button" aria-haspopup="dialog">
      <div class="card-head">
        <div class="card-icon" aria-hidden="true"><i class="${p.icon}"></i></div>
        <span class="card-pill">${escapeHtml(CAT_LABELS[p.category] || p.category)}</span>
      </div>
      <h3 class="card-title">${escapeHtml(p.title)}</h3>
      <p class="card-sub">${escapeHtml(p.subtitle)}</p>
      
      <div class="card-meta-bar">
        <div class="card-stats">
          <span class="stat-pill" title="מספר צפיות">
            <i class="fa-regular fa-eye" aria-hidden="true"></i>
            <span class="vc-num" data-id="${p.id}">${PROJECT_VIEWS[p.id] || '–'}</span>
          </span>
          <button type="button" class="card-like-btn ${isProjectLiked(p.id) ? 'liked' : ''}" data-id="${p.id}" title="אהבתי את הפרויקט" aria-label="אהבתי את הפרויקט ${escapeHtml(p.title)}">
            <i class="${isProjectLiked(p.id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}" aria-hidden="true"></i>
            <span class="lk-num">${PROJECT_LIKES[p.id] || '–'}</span>
          </button>
        </div>
        <div class="card-action-link">
          <span>לפרטים</span>
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </div>
      </div>
    </article>`
    )
    .join('');

  if (doStagger) {
    const cards = $$('.project-card.is-entering', root);
    cards.forEach((card, i) => {
      card.style.transitionDelay = `${Math.min(i, 12) * 35}ms`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.classList.add('is-in', 'is-visible');
        });
      });
    });
    window.setTimeout(() => {
      cards.forEach((c) => {
        c.style.transitionDelay = '';
        c.classList.remove('is-entering', 'is-in');
      });
    }, 35 * Math.min(cards.length, 12) + 450);
  }

  observeCardReveals();
  bindCardPointerGlow(root);
}

let cardObserver = null;
function observeCardReveals() {
  if (prefersReducedMotion()) {
    $$('.project-card.scroll-reveal').forEach((c) => c.classList.add('is-visible'));
    return;
  }

  if (cardObserver) cardObserver.disconnect();

  cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          cardObserver.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.08
    }
  );

  $$('.project-card.scroll-reveal:not(.is-visible)').forEach((c) => {
    cardObserver.observe(c);
  });
}

function initScrollVelocity() {
  if (prefersReducedMotion()) return;

  const bento = $('#bento');
  if (!bento) return;

  let lastY = window.scrollY;
  let lastTime = performance.now();
  let currentVelocity = 0;
  let targetVelocity = 0;
  let isRunning = false;

  const render = () => {
    currentVelocity += (targetVelocity - currentVelocity) * 0.16;
    targetVelocity *= 0.8;

    const skew = Math.max(-3.2, Math.min(3.2, currentVelocity * 0.08));
    const scale = 1 - Math.min(0.02, Math.abs(currentVelocity) * 0.0004);

    bento.style.setProperty('--bento-skew', `${skew.toFixed(2)}deg`);
    bento.style.setProperty('--bento-scale', `${scale.toFixed(4)}`);

    if (Math.abs(currentVelocity) > 0.01 || Math.abs(targetVelocity) > 0.01) {
      requestAnimationFrame(render);
    } else {
      currentVelocity = 0;
      targetVelocity = 0;
      bento.style.setProperty('--bento-skew', '0deg');
      bento.style.setProperty('--bento-scale', '1');
      isRunning = false;
    }
  };

  window.addEventListener(
    'scroll',
    () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const deltaY = window.scrollY - lastY;
      lastY = window.scrollY;
      lastTime = now;

      const speed = (deltaY / dt) * 16.6;
      targetVelocity = Math.max(-40, Math.min(40, speed));

      if (!isRunning) {
        isRunning = true;
        requestAnimationFrame(render);
      }
    },
    { passive: true }
  );
}

function bindCardPointerGlow(root) {
  if (prefersReducedMotion() || !finePointer()) return;
  root.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });
  });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initPortfolio() {
  renderFilters();
  renderCards(false);

  $('#bento')?.addEventListener('click', (e) => {
    const likeBtn = e.target.closest('.card-like-btn');
    if (likeBtn) {
      e.stopPropagation();
      e.preventDefault();
      toggleLike(likeBtn.dataset.id);
      return;
    }
    const card = e.target.closest('[data-id]');
    if (card) openDrawer(card.dataset.id);
  });

  $('#bento')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-id]');
    if (!card) return;
    e.preventDefault();
    openDrawer(card.dataset.id);
  });

  const search = $('#project-search');
  let t;
  search?.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      searchQuery = search.value;
      renderCards(true);
    }, 120);
  });
}

/* ============================================================
   Slide Drawer Modal
   ============================================================ */
function openDrawer(id) {
  const p = projects.find((x) => x.id === id);
  if (!p) return;
  activeProjectId = id;

  // רישום צפייה בסשן
  registerView(id);

  const drawer = $('#drawer');
  const backdrop = $('#drawer-backdrop');
  const iconWrap = $('#drawer-icon');
  iconWrap.className = `drawer-icon-wrap accent-${p.colorClass || 'bl'}`;
  iconWrap.innerHTML = `<i class="${p.icon}" aria-hidden="true"></i>`;
  $('#drawer-cat').textContent = CAT_LABELS[p.category] || p.category;
  $('#drawer-title').textContent = p.title;
  $('#drawer-sub').textContent = p.subtitle;
  $('#drawer-desc').textContent = p.description;
  $('#drawer-guide').innerHTML = p.guide || '';

  const alertEl = $('#drawer-alert');
  if (p.alert?.text) {
    alertEl.hidden = false;
    alertEl.className = `drawer-alert ${p.alert.type || 'warning'}`;
    alertEl.innerHTML = p.alert.text;
  } else {
    alertEl.hidden = true;
    alertEl.innerHTML = '';
  }

  const links = $('#drawer-links');
  links.innerHTML = (p.links || [])
    .map((l) => {
      const cls = l.className === 'btn-primary' ? 'btn-primary' : 'btn-secondary';
      const external = /^https?:/i.test(l.url) || l.url.startsWith('mailto:');
      const rel = external && !l.url.startsWith('mailto:') ? 'noopener noreferrer' : undefined;
      const target = external && !l.url.startsWith('mailto:') ? '_blank' : undefined;
      return `<a class="${cls}" href="${escapeAttr(l.url)}"${target ? ` target="${target}"` : ''}${rel ? ` rel="${rel}"` : ''}>${l.text}</a>`;
    })
    .join('');

  updateDrawerStats(id);

  drawer.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    drawer.classList.add('open');
    backdrop.classList.add('show');
  });
  document.body.classList.add('drawer-open');
  $('#drawer-close')?.focus();
}

function escapeAttr(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function closeDrawer() {
  const drawer = $('#drawer');
  const backdrop = $('#drawer-backdrop');
  drawer?.classList.remove('open');
  backdrop?.classList.remove('show');
  document.body.classList.remove('drawer-open');
  setTimeout(() => {
    if (drawer) drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }, 400);
  activeProjectId = null;
}

function initDrawer() {
  $('#drawer-close')?.addEventListener('click', closeDrawer);
  $('#drawer-backdrop')?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#drawer')?.hidden) closeDrawer();
  });

  $('#like-btn')?.addEventListener('click', () => {
    if (!activeProjectId) return;
    toggleLike(activeProjectId);
  });
}

/* ============================================================
   Contact Form UX
   ============================================================ */
function initContact() {
  const form = $('#contact-form');
  form?.addEventListener('submit', () => {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'שולח... <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>';
    }
  });
}

/* ============================================================
   Initialization Boot
   ============================================================ */
initTheme();
initIntro();
initScrollProgress();
initNav();
initParallax();
initReveal();
initPointerPolish();
initStats();
initPortfolio();
initDrawer();
initScrollVelocity();
initContact();
initConsentBanner();
loadCounts();
initWorkClockLatestRelease();
