// Site vitrine : défilement fluide (Lenis) + chorégraphie du mannequin au scroll (ScrollTrigger).
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
/** Mise en page empilée : même règle que le CSS. */
const stacked = () => window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;
// distance caméra adaptée au format : portrait (plus loin) et écrans bas (plus loin aussi)
const fitR = (r) => {
  const a = window.innerWidth / window.innerHeight;
  if (a < 1.05) return r * Math.min(1.9, 1.05 / a);
  return r * Math.pow(Math.min(1.3, Math.max(1, 860 / window.innerHeight)), 0.85);
};
const pad2 = (n) => String(n).padStart(2, '0');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Poses du mannequin par section (x/y = décalage écran, theta = angle caméra, r = distance)
function poses() {
  const p = stacked();
  return {
    hero: { x: p ? 0 : 0.25, y: p ? 0.1 : 0.03, theta: p ? 0 : -0.25, phi: 1.5, r: p ? 128 : 100, ty: 0, sway: 1 },
    mani: { x: p ? 0 : 0.3, y: p ? -0.24 : 0, theta: -1.0, phi: 1.42, r: p ? 150 : 116, ty: 0, sway: 0.35 },
    proc: { x: p ? 0 : -0.17, y: p ? -0.15 : 0, theta: 0.3, phi: 1.47, r: p ? 128 : 106, ty: 0, sway: 0.12 },
    coll: { x: 0, y: p ? -0.06 : -0.04, theta: 0.28, phi: 1.44, r: p ? 136 : 124, ty: 0, sway: 0.2 },
    r360: { x: 0, y: p ? -0.02 : 0, theta: 0, phi: 1.36, r: p ? 132 : 100, ty: 0, sway: 0 },
    colors: { x: p ? 0 : -0.19, y: p ? 0.04 : 0, theta: 0.75, phi: 1.36, r: p ? 130 : 94, ty: 0, sway: 0.3 },
    final: { x: 0, y: p ? 0.26 : 0.3, theta: 0, phi: 1.5, r: p ? 120 : 104, ty: 0, sway: 1 },
  };
}
const KEYS = ['x', 'y', 'theta', 'phi', 'r', 'ty', 'sway'];

/** Découpe un élément en caractères (mots préservés). */
export function splitChars(el) {
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

export function createSite({ stage, avatar, hair, STYLES, COLORS, mouse, onTry }) {
  const byId = (id) => STYLES.find((s) => s.id === id);
  // sélection courte pour la vitrine (la cabine présente tout le catalogue)
  const FEAT = ['box-braids', 'cornrows', 'locks', 'afro', 'waves-fade', 'bun'].map(byId);
  const lenis = new Lenis({ duration: reduced ? 0.6 : 1.35, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 0.85, touchMultiplier: 1.4 });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const pose = { ...poses().hero, spin: 0, rotY: 0 };
  let active = false;
  let current = 'hero';

  // position écran de la tête (pour le cadre de scan et le cadran 360°)
  const HEAD = new THREE.Vector3(0, 2.6, -4.9), _w = new THREE.Vector3(), _e = new THREE.Vector3();
  function headScreen(radiusCm = 12) {
    stage.root.updateMatrixWorld();
    _w.copy(HEAD); stage.root.localToWorld(_w);
    _e.copy(_w).project(stage.camera);
    const dist = stage.camera.position.distanceTo(_w);
    const pxPerCm = window.innerHeight / (2 * dist * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2)));
    return { x: (_e.x * 0.5 + 0.5) * window.innerWidth, y: (-_e.y * 0.5 + 0.5) * window.innerHeight, s: radiusCm * pxPerCm };
  }

  const scanframe = $('#scanframe'), dial = $('#dial');
  stage.onTick((dt, t) => {
    if (!active) return;
    stage.controls.enabled = false; stage.controls.autoRotate = false;
    const T = targetPose(), f = 1 - Math.pow(0.012, dt);   // lissage indépendant de la cadence
    for (const key of KEYS) pose[key] += (T[key] - pose[key]) * f;
    stage.view.shiftX = pose.x; stage.view.shiftY = pose.y; stage._applyView();
    stage._setSpherical({ theta: pose.theta + pose.spin, phi: pose.phi, radius: fitR(pose.r), ty: pose.ty });
    stage.root.rotation.y = pose.rotY + pose.sway * (Math.sin(t * 0.35) * 0.42 + mouse.sx * 0.55);
    stage.root.rotation.x = pose.sway * mouse.sy * 0.1;
    if (current === 'proc') {
      const h = headScreen(11);
      const w = h.s * 2, hh = h.s * 2.5;
      scanframe.style.width = `${w}px`; scanframe.style.height = `${hh}px`;
      scanframe.style.transform = `translate(${h.x - w / 2}px, ${h.y - hh * 0.46}px)`;
    }
    if (current === 'r360') {
      const h = headScreen(20);
      const d = h.s * 2;
      dial.style.width = dial.style.height = `${d}px`;
      dial.style.transform = `translate(${h.x - d / 2}px, ${h.y - d / 2}px)`;
    }
  });

  // ---------- transitions de pose entre sections ----------
  // Chaque transition est un simple repère de défilement ; la pose est recalculée
  // à chaque image en enchaînant les transitions dans l'ordre (aucun conflit possible).
  const transitions = [];
  function poseTween(from, to, trigger, start = 'top bottom', end = 'top top') {
    transitions.push({ to, st: ScrollTrigger.create({ trigger, start, end }) });
  }
  const easeIO = (k) => k * k * (3 - 2 * k);
  const target = {};
  function targetPose() {
    const P = poses();
    Object.assign(target, P.hero);
    for (const t of transitions) {
      const k = easeIO(Math.min(1, Math.max(0, t.st.progress)));
      if (k <= 0) break;
      for (const key of KEYS) target[key] += (P[t.to][key] - target[key]) * k;
    }
    return target;
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
    coll: () => hair.show(FEAT[collState.idx], 'drop'),
    r360: () => hair.show(byId('cornrows'), 'drop'),
    colors: () => { hair.show(byId('box-braids'), 'drop'); applyColor(colorState.idx, true); },
    final: () => hair.show(byId('afro'), 'drop'),
  };
  function setCurrent(key) {
    if (current === key) return;
    if (current === 'hero') stopCycle();
    if (current === 'colors' && key !== 'colors') { hair.setColor(COLORS[0].hex, COLORS[0].tip); gsap.to('#bgTint', { opacity: 0, duration: 1 }); }
    if (current === 'proc' && key !== 'proc') { avatar.uniforms.uReveal.value = 1; pose.spin = 0; gsap.to(scanframe, { opacity: 0, duration: 0.4 }); }
    if (current === 'r360' && key !== 'r360') gsap.to(dial, { opacity: 0, duration: 0.5 });
    if (key === 'r360') gsap.to(dial, { opacity: 1, duration: 0.8 });
    current = key;
    if (active && sectionHair[key]) sectionHair[key]();
  }
  const SECTIONS = [['hero', '#top'], ['mani', '#manifeste'], ['proc', '#processus'], ['coll', '#collection'], ['r360', '#rotation'], ['colors', '#teintes'], ['final', '#essayer']];
  SECTIONS.forEach(([key, sel]) => ScrollTrigger.create({ trigger: sel, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && setCurrent(key) }));

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

  // parallaxe de sortie du héros : les deux lignes s'écartent
  gsap.to('.ht--1', { xPercent: -18, ease: 'none', scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.ht--2', { xPercent: 14, ease: 'none', scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.ht--3', { xPercent: -10, ease: 'none', scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero-title', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '#top', start: '30% top', end: '85% top', scrub: true } });
  gsap.to('.hero-meta, .hero-bottom', { y: -80, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#top', start: '15% top', end: '70% top', scrub: true } });

  // ---------- bandeau défilant (vitesse liée au scroll) ----------
  const mq = $('#marquee');
  const items = STYLES.map((s) => `<span class="marquee__item">${s.name}<i></i></span>`).join('');
  mq.innerHTML = items + items + items;
  let mqX = 0, mqSkew = 0;
  gsap.ticker.add(() => {
    if (!active) return;
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
  gsap.to($$('.mw', man), { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: '#manifeste', start: 'top 70%', end: 'bottom 80%', scrub: 1 } });

  // ---------- processus : 3 étapes épinglées ----------
  const steps = $$('.pstep');
  steps.forEach((s) => splitChars($('.pstep__t', s)));
  const procState = { step: 0, p: 0 };
  function showStep(i) {
    if (procState.step === i) return;
    const prev = procState.step;
    procState.step = i;
    $('#procNum').textContent = pad2(i + 1);
    steps.forEach((s, k) => {
      const chars = $$('.ch', s), d = $('.pstep__d', s), n = $('.pstep__n', s);
      gsap.killTweensOf([...chars, d, n]);
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
  const scanPct = $('#scanPct');
  function applyProcess(p, force = false) {
    procState.p = p;
    const i = Math.min(2, Math.floor(p * 3));
    const local = p * 3 - i;
    showStep(i);
    gsap.set('#procBar', { scaleX: p });
    if (!active || current !== 'proc') return;
    if (i === 0) {
      // balayage de scan : la tête se reconstruit sous la ligne lumineuse
      const k = Math.min(1, local * 1.15);
      avatar.uniforms.uReveal.value = 0.3 + 0.7 * k;
      scanframe.style.setProperty('--scan', `${Math.min(100, k * 100)}%`);
      scanPct.textContent = String(Math.round(k * 468)).padStart(3, '0');
      gsap.to(scanframe, { opacity: 1, duration: 0.4, overwrite: 'auto' });
      pose.spin = 0;
      if (hair.current) hair.hideAll(0.4);
    } else if (i === 1) {
      avatar.uniforms.uReveal.value = 1;
      gsap.to(scanframe, { opacity: 0, duration: 0.4, overwrite: 'auto' });
      pose.spin = -Math.sin(local * Math.PI) * 1.1;
      if (hair.current) hair.hideAll(0.4);
    } else {
      avatar.uniforms.uReveal.value = 1;
      gsap.to(scanframe, { opacity: 0, duration: 0.4, overwrite: 'auto' });
      pose.spin = 0;
      if (force || hair.current !== 'box-braids') hair.show(byId('box-braids'), 'drop');
    }
  }
  ScrollTrigger.create({ trigger: '#processus', start: 'top top', end: 'bottom bottom', onUpdate: (self) => applyProcess(self.progress) });

  // ---------- collection : piste horizontale ----------
  const track = $('#collTrack');
  track.innerHTML = FEAT.map((s, i) => `
    <button class="ccard" data-id="${s.id}" data-cursor="Essayer">
      <span class="ccard__img"><img alt="" /></span>
      <span class="ccard__n">${pad2(i + 1)}</span>
      <span class="ccard__go">→</span>
      <span class="ccard__name">${s.name}</span>
      <span class="ccard__meta">${s.duration} · ${s.price} FCFA</span>
    </button>`).join('');
  $('#collTotal').textContent = pad2(FEAT.length);
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
      collName.textContent = FEAT[i].name; delete collName.dataset.done;
      gsap.fromTo(splitChars(collName), { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.02 });
    };
    if (old.length) gsap.to(old, { yPercent: -100, opacity: 0, duration: 0.25, stagger: 0.008, onComplete: write }); else write();
    if (active && current === 'coll') hair.show(FEAT[i], 'drop');
  }
  ScrollTrigger.create({
    trigger: '#collection', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const p = self.progress;
      const step = cards[0].offsetWidth + 16;
      const f = p * (FEAT.length - 1);
      gsap.set(track, { x: -cards[0].offsetWidth / 2 - f * step });
      gsap.set('#collBar', { scaleX: p });
      setCollIdx(Math.round(f));
    },
  });
  gsap.set(track, { x: -100 });
  setCollIdx(0);
  track.addEventListener('click', (e) => { const c = e.target.closest('.ccard'); if (c) onTry?.(c.dataset.id); });

  // ---------- 360° ----------
  (function buildDial() {
    let html = '';
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2 - Math.PI / 2, major = i % 30 === 0, mid = i % 10 === 0;
      const r1 = 182, r2 = major ? 168 : mid ? 173 : 177;
      html += `<line class="${major ? 'major' : ''}" x1="${200 + Math.cos(a) * r1}" y1="${200 + Math.sin(a) * r1}" x2="${200 + Math.cos(a) * r2}" y2="${200 + Math.sin(a) * r2}"/>`;
    }
    $('#dialTicks').innerHTML = html;
  })();
  gsap.set(dial, { opacity: 0 });
  const marks = $$('.r360-marks li');
  const dialProg = $('#dialProg');
  ScrollTrigger.create({
    trigger: '#rotation', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => {
      const p = self.progress;
      pose.rotY = p * Math.PI * 2;
      $('#deg').textContent = String(Math.round(p * 360)).padStart(3, '0');
      dialProg.style.strokeDashoffset = String(1231.5 * (1 - p));
      let on = 0; marks.forEach((m, k) => { if (p >= parseFloat(m.dataset.at) - 0.02) on = k; });
      marks.forEach((m, k) => m.classList.toggle('is-on', k === on));
    },
    onLeave: () => { pose.rotY = 0; },
    onLeaveBack: () => { pose.rotY = 0; },
  });

  // ---------- teintes ----------
  $('#colorsList').innerHTML = COLORS.map((c) => `<li title="${c.name}"><i style="background:linear-gradient(135deg, ${c.hex} 40%, ${c.tip})"></i></li>`).join('');
  const colorItems = $$('#colorsList li');
  const colorState = { idx: 0 };
  colorItems[0].classList.add('is-on');
  function applyColor(i, force = false) {
    if (i === colorState.idx && !force) return;
    colorState.idx = i;
    const c = COLORS[i];
    colorItems.forEach((li, k) => li.classList.toggle('is-on', k === i));
    const now = $('#colorNow');
    gsap.to(now, { yPercent: -50, opacity: 0, duration: 0.25, onComplete: () => { now.textContent = c.name; gsap.fromTo(now, { yPercent: 50, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }); } });
    if (active && current === 'colors') {
      hair.setColor(c.hex, c.tip);
      gsap.to('#bgTint', { color: c.tip, opacity: 0.45, duration: 1.2 });
    }
  }
  ScrollTrigger.create({
    trigger: '#teintes', start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => applyColor(Math.min(COLORS.length - 1, Math.floor(self.progress * COLORS.length))),
  });

  // ---------- salons : ouverture en volet + écrans vivants ----------
  gsap.fromTo('.salons-inner', { clipPath: 'inset(16% 6% 0% 6% round 48px)' }, {
    clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
    scrollTrigger: { trigger: '#salons', start: 'top bottom', end: 'top 5%', scrub: 1 },
  });
  ScrollTrigger.create({
    trigger: '#salons', start: 'top 60px', end: 'bottom 60px',
    onToggle: () => {},
  });
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count;
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) }); },
    });
  });
  let thumbList = [], screenTimer = null, screenIdx = 0;
  function cycleScreens() {
    if (!thumbList.length) return;
    $$('.dv__screen').forEach((scr, k) => {
      const imgs = $$('img', scr);
      const nextImg = imgs.find((im) => !im.classList.contains('on')) || imgs[0];
      nextImg.src = thumbList[(screenIdx + k * 4) % thumbList.length];
      imgs.forEach((im) => im.classList.toggle('on', im === nextImg));
    });
    screenIdx++;
  }
  ScrollTrigger.create({
    trigger: '#devices', start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { clearInterval(screenTimer); if (self.isActive) { cycleScreens(); screenTimer = setInterval(cycleScreens, 1800); } },
  });

  // ---------- révélations génériques ----------
  $$('[data-split-lines]').forEach((el) => {
    const lines = splitLines(el);
    gsap.fromTo(lines, { yPercent: 115, rotate: 2.5 }, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } });
  });
  $$('.site .eyebrow').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none reverse' } });
    gsap.fromTo($('.eyebrow__line', el), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none reverse' } });
  });
  gsap.set('.site [data-reveal]', { opacity: 0, y: 50 });
  ScrollTrigger.batch('.site [data-reveal]', {
    start: 'top 90%',
    onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    onLeaveBack: (els) => gsap.to(els, { y: 50, opacity: 0, duration: 0.5, overwrite: true }),
  });
  $$('.site .body').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none reverse' } });
  });
  const finalChars = splitChars($('.final-title [data-split]'));
  gsap.fromTo(finalChars, { yPercent: 120, rotate: 8 }, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.final-title', start: 'top 85%', toggleActions: 'play none none reverse' } });
  gsap.fromTo('.final-cta > *', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.final-cta', start: 'top 95%', toggleActions: 'play none none reverse' } });
  gsap.fromTo('#gl', { opacity: 1 }, { opacity: 0.18, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'top 40%', scrub: true } });
  // mise en page empilée : le mannequin s'efface derrière le texte du manifeste
  gsap.matchMedia().add('(orientation: portrait), (max-width: 760px)', () => {
    gsap.fromTo('#gl', { opacity: 1 }, { opacity: 0.2, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '#manifeste', start: 'top 70%', end: 'top 20%', scrub: true } });
    gsap.fromTo('#gl', { opacity: 0.2 }, { opacity: 1, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '#processus', start: 'top 95%', end: 'top 45%', scrub: true } });
  });
  // le logo du pied de page se dessine trait par trait
  const footStrokes = prepDraw($('.footer__logo'));
  gsap.to(footStrokes, { strokeDashoffset: 0, duration: 1.8, ease: 'power3.inOut', stagger: 0.06, scrollTrigger: { trigger: '.footer', start: 'top 92%', toggleActions: 'play none none reverse' } });

  // ---------- rail, navigation, en-tête ----------
  const sections = $$('.site .s[data-label]');
  $('#rail').innerHTML = sections.map((s) => `<a href="#${s.id}" data-scroll><span>${s.dataset.label}</span><i></i></a>`).join('');
  const railLinks = $$('#rail a');
  const navLinks = $$('.topnav a');
  sections.forEach((s, k) => ScrollTrigger.create({
    trigger: s, start: 'top 50%', end: 'bottom 50%',
    onToggle: (self) => {
      if (!self.isActive) return;
      railLinks.forEach((a, j) => a.classList.toggle('is-on', j === k));
      navLinks.forEach((a) => a.classList.toggle('is-on', a.getAttribute('href') === `#${s.id}`));
    },
  }));
  const topbar = $('.topbar');
  let lastY = 0;
  lenis.on('scroll', ({ scroll }) => {
    if (!active || document.body.classList.contains('menu-open')) return;
    topbar.classList.toggle('is-hidden', scroll > lastY + 2 && scroll > window.innerHeight * 0.6);
    if (scroll < lastY - 2) topbar.classList.remove('is-hidden');
    topbar.classList.toggle('is-solid', scroll > 40);
    lastY = scroll;
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-scroll]');
    if (!a || !active) return;
    e.preventDefault();
    const go = () => lenis.scrollTo(a.getAttribute('href'), { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    if (document.body.classList.contains('menu-open')) { toggleMenu(false); setTimeout(go, 450); } else go();
  });

  // ---------- menu mobile ----------
  const menu = $('#menu');
  function toggleMenu(open) {
    document.body.classList.toggle('menu-open', open);
    $('#burger').setAttribute('aria-expanded', String(open));
    if (open) {
      menu.classList.add('is-on'); lenis.stop();
      gsap.fromTo('.menu__bg', { clipPath: 'circle(0% at calc(100% - 44px) 44px)' }, { clipPath: 'circle(150% at calc(100% - 44px) 44px)', duration: 1, ease: 'expo.inOut' });
      gsap.fromTo('.menu__links a span, .menu__links a i', { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.04, delay: 0.35 });
      gsap.fromTo('.menu__foot', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.6 });
    } else {
      gsap.to('.menu__links a span, .menu__links a i, .menu__foot', { yPercent: -110, opacity: 0, duration: 0.4, ease: 'power3.in', stagger: 0.015, onComplete: () => gsap.set('.menu__links a span, .menu__links a i, .menu__foot', { clearProps: 'opacity' }) });
      gsap.to('.menu__bg', { clipPath: 'circle(0% at calc(100% - 44px) 44px)', duration: 0.8, ease: 'expo.inOut', delay: 0.2, onComplete: () => menu.classList.remove('is-on') });
      if (active) lenis.start();
    }
  }
  $('#burger').addEventListener('click', () => toggleMenu(!document.body.classList.contains('menu-open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('[data-action]')) toggleMenu(false); });

  // les déclencheurs se recalculent quand la mise en page change (rotation de tablette…)
  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => ScrollTrigger.refresh(), 250); });

  // ---------- API ----------
  return {
    pose, lenis,
    /** Première apparition, après l'écran de chargement. */
    intro() {
      window.scrollTo(0, 0);
      const P = poses().hero;
      Object.assign(pose, P, { r: P.r * 1.7, theta: P.theta - 1.1, spin: 0, rotY: 0 });
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      const chars = $$('.hero-title [data-split]').flatMap((el) => splitChars(el));
      tl.fromTo(chars, { yPercent: 120, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.6, stagger: 0.035 }, 0.1)
        .fromTo('.hero-meta', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.6)
        .fromTo('[data-hero]', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.8)
        .fromTo('.topbar', { yPercent: -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2 }, 0.5)
        .fromTo('.rail a', { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 1, stagger: 0.05 }, 1)
        .fromTo('.marquee', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 1);
      this.enter();
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
      ScrollTrigger.update();
      current = '__';
      const order = [['final', '#essayer'], ['colors', '#teintes'], ['r360', '#rotation'], ['coll', '#collection'], ['proc', '#processus'], ['mani', '#manifeste'], ['hero', '#top']];
      const key = (order.find(([, sel]) => $(sel).getBoundingClientRect().top < window.innerHeight * 0.55) || ['hero'])[0];
      setCurrent(key);
    },
    leave() {
      active = false;
      stopCycle();
      clearInterval(screenTimer);
      lenis.stop();
      avatar.uniforms.uReveal.value = 1;
      pose.spin = 0; pose.rotY = 0;
      hair.setColor(COLORS[0].hex, COLORS[0].tip);
      gsap.set([scanframe, dial, '#bgTint'], { opacity: 0 });
      gsap.set('#gl', { opacity: 1 });
      document.body.classList.add('app-mode');
      document.body.classList.remove('on-light');
      $('.topbar').classList.remove('is-hidden', 'is-solid');
    },
    setThumbs(map) {
      thumbList = STYLES.map((s) => map[s.id]).filter(Boolean);
      cards.forEach((c) => { const img = $('img', c); if (map[c.dataset.id]) { img.src = map[c.dataset.id]; img.classList.add('ready'); } });
    },
    get active() { return active; },
  };
}

/** Rideau plein écran : couvre, exécute fn, puis découvre. */
export async function curtain(fn) {
  const gold = $('.curtain__gold'), ink = $('.curtain__ink'), word = $('.curtain__ink span');
  if (reduced) { await fn(); return; }
  gsap.set([gold, ink], { y: 0, yPercent: 100 });
  await gsap.timeline()
    .to(gold, { yPercent: 0, duration: 0.7, ease: 'expo.inOut' })
    .to(ink, { yPercent: 0, duration: 0.7, ease: 'expo.inOut' }, 0.12)
    .set(word, { opacity: 1 }, 0.5)
    .fromTo(prepDraw($('.curtain__logo')), { strokeDashoffset: (i, el) => el._len }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut', stagger: 0.03 }, 0.5);
  await fn();
  await new Promise((r) => setTimeout(r, 150));
  await gsap.timeline()
    .to(word, { opacity: 0, duration: 0.3 })
    .to(ink, { yPercent: -100, duration: 0.8, ease: 'expo.inOut' }, 0.1)
    .to(gold, { yPercent: -100, duration: 0.8, ease: 'expo.inOut' }, 0.22);
}

/** Prépare les traits d'un logo SVG pour un effet de dessin (dasharray = longueur du trait). */
export function prepDraw(svg) {
  const strokes = [...svg.querySelectorAll('.lg-s')];
  strokes.forEach((p) => {
    const len = Math.ceil(p.getTotalLength()) + 2;
    p._len = len;
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
  });
  return strokes;
}
