import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';

export class Stage {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(r), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(26, 1, 1, 2000);
    this.camera.position.set(0, 2, 110);

    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.06, enablePan: false, minDistance: 48, maxDistance: 150,
      minPolarAngle: Math.PI * 0.22, maxPolarAngle: Math.PI * 0.62, rotateSpeed: 0.7, autoRotateSpeed: 1.2,
    });
    this.controls.target.set(0, 0, 0);
    this.controls.enabled = false;

    // éclairage studio
    const key = new THREE.DirectionalLight('#fff0dc', 2.4); key.position.set(-55, 62, 56);
    const rim = new THREE.DirectionalLight('#a9c0ff', 2.2); rim.position.set(62, 35, -70);
    const rim2 = new THREE.DirectionalLight('#ffb98a', 1.3); rim2.position.set(-70, 10, -60);
    const fill = new THREE.HemisphereLight('#fff7ee', '#2a201a', 0.55);
    this.scene.add(key, rim, rim2, fill);
    this.lights = { key, rim, rim2, fill };

    // racine de l'avatar : centre de la tête ≈ origine
    this.root = new THREE.Group();
    this.root.position.set(0, -1.5, 4.5);
    this.scene.add(this.root);

    this.view = { shiftX: 0, shiftY: 0 };
    this.updaters = new Set();
    this.clock = new THREE.Clock();
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    r.setAnimationLoop(() => this._tick());
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._applyView();
  }

  _applyView() {
    const w = window.innerWidth, h = window.innerHeight;
    if (this.view.shiftX || this.view.shiftY) this.camera.setViewOffset(w, h, -this.view.shiftX * w, -this.view.shiftY * h, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** Décale l'avatar à l'écran (fraction de la largeur). */
  shift(x, y = 0, duration = 1.4) {
    gsap.to(this.view, { shiftX: x, shiftY: y, duration, ease: 'expo.inOut', onUpdate: () => this._applyView() });
  }

  /** Place la caméra en coordonnées sphériques autour de la cible. */
  orbitTo({ theta = 0, phi = 1.48, radius = 110, ty = 0, duration = 1.6, ease = 'expo.inOut' } = {}) {
    // La position de départ est lue au moment où le mouvement commence (pas à sa création) :
    // dans une séquence (présentation), chaque étape part de là où la précédente s'est arrêtée.
    const p = { k: 0 };
    let from = null;
    const start = () => {
      from = this._spherical();
      // l'angle relu est ramené entre -π et π : on repart du tour le plus proche de la cible
      while (theta - from.theta > Math.PI) from.theta += Math.PI * 2;
      while (theta - from.theta < -Math.PI) from.theta -= Math.PI * 2;
    };
    const lerp = (a, b) => a + (b - a) * p.k;
    return gsap.to(p, {
      k: 1, duration, ease,
      onStart: start,
      onUpdate: () => {
        if (!from) start();
        this._setSpherical({ theta: lerp(from.theta, theta), phi: lerp(from.phi, phi), radius: lerp(from.radius, radius), ty: lerp(from.ty, ty) });
      },
    });
  }

  _spherical() {
    const t = this.controls.target;
    const v = this.camera.position.clone().sub(t);
    const s = new THREE.Spherical().setFromVector3(v);
    return { theta: s.theta, phi: s.phi, radius: s.radius, ty: t.y };
  }

  _setSpherical({ theta, phi, radius, ty }) {
    this.controls.target.set(0, ty, 0);
    const v = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, phi, theta));
    this.camera.position.copy(this.controls.target).add(v);
    this.camera.lookAt(this.controls.target);
  }

  onTick(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  /** Exécute fn au début de la prochaine image, avant le rendu principal (aucun clignotement). */
  inFrame(fn) {
    return new Promise((resolve, reject) => (this._jobs ||= []).push({ fn, resolve, reject }));
  }

  _tick() {
    const job = this._jobs?.shift();
    if (job) { try { job.resolve(job.fn()); } catch (e) { job.reject(e); } }
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    for (const fn of this.updaters) fn(dt, t);
    if (this.controls.enabled || this.controls.autoRotate) this.controls.update();
    if (this.paused) return;
    this.renderer.render(this.scene, this.camera);
    // comparateur avant/après : la partie gauche est re-rendue sans la coiffure
    const sp = this.split;
    if (sp && sp.x > 0.001) {
      const r = this.renderer, w = window.innerWidth, h = window.innerHeight;
      sp.hide();
      r.setScissorTest(true);
      r.setScissor(0, 0, Math.round(sp.x * w), h);
      r.render(this.scene, this.camera);
      r.setScissorTest(false);
      sp.show();
    }
  }

  /** Rendu hors écran (vignettes). */
  renderThumb(camera, size = 300) {
    const r = this.renderer, cv = r.domElement, pr = r.getPixelRatio();
    const s = Math.min(size, Math.floor(Math.min(cv.width, cv.height) / pr));
    if (!this._cv) { this._cv = document.createElement('canvas'); this._cv.width = this._cv.height = size; }
    r.setScissorTest(true);
    r.setViewport(0, 0, s, s); r.setScissor(0, 0, s, s);
    r.setClearColor(0x000000, 0); r.clear();
    r.render(this.scene, camera);
    r.setScissorTest(false);
    r.setViewport(0, 0, cv.width / pr, cv.height / pr);
    const ctx = this._cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(cv, 0, cv.height - s * pr, s * pr, s * pr, 0, 0, size, size);
    return this._cv.toDataURL('image/png');
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
