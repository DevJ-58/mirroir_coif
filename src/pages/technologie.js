// Technologie : la fabrication de l'avatar racontée au défilement
// (points du visage, trois prises, visage posé sur le mannequin, coiffures, confidentialité).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, pad2, clamp, ease, mix, P, pageHero, pageFoot, reveals, eyebrow } from './kit.js';

const STEPS = [
  { n: '468', u: 'points', t: 'Le visage, point par point', d: 'La caméra repère 468 points du visage à chaque image : contour des yeux, arête du nez, lèvres, mâchoire. Ils fixent la position exacte de la tête.' },
  { n: '3', u: 'prises', t: 'Face et trois-quarts', d: 'Une photo de face, nette et bien éclairée, puis un quart de tour de chaque côté. Les trois vues affinent le relief : nez, pommettes, menton.' },
  { n: '1', u: 'ovale', t: 'Le visage se pose', d: 'Chaque coiffure est photographiée sur un mannequin. Le visage du client est posé dans l’ovale du mannequin, à son échelle, et tout le corps prend son teint.' },
  { n: '4', u: 'vues', t: 'Faire le tour', d: 'Face, trois-quarts, dos : on glisse pour tourner autour de la coiffure. Les cheveux de la photo restent devant le visage, franges et contours compris.' },
  { n: '0', u: 'image envoyée', t: 'Rien ne sort du salon', d: 'Tout le calcul se fait sur l’appareil : la tablette, la télé ou la borne. Aucune photo n’est envoyée, aucune n’est conservée après la séance.' },
];

export default {
  id: 'technologie', path: '/technologie', title: 'Technologie', label: 'Technologie',
  html: () => `
    ${pageHero({
      kicker: 'Du nuage de points à la mèche',
      title: 'Techno|logie',
      lede: 'Une caméra, trois prises du visage, et quelques secondes de calcul. Voici comment votre visage se pose sur le mannequin, sans qu’aucune image ne quitte le salon.',
      side: 'left',
    })}
    <section class="tc" id="tcRun" style="height:${STEPS.length * 110 + 60}vh">
      <div class="tc__pin">
        <div class="tc__count" aria-hidden="true"><b id="tcNum">000</b><span id="tcUnit">points</span></div>
        <div class="tc__steps">
          ${STEPS.map((s, i) => `<article class="tc-step" data-i="${i}">
            <p class="k">${pad2(i + 1)} / ${pad2(STEPS.length)}</p>
            <h2 class="tc-step__t">${s.t}</h2>
            <p class="tc-step__d">${s.d}</p>
          </article>`).join('')}
        </div>
        <ol class="tc__nav">${STEPS.map((s, i) => `<li data-i="${i}"><i></i><span>${s.t}</span></li>`).join('')}</ol>
        <div class="tc__scan" id="tcScan" aria-hidden="true"><i></i></div>
      </div>
    </section>
    <section class="pg-s tc-specs">
      ${eyebrow('En chiffres')}
      <div class="tc-specs__grid">
        <div data-reveal><b data-count="468">0</b><span>points suivis sur le visage, à chaque image</span></div>
        <div data-reveal><b data-count="3">0</b><span>prises du visage : face et deux trois-quarts</span></div>
        <div data-reveal><b data-count="4">0</b><span>vues par coiffure : face, trois-quarts et dos</span></div>
        <div data-reveal><b>0</b><span>image envoyée sur internet. Tout reste sur l’appareil</span></div>
      </div>
    </section>
    <section class="pg-s tc-hw">
      ${eyebrow('Sur quel écran ?')}
      <h2 class="h2"><span data-chars>Le matériel</span><br /><em data-chars>du salon suffit.</em></h2>
      <div class="tc-hw__grid">
        ${[
          ['Tablette', 'Au fauteuil, entre les mains du client. La caméra avant fait le scan.', '<rect x="14" y="6" width="36" height="52" rx="5"/><circle cx="32" cy="52" r="1.6"/>'],
          ['Télévision', 'En vitrine ou en salle d’attente : la collection tourne en boucle.', '<rect x="4" y="12" width="56" height="34" rx="3"/><path d="M24 54h16M32 46v8"/>'],
          ['Borne', 'À l’entrée du salon, en libre-service, avec une caméra fixe.', '<rect x="20" y="4" width="24" height="40" rx="3"/><path d="M26 44l-4 16h20l-4-16"/>'],
          ['Téléphone', 'Le client prépare son essai depuis chez lui, avant le rendez-vous.', '<rect x="20" y="6" width="24" height="52" rx="5"/><path d="M29 11h6"/>'],
        ].map(([t, d, svg]) => `<article class="tc-hw__card" data-reveal>
          <svg viewBox="0 0 64 64" aria-hidden="true">${svg}</svg>
          <h3>${t}</h3><p>${d}</p>
        </article>`).join('')}
      </div>
    </section>
    ${pageFoot({ path: '/salons', label: 'Salons', desc: 'Formules, matériel et simulateur : équiper votre salon.' })}
  `,
  mount(root, { hair, STYLES, avatar }) {
    reveals(root);
    const byId = (id) => STYLES.find((s) => s.id === id) || STYLES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % STYLES.length];
    const steps = $$('.tc-step', root), nav = $$('.tc__nav li', root);
    const num = $('#tcNum', root), unit = $('#tcUnit', root), scan = $('#tcScan', root);
    const inst = { spin: 0 };
    let cur = -1, inRun = false, local = 0;
    function setStep(i) {
      if (cur === i) return;
      const prev = cur; cur = i;
      steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
      nav.forEach((s, k) => s.classList.toggle('is-on', k === i));
      unit.textContent = STEPS[i].u;
      steps.forEach((s, k) => { if (k !== i) gsap.to(s.children, { opacity: 0, y: -20 * (i > k ? 1 : -1), duration: 0.35, ease: 'power2.in', overwrite: true }); });
      gsap.fromTo(steps[i].children, { y: 30 * (i > prev ? 1 : -1), opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06, overwrite: true });
      if (!inRun) return;
      hair.show(STYLES[i % STYLES.length]);
    }
    const run = $('#tcRun', root);
    const st = {
      into: ScrollTrigger.create({ trigger: run, start: 'top 80%', end: 'top top' }),
      run: ScrollTrigger.create({
        trigger: run, start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => {
          const f = self.progress * STEPS.length;
          const i = clamp(Math.floor(f), 0, STEPS.length - 1);
          local = clamp(f - i, 0, 1);
          setStep(i);
          const target = +STEPS[i].n;
          num.textContent = String(Math.round(target * (i === 4 ? 1 : ease(clamp(local * 1.6, 0, 1))))).padStart(3, '0');
          // étape 1 : la tête se reconstruit sous la ligne de balayage
          if (inRun && i === 0) {
            const k = clamp(local * 1.25, 0, 1);
            hair.setReveal(0.3 + 0.7 * k);
            scan.style.setProperty('--y', `${(1 - k) * 100}%`);
            scan.classList.add('is-on');
          } else { hair.setReveal(1); scan.classList.remove('is-on'); }
          // étape 2 : un tour complet
          inst.spin = inRun && i === 1 ? Math.sin(local * Math.PI * 2) * 0.7 : 0;
        },
        onToggle: (self) => {
          inRun = self.isActive;
          if (inRun) { const k = cur; cur = -1; setStep(Math.max(0, k)); }
          else { hair.setReveal(1); scan.classList.remove('is-on'); if (!hair.current) hair.show(STYLES[0]); }
        },
      }),
      specs: ScrollTrigger.create({ trigger: '.tc-specs', start: 'top bottom', end: 'top 20%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    setStep(0);
    hair.show(byId('waves-fade'));
    nav.forEach((li) => li.addEventListener('click', () => {
      const k = +li.dataset.i;
      window.__garoLenis?.scrollTo(st.run.start + ((k + 0.45) / STEPS.length) * (st.run.end - st.run.start), { duration: 1.4 });
    }));

    const PH = (s) => P({ x: s ? 0 : 0.25, y: s ? 0.12 : 0.02, theta: -0.4, r: s ? 128 : 100, sway: 1 });
    const PR = (s) => P({ x: s ? 0 : 0.2, y: s ? -0.14 : 0.02, theta: 0.15, phi: 1.47, r: s ? 140 : 100, sway: 0.05 });
    const PS = (s) => P({ x: s ? 0 : -0.26, y: s ? 0.3 : 0.05, theta: 0.6, phi: 1.44, r: s ? 140 : 112, sway: 0.4 });
    Object.assign(inst, {
      pose(_, s) {
        let p = mix(PH(s), PR(s), ease(st.into.progress));
        p = mix(p, PS(s), ease(st.specs.progress));
        return p;
      },
      opacity() {
        const s = window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;
        return 1 - (s ? 0.75 : 0.3) * st.specs.progress - 0.6 * st.foot.progress;
      },
      destroy() { hair.setReveal(1); },
    });
    return inst;
  },
};
