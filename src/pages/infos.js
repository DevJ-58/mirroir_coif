// Pages d'information : À propos (manifeste), FAQ, Contact.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, ease, mix, P, pageHero, pageFoot, reveals, eyebrow, esc } from './kit.js';

const isStacked = () => window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;

// ---------- À PROPOS ----------
export const apropos = {
  id: 'apropos', path: '/a-propos', title: 'Allons se garo', label: 'Allons se garo',
  html: () => `
    ${pageHero({
      kicker: 'Le manifeste',
      title: 'Allons|se garo.',
      lede: 'En nouchi, « se garo », c’est se coiffer. « Allons se garo », c’est l’invitation qu’on lance à une amie, un frère, avant de passer au salon.',
    })}
    <section class="pg-s ab-word">
      <div class="ab-def" data-reveal>
        <p class="ab-def__w">garo <span>/ga.ʁo/</span></p>
        <p class="ab-def__c">verbe · nouchi, Côte d’Ivoire</p>
        <p class="ab-def__d"><b>Se garo :</b> se coiffer, se faire coiffer. <em>« Samedi on va se garo à Yopougon. »</em></p>
      </div>
    </section>
    <section class="pg-s ab-man">
      ${eyebrow('Pourquoi GARO existe')}
      <p class="ab-man__t" id="abMan">Au salon, la même question revient chaque jour : « est-ce que ça m’irait ? ». On montre une photo sur un téléphone, on imagine, on hésite. Parfois on regrette. GARO met la réponse sous les yeux du client, sur sa propre tête, avant le premier geste. Pour que le coiffeur montre tout ce qu’il sait faire, et que le client ose.</p>
    </section>
    <section class="pg-s ab-vals">
      ${eyebrow('Ce qui nous guide')}
      <div class="ab-vals__grid">
        <article data-reveal><span class="sl-why__n">I</span><h3>Le salon d’abord</h3><p>GARO est un outil pour les coiffeurs. Il ne remplace ni leur œil ni leurs mains : il les met en valeur.</p></article>
        <article data-reveal><span class="sl-why__n">II</span><h3>Nos cheveux, vraiment</h3><p>Tresses, locks, waves, afro : les coiffures d’ici, construites avec soin, pas des modèles importés et mal adaptés.</p></article>
        <article data-reveal><span class="sl-why__n">III</span><h3>Le visage reste privé</h3><p>Le scan se fait sur l’appareil du salon. Aucune photo n’est envoyée, aucune n’est gardée.</p></article>
      </div>
    </section>
    ${pageFoot({ path: '/faq', label: 'Questions', desc: 'Tout ce qu’on nous demande, pour les clients et pour les salons.' })}
  `,
  mount(root, { hair, STYLES }) {
    reveals(root);
    hair.show(STYLES.find((s) => s.id === 'waves'), 'drop');
    const man = $('#abMan', root);
    man.innerHTML = man.textContent.split(/\s+/).map((w) => `<span class="mw">${w}</span>`).join(' ');
    gsap.to($$('.mw', man), { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: man, start: 'top 75%', end: 'bottom 55%', scrub: 1 } });
    const st = {
      word: ScrollTrigger.create({ trigger: '.ab-word', start: 'top 80%', end: 'top 20%' }),
      man: ScrollTrigger.create({ trigger: '.ab-man', start: 'top 80%', end: 'top 20%' }),
      foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }),
    };
    const A = (s) => P({ x: s ? 0 : 0.27, y: s ? 0.12 : 0.03, theta: -0.3, r: s ? 128 : 100, sway: 1 });
    const B = (s) => P({ x: s ? 0 : 0.28, y: s ? 0.3 : 0.03, theta: -0.9, phi: 1.46, r: s ? 150 : 108, sway: 0.4 });
    const C = (s) => P({ x: s ? 0 : -0.3, y: s ? 0.34 : 0.05, theta: 0.8, phi: 1.44, r: s ? 160 : 118, sway: 0.4 });
    return {
      pose: (_, s) => mix(mix(A(s), B(s), ease(st.word.progress)), C(s), ease(st.man.progress)),
      opacity: () => 1 - (isStacked() ? 0.8 * st.man.progress : 0) - 0.6 * st.foot.progress,
    };
  },
};

// ---------- FAQ ----------
const FAQ = [
  ['Pour les clients', [
    ['Est-ce que mon visage est enregistré ?', 'Non. Le scan est calculé sur l’appareil du salon et effacé à la fin de la séance. Aucune image ne part sur internet.'],
    ['Combien de temps dure le scan ?', 'Quelques secondes : vous regardez la caméra, puis tournez un peu la tête de chaque côté. Votre visage apparaît sur le mannequin juste après.'],
    ['Pourquoi un mannequin et pas ma tête entière ?', 'Votre visage, son relief et votre teint sont posés sur une tête unique, le mannequin GARO. Toutes les coiffures sont conçues pour lui : elles tombent juste, et vous jugez la coupe avec votre propre visage.'],
    ['Puis-je essayer sans scanner ?', 'Oui : toute la collection peut être explorée sur le mannequin, sans caméra.'],
  ]],
  ['Pour les salons', [
    ['Quel matériel faut-il ?', 'Une tablette ou un téléphone récent avec caméra avant suffit pour commencer. Une télévision ou une borne peuvent s’ajouter pour la vitrine.'],
    ['Puis-je afficher mes propres coiffures et mes prix ?', 'Oui, à partir de la formule Salon : coiffures, durées, tarifs et teintes sont ceux de votre carte.'],
    ['Faut-il une connexion internet ?', 'Pour ouvrir l’application et recevoir les mises à jour, oui. Le scan et l’essayage, eux, tournent sur l’appareil.'],
    ['Y a-t-il un engagement ?', 'Non : l’abonnement est mensuel et résiliable à tout moment.'],
  ]],
];
export const faq = {
  id: 'faq', path: '/faq', title: 'Questions fréquentes', label: 'FAQ',
  html: () => `
    ${pageHero({ kicker: 'Questions fréquentes', title: 'Ques|tions', lede: 'Les réponses courtes à ce qu’on nous demande le plus souvent.' })}
    ${FAQ.map(([g, qs], gi) => `<section class="pg-s fq">
      ${eyebrow(g)}
      <div class="fq__list">${qs.map(([q, a], i) => `<details class="fq__item" data-reveal${gi === 0 && i === 0 ? ' open' : ''}>
        <summary><span>${esc(q)}</span><i aria-hidden="true"></i></summary>
        <div class="fq__a"><p>${esc(a)}</p></div>
      </details>`).join('')}</div>
    </section>`).join('')}
    <section class="pg-s fq-more" data-reveal>
      <p class="body">Une autre question ?</p>
      <a class="btn btn--ghost magnetic" href="/contact" data-link><span class="btn__label">Nous écrire</span></a>
    </section>
    ${pageFoot({ path: '/contact', label: 'Contact', desc: 'Une démonstration, un devis, une question.' })}
  `,
  mount(root, { hair, STYLES }) {
    reveals(root);
    hair.show(STYLES.find((s) => s.id === 'fade'), 'drop');
    // ouverture animée des réponses
    $$('.fq__item', root).forEach((d) => {
      const s = $('summary', d), a = $('.fq__a', d);
      s.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.open) gsap.to(a, { height: 0, opacity: 0, duration: 0.5, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(a, { clearProps: 'all' }); } });
        else { d.open = true; gsap.fromTo(a, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.7, ease: 'expo.out' }); }
      });
    });
    const st = { list: ScrollTrigger.create({ trigger: '.fq', start: 'top 80%', end: 'top 20%' }), foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }) };
    const A = (s) => P({ x: s ? 0 : 0.27, y: s ? 0.12 : 0.03, theta: 0.4, r: s ? 128 : 100, sway: 1 });
    const B = (s) => P({ x: s ? 0 : 0.32, y: s ? 0.34 : 0.05, theta: -0.6, phi: 1.46, r: s ? 160 : 124, sway: 0.5 });
    return {
      pose: (_, s) => mix(A(s), B(s), ease(st.list.progress)),
      opacity: () => 1 - (isStacked() ? 0.85 : 0.1) * st.list.progress - 0.6 * st.foot.progress,
    };
  },
};

// ---------- CONTACT ----------
// Adresse de démonstration : à remplacer par celle de GARO.
const MAIL = 'bonjour@garo.ci';
export const contact = {
  id: 'contact', path: '/contact', title: 'Contact', label: 'Contact',
  html: () => `
    ${pageHero({ kicker: 'Démonstration, devis, question', title: 'Parlons|coiffure.', lede: 'Dites-nous qui vous êtes et ce que vous cherchez. Nous répondons sous 48 heures, et nous venons au salon pour la démonstration.' })}
    <section class="pg-s ct">
      <form class="ct__form" id="ctForm" novalidate>
        <div class="ct__seg sl-seg" role="radiogroup" aria-label="Vous êtes">
          <button type="button" class="is-on" data-who="salon">Un salon</button><button type="button" data-who="client">Un client</button><button type="button" data-who="autre">Autre</button>
        </div>
        <label class="ct__f" data-reveal><span class="k">Nom</span><input name="nom" autocomplete="name" required /></label>
        <label class="ct__f ct__f--salon" data-reveal><span class="k">Salon et commune</span><input name="salon" placeholder="Ex. Maison Akwaba, Cocody" /></label>
        <label class="ct__f" data-reveal><span class="k">Téléphone ou e-mail</span><input name="contact" autocomplete="email" required /></label>
        <label class="ct__f" data-reveal><span class="k">Message</span><textarea name="message" rows="4" placeholder="Une démonstration, un devis, une question…"></textarea></label>
        <div class="ct__send" data-reveal>
          <button class="btn btn--primary magnetic" type="submit"><span class="btn__bg"></span><span class="btn__label">Envoyer</span><span class="btn__arrow">→</span></button>
          <p class="ct__msg" id="ctMsg" aria-live="polite"></p>
        </div>
      </form>
      <aside class="ct__side" data-reveal>
        <div><span class="k">Écrire</span><a href="mailto:${MAIL}">${MAIL}</a></div>
        <div><span class="k">Venir</span><span>Abidjan, Côte d’Ivoire</span></div>
        <div><span class="k">Horaires</span><span>Lundi – samedi, 9 h – 18 h</span></div>
      </aside>
    </section>
    ${pageFoot({ path: '/', label: 'Accueil', desc: 'Revenir au mannequin et lancer l’expérience.' })}
  `,
  mount(root, { hair, STYLES }) {
    reveals(root);
    hair.show(STYLES.find((s) => s.id === 'twists'), 'drop');
    let who = 'salon';
    const form = $('#ctForm', root);
    $('.ct__seg', root).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      who = b.dataset.who;
      $$('.ct__seg button', root).forEach((x) => x.classList.toggle('is-on', x === b));
      $('.ct__f--salon', root).classList.toggle('is-hidden', who !== 'salon');
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const msg = $('#ctMsg', root);
      if (!d.nom.trim() || !d.contact.trim()) { msg.textContent = 'Indiquez au moins votre nom et un moyen de vous joindre.'; gsap.fromTo(msg, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }); return; }
      // pas de serveur : le message s'ouvre dans la messagerie de l'appareil
      const sujet = who === 'salon' ? `Démonstration GARO — ${d.salon || d.nom}` : `Question GARO — ${d.nom}`;
      const corps = `Nom : ${d.nom}\n${who === 'salon' ? `Salon : ${d.salon}\n` : ''}Contact : ${d.contact}\n\n${d.message}`;
      location.href = `mailto:${MAIL}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
      msg.textContent = 'Votre messagerie s’ouvre avec le message prêt à partir.';
    });
    const st = { form: ScrollTrigger.create({ trigger: '.ct', start: 'top 80%', end: 'top 20%' }), foot: ScrollTrigger.create({ trigger: '.pg-foot', start: 'top bottom', end: 'top 30%' }) };
    const A = (s) => P({ x: s ? 0 : 0.27, y: s ? 0.12 : 0.03, theta: -0.4, r: s ? 128 : 100, sway: 1 });
    const B = (s) => P({ x: s ? 0 : 0.3, y: s ? 0.34 : 0.04, theta: 0.5, phi: 1.46, r: s ? 160 : 116, sway: 0.6 });
    return {
      pose: (_, s) => mix(A(s), B(s), ease(st.form.progress)),
      opacity: () => 1 - (isStacked() ? 0.85 : 0) * st.form.progress - 0.6 * st.foot.progress,
    };
  },
};
