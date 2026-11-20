// Scan guidé par webcam (MediaPipe Face Landmarker, exécuté localement).
// Cinq prises : face, trois-quarts et profil de chaque côté.
import { FaceLandmarker, FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { FACE_TRIS, canonicalVerts } from '../three/head.js';
import { similarity, yawOf as poseYaw, pitchOf as posePitch } from './geometry.js';

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
function poseFromLandmarks(lms, W, H) {
  const O = new Float32Array(468 * 3);
  for (let i = 0; i < 468; i++) { O[i * 3] = lms[i].x * W; O[i * 3 + 1] = lms[i].y * H; O[i * 3 + 2] = lms[i].z * W; }
  return similarity(CANON, O);
}
function yawFromLandmarks(lms, W, H) { return poseYaw(poseFromLandmarks(lms, W, H)); }

// segmentation en direct (aperçu de la tête pendant le scan)
let liveSeg = null;
async function loadLiveSegmenter() {
  if (liveSeg) return liveSeg;
  const fileset = await getFileset();
  const opts = (delegate) => ({ baseOptions: { modelAssetPath: '/models/selfie_multiclass_256x256.tflite', delegate }, runningMode: 'VIDEO', outputCategoryMask: true, outputConfidenceMasks: false });
  try { liveSeg = await ImageSegmenter.createFromOptions(fileset, opts('GPU')); } catch { liveSeg = await ImageSegmenter.createFromOptions(fileset, opts('CPU')); }
  return liveSeg;
}

/** Capture : copie l'image source dans un canvas (taille max 1100). */
function grab(source, w, h) {
  const k = Math.min(1, 1100 / Math.max(w, h));
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
  { id: 'face', title: 'Regardez droit devant', hint: 'Toute votre tête dans le cercle, cheveux compris. Ne bougez plus.' },
  { id: 'right', title: 'Tournez lentement la tête', hint: 'D’un côté, jusqu’au profil. Le cercle se remplit à chaque angle capturé.' },
  { id: 'left', title: 'Puis lentement de l’autre côté', hint: 'Repassez par la face et continuez jusqu’à l’autre profil.' },
  { id: 'down', title: 'Baissez la tête', hint: 'Montrez le dessus de votre tête à la caméra.' },
  { id: 'up', title: 'Levez le menton', hint: 'Dernier angle : le dessous du visage et le cou.' },
];

// angles conservés : une vue tous les 6° de lacet, puis dessus et dessous
const YAW_BIN = 6, YAW_MAX = 72, MAX_SHOTS = 28;

/**
 * Balayage vidéo de toute la tête (~20 vues gardées).
 * ui : { video, overlay, onStep(i, step), onProgress(p), onStatus(text), onFlash(), onShot(i) }
 * Résout avec la liste des prises [{ landmarks, canvas, width, height, yaw, pitch }].
 */
export async function runVideoScan(ui, signal) {
  await loadLandmarker();
  const seg = await loadLiveSegmenter().catch(() => null);
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
  let step = 0, hold = 0, last = performance.now(), stepStart = performance.now(), side = 0, frame = 0;
  const shots = [], bins = new Set();
  let maskCanvas = null;
  ui.onStep(0, STEPS[0]);
  const keep = (lms, yaw, pitch) => {
    const canvas = grab(video, video.videoWidth, video.videoHeight);
    shots.push({ landmarks: lms.map((p) => ({ ...p })), canvas, width: canvas.width, height: canvas.height, yaw, pitch });
  };

  return new Promise((resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    const next = () => {
      hold = 0; step++; stepStart = performance.now();
      if (step >= STEPS.length || shots.length >= MAX_SHOTS) { ui.onProgress(1); setTimeout(() => { stop(); resolve(shots); }, 350); return true; }
      ui.onStep(step, STEPS[step]);
      return false;
    };
    const sweepProgress = (sg) => { let n = 0; for (let b = YAW_BIN; b <= YAW_MAX - 12; b += YAW_BIN) if (bins.has(sg * b)) n++; return n / Math.floor((YAW_MAX - 12) / YAW_BIN); };
    const loop = () => {
      if (signal?.aborted) return;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; frame++;
      let res = null;
      if (video.readyState >= 2) { try { res = landmarker.detectForVideo(video, now); } catch { res = null; } }
      // silhouette de la tête (cheveux + peau), mise à jour une image sur trois
      if (seg && video.readyState >= 2 && frame % 3 === 0) {
        try {
          const r = seg.segmentForVideo(video, now);
          const m = r.categoryMask; maskCanvas = maskToCanvas(m, maskCanvas); m.close();
        } catch { /* segmentation indisponible : on garde le maillage seul */ }
      }
      const lms = res?.faceLandmarks?.[0];
      drawOverlay(octx, ov, video, lms, now, maskCanvas);
      let progress = step / STEPS.length;
      if (!lms) {
        hold = Math.max(0, hold - dt * 2);
        ui.onStatus(step === 1 || step === 2 ? 'Visage perdu : revenez un peu vers l’écran' : 'Aucun visage détecté, approchez-vous');
      } else {
        const W = video.videoWidth, H = video.videoHeight;
        const pose = poseFromLandmarks(lms, W, H);
        const yaw = poseYaw(pose), pitch = posePitch(pose);
        const xs = lms.map((p) => p.x);
        const faceW = Math.max(...xs) - Math.min(...xs);
        ui.onStatus(faceW < 0.11 ? 'Approchez-vous un peu' : '');
        if (step === 0) {
          if (Math.abs(yaw) < 8 && Math.abs(pitch) < 12 && faceW >= 0.11) hold += dt; else hold = Math.max(0, hold - dt * 1.5);
          progress = Math.min(1, hold / 0.9) / STEPS.length;
          if (hold >= 0.9) { keep(lms, yaw, pitch); bins.add(0); ui.onFlash(); ui.onShot?.(0); if (next()) return; }
        } else if (step === 1 || step === 2) {
          const sg = step === 1 ? 0 : -side;
          const b = Math.round(yaw / YAW_BIN) * YAW_BIN;
          const ok = Math.abs(pitch) < 18 && Math.abs(b) >= YAW_BIN && Math.abs(b) <= YAW_MAX && (sg === 0 || Math.sign(b) === sg);
          if (ok && !bins.has(b) && Math.abs(yaw - b) < 2.5) {
            if (step === 1 && !side) side = Math.sign(b);
            if (step === 2 || Math.sign(b) === side) { bins.add(b); keep(lms, yaw, pitch); ui.onShot?.(step); }
          }
          const sweepSide = step === 1 ? (side || 1) : -side;
          const p = sweepProgress(sweepSide);
          progress = (step + p) / STEPS.length;
          if (p >= 0.99 || (now - stepStart > 14000 && p > 0.4)) { ui.onFlash(); if (next()) return; }
        } else {
          const want = step === 3 ? pitch < -16 : pitch > 14;
          if (want && Math.abs(yaw) < 20) hold += dt; else hold = Math.max(0, hold - dt);
          progress = (step + Math.min(1, hold / 0.5)) / STEPS.length;
          if (hold >= 0.5) { keep(lms, yaw, pitch); ui.onFlash(); ui.onShot?.(step); if (next()) return; }
          if (now - stepStart > 9000) { ui.onStatus('Angle passé'); if (next()) return; }
        }
      }
      ui.onProgress(progress);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

/** Masque de segmentation → petit canvas teinté (cheveux dorés, peau légère). */
function maskToCanvas(m, cv) {
  const w = m.width, h = m.height, data = m.getAsUint8Array();
  if (!cv || cv.width !== w || cv.height !== h) { cv = document.createElement('canvas'); cv.width = w; cv.height = h; }
  const g = cv.getContext('2d'), img = g.createImageData(w, h);
  for (let i = 0; i < data.length; i++) {
    const c = data[i], k = i * 4;
    if (c === 1) { img.data[k] = 233; img.data[k + 1] = 207; img.data[k + 2] = 159; img.data[k + 3] = 110; }
    else if (c === 3 || c === 2) { img.data[k] = 244; img.data[k + 1] = 237; img.data[k + 2] = 227; img.data[k + 3] = 34; }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function drawOverlay(ctx, cv, video, lms, now, mask = null) {
  const S = cv.width;
  ctx.clearRect(0, 0, S, S);
  if (!video.videoWidth) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  const sc = Math.max(S / vw, S / vh), dx = (S - vw * sc) / 2, dy = (S - vh * sc) / 2;
  // tête et cheveux détectés (image miroir, comme la vidéo)
  if (mask) { ctx.save(); ctx.translate(S, 0); ctx.scale(-1, 1); ctx.imageSmoothingEnabled = true; ctx.drawImage(mask, dx, dy, vw * sc, vh * sc); ctx.restore(); }
  if (!lms) return;
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
