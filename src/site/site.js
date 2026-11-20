// Site vitrine : défilement fluide (Lenis) + chorégraphie du mannequin au scroll (ScrollTrigger).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const portrait = () => window.innerWidth / window.innerHeight < 1 || window.innerWidth <= 980;
const fitR = (r) => { const a = window.innerWidth / window.innerHeight; return a < 1.05 ? r * Math.min(1.8, 1.05 / a) : r; };
const pad2 = (n) => String(n).padStart(2, '0');

// Poses du mannequin par section (x/y = décalage écran, theta = angle caméra, r = distance)
function poses() {
  const p = portrait();
  return {
    hero: { x: 0, y: p ? 0.1 : 0.04, theta: 0, phi: 1.5, r: p ? 120 : 98, ty: 0, sway: 1 },
    mani: { x: p ? 0 : 0.25, y: p ? -0.2 : 0, theta: -1.0, phi: 1.42, r: p ? 160 : 118, ty: 0, sway: 0.35 },
    proc: { x: p ? 0 : -0.18, y: p ? -0.16 : 0, theta: 0.3, phi: 1.47, r: p ? 126 : 108, ty: 0, sway: 0.15 },
    coll: { x: 0, y: p ? -0.12 : -0.06, theta: 0.28, phi: 1.44, r: p ? 132 : 108, ty: 0, sway: 0.2 },
    r360: { x: 0, y: p ? -0.05 : 0, theta: 0, phi: 1.36, r: p ? 128 : 98, ty: 0, sway: 0 },
    colors: { x: p ? 0 : -0.2, y: p ? 0.1 : 0, theta: 0.75, phi: 1.36, r: p ? 128 : 92, ty: 0, sway: 0.3 },
    final: { x: 0, y: p ? -0.14 : -0.1, theta: 0, phi: 1.5, r: p ? 136 : 122, ty: 0, sway: 1 },
  };
}
const KEYS = ['x', 'y', 'theta', 'phi', 'r', 'ty', 'sway'];

/** Découpe un élément en caractères (mots préservés). */
function splitChars(el) {
  if (el.dataset.done) return $$('.ch', el);
  const words = el.textContent.split(/(\s+)/);
  el.innerHTML = words.map((w) => (/^\s+$/.test(w) ? ' ' : `<span class="cw">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`)).join('');
  el.dataset.done = '1';
  return $$('.ch', el);
}
/** Découpe un titre en lignes (séparées par <br>). */
function splitLines(el) {
  if (el.dataset.done) return $$('.split-line > span', el);
  el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map((l) => `<span class="split-line"><span>${l.trim()}</span></span>`).join('');
  el.dataset.done = '1';
  return $$('.split-line > span', el);
}

export function createSite({ stage, avatar, hair, STYLES, COLORS, mouse }) {
  const byId = (id) => STYLES.find((s) => s.id === id);
  const lenis = new Lenis({ duration: 1.35, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 0.85, touchMultiplier: 1.5 });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const pose = { ...poses().hero, spin: 0, rotY: 0 };
  let active = false;
  let current = 'hero';

  stage.onTick((dt, t) => {
    if (!active) return;
    stage.view.shiftX = pose.x; stage.view.shiftY = pose.y; stage._applyView();
    stage._setSpherical({ theta: pose.theta + pose.spin, phi: pose.phi, radius: fitR(pose.r), ty: pose.ty });
    stage.root.rotation.y = pose.rotY + pose.sway * (Math.sin(t * 0.35) * 0.42 + mouse.sx * 0.55);
    stage.root.rotation.x = pose.sway * mouse.sy * 0.1;
  });

  // ---------- transitions de pose entre sections ----------
  function poseTween(from, to, trigger, start = 'top bottom', end = 'top top') {
    const f = {}, t = {};
    KEYS.forEach((k) => { f[k] = () => poses()[from][k]; t[k] = () => poses()[to][k]; });
    gsap.fromTo(pose, f, { ...t, ease: 'none', immediateRender: false, scrollTrigger: { trigger, start, end, scrub: 1.2, invalidateOnRefresh: true } });
  }
  poseTween('hero', 'mani', '#manifeste', 'top bottom', 'top 15%');
  poseTween('mani', 'proc', '#processus');
  poseTween('proc', 'coll', '#collection');
  poseTween('coll', 'r360', '#rotation');
  poseTween('r360', 'colors', '#teintes');
  poseTween('colors', 'final', '#essayer', 'top bottom', 'top 10%');

  // ---------- coiffure par section ----------
  const sectionHair = {
    hero: () => startCycle(),
    mani: () => hair.show(byId('bun'), 'drop'),
    proc: () => applyProcess(procState.p, true),
    coll: () => hair.show(STYLES[collState.idx], 'drop'),
    r360: () => hair.show(byId('cornrows'), 'drop'),
    colors: () => { hair.show(byId('box-braids'), 'drop'); hair.setColor(COLORS[colorState.idx].hex, COLORS[colorState.idx].tip); },
    final: () => hair.show(byId('afro'), 'drop'),
  };
  function setCurrent(key) {
    if (current === key) return;
    if (current === 'hero') stopCycle();
    if (current === 'colors' && key !== 'colors') { hair.setColor(COLORS[0].hex, COLORS[0].tip); colorState.idx = 0; }
    if (current === 'proc' && key !== 'proc') { avatar.uniforms.uReveal.value = 1; pose.spin = 0; }
    current = key;
    if (active && sectionHair[key]) sectionHair[key]();
  }
  [['hero', '#top'], ['mani', '#manifeste'], ['proc', '#processus'], ['coll', '#collection'], ['r360', '#rotation'], ['colors', '#teintes'], ['final', '#essayer']]
    .forEach(([key, sel]) => ScrollTrigger.create({ trigger: sel, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && setCurrent(key) }));

  // ---------- héros : vitrine tournante ----------
  const HERO = ['box-braids', 'afro', 'waves-fade', 'bun', 'locks', 'cornrows', 'twists'].map(byId);
  let cycleIdx = 0, cycleTimer = null;
  function startCycle() {
    stopCycle();
    const s = HERO[cycleIdx % HERO.length];
    hair.show(s, 'drop');
    const now = $('#heroNow');
    gsap.to(now, { yPercent: -60, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { now.textContent = s.name; gsap.fromTo(now, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }); } });
    gsap.fromTo('#heroBar', { scaleX: 0 }, { scaleX: 1, duration: 3.4, ease: 'none' });
    cycleIdx++;
    cycleTimer = setTimeout(startCycle, 3400);
  }
  function stopCycle() { clearTimeout(cycleTimer); gsap.killTweensOf('#heroBar'); }

  // ---------- bandeau défilant (vitesse liée au scroll) ----------
  const mq = $('#marquee');
  const items = STYLES.map((s) => `<span class="marquee__item">${s.name}<i></i></span>`).join('');
  mq.innerHTML = items + items + items;
  let mqX = 0, mqSkew = 0;
  gsap.ticker.add(() => {
    const v = lenis.velocity || 0;
    mqX -= 0.6 + Math.abs(v) * 0.35;
    const w = mq.scrollWidth / 3;
    if (-mqX > w) mqX += w;
    mqSkew += (Math.max(-12, Math.min(12, v * 0.6)) - mqSkew) * 0.1;
    mq.style.transform = `translate3d(${mqX}px,0,0) skewX(${-mqSkew}deg)`;
  });

  // ---------- manifeste : mots révélés au scroll ----------
  const man = $('#manifesto');
  man.innerHTML = man.textContent.split(/\s+/).map((w) => `<span class="mw">${w}</span>`).join(' ');
  gsap.to($$('.mw', man), { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: '#manifeste', start: 'top 65%', end: 'bottom 75%', scrub: 1 } });

  // ---------- processus : 3 étapes épinglées ----------
  const steps = $$('.pstep');
  steps.forEach((s) => splitChars($('.pstep__t', s)));
  const procState = { step: -1, p: 0 };
  function showStep(i) {
    if (procState.step === i) return;
    const prev = procState.step;
    procState.step = i;
    $('#procNum').textContent = pad2(i + 1);
    steps.forEach((s, k) => {
      const chars = $$('.ch', s), d = $('.pstep__d', s), n = $('.pstep__n', s);
      gsap.killTweensOf([chars, d, n]);
      if (k === i) {
        const dir = i > prev ? 1 : -1;
        gsap.fromTo(chars, { yPercent: 110 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.03 });
        gsap.fromTo([n, d], { y: 24 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', delay: 0.15, stagger: 0.06 });
      } else {
        gsap.to(chars, { yPercent: -110 * (i > k ? 1 : -1), opacity: 0, duration: 0.45, ease: 'power3.in', stagger: 0.015 });
        gsap.to([n, d], { opacity: 0, duration: 0.3 });
      }
    });
  }
  steps.forEach((s, k) => { if (k) { gsap.set($$('.ch', s), { opacity: 0 }); gsap.set([$('.pstep__d', s), $('.pstep__n', s)], { opacity: 0 }); } });
  procState.step = 0;
  function applyProcess(p, force = false) {
    procState.p = p;
    const i = Math.min(2, Math.floor(p * 3));
    const local = p * 3 - i;
    showStep(i);
    gsap.set('#procBar', { scaleX: p });
    if (!active || current !== 'proc') return;
    if (i === 0) {
      // balayage de scan : la tête se reconstruit sous la ligne lumineuse
      avatar.uniforms.uReveal.value = 0.3 + 0.7 * Math.min(1, local * 1.15);
      pose.spin = 0;
      if (hair.current) hair.hideAll(0.4);
    } else if (i === 1) {
      avatar.uniforms.uReveal.value = 1;
      pose.spin = -Math.sin(local * Math.PI) * 1.1;
      if (hair.current) hair.hideAll(0.4);
    } else {
      avatar.uniforms.uReveal.value = 1;
      pose.spin = 0;
      if (force || hair.current !== 'box-braids') hair.show(byId('box-braids'), 'drop');
    }
  }
  ScrollTrigger.create({ trigger: '#processus', start: 'top top', end: 'bottom bottom', onUpdate: (self) => applyProcess(self.progress) });

  // ---------- collection : piste horizontale ----------
  const track = $('#collTrack');
  track.innerHTML = STYLES.map((s, i) => `
    <article class="ccard" data-id="${s.id}">
      <span class="ccard__img"><img alt="" /></span>
      <span class="ccard__n">${pad2(i + 1)}</span>
      <span class="ccard__name">${s.name}</span>
      <span class="ccard__meta">${s.duration} · ${s.price} FCFA</span>
    </article>`).join('');
  $('#collTotal').textContent = pad2(STYLES.length);
  const cards = $$('.ccard', track);
  const collState = { idx: -1 };
  const collName = $('#collName');
  function setCollIdx(i) {
    if (collState.idx === i) return;
    collState.idx = i;
    cards.forEach((c, k) => c.classList.toggle('is-on', k === i));
    $('#collIdx').textContent = pad2(i + 1);
    const old = $$('.ch', collName);
    const write = () => {
      collName.textContent = STYLES[i].name; delete collName.dataset.done;
      gsap.fromTo(splitChars(collName), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.02 });
    };
    if (old.length) gsap.to(old, { yPercent: -100, opacity: 0, duration: 0.25, stagger: 0.008, onComplete: write }); else write();
    if (active && current === 'coll') hair.show(STYLES[i], 'drop');
  }
  ScrollTrigger.create({
    trigger: '#collection', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const p = self.progress;
      const step = cards[0].offsetWidth + 18;
      const f = p * (STYLES.length - 1);
      gsap.set(track, { x: -cards[0].offsetWidth / 2 - f * step });
      gsap.set('#collBar', { scaleX: p });
      setCollIdx(Math.round(f));
    },
  });
  gsap.set(track, { x: -200 });
  setCollIdx(0);

  // ---------- 360° ----------
  const marks = $$('.r360-marks li');
  ScrollTrigger.create({
    trigger: '#rotation', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const p = self.progress;
      pose.rotY = p * Math.PI * 2;
      $('#deg').textContent = String(Math.round(p * 360)).padStart(3, '0');
      let on = 0; marks.forEach((m, k) => { if (p >= parseFloat(m.dataset.at) - 0.02) on = k; });
      marks.forEach((m, k) => m.classList.toggle('is-on', k === on));
    },
    onLeave: () => { pose.rotY = 0; },
    onLeaveBack: () => { pose.rotY = 0; },
  });

  // ---------- teintes ----------
  $('#colorsList').innerHTML = COLORS.map((c) => `<li><i style="background:linear-gradient(135deg, ${c.hex} 40%, ${c.tip})"></i>${c.name}</li>`).join('');
  const colorItems = $$('#colorsList li');
  const colorState = { idx: 0 };
  colorItems[0].classList.add('is-on');
  ScrollTrigger.create({
    trigger: '#teintes', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const i = Math.min(COLORS.length - 1, Math.floor(self.progress * COLORS.length));
      if (i === colorState.idx) return;
      colorState.idx = i;
      colorItems.forEach((li, k) => li.classList.toggle('is-on', k === i));
      if (active && current === 'colors') hair.setColor(COLORS[i].hex, COLORS[i].tip);
    },
  });

  // ---------- salons : ouverture en volet ----------
  gsap.fromTo('.salons-inner', { clipPath: 'inset(14% 7% 0% 7% round 48px)' }, {
    clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
    scrollTrigger: { trigger: '#salons', start: 'top bottom', end: 'top 10%', scrub: 1 },
  });
  ScrollTrigger.create({
    trigger: '#salons', start: 'top 60px', end: 'bottom 60px',
    onToggle: (self) => { document.body.classList.toggle('on-light', self.isActive); $('#rail').classList.toggle('is-dark', self.isActive); },
  });
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count;
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) }); },
    });
  });

  // ---------- révélations génériques ----------
  $$('[data-split-lines]').forEach((el) => {
    const lines = splitLines(el);
    gsap.fromTo(lines, { yPercent: 115, rotate: 2.5 }, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } });
  });
  $$('.eyebrow').forEach((el) => {
    if (el.closest('.s-hero')) return;
    gsap.fromTo(el, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
    gsap.fromTo($('.eyebrow__line', el), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
  });
  ScrollTrigger.batch('.site [data-reveal]:not(.s-hero [data-reveal])', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    onLeaveBack: (els) => gsap.to(els, { y: 50, opacity: 0, duration: 0.5, overwrite: true }),
  });
  gsap.set('.site [data-reveal]:not(.s-hero [data-reveal])', { opacity: 0 });
  $$('.body:not(.body--dark), .body--dark').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } });
  });
  const finalChars = splitChars($('.final-title [data-split]'));
  gsap.fromTo(finalChars, { yPercent: 120, rotate: 8 }, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.final-title', start: 'top 85%', toggleActions: 'play none none reverse' } });
  gsap.fromTo('.final-cta > *', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.final-cta', start: 'top 92%', toggleActions: 'play none none reverse' } });
  // parallaxe légère du titre héros à la sortie
  gsap.to('.hero-title', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-meta, .hero-bottom', { y: -80, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#top', start: '20% top', end: '80% top', scrub: true } });

  // ---------- rail + en-tête ----------
  const sections = $$('.site .s[data-label]');
  $('#rail').innerHTML = sections.map((s) => `<a href="#${s.id}" data-scroll><span>${s.dataset.label}</span><i></i></a>`).join('');
  const railLinks = $$('#rail a');
  sections.forEach((s, k) => ScrollTrigger.create({ trigger: s, start: 'top 50%', end: 'bottom 50%', onToggle: (self) => self.isActive && railLinks.forEach((a, j) => a.classList.toggle('is-on', j === k)) }));
  const topbar = $('.topbar');
  let lastY = 0;
  lenis.on('scroll', ({ scroll }) => {
    if (!active) return;
    topbar.classList.toggle('is-hidden', scroll > lastY && scroll > window.innerHeight * 0.6);
    topbar.classList.toggle('is-solid', scroll > 40);
    lastY = scroll;
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll]');
    if (!a) return;
    e.preventDefault();
    lenis.scrollTo(a.getAttribute('href'), { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  });

  // ---------- API ----------
  return {
    pose, lenis,
    /** Première apparition, après l'écran de chargement. */
    intro() {
      const P = poses().hero;
      Object.assign(pose, P, { r: P.r * 1.6, theta: -0.9, spin: 0, rotY: 0 });
      gsap.to(pose, { r: P.r, theta: 0, duration: 3, ease: 'expo.out' });
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      const chars = $$('.hero-title [data-split]').flatMap((el) => splitChars(el));
      tl.fromTo(chars, { yPercent: 120, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.6, stagger: 0.035 }, 0.1)
        .fromTo('.hero-meta', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.6)
        .fromTo('.s-hero [data-reveal], .scroll-cue', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.8)
        .fromTo('.topbar', { yPercent: -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2 }, 0.5)
        .fromTo('.rail a', { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 1, stagger: 0.05 }, 1)
        .fromTo('.marquee', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 1);
      this.enter();
      window.scrollTo(0, 0);
      lenis.scrollTo(0, { immediate: true, force: true });
      ScrollTrigger.refresh();
    },
    enter() {
      active = true;
      stage.controls.enabled = false; stage.controls.autoRotate = false;
      gsap.killTweensOf(stage.view);
      document.body.classList.remove('app-mode');
      lenis.start();
      ScrollTrigger.refresh();
      current = '__';
      // section courante d'après la position
      const order = [['final', '#essayer'], ['colors', '#teintes'], ['r360', '#rotation'], ['coll', '#collection'], ['proc', '#processus'], ['mani', '#manifeste'], ['hero', '#top']];
      const key = (order.find(([, sel]) => $(sel).getBoundingClientRect().top < window.innerHeight * 0.55) || ['hero'])[0];
      setCurrent(key);
    },
    leave() {
      active = false;
      stopCycle();
      lenis.stop();
      avatar.uniforms.uReveal.value = 1;
      pose.spin = 0;
      document.body.classList.add('app-mode');
      document.body.classList.remove('on-light');
      $('.topbar').classList.remove('is-hidden', 'is-solid');
    },
    setThumbs(map) {
      cards.forEach((c) => { const img = $('img', c); if (map[c.dataset.id]) img.src = map[c.dataset.id]; });
    },
    get active() { return active; },
  };
}
