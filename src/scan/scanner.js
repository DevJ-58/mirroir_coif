// Scan guidé par webcam (MediaPipe Face Landmarker, exécuté localement).
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FACE_TRIS } from '../three/head.js';

let landmarker = null;
let mode = 'VIDEO';

export async function loadLandmarker() {
  if (landmarker) return landmarker;
  const fileset = await FilesetResolver.forVisionTasks('/wasm');
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

function yawOf(res) {
  const m = res.facialTransformationMatrixes?.[0]?.data;
  if (!m) return 0;
  return (Math.atan2(m[8], m[10]) * 180) / Math.PI;
}

/** Capture : copie l'image source dans un canvas (taille max 2048). */
function grab(source, w, h) {
  const k = Math.min(1, 2048 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
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

/** Analyse une photo importée. */
export async function scanImage(img) {
  await loadLandmarker();
  await setMode('IMAGE');
  const res = landmarker.detect(img);
  await setMode('VIDEO');
  const lms = res.faceLandmarks?.[0];
  if (!lms) throw new Error('Aucun visage détecté sur la photo.');
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const canvas = grab(img, w, h);
  return { landmarks: lms, canvas, width: canvas.width, height: canvas.height };
}

const STEPS = [
  { id: 'front', title: 'Regardez droit devant', hint: 'Centrez votre visage dans le cercle et ne bougez plus.', test: (y) => Math.abs(y) < 9 },
  { id: 'sideA', title: 'Tournez doucement la tête', hint: 'Vers la gauche ou la droite, comme pour un profil.', test: (y) => Math.abs(y) > 20 },
  { id: 'sideB', title: 'Puis de l’autre côté', hint: 'Lentement, jusqu’au remplissage du cercle.', test: (y, ctx) => Math.abs(y) > 20 && Math.sign(y) !== ctx.sideSign },
  { id: 'back', title: 'Revenez face à l’écran', hint: 'Dernière mesure pour affiner les proportions.', test: (y) => Math.abs(y) < 9 },
];

/**
 * Lance le scan vidéo.
 * ui : { video, overlay, onStep(i, step), onProgress(p), onStatus(text), onFlash() }
 * Résout avec { landmarks, canvas, width, height }.
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
  let step = 0, hold = 0, last = performance.now();
  const ctx = { sideSign: 0 };
  let capture = null;
  ui.onStep(0, STEPS[0]);

  return new Promise((resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    const loop = () => {
      if (signal?.aborted) return;
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      let res = null;
      if (video.readyState >= 2) {
        try { res = landmarker.detectForVideo(video, now); } catch { res = null; }
      }
      const lms = res?.faceLandmarks?.[0];
      drawOverlay(octx, ov, video, lms, now);
      if (!lms) {
        hold = Math.max(0, hold - dt * 2);
        ui.onStatus('Aucun visage détecté — approchez-vous de l’écran');
      } else {
        const yaw = yawOf(res);
        const xs = lms.map((p) => p.x);
        const faceW = Math.max(...xs) - Math.min(...xs);
        const st = STEPS[step];
        if (faceW < 0.18) { ui.onStatus('Approchez-vous un peu'); hold = Math.max(0, hold - dt); }
        else if (st.test(yaw, ctx)) { hold += dt; ui.onStatus(''); }
        else { hold = Math.max(0, hold - dt * 1.5); ui.onStatus(''); }
        const need = step === 0 ? 1.1 : 0.8;
        ui.onProgress((step + Math.min(1, hold / need)) / STEPS.length);
        if (hold >= need) {
          if (step === 0) {
            capture = { landmarks: lms.map((p) => ({ ...p })), canvas: grab(video, video.videoWidth, video.videoHeight) };
            capture.width = capture.canvas.width; capture.height = capture.canvas.height;
            ui.onFlash();
          }
          if (step === 1) ctx.sideSign = Math.sign(yaw);
          hold = 0; step++;
          if (step >= STEPS.length) {
            ui.onProgress(1);
            setTimeout(() => { stop(); resolve(capture); }, 350);
            return;
          }
          ui.onStep(step, STEPS[step]);
        }
      }
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
  // maillage
  ctx.lineWidth = Math.max(0.6, S / 900);
  ctx.strokeStyle = 'rgba(240, 214, 170, 0.22)';
  ctx.beginPath();
  for (let t = 0; t < FACE_TRIS.length; t += 3) {
    const a = lms[FACE_TRIS[t]], b = lms[FACE_TRIS[t + 1]], c = lms[FACE_TRIS[t + 2]];
    ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.lineTo(X(c), Y(c));
  }
  ctx.stroke();
  // ligne de balayage
  let minY = 1e9, maxY = -1e9;
  for (const p of lms) { const y = Y(p); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const sy = minY + ((Math.sin(now / 520) + 1) / 2) * (maxY - minY);
  const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
  g.addColorStop(0, 'rgba(243,217,168,0)'); g.addColorStop(0.5, 'rgba(243,217,168,0.35)'); g.addColorStop(1, 'rgba(243,217,168,0)');
  ctx.fillStyle = g; ctx.fillRect(0, sy - 30, S, 60);
  // points
  ctx.fillStyle = 'rgba(255, 236, 200, 0.9)';
  const r = Math.max(0.9, S / 520);
  for (let i = 0; i < 468; i += 2) {
    const p = lms[i]; const y = Y(p);
    const near = Math.abs(y - sy) < 40 ? 1.9 : 1;
    ctx.beginPath(); ctx.arc(X(p), y, r * near, 0, 6.283); ctx.fill();
  }
}
