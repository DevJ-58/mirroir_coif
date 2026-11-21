// Lookbook : la carte complète en défilé (le mannequin change de coiffure au fil du défilement),
// puis l'index où chaque survol glisse la coiffure sur le mannequin.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, pad2, clamp, ease, mix, P, pageHero, pageFoot, reveals, eyebrow, esc } from './kit.js';
import { splitChars } from '../site/site.js';

const CAT_NOTES = {
  tresses: 'Tresses & locks',
  naturel: 'Naturel',
  courtes: 'Coupes courtes',
  lisses: 'Lissés & attachés',
};

export default {
  id: 'lookbook', path: '/collection', title: 'Lookbook', label: 'Lookbook', num: '02',
  desc: 'La carte complète, en défilé.', preview: 'box-braids',
  html: ({ STYLES, CATEGORIES }) => `
    ${pageHero({
      kicker: 'Saison 01 — La carte du salon',
      title: 'Look|book',
      lede: `${STYLES.length} coiffures, portées une à une par le mannequin. Défilez : la collection passe devant vous.`,
      meta: `<span class="k">Collection</span><b data-count="${STYLES.length}">0</b><span>coiffures</span>`,
    })}
    <section class="lb-show" id="lbShow">
      <div class="lb-show__pin">
        <div class="lb-show__top">
          ${eyebrow('Le défilé')}
          <div class="chips lb-chips" id="lbChips">${CATEGORIES.map((c, i) => `<button class="chip${i ? '' : ' is-on'}" data-cat="${c.id}">${c.label}</button>`).join('')}</div>
        </div>
        <div class="lb-now">
          <div class="lb-now__idx"><b id="lbIdx">01</b><i></i><span id="lbTot">${pad2(STYLES.length)}</span></div>
          <h2 class="lb-now__name" id="lbName"></h2>
          <p class="lb-now__cat k" id="lbCat"></p>
          <p class="lb-now__desc" id="lbDesc"></p>
          <dl class="lb-now__meta"><div><dt>Durée</dt><dd id="lbDur"></dd></div><div><dt>Tarif</dt><dd><span id="lbPrice"></span> <small>FCFA</small></dd></div></dl>
          <button class="btn btn--primary btn--sm magnetic" id="lbTry"><span class="btn__bg"></span><span class="btn__label">Essayer sur moi</span><span class="btn__arrow">→</span></button>
        </div>
        <div class="lb-big" id="lbBig" aria-hidden="true"></div>
        <ol class="lb-rail" id="lbRail"></ol>
        <div class="lb-bar"><i id="lbBar"></i></div>
      </div>
    </section>
    <section class="lb-index" id="lbIndex">
      <div class="lb-index__stage" aria-hidden="true"><span class="lb-index__label" id="lbHover">Survolez une coiffure</span></div>
      <div class="lb-index__list">
        ${eyebrow('L’index')}
        <h2 class="h2"><span data-chars>Survolez,</span><br /><em data-chars>elle se pose.</em></h2>
        <div class="lb-grid">
          ${STYLES.map((s, i) => `<button class="lb-card" data-id="${s.id}" data-cursor="Essayer" data-reveal>
            <span class="lb-card__img"><img alt="" /></span>
            <span class="lb-card__n">${pad2(i + 1)}</span>
            <span class="lb-card__name">${esc(s.name)}</span>
            <span class="lb-card__meta">${s.duration} · ${s.price} FCFA</span>
          </button>`).join('')}
        </div>
      </div>
    </section>
    ${pageFoot({ path: '/heritage', label: 'Héritage', desc: 'Des milliers d’années de tresses, de locks et de fierté.' })}
  `,
  mount(root, { hair, STYLES, onTry }) {
    reveals(root);
    const D = () => STYLES.slice();
    let list = D();
    let idx = -1;
    const show = $('#lbShow', root), name = $('#lbName', root), big = $('#lbBig', root), rail = $('#lbRail', root);
    const inst = { spin: 0 };

    function buildRail() {
      rail.innerHTML = list.map((s, i) => `<li data-i="${i}">${esc(s.name)}</li>`).join('');
      $('#lbTot', root).textContent = pad2(list.length);
      show.style.height = `${Math.max(2, list.length) * 62 + 100}vh`;
    }
    function setIdx(i, force = false) {
      if (idx === i && !force) return;
      const dir = i > idx ? 1 : -1;
      idx = i;
      const s = list[i];
      $('#lbIdx', root).textContent = pad2(i + 1);
      $$('li', rail).forEach((li, k) => li.classList.toggle('is-on', k === i));
      const write = () => {
        name.textContent = s.name; delete name.dataset.done;
        gsap.fromTo(splitChars(name), { yPercent: 110 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.02 });
      };
      const old = $$('.ch', name);
      if (old.length) gsap.to(old, { yPercent: -110 * dir, opacity: 0, duration: 0.25, stagger: 0.006, onComplete: write }); else write();
      gsap.fromTo(['#lbCat', '#lbDesc', '.lb-now__meta'].map((q) => $(q, root)), { opacity: 0, y: 14 * dir }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.05, delay: 0.1 });
      $('#lbCat', root).textContent = CAT_NOTES[s.cat] || '';
      $('#lbDesc', root).textContent = s.desc;
      $('#lbDur', root).textContent = s.duration;
      $('#lbPrice', root).textContent = s.price;
      big.textContent = pad2(i + 1);
      gsap.fromTo(big, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out' });
      if (active === 'show') hair.show(s);
    }
    buildRail();

    // zones de la page → pose et coiffure
    let active = 'hero';
    const st = {
      show: ScrollTrigger.create({ trigger: show, start: 'top 80%', end: 'top top' }),
      run: ScrollTrigger.create({
        trigger: show, start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => {
          const f = self.progress * list.length;
          const i = clamp(Math.floor(f), 0, list.length - 1);
          setIdx(i);
          const local = clamp(f - i, 0, 1);
          inst.spin = (local - 0.5) * 1.5;   // chaque coiffure tourne devant vous
          gsap.set('#lbBar', { scaleX: self.progress });
        },
      }),
      index: ScrollTrigger.create({ trigger: '#lbIndex', start: 'top 70%', end: 'top 10%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    const zone = (key) => {
      if (active === key) return;
      active = key;
      if (key === 'hero') hair.show(((id) => STYLES.find((s) => s.id === id) || STYLES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % STYLES.length])('box-braids'));
      if (key === 'show') setIdx(Math.max(0, idx), true);
      if (key === 'index') { inst.spin = 0; }
    };
    ScrollTrigger.create({ trigger: show, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => s.isActive && zone('show') });
    ScrollTrigger.create({ trigger: '#lbIndex', start: 'top 50%', end: 'bottom 50%', onToggle: (s) => s.isActive && zone('index') });
    ScrollTrigger.create({ trigger: root, start: 'top top', end: () => `+=${window.innerHeight * 0.5}`, onToggle: (s) => s.isActive && zone('hero') });
    hair.show(((id) => STYLES.find((s) => s.id === id) || STYLES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % STYLES.length])('box-braids'));
    setIdx(0, true);

    // filtres : la piste se recompose
    $('#lbChips', root).addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      $$('.chip', root).forEach((c) => c.classList.toggle('is-on', c === b));
      const cat = b.dataset.cat;
      list = cat === 'all' ? D() : D().filter((s) => s.cat === cat);
      buildRail();
      ScrollTrigger.refresh();
      window.__garoLenis?.scrollTo(show, { duration: 0.9 });
      setIdx(0, true);
    });
    rail.addEventListener('click', (e) => {
      const li = e.target.closest('li'); if (!li) return;
      const i = +li.dataset.i;
      const y = st.run.start + ((i + 0.5) / list.length) * (st.run.end - st.run.start);
      window.__garoLenis?.scrollTo(y, { duration: 1.4 });
    });
    $('#lbTry', root).addEventListener('click', () => onTry(list[idx].id));

    // index : survol = la coiffure se pose
    const label = $('#lbHover', root);
    const grid = $('.lb-grid', root);
    const pick = (card) => {
      const s = STYLES.find((x) => x.id === card.dataset.id);
      $$('.lb-card', grid).forEach((c) => c.classList.toggle('is-on', c === card));
      if (hair.current !== s.id) hair.show(s);
      label.textContent = s.name;
    };
    grid.addEventListener('pointerover', (e) => { const c = e.target.closest('.lb-card'); if (c && active === 'index' && e.pointerType === 'mouse') pick(c); });
    grid.addEventListener('click', (e) => {
      const c = e.target.closest('.lb-card'); if (!c) return;
      // au toucher : premier appui = aperçu, second = essayer
      if (!c.classList.contains('is-on') && !window.matchMedia('(hover: hover)').matches) { pick(c); return; }
      onTry(c.dataset.id);
    });

    const PH = (stacked) => P({ x: stacked ? 0 : 0.24, y: stacked ? 0.12 : 0.03, theta: -0.3, r: stacked ? 128 : 100, sway: 1 });
    const PS = (stacked) => P({ x: stacked ? 0 : 0.2, y: stacked ? -0.22 : -0.02, theta: 0, phi: 1.46, r: stacked ? 150 : 98, sway: 0.08 });
    const PI = (stacked) => P({ x: stacked ? 0 : -0.27, y: stacked ? 0.24 : 0.05, theta: 0.35, phi: 1.46, r: stacked ? 150 : 128, sway: 0.25 });
    Object.assign(inst, {
      pose(_, stacked) {
        let p = mix(PH(stacked), PS(stacked), ease(st.show.progress));
        p = mix(p, PI(stacked), ease(st.index.progress));
        if (active !== 'show') inst.spin = 0;
        return p;
      },
      opacity() {
        const s = window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;
        // en portrait, l'index passe par-dessus le mannequin : il s'efface un peu
        return 1 - 0.75 * st.foot.progress - (s ? 0.55 * st.index.progress : 0);
      },
      resume() { const k = active; active = ''; zone(k); },
      setThumbs(map) { $$('.lb-card', root).forEach((c) => { const img = $('img', c); if (map[c.dataset.id]) { img.src = map[c.dataset.id]; img.classList.add('ready'); } }); },
    });
    return inst;
  },
};
