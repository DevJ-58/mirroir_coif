// Partenaires : carte stylisée d'Abidjan, les salons équipés GARO.
// Salons de démonstration : la liste réelle viendra de l'espace salon.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, ease, mix, P, pageHero, pageFoot, reveals, eyebrow, esc } from './kit.js';

// coordonnées dans le repère de la carte (viewBox 1000 × 700)
const COMMUNES = [
  ['Abobo', 520, 110], ['Yopougon', 210, 290], ['Adjamé', 480, 255], ['Attécoubé', 360, 330], ['Plateau', 500, 370],
  ['Cocody', 720, 300], ['Treichville', 500, 480], ['Marcory', 640, 500], ['Koumassi', 760, 540], ['Port-Bouët', 640, 630],
];
const SALONS = [
  { id: 'akwaba', name: 'Maison Akwaba', commune: 'Cocody', x: 745, y: 268, styles: ['box-braids', 'locks', 'twists'], hours: 'Lun – Sam · 8 h – 20 h', note: 'Tresses longues et locks, salon de démonstration GARO.' },
  { id: 'nanan', name: 'Studio Nanan', commune: 'Plateau', x: 520, y: 360, styles: ['bob', 'long', 'bun'], hours: 'Mar – Sam · 9 h – 19 h', note: 'Lissages, carrés et chignons de cérémonie.' },
  { id: 'doigts', name: 'Les Doigts d’Or', commune: 'Yopougon', x: 240, y: 260, styles: ['cornrows', 'box-braids', 'twists'], hours: 'Tous les jours · 7 h – 21 h', note: 'Nattes collées et tresses, à deux pas du marché.' },
  { id: 'b225', name: 'Barber 225', commune: 'Treichville', x: 480, y: 500, styles: ['waves-fade', 'fade', 'buzz'], hours: 'Lun – Dim · 9 h – 22 h', note: 'Dégradés, waves et contours à la tondeuse.' },
  { id: 'koko', name: 'Tresses Kôkô', commune: 'Abobo', x: 545, y: 135, styles: ['twists', 'cornrows', 'afro'], hours: 'Lun – Sam · 8 h – 19 h', note: 'Vanilles et coiffures naturelles.' },
  { id: 'lagune', name: 'Atelier Lagune', commune: 'Marcory', x: 660, y: 470, styles: ['afro', 'waves', 'locks'], hours: 'Mer – Dim · 10 h – 20 h', note: 'Afro sculpté et entretien du cheveu naturel.' },
];

export default {
  id: 'partenaires', path: '/partenaires', title: 'Salons partenaires', label: 'Partenaires',
  html: ({ STYLES }) => `
    ${pageHero({
      kicker: 'Abidjan et bientôt ailleurs',
      title: 'Parte|naires',
      lede: 'Les salons qui ont adopté GARO. Choisissez une adresse : le mannequin porte aussitôt sa coiffure signature.',
      meta: `<span class="k">Carte</span><b>${SALONS.length}</b><span>salons</span>`,
    })}
    <section class="pt" id="ptMap">
      <div class="pt__pin">
        <div class="pt__map">
          <svg viewBox="0 0 1000 700" aria-label="Carte d’Abidjan">
            <defs>
              <pattern id="ptDots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="rgba(233,207,159,0.13)"/></pattern>
              <radialGradient id="ptFade" cx="0.5" cy="0.5" r="0.6"><stop offset="0.55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
              <mask id="ptMask"><rect width="1000" height="700" fill="url(#ptFade)"/></mask>
            </defs>
            <rect width="1000" height="700" fill="url(#ptDots)" mask="url(#ptMask)"/>
            <path class="pt__sea" d="M-20 640 C 180 610, 420 668, 620 640 S 900 620, 1020 632"/>
            <path class="pt__lagoon-w" d="M-20 450 C 120 430, 240 480, 350 438 S 450 340, 492 410 S 600 478, 720 436 S 900 438, 1020 470"/>
            <path class="pt__lagoon" d="M-20 450 C 120 430, 240 480, 350 438 S 450 340, 492 410 S 600 478, 720 436 S 900 438, 1020 470"/>
            <path class="pt__road" d="M520 90 C 500 170, 470 220, 486 280 S 500 340, 500 372 S 488 470, 500 490 S 600 600, 640 630"/>
            <path class="pt__road" d="M180 300 C 280 310, 360 330, 430 350 S 520 380, 600 340 S 760 290, 920 280"/>
            ${COMMUNES.map(([n, x, y]) => `<text class="pt__commune" x="${x}" y="${y}">${n}</text>`).join('')}
            ${SALONS.map((s, i) => `<g class="pt__pin-g" data-i="${i}" transform="translate(${s.x} ${s.y})" tabindex="0" role="button" aria-label="${esc(s.name)}">
              <circle class="pt__pulse" r="18"/><circle class="pt__dot" r="7"/>
            </g>`).join('')}
          </svg>
        </div>
        <aside class="pt__card" id="ptCard" aria-live="polite">
          <p class="k" id="ptCommune"></p>
          <h2 class="pt__name" id="ptName"></h2>
          <p class="pt__note" id="ptNote"></p>
          <p class="pt__hours" id="ptHours"></p>
          <ul class="pt__styles" id="ptStyles"></ul>
          <button class="btn btn--primary btn--sm magnetic" id="ptTry"><span class="btn__bg"></span><span class="btn__label">Essayer leur signature</span><span class="btn__arrow">→</span></button>
        </aside>
        <ol class="pt__list" id="ptList">${SALONS.map((s, i) => `<li data-i="${i}"><b>${esc(s.name)}</b><span>${s.commune}</span></li>`).join('')}</ol>
      </div>
    </section>
    <section class="pg-s pt-join">
      ${eyebrow('Votre salon sur la carte')}
      <h2 class="h2"><span data-chars>Rejoignez</span><br /><em data-chars>le réseau.</em></h2>
      <p class="body" data-reveal>Chaque salon équipé apparaît ici, avec sa carte de coiffures et ses horaires. Les clients arrivent en sachant déjà ce qu’ils veulent.</p>
      <div class="sl-cta" data-reveal>
        <a class="btn btn--primary magnetic" href="/contact" data-link><span class="btn__bg"></span><span class="btn__label">Inscrire mon salon</span><span class="btn__dot"></span></a>
        <a class="link-btn" href="/salons" data-link>Voir les formules</a>
      </div>
      <p class="sl-note">Carte de démonstration : les adresses affichées sont des exemples.</p>
    </section>
    ${pageFoot({ path: '/journal', label: 'Journal', desc: 'Conseils, tendances et entretien, par les coiffeurs.' })}
  `,
  mount(root, { hair, STYLES, onTry }) {
    reveals(root);
    const byId = (id) => STYLES.find((s) => s.id === id);
    let cur = -1, inMap = false;
    const pins = $$('.pt__pin-g', root), items = $$('#ptList li', root);
    function pick(i) {
      if (cur === i) return;
      cur = i;
      const s = SALONS[i];
      pins.forEach((p, k) => p.classList.toggle('is-on', k === i));
      items.forEach((p, k) => p.classList.toggle('is-on', k === i));
      $('#ptCommune', root).textContent = s.commune;
      $('#ptName', root).textContent = s.name;
      $('#ptNote', root).textContent = s.note;
      $('#ptHours', root).textContent = s.hours;
      $('#ptStyles', root).innerHTML = s.styles.map((id) => `<li data-id="${id}">${esc(byId(id).name)}</li>`).join('');
      gsap.fromTo($('#ptCard', root).children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
      if (inMap) hair.show(byId(s.styles[0]), 'drop');
    }
    pins.forEach((p) => {
      p.addEventListener('click', () => pick(+p.dataset.i));
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(+p.dataset.i); } });
    });
    items.forEach((p) => p.addEventListener('click', () => pick(+p.dataset.i)));
    $('#ptStyles', root).addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) hair.show(byId(li.dataset.id), 'drop'); });
    $('#ptTry', root).addEventListener('click', () => onTry(SALONS[cur].styles[0]));
    // les communes et les épingles apparaissent
    gsap.fromTo($$('.pt__commune, .pt__pin-g', root), { opacity: 0 }, { opacity: 1, duration: 1, stagger: 0.04, scrollTrigger: { trigger: '#ptMap', start: 'top 70%' } });
    gsap.fromTo($('.pt__lagoon, .pt__lagoon-w, .pt__road, .pt__sea', root), { strokeDashoffset: 2400 }, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', scrollTrigger: { trigger: '#ptMap', start: 'top 70%' } });

    const st = {
      into: ScrollTrigger.create({ trigger: '#ptMap', start: 'top 70%', end: 'top top' }),
      on: ScrollTrigger.create({ trigger: '#ptMap', start: 'top 50%', end: 'bottom 50%', onToggle: (self) => { inMap = self.isActive; if (inMap) { const k = cur; cur = -1; pick(Math.max(0, k)); } } }),
      join: ScrollTrigger.create({ trigger: '.pt-join', start: 'top bottom', end: 'top 30%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    pick(0);
    hair.show(byId('box-braids'), 'drop');
    const PH = (s) => P({ x: s ? 0 : 0.25, y: s ? 0.12 : 0.03, theta: 0.4, r: s ? 128 : 100, sway: 1 });
    const PM = (s) => P({ x: s ? 0 : 0.34, y: s ? -0.3 : -0.12, theta: -0.3, phi: 1.48, r: s ? 190 : 175, sway: 0.4 });
    const PJ = (s) => P({ x: s ? 0 : 0.26, y: s ? 0.3 : 0.03, theta: -0.5, r: s ? 140 : 104, sway: 1 });
    return {
      pose(_, s) {
        let p = mix(PH(s), PM(s), ease(st.into.progress));
        p = mix(p, PJ(s), ease(st.join.progress));
        return p;
      },
      opacity: () => 1 - 0.7 * st.foot.progress,
      resume() { if (inMap) { const k = cur; cur = -1; pick(k); } },
    };
  },
};
