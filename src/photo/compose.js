// Essayage en photo : le visage du client est posé dans la photo d'un mannequin coiffé.
// Chaque vue (face, trois-quarts…) porte l'ovale du visage du mannequin, placé par l'artiste.
// Le corps du mannequin prend le teint du client ; les cheveux de la photo restent devant le visage.

// contour du visage (MediaPipe)
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const lumOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// détourage de la personne (modèle MediaPipe de 250 Ko, sur l'appareil)
let segP = null;
async function segmenter() {
  if (!segP) segP = (async () => {
    const { ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const { getFileset } = await import('../scan/scanner.js');
    const fileset = await getFileset();
    const opts = (delegate) => ({ baseOptions: { modelAssetPath: '/models/selfie_segmenter.tflite', delegate }, runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true });
    try { return await ImageSegmenter.createFromOptions(fileset, opts('GPU')); } catch { return ImageSegmenter.createFromOptions(fileset, opts('CPU')); }
  })();
  return segP;
}
/** Probabilité « personne » par pixel, à la taille w × h. */
export async function personMask(canvas) {
  const seg = await segmenter();
  const r = seg.segment(canvas);
  const m = r.confidenceMasks[0];
  const mw = m.width, mh = m.height, src = m.getAsFloat32Array();
  const w = canvas.width, h = canvas.height, out = new Float32Array(w * h);
  // interpolation bilinéaire : bords lisses malgré la petite taille du masque
  for (let y = 0; y < h; y++) {
    const fy = Math.min(mh - 1.001, Math.max(0, (y + 0.5) / h * mh - 0.5)), y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(mw - 1.001, Math.max(0, (x + 0.5) / w * mw - 0.5)), x0 = Math.floor(fx), tx = fx - x0;
      const i = y0 * mw + x0;
      out[y * w + x] = (src[i] * (1 - tx) + src[i + 1] * tx) * (1 - ty) + (src[i + mw] * (1 - tx) + src[i + mw + 1] * tx) * ty;
    }
  }
  r.close?.();
  return out;
}

/** prepareView avec détourage automatique de la personne (recommandé). */
export async function analyseView(img, opts = {}) {
  const k = Math.min(1, 1400 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round((img.naturalWidth || img.width) * k); cv.height = Math.round((img.naturalHeight || img.height) * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  let person = null;
  try { person = await personMask(cv); } catch (e) { console.warn('détourage indisponible', e); }
  return prepareView(img, { ...opts, person });
}

/** Charge une image (Blob, ArrayBuffer ou URL). */
export async function loadImage(src, type = 'image/jpeg') {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src instanceof Blob ? src : new Blob([src], { type }));
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

/**
 * Analyse une photo de mannequin : fond (remplissage depuis les bords), cheveux (sombres), peau (le reste).
 * opts : { hair (0→1 : seuil de luminance des cheveux, auto si absent), bg (tolérance du fond) }
 */
export function prepareView(img, opts = {}) {
  const k = Math.min(1, 1400 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.round((img.naturalWidth || img.width) * k), h = Math.round((img.naturalHeight || img.height) * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data;
  const N = w * h;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = lumOf(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) / 255;

  // fond : couleur médiane des bords, puis remplissage tant que la couleur reste proche
  const border = [];
  for (let x = 0; x < w; x += 4) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y += 4) border.push(y * w, y * w + w - 1);
  const med = (arr) => { const a = Float32Array.from(arr).sort(); return a[a.length >> 1]; };
  const br = med(border.map((i) => px[i * 4])), bgc = med(border.map((i) => px[i * 4 + 1])), bb = med(border.map((i) => px[i * 4 + 2]));
  const tol = (opts.bg ?? 14) ** 2 * 3;
  const bg = new Uint8Array(N);
  const stack = [];
  for (const i of border) {
    const d = (px[i * 4] - br) ** 2 + (px[i * 4 + 1] - bgc) ** 2 + (px[i * 4 + 2] - bb) ** 2;
    if (d < tol) { bg[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0 || bg[j]) continue;
      // tolérance un peu plus large entre voisins (dégradés doux du fond)
      const d = (px[j * 4] - br) ** 2 + (px[j * 4 + 1] - bgc) ** 2 + (px[j * 4 + 2] - bb) ** 2;
      // et sans franchir de contour : le fond varie doucement, le bord du mannequin marque un saut
      if (d < tol * 2.2 && Math.abs(L[j] - L[i]) < (opts.edge ?? 0.018)) { bg[j] = 1; stack.push(j); }
    }
  }

  // détourage disponible : il remplace le remplissage depuis les bords
  // (au bord incertain du détourage, un pixel de la couleur du fond reste du fond)
  if (opts.person) for (let i = 0; i < N; i++) {
    const p = opts.person[i];
    const d = (px[i * 4] - br) ** 2 + (px[i * 4 + 1] - bgc) ** 2 + (px[i * 4 + 2] - bb) ** 2;
    bg[i] = p < 0.5 || (p < 0.92 && d < tol) ? 1 : 0;
  }

  // cheveux : seuil d'Otsu sur la luminance du mannequin (hors fond)
  let thr = opts.hair;
  if (thr == null) {
    const hist = new Float64Array(64); let tot = 0;
    for (let i = 0; i < N; i++) if (!bg[i]) { hist[Math.min(63, (L[i] * 64) | 0)]++; tot++; }
    let sum = 0; for (let t = 0; t < 64; t++) sum += t * hist[t];
    let sB = 0, wB = 0, best = 0; thr = 0.35;
    for (let t = 0; t < 64; t++) {
      wB += hist[t]; if (!wB) continue;
      const wF = tot - wB; if (!wF) break;
      sB += t * hist[t];
      const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2;
      if (v > best) { best = v; thr = (t + 0.5) / 64; }
    }
    thr = Math.min(0.55, Math.max(0.12, thr));
  }
  const hair = new Float32Array(N), skin = new Float32Array(N);
  const soft = 0.06;
  for (let i = 0; i < N; i++) {
    if (bg[i]) continue;
    const a = Math.min(1, Math.max(0, (thr + soft - L[i]) / (2 * soft)));
    hair[i] = a; skin[i] = 1 - a;
  }
  blur(hair, w, h, 1); blur(skin, w, h, 1);
  // opacité du détourage : le mannequin flotte sur le fond de la page
  const alpha = new Float32Array(N);
  for (let i = 0; i < N; i++) alpha[i] = bg[i] ? 0 : opts.person ? Math.min(1, Math.max(0, (opts.person[i] - 0.3) / 0.45)) : 1;
  blur(alpha, w, h, 2);
  // luminance de référence de la peau du mannequin (médiane), pour la teinte
  const ls = []; for (let i = 0; i < N; i += 7) if (skin[i] > 0.9) ls.push(L[i]);
  const skinRef = ls.length ? med(ls) : 0.85;
  return { w, h, base: g.getImageData(0, 0, w, h), L, bg, hair, skin, alpha, skinRef, hairThr: thr, scale: k };
}

function blur(a, w, h, r) {
  const t = new Float32Array(a.length);
  for (let pass = 0; pass < r; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let s = a[i] * 2, n = 2;
      if (x > 0) { s += a[i - 1]; n++; } if (x < w - 1) { s += a[i + 1]; n++; }
      t[i] = s / n;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let s = t[i] * 2, n = 2;
      if (y > 0) { s += t[i - w]; n++; } if (y < h - 1) { s += t[i + w]; n++; }
      a[i] = s / n;
    }
  }
}

/** Ellipse du visage du client (centre, demi-axes, angle) à partir du contour MediaPipe. */
export function faceEllipse(shot) {
  const W = shot.width, H = shot.height, P = OVAL.map((i) => [shot.landmarks[i].x * W, shot.landmarks[i].y * H]);
  let cx = 0, cy = 0; P.forEach((p) => { cx += p[0]; cy += p[1]; }); cx /= P.length; cy /= P.length;
  // inclinaison de la tête : la ligne des coins externes des yeux
  const le = shot.landmarks[33], re = shot.landmarks[263];
  const a = Math.atan2((re.y - le.y) * H, (re.x - le.x) * W);
  const ux = Math.cos(a), uy = Math.sin(a);
  let ry = 0, rx = 0;
  P.forEach(([x, y]) => { const dx = x - cx, dy = y - cy; rx = Math.max(rx, Math.abs(dx * ux + dy * uy)); ry = Math.max(ry, Math.abs(-dx * uy + dy * ux)); });
  return { cx, cy, rx, ry, a };
}

/** Prise du client la plus adaptée à une vue : face, ou trois-quarts tourné du bon côté. */
export function pickShot(shots, view) {
  if (!shots?.length) return null;
  const side = (s) => {
    const W = s.width, L = s.landmarks;
    const mx = OVAL.reduce((m, i) => m + L[i].x, 0) / OVAL.length;
    return (L[1].x - mx) * W / Math.max(1, (L[454].x - L[234].x) * W);   // < 0 : regard vers la gauche de l'image
  };
  const scored = shots.map((s) => ({ s, v: side(s) }));
  if (view === 'face') return { shot: scored.sort((p, q) => Math.abs(p.v) - Math.abs(q.v))[0].s, flip: false };
  const want = view === 'q-left' ? -1 : 1;
  const turned = scored.filter((x) => Math.abs(x.v) > 0.06).sort((p, q) => Math.abs(q.v) - Math.abs(p.v));
  const same = turned.find((x) => Math.sign(x.v) === want);
  if (same) return { shot: same.s, flip: false };
  if (turned.length) return { shot: turned[0].s, flip: true };   // l'autre côté, en miroir
  return null;
}

/**
 * Assemble l'essayage. view : sortie de prepareView + { face: {cx,cy,rx,ry,a} en pixels de la photo, kind }.
 * client : { shots, skin: THREE.Color|{r,g,b} } ou null (mannequin seul).
 * opts : { hair: '#rrggbb' | null (teinte des cheveux), tip }
 */
export function compose(view, client, opts = {}, out = document.createElement('canvas')) {
  const { w, h } = view;
  out.width = w; out.height = h;
  const g = out.getContext('2d');
  const img = new ImageData(new Uint8ClampedArray(view.base.data), w, h);
  const d = img.data;
  // teinte du corps du mannequin : la couleur du client, modulée par l'ombrage de la photo
  if (client?.skin) {
    const sk = toRGB(client.skin);
    for (let i = 0; i < w * h; i++) {
      const a = view.skin[i]; if (a < 0.02) continue;
      const shade = Math.min(1.25, view.L[i] / view.skinRef);
      const o = i * 4;
      d[o] += (sk[0] * shade - d[o]) * a; d[o + 1] += (sk[1] * shade - d[o + 1]) * a; d[o + 2] += (sk[2] * shade - d[o + 2]) * a;
    }
  }
  // teinte des cheveux
  if (opts.hair) {
    const c = toRGB(opts.hair), t = toRGB(opts.tip || opts.hair);
    for (let i = 0; i < w * h; i++) {
      const a = view.hair[i]; if (a < 0.02) continue;
      const o = i * 4, lum = view.L[i], m = 0.5 + 2.6 * lum;
      // les zones claires (dégradé, cuir chevelu visible) se teintent moins que la masse des cheveux
      const thr = view.hairThr, wk = a * Math.min(1, Math.max(0, (thr - lum) / (thr * 0.6)));
      for (let k = 0; k < 3; k++) d[o + k] += ((c[k] * 0.65 + t[k] * 0.35) * m - d[o + k]) * wk;
    }
  }
  // détourage (opts.cutout) : le fond de la photo devient transparent
  if (opts.cutout && view.alpha) {
    const f0 = h * 0.8;   // le bas du buste s'efface doucement
    for (let i = 0; i < w * h; i++) {
      const y = (i / w) | 0, fade = y > f0 ? Math.max(0, 1 - (y - f0) / (h - f0)) : 1;
      d[i * 4 + 3] = Math.round(255 * view.alpha[i] * fade * fade * (3 - 2 * fade));
    }
  }
  g.putImageData(img, 0, 0);

  // visage du client, posé dans l'ovale du mannequin
  const pick = client && view.face && view.kind !== 'back' ? pickShot(client.shots, view.kind) : null;
  if (pick) {
    const src = pick.shot, E = faceEllipse(src), A = view.face;
    const fc = document.createElement('canvas'); fc.width = w; fc.height = h;
    const fg = fc.getContext('2d');
    fg.save();
    // repère : ovale du client → ovale du mannequin
    fg.translate(A.cx, A.cy); fg.rotate(A.a); fg.scale(A.rx / E.rx, A.ry / E.ry);
    if (pick.flip) fg.scale(-1, 1);
    fg.rotate(-E.a); fg.translate(-E.cx, -E.cy);
    fg.drawImage(src.canvas, 0, 0);
    fg.restore();
    // masque adouci : plein au centre, fondu sur le bord de l'ovale
    fg.globalCompositeOperation = 'destination-in';
    fg.save();
    fg.translate(A.cx, A.cy); fg.rotate(A.a); fg.scale(A.rx, A.ry);
    const grad = fg.createRadialGradient(0, 0, 0.72, 0, 0, 1.0);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    fg.fillStyle = grad;
    fg.beginPath(); fg.arc(0, 0, 1.02, 0, Math.PI * 2); fg.fill();
    fg.restore();
    g.drawImage(fc, 0, 0);
    // les cheveux de la photo repassent devant le visage (frange, contour)
    const hc = document.createElement('canvas'); hc.width = w; hc.height = h;
    const hg = hc.getContext('2d');
    const top = new ImageData(new Uint8ClampedArray(img.data), w, h);
    for (let i = 0; i < w * h; i++) top.data[i * 4 + 3] = Math.round(Math.min(1, view.hair[i] * 1.15) * (opts.cutout ? img.data[i * 4 + 3] : 255));
    hg.putImageData(top, 0, 0);
    g.drawImage(hc, 0, 0);
  }
  return out;
}

function toRGB(c) {
  if (typeof c === 'string') { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  // THREE.Color en linéaire → sRGB 0–255
  const s = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  return [s(c.r), s(c.g), s(c.b)];
}
