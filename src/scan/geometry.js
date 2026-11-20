// Outils géométriques du scan multi-vues (sans dépendance, testables seuls).

/** Valeurs/vecteurs propres d'une matrice symétrique n×n (méthode de Jacobi). */
export function jacobiEigen(A, n) {
  const a = A.map((r) => r.slice());
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-20) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: a.map((r, i) => r[i]), vectors: v };
}

/**
 * Similitude qui envoie les points A sur les points B : B ≈ s·R·A + t (méthode de Horn, quaternions).
 * A, B : tableaux plats [x,y,z, x,y,z…] ; w : poids optionnels par point.
 * Renvoie { s, R (3×3 lignes), t [3] }.
 */
export function similarity(A, B, w = null) {
  const n = A.length / 3;
  let W = 0; const ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = 0; i < n; i++) { const wi = w ? w[i] : 1; W += wi; for (let k = 0; k < 3; k++) { ca[k] += wi * A[i * 3 + k]; cb[k] += wi * B[i * 3 + k]; } }
  for (let k = 0; k < 3; k++) { ca[k] /= W; cb[k] /= W; }
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const wi = w ? w[i] : 1;
    const a = [A[i * 3] - ca[0], A[i * 3 + 1] - ca[1], A[i * 3 + 2] - ca[2]];
    const b = [B[i * 3] - cb[0], B[i * 3 + 1] - cb[1], B[i * 3 + 2] - cb[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += wi * a[r] * b[c];
    va += wi * (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    vb += wi * (b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
  }
  const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = S;
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const { values, vectors } = jacobiEigen(N, 4);
  let best = 0; for (let i = 1; i < 4; i++) if (values[i] > values[best]) best = i;
  const [q0, qx, qy, qz] = [0, 1, 2, 3].map((k) => vectors[k][best]);
  const R = [
    [q0 * q0 + qx * qx - qy * qy - qz * qz, 2 * (qx * qy - q0 * qz), 2 * (qx * qz + q0 * qy)],
    [2 * (qy * qx + q0 * qz), q0 * q0 - qx * qx + qy * qy - qz * qz, 2 * (qy * qz - q0 * qx)],
    [2 * (qz * qx - q0 * qy), 2 * (qz * qy + q0 * qx), q0 * q0 - qx * qx - qy * qy + qz * qz],
  ];
  const s = Math.sqrt(vb / va);
  const Rca = mulV(R, ca);
  const t = [cb[0] - s * Rca[0], cb[1] - s * Rca[1], cb[2] - s * Rca[2]];
  return { s, R, t };
}

export const mulV = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
export const mulTV = (R, v) => [R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2], R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2], R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2]];

/** Pose d'une vue → fonctions de projection (repère tête en cm → pixels de la photo). */
export function makeView(pose) {
  const { s, R, t } = pose;
  return {
    pose,
    /** point tête → [u, v, profondeur] (profondeur croissante = plus loin de la caméra) */
    project(p) { const q = mulV(R, p); return [s * q[0] + t[0], s * q[1] + t[1], s * q[2] + t[2]]; },
    /** normale tête → composante vers la caméra (1 = face à l'objectif) */
    facing(n) { return -mulV(R, n)[2]; },
    /** point photo (repère image 3D) → repère tête */
    unproject(o) { return mulTV(R, [(o[0] - t[0]) / s, (o[1] - t[1]) / s, (o[2] - t[2]) / s]); },
  };
}

/** Angle de lacet (degrés) d'une vue : positif quand la tête tourne vers la droite de l'image. */
export function yawOf(pose) {
  // la direction « avant » du visage (+z du modèle) exprimée dans le repère caméra
  const f = mulV(pose.R, [0, 0, 1]);
  return (Math.atan2(f[0], -f[2]) * 180) / Math.PI;
}
