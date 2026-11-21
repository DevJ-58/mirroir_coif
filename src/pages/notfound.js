// 404 : le mannequin a perdu ses cheveux.
import gsap from 'gsap';
import { $, P, reveals, esc } from './kit.js';

export default {
  id: '404', path: '/404', title: 'Page introuvable', label: '404',
  html: (_, { path = '' } = {}) => `
    <section class="nf">
      <p class="nf__code" aria-hidden="true"><span>4</span><span class="nf__o">0</span><span>4</span></p>
      <div class="nf__in">
        <p class="eyebrow"><span class="eyebrow__line"></span>Page introuvable</p>
        <h1 class="pg-title nf__title"><span class="pg-title__l" data-chars>Rasée</span><span class="pg-title__l pg-title__l--1" data-chars>de près.</span></h1>
        <p class="pg-lede" data-fade>L’adresse <b>${esc(path || location.pathname)}</b> n’existe pas, ou plus. Le mannequin, lui, attend toujours sa prochaine coiffure.</p>
        <div class="nf__cta" data-fade>
          <a class="btn btn--primary magnetic" href="/" data-link><span class="btn__bg"></span><span class="btn__label">Retour à l’accueil</span><span class="btn__arrow">→</span></a>
          <a class="btn btn--ghost magnetic" href="/collection" data-link><span class="btn__label">Voir le lookbook</span></a>
        </div>
      </div>
    </section>`,
  mount(root, { hair, STYLES }) {
    // les mêmes révélations que l'en-tête d'une page
    root.querySelector('.nf__in').classList.add('pg-hero');
    reveals(root);
    hair.hideAll(0.6);
    gsap.fromTo($('.nf__code', root).children, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.6, ease: 'expo.out', stagger: 0.08 });
    // un clic sur le « 0 » rend une coiffure au mannequin
    let n = 0;
    $('.nf__o', root).addEventListener('click', () => { hair.show(STYLES[n++ % STYLES.length], 'drop'); });
    return {
      pose: (_, stacked) => P({ x: 0, y: stacked ? 0.08 : 0.02, theta: 0.2, phi: 1.5, r: stacked ? 128 : 96, sway: 1 }),
    };
  },
};
