// Atelier artiste : une coiffure = une ou plusieurs photos d'un mannequin coiffé (face, trois-quarts,
// profil, dos). L'artiste place l'ovale du visage ; en cabine, le visage du client s'y pose.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, P, pageHero, pageFoot, reveals, eyebrow } from './kit.js';

const KINDS = [
  ['face', 'Face'], ['q-left', 'Trois-quarts, regard à gauche'], ['q-right', 'Trois-quarts, regard à droite'],
  ['p-left', 'Profil gauche'], ['p-right', 'Profil droit'], ['back', 'Dos'],
];
const MAX_VIEWS = 6;
const DEFAULT_FACE = { cx: 0.5, cy: 0.36, rx: 0.13, ry: 0.19, a: 0 };

export default {
  id: 'artiste', path: '/artiste', title: 'Atelier artiste', label: 'Atelier',
  html: ({ CATEGORIES }) => `
    ${pageHero({
      kicker: 'Atelier artiste',
      title: 'Ate|lier',
      lede: 'Déposez les photos d’un mannequin coiffé. Placez l’ovale du visage : en cabine, le visage du client s’y pose, avec son teint.',
    })}
    <section class="pg-s at" id="atelier">
      <div class="at__col">
        <article class="at-step is-on" data-step="0">
          <header><span class="at-step__n">01</span><h2>Les photos</h2></header>
          <p class="at-step__hint">Un mannequin clair, la coiffure entière, fond uni. Une vue par photo : face, trois-quarts, profil, dos. Si une image contient plusieurs vues, entourez-en une à la souris puis ajoutez-la ; recommencez pour les autres.</p>
          <label class="at-drop" id="atDrop">
            <input type="file" id="atFile" accept="image/*" multiple hidden />
            <span class="at-drop__t">Choisir des photos</span>
            <span class="at-drop__s">ou les glisser ici · JPG, PNG</span>
          </label>
          <div class="at-crop" id="atCrop" hidden><canvas id="atCanvas"></canvas><i class="at-crop__sel" id="atSel"></i></div>
          <div class="at-crop__bar" id="atCropBar" hidden>
            <button class="link-btn" type="button" id="atAll">Image entière</button>
            <button class="btn btn--ghost btn--sm" type="button" id="atAdd"><span class="btn__label">Ajouter cette vue</span></button>
          </div>
          <ol class="at-vlist" id="atViews"></ol>
        </article>

        <article class="at-step" data-step="1">
          <header><span class="at-step__n">02</span><h2>Le visage</h2></header>
          <p class="at-step__hint" id="atFaceHint">Pour chaque vue, placez l’ovale sur le visage du mannequin : du haut du front au menton, d’une joue à l’autre. Glissez pour déplacer, tirez les poignées pour ajuster.</p>
          <div class="at-edit" id="atEdit">
            <canvas id="atView"></canvas>
            <svg class="at-oval" id="atOval" aria-hidden="true">
              <ellipse id="atEll" /><circle class="h" id="atHx" r="9" /><circle class="h" id="atHy" r="9" />
            </svg>
          </div>
          <div class="at-sliders">
            <label><span>Inclinaison <b id="vTilt">0°</b></span><input type="range" id="sTilt" min="-25" max="25" step="1" value="0" /></label>
          </div>
          <div class="at-row">
            <button class="link-btn" type="button" id="atTest">Tester avec un visage</button>
            <input type="file" id="atFaceFile" accept="image/*" hidden />
            <button class="link-btn" type="button" id="atCompare" hidden>Voir la photo d’origine</button>
          </div>
          <p class="at-status" id="atStatus" aria-live="polite"></p>
        </article>

        <article class="at-step" data-step="2">
          <header><span class="at-step__n">03</span><h2>Publier</h2></header>
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
        <article data-reveal><span class="sl-why__n">I</span><h3>Le même mannequin</h3><p>Des photos d’un mannequin clair au visage lisse, sous une lumière douce. Le corps du mannequin prend le teint du client.</p></article>
        <article data-reveal><span class="sl-why__n">II</span><h3>Plusieurs vues</h3><p>Face, trois-quarts et dos : en cabine, le client passe d’une vue à l’autre comme s’il tournait autour de sa tête.</p></article>
        <article data-reveal><span class="sl-why__n">III</span><h3>L’ovale juste</h3><p>Du haut du front au menton. Les cheveux de la photo restent devant le visage : franges et contours sont conservés.</p></article>
      </div>
    </section>
    ${pageFoot({ path: '/salons', label: 'Salons', desc: 'Équiper votre salon, formules et simulateur.' })}
  `,
  mount(root, { hair, publishPhoto, onTry, toast, client: getClient }) {
    reveals(root);
    hair.hideAll(0.5);
    const steps = $$('.at-step', root);
    const unlock = (i) => steps.forEach((s, k) => s.classList.toggle('is-on', k <= i));
    const status = $('#atStatus', root);
    const views = [];   // { kind, blob, url, img, face }
    let cur = -1;

    // ---------- 1. photos et découpe ----------
    const cv = $('#atCanvas', root), cx = cv.getContext('2d'), sel = $('#atSel', root), crop = $('#atCrop', root);
    let img = null, rect = null, queue = [];
    function showCrop() {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      crop.hidden = false; $('#atCropBar', root).hidden = false;
      rect = null; paintSel();
    }
    function paintSel() {
      if (!rect || !img) { sel.style.display = 'none'; return; }
      const b = cv.getBoundingClientRect(), s = b.width / img.width;
      Object.assign(sel.style, { display: 'block', left: `${rect.x * s}px`, top: `${rect.y * s}px`, width: `${rect.w * s}px`, height: `${rect.h * s}px` });
    }
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { const b = cv.getBoundingClientRect(), s = img.width / b.width; drag = { x: (e.clientX - b.left) * s, y: (e.clientY - b.top) * s, s, b }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const x = (e.clientX - drag.b.left) * drag.s, y = (e.clientY - drag.b.top) * drag.s;
      rect = { x: Math.max(0, Math.min(drag.x, x)), y: Math.max(0, Math.min(drag.y, y)), w: Math.abs(x - drag.x), h: Math.abs(y - drag.y) };
      paintSel();
    });
    cv.addEventListener('pointerup', () => { drag = null; if (rect && (rect.w < 30 || rect.h < 30)) rect = null; paintSel(); });
    const onResize = () => { paintSel(); drawEditor(); };
    window.addEventListener('resize', onResize);
    $('#atAll', root).addEventListener('click', () => { rect = null; paintSel(); });

    const cutBlob = () => new Promise((res) => {
      const r = rect || { x: 0, y: 0, w: img.width, h: img.height };
      const k = Math.min(1, 1400 / Math.max(r.w, r.h));
      const c = document.createElement('canvas'); c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
      c.getContext('2d').drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      c.toBlob(res, 'image/jpeg', 0.92);
    });
    async function addView(blob) {
      if (views.length >= MAX_VIEWS) { toast('Six vues au plus par coiffure'); return; }
      const url = URL.createObjectURL(blob);
      const im = new Image(); im.src = url; await im.decode();
      const used = new Set(views.map((v) => v.kind));
      const kind = (KINDS.find(([k]) => !used.has(k)) || KINDS[0])[0];
      views.push({ kind, blob, url, img: im, face: kind === 'back' ? null : { ...DEFAULT_FACE } });
      renderList();
      select(views.length - 1);
      unlock(2);
    }
    $('#atAdd', root).addEventListener('click', async () => {
      if (!img) return;
      await addView(await cutBlob());
      rect = null; paintSel();
      if (queue.length) loadNext();
    });
    function renderList() {
      $('#atViews', root).innerHTML = views.map((v, i) => `<li class="${i === cur ? 'is-on' : ''}" data-i="${i}">
        <img src="${v.url}" alt="" />
        <select data-kind="${i}" aria-label="Type de vue">${KINDS.map(([k, l]) => `<option value="${k}"${k === v.kind ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" data-rm="${i}" aria-label="Retirer la vue">×</button>
      </li>`).join('');
    }
    $('#atViews', root).addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { const i = +rm.dataset.rm; URL.revokeObjectURL(views[i].url); views.splice(i, 1); cur = Math.min(cur, views.length - 1); renderList(); if (cur >= 0) select(cur); else drawEditor(); return; }
      const li = e.target.closest('li'); if (li && !e.target.closest('select')) select(+li.dataset.i);
    });
    $('#atViews', root).addEventListener('change', (e) => {
      const s = e.target.closest('[data-kind]'); if (!s) return;
      const v = views[+s.dataset.kind];
      v.kind = s.value;
      v.face = v.kind === 'back' ? null : (v.face || { ...DEFAULT_FACE });
      select(+s.dataset.kind);
    });

    async function loadNext() {
      const f = queue.shift(); if (!f) return;
      img = new Image(); img.src = URL.createObjectURL(f); await img.decode();
      showCrop();
      unlock(1);
    }
    async function takeFiles(list) {
      const files = [...list].filter((f) => f.type.startsWith('image/'));
      if (!files.length) { toast('Format attendu : des photos (JPG, PNG)'); return; }
      queue = files; await loadNext();
    }
    $('#atFile', root).addEventListener('change', (e) => { const fl = [...(e.target.files || [])]; e.target.value = ''; takeFiles(fl); });
    const drop = $('#atDrop', root);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); takeFiles(e.dataTransfer?.files || []); });

    // ---------- 2. ovale du visage ----------
    const vc = $('#atView', root), vg = vc.getContext('2d'), svg = $('#atOval', root);
    const ell = $('#atEll', root), hx = $('#atHx', root), hy = $('#atHy', root), tilt = $('#sTilt', root);
    let face = null;     // visage de test { shots, skin }
    let showOrig = false;
    const prepared = new Map();   // vue → analyse (pour l'aperçu)

    function select(i) {
      cur = i;
      $$('#atViews li', root).forEach((li, k) => li.classList.toggle('is-on', k === i));
      const v = views[i];
      tilt.value = Math.round(((v.face?.a || 0) * 180) / Math.PI);
      $('#vTilt', root).textContent = `${tilt.value}°`;
      $('#atFaceHint', root).textContent = v.kind === 'back'
        ? 'Vue de dos : pas de visage à placer. Le corps prend le teint du client.'
        : 'Placez l’ovale sur le visage du mannequin : du haut du front au menton, d’une joue à l’autre. Glissez pour déplacer, tirez les poignées pour ajuster.';
      drawEditor();
    }
    async function drawEditor() {
      const v = views[cur];
      if (!v) { vc.width = vc.height = 0; svg.style.display = 'none'; return; }
      const W = vc.parentElement.clientWidth || 600;
      const k = W / v.img.width;
      vc.width = Math.round(v.img.width * k); vc.height = Math.round(v.img.height * k);
      if (face && !showOrig) {
        try {
          const { analyseView, compose } = await import('../photo/compose.js');
          if (!prepared.has(v)) prepared.set(v, analyseView(v.img));
          const V = await prepared.get(v);
          V.kind = v.kind;
          V.face = v.face ? { cx: v.face.cx * V.w, cy: v.face.cy * V.h, rx: v.face.rx * V.w, ry: v.face.ry * V.h, a: v.face.a } : null;
          vg.drawImage(compose(V, face, {}), 0, 0, vc.width, vc.height);
        } catch (e) { console.warn(e); vg.drawImage(v.img, 0, 0, vc.width, vc.height); }
      } else vg.drawImage(v.img, 0, 0, vc.width, vc.height);
      paintOval();
    }
    function paintOval() {
      const v = views[cur];
      if (!v?.face) { svg.style.display = 'none'; return; }
      svg.style.display = 'block';
      const W = vc.width, H = vc.height, f = v.face;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.width = `${W}px`; svg.style.height = `${H}px`;
      const deg = (f.a * 180) / Math.PI;
      ell.setAttribute('cx', f.cx * W); ell.setAttribute('cy', f.cy * H);
      ell.setAttribute('rx', f.rx * W); ell.setAttribute('ry', f.ry * H);
      ell.setAttribute('transform', `rotate(${deg} ${f.cx * W} ${f.cy * H})`);
      const c = Math.cos(f.a), s = Math.sin(f.a);
      hx.setAttribute('cx', f.cx * W + c * f.rx * W); hx.setAttribute('cy', f.cy * H + s * f.rx * W);
      hy.setAttribute('cx', f.cx * W - s * f.ry * H); hy.setAttribute('cy', f.cy * H + c * f.ry * H);
    }
    let od = null;
    svg.addEventListener('pointerdown', (e) => {
      const v = views[cur]; if (!v?.face) return;
      const b = svg.getBoundingClientRect();
      od = { mode: e.target === hx ? 'rx' : e.target === hy ? 'ry' : 'move', x: e.clientX, y: e.clientY, f: { ...v.face }, W: b.width, H: b.height };
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    svg.addEventListener('pointermove', (e) => {
      if (!od) return;
      const v = views[cur], dx = (e.clientX - od.x) / od.W, dy = (e.clientY - od.y) / od.H;
      const c = Math.cos(od.f.a), s = Math.sin(od.f.a);
      if (od.mode === 'move') { v.face.cx = od.f.cx + dx; v.face.cy = od.f.cy + dy; }
      if (od.mode === 'rx') v.face.rx = Math.max(0.02, od.f.rx + (dx * c + dy * s * (od.H / od.W)));
      if (od.mode === 'ry') v.face.ry = Math.max(0.02, od.f.ry + (-dx * s * (od.W / od.H) + dy * c));
      paintOval();
    });
    svg.addEventListener('pointerup', () => { if (od) { od = null; if (face && !showOrig) drawEditor(); } });
    tilt.addEventListener('input', () => {
      const v = views[cur]; if (!v?.face) return;
      v.face.a = (+tilt.value * Math.PI) / 180;
      $('#vTilt', root).textContent = `${tilt.value}°`;
      paintOval();
    });
    tilt.addEventListener('change', () => { if (face) drawEditor(); });

    // visage de test : le scan en cours, sinon une photo choisie
    $('#atTest', root).addEventListener('click', () => {
      const c = getClient?.();
      if (c) { face = c; status.textContent = 'Aperçu avec le visage scanné en cabine.'; afterFace(); return; }
      $('#atFaceFile', root).click();
    });
    $('#atFaceFile', root).addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
      status.textContent = 'Lecture du visage…';
      try {
        const im = new Image(); im.src = URL.createObjectURL(f); await im.decode();
        const { scanImages } = await import('../scan/scanner.js');
        const { buildFace } = await import('../scan/face.js');
        const shots = await scanImages([im]);
        const sc = await buildFace(shots);
        face = { shots, skin: sc.skin };
        status.textContent = 'Aperçu avec ce visage. Ajustez l’ovale si besoin.';
        afterFace();
      } catch (er) { console.warn(er); status.textContent = 'Aucun visage trouvé sur cette photo.'; }
    });
    function afterFace() { showOrig = false; $('#atCompare', root).hidden = false; $('#atCompare', root).textContent = 'Voir la photo d’origine'; drawEditor(); }
    $('#atCompare', root).addEventListener('click', (e) => { showOrig = !showOrig; e.currentTarget.textContent = showOrig ? 'Voir l’aperçu' : 'Voir la photo d’origine'; drawEditor(); });

    // ---------- 3. publication ----------
    let published = null;
    $('#atForm', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#atErr', root);
      const form = e.currentTarget;
      if (!views.length) { err.textContent = 'Ajoutez au moins une photo.'; return; }
      if (!views.some((v) => v.kind === 'face')) { err.textContent = 'Il faut une vue de face.'; return; }
      const d = Object.fromEntries(new FormData(form));
      if (!d.name.trim()) { err.textContent = 'Donnez un nom à la coiffure.'; return; }
      err.textContent = '';
      const btn = $('#atPub', root); btn.disabled = true;
      try {
        // la vue de face d'abord, puis l'ordre d'un tour de tête
        const order = ['face', 'q-right', 'p-right', 'back', 'p-left', 'q-left'];
        const list = views.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
        const out = [];
        for (const v of list) out.push({ kind: v.kind, mime: 'image/jpeg', data: await v.blob.arrayBuffer(), face: v.face ? { ...v.face } : null });
        published = await publishPhoto({ name: d.name.trim(), cat: d.cat, duration: d.duration.trim(), price: d.price.trim(), desc: d.desc.trim(), views: out });
        toast(`« ${published.name} » publiée dans la cabine`);
        $('#atOpen', root).hidden = false;
      } catch (er) { console.warn(er); err.textContent = 'Publication impossible : ' + (er?.message || er); }
      finally { btn.disabled = false; }
    });
    $('#atOpen', root).addEventListener('click', () => { if (published) onTry(published.id); });

    // ---------- mannequin 3D : présent en ouverture, il s'efface dans l'atelier ----------
    const st = { ws: ScrollTrigger.create({ trigger: '#atelier', start: 'top 85%', end: 'top 35%' }) };
    const PH = (s) => P({ x: s ? 0 : 0.26, y: s ? 0.12 : 0.03, theta: -0.4, r: s ? 128 : 100, sway: 1 });
    return {
      pose: (_, s) => PH(s),
      opacity: () => 1 - st.ws.progress,
      destroy() { window.removeEventListener('resize', onResize); views.forEach((v) => URL.revokeObjectURL(v.url)); },
    };
  },
};
