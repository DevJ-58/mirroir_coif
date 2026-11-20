// Tête paramétrique + visage scanné fusionné en un seul maillage.
// Unités : centimètres, repère du "canonical face model" de MediaPipe
// (x = gauche de la personne, y = haut, z = avant du visage).
import * as THREE from 'three';
import canon from '../data/canonical-face.json';

export const HEAD_TOP = 13.6;
export const HEAD_BOTTOM = -24;

// y, demi-largeur (x), avant (z), arrière (z)
const K = [
  [8.3, 7.6, 4.5, -14.4],
  [6.0, 7.85, 5.0, -15.0],
  [4.0, 7.95, 5.2, -15.2],
  [2.0, 7.95, 5.2, -14.9],
  [0.0, 7.9, 5.0, -14.0],
  [-2.5, 7.55, 4.7, -12.4],
  [-5.0, 6.9, 4.4, -11.0],
  [-7.0, 6.0, 4.1, -10.1],
  [-9.0, 5.0, 2.6, -9.7],
  [-10.6, 5.2, 0.6, -9.6],
  [-13.0, 5.5, 0.2, -9.6],
  [-17.0, 5.75, 0.3, -9.8],
  [-24.0, 6.1, 0.5, -10.0],
];

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const _prof = { rx: 0, c: 0, rz: 0 };
// Échelle du crâne propre à la personne scannée (1 = tête générique). Ne touche que le crâne,
// pas le bas du visage ni le cou.
let SKULL = 1;
export function setSkullScale(k) { SKULL = Math.min(1.2, Math.max(0.85, k || 1)); }
export function getSkullScale() { return SKULL; }
/** Section horizontale de la tête à la hauteur y : ellipse (rx, rz) centrée en z = c. */
// Forme mesurée par le scan : par tranche de hauteur, largeur (kx) et profondeur arrière (kz).
// null = tête générique.
let SHAPE = null;
/** shape : { y0, dy, kx: Float32Array, kz: Float32Array } ou null */
export function setHeadShape(shape) { SHAPE = shape || null; }
export function getHeadShape() { return SHAPE; }
const shapeAt = (arr, y) => {
  const f = (y - SHAPE.y0) / SHAPE.dy, n = arr.length;
  if (f <= 0) return arr[0];
  if (f >= n - 1) return arr[n - 1];
  const i = Math.floor(f), t = f - i;
  return arr[i] + (arr[i + 1] - arr[i]) * t;
};
export function headProfile(y, out = _prof) {
  baseProfile(y, out);
  if (SKULL !== 1) {
    const t = Math.min(1, Math.max(0, (y + 6) / 6));
    const k = 1 + (SKULL - 1) * t * t * (3 - 2 * t);
    out.rx *= k; out.rz *= k;
  }
  if (SHAPE) {
    // la mâchoire et le cou restent ceux du modèle : la forme mesurée entre en douceur sous le menton
    const t = Math.min(1, Math.max(0, (y + 9) / 4)), w = t * t * (3 - 2 * t);
    const kx = 1 + (shapeAt(SHAPE.kx, y) - 1) * w, kz = 1 + (shapeAt(SHAPE.kz, y) - 1) * w;
    // l'avant (front, visage) reste en place, seul l'arrière du crâne avance ou recule
    const front = out.c + out.rz;
    out.rx *= kx; out.rz *= kz; out.c = front - out.rz;
  }
  return out;
}
/** Section du modèle générique (sans forme mesurée). */
export function baseHeadProfile(y, out = { rx: 0, c: 0, rz: 0 }) { return baseProfile(y, out); }
// départ du dôme : valeurs et pentes de la courbe du crâne à cette hauteur,
// pour que le dôme prolonge la tête sans pli visible sur le front
const DOME_Y = 7.4;
let DOME = null;
function domeStart() {
  const a = splineProfile(DOME_Y, {}), b = splineProfile(DOME_Y - 0.05, {});
  return { rx: a.rx, rz: a.rz, c: a.c, drx: (a.rx - b.rx) / 0.05, drz: (a.rz - b.rz) / 0.05 };
}
function baseProfile(y, out) {
  if (y > DOME_Y) {
    // dôme crânien analytique (quart d'ellipse), raccordé en pente à la courbe du dessous
    DOME = DOME || domeStart();
    const H = HEAD_TOP - DOME_Y;
    const k = Math.min(1, (y - DOME_Y) / H);
    const s = Math.sqrt(Math.max(0, 1 - k * k));
    const bend = k * (1 - k) * (1 - k);
    out.rx = Math.max(0.001, DOME.rx * s + DOME.drx * H * bend);
    out.rz = Math.max(0.001, DOME.rz * s + DOME.drz * H * bend);
    out.c = DOME.c + (-4.6 - DOME.c) * k * k;
    return out;
  }
  return splineProfile(y, out);
}
function splineProfile(y, out) {
  if (y <= K[K.length - 1][0]) {
    const k = K[K.length - 1];
    out.rx = k[1]; out.c = (k[2] + k[3]) / 2; out.rz = (k[2] - k[3]) / 2;
    return out;
  }
  let i = 0;
  while (i < K.length - 2 && y < K[i + 1][0]) i++;
  const a = K[Math.max(0, i - 1)], b = K[i], c = K[i + 1], d = K[Math.min(K.length - 1, i + 2)];
  const t = (b[0] - y) / (b[0] - c[0]);
  const rx = cr(a[1], b[1], c[1], d[1], t);
  const zf = cr(a[2], b[2], c[2], d[2], t);
  const zb = cr(a[3], b[3], c[3], d[3], t);
  out.rx = rx; out.c = (zf + zb) / 2; out.rz = (zf - zb) / 2;
  return out;
}

/** Point de la surface de base (sans visage) — theta = 0 face avant. */
export function surfacePoint(theta, y, out = new THREE.Vector3()) {
  const p = headProfile(y);
  return out.set(p.rx * Math.sin(theta), y, p.c + p.rz * Math.cos(theta));
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
export function surfaceNormal(theta, y, out = new THREE.Vector3()) {
  const e = 0.02;
  surfacePoint(theta + e, y, _a); surfacePoint(theta - e, y, _b);
  const tx = _a.sub(_b);
  surfacePoint(theta, y + e, _b); surfacePoint(theta, y - e, _c);
  const ty = _b.sub(_c);
  out.crossVectors(tx, ty).normalize();
  if (y > HEAD_TOP - 0.05) out.set(0, 1, 0);
  return out;
}

// --- Buste du mannequin : cou, épaules, haut du torse (collisions + maillage) ---
// Le haut du buste démarre juste à l'intérieur du cou : la jonction ne se voit pas.
const CAPE = [
  [-15.2, 5.55, 4.75],
  [-16.8, 5.95, 5.0],
  [-18.6, 7.7, 5.6],
  [-21.0, 11.2, 6.6],
  [-23.0, 15.2, 7.6],
  [-25.4, 18.6, 8.5],
  [-28.6, 20.6, 9.3],
  [-33.0, 21.0, 9.8],
  [-40.0, 20.2, 10.0],
  [-60.0, 19.6, 10.0],
];
export const CAPE_C = -4.7;
export function capeProfile(y) {
  if (y >= CAPE[0][0]) return null;
  let i = 0;
  while (i < CAPE.length - 2 && y < CAPE[i + 1][0]) i++;
  const a = CAPE[Math.max(0, i - 1)], b = CAPE[i], c = CAPE[i + 1], d = CAPE[Math.min(CAPE.length - 1, i + 2)];
  const t = Math.min(1, Math.max(0, (b[0] - y) / (b[0] - c[0])));
  return { rx: cr(a[1], b[1], c[1], d[1], t), rz: cr(a[2], b[2], c[2], d[2], t) };
}

export function insideHead(p) {
  if (p.y > HEAD_TOP || p.y < HEAD_BOTTOM) return false;
  const pr = headProfile(p.y);
  const u = p.x / pr.rx, w = (p.z - pr.c) / pr.rz;
  return u * u + w * w < 1;
}

/** Repousse un point hors de la tête, du cou, de la cape et du visage. */
export const HC = new THREE.Vector3(0, 2.6, -4.9);
const _d = new THREE.Vector3(), _q = new THREE.Vector3(), _od = new THREE.Vector3(), _oq = new THREE.Vector3();
function insideOffset(p, m) {
  _od.subVectors(p, HC); const L = _od.length();
  if (L <= m) return true;
  _oq.copy(HC).addScaledVector(_od, (L - m) / L);
  return insideHead(_oq);
}
export function collide(p, m) {
  if (p.y >= 0) {
    // crâne : repousse radialement jusqu'à la surface décalée de m
    if (insideOffset(p, m)) {
      _d.subVectors(p, HC); const L = _d.length() || 1e-6; _d.divideScalar(L);
      let lo = L, hi = 40;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        _q.copy(HC).addScaledVector(_d, mid);
        if (insideOffset(_q, m)) lo = mid; else hi = mid;
      }
      p.copy(HC).addScaledVector(_d, hi);
    }
  } else if (p.y > HEAD_BOTTOM) {
    const pr = headProfile(p.y);
    const rx = pr.rx + m, rz = pr.rz + m;
    const u = p.x / rx, w = (p.z - pr.c) / rz;
    const d = u * u + w * w;
    if (d < 1) {
      const s = 1 / Math.sqrt(Math.max(d, 1e-6));
      p.x = u * s * rx; p.z = pr.c + w * s * rz;
    }
  }
  // visage : zone interdite devant le visage
  if (p.z > -1.5 && p.y < 8.6 && p.y > -12 && Math.abs(p.x) < 7.2 + m) {
    p.x = Math.sign(p.x || 1) * (7.2 + m);
  }
  // épaules / cape
  const cp = capeProfile(p.y);
  if (cp) {
    const rx = cp.rx + m, rz = cp.rz + m;
    const u = p.x / rx, w = (p.z - CAPE_C) / rz;
    const d = u * u + w * w;
    if (d < 1) {
      const s = 1 / Math.sqrt(Math.max(d, 1e-6));
      p.x = u * s * rx; p.z = CAPE_C + w * s * rz;
    }
  }
  return p;
}

// --- Rasterisation du visage dans une carte de hauteur frontale ---
const FX0 = -8.6, FX1 = 8.6, FY0 = -10.2, FY1 = 9.2, RES = 0.1;
const GW = Math.round((FX1 - FX0) / RES) + 1, GH = Math.round((FY1 - FY0) / RES) + 1;

function rasterFace(verts, uvs) {
  const z = new Float32Array(GW * GH).fill(-1e9);
  const u = new Float32Array(GW * GH), v = new Float32Array(GW * GH);
  const tri = canon.f;
  for (let t = 0; t < tri.length; t += 3) {
    const i0 = tri[t], i1 = tri[t + 1], i2 = tri[t + 2];
    const x0 = (verts[i0 * 3] - FX0) / RES, y0 = (verts[i0 * 3 + 1] - FY0) / RES, z0 = verts[i0 * 3 + 2];
    const x1 = (verts[i1 * 3] - FX0) / RES, y1 = (verts[i1 * 3 + 1] - FY0) / RES, z1 = verts[i1 * 3 + 2];
    const x2 = (verts[i2 * 3] - FX0) / RES, y2 = (verts[i2 * 3 + 1] - FY0) / RES, z2 = verts[i2 * 3 + 2];
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(GW - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(GH - 1, Math.ceil(Math.max(y0, y1, y2)));
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(den) < 1e-9) continue;
    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const a = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / den;
        const b = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / den;
        const c = 1 - a - b;
        if (a < -1e-4 || b < -1e-4 || c < -1e-4) continue;
        const zz = a * z0 + b * z1 + c * z2;
        const k = gy * GW + gx;
        if (zz > z[k]) {
          z[k] = zz;
          if (uvs) {
            u[k] = a * uvs[i0 * 2] + b * uvs[i1 * 2] + c * uvs[i2 * 2];
            v[k] = a * uvs[i0 * 2 + 1] + b * uvs[i1 * 2 + 1] + c * uvs[i2 * 2 + 1];
          }
        }
      }
    }
  }
  // distance au bord (chanfrein 2 passes), en cm
  const dist = new Float32Array(GW * GH);
  const INF = 1e9;
  for (let k = 0; k < dist.length; k++) dist[k] = z[k] > -1e8 ? INF : 0;
  const D1 = RES, D2 = RES * 1.4142;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const k = y * GW + x; if (!dist[k]) continue;
    let d = dist[k];
    if (x > 0) d = Math.min(d, dist[k - 1] + D1); else d = Math.min(d, D1);
    if (y > 0) d = Math.min(d, dist[k - GW] + D1); else d = Math.min(d, D1);
    if (x > 0 && y > 0) d = Math.min(d, dist[k - GW - 1] + D2);
    if (x < GW - 1 && y > 0) d = Math.min(d, dist[k - GW + 1] + D2);
    dist[k] = d;
  }
  for (let y = GH - 1; y >= 0; y--) for (let x = GW - 1; x >= 0; x--) {
    const k = y * GW + x; if (!dist[k]) continue;
    let d = dist[k];
    if (x < GW - 1) d = Math.min(d, dist[k + 1] + D1); else d = Math.min(d, D1);
    if (y < GH - 1) d = Math.min(d, dist[k + GW] + D1); else d = Math.min(d, D1);
    if (x < GW - 1 && y < GH - 1) d = Math.min(d, dist[k + GW + 1] + D2);
    if (x > 0 && y < GH - 1) d = Math.min(d, dist[k + GW - 1] + D2);
    dist[k] = d;
  }
  // lissage de la profondeur (adoucit les facettes du maillage 468 points)
  for (let pass = 0; pass < 3; pass++) {
    const zs = new Float32Array(z);
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
      const k = y * GW + x; if (!dist[k]) continue;
      let s = 0, n = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const kk = k + oy * GW + ox; if (dist[kk]) { s += z[kk]; n++; }
      }
      zs[k] = s / n;
    }
    z.set(zs);
  }
  return { z, u, v, dist };
}

function sampleField(F, x, y) {
  const gx = (x - FX0) / RES, gy = (y - FY0) / RES;
  if (gx < 0 || gy < 0 || gx >= GW - 1 || gy >= GH - 1) return null;
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const k = y0 * GW + x0;
  const ks = [k, k + 1, k + GW, k + GW + 1], ws = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  let z = 0, u = 0, v = 0, d = 0, wsum = 0;
  for (let i = 0; i < 4; i++) {
    const kk = ks[i];
    d += F.dist[kk] * ws[i];
    if (F.dist[kk] > 0) { z += F.z[kk] * ws[i]; u += F.u[kk] * ws[i]; v += F.v[kk] * ws[i]; wsum += ws[i]; }
  }
  if (wsum < 1e-4) return null;
  return { z: z / wsum, u: u / wsum, v: v / wsum, d };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Construit la géométrie tête + cou fusionnée avec le visage. */
export function buildHeadGeometry(verts, uvs, { NT = 240, NY = 260 } = {}) {
  const F = rasterFace(verts, uvs);
  const pos = new Float32Array((NT + 1) * (NY + 1) * 3);
  const uv = new Float32Array((NT + 1) * (NY + 1) * 2);
  const face = new Float32Array((NT + 1) * (NY + 1));
  const P = new THREE.Vector3();
  for (let j = 0; j <= NY; j++) {
    const t = j / NY;
    // plus de rangées sur le haut du crâne
    const y = HEAD_TOP - (HEAD_TOP - HEAD_BOTTOM) * (t < 0.08 ? Math.pow(t / 0.08, 1.6) * 0.08 : t);
    for (let i = 0; i <= NT; i++) {
      const th = -Math.PI + (i / NT) * Math.PI * 2;
      surfacePoint(th, y, P);
      const k = j * (NT + 1) + i;
      if (Math.cos(th) > 0.02) {
        const s = sampleField(F, P.x, P.y);
        if (s) {
          const w = smooth(0.0, 1.5, s.d);
          P.z = P.z + (s.z - P.z) * w;
          face[k] = smooth(0.35, 2.0, s.d);
          uv[k * 2] = s.u; uv[k * 2 + 1] = s.v;
        }
      }
      pos[k * 3] = P.x; pos[k * 3 + 1] = P.y; pos[k * 3 + 2] = P.z;
    }
  }
  const idx = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) {
    const a = j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aFace', new THREE.BufferAttribute(face, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  // soude la couture arrière (theta = ±π)
  const n = g.attributes.normal;
  for (let j = 0; j <= NY; j++) {
    const a = j * (NT + 1), b = a + NT;
    const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2;
    n.setXYZ(a, x, y, z); n.setXYZ(b, x, y, z);
  }
  return g;
}

export function canonicalVerts() { return Float32Array.from(canon.v); }

/**
 * Visage du mannequin de vitrine : la surface lisse du crâne, sculptée de quelques
 * reliefs très doux (arête du nez, arcades, pommettes, menton). Ni yeux ni bouche.
 */
let _blank = null;
export function mannequinVerts() {
  if (_blank) return Float32Array.from(_blank);
  const c = canon.v, n = c.length / 3;
  const pr = { rx: 0, c: 0, rz: 0 };
  const g = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  const v = Float32Array.from(c);
  for (let i = 0; i < n; i++) {
    const x = c[i * 3], y = c[i * 3 + 1];
    baseProfile(y, pr);
    const u = Math.min(0.98, Math.abs(x) / pr.rx);
    let z = pr.c + pr.rz * Math.sqrt(1 - u * u);
    z += 1.1 * g(x, y, 0, -0.6, 0.9, 2.6) * (y < 2.6 ? 1 : 0.55);    // nez
    z += 0.7 * g(x, y, 0, -2.6, 1.2, 0.9);                              // bout du nez
    z += 0.35 * (g(x, y, -3.1, 4.2, 2.2, 0.8) + g(x, y, 3.1, 4.2, 2.2, 0.8)); // arcades
    z -= 0.28 * (g(x, y, -3.1, 2.7, 1.6, 1.0) + g(x, y, 3.1, 2.7, 1.6, 1.0)); // orbites
    z += 0.25 * (g(x, y, -3.9, -0.6, 1.8, 1.6) + g(x, y, 3.9, -0.6, 1.8, 1.6)); // pommettes
    z += 0.3 * g(x, y, 0, -5.0, 1.6, 0.7);                              // lèvres, à peine
    z += 0.5 * g(x, y, 0, -7.6, 2.2, 1.2);                              // menton
    v[i * 3 + 2] = z;
  }
  _blank = v;
  return Float32Array.from(v);
}

export function canonicalUVs() { return Float32Array.from(canon.uv); }
export const FACE_TRIS = canon.f;

/** Aligne les 468 points MediaPipe (image) sur le repère canonique. */
export function alignLandmarks(lms, W, H) {
  const P = [];
  for (let i = 0; i < 468; i++) P.push(new THREE.Vector3(lms[i].x * W, -lms[i].y * H, -lms[i].z * W));
  const a = P[234], b = P[454], top = P[10], bot = P[152];
  const O = a.clone().add(b).multiplyScalar(0.5);
  const X = b.clone().sub(a); const s = 15.3284 / X.length(); X.normalize();
  const Y = top.clone().sub(bot); Y.sub(X.clone().multiplyScalar(Y.dot(X))).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const out = new Float32Array(468 * 3);
  const cv = canon.v;
  for (let i = 0; i < 468; i++) {
    const d = P[i].sub(O);
    const x = d.dot(X) * s, y = d.dot(Y) * s + 0.6731, z = d.dot(Z) * s - 2.4359;
    out[i * 3] = x; out[i * 3 + 1] = y;
    // profondeur : mélange scan / modèle canonique pour rester robuste
    out[i * 3 + 2] = z * 0.6 + cv[i * 3 + 2] * 0.4;
  }
  return out;
}
