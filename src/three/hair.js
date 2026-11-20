import * as THREE from 'three';
import gsap from 'gsap';
import { buildHairstyle } from './hairStyles.js';

/** Gère les coiffures posées sur l'avatar : cache, transitions, couleur. */
export class HairManager {
  constructor(parent) {
    this.parent = parent;
    this.cache = new Map();
    this.current = null; // id affiché
    this.color = new THREE.Color('#15100d');
    this.tip = new THREE.Color('#15100d');
    this.ctx = null;       // volume réel des cheveux (scan) : adapte certains styles
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
      const h = buildHairstyle(style.kind, '#15100d', this.ctx);
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
    const o = { t: 0 };
    gsap.to(o, {
      t: 1, duration: 0.8, ease: 'power2.out',
      onUpdate: () => {
        this.color.copy(from).lerp(target, o.t);
        this.tip.copy(fromTip).lerp(tip, o.t);
        for (const h of this.cache.values()) { h.common.uColor.value.copy(this.color); h.common.uTip.value.copy(this.tip); }
      },
    });
  }

  prebuild(styles) { styles.forEach((s) => this.get(s)); }
}
