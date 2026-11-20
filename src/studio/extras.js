// Studio : comparateur avant/après à glisser, favoris côte à côte, veille du mode borne.
import * as THREE from 'three';
import gsap from 'gsap';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initExtras({ stage, hair, state, STYLES, select, toast, onReset }) {
  // ================= comparateur avant / après =================
  const split = $('#split'), line = $('#splitLine'), handle = $('#splitHandle');
  const sp = { x: 0 };
  let hidden = null;
  stage.split = {
    get x() { return state.compare ? sp.x : 0; },
    hide() { hidden = hair.current ? hair.cache.get(hair.current) : null; if (hidden) hidden.group.visible = false; },
    show() { if (hidden) hidden.group.visible = true; hidden = null; },
  };
  const placeLine = () => { line.style.transform = `translateX(${sp.x * window.innerWidth}px)`; };
  gsap.ticker.add(() => { if (state.compare) placeLine(); });

  function setCompare(on) {
    if (on === state.compare) return;
    state.compare = on;
    $('[data-action="compare"]').classList.toggle('is-on', on);
    gsap.killTweensOf(sp);
    if (on) {
      if (hair.current !== state.selected.id) hair.show(state.selected, 'instant');
      split.hidden = false;
      sp.x = 1;
      // balayage d'ouverture : on montre l'avant, puis on se cale au milieu
      gsap.timeline()
        .to(sp, { x: 0.18, duration: 1.1, ease: 'expo.inOut' })
        .to(sp, { x: 0.5, duration: 1.2, ease: 'elastic.out(1, 0.6)' });
      gsap.fromTo('.split__tag', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.6, stagger: 0.1 });
    } else {
      gsap.to(sp, { x: 0, duration: 0.6, ease: 'expo.in', onComplete: () => { split.hidden = true; } });
    }
  }

  let dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    dragging = true; handle.setPointerCapture(e.pointerId);
    stage.controls.enabled = false;
    gsap.killTweensOf(sp);
    e.stopPropagation();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    sp.x = Math.min(0.98, Math.max(0.02, e.clientX / window.innerWidth));
  });
  const endDrag = () => { if (!dragging) return; dragging = false; if (state.screen === 'studio' && !state.presenting) stage.controls.enabled = true; };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  // flèches du clavier sur la poignée
  handle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { sp.x = Math.max(0.02, sp.x - 0.04); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowRight') { sp.x = Math.min(0.98, sp.x + 0.04); e.preventDefault(); e.stopPropagation(); }
  });

  // ================= favoris =================
  const favs = new Set();
  // cœur sur chaque carte du panneau
  $$('#cards .card').forEach((c) => {
    const heart = document.createElement('span');
    heart.className = 'card__fav'; heart.dataset.fav = c.dataset.id; heart.setAttribute('role', 'button'); heart.setAttribute('aria-label', 'Favori');
    heart.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
    c.appendChild(heart);
  });
  // le cœur intercepte le clic avant la sélection de la carte
  $('#cards').addEventListener('click', (e) => {
    const h = e.target.closest('[data-fav]');
    if (!h) return;
    e.stopPropagation(); e.preventDefault();
    toggleFav(h.dataset.fav);
  }, true);

  function toggleFav(id) {
    const on = !favs.has(id);
    if (on) favs.add(id); else favs.delete(id);
    refreshFavs(id, on);
  }
  function refreshFavs(changedId, on) {
    $$('.card__fav').forEach((h) => h.classList.toggle('is-on', favs.has(h.dataset.fav)));
    const cur = favs.has(state.selected?.id);
    const fb = $('.favbtn');
    fb.classList.toggle('is-on', cur); fb.setAttribute('aria-pressed', String(cur));
    const n = $('#favCount');
    n.textContent = favs.size;
    n.classList.toggle('is-on', favs.size > 0);
    if (changedId) {
      gsap.fromTo(n, { scale: 1.6 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      const el = $(`.card__fav[data-fav="${changedId}"]`);
      if (el && on) gsap.fromTo(el, { scale: 0.6 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      const s = STYLES.find((x) => x.id === changedId);
      toast(on ? `${s.name} ajouté aux favoris` : `${s.name} retiré des favoris`);
    }
  }

  // modale côte à côte : chaque favori rendu sur l'avatar de la personne
  const favCam = new THREE.PerspectiveCamera(28, 1, 1, 1000);
  favCam.position.set(26, 6, 84); favCam.lookAt(0, 0.8, 0);
  function renderOn(style) {
    const h = hair.get(style);
    const saved = [...hair.cache.values()].map((x) => [x, x.group.visible, x.common.uGrow.value, x.group.position.y, x.group.scale.x]);
    const rot = stage.root.rotation.clone();
    for (const [x] of saved) x.group.visible = false;
    h.group.visible = true; h.common.uGrow.value = 1; h.group.position.y = 0; h.group.scale.setScalar(1);
    stage.root.rotation.set(0, 0, 0);
    const url = stage.renderThumb(favCam, 420);
    for (const [x, v, g, y, sc] of saved) { x.group.visible = v; x.common.uGrow.value = g; x.group.position.y = y; x.group.scale.setScalar(sc); }
    stage.root.rotation.copy(rot);
    return url;
  }
  async function openFavs() {
    if (favs.size < 2) { toast('Ajoutez au moins deux favoris avec le cœur pour les comparer'); return; }
    const list = STYLES.filter((s) => favs.has(s.id));
    const shots = {};
    for (const s of list) shots[s.id] = await stage.inFrame(() => renderOn(s));
    $('#favsGrid').innerHTML = list.map((s, i) => `
      <article class="fav" data-id="${s.id}">
        <span class="fav__n">${String(i + 1).padStart(2, '0')}</span>
        <img class="fav__img" src="${shots[s.id]}" alt="${s.name}" />
        <div class="fav__body">
          <h4 class="fav__name">${s.name}</h4>
          <p class="fav__meta">${s.duration} · ${s.price} FCFA</p>
          <div class="fav__actions">
            <button class="btn btn--primary btn--sm" data-action="fav-pick" data-id="${s.id}"><span class="btn__bg"></span><span class="btn__label">Choisir</span></button>
            <button class="link-btn" data-action="fav-remove" data-id="${s.id}">Retirer</button>
          </div>
        </div>
      </article>`).join('');
    const m = $('#favs');
    m.classList.add('is-on');
    gsap.to('.favs__backdrop', { opacity: 1, duration: 0.5 });
    gsap.fromTo('.favs__panel', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out' });
    gsap.fromTo('.fav', { y: 50, opacity: 0, rotate: 2 }, { y: 0, opacity: 1, rotate: 0, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
  }
  function closeFavs() {
    gsap.to('.favs__backdrop', { opacity: 0, duration: 0.4 });
    gsap.to('.favs__panel', { y: 40, opacity: 0, duration: 0.4, onComplete: () => $('#favs').classList.remove('is-on') });
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action;
    if (a === 'fav') toggleFav(state.selected.id);
    if (a === 'favs') openFavs();
    if (a === 'close-favs') closeFavs();
    if (a === 'fav-pick') { const s = STYLES.find((x) => x.id === el.dataset.id); closeFavs(); select(s, true); }
    if (a === 'fav-remove') {
      favs.delete(el.dataset.id); refreshFavs();
      const card = el.closest('.fav');
      gsap.to(card, { scale: 0.9, opacity: 0, duration: 0.4, onComplete: () => { card.remove(); if (favs.size < 2) closeFavs(); } });
    }
    if (a === 'idle-stay') wake();
  });

  // ================= veille du mode borne =================
  const q = new URLSearchParams(location.search);
  const IDLE_MS = (q.has('borne') ? 45 : 120) * 1000;
  const COUNT = 10;
  let last = performance.now(), prompting = false, countTl = null;
  const touch = () => { last = performance.now(); if (prompting) wake(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
  setInterval(() => {
    const inApp = ['studio', 'scan', 'generate'].includes(state.screen);
    if (!inApp || prompting || state.presenting) return;
    if (performance.now() - last > IDLE_MS) prompt();
  }, 1000);

  function prompt() {
    prompting = true;
    const el = $('#idle');
    el.classList.add('is-on');
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    gsap.fromTo('.idle__card', { y: 30, scale: 0.96 }, { y: 0, scale: 1, duration: 0.8, ease: 'expo.out' });
    const o = { t: COUNT };
    countTl = gsap.to(o, {
      t: 0, duration: COUNT, ease: 'none',
      onUpdate: () => {
        $('#idleCount').textContent = Math.ceil(o.t);
        $('#idleProg').style.strokeDashoffset = String(339.3 * (1 - o.t / COUNT));
      },
      onComplete: () => { hideIdle(); onReset(); },
    });
  }
  function hideIdle() {
    prompting = false;
    countTl?.kill();
    gsap.to('#idle', { opacity: 0, duration: 0.4, onComplete: () => $('#idle').classList.remove('is-on') });
  }
  function wake() { last = performance.now(); if (prompting) hideIdle(); }

  return {
    setCompare,
    onSelect() { refreshFavs(); },
    clearFavs() { favs.clear(); refreshFavs(); },
  };
}
