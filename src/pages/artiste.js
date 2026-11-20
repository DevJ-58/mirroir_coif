// Atelier artiste : une photo de coiffure → modèle 3D (TRELLIS, gratuit) → découpage des cheveux
// → calage sur le mannequin GARO → publication dans la cabine. Tout est enregistré sur l'appareil.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, ease, mix, P, pageHero, pageFoot, reveals, eyebrow, esc } from './kit.js';

const TOKEN_KEY = 'garo-hf-token';
const MAX_VIEWS = 4;
const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } } };

export default {
  id: 'artiste', path: '/artiste', title: 'Atelier artiste', label: 'Atelier',
  html: ({ CATEGORIES }) => `
    ${pageHero({
      kicker: 'Atelier artiste',
      title: 'Ate|lier',
      lede: 'Déposez la photo d’une coiffure. GARO la sculpte en 3D, garde les cheveux, la pose sur le mannequin et l’ajoute à la cabine.',
    })}
    <section class="pg-s at" id="atelier">
      <div class="at__col">
        <article class="at-step is-on" data-step="0">
          <header><span class="at-step__n">01</span><h2>La photo</h2></header>
          <p class="at-step__hint">Une vue par photo (face, trois-quarts ou dos), coiffure entière, fond uni si possible. Si votre image contient plusieurs vues, sélectionnez-en une à la souris, puis ajoutez les autres une par une.</p>
          <label class="at-drop" id="atDrop">
            <input type="file" id="atFile" accept="image/*,.glb" hidden />
            <span class="at-drop__t">Choisir une photo</span>
            <span class="at-drop__s">ou la glisser ici · JPG, PNG</span>
          </label>
          <div class="at-crop" id="atCrop" hidden>
            <canvas id="atCanvas"></canvas>
            <i class="at-crop__sel" id="atSel"></i>
          </div>
          <div class="at-crop__bar" id="atCropBar" hidden>
            <button class="link-btn" type="button" id="atAll">Toute l’image</button>
            <button class="btn btn--ghost btn--sm" type="button" id="atAdd"><span class="btn__label">Ajouter cette vue</span></button>
          </div>
          <ol class="at-views" id="atViews"></ol>
        </article>

        <article class="at-step" data-step="1">
          <header><span class="at-step__n">02</span><h2>Sculpture en 3D</h2></header>
          <p class="at-step__hint">La photo est envoyée au service gratuit <b>TRELLIS</b> (Microsoft, hébergé par Hugging Face). Comptez 30 secondes à quelques minutes selon la file d’attente.</p>
          <button class="btn btn--primary magnetic" type="button" id="atGo" disabled><span class="btn__bg"></span><span class="btn__label">Transformer en 3D</span><span class="btn__dot"></span></button>
          <div class="at-prog" id="atProg" hidden><i id="atBar"></i></div>
          <p class="at-status" id="atStatus" aria-live="polite"></p>
          <details class="at-opt">
            <summary>Options</summary>
            <label class="dep__f"><span>Jeton Hugging Face (facultatif)</span><input id="atToken" type="password" autocomplete="off" placeholder="hf_…" /></label>
            <p class="at-step__hint">Un compte Hugging Face gratuit donne un quota de calcul plus large. Le jeton reste sur cet appareil.</p>
          </details>
        </article>

        <article class="at-step" data-step="2">
          <header><span class="at-step__n">03</span><h2>Découpage et calage</h2></header>
          <p class="at-step__hint" id="atAuto">GARO garde les cheveux et retire la tête générée. Ajustez si besoin : le résultat s’affiche sur le mannequin.</p>
          <div class="at-sliders">
            <label><span>Découpage <b id="vThr"></b></span><input type="range" id="sThr" min="0.2" max="0.85" step="0.01" value="0.5" /></label>
            <label><span>Taille <b id="vScale"></b></span><input type="range" id="sScale" min="0.6" max="1.6" step="0.01" value="1" /></label>
            <label><span>Hauteur <b id="vDy"></b></span><input type="range" id="sDy" min="-10" max="10" step="0.1" value="0" /></label>
            <label><span>Avant / arrière <b id="vDz"></b></span><input type="range" id="sDz" min="-10" max="10" step="0.1" value="0" /></label>
            <label><span>Rotation <b id="vYaw"></b></span><input type="range" id="sYaw" min="-180" max="180" step="1" value="0" /></label>
            <label><span>Inclinaison <b id="vTilt"></b></span><input type="range" id="sTilt" min="-35" max="35" step="1" value="0" /></label>
          </div>
          <div class="at-row">
            <button class="link-btn" type="button" id="atRaw">Voir le modèle brut</button>
            <button class="link-btn" type="button" id="atSpin">Faire tourner</button>
            <button class="link-btn" type="button" id="atReset">Réinitialiser</button>
          </div>
        </article>

        <article class="at-step" data-step="3">
          <header><span class="at-step__n">04</span><h2>Publier</h2></header>
          <form class="at-form" id="atForm" novalidate>
            <label class="dep__f"><span>Nom</span><input name="name" required maxlength="40" placeholder="Locks attachées, dégradé" /></label>
            <label class="dep__f"><span>Catégorie</span><select name="cat">${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}</select></label>
            <div class="dep__row">
              <label class="dep__f"><span>Durée</span><input name="duration" placeholder="3 h" maxlength="12" /></label>
              <label class="dep__f"><span>Tarif (FCFA)</span><input name="price" placeholder="20 000" maxlength="12" /></label>
            </div>
            <label class="dep__f"><span>Description</span><textarea name="desc" rows="2" maxlength="220"></textarea></label>
            <p class="dep__err" id="atErr" aria-live="polite"></p>
            <div class="at-row">
              <button class="btn btn--primary" type="submit" id="atPub"><span class="btn__bg"></span><span class="btn__label">Publier dans la cabine</span><span class="btn__arrow">→</span></button>
              <button class="link-btn" type="button" id="atOpen" hidden>Essayer dans la cabine</button>
            </div>
          </form>
        </article>
      </div>
    </section>
    <section class="pg-s at-tips">
      ${eyebrow('Pour un bon résultat')}
      <div class="ab-vals__grid">
        <article data-reveal><span class="sl-why__n">I</span><h3>Une vue nette</h3><p>Photo bien éclairée, coiffure entière dans le cadre, sans texte ni autre personne. Plusieurs vues (face, profil, dos) améliorent le volume.</p></article>
        <article data-reveal><span class="sl-why__n">II</span><h3>Cheveux contrastés</h3><p>Le découpage distingue les cheveux de la peau par la couleur. Un mannequin clair et des cheveux foncés donnent le meilleur résultat.</p></article>
        <article data-reveal><span class="sl-why__n">III</span><h3>Ajuster, puis publier</h3><p>Réglez le découpage et le calage en faisant tourner le mannequin. La coiffure publiée apparaît dans la cabine de cet appareil.</p></article>
      </div>
      <p class="sl-note">Vous avez déjà un fichier 3D modélisé sur le mannequin GARO ? Déposez-le directement dans la cabine. <a href="/mannequin/garo-mannequin.glb" download>Télécharger le mannequin GARO (.glb)</a></p>
    </section>
    ${pageFoot({ path: '/salons', label: 'Salons', desc: 'Équiper votre salon, formules et simulateur.' })}
  `,
  mount(root, { hair, avatar, CATEGORIES, publish, onTry, toast }) {
    reveals(root);
    hair.hideAll(0.5);
    const steps = $$('.at-step', root);
    const unlock = (i) => steps.forEach((s, k) => s.classList.toggle('is-on', k <= i));
    const status = $('#atStatus', root), bar = $('#atBar', root), prog = $('#atProg', root);
    const tokenEl = $('#atToken', root);
    tokenEl.value = store.get(TOKEN_KEY);
    tokenEl.addEventListener('change', () => store.set(TOKEN_KEY, tokenEl.value.trim()));

    // ---------- 1. photo et sélection d'une vue ----------
    const cv = $('#atCanvas', root), cx = cv.getContext('2d'), sel = $('#atSel', root), crop = $('#atCrop', root);
    let img = null, rect = null;           // rect en pixels de l'image
    const views = [];                      // Blob[]
    function drawImage() {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      crop.hidden = false; $('#atCropBar', root).hidden = false;
      rect = null; paintSel();
    }
    function paintSel() {
      if (!rect) { sel.style.display = 'none'; return; }
      const b = cv.getBoundingClientRect(), s = b.width / img.width;
      Object.assign(sel.style, { display: 'block', left: `${rect.x * s}px`, top: `${rect.y * s}px`, width: `${rect.w * s}px`, height: `${rect.h * s}px` });
    }
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      const b = cv.getBoundingClientRect(), s = img.width / b.width;
      drag = { x: (e.clientX - b.left) * s, y: (e.clientY - b.top) * s, s, b };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const x = (e.clientX - drag.b.left) * drag.s, y = (e.clientY - drag.b.top) * drag.s;
      rect = { x: Math.max(0, Math.min(drag.x, x)), y: Math.max(0, Math.min(drag.y, y)), w: Math.abs(x - drag.x), h: Math.abs(y - drag.y) };
      paintSel();
    });
    cv.addEventListener('pointerup', () => { drag = null; if (rect && (rect.w < 20 || rect.h < 20)) rect = null; paintSel(); });
    window.addEventListener('resize', paintSel);
    $('#atAll', root).addEventListener('click', () => { rect = null; paintSel(); });

    const cropBlob = () => new Promise((res) => {
      const r = rect || { x: 0, y: 0, w: img.width, h: img.height };
      // carré, avec une marge blanche : le service attend un objet centré
      const side = Math.round(Math.max(r.w, r.h) * 1.12);
      const c = document.createElement('canvas'); c.width = c.height = Math.min(1024, side);
      const k = c.width / side, g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, r.x, r.y, r.w, r.h, (c.width - r.w * k) / 2, (c.height - r.h * k) / 2, r.w * k, r.h * k);
      c.toBlob((b) => res(b), 'image/png');
    });
    function renderViews() {
      $('#atViews', root).innerHTML = views.map((b, i) => `<li><img src="${URL.createObjectURL(b)}" alt="Vue ${i + 1}" /><button type="button" data-rm="${i}" aria-label="Retirer la vue">×</button></li>`).join('');
      $('#atGo', root).disabled = !views.length && !img;
    }
    $('#atAdd', root).addEventListener('click', async () => {
      if (!img || views.length >= MAX_VIEWS) return;
      views.push(await cropBlob());
      rect = null; paintSel(); renderViews();
      unlock(1);
    });
    $('#atViews', root).addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { views.splice(+b.dataset.rm, 1); renderViews(); } });

    async function takeFile(f) {
      if (!f) return;
      if (/\.glb$/i.test(f.name)) { await useModel(await f.arrayBuffer()); return; }
      if (!f.type.startsWith('image/')) { toast('Format attendu : une photo (JPG, PNG)'); return; }
      img = new Image();
      img.src = URL.createObjectURL(f);
      await img.decode();
      drawImage();
      renderViews();
      unlock(1);
    }
    $('#atFile', root).addEventListener('change', (e) => { const f = e.target.files?.[0]; e.target.value = ''; takeFile(f); });
    const drop = $('#atDrop', root);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); takeFile(e.dataTransfer?.files?.[0]); });

    // ---------- 2. conversion ----------
    let abort = null;
    const setStatus = (t, p) => { status.textContent = t; if (p != null) { prog.hidden = false; gsap.to(bar, { scaleX: p, duration: 0.6, ease: 'power2.out' }); } };
    $('#atGo', root).addEventListener('click', async () => {
      const list = views.length ? views : [await cropBlob()];
      const btn = $('#atGo', root);
      btn.disabled = true;
      abort = new AbortController();
      try {
        const { photoTo3D } = await import('../artist/convert.js');
        const buf = await photoTo3D(list, { token: tokenEl.value.trim(), onStatus: setStatus, signal: abort.signal });
        await useModel(buf);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        console.warn(e);
        const m = String(e?.message || e);
        setStatus(/quota|exceeded|GPU/i.test(m)
          ? 'Quota gratuit atteint pour le moment. Réessayez plus tard, ou ajoutez un jeton Hugging Face gratuit dans les options.'
          : `La conversion a échoué : ${m}`, null);
      } finally { btn.disabled = false; }
    });

    // ---------- 3. découpage, calage, aperçu ----------
    let A = null, hairObj = null, raw = null, spin = false;
    const S = { thr: $('#sThr', root), scale: $('#sScale', root), dy: $('#sDy', root), dz: $('#sDz', root), yaw: $('#sYaw', root), tilt: $('#sTilt', root) };
    const val = () => ({ threshold: +S.thr.value, scale: +S.scale.value, dy: +S.dy.value, dz: +S.dz.value, yaw: (+S.yaw.value * Math.PI) / 180, tilt: (+S.tilt.value * Math.PI) / 180 });
    function labels() {
      $('#vThr', root).textContent = `${Math.round((1 - +S.thr.value) * 100)} %`;
      $('#vScale', root).textContent = `× ${(+S.scale.value).toFixed(2)}`;
      $('#vDy', root).textContent = `${(+S.dy.value).toFixed(1)} cm`;
      $('#vDz', root).textContent = `${(+S.dz.value).toFixed(1)} cm`;
      $('#vYaw', root).textContent = `${S.yaw.value}°`;
      $('#vTilt', root).textContent = `${S.tilt.value}°`;
    }
    function clearPreview() {
      [hairObj, raw].forEach((o) => { if (o) { avatar.group.remove(o); o.traverse((m) => m.isMesh && m.geometry.dispose()); } });
      hairObj = null; raw = null;
    }
    let rebuildT = 0;
    async function rebuild() {
      if (!A) return;
      const { buildHair } = await import('../artist/cleanup.js');
      if (hairObj) { avatar.group.remove(hairObj); hairObj.traverse((m) => m.isMesh && m.geometry.dispose()); }
      const r = buildHair(A, val());
      hairObj = r.group;
      avatar.group.add(hairObj);
      if (raw) raw.visible = false;
      $('#atAuto', root).textContent = `${r.triangles.toLocaleString('fr-FR')} triangles gardés · calage automatique par ${A.auto.method === 'cou' ? 'le cou et la naissance des cheveux' : 'la taille de la coiffure'}. Ajustez si besoin.`;
      labels();
    }
    const schedule = () => { cancelAnimationFrame(rebuildT); rebuildT = requestAnimationFrame(rebuild); };
    Object.values(S).forEach((s) => s.addEventListener('input', () => { labels(); schedule(); }));
    async function useModel(buf) {
      setStatus('Découpage des cheveux…', 0.95);
      const { analyse } = await import('../artist/cleanup.js');
      A = await analyse(buf);
      A.buffer = buf;
      clearPreview();
      hair.hideAll(0.3);
      await rebuild();
      setStatus('Coiffure prête : vérifiez le calage sur le mannequin.', 1);
      unlock(3);
      window.__garoLenis?.scrollTo(steps[2], { duration: 1.2, offset: -100 });
    }
    $('#atRaw', root).addEventListener('click', async (e) => {
      const btnRaw = e.currentTarget;
      if (!A) return;
      if (!raw) {
        const { buildHair } = await import('../artist/cleanup.js');
        raw = buildHair(A, { ...val(), threshold: -1 }).group;
        raw.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.5; m.material.depthWrite = false; } });
        raw.visible = false;
        avatar.group.add(raw);
      }
      raw.visible = !raw.visible;
      btnRaw.textContent = raw.visible ? 'Masquer le modèle brut' : 'Voir le modèle brut';
    });
    $('#atSpin', root).addEventListener('click', (e) => { spin = !spin; e.currentTarget.textContent = spin ? 'Arrêter la rotation' : 'Faire tourner'; });
    $('#atReset', root).addEventListener('click', () => { S.thr.value = 0.5; S.scale.value = 1; S.dy.value = 0; S.dz.value = 0; S.yaw.value = 0; S.tilt.value = 0; schedule(); });

    // ---------- 4. publication ----------
    let published = null;
    $('#atForm', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#atErr', root);
      if (!hairObj) { err.textContent = 'Transformez d’abord une photo en 3D.'; return; }
      const d = Object.fromEntries(new FormData(e.currentTarget));
      if (!d.name.trim()) { err.textContent = 'Donnez un nom à la coiffure.'; return; }
      err.textContent = '';
      const btn = $('#atPub', root); btn.disabled = true;
      try {
        const { exportHair } = await import('../artist/cleanup.js');
        const data = await exportHair(hairObj);
        published = await publish({ name: d.name.trim(), cat: d.cat, duration: d.duration.trim(), price: d.price.trim(), desc: d.desc.trim(), data });
        toast(`« ${published.name} » publiée dans la cabine`);
        $('#atOpen', root).hidden = false;
      } catch (er) { console.warn(er); err.textContent = 'Publication impossible : ' + (er?.message || er); }
      finally { btn.disabled = false; }
    });
    $('#atOpen', root).addEventListener('click', () => { if (published) { clearPreview(); onTry(published.id); } });

    // ---------- mannequin ----------
    const st = {
      ws: ScrollTrigger.create({ trigger: '#atelier', start: 'top 80%', end: 'top 10%' }),
      foot: ScrollTrigger.create({ trigger: '.at-tips', start: 'top 70%', end: 'top 10%' }),
    };
    const PH = (s) => P({ x: s ? 0 : 0.26, y: s ? 0.12 : 0.03, theta: -0.4, r: s ? 128 : 100, sway: 1 });
    const PW = (s) => P({ x: s ? 0 : 0.27, y: s ? -0.28 : 0.04, theta: 0.35, phi: 1.46, r: s ? 160 : 112, sway: 0.08 });
    const inst = {
      spin: 0,
      pose(_, s) {
        inst.spin = spin ? (performance.now() / 1000) * 0.8 : 0;
        return mix(PH(s), PW(s), ease(st.ws.progress));
      },
      opacity() {
        const s = window.matchMedia('(orientation: portrait), (max-width: 760px)').matches;
        return 1 - 0.6 * st.foot.progress - (s ? 0.0 : 0);
      },
      destroy() { abort?.abort(); clearPreview(); },
    };
    labels();
    return inst;
  },
};
