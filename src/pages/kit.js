// Outils communs aux pages : titres découpés, révélations au défilement, pied de page « page suivante ».
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitChars } from '../site/site.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const pad2 = (n) => String(n).padStart(2, '0');
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (k) => k * k * (3 - 2 * k);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Mélange de deux poses (clés x, y, theta, phi, r, ty, sway). */
export function mix(a, b, t) {
  const o = {};
  for (const k of ['x', 'y', 'theta', 'phi', 'r', 'ty', 'sway']) o[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  return o;
}
/** Pose par défaut, complétée. */
export const P = (o) => ({ x: 0, y: 0, theta: 0, phi: 1.5, r: 110, ty: 0, sway: 0.4, ...o });

// ---------- gabarits ----------
export function eyebrow(text) { return `<p class="eyebrow"><span class="eyebrow__line"></span>${text}</p>`; }

/** En-tête de page : petit sur-titre, grand titre en caractères, chapeau. */
export function pageHero({ kicker, title, lede, side = 'left', meta = '' }) {
  return `<header class="pg-hero pg-hero--${side}">
    <div class="pg-hero__in">
      ${eyebrow(kicker)}
      <h1 class="pg-title">${title.split('|').map((l, i) => `<span class="pg-title__l pg-title__l--${i}" data-chars>${l}</span>`).join('')}</h1>
      ${lede ? `<p class="pg-lede" data-fade>${lede}</p>` : ''}
    </div>
    ${meta ? `<div class="pg-hero__meta" data-fade>${meta}</div>` : ''}
    <div class="pg-scroll" data-fade><i></i><span>Défiler</span></div>
  </header>`;
}

/** Pied de page commun : grand lien vers la page suivante + colonnes. */
export function pageFoot(next) {
  return `<footer class="pg-foot">
    ${next ? `<a class="pg-next" href="${next.path}" data-link data-cursor="Ouvrir">
      <span class="k">Page suivante</span>
      <span class="pg-next__t" data-chars>${next.label}</span>
      <span class="pg-next__d">${next.desc || ''}</span>
      <span class="pg-next__arrow">→</span>
    </a>` : ''}
    <div class="pg-foot__cols">
      <div><span class="k">Découvrir</span><a href="/collection" data-link>Lookbook</a><a href="/heritage" data-link>Héritage</a><a href="/technologie" data-link>Technologie</a><a href="/journal" data-link>Journal</a></div>
      <div><span class="k">Salons</span><a href="/salons" data-link>Offre salons</a><a href="/partenaires" data-link>Salons partenaires</a><a href="/faq" data-link>Questions fréquentes</a></div>
      <div><span class="k">GARO</span><a href="/a-propos" data-link>Allons se garo</a><a href="/contact" data-link>Contact</a><a href="/" data-link>Accueil</a></div>
      <div><span class="k">©</span><span>2026 GARO · Abidjan</span><button class="pg-top" data-top>Haut de page ↑</button></div>
    </div>
  </footer>`;
}

// ---------- animations ----------
/** Révélations génériques d'une page (à appeler dans mount, contexte gsap actif). */
export function reveals(root) {
  // titre principal : caractères qui montent
  const heroChars = $$('.pg-hero [data-chars]', root).flatMap((el) => splitChars(el));
  gsap.fromTo(heroChars, { yPercent: 120, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.5, ease: 'expo.out', stagger: 0.03, delay: 0.25 });
  gsap.fromTo($$('.pg-hero .eyebrow, .pg-hero [data-fade]', root), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.55 });
  gsap.fromTo($$('.pg-hero .eyebrow__line', root), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', delay: 0.5 });
  // autres titres en caractères
  $$('[data-chars]', root).filter((el) => !el.closest('.pg-hero')).forEach((el) => {
    gsap.fromTo(splitChars(el), { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.025, scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } });
  });
  $$('.eyebrow', root).filter((el) => !el.closest('.pg-hero')).forEach((el) => {
    gsap.fromTo(el, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none reverse' } });
    gsap.fromTo($('.eyebrow__line', el), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none reverse' } });
  });
  const rv = $$('[data-reveal]', root);
  if (rv.length) {
    gsap.set(rv, { opacity: 0, y: 50 });
    ScrollTrigger.batch(rv, {
      start: 'top 90%',
      onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true }),
      onLeaveBack: (els) => gsap.to(els, { y: 50, opacity: 0, duration: 0.5, overwrite: true }),
    });
  }
  // traits qui se dessinent
  $$('[data-line]', root).forEach((el) => gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none reverse' } }));
  // compteurs
  $$('[data-count]', root).forEach((el) => {
    const to = +el.dataset.count;
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) }); } });
  });
  // pied de page
  const top = $('[data-top]', root);
  if (top) top.addEventListener('click', () => window.__garoLenis?.scrollTo(0, { duration: 2 }));
}

/** Progression (0→1) d'un déclencheur, sûre si absent. */
export const prog = (st) => (st ? st.progress : 0);
