// Héritage : une frise horizontale. À chaque époque, le mannequin porte la coiffure qui la raconte.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, pad2, clamp, ease, mix, P, pageHero, pageFoot, reveals, eyebrow } from './kit.js';

const ERAS = [
  { year: '−3000', when: 'Il y a plus de 5 000 ans', title: 'Gravé dans la roche', style: 'cornrows',
    text: 'Sur les parois du Tassili n’Ajjer, au cœur du Sahara, des peintures montrent déjà des silhouettes aux cheveux tressés en rangs serrés. Les nattes collées comptent parmi les plus anciennes coiffures connues.' },
  { year: 'XVe', when: 'Royaumes d’Afrique de l’Ouest', title: 'Une coiffure se lit', style: 'bun',
    text: 'Âge, région, rang, mariage, deuil : la tête parle avant la bouche. Le coiffeur ou la coiffeuse occupe une place de confiance, et une séance peut durer une journée entière.' },
  { year: 'Fil', when: 'Partout sur le continent', title: 'Le temps des mains', style: 'twists',
    text: 'Vanilles, coiffures au fil, nattes enroulées : des techniques transmises de mère en fille, pensées autant pour protéger le cheveu que pour l’orner.' },
  { year: '1960', when: 'Les indépendances', title: 'L’afro, une fierté', style: 'afro',
    text: 'Avec les indépendances et les mouvements pour les droits civiques, le cheveu naturel devient un manifeste. Le volume ne se cache plus : il se montre.' },
  { year: '1990', when: 'Clips, magazines, rues', title: 'Les tresses partout', style: 'box-braids',
    text: 'Les box braids envahissent les écrans et les cours d’école. Longues, colorées, à mèches ajoutées : la tresse devient une mode mondiale.' },
  { year: 'Locks', when: 'Spiritualité et musique', title: 'Laisser pousser', style: 'locks',
    text: 'Portées par le reggae et par des traditions spirituelles plus anciennes, les locks racontent la patience. Elles se construisent sur des mois, parfois des années.' },
  { year: '2026', when: 'Abidjan, aujourd’hui', title: 'Allons se garo', style: 'waves-fade',
    text: 'Salons de quartier, barbiers de Yopougon, coiffeuses de Cocody : la tête reste un langage. Waves, dégradés, tresses colorées. GARO arrive dans ce fauteuil-là.' },
];

export default {
  id: 'heritage', path: '/heritage', title: 'Héritage', label: 'Héritage',
  html: () => `
    ${pageHero({
      kicker: 'Une histoire du cheveu',
      title: 'Héri|tage',
      lede: 'Avant d’être une tendance, une coiffure est une mémoire. Sept moments, de la roche saharienne aux salons d’Abidjan, portés par le mannequin.',
      meta: `<span class="k">Frise</span><b>7</b><span>époques</span>`,
    })}
    <section class="hg" id="hgTrack" style="height:${ERAS.length * 95 + 60}vh">
      <div class="hg__pin">
        <div class="hg__row" id="hgRow">
          ${ERAS.map((e, i) => `<article class="hg-era" data-i="${i}">
            <span class="hg-era__year" aria-hidden="true">${e.year}</span>
            <div class="hg-era__txt">
              <p class="k">${pad2(i + 1)} — ${e.when}</p>
              <h2 class="hg-era__t">${e.title}</h2>
              <p class="hg-era__p">${e.text}</p>
            </div>
          </article>`).join('')}
        </div>
        <div class="hg-line">
          <i class="hg-line__fill" id="hgFill"></i>
          ${ERAS.map((e, i) => `<button class="hg-dot" data-i="${i}" style="left:${(i / (ERAS.length - 1)) * 100}%"><i></i><span>${e.year}</span></button>`).join('')}
        </div>
      </div>
    </section>
    <section class="pg-s hg-quote">
      ${eyebrow('Ce que nous portons')}
      <blockquote class="hg-quote__q"><span data-chars>Chaque tête</span><br /><em data-chars>est une archive.</em></blockquote>
      <p class="body" data-reveal>GARO n’invente pas ces coiffures : il aide les salons qui les font vivre à les montrer, et les clients à oser les porter.</p>
    </section>
    ${pageFoot({ path: '/technologie', label: 'Technologie', desc: 'Du nuage de points à la mèche : comment l’avatar prend forme.' })}
  `,
  mount(root, { hair, STYLES }) {
    reveals(root);
    const byId = (id) => STYLES.find((s) => s.id === id) || STYLES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % STYLES.length];
    const row = $('#hgRow', root), eras = $$('.hg-era', root), dots = $$('.hg-dot', root);
    let i0 = -1, inTrack = false;
    const inst = { spin: 0 };
    const setEra = (i) => {
      if (i === i0) return;
      i0 = i;
      eras.forEach((e, k) => e.classList.toggle('is-on', k === i));
      dots.forEach((d, k) => d.classList.toggle('is-on', k <= i));
      if (inTrack) hair.show(byId(ERAS[i].style));
    };
    const track = $('#hgTrack', root);
    const st = {
      into: ScrollTrigger.create({ trigger: track, start: 'top 85%', end: 'top top' }),
      run: ScrollTrigger.create({
        trigger: track, start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => {
          // chaque époque marque une pause : le texte se pose avant de glisser vers la suivante
          const raw = self.progress * (ERAS.length - 1), k = Math.min(ERAS.length - 2, Math.floor(raw)), t = raw - k;
          const f = k + ease(clamp((t - 0.3) / 0.4, 0, 1));
          const p = f / (ERAS.length - 1);
          const max = row.scrollWidth - window.innerWidth;
          gsap.set(row, { x: -p * max });
          gsap.set('#hgFill', { scaleX: p });
          setEra(Math.round(f));
          inst.spin = Math.sin(f * Math.PI) * 0.35;
          // parallaxe des grandes dates
          eras.forEach((e, k) => { e.firstElementChild.style.transform = `translateX(${(f - k) * 18}vw)`; });
        },
        onToggle: (self) => {
          inTrack = self.isActive;
          if (inTrack) { const k = i0; i0 = -1; setEra(Math.max(0, k)); }
        },
      }),
      quote: ScrollTrigger.create({ trigger: '.hg-quote', start: 'top bottom', end: 'top 30%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    setEra(0);
    hair.show(byId('cornrows'));
    dots.forEach((d) => d.addEventListener('click', () => {
      const k = +d.dataset.i;
      window.__garoLenis?.scrollTo(st.run.start + (k / (ERAS.length - 1)) * (st.run.end - st.run.start), { duration: 1.6 });
    }));

    const PH = (s) => P({ x: s ? 0 : 0.24, y: s ? 0.12 : 0.02, theta: 0.5, r: s ? 128 : 100, sway: 1 });
    const PT = (s) => P({ x: s ? 0 : 0.24, y: s ? -0.12 : 0.04, theta: -0.25, phi: 1.46, r: s ? 140 : 104, sway: 0.1 });
    const PQ = (s) => P({ x: 0, y: s ? 0.36 : 0.4, theta: 0, phi: 1.5, r: s ? 120 : 104, sway: 1 });
    Object.assign(inst, {
      pose(_, s) {
        let p = mix(PH(s), PT(s), ease(st.into.progress));
        if (st.run.progress >= 1) p = mix(p, PQ(s), ease(st.quote.progress));
        if (!inTrack) inst.spin = 0;
        return p;
      },
      opacity: () => 1 - 0.7 * st.foot.progress,
      resume() { if (inTrack) { const k = i0; i0 = -1; setEra(k); } },
    });
    return inst;
  },
};
