import * as THREE from 'three';
import gsap from 'gsap';
import { Stage } from './three/stage.js';
import { Avatar } from './three/avatar.js';
import { STYLES, CATEGORIES, COLORS, loadCatalog } from './data/catalog.js';
import { createPhotoAvatar } from './photo/avatar.js';
import { runVideoScan, scanImages, loadLandmarker } from './scan/scanner.js';
import { buildFace } from './scan/face.js';
import { initCursor, initMagnetic, setCursor } from './ui/cursor.js';
import { createSite, curtain, prepDraw } from './site/site.js';
import { initExtras } from './studio/extras.js';
import { initPanel } from './studio/panel.js';
import { initDeposit } from './studio/deposit.js';
import { createRouter } from './site/router.js';
import { PAGES } from './pages/index.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isPortrait = () => window.innerWidth / window.innerHeight < 1 || window.innerWidth <= 980;
const fit = (r) => { const a = window.innerWidth / window.innerHeight; return a < 1.05 ? r * Math.min(1.75, 1.05 / a) : r; };

// ---------- catalogue (photos de mannequins coiffés) ----------
await loadCatalog();

// ---------- scène ----------
// La scène 3D ne se dessine plus : elle sert de « caméra » (cadrage, angle, glisser)
// au mannequin-photo, qui affiche la vue correspondant à l'angle.
const stage = new Stage($('#gl'));
stage.paused = true;
const avatar = new Avatar();   // ne sert plus qu'à porter le résultat du scan (teint, réaliste / mannequin)
stage.root.add(avatar.group);
const photoClient = () => (state.scanned && avatar.realistic && state.faceShots ? { shots: state.faceShots, skin: avatar.scan?.skin } : null);
const hair = createPhotoAvatar({ stage, el: $('#pavatar'), glEl: $('#gl'), getClient: () => photoClient() });

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
const site = createSite({ stage, avatar, hair, STYLES, COLORS, mouse, onTry: (id) => tryStyle(id) });
window.__garoLenis = site.lenis;
const router = createRouter({ site, pages: PAGES, ctx: { hair, STYLES, CATEGORIES, COLORS, stage, avatar, onTry: (id) => tryStyle(id), beforeRoute: () => site.closeMenu(), thumbs: null, publish: (f) => deposit.publish(f), publishPhoto: (f) => deposit.publishPhoto(f), client: () => (state.scanned && state.faceShots ? { shots: state.faceShots, skin: avatar.scan?.skin } : null), toast: (t) => toast(t) } });
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
  $$('.screen').forEach((s) => {
    s.classList.toggle('is-on', s.id === name);
    // un écran quitté ne garde aucune visibilité forcée par une animation (ex. présentation)
    if (s.id !== name) { gsap.killTweensOf(s); s.style.visibility = ''; s.style.opacity = ''; }
  });
  document.body.classList.toggle('app-mode', name !== 'site' && name !== 'loader');
  $('#stepLabel').textContent = STEP_LABEL[name] || '';
  return prev;
}

function layoutFor(name) {
  const p = isPortrait();
  if (name === 'intro') return p ? { x: 0, y: -0.11, r: fit(132) } : { x: 0.16, y: 0, r: 112 };
  if (name === 'scan') return p ? { x: 0, y: 0, r: fit(150) } : { x: -0.2, y: 0, r: 150 };
  if (name === 'generate') return { x: 0, y: 0, r: fit(98) };
  if (name === 'studio') return p ? { x: 0, y: -0.1, r: fit(142) * 1.1 } : { x: -0.035, y: 0, r: 116 };
  return { x: 0, y: 0, r: 110 };
}
function applyLayout(name, d = 1.6) {
  const L = layoutFor(name);
  // la distance de la caméra en portrait dépasse la limite du zoom : on l'élargit
  stage.controls.maxDistance = Math.max(150, L.r * 1.25);
  stage.controls.minDistance = Math.min(48, L.r * 0.5);
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
// Seules les coiffures de l'accueil sont construites avant l'ouverture ;
// les autres se construisent ensuite en arrière-plan, une par une.
async function boot() {
  // le logo se dessine trait par trait pendant le chargement
  const strokes = prepDraw($('.loader__logo'));
  gsap.to(strokes, { strokeDashoffset: 0, duration: 1.6, ease: 'power3.inOut', stagger: 0.07 });
  gsap.to('.loader__tag', { opacity: 1, duration: 1, delay: 1.2 });
  const bar = $('#loadBar'), pct = $('#loadPct'), txt = $('#loadText');
  const setP = (p, label) => { gsap.to(bar, { scaleX: p, duration: 0.5, ease: 'power2.out' }); pct.textContent = `${Math.round(p * 100)}%`; if (label) txt.textContent = label; };
  const q = new URLSearchParams(location.search);
  const qs = STYLES.find((s) => s.id === q.get('style'));
  if (qs) state.selected = qs;
  const deposited = await deposit.restore().catch(() => 0);
  if (deposited) { buildPanel(); panelCtl.refresh(); }
  const qs2 = STYLES.find((s) => s.id === q.get('style'));
  if (qs2) state.selected = qs2;
  await nextFrame();
  setP(0.15, 'Sculpture du mannequin');
  await wait(250);
  const first = STYLES.slice(0, 3);
  const { viewsOf } = await import('./photo/stage.js');
  for (let i = 0; i < first.length; i++) {
    setP(0.25 + (i / first.length) * 0.5, `Coiffure · ${first[i].name}`);
    await viewsOf(first[i]).catch(() => {});
  }
  setP(0.9, 'Lumières du studio');
  await nextFrame();
  setP(1, 'Studio prêt');
  await wait(380);

  gsap.to('.loader__brand, .loader__tag', { y: -30, opacity: 0, duration: 0.8, ease: 'expo.in', stagger: 0.05 });
  gsap.to('#loader', { autoAlpha: 0, duration: 0.9, delay: 0.6, ease: 'power2.inOut', onComplete: () => $('#loader').remove() });
  await wait(700);
  document.body.classList.remove('is-loading');
  if (q.has('studio')) { document.body.classList.add('app-mode'); enterStudio(); } else enterSite(true);
  backgroundBuild();
}

async function backgroundBuild() {
  await wait(1200);
  loadLandmarker().catch(() => {}); // préchargement silencieux du scanner
  await idle();
  await renderThumbs();
}
function idle() {
  return new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 120)));
}

// ---------- site vitrine ----------
function enterSite(first = false) {
  show('site');
  state.idle = false;
  if (first) { router.start(); site.intro(); } else site.enter();
}
function leaveSite() { site.leave(); }

/** Ouvre le studio directement sur un style (depuis la collection du site). */
function tryStyle(id) {
  const s = STYLES.find((x) => x.id === id); if (!s) return;
  curtain(async () => {
    site.leave();
    state.selected = s;
    enterStudio();
  });
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
  if (state.screen === 'site') leaveSite();
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
      onShot: (i) => { const d = $$('#scanSteps i')[i]; if (d) gsap.fromTo(d, { scaleY: 3 }, { scaleY: 1, duration: 0.6, ease: 'expo.out' }); },
    }, ac.signal);
    if (ac.signal.aborted) return;
    await processCapture(result);
  } catch (err) {
    if (err?.name === 'AbortError' || ac.signal.aborted) return;
    console.warn(err);
    $('#scanIdle').style.display = 'none';
    swapText($('#scanTitle'), 'Caméra indisponible');
    $('#scanHint').textContent = 'Autorisez la caméra dans le navigateur, ou importez une photo de face (et, si vous voulez, deux trois-quarts).';
  }
}
function stopScan() { state.scanAbort?.abort(); state.scanAbort = null; const v = $('#video'); v.srcObject?.getTracks?.().forEach((t) => t.stop()); v.srcObject = null; }

$('#photoInput').addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])].slice(0, 3); e.target.value = '';
  if (!files.length) return;
  stopScan();
  $('#scanIdle').style.display = '';
  $('#scanIdle span').textContent = files.length > 1 ? `Analyse des ${files.length} photos…` : 'Analyse de la photo…';
  try {
    const imgs = [];
    for (const f of files) { const img = new Image(); img.src = URL.createObjectURL(f); await img.decode().catch(() => {}); imgs.push(img); }
    const shots = await scanImages(imgs);
    setRing(1);
    await processCapture(shots);
  } catch (err) {
    console.warn(err);
    $('#scanIdle').style.display = 'none';
    swapText($('#scanTitle'), 'Visage introuvable');
    $('#scanHint').textContent = 'Essayez des photos nettes, visage et cheveux dégagés, bien éclairées.';
  }
});

// ---------- génération de l'avatar ----------
async function processCapture(shots) {
  if (!Array.isArray(shots)) shots = [shots];
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

  // 1→3. le visage scanné (relief + photo) est posé sur le mannequin
  const setStep = (i) => {
    items.forEach((l, k) => l.classList.toggle('on', k <= i));
    pctTween([12, 35, 62, 82][i] ?? 90, 0.8);
  };
  setStep(0);
  await wait(200);
  const scan = await buildFace(shots, setStep);
  avatar.setScan(scan);
  state.scanned = true;
  state.faceShots = shots;
  hair.refresh();
  hair.setReveal(0);
  await hair.show(state.selected);
  pctTween(88, 1.2);
  const rv = { v: 0 };
  gsap.to(rv, { v: 1, duration: 2.2, ease: 'power2.inOut', onUpdate: () => hair.setReveal(rv.v) });
  await wait(2300);

  // 4. vignettes
  items[3].classList.add('on'); pctTween(100, 0.8);
  await nextFrame();
  await renderThumbs();
  await wait(700);
  enterStudio();
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

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-on'), 2400);
}

const panelCtl = initPanel({ STYLES });
const preview = (st) => hair.show(st);
const deposit = initDeposit({
  STYLES, CATEGORIES, hair, state, toast,
  select: (s, force) => select(s, force),
  async refreshCollection() { buildPanel(); panelCtl.refresh(); await renderThumbs(); },
  openAtelier: () => curtain(async () => { stopPresent(); extras.setCompare(false); enterSite(); await wait(50); router.go('/artiste'); }),
});
const extras = initExtras({ stage, hair, state, STYLES, avatar, select: (s, f) => select(s, f), toast, onReset: () => resetSession() });

/** Fin de séance (mode borne) : on efface le scan et on revient au début du site. */
function resetSession() {
  if ($('#modal').classList.contains('is-on')) closeModal();
  stopPresent();
  extras.setCompare(false);
  extras.clearFavs();
  stopScan();
  if (state.scanned) { avatar.setMannequin(); state.scanned = false; state.faceShots = null; hair.refresh(); renderThumbs(); }
  state.selected = STYLES[0];
  curtain(async () => {
    stage.controls.enabled = false; stage.controls.autoRotate = false;
    $('[data-action="rotate"]').classList.remove('is-on');
    site.lenis.scrollTo(0, { immediate: true, force: true });
    enterSite();
  });
}

// Vignettes : la vue de face de chaque coiffure, avec le visage du client s'il est scanné.
async function renderThumbs() {
  const thumbs = {};
  for (const st of STYLES) {
    try { thumbs[st.id] = await hair.snapshot(st); } catch (e) { console.warn(e); continue; }
    const img = $(`.card[data-id="${st.id}"] img`);
    if (img) { img.src = thumbs[st.id]; img.classList.add('ready'); img.previousElementSibling?.remove(); }
    await nextFrame();
  }
  site.setThumbs(thumbs);
  router.setThumbs(thumbs);
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

  gsap.fromTo('.panel__head > *, .chips, .pager, .panel__foot', { opacity: 0, y: 20, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.25, clearProps: 'filter' });
  setTimeout(() => panelCtl.intro(), 380);
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
  extras.onSelect();
  panelCtl.reveal(style.id);
  preview(style);
  setBigTitle(style.name);
  if (changed || force) updateDetails(style);
  deposit.onSelect(style);
}

function updateDetails(s) {
  const i = STYLES.indexOf(s);
  $('#dIndex').textContent = String(i + 1).padStart(2, '0');
  const nameEl = $('#dName');
  nameEl.innerHTML = s.name.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.fromTo($$('.w', nameEl), { yPercent: 105 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.06 });
  swapText($('#dDesc'), s.desc);
  $('#dDur').textContent = s.duration;
  $('#dAdapt').hidden = true;
  $('#dPrice').textContent = s.price;
}

// survol = aperçu instantané sur l'avatar (le style « glisse » sur la tête)
let hoverTimer = null;
cardsEl.addEventListener('pointerover', (e) => {
  const card = e.target.closest('.card'); if (!card || e.pointerType === 'touch') return;
  clearTimeout(hoverTimer);
  const s = STYLES.find((x) => x.id === card.dataset.id);
  if (state.presenting) return;
  if (hair.current !== s.id) { preview(s); setBigTitle(s.name); }
});
cardsEl.addEventListener('pointerleave', () => {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (state.presenting) return;
    if (hair.current !== state.selected.id) { preview(state.selected); setBigTitle(state.selected.name); }
  }, 280);
});
cardsEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card'); if (!card) return;
  const s = STYLES.find((x) => x.id === card.dataset.id);
  const wasPreview = hair.current === s.id;
  state.selected = null;
  if (wasPreview) { hair.current = s.id; }
  select(s, true);
  gsap.fromTo(card.querySelector('.card__img'), { scale: 0.92 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.5)' });
});

$('#swatches').addEventListener('click', (e) => {
  const sw = e.target.closest('.sw'); if (!sw) return;
  const c = COLORS.find((x) => x.id === sw.dataset.color);
  state.color = c;
  $$('.sw').forEach((x) => x.classList.toggle('is-active', x === sw));
  hair.setColor(c.hex, c.tip);
  $('#dColor').textContent = c.name;
});

// réaliste / mannequin
function setLook(look, animate = true) {
  const seg = $('#lookSeg');
  $$('.seg__btn', seg).forEach((b) => b.classList.toggle('is-active', b.dataset.look === look));
  const btn = $(`.seg__btn[data-look="${look}"]`, seg);
  const pill = $('.seg__pill', seg);
  pill.style.width = `${btn.offsetWidth}px`;
  pill.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
  if (!state.scanned) return;
  setTimeout(() => hair.refresh(), animate ? 450 : 0);
  if (animate) {
    gsap.timeline()
      .to(avatar.uniforms.uReveal, { value: 0.55, duration: 0.45, ease: 'power2.in' })
      .add(() => avatar.showRealistic(look === 'real'))
      .to(avatar.uniforms.uReveal, { value: 1, duration: 0.7, ease: 'power2.out' });
  } else avatar.showRealistic(look === 'real');
}
$('#lookSeg').addEventListener('click', (e) => { const b = e.target.closest('.seg__btn'); if (b) setLook(b.dataset.look); });

function setCompare(on) { extras.setCompare(on); }

// ---------- présentation cinématique ----------
function present() {
  if (state.presenting) return;
  const s = state.selected;
  stage.controls.enabled = false; stage.controls.autoRotate = false;
  $('[data-action="rotate"]').classList.remove('is-on');
  if (state.compare) setCompare(false);
  if (hair.current !== s.id) preview(s);
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
  gsap.set('#studio', { clearProps: 'visibility' });
  gsap.to('#studio', { opacity: 1, duration: 0.8, delay: 0.3, clearProps: 'opacity' });
  const L = applyLayout('studio');
  const sph = stage._spherical();
  const theta = Math.atan2(Math.sin(sph.theta), Math.cos(sph.theta));
  stage._setSpherical({ ...sph, theta });
  stage.orbitTo({ theta: 0.35, phi: 1.46, radius: L.r, ty: 0.5, duration: 1.4 }).eventCallback('onComplete', () => { stage.controls.enabled = true; });
}

// ---------- réservation ----------
/** Fiche image : rendu 3D sur fond sombre + nom du style, prête à enregistrer. */
function composeShot(url, s) {
  const src = stage.renderer.domElement;
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(c.width * 0.5, c.height * 0.42, 0, c.width * 0.5, c.height * 0.42, c.width * 0.7);
  grad.addColorStop(0, '#2a211b'); grad.addColorStop(1, '#0b0908');
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0);
  const k = c.height / 900;
  g.fillStyle = '#f4ede3';
  g.font = `${Math.round(64 * k)}px "Bodoni Moda", serif`;
  g.fillText(s.name, 48 * k, c.height - 84 * k);
  g.fillStyle = '#e9cf9f';
  g.font = `${Math.round(16 * k)}px "Inter Tight", sans-serif`;
  g.fillText(`GARO · ${s.duration} · ${s.price} FCFA · ${state.color.name}`.toUpperCase(), 50 * k, c.height - 46 * k);
  void url;
  return c.toDataURL('image/png');
}
function book() {
  const s = state.selected;
  const raw = stage.snapshot();
  const shot = composeShot(raw, s);
  $('#modalShot').src = raw;
  $('#saveShot').href = shot;
  $('#saveShot').download = `garo-${s.id}.png`;
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
    case 'scan':
      if (state.screen === 'site') curtain(async () => { enterScan(); await wait(60); });
      else enterScan();
      break;
    case 'mannequin': {
      const go = () => {
        stopScan();
        if (state.screen === 'site') leaveSite();
        if (state.scanned) { avatar.setMannequin(); state.scanned = false; state.faceShots = null; hair.refresh(); renderThumbs(); }
        enterStudio();
      };
      if (state.screen === 'site') curtain(async () => go()); else go();
      break;
    }
    case 'home':
      if (state.screen === 'site') break;
      curtain(async () => {
        stopScan(); stopPresent();
        stage.controls.enabled = false; stage.controls.autoRotate = false;
        $('[data-action="rotate"]').classList.remove('is-on');
        enterSite();
      });
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

// ---------- thème clair / sombre ----------
function setTheme(t, save = true) {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  root.dataset.theme = t;
  $('meta[name="theme-color"]').setAttribute('content', t === 'light' ? '#EFE8DE' : '#0B0908');
  if (save) { try { localStorage.setItem('garo-theme', t); } catch (e) { /* stockage indisponible */ } }
  setTimeout(() => root.classList.remove('theme-switching'), 700);
}
setTheme(document.documentElement.dataset.theme || 'dark', false);
$('#themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
// sans choix enregistré, on suit le réglage du système
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  let saved = null;
  try { saved = localStorage.getItem('garo-theme'); } catch (err) { /* ignoré */ }
  if (!saved) setTheme(e.matches ? 'light' : 'dark', false);
});

initCursor();
initMagnetic();
boot();

// accès debug
window.__miroir = {
  stage, avatar, hair, state, STYLES, select, processCapture, site, buildFace, router,
  /** Kit artiste : le mannequin en .glb (base64), pour scratch/export-mannequin. */
  async exportMannequin() {
    const { exportMannequinGlb } = await import('./three/exportMannequin.js');
    const buf = new Uint8Array(await exportMannequinGlb(avatar));
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  },
  view(id, theta = 0.5, phi = 1.4, radius = 95) {
    stage.controls.enabled = false; stage.shift(0, 0, 0.01);
    $$('.screen').forEach((s) => (s.style.opacity = 0));
    hair.show(STYLES.find((x) => x.id === id) || null, 'instant');
    stage.orbitTo({ theta, phi, radius, ty: 0, duration: 0.01 });
  },
};
