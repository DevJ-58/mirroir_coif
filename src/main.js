import * as THREE from 'three';
import gsap from 'gsap';
import { Stage } from './three/stage.js';
import { Avatar } from './three/avatar.js';
import { HairManager } from './three/hair.js';
import { alignLandmarks } from './three/head.js';
import { STYLES, CATEGORIES, COLORS } from './data/catalog.js';
import { runVideoScan, scanImage, sampleSkin, loadLandmarker } from './scan/scanner.js';
import { initCursor, initMagnetic, setCursor } from './ui/cursor.js';
import { createSite } from './site/site.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isPortrait = () => window.innerWidth / window.innerHeight < 1 || window.innerWidth <= 980;
const fit = (r) => { const a = window.innerWidth / window.innerHeight; return a < 1.05 ? r * Math.min(1.75, 1.05 / a) : r; };

// ---------- scène ----------
const stage = new Stage($('#gl'));
const avatar = new Avatar();
stage.root.add(avatar.group);
const hair = new HairManager(avatar.group);

const state = {
  screen: 'loader',
  selected: STYLES[0],
  color: COLORS[0],
  compare: false,
  presenting: null,
  scanned: false,
  introTimer: null,
  scanAbort: null,
  idle: true,
};

// balancement de l'avatar (accueil) + parallaxe souris
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
window.addEventListener('pointermove', (e) => { mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5; });
const site = createSite({ stage, avatar, hair, STYLES, COLORS, mouse });
stage.onTick((dt, t) => {
  mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
  if (state.idle) {
    stage.root.rotation.y = Math.sin(t * 0.35) * 0.55 + mouse.sx * 0.6;
    stage.root.rotation.x = mouse.sy * 0.12;
  }
  // respiration légère
  stage.root.position.y = -1.5 + Math.sin(t * 1.1) * 0.12;
});

// ---------- titre géant ----------
const bigTitle = $('#bigTitle');
function setBigTitle(text) {
  const old = $$('.ch', bigTitle);
  const enter = () => {
    bigTitle.innerHTML = [...text].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    gsap.fromTo($$('.ch', bigTitle), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.025 });
  };
  if (old.length) gsap.to(old, { yPercent: -110, opacity: 0, duration: 0.4, ease: 'power2.in', stagger: 0.01, onComplete: enter });
  else enter();
}

// ---------- écrans ----------
const STEP_LABEL = { site: 'Accueil', scan: 'Étape 1 — Scan', generate: 'Étape 2 — Avatar', studio: 'Étape 3 — Essayage' };
function show(name) {
  const prev = state.screen;
  state.screen = name;
  document.body.dataset.screen = name;
  $$('.screen').forEach((s) => s.classList.toggle('is-on', s.id === name));
  document.body.classList.toggle('app-mode', name !== 'site' && name !== 'loader');
  $('#stepLabel').textContent = STEP_LABEL[name] || '';
  return prev;
}

function layoutFor(name) {
  const p = isPortrait();
  if (name === 'intro') return p ? { x: 0, y: -0.11, r: fit(132) } : { x: 0.16, y: 0, r: 112 };
  if (name === 'scan') return p ? { x: 0, y: 0, r: fit(150) } : { x: -0.2, y: 0, r: 150 };
  if (name === 'generate') return { x: 0, y: 0, r: fit(98) };
  if (name === 'studio') return p ? { x: 0, y: -0.06, r: fit(128) } : { x: -0.035, y: 0, r: 116 };
  return { x: 0, y: 0, r: 110 };
}
function applyLayout(name, d = 1.6) {
  const L = layoutFor(name);
  stage.shift(L.x, L.y, d);
  document.documentElement.style.setProperty('--ring-x', `${L.x * window.innerWidth}px`);
  return L;
}
window.addEventListener('resize', () => {
  if (state.screen === 'site' || state.screen === 'loader') return;
  applyLayout(state.screen, 0.6);
  if (!state.presenting) stage.orbitTo({ radius: layoutFor(state.screen).r, theta: 0, phi: 1.5, ty: 0, duration: 0.6 });
});

// ---------- chargement ----------
async function boot() {
  const letters = $$('.loader__brand span');
  gsap.to(letters, { y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06 });
  const bar = $('#loadBar'), pct = $('#loadPct'), txt = $('#loadText');
  const setP = (p, label) => { gsap.to(bar, { scaleX: p, duration: 0.5, ease: 'power2.out' }); pct.textContent = `${Math.round(p * 100)}%`; if (label) txt.textContent = label; };
  await nextFrame();
  setP(0.08, 'Sculpture du mannequin');
  await wait(300);
  const total = STYLES.length;
  for (let i = 0; i < total; i++) {
    setP(0.1 + (i / total) * 0.62, `Coiffure · ${STYLES[i].name}`);
    await nextFrame();
    hair.get(STYLES[i]);
  }
  setP(0.75, 'Compilation des matières');
  // compile les shaders en affichant chaque coiffure une fois
  for (const s of STYLES) hair.show(s, 'instant');
  stage.renderer.compile(stage.scene, stage.camera);
  hair.show(null);
  await nextFrame();
  setP(0.85, 'Vignettes de la collection');
  await renderThumbs();
  setP(1, 'Studio prêt');
  loadLandmarker().catch(() => {}); // préchargement silencieux du scanner
  await wait(450);

  gsap.to(letters, { y: '-105%', duration: 0.8, ease: 'expo.in', stagger: 0.04 });
  gsap.to('#loader', { autoAlpha: 0, duration: 0.9, delay: 0.6, ease: 'power2.inOut', onComplete: () => $('#loader').remove() });
  await wait(700);
  // liens directs (borne / tests) : ?studio&style=afro
  const q = new URLSearchParams(location.search);
  const qs = STYLES.find((s) => s.id === q.get('style'));
  if (qs) state.selected = qs;
  document.body.classList.remove('is-loading');
  if (q.has('studio')) { document.body.classList.add('app-mode'); enterStudio(); } else enterSite(true);
}

// ---------- site vitrine ----------
function enterSite(first = false) {
  show('site');
  state.idle = false;
  if (first) site.intro(); else {
    site.enter();
    gsap.fromTo('.site, .rail', { opacity: 0 }, { opacity: 1, duration: 1, ease: 'power2.out' });
  }
}
async function leaveSite() {
  site.leave();
  document.body.classList.remove('app-mode');
  await gsap.to('.site, .rail', { opacity: 0, duration: 0.5, ease: 'power2.in' });
  document.body.classList.add('app-mode');
  gsap.set('.site, .rail', { opacity: 1 });
}

// ---------- scan ----------
const ringProg = $('#ringProg');
(function buildTicks() {
  const g = $('#ringTicks'); let html = '';
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, r1 = 99.5, r2 = i % 6 ? 101.5 : 103.5;
    html += `<line x1="${100 + Math.cos(a) * r1}" y1="${100 + Math.sin(a) * r1}" x2="${100 + Math.cos(a) * r2}" y2="${100 + Math.sin(a) * r2}"/>`;
  }
  g.innerHTML = html;
})();
function setRing(p) {
  ringProg.style.strokeDashoffset = String(603.2 * (1 - p));
  const n = Math.round(p * 72);
  $$('#ringTicks line').forEach((l, i) => l.classList.toggle('on', i < n));
}

async function enterScan() {
  if (state.screen === 'site') await leaveSite();
  if (state.screen === 'studio') await leaveStudio();
  show('scan');
  state.idle = true;
  hair.hideAll(0.4);
  stage.controls.enabled = false; stage.controls.autoRotate = false;
  const L = applyLayout('scan');
  stage.orbitTo({ theta: 0, phi: 1.5, radius: L.r, ty: 0, duration: 1.6 });
  setBigTitle('Scan');
  setRing(0);
  $('#scanIdle').style.display = '';
  $('#scanTitle').textContent = 'Préparation';
  $('#scanHint').textContent = 'Autorisez l’accès à la caméra. Le traitement reste sur cet appareil.';
  $('#scanStatus').textContent = '';
  $$('#scanSteps i').forEach((i) => (i.className = ''));
  gsap.fromTo('.scan__stage', { scale: 0.85, opacity: 0, rotate: -8 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.6, ease: 'expo.out' });
  gsap.fromTo('.scan__copy > *, .scan__actions', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, delay: 0.2 });

  const ov = $('#overlay');
  const size = ov.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio);
  ov.width = ov.height = Math.round(size);

  state.scanAbort?.abort();
  const ac = (state.scanAbort = new AbortController());
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
    const result = await runVideoScan({
      video: $('#video'), overlay: ov,
      onStep: (i, st) => {
        $('#scanIdle').style.display = 'none';
        $$('#scanSteps i').forEach((el, k) => (el.className = k < i ? 'done' : k === i ? 'cur' : ''));
        swapText($('#scanTitle'), st.title);
        $('#scanHint').textContent = st.hint;
      },
      onProgress: setRing,
      onStatus: (t) => { $('#scanStatus').textContent = t; },
      onFlash: () => gsap.fromTo('#flash', { opacity: 0.85 }, { opacity: 0, duration: 0.9, ease: 'power2.out' }),
    }, ac.signal);
    if (ac.signal.aborted) return;
    await processCapture(result);
  } catch (err) {
    if (err?.name === 'AbortError' || ac.signal.aborted) return;
    console.warn(err);
    $('#scanIdle').style.display = 'none';
    swapText($('#scanTitle'), 'Caméra indisponible');
    $('#scanHint').textContent = 'Autorisez la caméra dans le navigateur, ou importez une photo de face bien éclairée.';
  }
}
function stopScan() { state.scanAbort?.abort(); state.scanAbort = null; const v = $('#video'); v.srcObject?.getTracks?.().forEach((t) => t.stop()); v.srcObject = null; }

$('#photoInput').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; e.target.value = '';
  if (!f) return;
  stopScan();
  const img = new Image();
  img.src = URL.createObjectURL(f);
  await img.decode().catch(() => {});
  $('#scanIdle').style.display = '';
  $('#scanIdle span').textContent = 'Analyse de la photo…';
  try {
    const res = await scanImage(img);
    setRing(1);
    await processCapture(res);
  } catch (err) {
    console.warn(err);
    $('#scanIdle').style.display = 'none';
    swapText($('#scanTitle'), 'Visage introuvable');
    $('#scanHint').textContent = 'Essayez une photo de face, visage dégagé et bien éclairé.';
  }
});

// ---------- génération de l'avatar ----------
async function processCapture({ landmarks, canvas, width, height }) {
  stopScan();
  await gsap.to('.scan__stage, .scan__copy, .scan__actions', { opacity: 0, scale: 0.96, duration: 0.6, ease: 'power2.in' });
  gsap.set('.scan__stage, .scan__copy, .scan__actions', { clearProps: 'all' });
  show('generate');
  setBigTitle('Avatar');
  const L = applyLayout('generate');
  stage.orbitTo({ theta: 0, phi: 1.5, radius: L.r, ty: 1, duration: 1.8 });
  state.idle = false;
  gsap.to(stage.root.rotation, { x: 0, y: 0, duration: 1.2, ease: 'power3.out' });
  gsap.fromTo('.gen__center > *', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out' });
  gsap.fromTo('#genList li', { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out' });
  const items = $$('#genList li'); items.forEach((l) => l.classList.remove('on'));
  const pct = { v: 0 };
  const pctTween = (to, d) => gsap.to(pct, { v: to, duration: d, ease: 'power1.inOut', onUpdate: () => ($('#genPct').textContent = Math.round(pct.v)) });

  // 1. repères → espace canonique
  items[0].classList.add('on'); pctTween(25, 0.9);
  const verts = alignLandmarks(landmarks, width, height);
  const uvs = new Float32Array(468 * 2);
  for (let i = 0; i < 468; i++) { uvs[i * 2] = landmarks[i].x; uvs[i * 2 + 1] = 1 - landmarks[i].y; }
  const cloud = makeCloud(verts);
  avatar.uniforms.uReveal.value = 0.0;
  await wait(900);

  // 2. volume
  items[1].classList.add('on'); pctTween(55, 1.0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const [r, g, b] = sampleSkin(canvas, landmarks);
  const skin = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
  avatar.setScan({ verts, uvs, texture: tex, skin });
  state.scanned = true;
  await wait(400);

  // 3. texture + révélation
  items[2].classList.add('on'); pctTween(85, 1.6);
  gsap.to(avatar.uniforms.uReveal, { value: 1, duration: 2.2, ease: 'power2.inOut' });
  gsap.to(cloud.material, { opacity: 0, duration: 1.6, delay: 0.8, onComplete: () => { cloud.parent.remove(cloud); cloud.geometry.dispose(); } });
  await wait(2300);

  // 4. vignettes
  items[3].classList.add('on'); pctTween(100, 0.8);
  await nextFrame();
  await renderThumbs();
  await wait(700);
  enterStudio();
}

function makeCloud(verts) {
  const N = 468;
  const target = Float32Array.from(verts);
  const start = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(18 + Math.random() * 30);
    start[i * 3] = v.x; start[i * 3 + 1] = v.y + 2; start[i * 3 + 2] = v.z;
  }
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(Float32Array.from(start), 3);
  geo.setAttribute('position', pos);
  const mat = new THREE.PointsMaterial({ color: '#f3d9a8', size: 0.42, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  avatar.group.add(pts);
  const o = { t: 0 };
  gsap.to(o, {
    t: 1, duration: 1.6, ease: 'expo.inOut',
    onUpdate: () => {
      for (let i = 0; i < N * 3; i++) pos.array[i] = start[i] + (target[i] - start[i]) * o.t;
      pos.needsUpdate = true;
    },
  });
  return pts;
}

// ---------- studio ----------
const cardsEl = $('#cards');
function buildPanel() {
  $('#chips').innerHTML = CATEGORIES.map((c, i) => `<button class="chip${i ? '' : ' is-active'}" data-cat="${c.id}">${c.label}</button>`).join('');
  cardsEl.innerHTML = STYLES.map((s, i) => `
    <button class="card" data-id="${s.id}" data-cursor="Essayer">
      <span class="card__no">${String(i + 1).padStart(2, '0')}</span>
      <span class="card__img"><span class="sk"></span><img alt="" /></span>
      <span class="card__body"><span class="card__name">${s.name}</span><span class="card__meta">${s.duration} · ${s.price} F</span></span>
    </button>`).join('');
  $('#swatches').innerHTML = COLORS.map((c, i) => `<button class="sw${i ? '' : ' is-active'}" data-color="${c.id}" title="${c.name}" style="background:linear-gradient(135deg, ${c.hex} 40%, ${c.tip})"></button>`).join('');
  $('#panelCount').textContent = STYLES.length;
  $('#dTotal').textContent = String(STYLES.length).padStart(2, '0');
}
buildPanel();

async function renderThumbs() {
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 1000);
  cam.position.set(30, 9, 82);
  cam.lookAt(0, 0.5, 0);
  const savedRot = stage.root.rotation.clone(), savedY = stage.root.position.y;
  const savedCurrent = hair.current;
  const savedReveal = avatar.uniforms.uReveal.value;
  avatar.uniforms.uReveal.value = 1;
  stage.root.rotation.set(0, 0, 0); stage.root.position.y = -1.5;
  const thumbs = {};
  for (const s of STYLES) {
    hair.show(s, 'instant');
    const url = stage.renderThumb(cam, 280);
    thumbs[s.id] = url;
    const img = $(`.card[data-id="${s.id}"] img`);
    if (img) { img.src = url; img.classList.add('ready'); img.previousElementSibling?.remove(); }
    await nextFrame();
  }
  site.setThumbs(thumbs);
  hair.show(null, 'instant');
  if (savedCurrent) { hair.current = null; hair.show(STYLES.find((s) => s.id === savedCurrent), 'instant'); }
  stage.root.rotation.copy(savedRot); stage.root.position.y = savedY;
  avatar.uniforms.uReveal.value = savedReveal;
}

function enterStudio() {
  show('studio');
  state.idle = false;
  gsap.to(stage.root.rotation, { x: 0, y: 0, duration: 1.2, ease: 'power3.out' });
  const L = applyLayout('studio');
  stage.orbitTo({ theta: 0.35, phi: 1.46, radius: L.r, ty: 0.5, duration: 2 }).eventCallback('onComplete', () => { stage.controls.enabled = true; });
  const seg = $('#lookSeg');
  seg.classList.toggle('is-disabled', !state.scanned);
  setLook(state.scanned && avatar.realistic ? 'real' : 'mannequin', false);

  gsap.fromTo('#panel', { x: 80, opacity: 0, rotateY: -12 }, { x: 0, opacity: 1, rotateY: 0, duration: 1.6, ease: 'expo.out', delay: 0.2 });
  gsap.fromTo('.card', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.045, delay: 0.45 });
  gsap.fromTo('#details > *', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.07, delay: 0.35 });
  gsap.fromTo('#toolbar', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', delay: 0.6 });
  gsap.fromTo('.studio__left, #hintDrag', { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.8 });
  select(state.selected, true);
}

async function leaveStudio() {
  stage.controls.enabled = false; stage.controls.autoRotate = false;
  $('[data-action="rotate"]').classList.remove('is-on');
  await gsap.to('#panel, #details, #toolbar, .studio__left, #hintDrag', { opacity: 0, y: 20, duration: 0.5, ease: 'power2.in', stagger: 0.03 });
  gsap.set('#panel, #details, #toolbar, .studio__left, #hintDrag', { clearProps: 'opacity,transform' });
}

function select(style, force = false) {
  const changed = state.selected !== style;
  state.selected = style;
  $$('.card').forEach((c) => c.classList.toggle('is-selected', c.dataset.id === style.id));
  if (state.compare) setCompare(false);
  hair.show(style, 'drop');
  setBigTitle(style.name);
  if (changed || force) updateDetails(style);
}

function updateDetails(s) {
  const i = STYLES.indexOf(s);
  $('#dIndex').textContent = String(i + 1).padStart(2, '0');
  const nameEl = $('#dName');
  nameEl.innerHTML = s.name.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.fromTo($$('.w', nameEl), { yPercent: 105 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.06 });
  swapText($('#dDesc'), s.desc);
  $('#dDur').textContent = s.duration;
  $('#dPrice').textContent = s.price;
}

// survol = aperçu instantané sur l'avatar (le style « glisse » sur la tête)
let hoverTimer = null;
cardsEl.addEventListener('pointerover', (e) => {
  const card = e.target.closest('.card'); if (!card || e.pointerType === 'touch') return;
  clearTimeout(hoverTimer);
  const s = STYLES.find((x) => x.id === card.dataset.id);
  if (state.presenting) return;
  if (state.compare) setCompare(false);
  if (hair.current !== s.id) { hair.show(s, 'drop'); setBigTitle(s.name); }
});
cardsEl.addEventListener('pointerleave', () => {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (state.presenting || state.compare) return;
    if (hair.current !== state.selected.id) { hair.show(state.selected, 'drop'); setBigTitle(state.selected.name); }
  }, 280);
});
cardsEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card'); if (!card) return;
  const s = STYLES.find((x) => x.id === card.dataset.id);
  const wasPreview = hair.current === s.id;
  state.selected = null;
  if (wasPreview) { hair.current = s.id; }
  select(s, true);
  gsap.fromTo(card, { scale: 0.96 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
});

$('#chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip'); if (!chip) return;
  $$('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  const cat = chip.dataset.cat;
  const visible = [];
  $$('.card').forEach((c) => {
    const s = STYLES.find((x) => x.id === c.dataset.id);
    const on = cat === 'all' || s.cat === cat;
    c.classList.toggle('is-hidden', !on);
    if (on) visible.push(c);
  });
  gsap.fromTo(visible, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.04 });
});

$('#swatches').addEventListener('click', (e) => {
  const sw = e.target.closest('.sw'); if (!sw) return;
  const c = COLORS.find((x) => x.id === sw.dataset.color);
  state.color = c;
  $$('.sw').forEach((x) => x.classList.toggle('is-active', x === sw));
  hair.setColor(c.hex, c.tip);
  $('#dColor').textContent = c.name;
});

// lueur qui suit la souris dans le panneau verre
const panel = $('#panel');
panel.addEventListener('pointermove', (e) => {
  const r = panel.getBoundingClientRect();
  panel.style.setProperty('--mx', `${e.clientX - r.left}px`);
  panel.style.setProperty('--my', `${e.clientY - r.top}px`);
  panel.style.setProperty('--glow', '1');
});
panel.addEventListener('pointerleave', () => panel.style.setProperty('--glow', '0'));

// réaliste / mannequin
function setLook(look, animate = true) {
  const seg = $('#lookSeg');
  $$('.seg__btn', seg).forEach((b) => b.classList.toggle('is-active', b.dataset.look === look));
  const btn = $(`.seg__btn[data-look="${look}"]`, seg);
  const pill = $('.seg__pill', seg);
  pill.style.width = `${btn.offsetWidth}px`;
  pill.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
  if (!state.scanned) return;
  if (animate) {
    gsap.timeline()
      .to(avatar.uniforms.uReveal, { value: 0.55, duration: 0.45, ease: 'power2.in' })
      .add(() => avatar.showRealistic(look === 'real'))
      .to(avatar.uniforms.uReveal, { value: 1, duration: 0.7, ease: 'power2.out' });
  } else avatar.showRealistic(look === 'real');
}
$('#lookSeg').addEventListener('click', (e) => { const b = e.target.closest('.seg__btn'); if (b) setLook(b.dataset.look); });

function setCompare(on) {
  state.compare = on;
  $('[data-action="compare"]').classList.toggle('is-on', on);
  if (on) { hair.hideAll(0.6); setBigTitle('Avant'); }
  else { hair.show(state.selected, 'grow'); setBigTitle(state.selected.name); }
}

// ---------- présentation cinématique ----------
function present() {
  if (state.presenting) return;
  const s = state.selected;
  stage.controls.enabled = false; stage.controls.autoRotate = false;
  $('[data-action="rotate"]').classList.remove('is-on');
  if (state.compare) setCompare(false);
  if (hair.current !== s.id) hair.show(s, 'drop');
  const pres = $('#present');
  pres.classList.add('is-on');
  $('#presentName').textContent = s.name;
  $('#presentK').textContent = `${String(STYLES.indexOf(s) + 1).padStart(2, '0')} — ${state.color.name}`;
  applyLayoutPresent();
  const R = fit(100);
  const keyStart = stage.lights.key.position.clone();
  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: () => stopPresent() });
  state.presenting = tl;
  tl.to('#studio', { autoAlpha: 0, duration: 0.6 }, 0)
    .to('.present__bar', { scaleY: 1, duration: 1, ease: 'expo.inOut' }, 0)
    .fromTo('.present__caption > *', { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, 0.6)
    .fromTo('#presentProg', { scaleX: 0 }, { scaleX: 1, duration: 13, ease: 'none' }, 0.4)
    .add(stage.orbitTo({ theta: 0.75, phi: 1.36, radius: R * 0.74, ty: 2, duration: 2.4 }), 0.2)
    .add(stage.orbitTo({ theta: 1.62, phi: 1.5, radius: R * 0.82, ty: 0, duration: 2.2 }), 2.6)
    .add(stage.orbitTo({ theta: 3.2, phi: 1.22, radius: R * 0.98, ty: 1, duration: 2.6 }), 4.8)
    .add(stage.orbitTo({ theta: 4.75, phi: 1.5, radius: R * 0.8, ty: -1, duration: 2.4 }), 7.4)
    .add(stage.orbitTo({ theta: 5.9, phi: 0.95, radius: R * 0.9, ty: 3, duration: 2.2 }), 9.8)
    .add(stage.orbitTo({ theta: Math.PI * 2, phi: 1.48, radius: R * 1.02, ty: 0, duration: 2, ease: 'expo.inOut' }), 12)
    .to(stage.lights.key.position, { x: 60, z: 40, duration: 6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.5)
    .to(stage.lights.rim, { intensity: 3.4, duration: 3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.5)
    .add(() => stage.lights.key.position.copy(keyStart), 14.2);
}
function applyLayoutPresent() { stage.shift(0, 0, 1.4); document.documentElement.style.setProperty('--ring-x', '0px'); }
function stopPresent() {
  const tl = state.presenting; if (!tl) return;
  state.presenting = null;
  tl.kill();
  gsap.killTweensOf(stage.lights.key.position); gsap.killTweensOf(stage.lights.rim);
  stage.lights.key.position.set(-55, 62, 56); stage.lights.rim.intensity = 2.2;
  gsap.to('.present__bar', { scaleY: 0, duration: 0.9, ease: 'expo.inOut' });
  gsap.to('.present__caption > *', { opacity: 0, duration: 0.4, onComplete: () => $('#present').classList.remove('is-on') });
  gsap.to('#studio', { autoAlpha: 1, duration: 0.8, delay: 0.3 });
  const L = applyLayout('studio');
  const sph = stage._spherical();
  const theta = Math.atan2(Math.sin(sph.theta), Math.cos(sph.theta));
  stage._setSpherical({ ...sph, theta });
  stage.orbitTo({ theta: 0.35, phi: 1.46, radius: L.r, ty: 0.5, duration: 1.4 }).eventCallback('onComplete', () => { stage.controls.enabled = true; });
}

// ---------- réservation ----------
function book() {
  const s = state.selected;
  $('#modalShot').src = stage.snapshot();
  $('#modalTitle').textContent = s.name;
  $('#modalMeta').textContent = `${s.duration} · ${s.price} FCFA · ${state.color.name}`;
  const m = $('#modal');
  m.classList.add('is-on');
  gsap.to('.modal__backdrop', { opacity: 1, duration: 0.5 });
  gsap.fromTo('.modal__card', { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'expo.out' });
}
function closeModal() {
  gsap.to('.modal__backdrop', { opacity: 0, duration: 0.4 });
  gsap.to('.modal__card', { opacity: 0, y: 20, duration: 0.4, onComplete: () => $('#modal').classList.remove('is-on') });
}

// ---------- actions ----------
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  if (el.tagName === 'A') e.preventDefault();
  switch (a) {
    case 'scan': enterScan(); break;
    case 'mannequin':
      stopScan();
      if (state.screen === 'site') await leaveSite();
      if (state.scanned) { avatar.setMannequin(); avatar.scan = null; state.scanned = false; renderThumbs(); }
      enterStudio(); break;
    case 'home':
      stopScan(); stopPresent();
      if (state.screen === 'studio') await leaveStudio();
      if (state.screen !== 'site') enterSite();
      break;
    case 'rotate': {
      const on = !stage.controls.autoRotate;
      stage.controls.autoRotate = on; el.classList.toggle('is-on', on); break;
    }
    case 'present': present(); break;
    case 'stop-present': stopPresent(); break;
    case 'compare': setCompare(!state.compare); break;
    case 'recenter': stage.controls.enabled = false; stage.orbitTo({ theta: 0.35, phi: 1.46, radius: layoutFor('studio').r, ty: 0.5, duration: 1.4 }).eventCallback('onComplete', () => { stage.controls.enabled = true; }); break;
    case 'book': book(); break;
    case 'close-modal': closeModal(); break;
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('#modal').classList.contains('is-on')) closeModal(); else stopPresent(); }
  if (state.screen !== 'studio' || state.presenting) return;
  const i = STYLES.indexOf(state.selected);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(STYLES[(i + 1) % STYLES.length]);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(STYLES[(i - 1 + STYLES.length) % STYLES.length]);
});

// le geste de rotation fait disparaître l'indice
$('#gl').addEventListener('pointerdown', () => {
  if (state.screen === 'studio') { $('#hintDrag').classList.add('is-gone'); setCursor('drag'); }
});
window.addEventListener('pointerup', () => setCursor(null));

// ---------- utilitaires ----------
function swapText(el, text) {
  gsap.to(el, { opacity: 0, y: -8, duration: 0.25, ease: 'power2.in', onComplete: () => { el.textContent = text; gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }); } });
}
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nextFrame() { return new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 60); }); }

initCursor();
initMagnetic();
boot();

// accès debug
window.__miroir = {
  stage, avatar, hair, state, STYLES, select, processCapture, site,
  view(id, theta = 0.5, phi = 1.4, radius = 95) {
    stage.controls.enabled = false; stage.shift(0, 0, 0.01);
    $$('.screen').forEach((s) => (s.style.opacity = 0));
    hair.show(STYLES.find((x) => x.id === id) || null, 'instant');
    stage.orbitTo({ theta, phi, radius, ty: 0, duration: 0.01 });
  },
};
