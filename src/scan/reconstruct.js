// Reconstruction de la tête à partir de plusieurs prises (face, 3/4, profils).
// Tout est calculé sur l'appareil : poses des vues, forme du visage, volume crâne + cheveux,
// couleurs de peau projetées tout autour, coque des cheveux actuels.
import * as THREE from 'three';
import { ImageSegmenter } from '@mediapipe/tasks-vision';
import { similarity, makeView, yawOf } from './geometry.js';
import { canonicalVerts, FACE_TRIS, HC, insideHead, setSkullScale, setHeadShape, baseHeadProfile, headProfile, HEAD_TOP } from '../three/head.js';
import { getFileset } from './scanner.js';

// classes du modèle « selfie multiclass »
const BG = 0, HAIR = 1, BODY = 2, FACE = 3, CLOTHES = 4, OTHER = 5;

let segmenter = null;
async function loadSegmenter() {
  if (segmenter) return segmenter;
  const fileset = await getFileset();
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: '/models/selfie_multiclass_256x256.tflite', delegate },
    runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
  });
  try { segmenter = await ImageSegmenter.createFromOptions(fileset, opts('GPU')); }
  catch { segmenter = await ImageSegmenter.createFromOptions(fileset, opts('CPU')); }
  return segmenter;
}
export function preloadSegmenter() { return loadSegmenter().catch(() => null); }

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 50); });

/** Normales du modèle canonique (pour savoir quels repères chaque vue voit de face). */
function canonicalNormals(V) {
  const n = new Float32Array(V.length);
  for (let t = 0; t < FACE_TRIS.length; t += 3) {
    const [a, b, c] = [FACE_TRIS[t], FACE_TRIS[t + 1], FACE_TRIS[t + 2]];
    const ax = V[b * 3] - V[a * 3], ay = V[b * 3 + 1] - V[a * 3 + 1], az = V[b * 3 + 2] - V[a * 3 + 2];
    const bx = V[c * 3] - V[a * 3], by = V[c * 3 + 1] - V[a * 3 + 1], bz = V[c * 3 + 2] - V[a * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    for (const i of [a, b, c]) { n[i * 3] += nx; n[i * 3 + 1] += ny; n[i * 3 + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/**
 * captures : [{ canvas, landmarks, width, height }] (1 à ~30 prises, la première de face de préférence)
 * Renvoie l'objet « scan » utilisé par l'avatar.
 */
export async function reconstruct(captures, onStep = () => {}) {
  const C = canonicalVerts().slice(0, 468 * 3);
  const Cn = canonicalNormals(C);

  // ---------- 1. pose de chaque prise ----------
  onStep(0);
  setSkullScale(1);
  setHeadShape(null);
  const views = captures.map((cap) => {
    const W = cap.width, H = cap.height;
    const O = new Float32Array(468 * 3);
    for (let i = 0; i < 468; i++) { const l = cap.landmarks[i]; O[i * 3] = l.x * W; O[i * 3 + 1] = l.y * H; O[i * 3 + 2] = l.z * W; }
    const pose = similarity(C, O);
    const v = makeView(pose);
    const pix = cap.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    return { ...v, cap, W, H, O, pix, yaw: yawOf(pose), mask: null, mw: 0, mh: 0 };
  });
  views.sort((a, b) => Math.abs(a.yaw) - Math.abs(b.yaw)); // la plus frontale d'abord

  // ---------- 2. séparation cheveux / peau / fond ----------
  onStep(1);
  // masques fournis (tests) : on n'appelle pas le modèle
  for (const v of views) if (v.cap.mask) { v.mask = v.cap.mask; v.mw = v.cap.maskW; v.mh = v.cap.maskH; }
  if (!views.every((v) => v.mask)) try {
    const seg = await loadSegmenter();
    for (const v of views) {
      if (v.mask) continue;
      const res = seg.segment(v.cap.canvas);
      const m = res.categoryMask;
      v.mask = m.getAsUint8Array().slice(); v.mw = m.width; v.mh = m.height;
      m.close();
      await nextFrame();
    }
  } catch (e) { console.warn('segmentation indisponible', e); }
  const classAt = (v, u, w) => {
    if (!v.mask) return FACE;
    const x = Math.floor((u / v.W) * v.mw), y = Math.floor((w / v.H) * v.mh);
    if (x < 0 || y < 0 || x >= v.mw || y >= v.mh) return -1; // hors de l'image
    return v.mask[y * v.mw + x];
  };
  const colorAt = (v, u, w) => {
    const x = Math.min(v.W - 1, Math.max(0, Math.round(u))), y = Math.min(v.H - 1, Math.max(0, Math.round(w)));
    const k = (y * v.W + x) * 4;
    return [v.pix[k] / 255, v.pix[k + 1] / 255, v.pix[k + 2] / 255];
  };

  // ---------- 3. forme du visage : repères moyennés sur les vues qui les voient de face ----------
  const verts = new Float32Array(468 * 3), wsum = new Float32Array(468);
  for (const v of views) {
    for (let i = 0; i < 468; i++) {
      const f = v.facing([Cn[i * 3], Cn[i * 3 + 1], Cn[i * 3 + 2]]);
      const w = Math.pow(Math.max(0, f), 2) + (v === views[0] ? 0.05 : 0);
      if (w <= 0) continue;
      const p = v.unproject([v.O[i * 3], v.O[i * 3 + 1], v.O[i * 3 + 2]]);
      verts[i * 3] += p[0] * w; verts[i * 3 + 1] += p[1] * w; verts[i * 3 + 2] += p[2] * w; wsum[i] += w;
    }
  }
  for (let i = 0; i < 468; i++) {
    const w = wsum[i] || 1;
    for (let k = 0; k < 3; k++) {
      const m = wsum[i] ? verts[i * 3 + k] / w : C[i * 3 + k];
      // une pointe du modèle canonique stabilise les zones vues d'une seule prise
      verts[i * 3 + k] = m * 0.9 + C[i * 3 + k] * 0.1;
    }
  }

  // ---------- 4. volume : enveloppe des silhouettes (tête = cheveux ∪ peau) ----------
  onStep(2);
  await nextFrame();
  const G = { x0: -14, y0: -9, z0: -24, s: 0.5, nx: 56, ny: 68, nz: 76 };
  const occ = new Uint8Array(G.nx * G.ny * G.nz);
  const tolerate = views.length >= 12 ? 1 : 0;
  const headClass = (c) => c === HAIR || c === FACE || c === BODY || c === OTHER || c === -1;
  for (let k = 0; k < G.nz; k++) for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
    const p = [G.x0 + (i + 0.5) * G.s, G.y0 + (j + 0.5) * G.s, G.z0 + (k + 0.5) * G.s];
    // dans la tête si aucune vue ne voit du fond à cet endroit, et qu'au moins deux vues
    // (ou la seule disponible) y voient vraiment la tête ; hors cadre = inconnu
    // avec beaucoup de vues, un masque isolé qui se trompe ne doit pas creuser la tête
    let inside = true, seenBy = 0, miss = 0;
    for (const v of views) {
      const q = v.project(p); const c = classAt(v, q[0], q[1]);
      if (!headClass(c)) { if (++miss > tolerate) { inside = false; break; } continue; }
      if (c !== -1) seenBy++;
    }
    occ[(k * G.ny + j) * G.nx + i] = inside && seenBy >= Math.min(2, views.length) ? 1 : 0;
  }
  const occAt = (p) => {
    const i = Math.floor((p[0] - G.x0) / G.s), j = Math.floor((p[1] - G.y0) / G.s), k = Math.floor((p[2] - G.z0) / G.s);
    if (i < 0 || j < 0 || k < 0 || i >= G.nx || j >= G.ny || k >= G.nz) return 0;
    return occ[(k * G.ny + j) * G.nx + i];
  };

  // directions depuis le centre de la tête : rayon de l'enveloppe, rayon du crâne, cheveux ou peau
  const NA = 96, NE = 56, E0 = -0.42 * Math.PI, E1 = 0.5 * Math.PI;
  const dirs = [];
  const hc = [HC.x, HC.y, HC.z];
  const P = new THREE.Vector3();
  const skullR = (d) => {
    let lo = 1, hi = 26;
    for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; P.set(hc[0] + d[0] * m, hc[1] + d[1] * m, hc[2] + d[2] * m); if (insideHead(P)) lo = m; else hi = m; }
    return lo;
  };
  const bestView = (d) => { let best = null, bf = 0.15; for (const v of views) { const f = v.facing(d); if (f > bf) { bf = f; best = v; } } return best; };
  for (let e = 0; e < NE; e++) for (let a = 0; a < NA; a++) {
    const el = E0 + ((E1 - E0) * e) / (NE - 1), az = -Math.PI + (2 * Math.PI * a) / NA;
    const d = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
    // bord de l'enveloppe le long du rayon (on tolère de petits trous de masque jusqu'à 1,5 cm)
    // r0 : première sortie (la surface sous une mèche qui surplombe)
    // (les petits trous du masque près du centre sont ignorés : r0 n'est retenu qu'au-delà de 5 cm
    // et seulement si un vrai vide d'au moins 1 cm suit)
    let r = 0, r0 = 0, open = true;
    for (let t = 2; t < 28; t += 0.25) {
      const o = occAt([hc[0] + d[0] * t, hc[1] + d[1] * t, hc[2] + d[2] * t]);
      if (o) { if (open && (t - r <= 1 || t < 5)) r0 = t; else open = false; r = t; } else if (r > 0 && t - r > 1.5) break;
    }
    const v = bestView(d);
    let cls = -1;
    if (v && r > 0) { const q = v.project([hc[0] + d[0] * r, hc[1] + d[1] * r, hc[2] + d[2] * r]); cls = classAt(v, q[0], q[1]); }
    let cls0 = cls;
    if (v && r0 > 0 && r0 < r) { const q = v.project([hc[0] + d[0] * r0, hc[1] + d[1] * r0, hc[2] + d[2] * r0]); cls0 = classAt(v, q[0], q[1]); }
    // la vue qui voit ce point « de profil » est celle dont la silhouette le fixe :
    // si c'est une mèche qui fait ce bord, le point n'est pas une mesure du crâne
    if (r0 > 0 && cls0 !== HAIR) {
      let tv = null, tf = 0.35;
      for (const w of views) { const f = Math.abs(w.facing(d)); if (f < tf) { tf = f; tv = w; } }
      if (tv) { const q = tv.project([hc[0] + d[0] * (r0 - 0.4), hc[1] + d[1] * (r0 - 0.4), hc[2] + d[2] * (r0 - 0.4)]); if (classAt(tv, q[0], q[1]) === HAIR) cls0 = HAIR; }
    }
    dirs.push({ d, el, az, hull: r, hull0: r0, cls0, skull: skullR(d), cls, seen: Boolean(v) });
  }

  // ---------- forme de toute la tête ----------
  // Par tranche de hauteur, on compare l'enveloppe mesurée au modèle générique : largeur (côtés)
  // et profondeur (arrière du crâne). Là où la peau est visible (tempes, oreilles, nuque dégagée)
  // l'enveloppe colle au crâne ; sous les cheveux on retire une épaisseur prudente et on garde
  // un quantile bas pour ne pas confondre volume de coiffure et crâne.
  const BY0 = -9, BDY = 1.5, NB = 16;
  const side = Array.from({ length: NB }, () => ({ skin: [], hair: [] }));
  const back = Array.from({ length: NB }, () => ({ skin: [], hair: [] }));
  const prof = { rx: 0, c: 0, rz: 0 };
  for (const x of dirs) {
    if (!(x.hull0 > 0) || !x.seen || x.cls0 === -1) continue;
    const isHair = x.cls0 === HAIR;
    // l'enveloppe majore toujours la surface (voxels de 5 mm) : on retire un demi-voxel
    const r = Math.max(0, x.hull0 - 0.25);
    const p = [hc[0] + x.d[0] * r, hc[1] + x.d[1] * r, hc[2] + x.d[2] * r];
    if (p[1] < BY0 || p[1] > 12.4) continue;
    baseHeadProfile(p[1], prof);
    const ratio = Math.hypot(p[0] / prof.rx, (p[2] - prof.c) / prof.rz);
    if (!(ratio > 0.8 && ratio < 1.6)) continue;
    const bi = Math.min(NB - 1, Math.max(0, Math.round((p[1] - BY0) / BDY)));
    const sa = Math.sin(x.az), ca = Math.cos(x.az);
    const bucket = Math.abs(sa) > 0.8 ? side[bi] : ca < -0.75 ? back[bi] : null;
    if (bucket) (isHair ? bucket.hair : bucket.skin).push(ratio);
  }
  const q = (arr, f) => { const a = arr.slice().sort((m, n) => m - n); return a[Math.min(a.length - 1, Math.floor(a.length * f))]; };
  const band = (B, lo, hi) => {
    const out = new Float32Array(NB).fill(NaN);
    // peau visible : mesure directe du crâne
    B.forEach((b, i) => { if (b.skin.length >= 3) out[i] = Math.min(hi, Math.max(lo, q(b.skin, 0.5))); });
    // trous comblés par les voisins, puis lissage
    for (let i = 0; i < NB; i++) if (Number.isNaN(out[i])) {
      let l = i - 1, r = i + 1;
      while (l >= 0 && Number.isNaN(out[l])) l--;
      while (r < NB && Number.isNaN(out[r])) r++;
      out[i] = l >= 0 && r < NB ? out[l] + ((out[r] - out[l]) * (i - l)) / (r - l) : l >= 0 ? out[l] : r < NB ? out[r] : 1;
    }
    // sous les cheveux l'épaisseur est inconnue, mais l'enveloppe reste une borne haute :
    // le crâne ne peut qu'y être plus petit
    B.forEach((b, i) => { if (b.skin.length < 3 && b.hair.length >= 3) out[i] = Math.max(lo, Math.min(out[i], q(b.hair, 0.1))); });
    for (let pass = 0; pass < 3; pass++) { const c = out.slice(); for (let i = 0; i < NB; i++) out[i] = (c[Math.max(0, i - 1)] + 2 * c[i] + c[Math.min(NB - 1, i + 1)]) / 4; }
    return out;
  };
  const shape = { y0: BY0, dy: BDY, kx: band(side, 0.9, 1.12), kz: band(back, 0.9, 1.1) };
  setSkullScale(1);
  setHeadShape(shape);
  const k = 1;
  for (const x of dirs) x.skull = skullR(x.d);

  // épaisseur de cheveux par direction (lissée)
  const thick = new Float32Array(dirs.length);
  const crownVolume = () => {
    dirs.forEach((x, i) => { thick[i] = x.cls === HAIR && x.hull > 0 ? Math.max(0, x.hull - x.skull) : 0; });
    const c = dirs.map((x, i) => [x, thick[i]]).filter(([x]) => x.el > 0.2 * Math.PI && x.cls === HAIR).map(([, t]) => t).sort((a, b) => a - b);
    return c.length ? c[Math.floor(c.length * 0.6)] : 0;
  };
  let volume = crownVolume();
  // chevelure épaisse : le crâne est caché et les bords mesurés sont surtout des mèches,
  // la forme mesurée est alors fortement atténuée vers la tête de référence
  const damp = Math.min(1, Math.max(0.25, 1 - (volume - 1.2) / 2.2));
  if (damp < 1) {
    for (const key of ['kx', 'kz']) shape[key] = shape[key].map((v) => 1 + (v - 1) * damp);
    setHeadShape(shape);
    for (const x of dirs) x.skull = skullR(x.d);
    volume = crownVolume();
  }
  const hairW = new Float32Array(dirs.length);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? hairW.slice() : Float32Array.from(dirs, (x) => (x.cls === HAIR ? 1 : 0));
    for (let e = 0; e < NE; e++) for (let a = 0; a < NA; a++) {
      let s = 0, n = 0;
      for (let de = -1; de <= 1; de++) for (let da = -1; da <= 1; da++) {
        const ee = e + de, aa = (a + da + NA) % NA; if (ee < 0 || ee >= NE) continue;
        s += src[ee * NA + aa]; n++;
      }
      hairW[e * NA + a] = s / n;
    }
  }
  // longueur : point le plus bas couvert de cheveux à l'arrière et sur les côtés
  let lowest = HEAD_TOP;
  dirs.forEach((x, i) => { if (hairW[i] > 0.5 && Math.cos(x.az) < 0.3) lowest = Math.min(lowest, hc[1] + x.d[1] * x.hull); });
  const length = Math.max(volume, Math.min(45, volume + Math.max(0, 1 - lowest) * 1.2));

  // ---------- 5. couleurs ----------
  onStep(3);
  await nextFrame();
  // teint moyen sur la peau du visage (vue la plus frontale)
  const v0 = views[0];
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (const i of [50, 280, 101, 330, 151, 205, 425, 6, 197]) {
    const q = v0.project([verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]]);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const c = colorAt(v0, q[0] + dx, q[1] + dy); sr += c[0]; sg += c[1]; sb += c[2]; sn++; }
  }
  const skin = new THREE.Color().setRGB(sr / sn, sg / sn, sb / sn, THREE.SRGBColorSpace);
  const skinLin = [skin.r, skin.g, skin.b];
  const toLin = (c) => c.map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));

  /** Colore la tête : chaque sommet prend la couleur des vues qui le voient de face. */
  function colorizeHead(geo) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, face = geo.attributes.aFace;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const p = [pos.getX(i), pos.getY(i), pos.getZ(i)], n = [nor.getX(i), nor.getY(i), nor.getZ(i)];
      const inFace = face.getX(i) > 0.05;
      let r = 0, g = 0, b = 0, w = 0;
      for (const v of views) {
        const f = v.facing(n); if (f <= 0.12) continue;
        const q = v.project(p);
        const cls = classAt(v, q[0], q[1]);
        // hors visage : on ne garde que la peau (les cheveux sont rendus à part)
        if (cls === -1 || cls === BG || (!inFace && cls !== FACE && cls !== BODY)) continue;
        const ww = Math.pow(f, 4);
        const c = toLin(colorAt(v, q[0], q[1]));
        r += c[0] * ww; g += c[1] * ww; b += c[2] * ww; w += ww;
      }
      const cover = Math.min(1, w * 3);
      const c = w > 0 ? [r / w, g / w, b / w] : skinLin;
      for (let k = 0; k < 3; k++) col[i * 3 + k] = c[k] * cover + skinLin[k] * (1 - cover);
    }
    geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  }

  /** Coque des cheveux actuels, colorée depuis les photos. */
  function buildHairShell() {
    const pos = new Float32Array(NA * NE * 3), col = new Float32Array(NA * NE * 3), alpha = new Float32Array(NA * NE);
    dirs.forEach((x, i) => {
      const hairy = hairW[i];
      const r = hairy > 0.05 ? Math.max(x.skull + 0.25, x.hull) : x.skull - 0.4;
      pos[i * 3] = hc[0] + x.d[0] * r; pos[i * 3 + 1] = hc[1] + x.d[1] * r; pos[i * 3 + 2] = hc[2] + x.d[2] * r;
      alpha[i] = smooth(0.25, 0.7, hairy);
      let c = [0.03, 0.025, 0.02], w = 0, acc = [0, 0, 0];
      for (const v of views) {
        const f = v.facing(x.d); if (f <= 0.1) continue;
        const q = v.project([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
        if (classAt(v, q[0], q[1]) !== HAIR) continue;
        const ww = Math.pow(f, 3), cc = toLin(colorAt(v, q[0], q[1]));
        acc[0] += cc[0] * ww; acc[1] += cc[1] * ww; acc[2] += cc[2] * ww; w += ww;
      }
      if (w > 0) c = [acc[0] / w, acc[1] / w, acc[2] / w];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    });
    const idx = [];
    for (let e = 0; e < NE - 1; e++) for (let a = 0; a < NA; a++) {
      const a2 = (a + 1) % NA;
      const p = e * NA + a, q = e * NA + a2, r = (e + 1) * NA + a, s = (e + 1) * NA + a2;
      idx.push(p, q, r, q, s, r);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, transparent: true, depthWrite: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha; varying float vAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;').replace('#include <alphatest_fragment>', 'diffuseColor.a *= vAlpha; if (diffuseColor.a < 0.04) discard;');
    };
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 1;
    return mesh;
  }

  // cheveux présents sur une part suffisante du crâne ?
  const hairShare = dirs.filter((x, i) => x.el > 0 && hairW[i] > 0.5).length / Math.max(1, dirs.filter((x) => x.el > 0).length);

  return {
    verts, skin, skullScale: k, shape, views: views.length,
    hair: { volume, length, share: hairShare },
    colorizeHead,
    buildHairShell,
  };
}
