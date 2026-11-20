import * as THREE from 'three';
import gsap from 'gsap';
import { buildHairstyle } from './hairStyles.js';
import { buildGlbHair } from './glbHair.js';

const DEFAULT_HEX = '#15100d';

/** Gère les coiffures posées sur l'avatar : cache, transitions, couleur. */
export class HairManager {
  constructor(parent) {
    this.parent = parent;
    this.cache = new Map();
    this.current = null; // id affiché
    this.color = new THREE.Color('#15100d');
    this.tip = new THREE.Color('#15100d');
    this.ctx = null;       // volume réel des cheveux (scan) : adapte certains styles
    this.tint = 0;         // coiffures .glb : 0 = couleurs d'origine du fichier
    this.onChange = null;  // appelé quand la coiffure affichée change (id ou null)
  }

  /** Nouveau contexte (scan) : les coiffures sont reconstruites à la demande. */
  setContext(ctx) {
    this.ctx = ctx;
    for (const h of this.cache.values()) {
      this.parent.remove(h.group);
      h.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    }
    this.cache.clear();
    this.current = null;
    this.onChange?.(null);
  }

  get(style) {
    if (!this.cache.has(style.id)) {
      const h = style.kind === 'glb' ? this._glb(style) : buildHairstyle(style.kind, DEFAULT_HEX, this.ctx);
      h.group.visible = false;
      h.common.uGrow.value = 0;
      this.parent.add(h.group);
      this.cache.set(style.id, h);
    }
    const h = this.cache.get(style.id);
    h.common.uColor.value.copy(this.color);
    h.common.uTip.value.copy(this.tip);
    return h;
  }

  _glb(style) {
    const common = { uColor: { value: this.color.clone() }, uTip: { value: this.tip.clone() }, uGrow: { value: 1 }, uTint: { value: this.tint } };
    const group = buildGlbHair(style.id, common);
    group.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
    return { group, common, glb: true };
  }

  /** Retire une coiffure du cache (coiffure déposée supprimée ou remplacée). */
  drop(id) {
    const h = this.cache.get(id); if (!h) return;
    if (this.current === id) { this.current = null; this.onChange?.(null); }
    this.parent.remove(h.group);
    h.group.traverse((o) => { if (o.isMesh) { if (!h.glb) o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); } });
    this.cache.delete(id);
  }

  /** Affiche une coiffure. mode : 'drop' (glisse depuis le haut) | 'grow' | 'instant' */
  show(style, mode = 'drop') {
    if (this.current === style?.id) return;
    const prev = this.current ? this.cache.get(this.current) : null;
    if (prev) this._hide(prev, mode === 'instant' ? 0 : 0.45);
    this.current = style ? style.id : null;
    this.onChange?.(this.current);
    if (!style) return;
    const h = this.get(style);
    gsap.killTweensOf(h.common.uGrow);
    gsap.killTweensOf(h.group.position);
    gsap.killTweensOf(h.group.scale);
    h.group.visible = true;
    if (mode === 'instant') {
      h.common.uGrow.value = 1; h.group.position.set(0, 0, 0); h.group.scale.setScalar(1);
      return;
    }
    if (mode === 'drop') {
      h.group.position.set(0, 9, 0);
      h.group.scale.setScalar(1.06);
      h.common.uGrow.value = 0.05;
      gsap.to(h.group.position, { y: 0, duration: 0.9, ease: 'expo.out' });
      gsap.to(h.group.scale, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'elastic.out(1, 0.55)' });
      gsap.to(h.common.uGrow, { value: 1, duration: 1.0, ease: 'power3.out' });
    } else {
      h.group.position.set(0, 0, 0); h.group.scale.setScalar(1);
      h.common.uGrow.value = 0;
      gsap.to(h.common.uGrow, { value: 1, duration: 1.6, ease: 'power2.inOut' });
    }
  }

  _hide(h, d) {
    gsap.killTweensOf(h.common.uGrow);
    gsap.killTweensOf(h.group.position);
    if (!d) { h.common.uGrow.value = 0; h.group.visible = false; return; }
    gsap.to(h.group.position, { y: 2.5, duration: d, ease: 'power2.in' });
    gsap.to(h.common.uGrow, { value: 0, duration: d, ease: 'power2.in', onComplete: () => { h.group.visible = false; } });
  }

  hideAll(d = 0.5) {
    if (!this.current) return;
    this._hide(this.cache.get(this.current), d);
    this.current = null;
    this.onChange?.(null);
  }

  setColor(hex, tipHex) {
    const target = new THREE.Color(hex), tip = new THREE.Color(tipHex || hex);
    const from = this.color.clone(), fromTip = this.tip.clone();
    const fromTint = this.tint, toTint = hex.toLowerCase() === DEFAULT_HEX ? 0 : 1;
    const o = { t: 0 };
    gsap.to(o, {
      t: 1, duration: 0.8, ease: 'power2.out',
      onUpdate: () => {
        this.color.copy(from).lerp(target, o.t);
        this.tip.copy(fromTip).lerp(tip, o.t);
        this.tint = fromTint + (toTint - fromTint) * o.t;
        for (const h of this.cache.values()) { h.common.uColor.value.copy(this.color); h.common.uTip.value.copy(this.tip); if (h.common.uTint) h.common.uTint.value = this.tint; }
      },
    });
  }

  prebuild(styles) { styles.forEach((s) => this.get(s)); }
}
