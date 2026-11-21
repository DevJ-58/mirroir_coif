// Mannequin-photo : remplace le mannequin 3D partout (site, cabine, génération).
// Il suit la « caméra » de la scène 3D existante (décalage, distance, angle) : les chorégraphies
// du site et le glisser de la cabine continuent de fonctionner, et l'angle choisit la vue
// (face, trois-quarts, profil, dos). Même interface que l'ancien gestionnaire de coiffures.
import gsap from 'gsap';
import { viewsOf, VIEW_LABEL } from './stage.js';
import { compose } from './compose.js';

// angle de chaque vue (radians) : positif = la caméra passe du côté gauche de la personne
// (on voit alors le visage tourné vers la gauche de l'image)
const ANGLE = { face: 0, 'q-left': 0.78, 'p-left': 1.57, back: Math.PI, 'p-right': -1.57, 'q-right': -0.78 };
const DEFAULT_HEX = '#15100d';
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createPhotoAvatar({ stage, el, glEl, getClient }) {
  el.innerHTML = '<div class="pavatar__fig"><canvas></canvas><canvas></canvas><canvas class="pavatar__before"></canvas></div>';
  const fig = el.firstElementChild;
  const [cA, cB, before] = fig.querySelectorAll('canvas');
  let split = 0, beforeKey = '';
  let front = cA, back = cB;
  let style = null, views = null, viewIdx = -1, shownKey = '', loading = 0;
  let color = null, tip = null;
  let reveal = 1;
  const cache = new Map();   // clé → canvas composé
  const listeners = new Set();

  const clientKey = () => { const c = getClient?.(); return c ? 'c' + (c.shots?.length || 0) + (c.skin ? c.skin.getHexString?.() : '') : 'm'; };
  function composed(V, i) {
    const key = `${style.id}|${i}|${clientKey()}|${color || ''}`;
    if (!cache.has(key)) {
      if (cache.size > 24) cache.delete(cache.keys().next().value);
      cache.set(key, compose(V, getClient?.() || null, { cutout: true, ...(color ? { hair: color, tip } : {}) }));
    }
    return { canvas: cache.get(key), key };
  }

  function paint(i, instant = false) {
    if (!views?.[i]) return;
    const V = views[i];
    const { canvas, key } = composed(V, i);
    if (key === shownKey) return;
    shownKey = key;
    back.width = canvas.width; back.height = canvas.height;
    back.getContext('2d').drawImage(canvas, 0, 0);
    // centre de la tête de cette vue : il reste au même endroit d'une vue à l'autre
    const cy = V.face ? V.face.cy / V.h : 0.4;
    back.dataset.cy = cy; back.dataset.ar = V.w / V.h;
    gsap.killTweensOf([front, back]);
    gsap.set(back, { zIndex: 2 }); gsap.set(front, { zIndex: 1 });
    if (instant) { gsap.set(back, { opacity: 1 }); gsap.set(front, { opacity: 0 }); }
    else { gsap.fromTo(back, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }); gsap.to(front, { opacity: 0, duration: 0.5, delay: 0.1 }); }
    [front, back] = [back, front];
    listeners.forEach((f) => f(V.kind));
  }

  function chooseView(a) {
    if (!views) return -1;
    let best = 0, bd = Infinity;
    views.forEach((V, i) => {
      const d = Math.abs(wrap(a - (ANGLE[V.kind] ?? 0)));
      // légère hystérésis : la vue affichée reste tant qu'elle n'est pas nettement dépassée
      const dd = i === viewIdx ? d - 0.12 : d;
      if (dd < bd) { bd = dd; best = i; }
    });
    return best;
  }

  // suit la caméra à chaque image
  const _p = { x: 0, y: 0, z: 0 };
  let lastA = 0;
  stage.onTick(() => {
    const op = glEl.style.opacity === '' ? 1 : +glEl.style.opacity;
    el.style.opacity = String(style ? op : 0);
    if (!style) return;
    const cam = stage.camera.position, tg = stage.controls.target;
    _p.x = cam.x - tg.x; _p.z = cam.z - tg.z; _p.y = cam.y - tg.y;
    const dist = Math.hypot(_p.x, _p.y, _p.z) || 100;
    const a = wrap(Math.atan2(_p.x, _p.z) - stage.root.rotation.y);
    lastA = a;
    const i = chooseView(a);
    if (i >= 0 && i !== viewIdx) { viewIdx = i; paint(i); }
    // cadrage : distance → taille, décalage de la vue → position, reste de l'angle → légère rotation
    const W = window.innerWidth, H = window.innerHeight;
    const ar = +front.dataset.ar || 0.8, cy = +front.dataset.cy || 0.42;
    // en portrait, la caméra recule beaucoup (format étroit) : on compense en partie
    const hgt = H * 0.74 * (100 / dist) * (W / H < 1.05 ? 1.35 : 1);
    const wdt = hgt * ar;
    const resid = views?.[viewIdx] ? wrap(a - (ANGLE[views[viewIdx].kind] ?? 0)) : 0;
    const ty = (tg.y - 0) * -0.004 * H;
    fig.style.width = `${wdt}px`; fig.style.height = `${hgt}px`;
    fig.style.transform = `translate(${W / 2 - wdt / 2 + stage.view.shiftX * W}px, ${H * 0.47 - hgt * cy + stage.view.shiftY * H + ty}px) perspective(1400px) rotateY(${(-resid * 22).toFixed(2)}deg) rotateX(${(stage.root.rotation.x * -20).toFixed(2)}deg)`;
    fig.style.clipPath = reveal < 0.999 ? `inset(${((1 - reveal) * 100).toFixed(1)}% 0 0 0)` : '';
    // comparateur : à gauche de la ligne, le mannequin sans le visage du client
    if (split > 0.001 && views?.[viewIdx]) {
      const k = `${style.id}|${viewIdx}|${color || ''}`;
      if (k !== beforeKey) {
        beforeKey = k;
        const c = compose(views[viewIdx], null, { cutout: true, ...(color ? { hair: color, tip } : {}) });
        before.width = c.width; before.height = c.height; before.getContext('2d').drawImage(c, 0, 0);
      }
      const left = W / 2 - wdt / 2 + stage.view.shiftX * W;
      const cut = Math.min(100, Math.max(0, ((split * W - left) / wdt) * 100));
      before.style.display = 'block';
      before.style.clipPath = `inset(0 ${(100 - cut).toFixed(2)}% 0 0)`;
    } else before.style.display = 'none';
  });

  const api = {
    get current() { return style?.id || null; },
    /** Affiche une coiffure (le mode d'apparition est ignoré : fondu). */
    async show(s) {
      if (!s) { api.hideAll(); return; }
      if (style?.id === s.id) return;
      const my = ++loading;
      const v = await viewsOf(s);
      if (my !== loading) return;
      const first = !style;
      style = s; views = v; viewIdx = chooseView(lastA); shownKey = '';
      paint(Math.max(0, viewIdx), first);
      gsap.fromTo(fig, { y: -18, filter: 'blur(10px)' }, { y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', clearProps: 'filter' });
      api.onChange?.(s.id);
    },
    hideAll() { loading++; style = null; views = null; viewIdx = -1; shownKey = ''; api.onChange?.(null); },
    setColor(hex, tipHex) { color = hex.toLowerCase() === DEFAULT_HEX ? null : hex; tip = tipHex; if (style) { shownKey = ''; paint(viewIdx); } },
    /** Le visage ou le teint du client ont changé : recomposer. */
    refresh() { cache.clear(); shownKey = ''; if (style) paint(viewIdx); },
    /** Effet de balayage (0 → 1 : l'image se découvre de bas en haut). */
    setReveal(v) { reveal = v; },
    /** Comparateur : position de la ligne (0 → 1 sur la largeur de l'écran), 0 = désactivé. */
    setSplit(x) { split = x; },
    get reveal() { return reveal; },
    get viewLabel() { return views?.[viewIdx] ? VIEW_LABEL[views[viewIdx].kind] : ''; },
    get views() { return views; },
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
