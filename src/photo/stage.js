// Scène photo de la cabine : affiche une coiffure-photo (une ou plusieurs vues du mannequin),
// avec le visage et le teint du client, la teinte de cheveux choisie, et le passage d'une vue à l'autre.
import gsap from 'gsap';
import { loadImage, analyseView, compose } from './compose.js';

const $ = (s, r = document) => r.querySelector(s);
export const VIEW_LABEL = { face: 'Face', 'q-left': 'Trois-quarts', 'q-right': 'Trois-quarts', 'p-left': 'Profil', 'p-right': 'Profil', back: 'Dos' };

const cache = new Map();   // id de style → Promise<vues analysées>
/** Vues analysées d'une coiffure-photo (photo, masques, ovale du visage en pixels). */
export function viewsOf(style) {
  if (!cache.has(style.id)) {
    cache.set(style.id, Promise.all(style.views.map(async (v) => {
      const img = await loadImage(v.data, v.mime);
      const V = await analyseView(img);
      V.kind = v.kind;
      V.face = v.face ? { cx: v.face.cx * V.w, cy: v.face.cy * V.h, rx: v.face.rx * V.w, ry: v.face.ry * V.h, a: v.face.a || 0 } : null;
      return V;
    })));
  }
  return cache.get(style.id);
}
export function forgetViews(id) { cache.delete(id); }

/** Vignette carrée d'une coiffure-photo (première vue, recadrée sur la tête). */
export async function photoThumb(style, size = 280) {
  const [V] = await viewsOf(style);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const src = compose(V, null, { cutout: true });
  // cadrage : autour de l'ovale du visage s'il existe
  const f = V.face || { cx: V.w / 2, cy: V.h * 0.38, rx: V.w * 0.15, ry: V.h * 0.2 };
  const side = Math.min(V.w, V.h, f.ry * 4.4);
  const x = Math.max(0, Math.min(V.w - side, f.cx - side / 2)), y = Math.max(0, Math.min(V.h - side, f.cy - side * 0.45));
  g.drawImage(src, x, y, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.86);
}

export function createPhotoStage(host) {
  host.innerHTML = `
    <div class="pstage__frame"><canvas class="pstage__cv"></canvas><canvas class="pstage__cv pstage__cv--next"></canvas></div>
    <div class="pstage__nav">
      <button class="pstage__btn" data-pv="-1" aria-label="Vue précédente"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <span class="pstage__label"></span>
      <button class="pstage__btn" data-pv="1" aria-label="Vue suivante"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
    </div>
    <div class="pstage__dots"></div>`;
  const [cvA, cvB] = host.querySelectorAll('canvas');
  let front = cvA, back = cvB;
  let style = null, views = null, idx = 0, client = null, color = null, tip = null, token = 0, on = false;

  async function draw(animDir = 0) {
    if (!style) return;
    const my = ++token;
    if (!views) {
      host.classList.add('is-loading');
      views = await viewsOf(style);
      if (my !== token) return;
      host.classList.remove('is-loading');
    }
    const V = views[idx];
    compose(V, client, { cutout: true, ...(color ? { hair: color, tip } : {}) }, back);
    // la nouvelle image arrive par-dessus (glissé + fondu), puis les toiles échangent leur rôle
    gsap.killTweensOf([front, back]);
    gsap.set(back, { zIndex: 2, opacity: 0, xPercent: 8 * animDir, filter: animDir ? 'blur(8px)' : 'blur(0px)' });
    gsap.set(front, { zIndex: 1 });
    gsap.to(back, { opacity: 1, xPercent: 0, filter: 'blur(0px)', duration: animDir ? 0.7 : 0.45, ease: 'expo.out' });
    if (animDir) gsap.to(front, { xPercent: -6 * animDir, opacity: 0, duration: 0.5, ease: 'power2.in' });
    [front, back] = [back, front];
    $('.pstage__label', host).textContent = `${VIEW_LABEL[V.kind] || 'Vue'} · ${idx + 1}/${views.length}`;
    host.querySelectorAll('.pstage__dots i').forEach((d, k) => d.classList.toggle('is-on', k === idx));
    host.classList.toggle('is-single', views.length < 2);
  }

  function go(d) {
    if (!views || views.length < 2) return;
    idx = (idx + d + views.length) % views.length;
    draw(d);
  }
  host.addEventListener('click', (e) => { const b = e.target.closest('[data-pv]'); if (b) go(+b.dataset.pv); const dot = e.target.closest('.pstage__dots i'); if (dot) { const k = +dot.dataset.i; if (k !== idx) { const d = k > idx ? 1 : -1; idx = k; draw(d); } } });
  // glisser horizontalement : on tourne autour de la tête, vue par vue
  let sx = null;
  host.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; sx = e.clientX; });
  window.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); });
  window.addEventListener('keydown', (e) => { if (!on) return; if (e.key === 'PageDown') go(1); if (e.key === 'PageUp') go(-1); });

  return {
    get active() { return on; },
    async show(s) {
      const fresh = style?.id !== s.id;
      style = s;
      if (fresh) {
        views = null; idx = 0;
        host.querySelector('.pstage__dots').innerHTML = s.views.map((_, k) => `<i data-i="${k}"></i>`).join('');
      }
      if (!on) { on = true; host.classList.add('is-on'); gsap.fromTo(host, { opacity: 0 }, { opacity: 1, duration: 0.6 }); }
      await draw(fresh ? 0 : 0);
    },
    hide() {
      if (!on) return;
      on = false; style = null; views = null; token++;
      gsap.to(host, { opacity: 0, duration: 0.35, onComplete: () => host.classList.remove('is-on') });
    },
    /** client : { shots, skin } (scan) ou null (mannequin seul). */
    setClient(c) { client = c; if (on) draw(0); },
    setColor(hex, tipHex, isDefault) { color = isDefault ? null : hex; tip = tipHex; if (on) draw(0); },
    next() { go(1); },
  };
}
