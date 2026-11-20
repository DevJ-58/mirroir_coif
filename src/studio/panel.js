// Cabine : collection sans conteneur, présentée par pages avec entrées/sorties floutées.
import gsap from 'gsap';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const stacked = () => window.matchMedia('(orientation: portrait), (max-width: 980px)').matches;
const pad2 = (n) => String(n).padStart(2, '0');

export function initPanel({ STYLES }) {
  const panel = $('#panel'), wrap = $('#cards');
  let cards = $$('.card', wrap);
  const catOf = (c) => STYLES.find((s) => s.id === c.dataset.id).cat;
  let filter = 'all', page = 0, size = 4, busy = false, queued = null;

  // nombre de styles par page et taille des vignettes selon la place disponible
  function pageSize() {
    if (stacked()) return window.innerWidth < 420 ? 3 : 4;
    const h = wrap.clientHeight || 400;
    const n = Math.max(2, Math.min(5, Math.round(h / 132)));
    panel.style.setProperty('--th', `${Math.max(64, Math.min(116, h / n - 12))}px`);
    return n;
  }
  const list = () => cards.filter((c) => filter === 'all' || catOf(c) === filter);
  const pages = () => Math.max(1, Math.ceil(list().length / size));

  function updatePager() {
    const n = pages();
    $('#pgFrom').textContent = pad2(page + 1);
    $('#pgTotal').textContent = pad2(n);
    $('#pager').classList.toggle('is-single', n < 2);
    $$('.pager__btn').forEach((b) => (b.disabled = n < 2));
  }

  /** Affiche la page courante ; dir = sens de l'animation (1 suivant, -1 précédent). */
  function render(dir = 1, animate = true) {
    if (busy) { queued = dir; return; }
    size = pageSize();
    page = Math.min(page, pages() - 1);
    const show = list().slice(page * size, page * size + size);
    const out = cards.filter((c) => c.classList.contains('is-shown') && !show.includes(c));
    const horiz = stacked();
    const axis = horiz ? 'x' : 'y';
    const enter = () => {
      out.forEach((c) => c.classList.remove('is-shown'));
      show.forEach((c) => c.classList.add('is-shown'));
      updatePager();
      if (!animate) { gsap.set(show, { clearProps: 'opacity,filter,x,y' }); busy = false; return; }
      gsap.fromTo(show, { opacity: 0, filter: 'blur(16px)', [axis]: 46 * dir },
        { opacity: 1, filter: 'blur(0px)', [axis]: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07,
          onComplete: () => { gsap.set(show, { clearProps: 'filter' }); busy = false; if (queued !== null) { const d = queued; queued = null; render(d); } } });
    };
    if (animate && out.length) {
      busy = true;
      gsap.to(out, { opacity: 0, filter: 'blur(16px)', [axis]: -36 * dir, duration: 0.42, ease: 'power3.in', stagger: 0.04, onComplete: enter });
    } else { busy = animate; enter(); }
  }

  function go(delta) {
    const n = pages(); if (n < 2) return;
    page = (page + delta + n) % n;
    render(delta >= 0 ? 1 : -1);
  }

  // onglets de catégories
  $('#chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip'); if (!chip || chip.dataset.cat === filter) return;
    $$('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
    filter = chip.dataset.cat; page = 0;
    render(1);
  });
  $('#pager').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) go(+b.dataset.page); });

  // molette (ordinateur) et glissé (tactile)
  let wheelLock = 0;
  panel.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now < wheelLock || Math.abs(e.deltaY) < 8) return;
    wheelLock = now + 700;
    go(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  let sx = 0, sy = 0;
  wrap.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    const d = stacked() ? dx : dy;
    if (Math.abs(d) > 40 && Math.abs(d) > Math.abs(stacked() ? dy : dx)) go(d < 0 ? 1 : -1);
  }, { passive: true });

  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (pageSize() !== size) render(1, false); }, 200); });

  return {
    /** La collection a changé (coiffure déposée ou retirée). */
    refresh() { cards = $$('.card', wrap); filter = 'all'; page = 0; busy = false; render(1, false); },
    /** Première présentation (entrée du studio). */
    intro() { cards.forEach((c) => c.classList.remove('is-shown')); busy = false; render(1); },
    /** Amène la carte d'un style à l'écran si elle est sur une autre page. */
    reveal(id) {
      let l = list();
      if (!l.some((c) => c.dataset.id === id)) { filter = 'all'; $$('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.cat === 'all')); l = list(); }
      const idx = l.findIndex((c) => c.dataset.id === id);
      const p = Math.floor(idx / size);
      if (p !== page) { const dir = p > page ? 1 : -1; page = p; render(dir); }
    },
  };
}
