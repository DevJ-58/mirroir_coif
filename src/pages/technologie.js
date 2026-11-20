// Technologie : la fabrication de l'avatar racontée au défilement
// (balayage, tour de tête, maillage filaire, pousse des cheveux, confidentialité).
import * as THREE from 'three';
import gsap from 'gsap';
import { buildHeadGeometry, canonicalVerts } from '../three/head.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, pad2, clamp, ease, mix, P, pageHero, pageFoot, reveals, eyebrow } from './kit.js';

const STEPS = [
  { n: '468', u: 'points', t: 'Le visage, point par point', d: 'La caméra repère 468 points du visage à chaque image : contour des yeux, arête du nez, lèvres, mâchoire. Ils fixent la position exacte de la tête.' },
  { n: '25', u: 'angles', t: 'Un tour de tête', d: 'Un lent tour de tête suffit. Une vue est gardée tous les 6°, puis le dessus et le dessous. Chaque silhouette sculpte le volume réel du crâne et des cheveux.' },
  { n: '1', u: 'maillage', t: 'La forme se tisse', d: 'Les silhouettes se croisent : la largeur, la profondeur, le front et la nuque sont mesurés. Un maillage unique, propre à la personne, remplace le mannequin.' },
  { n: '12', u: 'coiffures', t: 'Les cheveux poussent', d: 'Chaque coiffure est construite mèche par mèche, puis ajustée au volume mesuré : un afro suit la taille réelle des cheveux, des locks leur longueur.' },
  { n: '0', u: 'image envoyée', t: 'Rien ne sort du salon', d: 'Tout le calcul se fait sur l’appareil : la tablette, la télé ou la borne. Aucune photo n’est envoyée, aucune n’est conservée après la séance.' },
];

export default {
  id: 'technologie', path: '/technologie', title: 'Technologie', label: 'Technologie',
  html: () => `
    ${pageHero({
      kicker: 'Du nuage de points à la mèche',
      title: 'Techno|logie',
      lede: 'Une caméra, un tour de tête, et quelques secondes de calcul. Voici comment le mannequin devient vous, sans qu’aucune image ne quitte le salon.',
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
        <div data-reveal><b data-count="25">0</b><span>angles de vue gardés pendant le tour de tête</span></div>
        <div data-reveal><b data-count="12">0</b><span>coiffures construites en 3D, ajustées au volume mesuré</span></div>
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
    const byId = (id) => STYLES.find((s) => s.id === id);
    const steps = $$('.tc-step', root), nav = $$('.tc__nav li', root);
    const num = $('#tcNum', root), unit = $('#tcUnit', root), scan = $('#tcScan', root);
    const inst = { spin: 0 };
    let cur = -1, inRun = false, local = 0;
    // maillage filaire doré posé sur la tête (grille volontairement lâche, lisible)
    let net = null;
    const wire = (on) => {
      if (on && !net) {
        const g = buildHeadGeometry(avatar.scan ? avatar.scan.verts : canonicalVerts(), null, { NT: 64, NY: 56 });
        net = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xe9cf9f, wireframe: true, transparent: true, opacity: 0, depthWrite: false }));
        net.scale.setScalar(1.006);
        avatar.group.add(net);
      }
      if (net) gsap.to(net.material, { opacity: on ? 0.55 : 0, duration: 0.6 });
    };

    function setStep(i) {
      if (cur === i) return;
      const prev = cur; cur = i;
      steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
      nav.forEach((s, k) => s.classList.toggle('is-on', k === i));
      unit.textContent = STEPS[i].u;
      steps.forEach((s, k) => { if (k !== i) gsap.to(s.children, { opacity: 0, y: -20 * (i > k ? 1 : -1), duration: 0.35, ease: 'power2.in', overwrite: true }); });
      gsap.fromTo(steps[i].children, { y: 30 * (i > prev ? 1 : -1), opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.06, overwrite: true });
      if (!inRun) return;
      wire(i === 2);
      if (i === 0 || i === 1 || i === 2) hair.hideAll(0.4);
      if (i === 3) hair.show(byId('locks'), 'grow');
      if (i === 4) hair.show(byId('afro'), 'drop');
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
            avatar.uniforms.uReveal.value = 0.3 + 0.7 * k;
            scan.style.setProperty('--y', `${(1 - k) * 100}%`);
            scan.classList.add('is-on');
          } else { avatar.uniforms.uReveal.value = 1; scan.classList.remove('is-on'); }
          // étape 2 : un tour complet
          inst.spin = inRun && i === 1 ? ease(local) * Math.PI * 2 : 0;
        },
        onToggle: (self) => {
          inRun = self.isActive;
          if (inRun) { const k = cur; cur = -1; setStep(Math.max(0, k)); }
          else { wire(false); avatar.uniforms.uReveal.value = 1; scan.classList.remove('is-on'); if (self.progress >= 1 && !hair.current) hair.show(byId('afro'), 'drop'); }
        },
      }),
      specs: ScrollTrigger.create({ trigger: '.tc-specs', start: 'top bottom', end: 'top 20%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    setStep(0);
    hair.show(byId('waves-fade'), 'drop');
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
      destroy() { if (net) { avatar.group.remove(net); net.geometry.dispose(); net.material.dispose(); } avatar.uniforms.uReveal.value = 1; },
    });
    return inst;
  },
};
