// Découpage du modèle 3D produit à partir de la photo : on garde les cheveux,
// on retire la tête, le cou et les épaules générés, puis on cale la coiffure sur le mannequin GARO.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { headProfile, HEAD_TOP } from '../three/head.js';

// repères du mannequin (cm) : bas du cou, naissance des cheveux au front, centre du cou
const NECK_Y = -12.5, NECK_Z = -4.7;

/** Lit le .glb et prépare l'analyse (couleurs par sommet, groupes peau / cheveux). */
export async function analyse(buffer) {
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buffer, '', res, rej));
  gltf.scene.updateMatrixWorld(true);
  // un seul maillage attendu ; sinon on fusionne les positions dans le repère du monde
  const parts = [];
  gltf.scene.traverse((o) => { if (o.isMesh) parts.push(o); });
  if (!parts.length) throw new Error('Le modèle reçu est vide.');
  const mesh = parts.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const pos = geo.attributes.position, uv = geo.attributes.uv, n = pos.count;
  const index = geo.index ? geo.index.array : Uint32Array.from({ length: n }, (_, i) => i);

  // couleur de chaque sommet, lue dans la texture
  const col = new Float32Array(n * 3);
  const map = mesh.material?.map;
  if (map?.image && uv) {
    const img = map.image, w = img.width, h = img.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, w, h).data;
    for (let i = 0; i < n; i++) {
      let u = uv.getX(i), v = uv.getY(i);
      if (map.flipY === false) { /* glTF : v vers le bas */ } else v = 1 - v;
      const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1)))), y = Math.min(h - 1, Math.max(0, Math.round(v * (h - 1))));
      const o = (y * w + x) * 4;
      col[i * 3] = px[o] / 255; col[i * 3 + 1] = px[o + 1] / 255; col[i * 3 + 2] = px[o + 2] / 255;
    }
  } else {
    const c = mesh.material?.color || new THREE.Color(0.1, 0.1, 0.1);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  }

  // deux familles de couleurs (k-moyennes) : les cheveux sont celle qui domine le haut du modèle
  const C = [[0.1, 0.08, 0.07], [0.8, 0.7, 0.6]];
  const lab = new Array(n);
  for (let it = 0; it < 12; it++) {
    const s = [[0, 0, 0, 0], [0, 0, 0, 0]];
    for (let i = 0; i < n; i++) {
      const r = col[i * 3], g = col[i * 3 + 1], b = col[i * 3 + 2];
      const d0 = (r - C[0][0]) ** 2 + (g - C[0][1]) ** 2 + (b - C[0][2]) ** 2;
      const d1 = (r - C[1][0]) ** 2 + (g - C[1][1]) ** 2 + (b - C[1][2]) ** 2;
      const k = d0 <= d1 ? 0 : 1; lab[i] = k;
      s[k][0] += r; s[k][1] += g; s[k][2] += b; s[k][3]++;
    }
    for (let k = 0; k < 2; k++) if (s[k][3]) C[k] = [s[k][0] / s[k][3], s[k][1] / s[k][3], s[k][2] / s[k][3]];
  }
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < n; i++) { const y = pos.getY(i); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  const top = ymax - (ymax - ymin) * 0.08;
  let t0 = 0, t1 = 0;
  for (let i = 0; i < n; i++) if (pos.getY(i) > top) (lab[i] ? t1++ : t0++);
  const HAIR = t0 >= t1 ? 0 : 1, SKIN = 1 - HAIR;
  // score « cheveux » de chaque sommet : 1 = couleur des cheveux, 0 = couleur de la peau
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = col[i * 3], g = col[i * 3 + 1], b = col[i * 3 + 2];
    const dh = Math.sqrt((r - C[HAIR][0]) ** 2 + (g - C[HAIR][1]) ** 2 + (b - C[HAIR][2]) ** 2);
    const ds = Math.sqrt((r - C[SKIN][0]) ** 2 + (g - C[SKIN][1]) ** 2 + (b - C[SKIN][2]) ** 2);
    score[i] = ds / (dh + ds + 1e-6);
  }
  const auto = align(pos, score, 0.5);
  auto.fine = refine(pos, score, auto);
  return { gltf, mesh, geo, pos, index, score, colors: { hair: C[HAIR], skin: C[SKIN] }, auto, n };
}

/**
 * Calage automatique sur le mannequin :
 * - l'échelle vient de l'épaisseur du cou (indépendante de l'orientation du modèle) ;
 * - le cou du modèle se pose sur celui du mannequin ;
 * - le menton, devant le cou, donne la direction du visage.
 */
const NECK_D = 10.4;   // diamètre moyen du cou du mannequin (cm)
function align(pos, score, thr) {
  const n = pos.count;
  const skin = [], hair = [];
  for (let i = 0; i < n; i++) (score[i] < thr ? skin : hair).push(i);
  const hb = new THREE.Box3();
  for (const i of hair) hb.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  if (skin.length > n * 0.05) {
    const NS = 40;
    let y0 = Infinity, y1 = -Infinity;
    for (const i of skin) { const y = pos.getY(i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const H = y1 - y0 || 1;
    const sl = Array.from({ length: NS }, () => ({ x: 0, z: 0, c: 0, ids: [] }));
    for (const i of skin) {
      const k = Math.min(NS - 1, Math.floor(((pos.getY(i) - y0) / H) * NS));
      sl[k].x += pos.getX(i); sl[k].z += pos.getZ(i); sl[k].c++; sl[k].ids.push(i);
    }
    // rayon moyen de chaque tranche autour de son centre
    const rad = sl.map((t) => {
      if (t.c < 12) return NaN;
      const cx = t.x / t.c, cz = t.z / t.c;
      let r = 0; for (const i of t.ids) r += Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz);
      return r / t.c;
    });
    // le cou : la tranche la plus fine sous la tête (on ignore les extrémités, souvent tronquées)
    let neck = -1, nr = Infinity;
    for (let k = Math.floor(NS * 0.12); k < Math.floor(NS * 0.8); k++) if (rad[k] < nr) { nr = rad[k]; neck = k; }
    if (neck >= 0 && Number.isFinite(nr) && nr > 0) {
      const t = sl[neck], cx = t.x / t.c, cz = t.z / t.c;
      const neckY = y0 + ((neck + 0.5) / NS) * H;
      let top = -Infinity;
      for (let i = 0; i < n; i++) top = Math.max(top, pos.getY(i));
      const Hh = Math.max(1e-6, top - neckY);
      // échelle : moyenne de deux mesures, le cou (10,4 cm) et la hauteur cou → sommet (≈ 30 cm, cheveux compris)
      const s = Math.sqrt((NECK_D / (2 * nr)) * (30 / Hh));
      // direction du visage : le nez est la peau la plus saillante devant l'axe de la tête
      const lo = neckY + 0.2 * Hh, hi = neckY + 0.55 * Hh;
      let ax = 0, az = 0, ac = 0;
      for (let i = 0; i < n; i++) { const y = pos.getY(i); if (y > lo && y < hi) { ax += pos.getX(i); az += pos.getZ(i); ac++; } }
      ax /= ac || 1; az /= ac || 1;
      const cand = [];
      for (const i of skin) { const y = pos.getY(i); if (y > lo && y < hi) cand.push([Math.hypot(pos.getX(i) - ax, pos.getZ(i) - az), pos.getX(i) - ax, pos.getZ(i) - az]); }
      cand.sort((p, q) => q[0] - p[0]);
      let fx = 0, fz = 0;
      for (const c of cand.slice(0, Math.max(3, Math.round(cand.length * 0.03)))) { fx += c[1] / c[0]; fz += c[2] / c[0]; }
      const yaw = Math.hypot(fx, fz) > 1e-6 ? Math.atan2(fx, fz) : 0;
      return { method: 'cou', scale: s, yaw: -yaw, pivot: [cx, neckY, cz], target: [0, NECK_Y, NECK_Z] };
    }
  }
  // sinon : la coiffure seule, calée par sa taille
  const c = hb.getCenter(new THREE.Vector3());
  const s = 30 / Math.max(hb.max.y - hb.min.y, hb.max.x - hb.min.x, 1e-6);
  return { method: 'taille', scale: s, yaw: 0, pivot: [c.x, hb.max.y, c.z], target: [0, 16, -4.9] };
}

/**
 * Ajustement : la taille et la position où l'intérieur de la coiffure épouse le crâne du mannequin
 * (au plus près, sans le traverser). Recherche large puis fine : le calage approximatif (cou, nez)
 * ne fournit que l'orientation et un point de départ, l'échelle finale vient du crâne.
 */
const FIT_C = [0, 6, -4.9];   // point du mannequin où l'on pose le centre de la coiffure au départ
function refine(pos, score, al) {
  const ids = [];
  for (let i = 0; i < pos.count; i++) if (score[i] >= 0.5) ids.push(i);
  if (ids.length < 50) return { k: 1, d: [0, 0, 0], c0: [0, 0, 0] };
  const step = Math.max(1, Math.floor(ids.length / 1500));
  const c = Math.cos(al.yaw), sn = Math.sin(al.yaw);
  // positions après le calage approximatif
  const P = [];
  const c0 = [0, 0, 0];
  for (let j = 0; j < ids.length; j += step) {
    const i = ids[j];
    const x = (pos.getX(i) - al.pivot[0]) * al.scale, y = (pos.getY(i) - al.pivot[1]) * al.scale, z = (pos.getZ(i) - al.pivot[2]) * al.scale;
    const p = [al.target[0] + x * c + z * sn, al.target[1] + y, al.target[2] - x * sn + z * c];
    P.push(p); c0[0] += p[0]; c0[1] += p[1]; c0[2] += p[2];
  }
  c0[0] /= P.length; c0[1] /= P.length; c0[2] /= P.length;
  // la coiffure, centrée sur son centre de masse
  const Q = P.map((p) => [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]]);
  const pr = { rx: 0, c: 0, rz: 0 };
  const dist = (x, y, z) => {
    if (y > HEAD_TOP) return y - HEAD_TOP + Math.max(0, Math.hypot(x, z + 4.6) - 3) * 0.3;
    if (y < -9) return 99;   // sous la mâchoire : non pris en compte (tresses longues)
    headProfile(y, pr);
    const u = Math.hypot(x / pr.rx, (z - pr.c) / pr.rz);
    return (u - 1) * (pr.rx + pr.rz) * 0.5;
  };
  // étendue de la coiffure (5 % – 95 %), pour exiger qu'elle entoure le crâne
  const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  const xs = Q.map((q) => q[0]).sort((m, n) => m - n), zs = Q.map((q) => q[2]).sort((m, n) => m - n), ys = Q.map((q) => q[1]).sort((m, n) => m - n);
  const W0 = pct(xs, 0.95) - pct(xs, 0.05), D0 = pct(zs, 0.95) - pct(zs, 0.05), Ytop = pct(ys, 0.98);
  const ds = new Float32Array(Q.length);
  const fitScore = (k, dy, dz) => {
    // couverture : au moins la largeur (≈ 16 cm) et la profondeur (≈ 19 cm) du crâne, et son sommet
    const cover = Math.max(0, 14.5 - k * W0) / 1.5 + Math.max(0, 16.5 - k * D0) / 1.5 + Math.max(0, HEAD_TOP - (FIT_C[1] + Ytop * k + dy)) / 2;
    let inside = 0, n = 0;
    for (const q of Q) {
      const d = dist(FIT_C[0] + q[0] * k, FIT_C[1] + q[1] * k + dy, FIT_C[2] + q[2] * k + dz);
      if (d === 99) continue;
      if (d < -0.3) inside++;
      ds[n++] = d;
    }
    if (n < Q.length * 0.25 || n < 20) return Infinity;
    const arr = ds.slice(0, n).sort();
    const q20 = arr[Math.floor(n * 0.2)], q60 = arr[Math.floor(n * 0.6)];
    // ni à travers le crâne, ni flottante : la face interne colle (≈ 0,6 cm), le volume reste près
    return (inside / n) * 14 + Math.abs(q20 - 0.6) / 3 + Math.max(0, q60 - 9) / 6 + cover;
  };
  // recherche large (taille de ×0,35 à ×2,8), puis fine autour du meilleur
  let best = { k: 1, dy: 0, dz: 0 }, bs = Infinity;
  for (let e = -1.6; e <= 1.03; e += 0.09) {
    const k = Math.exp(e);
    for (let dy = -14; dy <= 10; dy += 2) for (let dz = -8; dz <= 8; dz += 2) {
      const v = fitScore(k, dy, dz);
      if (v < bs) { bs = v; best = { k, dy, dz }; }
    }
  }
  const b0 = { ...best };
  for (let k = b0.k * 0.9; k <= b0.k * 1.1001; k += b0.k * 0.025) for (let dy = b0.dy - 2; dy <= b0.dy + 2.001; dy += 0.5) for (let dz = b0.dz - 2; dz <= b0.dz + 2.001; dz += 0.5) {
    const v = fitScore(k, dy, dz);
    if (v < bs) { bs = v; best = { k, dy, dz }; }
  }
  return { k: best.k, d: [FIT_C[0], FIT_C[1] + best.dy, FIT_C[2] + best.dz], c0, score: bs };
}

/**
 * Construit la coiffure découpée et calée.
 * opts : { threshold (0→1, plus haut = moins de cheveux gardés), scale, yaw (rad), dy, dz }
 */
export function buildHair(A, opts = {}) {
  const thr = opts.threshold ?? 0.5;
  const keep = [];
  const idx = A.index;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const h = (A.score[a] >= thr) + (A.score[b] >= thr) + (A.score[c] >= thr);
    if (h >= 2) keep.push(a, b, c);
  }
  // morceaux isolés (ombres foncées sur le buste, taches) : on garde la masse principale
  // et tout morceau qui monte au-dessus du cou
  const parent = new Int32Array(A.n).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < keep.length; t += 3) {
    const r0 = find(keep[t]), r1 = find(keep[t + 1]), r2 = find(keep[t + 2]);
    if (r1 !== r0) parent[r1] = r0;
    const r2b = find(r2); if (r2b !== find(r0)) parent[r2b] = find(r0);
  }
  const size = new Map(), high = new Map();
  const neckY = A.auto.pivot[1];
  for (let t = 0; t < keep.length; t += 3) {
    const r = find(keep[t]);
    size.set(r, (size.get(r) || 0) + 1);
    const y = Math.max(A.pos.getY(keep[t]), A.pos.getY(keep[t + 1]), A.pos.getY(keep[t + 2]));
    high.set(r, Math.max(high.get(r) ?? -Infinity, y));
  }
  const biggest = Math.max(0, ...size.values());
  const total = keep.length / 3;
  const parts = [...size.values()].filter((v) => v > total * 0.15).length;
  const ok = (r) => size.get(r) >= biggest * 0.05 || high.get(r) > neckY;
  const kept = [];
  for (let t = 0; t < keep.length; t += 3) if (ok(find(keep[t]))) kept.push(keep[t], keep[t + 1], keep[t + 2]);
  keep.length = 0; keep.push(...kept);
  const geo = A.geo.clone();
  geo.setIndex(keep);
  geo.computeVertexNormals();
  const mat = A.mesh.material.clone();
  mat.side = THREE.DoubleSide;
  mat.name = 'cheveux';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'cheveux';
  // calage : pivot du modèle → repère du mannequin, puis réglages manuels
  const al = A.auto;
  const inner = new THREE.Group();
  inner.add(mesh);
  mesh.position.set(-al.pivot[0], -al.pivot[1], -al.pivot[2]);
  const outer = new THREE.Group();
  outer.add(inner);
  inner.rotation.y = al.yaw + (opts.yaw || 0);
  inner.scale.setScalar(al.scale);
  outer.position.set(al.target[0], al.target[1], al.target[2]);
  // ajustement au crâne (taille, position) puis réglages manuels, autour du centre de la coiffure
  const fine = al.fine || { k: 1, d: [0, 0, 0], c0: [0, 0, 0] };
  const k = fine.k * (opts.scale || 1);
  const center = new THREE.Group();          // centre de la coiffure à l'origine
  center.position.set(-fine.c0[0], -fine.c0[1], -fine.c0[2]);
  center.add(outer);
  const fit = new THREE.Group();
  fit.add(center);
  fit.scale.setScalar(k);
  fit.rotation.x = opts.tilt || 0;
  fit.position.set(fine.d[0], fine.d[1] + (opts.dy || 0), fine.d[2] + (opts.dz || 0));
  fit.updateMatrixWorld(true);
  return { group: fit, triangles: keep.length / 3, parts, fit: fine.score };
}

/** Exporte la coiffure calée en .glb (centimètres, repère du mannequin). */
export async function exportHair(group) {
  group.updateMatrixWorld(true);
  const src = group.getObjectByName('cheveux');
  const geo = src.geometry.clone().applyMatrix4(src.matrixWorld);
  const mesh = new THREE.Mesh(geo, src.material);
  mesh.name = 'cheveux';
  const scene = new THREE.Scene();
  scene.add(mesh);
  return new GLTFExporter().parseAsync(scene, { binary: true, maxTextureSize: 1024 });
}
