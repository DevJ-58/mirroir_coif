// Scan guidé par webcam (MediaPipe Face Landmarker, exécuté localement).
// Cinq prises : face, trois-quarts et profil de chaque côté.
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FACE_TRIS, canonicalVerts } from '../three/head.js';
import { similarity, yawOf as poseYaw } from './geometry.js';

let landmarker = null, filesetP = null;
let mode = 'VIDEO';

export function getFileset() {
  if (!filesetP) filesetP = FilesetResolver.forVisionTasks('/wasm');
  return filesetP;
}

export async function loadLandmarker() {
  if (landmarker) return landmarker;
  const fileset = await getFileset();
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
    runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true,
  });
  try { landmarker = await FaceLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { landmarker = await FaceLandmarker.createFromOptions(fileset, opts('CPU')); }
  mode = 'VIDEO';
  return landmarker;
}

async function setMode(m) {
  if (mode !== m) { await landmarker.setOptions({ runningMode: m }); mode = m; }
}

// lacet calculé comme pendant la reconstruction (même repère, même signe)
const CANON = canonicalVerts().slice(0, 468 * 3);
function yawFromLandmarks(lms, W, H) {
  const O = new Float32Array(468 * 3);
  for (let i = 0; i < 468; i++) { O[i * 3] = lms[i].x * W; O[i * 3 + 1] = lms[i].y * H; O[i * 3 + 2] = lms[i].z * W; }
  return poseYaw(similarity(CANON, O));
}

/** Capture : copie l'image source dans un canvas (taille max 1600). */
function grab(source, w, h) {
  const k = Math.min(1, 1600 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, c.width, c.height);
  return c;
}

/** Couleur de peau moyenne échantillonnée sur les joues et le front. */
export function sampleSkin(canvas, lms) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pts = [50, 280, 101, 330, 151, 205, 425];
  let r = 0, g = 0, b = 0, n = 0;
  const rad = Math.max(3, Math.round(canvas.width * 0.006));
  for (const i of pts) {
    const x = Math.round(lms[i].x * canvas.width), y = Math.round(lms[i].y * canvas.height);
    const d = ctx.getImageData(Math.max(0, x - rad), Math.max(0, y - rad), rad * 2, rad * 2).data;
    for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
  }
  return [r / n / 255, g / n / 255, b / n / 255];
}

/** Analyse une ou plusieurs photos importées (face, trois-quarts, profils). */
export async function scanImages(imgs) {
  await loadLandmarker();
  await setMode('IMAGE');
  const out = [];
  try {
    for (const img of imgs) {
      const res = landmarker.detect(img);
      const lms = res.faceLandmarks?.[0];
      if (!lms) continue;
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const canvas = grab(img, w, h);
      out.push({ landmarks: lms, canvas, width: canvas.width, height: canvas.height, yaw: yawFromLandmarks(lms, canvas.width, canvas.height) });
    }
  } finally { await setMode('VIDEO'); }
  if (!out.length) throw new Error('Aucun visage détecté sur les photos.');
  return out;
}

export const STEPS = [
  { id: 'face', title: 'Regardez droit devant', hint: 'Centrez votre visage dans le cercle et ne bougez plus.' },
  { id: 'q1', title: 'Tournez doucement la tête', hint: 'Vers la gauche ou la droite, de trois quarts.' },
  { id: 'p1', title: 'Continuez jusqu’au profil', hint: 'Lentement, jusqu’à présenter votre oreille.' },
  { id: 'q2', title: 'De l’autre côté', hint: 'Revenez, puis tournez de trois quarts dans l’autre sens.' },
  { id: 'p2', title: 'Jusqu’au profil', hint: 'Dernière prise : présentez l’autre oreille.' },
];

/**
 * Lance le scan vidéo en cinq prises.
 * ui : { video, overlay, onStep(i, step), onProgress(p), onStatus(text), onFlash(), onShot(i, canvas) }
 * Résout avec la liste des prises [{ landmarks, canvas, width, height, yaw }].
 */
export async function runVideoScan(ui, signal) {
  await loadLandmarker();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false,
  });
  const video = ui.video;
  video.srcObject = stream;
  video.muted = true; video.playsInline = true;
  await video.play();
  const stop = () => stream.getTracks().forEach((t) => t.stop());
  signal?.addEventListener('abort', stop);

  const ov = ui.overlay, octx = ov.getContext('2d');
  let step = 0, hold = 0, last = performance.now(), stepStart = performance.now(), side = 0;
  const shots = [];
  ui.onStep(0, STEPS[0]);

  // condition d'angle de chaque prise (lacet en degrés)
  const ok = (i, yaw) => {
    const a = Math.abs(yaw), sg = Math.sign(yaw);
    if (i === 0) return a < 8;
    if (i === 1) return a > 22 && a < 42;
    if (i === 2) return a > 46 && sg === side;
    if (i === 3) return a > 22 && a < 42 && sg === -side;
    return a > 46 && sg === -side;
  };

  return new Promise((resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    const next = () => {
      hold = 0; step++; stepStart = performance.now();
      if (step >= STEPS.length) { ui.onProgress(1); setTimeout(() => { stop(); resolve(shots); }, 350); return true; }
      ui.onStep(step, STEPS[step]);
      return false;
    };
    const loop = () => {
      if (signal?.aborted) return;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      let res = null;
      if (video.readyState >= 2) { try { res = landmarker.detectForVideo(video, now); } catch { res = null; } }
      const lms = res?.faceLandmarks?.[0];
      drawOverlay(octx, ov, video, lms, now);
      if (!lms) {
        hold = Math.max(0, hold - dt * 2);
        ui.onStatus(step === 2 || step === 4 ? 'Visage perdu : revenez un peu vers l’écran' : 'Aucun visage détecté, approchez-vous');
      } else {
        const yaw = yawFromLandmarks(lms, video.videoWidth, video.videoHeight);
        const xs = lms.map((p) => p.x);
        const faceW = Math.max(...xs) - Math.min(...xs);
        if (faceW < 0.12) { ui.onStatus('Approchez-vous un peu'); hold = Math.max(0, hold - dt); }
        else if (ok(step, yaw)) { hold += dt; ui.onStatus(''); }
        else { hold = Math.max(0, hold - dt * 1.5); ui.onStatus(''); }
        const need = step === 0 ? 1.0 : 0.5;
        ui.onProgress((step + Math.min(1, hold / need)) / STEPS.length);
        if (hold >= need) {
          if (step === 1) side = Math.sign(yaw);
          const canvas = grab(video, video.videoWidth, video.videoHeight);
          shots.push({ landmarks: lms.map((p) => ({ ...p })), canvas, width: canvas.width, height: canvas.height, yaw });
          ui.onFlash(); ui.onShot?.(step, canvas);
          if (next()) return;
        }
      }
      // un profil trop difficile à détecter ne bloque pas le scan
      if ((step === 2 || step === 4) && now - stepStart > 9000) { ui.onStatus('Prise de profil passée'); if (next()) return; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

function drawOverlay(ctx, cv, video, lms, now) {
  const S = cv.width;
  ctx.clearRect(0, 0, S, S);
  if (!lms || !video.videoWidth) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  const sc = Math.max(S / vw, S / vh), dx = (S - vw * sc) / 2, dy = (S - vh * sc) / 2;
  const X = (p) => S - (p.x * vw * sc + dx), Y = (p) => p.y * vh * sc + dy;
  ctx.lineWidth = Math.max(0.6, S / 900);
  ctx.strokeStyle = 'rgba(240, 214, 170, 0.22)';
  ctx.beginPath();
  for (let t = 0; t < FACE_TRIS.length; t += 3) {
    const a = lms[FACE_TRIS[t]], b = lms[FACE_TRIS[t + 1]], c = lms[FACE_TRIS[t + 2]];
    ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.lineTo(X(c), Y(c));
  }
  ctx.stroke();
  let minY = 1e9, maxY = -1e9;
  for (const p of lms) { const y = Y(p); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const sy = minY + ((Math.sin(now / 520) + 1) / 2) * (maxY - minY);
  const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
  g.addColorStop(0, 'rgba(243,217,168,0)'); g.addColorStop(0.5, 'rgba(243,217,168,0.35)'); g.addColorStop(1, 'rgba(243,217,168,0)');
  ctx.fillStyle = g; ctx.fillRect(0, sy - 30, S, 60);
  ctx.fillStyle = 'rgba(255, 236, 200, 0.9)';
  const r = Math.max(0.9, S / 520);
  for (let i = 0; i < 468; i += 2) {
    const p = lms[i]; const y = Y(p);
    const near = Math.abs(y - sy) < 40 ? 1.9 : 1;
    ctx.beginPath(); ctx.arc(X(p), y, r * near, 0, 6.283); ctx.fill();
  }
}
