// Salons : l'offre SaaS. Simulateur (écran, taille du salon), formules, mise en place.
// Les tarifs sont indicatifs (démonstration) : ils se règlent dans PLANS.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, clamp, ease, mix, P, pageHero, pageFoot, reveals, eyebrow } from './kit.js';

const PLANS = [
  { id: 'essentiel', name: 'Essentiel', price: 15000, devices: 1, pitch: 'Un écran au fauteuil.', items: ['1 appareil (tablette ou téléphone)', 'Scan de tête et cabine d’essayage', 'Catalogue de démonstration', 'Mises à jour incluses'] },
  { id: 'salon', name: 'Salon', price: 35000, devices: 3, pitch: 'Le salon entier équipé.', items: ['Jusqu’à 3 appareils', 'Votre carte : coiffures, prix, durées', 'Mode vitrine pour la télévision', 'Réservation depuis la cabine'], best: true },
  { id: 'maison', name: 'Maison', price: 75000, devices: 8, pitch: 'Plusieurs salons, une borne.', items: ['Jusqu’à 8 appareils, plusieurs adresses', 'Borne en libre-service', 'Dépôt de vos propres coiffures 3D', 'Accompagnement dédié'] },
];
const EXTRA = 5000;   // par appareil au-delà de la formule
const DEVICES = {
  tablette: { label: 'Tablette', where: 'au fauteuil', shape: 'tab' },
  tv: { label: 'Télévision', where: 'en vitrine', shape: 'tv' },
  borne: { label: 'Borne', where: 'à l’entrée', shape: 'kiosk' },
};
const fmt = (n) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');

export default {
  id: 'salons', path: '/salons', title: 'Pour les salons', label: 'Salons',
  html: () => `
    ${pageHero({
      kicker: 'Équiper votre salon',
      title: 'Pour les|salons',
      lede: 'Vos clients hésitent, comparent, demandent « est-ce que ça m’irait ? ». Avec GARO, ils le voient. Sur une tablette, une télé ou une borne.',
    })}
    <section class="pg-s sl-why">
      ${eyebrow('Ce que ça change')}
      <ol class="sl-why__list">
        <li data-reveal><span class="sl-why__n">01</span><h3>Le client décide au fauteuil</h3><p>Il voit la coupe sur sa propre tête, sous tous les angles. L’hésitation disparaît avant le premier coup de ciseaux.</p></li>
        <li data-reveal><span class="sl-why__n">02</span><h3>Toute la carte devient visible</h3><p>Les coiffures longues, coûteuses ou nouvelles se montrent enfin. Le client découvre ce que le salon sait faire.</p></li>
        <li data-reveal><span class="sl-why__n">03</span><h3>Une vitrine qui bouge</h3><p>Sur la télé de la salle d’attente ou en devanture, le mannequin porte vos coiffures en boucle et attire le regard.</p></li>
      </ol>
    </section>
    <section class="sl-sim" id="slSim">
      <div class="sl-sim__pin">
        <div class="sl-sim__ctl">
          ${eyebrow('Simulateur')}
          <h2 class="h2"><span data-chars>Votre salon,</span><br /><em data-chars>votre formule.</em></h2>
          <div class="sl-field">
            <span class="k">Écran principal</span>
            <div class="sl-seg" id="slDev">${Object.entries(DEVICES).map(([id, d], i) => `<button class="${i ? '' : 'is-on'}" data-dev="${id}">${d.label}</button>`).join('')}</div>
          </div>
          <div class="sl-field">
            <span class="k">Postes de coiffure <b id="slChairsV">4</b></span>
            <input class="sl-range" id="slChairs" type="range" min="1" max="20" value="4" />
          </div>
          <div class="sl-field">
            <span class="k">Adresses</span>
            <div class="sl-seg" id="slSites"><button class="is-on" data-n="1">Un salon</button><button data-n="2">Plusieurs</button></div>
          </div>
          <div class="sl-out">
            <div><span class="k">Formule conseillée</span><b id="slPlan">Salon</b></div>
            <div><span class="k">Appareils</span><b id="slDevs">2</b></div>
            <div class="sl-out__price"><span class="k">Estimation mensuelle</span><b><span id="slPrice">35 000</span> <small>FCFA</small></b></div>
          </div>
          <p class="sl-note">Estimation indicative, hors matériel. Le devis final dépend de votre salon.</p>
        </div>
        <div class="sl-device" id="slDevice" data-shape="tab" aria-hidden="true">
          <span class="sl-device__cap" id="slCap">Tablette · au fauteuil</span>
        </div>
      </div>
    </section>
    <section class="pg-s sl-plans">
      ${eyebrow('Formules')}
      <h2 class="h2"><span data-chars>Trois façons</span><br /><em data-chars>de commencer.</em></h2>
      <div class="sl-plans__grid">
        ${PLANS.map((p) => `<article class="sl-plan${p.best ? ' is-best' : ''}" data-plan="${p.id}" data-reveal>
          ${p.best ? '<span class="sl-plan__tag">Le plus choisi</span>' : ''}
          <h3>${p.name}</h3>
          <p class="sl-plan__pitch">${p.pitch}</p>
          <p class="sl-plan__price"><b>${fmt(p.price)}</b> <span>FCFA / mois</span></p>
          <ul>${p.items.map((x) => `<li>${x}</li>`).join('')}</ul>
          <a class="btn ${p.best ? 'btn--primary' : 'btn--ghost'} btn--sm magnetic" href="/contact" data-link><span class="btn__bg"></span><span class="btn__label">Demander une démo</span><span class="btn__arrow">→</span></a>
        </article>`).join('')}
      </div>
      <p class="sl-note" data-reveal>Tarifs de lancement, indicatifs. Sans engagement, résiliable chaque mois.</p>
    </section>
    <section class="pg-s sl-steps">
      ${eyebrow('Mise en place')}
      <div class="sl-steps__row">
        <div data-reveal><span class="sl-why__n">J+0</span><h3>Démonstration</h3><p>Nous venons au salon avec une tablette : vous essayez, votre équipe aussi.</p></div>
        <div data-reveal><span class="sl-why__n">J+3</span><h3>Votre carte</h3><p>Coiffures, prix, durées, teintes : la cabine affiche ce que vous proposez vraiment.</p></div>
        <div data-reveal><span class="sl-why__n">J+7</span><h3>En service</h3><p>Écrans installés, équipe formée en une heure. Les clients scannent dès le premier jour.</p></div>
      </div>
      <div class="sl-cta" data-reveal>
        <a class="btn btn--primary magnetic" href="/contact" data-link><span class="btn__bg"></span><span class="btn__label">Réserver une démonstration</span><span class="btn__dot"></span></a>
        <a class="link-btn" href="/faq" data-link>Questions fréquentes</a>
      </div>
    </section>
    ${pageFoot({ path: '/partenaires', label: 'Partenaires', desc: 'La carte des salons équipés GARO à Abidjan.' })}
  `,
  mount(root, { hair, STYLES }) {
    reveals(root);
    const byId = (id) => STYLES.find((s) => s.id === id);
    const state = { dev: 'tablette', chairs: 4, sites: 1 };
    const device = $('#slDevice', root);
    const HAIR = { tablette: 'box-braids', tv: 'afro', borne: 'waves-fade' };
    let inSim = false;

    function compute() {
      const { dev, chairs, sites } = state;
      // une tablette pour 4 postes, plus l'écran principal s'il n'est pas une tablette
      let devs = Math.max(1, Math.ceil(chairs / 4)) + (dev === 'tablette' ? 0 : 1);
      devs *= sites > 1 ? 2 : 1;
      const plan = sites > 1 || dev === 'borne' ? PLANS[2] : devs <= 1 ? PLANS[0] : PLANS[1];
      const price = plan.price + Math.max(0, devs - plan.devices) * EXTRA;
      $('#slChairsV', root).textContent = chairs;
      $('#slDevs', root).textContent = devs;
      const planEl = $('#slPlan', root);
      if (planEl.textContent !== plan.name) gsap.fromTo(planEl, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
      planEl.textContent = plan.name;
      const pr = $('#slPrice', root), from = +pr.dataset.v || plan.price, o = { v: from };
      pr.dataset.v = price;
      gsap.to(o, { v: price, duration: 0.8, ease: 'power3.out', onUpdate: () => (pr.textContent = fmt(Math.round(o.v / 500) * 500)) });
      $$('.sl-plan', root).forEach((c) => c.classList.toggle('is-pick', c.dataset.plan === plan.id));
      const d = DEVICES[dev];
      device.dataset.shape = d.shape;
      $('#slCap', root).textContent = `${d.label} · ${d.where}`;
      if (inSim && hair.current !== HAIR[dev]) hair.show(byId(HAIR[dev]), 'drop');
    }
    $('#slDev', root).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#slDev button', root).forEach((x) => x.classList.toggle('is-on', x === b));
      state.dev = b.dataset.dev; compute();
    });
    $('#slSites', root).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#slSites button', root).forEach((x) => x.classList.toggle('is-on', x === b));
      state.sites = +b.dataset.n; compute();
    });
    const range = $('#slChairs', root);
    const paint = () => range.style.setProperty('--p', `${((range.value - range.min) / (range.max - range.min)) * 100}%`);
    range.addEventListener('input', () => { state.chairs = +range.value; paint(); compute(); });
    paint();
    compute();

    const st = {
      why: ScrollTrigger.create({ trigger: '.sl-why', start: 'top 80%', end: 'top 20%' }),
      sim: ScrollTrigger.create({ trigger: '#slSim', start: 'top 70%', end: 'top top' }),
      simOn: ScrollTrigger.create({
        trigger: '#slSim', start: 'top 50%', end: 'bottom 50%',
        onToggle: (self) => { inSim = self.isActive; if (inSim) compute(); },
      }),
      plans: ScrollTrigger.create({ trigger: '.sl-plans', start: 'top 80%', end: 'top 20%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    hair.show(byId('locks'), 'drop');

    // l'écran choisi change la façon dont le mannequin est cadré
    const SIM = {
      tab: (s) => P({ x: s ? 0 : 0.24, y: s ? -0.27 : 0.02, theta: 0.2, phi: 1.48, r: s ? 210 : 112, sway: 0.25 }),
      tv: (s) => P({ x: s ? 0 : 0.24, y: s ? -0.27 : 0.02, theta: -0.35, phi: 1.46, r: s ? 230 : 124, sway: 0.5 }),
      kiosk: (s) => P({ x: s ? 0 : 0.24, y: s ? -0.27 : 0.02, theta: 0.05, phi: 1.5, r: s ? 220 : 116, sway: 0.15 }),
    };
    const PH = (s) => P({ x: s ? 0 : 0.26, y: s ? 0.12 : 0.03, theta: -0.5, r: s ? 128 : 100, sway: 1 });
    const PW = (s) => P({ x: s ? 0 : -0.27, y: s ? 0.3 : 0.04, theta: 0.7, phi: 1.44, r: s ? 150 : 118, sway: 0.4 });
    const PL = (s) => P({ x: 0, y: s ? 0.38 : 0.42, theta: 0, phi: 1.5, r: s ? 130 : 110, sway: 1 });
    return {
      pose(_, s) {
        let p = mix(PH(s), PW(s), ease(st.why.progress));
        p = mix(p, SIM[device.dataset.shape](s), ease(st.sim.progress));
        p = mix(p, PL(s), ease(st.plans.progress));
        return p;
      },
      opacity() {
        const s = window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;
        return 1 - (s ? 0.7 * st.why.progress * (1 - st.sim.progress) : 0) - 0.82 * st.plans.progress;
      },
    };
  },
};
