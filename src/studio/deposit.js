// Dépôt de coiffures 3D (.glb) dans la cabine : aperçu immédiat sur le mannequin,
// fiche (nom, catégorie, durée, tarif), sauvegarde sur l'appareil.
import gsap from 'gsap';
import { registerGlb, forgetGlb, saveStyle, deleteStyle, loadStyles } from '../three/glbHair.js';

const $ = (s, r = document) => r.querySelector(s);
const MAX = 40 * 1024 * 1024;   // 40 Mo

export function initDeposit({ STYLES, CATEGORIES, hair, state, select, refreshCollection, toast }) {
  const dlg = $('#dep'), form = $('#depForm'), info = $('#depInfo'), err = $('#depErr');
  $('#depCat').innerHTML = CATEGORIES.filter((c) => c.id !== 'all').map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
  let pending = null;   // { id, data, prev }

  const toStyle = (r) => ({ id: r.id, kind: 'glb', name: r.name, cat: r.cat, duration: r.duration || '—', price: r.price || '—', desc: r.desc || 'Coiffure déposée par le salon.', custom: true });

  async function open(file) {
    if (!file) return;
    if (!/\.glb$/i.test(file.name)) { toast('Format attendu : un fichier .glb'); return; }
    if (file.size > MAX) { toast('Fichier trop lourd (40 Mo au plus)'); return; }
    form.reset(); err.textContent = '';
    form.name.value = file.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40);
    info.textContent = 'Lecture du fichier…';
    dlg.classList.add('is-on'); dlg.setAttribute('aria-hidden', 'false');
    $('#depSave').disabled = true;
    const id = 'glb-' + Date.now().toString(36);
    try {
      const data = await file.arrayBuffer();
      const r = await registerGlb(id, data);
      pending = { id, data, prev: state.selected };
      info.textContent = `${r.meshes} objet${r.meshes > 1 ? 's' : ''}, ${r.tris.toLocaleString('fr-FR')} triangles, ${r.size[0]} × ${r.size[1]} × ${r.size[2]} cm${r.scale !== 1 ? ' (converti depuis des mètres)' : ''}. Aperçu sur le mannequin.`;
      if (r.size[1] > 120 || r.size[0] > 120) err.textContent = 'La coiffure semble très grande : vérifiez l’échelle dans votre logiciel 3D.';
      hair.show({ id, kind: 'glb', name: form.name.value }, 'drop');
      $('#depSave').disabled = false;
      form.name.focus();
    } catch (e) {
      console.warn(e);
      info.textContent = 'Ce fichier n’a pas pu être lu.';
      err.textContent = 'Exportez la coiffure en glTF binaire (.glb) depuis Blender, sans compression Draco.';
      forgetGlb(id);
    }
  }

  function close() {
    dlg.classList.remove('is-on'); dlg.setAttribute('aria-hidden', 'true');
  }
  function cancel() {
    if (pending) {
      hair.drop(pending.id); forgetGlb(pending.id);
      if (pending.prev) hair.show(pending.prev, 'drop');
      pending = null;
    }
    close();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pending) return;
    const d = Object.fromEntries(new FormData(form));
    if (!d.name.trim()) { err.textContent = 'Donnez un nom à la coiffure.'; return; }
    const rec = { id: pending.id, name: d.name.trim(), cat: d.cat, duration: d.duration.trim(), price: d.price.trim(), desc: d.desc.trim(), data: pending.data, added: Date.now() };
    try { await saveStyle(rec); } catch (er) { console.warn(er); err.textContent = 'Enregistrement impossible sur cet appareil (stockage plein ?).'; return; }
    const style = toStyle(rec);
    STYLES.push(style);
    pending = null;
    close();
    await refreshCollection();
    select(style, true);
    toast(`« ${style.name} » ajoutée à la collection`);
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]'); if (!a) return;
    if (a.dataset.action === 'add-style') $('#glbInput').click();
    if (a.dataset.action === 'dep-cancel') cancel();
    if (a.dataset.action === 'remove-style') remove(state.selected);
  });
  $('#glbInput').addEventListener('change', (e) => { const f = e.target.files?.[0]; e.target.value = ''; open(f); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg.classList.contains('is-on')) cancel(); });

  // glisser-déposer un fichier dans la cabine
  let depth = 0;
  const inStudio = () => state.screen === 'studio';
  window.addEventListener('dragenter', (e) => { if (!inStudio() || !e.dataTransfer?.types?.includes('Files')) return; depth++; document.body.classList.add('is-dragging'); });
  window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('is-dragging'); });
  window.addEventListener('dragover', (e) => { if (inStudio()) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    depth = 0; document.body.classList.remove('is-dragging');
    if (!inStudio()) return;
    e.preventDefault();
    open(e.dataTransfer?.files?.[0]);
  });

  async function remove(style) {
    if (!style?.custom) return;
    if (!window.confirm(`Retirer « ${style.name} » de la collection de cet appareil ?`)) return;
    await deleteStyle(style.id).catch(() => {});
    hair.drop(style.id); forgetGlb(style.id);
    const i = STYLES.indexOf(style); if (i >= 0) STYLES.splice(i, 1);
    await refreshCollection();
    select(STYLES[0], true);
    toast(`« ${style.name} » retirée`);
  }

  return {
    /** Coiffures déposées précédemment sur cet appareil. */
    async restore() {
      const recs = (await loadStyles()).sort((a, b) => (a.added || 0) - (b.added || 0));
      let n = 0;
      for (const r of recs) {
        try { await registerGlb(r.id, r.data); STYLES.push(toStyle(r)); n++; } catch (e) { console.warn('coiffure illisible', r.name, e); }
      }
      return n;
    },
    /** Publication depuis l'atelier artiste : { name, cat, duration, price, desc, data: ArrayBuffer }. Renvoie le style. */
    async publish(fields) {
      const id = 'glb-' + Date.now().toString(36);
      await registerGlb(id, fields.data);
      const rec = { id, name: fields.name, cat: fields.cat, duration: fields.duration || '', price: fields.price || '', desc: fields.desc || '', data: fields.data, added: Date.now(), source: 'atelier' };
      await saveStyle(rec);
      const style = toStyle(rec);
      STYLES.push(style);
      await refreshCollection();
      return style;
    },
    /** Le bouton « retirer » n'apparaît que pour une coiffure déposée. */
    onSelect(style) { const b = $('.details__remove'); if (b) b.hidden = !style?.custom; },
  };
}

export { gsap };
