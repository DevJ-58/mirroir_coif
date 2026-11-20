// Visage scanné posé sur le mannequin standard : relief (468 points) + photo du visage.
// Le crâne, les oreilles, le cou et le buste restent ceux du mannequin.
import * as THREE from 'three';
import { similarity, makeView, yawOf } from './geometry.js';
import { canonicalVerts } from '../three/head.js';

// contour du visage (MediaPipe), du front au menton et retour
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 60); });

/**
 * captures : [{ canvas, landmarks, width, height }] — la première de face de préférence,
 * les autres (trois-quarts) affinent le relief.
 * Renvoie { verts, uvs, texture, skin, views }.
 */
export async function buildFace(captures, onStep = () => {}) {
  onStep(0);
  await nextFrame();
  const C = canonicalVerts().slice(0, 468 * 3);
  const Cn = normals(C);
  const views = captures.map((cap) => {
    const W = cap.width, H = cap.height;
    const O = new Float32Array(468 * 3);
    for (let i = 0; i < 468; i++) { const l = cap.landmarks[i]; O[i * 3] = l.x * W; O[i * 3 + 1] = l.y * H; O[i * 3 + 2] = l.z * W; }
    const pose = similarity(C, O);
    return { cap, W, H, O, view: makeView(pose), yaw: yawOf(pose) };
  }).sort((a, b) => Math.abs(a.yaw) - Math.abs(b.yaw));
  const front = views[0];

  // ---------- relief : chaque point vient des vues qui le voient le mieux ----------
  onStep(1);
  await nextFrame();
  const verts = new Float32Array(468 * 3), wsum = new Float32Array(468);
  for (const v of views) {
    for (let i = 0; i < 468; i++) {
      const f = v.view.facing([Cn[i * 3], Cn[i * 3 + 1], Cn[i * 3 + 2]]);
      const w = Math.pow(Math.max(0, f), 2) + (v === front ? 0.05 : 0);
      if (w <= 0) continue;
      const p = v.view.unproject([v.O[i * 3], v.O[i * 3 + 1], v.O[i * 3 + 2]]);
      verts[i * 3] += p[0] * w; verts[i * 3 + 1] += p[1] * w; verts[i * 3 + 2] += p[2] * w; wsum[i] += w;
    }
  }
  for (let i = 0; i < 468; i++) for (let k = 0; k < 3; k++) {
    const m = wsum[i] ? verts[i * 3 + k] / wsum[i] : C[i * 3 + k];
    // une part du modèle canonique garde un relief propre là où la caméra hésite
    verts[i * 3 + k] = m * 0.85 + C[i * 3 + k] * 0.15;
  }

  // ---------- photo du visage, recadrée ----------
  onStep(2);
  await nextFrame();
  const L = front.cap.landmarks, W = front.W, H = front.H;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 468; i++) { const x = L[i].x * W, y = L[i].y * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const mx = (x1 - x0) * 0.12, my = (y1 - y0) * 0.12;
  x0 = Math.max(0, x0 - mx); y0 = Math.max(0, y0 - my); x1 = Math.min(W, x1 + mx); y1 = Math.min(H, y1 + my);
  const cw = x1 - x0, ch = y1 - y0;
  const k = Math.min(2, 1024 / Math.max(cw, ch));
  const crop = document.createElement('canvas');
  crop.width = Math.round(cw * k); crop.height = Math.round(ch * k);
  const g = crop.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(front.cap.canvas, x0, y0, cw, ch, 0, 0, crop.width, crop.height);
  const uvs = new Float32Array(468 * 2);
  for (let i = 0; i < 468; i++) {
    uvs[i * 2] = (L[i].x * W - x0) / cw;
    uvs[i * 2 + 1] = 1 - (L[i].y * H - y0) / ch;   // la texture est retournée (flipY)
  }

  // ---------- teint : médiane le long du contour, un peu vers l'intérieur ----------
  const img = g.getImageData(0, 0, crop.width, crop.height).data;
  const nose = L[1];
  const rs = [], gs = [], bs = [];
  for (const i of OVAL) {
    for (const t of [0.14, 0.22]) {
      const x = ((L[i].x + (nose.x - L[i].x) * t) * W - x0) * k, y = ((L[i].y + (nose.y - L[i].y) * t) * H - y0) * k;
      for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) {
        const px = Math.round(x + dx), py = Math.round(y + dy);
        if (px < 0 || py < 0 || px >= crop.width || py >= crop.height) continue;
        const o = (py * crop.width + px) * 4;
        rs.push(img[o]); gs.push(img[o + 1]); bs.push(img[o + 2]);
      }
    }
  }
  const med = (a) => { a.sort((p, q) => p - q); return a.length ? a[a.length >> 1] / 255 : 0.5; };
  const skin = new THREE.Color().setRGB(med(rs), med(gs), med(bs), THREE.SRGBColorSpace);

  const texture = new THREE.CanvasTexture(crop);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  onStep(3);
  return { verts, uvs, texture, skin, views: views.length };
}

function normals(V) {
  // normales approchées : du centre de la tête vers le point, penchées vers l'avant
  const n = new Float32Array(V.length);
  for (let i = 0; i < V.length / 3; i++) {
    const x = V[i * 3], y = V[i * 3 + 1] - 1.5, z = V[i * 3 + 2] + 6;
    const l = Math.hypot(x, y, z) || 1;
    n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l;
  }
  return n;
}
