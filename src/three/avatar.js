import * as THREE from 'three';
import { buildHeadGeometry, canonicalVerts, capeProfile, CAPE_C, setSkullScale } from './head.js';

const MANNEQUIN = new THREE.Color('#cdbfb0');

export class Avatar {
  constructor() {
    this.group = new THREE.Group();
    this.uniforms = {
      uSkin: { value: MANNEQUIN.clone() },
      uFaceMap: { value: null },
      uHasMap: { value: 0 },
      uHasCol: { value: 0 }, // 1 = couleurs projetées depuis les prises du scan
      uReveal: { value: 1 }, // 1 = entièrement visible
      uGlow: { value: new THREE.Color('#f3d9a8') },
    };
    this.realistic = false;
    this.scan = null;

    this.skinMat = this._makeSkinMaterial();
    this.head = new THREE.Mesh(new THREE.BufferGeometry(), this.skinMat);
    this.group.add(this.head);

    // oreilles
    const earGeo = new THREE.SphereGeometry(1, 28, 20);
    earGeo.scale(0.55, 3.0, 1.75);
    earGeo.setAttribute('aFace', new THREE.BufferAttribute(new Float32Array(earGeo.attributes.position.count), 1));
    earGeo.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(earGeo.attributes.position.count * 2), 2));
    earGeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(earGeo.attributes.position.count * 3), 3));
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, this.skinMat);
      ear.position.set(s * 7.75, 1.0, -4.4);
      ear.rotation.set(-0.12, s * 0.32, s * -0.06);
      this.group.add(ear);
    }
    this.currentHair = null; // cheveux réels de la personne scannée
    this.hairShown = true;

    this.cape = new THREE.Mesh(buildCapeGeometry(), this._makeCapeMaterial());
    this.group.add(this.cape);

    this.setMannequin();
  }

  _injectReveal(shader) {
    shader.uniforms.uReveal = this.uniforms.uReveal;
    shader.uniforms.uGlow = this.uniforms.uGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReveal; uniform vec3 uGlow; varying float vLy;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float revY = mix(16.0, -62.0, uReveal);
        if (vLy < revY) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float band = smoothstep(2.4, 0.0, vLy - revY) * step(uReveal, 0.999);
        totalEmissiveRadiance += uGlow * band * 2.2;`);
  }

  _makeSkinMaterial() {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.55,
      sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffd8c0'), envMapIntensity: 0.55,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uSkin: this.uniforms.uSkin, uFaceMap: this.uniforms.uFaceMap, uHasMap: this.uniforms.uHasMap, uHasCol: this.uniforms.uHasCol,
      });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aUv; attribute float aFace; attribute vec3 aCol; varying vec2 vFUv; varying float vFace; varying vec3 vCol;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFUv = aUv; vFace = aFace; vCol = aCol;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSkin; uniform sampler2D uFaceMap; uniform float uHasMap; uniform float uHasCol; varying vec2 vFUv; varying float vFace; varying vec3 vCol;')
        .replace('#include <map_fragment>', `
          vec3 faceC = texture2D(uFaceMap, vFUv).rgb;
          diffuseColor.rgb = mix(uSkin, faceC, clamp(vFace * uHasMap, 0.0, 1.0));
          // scan multi-vues : couleur projetée sur toute la tête (les oreilles gardent le teint moyen)
          if (uHasCol > 0.5 && dot(vCol, vCol) > 0.0) diffuseColor.rgb = vCol;`);
      this._injectReveal(shader);
    };
    return m;
  }

  _makeCapeMaterial() {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#121010'), roughness: 0.38, sheen: 1, sheenRoughness: 0.35,
      sheenColor: new THREE.Color('#8a7660'), clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.6,
      side: THREE.DoubleSide,
    });
    m.onBeforeCompile = (s) => this._injectReveal(s);
    return m;
  }

  setMannequin() {
    setSkullScale(1);
    this._setCurrentHair(null);
    this.scan = null;
    this.uniforms.uHasCol.value = 0;
    this._setGeometry(canonicalVerts(), null);
    this.uniforms.uSkin.value.copy(MANNEQUIN);
    this.uniforms.uHasMap.value = 0;
    this.skinMat.roughness = 0.42;
    this.skinMat.clearcoat = 0.35;
    this.realistic = false;
  }

  /** scan : résultat de reconstruct() (forme, couleurs projetées, cheveux actuels) */
  setScan(scan) {
    this.scan = scan;
    setSkullScale(scan.skullScale);
    // maillage plus fin : les couleurs sont portées par les sommets
    const g = buildHeadGeometry(scan.verts, null, { NT: 380, NY: 420 });
    scan.colorizeHead(g);
    this.head.geometry.dispose();
    this.head.geometry = g;
    this._setCurrentHair(scan.buildHairShell());
    this.showRealistic(true);
  }

  _setCurrentHair(mesh) {
    if (this.currentHair) { this.group.remove(this.currentHair); this.currentHair.geometry.dispose(); this.currentHair.material.dispose(); }
    this.currentHair = mesh;
    if (mesh) {
      const prev = mesh.material.onBeforeCompile;
      mesh.material.onBeforeCompile = (sh) => { prev(sh); this._injectReveal(sh); };
      this.group.add(mesh);
    }
    this._syncHair();
  }
  /** Affiche ou masque les cheveux réels (masqués dès qu'une coiffure est posée). */
  showCurrentHair(on) { this.hairShown = on; this._syncHair(); }
  _syncHair() { if (this.currentHair) this.currentHair.visible = this.hairShown && this.realistic; }

  showRealistic(on) {
    if (!this.scan) return;
    this.realistic = on;
    if (on) {
      this.uniforms.uHasCol.value = 1;
      this.uniforms.uHasMap.value = 0;
      this.uniforms.uSkin.value.copy(this.scan.skin);
      this.skinMat.roughness = 0.58;
      this.skinMat.clearcoat = 0.12;
    } else {
      this.uniforms.uHasMap.value = 0;
      this.uniforms.uHasCol.value = 0;
      this.uniforms.uSkin.value.copy(MANNEQUIN);
      this.skinMat.roughness = 0.42;
      this.skinMat.clearcoat = 0.35;
    }
    this._syncHair();
  }

  _setGeometry(verts, uvs) {
    const g = buildHeadGeometry(verts, uvs);
    this.head.geometry.dispose();
    this.head.geometry = g;
  }
}

function buildCapeGeometry() {
  const NT = 160, NY = 90, y0 = -13.2, y1 = -58;
  const pos = [], idx = [];
  for (let j = 0; j <= NY; j++) {
    const y = y0 + (y1 - y0) * (j / NY);
    const p = capeProfile(y - 0.0001) || { rx: 6, rz: 5.3 };
    for (let i = 0; i <= NT; i++) {
      const th = -Math.PI + (i / NT) * Math.PI * 2;
      // légers plis du tissu
      const fold = 1 + 0.018 * Math.sin(th * 9 + y * 0.15) * Math.min(1, (y0 - y) / 12);
      pos.push(p.rx * fold * Math.sin(th), y, CAPE_C + p.rz * fold * Math.cos(th));
    }
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) {
    const a = j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // col roulé
  const collar = new THREE.TorusGeometry(1, 0.075, 16, 96);
  collar.rotateX(Math.PI / 2);
  collar.scale(6.1, 6.5, 5.4);
  collar.translate(0, -13.3, CAPE_C);
  const merged = mergeSimple([g, collar]);
  return merged;
}

function mergeSimple(geos) {
  let total = 0; geos.forEach((g) => (total += g.attributes.position.count));
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), idx = [];
  let off = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off);
    off += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setIndex(idx);
  return m;
}
