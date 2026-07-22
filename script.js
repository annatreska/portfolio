/* ── State ─────────────────────────────────────────────────────────── */
let currentTabKey = TABS[0].key;
let catFilter     = null;   // active category within a tab, or null = all
let visibleWorks  = [];     // works currently shown in the grid (respects filter)
let selectedIndex = null;   // index into visibleWorks, or null when detail closed

/* ── DOM refs ──────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── Init ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initGate();
  buildMenu();
  bindLogo();
  bindDetailClose();
  bindMobileMenu();
  switchTab(TABS[0].key);
});

/* ── Password gate (soft — not real security) ──────────────────────── */
const GATE_KEY  = 'pf_unlocked';
const GATE_PASS = 'ulm';
function initGate() {
  const gate = $('gate');
  if (!gate) return;
  if (localStorage.getItem(GATE_KEY) === '1') { gate.hidden = true; return; }
  const form  = $('gate-form');
  const input = $('gate-input');
  const error = $('gate-error');
  setTimeout(() => input.focus(), 50);
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value.trim().toLowerCase() === GATE_PASS) {
      localStorage.setItem(GATE_KEY, '1');
      gate.hidden = true;
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  });
}

/* ── Menu ──────────────────────────────────────────────────────────── */
function buildMenu() {
  const nav = document.querySelector('.menu');
  TABS.forEach(tab => {
    const a = document.createElement('a');
    a.className = 'menu-item';
    a.href = '#';
    a.dataset.tab = tab.key;
    a.textContent = tab.label;
    a.addEventListener('click', e => {
      e.preventDefault();
      switchTab(tab.key);
      if (window.innerWidth <= 699) closeMobileMenu();
    });
    nav.appendChild(a);
  });
}

function currentTab() { return TABS.find(t => t.key === currentTabKey); }

function tabCategories(tab) {
  const cats = [];
  tab.works.forEach(w => { if (w.category && !cats.includes(w.category)) cats.push(w.category); });
  return cats;
}

/* ── Tab switching ─────────────────────────────────────────────────── */
function switchTab(key) {
  currentTabKey = key;
  catFilter = null;
  closeDetail();

  document.querySelectorAll('.menu-item').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === key);
  });

  buildCategoryFilter();
  buildGrid();
  updateTabDesc();
}

/* Sidebar intro text — shown whenever the tab has a description (stays visible
   below the work info when a work is open, if it fits; sidebar scrolls). */
function updateTabDesc() {
  const desc = currentTab().description;
  const el = $('tab-desc');
  if (desc) {
    $('tab-desc-text').textContent = desc;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

/* ── Category filter (sidebar) ─────────────────────────────────────── */
function buildCategoryFilter() {
  const section = $('cat-section');
  const list = $('cat-list');
  list.innerHTML = '';
  const cats = tabCategories(currentTab());

  if (cats.length === 0) { section.hidden = true; return; }
  section.hidden = false;

  const makeItem = (label, value) => {
    const el = document.createElement('div');
    el.className = 'cat-item';
    el.textContent = label;
    el.dataset.cat = value === null ? '' : value;
    el.classList.toggle('selected', catFilter === value);
    el.addEventListener('click', () => {
      catFilter = (catFilter === value) ? null : value;
      closeDetail();
      buildCategoryFilter();
      buildGrid();
    });
    list.appendChild(el);
  };

  makeItem('Wszystkie', null);
  cats.forEach(c => makeItem(c, c));
}

/* ── Grid ──────────────────────────────────────────────────────────── */
function buildGrid() {
  const grid = $('grid');
  grid.innerHTML = '';
  visibleWorks = currentTab().works.filter(w => !catFilter || w.category === catFilter);
  visibleWorks.forEach((w, i) => grid.appendChild(makeGridItem(w, i)));
  $('grid-wrap').scrollTop = 0;
}

function makeGridItem(work, index) {
  const div = document.createElement('div');
  div.className = 'gallery-item';
  div.dataset.index = index;

  const img = document.createElement('img');
  img.src = work.thumb;
  img.alt = work.title;
  img.loading = 'lazy';
  div.appendChild(img);

  const cap = document.createElement('span');
  cap.className = 'item-cap';
  cap.textContent = work.title;
  div.appendChild(cap);

  if (opensInNewTab(work)) {
    // Multi-page PDFs open in a new tab (native viewer → scroll all pages)
    div.classList.add('is-pdf-item');
    const badge = document.createElement('span');
    badge.className = 'pdf-badge';
    badge.textContent = work.type === 'pdf' ? 'PDF ↗' : '↗';
    div.appendChild(badge);
    div.addEventListener('click', () => {
      window.open(work.file, '_blank', 'noopener');
      selectWorkAt(index);   // also show a titled preview in the panel
    });
  } else {
    // Images and single-page PDFs open in the side detail panel
    div.addEventListener('click', () => selectWorkAt(index));
  }
  return div;
}

/* Opens full-screen in a new tab: multi-page PDFs, or works explicitly marked
   fullscreen (dense pieces only legible at full size). Everything else previews
   in the side panel. */
function opensInNewTab(work) {
  return (work.type === 'pdf' && work.pages > 1) || work.fullscreen === true;
}

/* ── Work detail ─────────────────────────────────────────────────────
   Every work previews in the side panel (rendered image + title). Works that
   also open in a new tab do so on click (see makeGridItem); arrow navigation
   only swaps the in-panel preview, it doesn't pop new windows. */
function selectWorkAt(index) {
  const work = visibleWorks[index];
  if (!work) return;
  selectedIndex = index;

  $('tab-panel').classList.add('detail-active');
  $('detail').hidden = false;

  const body = $('detail-body');
  body.innerHTML = '';
  body.className = 'detail-body is-image';
  const img = document.createElement('img');
  img.className = 'detail-img';
  img.src = work.preview || work.file;   // PDFs carry a rendered first-page preview
  img.alt = work.title;
  body.appendChild(img);
  body.scrollTop = 0;

  // Sidebar info
  $('cat-section').hidden = true;
  $('work-info').hidden = false;
  updateTabDesc();   // keep the tab description visible below the work info
  setInfo('info-title', work.title);
  setInfo('info-subtitle', work.subtitle);
  setInfo('info-category', work.category);
  $('work-open').href = work.file;
  setInfo('info-pos', `${index + 1} / ${visibleWorks.length}`);
  $('detail-prev').disabled = index <= 0;
  $('detail-next').disabled = index >= visibleWorks.length - 1;

  // Mark selected thumbnail (compare by data-index)
  document.querySelectorAll('.gallery-item').forEach(el => {
    el.classList.toggle('selected', Number(el.dataset.index) === index);
  });
}

function navigateWork(dir) {
  if (selectedIndex === null) return;
  const next = selectedIndex + dir;
  if (next >= 0 && next < visibleWorks.length) selectWorkAt(next);
}

function closeDetail() {
  selectedIndex = null;
  $('tab-panel').classList.remove('detail-active');
  $('detail').hidden = true;
  $('detail-body').innerHTML = '';
  $('work-info').hidden = true;
  document.querySelectorAll('.gallery-item').forEach(el => el.classList.remove('selected'));
  // Restore category filter for tabs that have one
  if (tabCategories(currentTab()).length) $('cat-section').hidden = false;
  updateTabDesc();
}

function bindDetailClose() {
  $('detail-close').addEventListener('click', closeDetail);
  $('detail-prev').addEventListener('click', () => navigateWork(-1));
  $('detail-next').addEventListener('click', () => navigateWork(+1));
  document.addEventListener('keydown', e => {
    if (selectedIndex === null) return;
    if (e.key === 'Escape')     closeDetail();
    if (e.key === 'ArrowLeft')  navigateWork(-1);
    if (e.key === 'ArrowRight') navigateWork(+1);
  });
}

/* ── Logo → home (first tab) ───────────────────────────────────────── */
function bindLogo() {
  document.querySelectorAll('.logo-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchTab(TABS[0].key);
      if (window.innerWidth <= 699) closeMobileMenu();
    });
  });
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function setInfo(id, value) {
  const el = $(id);
  el.textContent = value || '';
  el.hidden = !value;
}

/* ── Mobile menu ───────────────────────────────────────────────────── */
function bindMobileMenu() {
  const btn     = $('hamburger');
  const sidebar = $('sidebar');
  const overlay = $('sidebar-overlay');
  if (!btn) return;

  btn.addEventListener('click', () =>
    sidebar.classList.contains('open') ? closeMobileMenu() : openMobileMenu());
  overlay.addEventListener('click', closeMobileMenu);
}
function openMobileMenu() {
  $('sidebar').classList.add('open');
  $('sidebar-overlay').classList.add('active');
  $('hamburger').classList.add('open');
  $('hamburger').setAttribute('aria-expanded', 'true');
}
function closeMobileMenu() {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('active');
  $('hamburger').classList.remove('open');
  $('hamburger').setAttribute('aria-expanded', 'false');
}
