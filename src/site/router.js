// Routeur du site : pages secondaires montées dans <main id="page">, sans rechargement.
// Le mannequin 3D reste à l'écran et glisse d'une pose à l'autre pendant la transition.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const $ = (s, r = document) => r.querySelector(s);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Normalise un chemin : sans barre finale, « / » pour l'accueil. */
export const norm = (p) => (p || '/').replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';

export function createRouter({ site, pages, ctx }) {
  const root = $('#page');
  let cur = null;          // { def, params, inst, gctx }
  let busy = false;
  let pendingPath = null;

  const match = (path) => {
    path = norm(path);
    if (path === '/') return { def: null, params: {} };
    for (const def of pages) {
      if (def.path === path) return { def, params: {} };
      if (def.match) { const params = def.match(path); if (params) return { def, params }; }
    }
    return { def: pages.find((p) => p.id === '404'), params: { path } };
  };

  function mount(m) {
    const { def, params } = m;
    root.innerHTML = def.html(ctx, params);
    root.dataset.page = def.id;
    document.body.classList.add('on-page');
    document.body.dataset.page = def.id;
    let inst = null;
    const gctx = gsap.context(() => { inst = def.mount(root, ctx, params) || {}; }, root);
    inst.pose = inst.pose || ((P) => P.final);
    site.openPage(inst);
    document.title = def.title ? `${typeof def.title === 'function' ? def.title(params) : def.title} — GARO` : 'GARO — Essayage capillaire 3D';
    cur = { def, params, inst, gctx };
    if (ctx.thumbs) inst.setThumbs?.(ctx.thumbs);
  }
  function unmount() {
    if (!cur?.def) return;
    cur.inst.destroy?.();
    cur.gctx.revert();
    root.innerHTML = '';
    delete root.dataset.page;
    cur = null;
  }

  function setActiveLinks(path) {
    document.querySelectorAll('a[data-link]').forEach((a) => {
      const href = norm(a.getAttribute('href'));
      a.classList.toggle('is-on', href === path || (href !== '/' && path.startsWith(href + '/')));
    });
  }

  /** Va vers une adresse. push = false pour le bouton précédent du navigateur. */
  async function go(path, { push = true, hash = '' } = {}) {
    path = norm(path);
    if (busy) { pendingPath = path; return; }
    const from = cur?.def ? norm(location.pathname) : '/';
    if (push && path === norm(location.pathname) && !hash) { site.lenis.scrollTo(0, { duration: 1.4 }); return; }
    busy = true;
    if (push) history.pushState({}, '', path + (hash || ''));
    setActiveLinks(path);
    const m = match(path);
    const leaving = cur?.def ? root : $('#site');
    // sortie : le contenu se floute et s'efface, le mannequin, lui, reste
    document.body.classList.add('is-routing');
    site.lenis.stop();
    if (!reduced) {
      await gsap.to(leaving, { opacity: 0, y: -40, filter: 'blur(14px)', duration: 0.6, ease: 'power3.in' });
    }
    gsap.set(leaving, { clearProps: 'opacity,transform,filter' });
    unmount();
    window.scrollTo(0, 0);
    site.lenis.scrollTo(0, { immediate: true, force: true });
    if (m.def) mount(m);
    else { document.body.classList.remove('on-page'); delete document.body.dataset.page; document.title = 'GARO — Essayage capillaire 3D'; }
    const entering = m.def ? root : $('#site');
    gsap.set(entering, { opacity: 0, y: 40, filter: 'blur(14px)' });
    await new Promise((r) => requestAnimationFrame(() => r()));
    ScrollTrigger.refresh();
    if (!m.def) site.closePage();
    site.lenis.start();
    if (hash && $(hash)) setTimeout(() => site.lenis.scrollTo(hash, { duration: 1.6 }), 300);
    await gsap.to(entering, { opacity: 1, y: 0, filter: 'blur(0px)', duration: reduced ? 0.2 : 0.9, ease: 'expo.out', clearProps: 'opacity,transform,filter' });
    cur?.inst?.enter?.();
    document.body.classList.remove('is-routing');
    busy = false;
    if (from !== path) ctx.onRoute?.(path);
    if (pendingPath && pendingPath !== path) { const p = pendingPath; pendingPath = null; go(p); } else pendingPath = null;
  }

  // liens internes
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !site.active) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    const [p, h] = href.split('#');
    ctx.beforeRoute?.();
    go(p || '/', { hash: h ? '#' + h : '' });
  });
  window.addEventListener('popstate', () => { if (site.active) go(location.pathname, { push: false }); });

  return {
    go,
    /** Monte la page de l'adresse courante au démarrage (sans transition). */
    start() {
      const path = norm(location.pathname);
      setActiveLinks(path);
      const m = match(path);
      if (m.def) mount(m);
      return Boolean(m.def);
    },
    get current() { return cur; },
    setThumbs(map) { ctx.thumbs = map; cur?.inst?.setThumbs?.(map); },
  };
}
