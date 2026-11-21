// Journal : conseils et tendances. /journal (liste) et /journal/<article>.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, ease, mix, P, pageHero, pageFoot, reveals, eyebrow, esc } from './kit.js';

export const ARTICLES = [
  {
    slug: 'coiffure-forme-du-visage', cat: 'Conseil', date: 'Novembre 2026', read: '4 min', style: 'bob',
    title: 'Quelle coiffure pour quelle forme de visage ?',
    lede: 'Rond, ovale, carré, allongé : la coupe qui flatte un visage n’est pas celle qui flatte le voisin. Quelques repères avant de choisir.',
    body: [
      ['h', 'Commencer par regarder la mâchoire'],
      ['p', 'La forme du visage se lit surtout entre les pommettes et la mâchoire. Un visage rond a des lignes douces et une largeur proche de la hauteur ; un visage carré, une mâchoire marquée ; un visage allongé, un front et un menton éloignés.'],
      ['h', 'Visage rond : chercher la hauteur'],
      ['p', 'Le volume sur le dessus allonge la silhouette : chignon haut, afro sculpté plus haut que large, tresses relevées. Les carrés arrêtés juste à la mâchoire, eux, élargissent.'],
      ['h', 'Visage carré : adoucir les angles'],
      ['p', 'Les longueurs qui tombent sous la mâchoire et les textures (vanilles, locks, box braids) cassent les lignes droites. Un dégradé très net, à l’inverse, les souligne : c’est un choix, pas une erreur.'],
      ['h', 'Visage allongé : élargir'],
      ['p', 'Du volume sur les côtés, un afro rond, un carré à hauteur de joue. On évite les coiffures très hautes qui étirent encore le visage.'],
      ['q', 'La meilleure règle reste de voir la coupe sur sa propre tête. C’est exactement ce que fait la cabine GARO.'],
    ],
  },
  {
    slug: 'entretenir-ses-locks', cat: 'Entretien', date: 'Octobre 2026', read: '5 min', style: 'locks',
    title: 'Entretenir ses locks les premiers mois',
    lede: 'Les premiers mois décident de la forme des locks pour des années. Patience, propreté et quelques gestes simples.',
    body: [
      ['h', 'Laisser le temps faire'],
      ['p', 'Les premières semaines, les locks se défont parfois et paraissent irrégulières. C’est normal : le cheveu apprend sa nouvelle forme. Il faut éviter de les retravailler trop souvent.'],
      ['h', 'Laver sans défaire'],
      ['p', 'Un shampoing léger, sans résidu, appliqué sur le cuir chevelu plutôt que sur les longueurs. Rincer longtemps, puis sécher complètement : une lock humide trop longtemps garde de l’odeur.'],
      ['h', 'Resserrer avec mesure'],
      ['p', 'Un passage chez le coiffeur toutes les quatre à six semaines suffit en général pour retravailler les racines. Trop serrer fragilise la base et peut tirer sur le cuir chevelu.'],
      ['q', 'Une lock se construit sur des mois. Le salon vous accompagne, la cabine vous montre où vous allez.'],
    ],
  },
  {
    slug: 'combien-de-temps-garder-ses-tresses', cat: 'Tresses', date: 'Septembre 2026', read: '3 min', style: 'box-braids',
    title: 'Box braids : combien de temps les garder ?',
    lede: 'Belles longtemps, oui. Éternelles, non. Savoir quand les défaire protège le cheveu en dessous.',
    body: [
      ['h', 'La durée qui convient à la plupart'],
      ['p', 'On conseille souvent de garder des box braids entre quatre et huit semaines. Au-delà, la repousse tire sur les tresses et le cheveu naturel s’emmêle à la base.'],
      ['h', 'Les signes qui ne trompent pas'],
      ['p', 'Démangeaisons persistantes, racines très visibles, tresses qui pèsent ou qui frisottent beaucoup : il est temps de prendre rendez-vous.'],
      ['h', 'Entre deux poses'],
      ['p', 'Laisser au cheveu une ou deux semaines de repos, avec un soin hydratant, avant la prochaine pose. Le cuir chevelu respire, les longueurs aussi.'],
      ['q', 'Avant la prochaine pose, essayez une autre longueur ou une autre teinte en cabine : quelques secondes suffisent.'],
    ],
  },
  {
    slug: 'proteger-ses-cheveux-chaleur-abidjan', cat: 'Climat', date: 'Août 2026', read: '4 min', style: 'twists',
    title: 'Protéger ses cheveux de la chaleur d’Abidjan',
    lede: 'Soleil, humidité, sel de la mer à Grand-Bassam : le climat met le cheveu à l’épreuve. Les bons réflexes.',
    body: [
      ['h', 'Hydrater plus que nourrir'],
      ['p', 'L’humidité de l’air ne remplace pas l’eau dans la fibre. Un spray hydratant léger, puis une huile pour sceller, gardent le cheveu souple sans l’alourdir.'],
      ['h', 'Couvrir la nuit'],
      ['p', 'Un bonnet ou une taie en satin limite les frottements et garde les coiffures protectrices nettes plus longtemps.'],
      ['h', 'Rincer après la mer et la piscine'],
      ['p', 'Le sel et le chlore assèchent. Un rinçage à l’eau claire dès la sortie, puis un soin, évitent la casse.'],
      ['h', 'Choisir des coiffures protectrices'],
      ['p', 'Vanilles, nattes collées, tresses : elles rangent les pointes à l’abri. À alterner avec des périodes de repos pour ne pas fatiguer les racines.'],
    ],
  },
];

const mannequinPose = {
  PH: (s) => P({ x: s ? 0 : 0.27, y: s ? 0.12 : 0.03, theta: -0.35, r: s ? 128 : 100, sway: 1 }),
  PL: (s) => P({ x: s ? 0 : 0.3, y: s ? 0.34 : 0.06, theta: 0.5, phi: 1.46, r: s ? 160 : 122, sway: 0.5 }),
};

export const journal = {
  id: 'journal', path: '/journal', title: 'Journal', label: 'Journal',
  html: () => `
    ${pageHero({
      kicker: 'Conseils, tendances, entretien',
      title: 'Jour|nal',
      lede: 'Ce que les coiffeurs répètent au fauteuil, écrit pour être relu à la maison.',
      meta: `<span class="k">Articles</span><b>${ARTICLES.length}</b><span>à lire</span>`,
    })}
    <section class="pg-s jr">
      ${eyebrow('Derniers articles')}
      <ol class="jr__list">
        ${ARTICLES.map((a, i) => `<li data-reveal><a class="jr__item" href="/journal/${a.slug}" data-link data-i="${i}" data-cursor="Lire">
          <span class="jr__n">${String(i + 1).padStart(2, '0')}</span>
          <span class="jr__t">${esc(a.title)}</span>
          <span class="jr__meta"><span class="k">${a.cat}</span>${a.date} · ${a.read}</span>
          <span class="jr__go">→</span>
        </a></li>`).join('')}
      </ol>
    </section>
    ${pageFoot({ path: '/a-propos', label: 'Allons se garo', desc: 'Le manifeste : pourquoi GARO existe.' })}
  `,
  mount(root, { hair, STYLES }) {
    reveals(root);
    const byId = (id) => STYLES.find((s) => s.id === id) || STYLES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % STYLES.length];
    hair.show(byId('bun'));
    // survol d'un article : le mannequin porte sa coiffure
    $('.jr__list', root).addEventListener('pointerover', (e) => {
      const a = e.target.closest('.jr__item'); if (!a) return;
      const s = byId(ARTICLES[+a.dataset.i].style);
      if (hair.current !== s.id) hair.show(s);
    });
    const st = {
      list: ScrollTrigger.create({ trigger: '.jr', start: 'top 80%', end: 'top 10%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    return {
      pose: (_, s) => mix(mannequinPose.PH(s), mannequinPose.PL(s), ease(st.list.progress)),
      opacity() {
        const s = window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;
        return 1 - (s ? 0.75 : 0.15) * st.list.progress - 0.6 * st.foot.progress;
      },
    };
  },
};

export const article = {
  id: 'article', path: '/journal/:slug', label: 'Article',
  match: (path) => { const m = path.match(/^\/journal\/([a-z0-9-]+)$/); return m && ARTICLES.some((a) => a.slug === m[1]) ? { slug: m[1] } : null; },
  title: ({ slug }) => ARTICLES.find((a) => a.slug === slug).title,
  html: (_, { slug }) => {
    const i = ARTICLES.findIndex((a) => a.slug === slug), a = ARTICLES[i], next = ARTICLES[(i + 1) % ARTICLES.length];
    return `
      <article class="ar">
        <header class="ar__head">
          <a class="link-btn ar__back" href="/journal" data-link>← Journal</a>
          <p class="eyebrow"><span class="eyebrow__line"></span>${a.cat} · ${a.date} · ${a.read}</p>
          <h1 class="ar__title" data-reveal>${esc(a.title)}</h1>
          <p class="ar__lede" data-reveal>${esc(a.lede)}</p>
        </header>
        <div class="ar__body">
          ${a.body.map(([k, t]) => (k === 'h' ? `<h2 data-reveal>${esc(t)}</h2>` : k === 'q' ? `<blockquote data-reveal>${esc(t)}</blockquote>` : `<p data-reveal>${esc(t)}</p>`)).join('')}
          <div class="ar__cta" data-reveal>
            <button class="btn btn--primary magnetic" data-action="scan"><span class="btn__bg"></span><span class="btn__label">Essayer en cabine</span><span class="btn__dot"></span></button>
          </div>
        </div>
      </article>
      ${pageFoot({ path: `/journal/${next.slug}`, label: 'Article suivant', desc: next.title })}
    `;
  },
  mount(root, { hair, STYLES }, { slug }) {
    reveals(root);
    const a = ARTICLES.find((x) => x.slug === slug);
    hair.show(((id) => STYLES.find((s) => s.id === id) || STYLES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % STYLES.length])(a.style));
    const st = {
      body: ScrollTrigger.create({ trigger: '.ar__body', start: 'top 70%', end: 'top 10%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    const A = (s) => P({ x: s ? 0 : 0.27, y: s ? 0.34 : 0.03, theta: -0.45, r: s ? 150 : 108, sway: 0.8 });
    const B = (s) => P({ x: s ? 0 : 0.3, y: s ? 0.34 : 0.05, theta: 0.6, phi: 1.46, r: s ? 160 : 118, sway: 0.4 });
    return {
      pose: (_, s) => mix(A(s), B(s), ease(st.body.progress)),
      opacity() {
        const s = window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;
        return 1 - (s ? 0.85 : 0.1) * st.body.progress - 0.6 * st.foot.progress;
      },
    };
  },
};
