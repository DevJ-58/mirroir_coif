// Mannequin-photo : remplace le mannequin 3D partout (site, cabine, génération).
// Il suit la « caméra » de la scène 3D existante (décalage, distance, angle) : les chorégraphies
// du site et le glisser de la cabine continuent de fonctionner. L'angle fait tourner le mannequin :
// les deux vues voisines (face, trois-quarts, profil, dos) se fondent l'une dans l'autre avec une
// perspective qui accompagne le mouvement, au lieu de changer d'image d'un coup.
import gsap from 'gsap';
import { viewsOf, VIEW_LABEL } from './stage.js';
import { compose } from './compose.js';

// angle de chaque vue (radians) : positif = la caméra passe du côté gauche de la personne
// (on voit alors le visage tourné vers la gauche de l'image)
const ANGLE = { face: 0, 'q-left': 0.78, 'p-left': 1.57, back: Math.PI, 'p-right': -1.57, 'q-right': -0.78 };
const DEFAULT_HEX = '#15100d';
const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createPhotoAvatar({ stage, el, glEl, getClient }) {
  el.innerHTML = '<div class="pavatar__fig"></div>';
  const fig = el.firstElementChild;
  const before = document.createElement('canvas');
  before.className = 'pavatar__before';
  let split = 0, beforeKey = '';
  let style = null, views = null, layers = [], order = [], domIdx = -1, loading = 0;
  let color = null, tip = null;
  let reveal = 1;
  const cache = new Map();   // clé → canvas composé
  const listeners = new Set();

  const clientKey = () => { const c = getClient?.(); return c ? 'c' + (c.shots?.length || 0) + (c.skin ? c.skin.getHexString?.() : '') : 'm'; };
  const keyOf = (i) => `${style.id}|${i}|${clientKey()}|${color || ''}`;
  function composed(i) {
    const key = keyOf(i);
    if (!cache.has(key)) {
      if (cache.size > 30) cache.delete(cache.keys().next().value);
      cache.set(key, compose(views[i], getClient?.() || null, { cutout: true, ...(color ? { hair: color, tip } : {}) }));
    }
    return cache.get(key);
  }
  /** Met à jour l'image d'une vue si nécessaire (composition à la demande). */
  function ensure(i) {
    const L = layers[i], key = keyOf(i);
    if (L.dataset.key === key) return;
    const c = composed(i);
    L.width = c.width; L.height = c.height;
    L.getContext('2d').drawImage(c, 0, 0);
    L.dataset.key = key;
  }

  function build() {
    fig.innerHTML = '';
    // taille du visage de référence : celle de la première vue qui en a un
    const ref = views.find((V) => V.face);
    const refRy = ref ? ref.face.ry / ref.h : 0.23;
    layers = views.map((V) => {
      const c = document.createElement('canvas');
      c.className = 'pavatar__layer';
      // centre de la masse des cheveux : avec le centre du visage, il situe le crâne (axe de rotation)
      let sx = 0, sy = 0, n = 0;
      for (let p = 0; p < V.hair.length; p += 3) if (V.hair[p] > 0.6) { sx += p % V.w; sy += (p / V.w) | 0; n++; }
      const hx = n ? sx / n / V.w : 0.5, hy = n ? sy / n / V.h : 0.3;
      c.dataset.cx = V.face ? (V.face.cx / V.w + hx) / 2 : hx;
      c.dataset.cy = V.face ? V.face.cy / V.h : Math.min(0.6, hy + 0.12);
      c.dataset.ar = V.w / V.h;
      // même taille de visage d'une vue à l'autre
      c.dataset.k = V.face ? refRy / (V.face.ry / V.h) : 1;
      c.style.opacity = '0';
      fig.append(c);
      return c;
    });
    fig.append(before);
    // vues triées par angle, pour trouver les deux voisines de l'angle courant
    order = views.map((V, i) => ({ i, a: ANGLE[V.kind] ?? 0 })).sort((p, q) => p.a - q.a);
  }

  /** Les deux vues qui entourent l'angle a, et la progression entre elles. */
  function around(a) {
    if (order.length === 1) return { i: order[0].i, j: order[0].i, t: 0, span: 1 };
    for (let k = 0; k < order.length; k++) {
      const A = order[k], B = order[(k + 1) % order.length];
      let span = B.a - A.a; if (span <= 0) span += TAU;
      let d = a - A.a; while (d < 0) d += TAU; while (d >= TAU) d -= TAU;
      if (d <= span) return { i: A.i, j: B.i, t: d / span, span };
    }
    return { i: order[0].i, j: order[0].i, t: 0, span: 1 };
  }

  // suit la caméra à chaque image
  const _p = { x: 0, y: 0, z: 0 };
  let lastA = 0;
  stage.onTick(() => {
    const op = glEl.style.opacity === '' ? 1 : +glEl.style.opacity;
    el.style.opacity = String(style ? op : 0);
    if (!style || !layers.length) return;
    const cam = stage.camera.position, tg = stage.controls.target;
    _p.x = cam.x - tg.x; _p.z = cam.z - tg.z; _p.y = cam.y - tg.y;
    const dist = Math.hypot(_p.x, _p.y, _p.z) || 100;
    const a = wrap(Math.atan2(_p.x, _p.z) - stage.root.rotation.y);
    lastA = a;
    const W = window.innerWidth, H = window.innerHeight;
    // en portrait, la caméra recule beaucoup (format étroit) : on compense en partie
    const hgt = H * 0.74 * (100 / dist) * (W / H < 1.05 ? 1.35 : 1);
    const ax = W / 2 + stage.view.shiftX * W, ay = H * 0.47 + stage.view.shiftY * H - tg.y * 0.004 * H;
    fig.style.transform = `translate(${ax}px, ${ay}px) rotateX(${(stage.root.rotation.x * -20).toFixed(2)}deg)`;

    // fondu tournant : la vue de départ pivote et s'efface, la suivante arrive en pivotant
    const { i, j, t, span } = around(a);
    const s = smooth(0.36, 0.64, t);           // chaque vue tient l'essentiel du trajet, le passage est bref
    const turn = (span * 180) / Math.PI;       // amplitude de la rotation simulée
    const dom = s < 0.5 ? i : j;
    if (dom !== domIdx) { domIdx = dom; listeners.forEach((f) => f(views[dom].kind)); }
    layers.forEach((L, k) => {
      const w = k === i && k === j ? 1 : k === i ? 1 - s : k === j ? s : 0;
      if (w < 0.004) { if (L.style.opacity !== '0') L.style.opacity = '0'; return; }
      ensure(k);
      const ar = +L.dataset.ar, cx = +L.dataset.cx, cy = +L.dataset.cy, kh = hgt * +L.dataset.k;
      const wd = kh * ar;
      // angle propre à cette couche : 0 quand elle est pile en face de la caméra
      const own = k === i ? t : k === j ? t - 1 : 0;
      const rot = i === j ? 0 : -own * turn * 0.55;
      const shift = i === j ? 0 : -own * hgt * 0.06;
      L.style.width = `${wd}px`; L.style.height = `${kh}px`;
      L.style.transform = `translate(${-cx * wd + shift}px, ${-cy * kh}px) perspective(${(hgt * 2.2).toFixed(0)}px) rotateY(${rot.toFixed(2)}deg)`;
      L.style.opacity = w.toFixed(3);
      // flou de mouvement pendant le passage d'une vue à l'autre
      const mb = i === j ? 0 : Math.sin(Math.PI * s) * 5;
      L.style.filter = mb > 0.2 ? `blur(${mb.toFixed(1)}px)` : '';
      L.style.zIndex = k === dom ? 2 : 1;
      L.style.clipPath = reveal < 0.999 ? `inset(${((1 - reveal) * 100).toFixed(1)}% 0 0 0)` : '';
    });

    // comparateur : à gauche de la ligne, le mannequin sans le visage du client (vue dominante)
    if (split > 0.001) {
      const k = `${style.id}|${dom}|${color || ''}`;
      if (k !== beforeKey) {
        beforeKey = k;
        const c = compose(views[dom], null, { cutout: true, ...(color ? { hair: color, tip } : {}) });
        before.width = c.width; before.height = c.height; before.getContext('2d').drawImage(c, 0, 0);
      }
      const L = layers[dom], ar = +L.dataset.ar, cx = +L.dataset.cx, wd = hgt * +L.dataset.k * ar;
      const left = ax - cx * wd;
      const cut = Math.min(100, Math.max(0, ((split * W - left) / wd) * 100));
      before.style.display = 'block';
      before.style.width = L.style.width; before.style.height = L.style.height;
      before.style.transform = L.style.transform;
      before.style.clipPath = `inset(0 ${(100 - cut).toFixed(2)}% 0 0)`;
    } else before.style.display = 'none';
  });

  const api = {
    get current() { return style?.id || null; },
    /** Affiche une coiffure (fondu et léger flou d'arrivée). */
    async show(s) {
      if (!s) { api.hideAll(); return; }
      if (style?.id === s.id) return;
      const my = ++loading;
      const v = await viewsOf(s);
      if (my !== loading) return;
      style = s; views = v; domIdx = -1;
      build();
      gsap.fromTo(fig, { y: -18, filter: 'blur(10px)', opacity: 0 }, { y: 0, filter: 'blur(0px)', opacity: 1, duration: 0.8, ease: 'expo.out', clearProps: 'filter' });
      api.onChange?.(s.id);
    },
    hideAll() { loading++; style = null; views = null; layers = []; order = []; domIdx = -1; fig.innerHTML = ''; api.onChange?.(null); },
    setColor(hex, tipHex) { color = hex.toLowerCase() === DEFAULT_HEX ? null : hex; tip = tipHex; },
    /** Le visage ou le teint du client ont changé : recomposer. */
    refresh() { cache.clear(); layers.forEach((L) => delete L.dataset.key); },
    /** Effet de balayage (0 → 1 : l'image se découvre de bas en haut). */
    setReveal(v) { reveal = v; },
    /** Comparateur : position de la ligne (0 → 1 sur la largeur de l'écran), 0 = désactivé. */
    setSplit(x) { split = x; },
    get reveal() { return reveal; },
    get viewLabel() { return views?.[domIdx] ? VIEW_LABEL[views[domIdx].kind] : ''; },
    get views() { return views; },
    get angle() { return lastA; },
    onView(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Image composée de la coiffure (vue de face) pour les vignettes et favoris. */
    async snapshot(s, size = 280) {
      const vs = await viewsOf(s), V = vs[0];
      const c = compose(V, getClient?.() || null, { cutout: false, ...(color ? { hair: color, tip } : {}) });
      const out = document.createElement('canvas'); out.width = out.height = size;
      const f = V.face || { cx: V.w / 2, cy: V.h * 0.42, rx: V.w * 0.15, ry: V.h * 0.2 };
      const side = Math.min(V.w, V.h, f.ry * 4.4);
      const x = Math.max(0, Math.min(V.w - side, f.cx - side / 2)), y = Math.max(0, Math.min(V.h - side, f.cy - side * 0.48));
      out.getContext('2d').drawImage(c, x, y, side, side, 0, 0, size, size);
      return out.toDataURL('image/jpeg', 0.86);
    },
    onChange: null,
  };
  return api;
}
