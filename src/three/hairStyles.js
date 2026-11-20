// Générateurs procéduraux de coiffures (aucun asset externe).
import * as THREE from 'three';
import { surfacePoint, surfaceNormal, collide, headProfile, insideHead, HEAD_TOP } from './head.js';
import { makeStrandMaterial, makeShellMaterial } from './hairMaterials.js';

// ---------- utilitaires ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// bruit de valeur 3D (pour l'afro)
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return r;
}

/** Hauteur de la ligne d'implantation selon l'angle autour de la tête. */
export function hairlineY(theta, shift = 0) {
  const a = Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta))) / Math.PI; // 0 avant, 1 arrière
  let h;
  if (a < 0.5) h = lerp(8.1, 3.4, smooth(0.08, 0.5, a));
  else h = lerp(3.4, -6.6, smooth(0.52, 0.95, a));
  return h + shift;
}
export function hairMask(theta, y, shift = 0, feather = 0.9) {
  const h = hairlineY(theta, shift);
  return smooth(h - feather * 0.4, h + feather, y);
}

// ---------- coque (cheveux courts / base) ----------
function buildShell({ thickness, shift = 0, feather = 0.9, yMin = -9, NT = 200, NY = 150, maskFn = null }) {
  const pos = new Float32Array((NT + 1) * (NY + 1) * 3);
  const mask = new Float32Array((NT + 1) * (NY + 1));
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let j = 0; j <= NY; j++) {
    const t = j / NY;
    const y = HEAD_TOP - (HEAD_TOP - yMin) * (t < 0.1 ? Math.pow(t / 0.1, 1.5) * 0.1 : t);
    for (let i = 0; i <= NT; i++) {
      const th = -Math.PI + (i / NT) * Math.PI * 2;
      surfacePoint(th, y, P); surfaceNormal(th, y, N);
      const m = maskFn ? maskFn(th, y) : hairMask(th, y, shift, feather);
      const k = j * (NT + 1) + i;
      const th2 = thickness(th, y, P, N, m);
      P.addScaledVector(N, 0.07 + th2);
      pos[k * 3] = P.x; pos[k * 3 + 1] = P.y; pos[k * 3 + 2] = P.z;
      mask[k] = m;
    }
  }
  const idx = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) {
    const a = j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- mèches / tresses ----------
const DOWN = new THREE.Vector3(0, -1, 0);
const HEAD_C = new THREE.Vector3(0, 2.6, -4.9);
function growStrand(root, dir, { length, segs = 26, gravity = 0.16, margin = 0.6, wobble = 0, rand = Math.random, bias = null, hug = 0 }) {
  const radial = new THREE.Vector3();
  const p = root.clone();
  const d = dir.clone().normalize();
  const step = length / segs;
  const pts = [p.clone()];
  const prev = new THREE.Vector3();
  for (let i = 1; i <= segs; i++) {
    prev.copy(p);
    d.addScaledVector(DOWN, gravity);
    if (bias) d.addScaledVector(bias, 0.05);
    if (hug && p.y > -1) { radial.subVectors(p, HEAD_C).normalize(); d.addScaledVector(radial, -hug * smooth(-1, 4, p.y)); }
    if (wobble) d.add(new THREE.Vector3((rand() - 0.5) * wobble, 0, (rand() - 0.5) * wobble));
    d.normalize();
    p.addScaledVector(d, step);
    collide(p, margin);
    d.subVectors(p, prev);
    if (d.lengthSq() < 1e-6) d.copy(DOWN);
    d.normalize();
    pts.push(p.clone());
  }
  return pts;
}

/**
 * Construit des tubes (tresses, locks, mèches) fusionnés dans une seule géométrie.
 * strands: [{ pts, radius, rand }]
 */
function buildTubes(strands, { samples = 48, radial = 8, lobes = 0, lobeAmp = 0, twist = 0, flat = 1, taper = 0.3, rootTaper = 0.15, lumpy = 0 }) {
  const vertsPer = samples * (radial + 1);
  const total = strands.length * vertsPer;
  const pos = new Float32Array(total * 3), tan = new Float32Array(total * 3);
  const aT = new Float32Array(total), aRand = new Float32Array(total), aU = new Float32Array(total);
  const idx = new Uint32Array(strands.length * (samples - 1) * radial * 6);
  let v = 0, ii = 0;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), tmp = new THREE.Vector3();
  for (const s of strands) {
    const curve = new THREE.CatmullRomCurve3(s.pts, false, 'centripetal');
    const pts = curve.getSpacedPoints(samples - 1);
    const len = curve.getLength();
    // repère transporté parallèlement
    T.subVectors(pts[1], pts[0]).normalize();
    N.set(0, 0, 1).cross(T); if (N.lengthSq() < 1e-4) N.set(1, 0, 0).cross(T); N.normalize();
    const base = v;
    const phase = s.rand * 6.283;
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      if (i > 0) {
        tmp.subVectors(pts[Math.min(samples - 1, i + 1)], pts[i - 1]).normalize();
        T.copy(tmp);
        N.addScaledVector(T, -N.dot(T)).normalize();
      }
      B.crossVectors(T, N);
      let r = s.radius * (1 - taper * smooth(0.75, 1, t)) * (1 - rootTaper * (1 - smooth(0, 0.06, t)));
      if (lumpy) r *= 1 + lumpy * (vnoise(s.rand * 50, t * len * 0.35, 0) - 0.5);
      const sArc = t * len;
      for (let j = 0; j <= radial; j++) {
        const phi = (j / radial) * Math.PI * 2;
        let rr = r;
        if (lobes) rr *= 1 + lobeAmp * Math.cos(lobes * (phi + twist * sArc + phase));
        const cx = Math.cos(phi) * rr * flat, cy = Math.sin(phi) * rr;
        const k = v * 3;
        pos[k] = pts[i].x + N.x * cx + B.x * cy;
        pos[k + 1] = pts[i].y + N.y * cx + B.y * cy;
        pos[k + 2] = pts[i].z + N.z * cx + B.z * cy;
        tan[k] = T.x; tan[k + 1] = T.y; tan[k + 2] = T.z;
        aT[v] = t; aRand[v] = s.rand; aU[v] = j / radial;
        v++;
      }
    }
    for (let i = 0; i < samples - 1; i++) for (let j = 0; j < radial; j++) {
      const a = base + i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
      idx[ii++] = a; idx[ii++] = b; idx[ii++] = c; idx[ii++] = b; idx[ii++] = d; idx[ii++] = c;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aTan', new THREE.BufferAttribute(tan, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));
  g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** Points de racine répartis sur le cuir chevelu. */
function scalpRoots({ spacing, shift = 0, inset = 0.6, rand, jitter = 0.35, yMax = HEAD_TOP - 0.3 }) {
  const roots = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let y = yMax; y > -8; y -= spacing * 0.86) {
    const pr = headProfile(y);
    const a = pr.rx, b = pr.rz;
    const perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    const count = Math.max(1, Math.round(perim / spacing));
    const off = rand() * 6.28;
    for (let i = 0; i < count; i++) {
      const th = off + (i / count) * Math.PI * 2 + (rand() - 0.5) * jitter * (6.28 / count);
      const yy = y + (rand() - 0.5) * jitter * spacing;
      if (hairMask(th, yy, shift, 0.01) < 0.5) continue;
      // garde la racine un peu à l'intérieur de la ligne d'implantation
      if (yy < hairlineY(th, shift) + inset) continue;
      surfacePoint(th, yy, P); surfaceNormal(th, yy, N);
      roots.push({ th, y: yy, p: P.clone(), n: N.clone() });
    }
  }
  return roots;
}

// direction initiale : glisse le long du crâne vers le bas/l'arrière, légèrement décollée
function outwardBack(r, back = 0.7, side = 0.4, lift = 0.25) {
  // racines avant : on part franchement vers l'arrière pour dégager le visage
  const front = Math.max(0, r.n.z) * smooth(-2, 4, r.p.z);
  const g = new THREE.Vector3(Math.sign(r.p.x) * side * smooth(0.3, 3, Math.abs(r.p.x)), -1, -back - front * 2.6);
  g.addScaledVector(r.n, -g.dot(r.n));
  if (g.lengthSq() < 1e-4) g.set(0, 0, -1);
  g.normalize().addScaledVector(r.n, lift);
  return g.normalize();
}

// ---------- catalogue des générateurs ----------
const builders = {
  braids(common, seed = 7) {
    const rand = rng(seed);
    const roots = scalpRoots({ spacing: 2.05, rand, inset: 0.5 });
    const strands = roots.map((r) => ({
      pts: growStrand(r.p.clone().addScaledVector(r.n, 0.25), outwardBack(r, 0.8, 0.45, 0.12), {
        length: 46 + rand() * 6, segs: 34, gravity: 0.2, margin: 0.75, rand, wobble: 0.04, hug: 0.16,
      }),
      radius: 0.46, rand: rand(),
    }));
    const tubes = buildTubes(strands, { samples: 72, radial: 9, lobes: 3, lobeAmp: 0.32, twist: 2.3, taper: 0.45 });
    const m = makeStrandMaterial(common); m.uniforms.uShine.value = 55; m.uniforms.uStriation.value = 22; m.uniforms.uLobeShade.value = 0.35;
    const base = buildShell({ thickness: () => 0.12 });
    return [new THREE.Mesh(tubes, m), new THREE.Mesh(base, makeShellMaterial(common, 4, { target: new THREE.Vector3(0, -2, -16) }))];
  },

  locks(common, seed = 11) {
    const rand = rng(seed);
    const roots = scalpRoots({ spacing: 2.5, rand, inset: 0.6 });
    const strands = roots.map((r) => ({
      pts: growStrand(r.p.clone().addScaledVector(r.n, 0.3), outwardBack(r, 0.6, 0.5, 0.35), {
        length: 30 + rand() * 9, segs: 28, gravity: 0.17, margin: 0.9, rand, wobble: 0.1, hug: 0.08,
      }),
      radius: 0.6 + rand() * 0.15, rand: rand(),
    }));
    const tubes = buildTubes(strands, { samples: 52, radial: 9, lobes: 2, lobeAmp: 0.08, twist: 1.1, taper: 0.25, lumpy: 0.35 });
    const m = makeStrandMaterial(common); m.uniforms.uShine.value = 18; m.uniforms.uStriation.value = 40;
    const base = buildShell({ thickness: () => 0.25 });
    return [new THREE.Mesh(tubes, m), new THREE.Mesh(base, makeShellMaterial(common, 3))];
  },

  twists(common, seed = 5) {
    const rand = rng(seed);
    const roots = scalpRoots({ spacing: 1.85, rand, inset: 0.4 });
    const strands = roots.map((r) => ({
      pts: growStrand(r.p.clone().addScaledVector(r.n, 0.25), outwardBack(r, 0.45, 0.6, 0.3), {
        length: 20 + rand() * 4, segs: 24, gravity: 0.17, margin: 0.8, rand, wobble: 0.05, hug: 0.05,
      }),
      radius: 0.42, rand: rand(),
    }));
    const tubes = buildTubes(strands, { samples: 46, radial: 8, lobes: 2, lobeAmp: 0.38, twist: 2.8, taper: 0.35 });
    const m = makeStrandMaterial(common); m.uniforms.uShine.value = 45; m.uniforms.uStriation.value = 20; m.uniforms.uLobeShade.value = 0.3;
    const base = buildShell({ thickness: () => 0.15 });
    return [new THREE.Mesh(tubes, m), new THREE.Mesh(base, makeShellMaterial(common, 4, { target: new THREE.Vector3(0, -4, -16) }))];
  },

  cornrows(common, seed = 3) {
    const rand = rng(seed);
    const center = new THREE.Vector3(0, 2.2, -5.0);
    const strands = [];
    const rows = 11;
    for (let k = 0; k < rows; k++) {
      const xk = (k / (rows - 1) - 0.5) * 2.5; // -1.25 .. 1.25
      const pts = [];
      const start = 0.32 + Math.abs(xk) * 0.12;
      for (let s = 0; s <= 40; s++) {
        const psi = lerp(Math.PI * start, Math.PI * 1.32, s / 40);
        const dir = new THREE.Vector3(xk * (0.9 - 0.15 * Math.sin(psi)), Math.sin(psi), Math.cos(psi)).normalize();
        // projection sur le crâne (marche vers l'extérieur)
        const p = center.clone().addScaledVector(dir, 3);
        collide(p, 0.42);
        pts.push(p);
      }
      // queue qui tombe sur la nuque
      const last = pts[pts.length - 1], prev = pts[pts.length - 3];
      const tail = growStrand(last, last.clone().sub(prev), { length: 22, segs: 18, gravity: 0.38, margin: 0.7, rand });
      strands.push({ pts: pts.concat(tail.slice(1)), radius: 0.62, rand: rand() });
    }
    const tubes = buildTubes(strands, { samples: 140, radial: 10, lobes: 3, lobeAmp: 0.3, twist: 2.2, flat: 1.0, taper: 0.5 });
    const m = makeStrandMaterial(common); m.uniforms.uShine.value = 60; m.uniforms.uLobeShade.value = 0.4; m.uniforms.uStriation.value = 18;
    const base = buildShell({ thickness: () => 0.06 });
    const sm = makeShellMaterial(common, 4, { target: new THREE.Vector3(0, -6, -16) });
    return [new THREE.Mesh(tubes, m), new THREE.Mesh(base, sm)];
  },

  afro(common) {
    // volume sphérique autour du crâne, qui se referme sur la ligne d'implantation
    const C = new THREE.Vector3(0, 4.6, -5.2);
    const geo = new THREE.SphereGeometry(1, 240, 170);
    const pos = geo.attributes.position;
    const mask = new Float32Array(pos.count);
    const u = new THREE.Vector3(), P = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      u.fromBufferAttribute(pos, i).normalize();
      // distance du centre à la surface de la tête dans cette direction
      let lo = 0, hi = 30;
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) / 2;
        P.copy(C).addScaledVector(u, mid);
        if (insideHead(P)) lo = mid; else hi = mid;
      }
      const d = lo;
      P.copy(C).addScaledVector(u, d);
      const pr = headProfile(P.y);
      const th = Math.atan2(P.x / pr.rx, (P.z - pr.c) / pr.rz);
      const frontness = smooth(0.2, 0.9, Math.cos(th));
      const hl = hairlineY(th, -0.3 - 2.6 * (1 - frontness));
      const m = smooth(hl - 0.3, hl + 0.6, P.y);
      const grow = Math.sqrt(smooth(hl - 0.6, hl + 5.5 + 1.5 * frontness, P.y));
      const n = vnoise(u.x * 3.2 + 10, u.y * 3.2, u.z * 3.2) * 0.6 + vnoise(u.x * 8, u.y * 8 + 5, u.z * 8) * 0.4;
      const R = 15.2 * (0.93 + 0.14 * n) * (1 + 0.06 * u.y);
      const r = d + 0.25 + Math.max(0, R - d) * grow;
      P.copy(C).addScaledVector(u, r);
      pos.setXYZ(i, P.x, P.y, P.z);
      mask[i] = m;
    }
    geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
    geo.computeVertexNormals();
    return [new THREE.Mesh(geo, makeShellMaterial(common, 3))];
  },

  waves(common) {
    const geo = buildShell({ thickness: (th, y, P, N, m) => 0.32 * m, feather: 0.5 });
    return [new THREE.Mesh(geo, makeShellMaterial(common, 2))];
  },

  // 360 waves + dégradé bas + contour net (line-up) aux coins carrés
  wavesFade(common) {
    const lineup = (th, y) => {
      const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) / Math.PI;
      let h;
      if (a < 0.255) h = 8.0 + 0.25 * smooth(0.0, 0.255, a);       // front droit
      else if (a < 0.46) h = 2.6;                                      // coin carré → patte
      else if (a < 0.56) h = lerp(2.6, 4.6, smooth(0.46, 0.5, a));     // contour d'oreille
      else h = lerp(4.6, -6.2, smooth(0.56, 0.95, a));                 // nuque
      // bord très net (tondeuse)
      return smooth(h - 0.08, h + 0.12, y);
    };
    const geo = buildShell({
      NT: 260, NY: 190, maskFn: lineup,
      thickness: (th, y, P, N, m) => m * lerp(0.04, 0.3, smooth(3.0, 7.5, y)),
    });
    return [new THREE.Mesh(geo, makeShellMaterial(common, 5, { fadeLo: 2.4, fadeHi: 6.6 }))];
  },

  fade(common) {
    const geo = buildShell({
      feather: 0.5,
      thickness: (th, y, P, N, m) => m * lerp(0.08, 1.35, smooth(4.5, 10.5, y)) * (1 - 0.25 * smooth(0.6, 1, Math.abs(Math.cos(th)) * (Math.cos(th) < 0 ? 1 : 0))),
    });
    return [new THREE.Mesh(geo, makeShellMaterial(common, 1, { fadeLo: 3.2, fadeHi: 8.6 }))];
  },

  buzz(common) {
    const geo = buildShell({ thickness: (th, y, P, N, m) => 0.12 * m, feather: 0.4 });
    return [new THREE.Mesh(geo, makeShellMaterial(common, 0, { density: 0.95 }))];
  },

  bun(common) {
    const top = surfacePoint(Math.PI, 11.4, new THREE.Vector3());
    const tn = surfaceNormal(Math.PI, 11.4, new THREE.Vector3());
    const bunC = top.clone().addScaledVector(tn, 2.4);
    const base = buildShell({ thickness: (th, y, P, N, m) => 0.38 * m, feather: 0.55 });
    const baseMesh = new THREE.Mesh(base, makeShellMaterial(common, 4, { target: bunC }));
    // chignon = tube torsadé enroulé en spirale
    const W = tn.clone(), U = new THREE.Vector3(1, 0, 0).cross(W).normalize(), V = W.clone().cross(U);
    const pts = [];
    const turns = 2.6;
    for (let s = 0; s <= 120; s++) {
      const t = s / 120;
      const a = t * Math.PI * 2 * turns;
      const rr = 3.4 * (1 - 0.62 * t);
      const h = Math.sin(t * Math.PI) * 1.6 + t * 1.4;
      pts.push(bunC.clone().addScaledVector(U, Math.cos(a) * rr).addScaledVector(V, Math.sin(a) * rr).addScaledVector(W, h));
    }
    const tube = buildTubes([{ pts, radius: 1.55, rand: 0.4 }], { samples: 240, radial: 18, lobes: 2, lobeAmp: 0.22, twist: 0.9, taper: 0.6, rootTaper: 0.4 });
    const m = makeStrandMaterial(common); m.uniforms.uShine.value = 90; m.uniforms.uStriation.value = 60; m.uniforms.uLobeShade.value = 0.25;
    return [baseMesh, new THREE.Mesh(tube, m)];
  },

  bob(common, seed = 21) {
    return straightHair(common, seed, { length: 28, spacing: 0.6, cut: -7.8 });
  },

  long(common, seed = 33) {
    return straightHair(common, seed, { length: 42, spacing: 0.66, cut: -999 });
  },
};

function straightHair(common, seed, { length, spacing, cut }) {
  const rand = rng(seed);
  const roots = scalpRoots({ spacing, rand, inset: 0.15, jitter: 0.8 });
  const strands = [];
  for (const r of roots) {
    // raie au milieu : la mèche part du côté de sa racine
    const side = Math.abs(r.p.x) < 0.25 ? (rand() < 0.5 ? -1 : 1) : Math.sign(r.p.x);
    const front = Math.max(0, r.n.z) * smooth(-2, 4, r.p.z);
    const d = new THREE.Vector3(side * (1.0 - front * 0.6), -0.55, -0.25 - front * 3.2);
    d.addScaledVector(r.n, -d.dot(r.n)).normalize().addScaledVector(r.n, 0.06).normalize();
    let pts = growStrand(r.p.clone().addScaledVector(r.n, 0.15), d, {
      length: length * (0.92 + rand() * 0.12), segs: 30, gravity: 0.09, margin: 0.45 + rand() * 0.7, rand, hug: 0.2,
    });
    if (cut > -100) {
      // coupe nette à hauteur de mâchoire, légèrement plongeante vers l'avant
      const cutY = cut + 1.5 * smooth(-12, 2, pts[0].z) + (rand() - 0.5) * 0.35;
      const out = [];
      for (const p of pts) { out.push(p); if (p.y < cutY) break; }
      pts = out.length > 3 ? out : pts.slice(0, 4);
    }
    strands.push({ pts, radius: 0.36, rand: rand() });
  }
  const g = buildTubes(strands, { samples: 24, radial: 6, flat: 1.5, taper: 0.55 });
  const m = makeStrandMaterial(common); m.uniforms.uShine.value = 70; m.uniforms.uStriation.value = 6; m.uniforms.uSpec.value = 0.6;
  const base = buildShell({ thickness: (th, y, P, N, mm) => 0.45 * mm, feather: 0.6 });
  return [new THREE.Mesh(g, m), new THREE.Mesh(base, makeShellMaterial(common, 4, { target: new THREE.Vector3(0, -20, -2) }))];
}

/** Construit une coiffure : renvoie { group, common } */
export function buildHairstyle(kind, color = '#14100e') {
  const common = {
    uColor: { value: new THREE.Color(color) },
    uTip: { value: new THREE.Color(color) },
    uGrow: { value: 1 },
  };
  const meshes = builders[kind](common);
  const group = new THREE.Group();
  meshes.forEach((m, i) => { m.renderOrder = 2 + i; m.frustumCulled = false; group.add(m); });
  return { group, common };
}
