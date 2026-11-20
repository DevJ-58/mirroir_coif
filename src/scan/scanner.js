// Scan guidé par webcam (MediaPipe Face Landmarker, exécuté localement).
// Cinq prises : face, trois-quarts et profil de chaque côté.
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
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


/** Capture : copie l'image source dans un canvas (taille max réglable). */
function grab(source, w, h, max = 1600) {
  const k = Math.min(1, max / Math.max(w, h));
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
      const canvas = grab(img, w, h, 2048);
      out.push({ landmarks: lms, canvas, width: canvas.width, height: canvas.height, yaw: yawFromLandmarks(lms, canvas.width, canvas.height) });
    }
  } finally { await setMode('VIDEO'); }
  if (!out.length) throw new Error('Aucun visage détecté sur les photos.');
  return out.sort((p, q) => Math.abs(p.yaw) - Math.abs(q.yaw));
}

export const STEPS = [
  { id: 'face', title: 'Regardez droit devant', hint: 'Votre visage dans le cercle, bien éclairé. Ne bougez plus.' },
  { id: 'side1', title: 'Tournez un peu la tête', hint: 'Un quart de tour d’un côté, doucement.' },
  { id: 'side2', title: 'Puis de l’autre côté', hint: 'Repassez par la face et tournez un peu de l’autre côté.' },
];

/**
 * Scan du visage : une prise de face (la photo posée sur le mannequin) et deux trois-quarts
 * qui affinent le relief (nez, pommettes, menton).
 * ui : { video, overlay, onStep(i, step), onProgress(p), onStatus(text), onFlash(), onShot(i) }
 * Résout avec la liste des prises [{ landmarks, canvas, width, height, yaw }].
 */
export async function runVideoScan(ui, signal) {
  await loadLandmarker();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
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
  const keep = (lms, yaw, max) => {
    const canvas = grab(video, video.videoWidth, video.videoHeight, max);
    shots.push({ landmarks: lms.map((p) => ({ ...p })), canvas, width: canvas.width, height: canvas.height, yaw });
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
      let progress = step / STEPS.length;
      if (!lms) {
        hold = Math.max(0, hold - dt * 2);
        ui.onStatus('Aucun visage détecté, approchez-vous');
      } else {
        const W = video.videoWidth, H = video.videoHeight;
        const pose = poseFromLandmarks(lms, W, H);
        const yaw = poseYaw(pose), pitch = posePitch(pose);
        const xs = lms.map((p) => p.x);
        const faceW = Math.max(...xs) - Math.min(...xs);
        ui.onStatus(faceW < 0.14 ? 'Approchez-vous un peu' : Math.abs(pitch) > 14 ? 'Gardez la tête droite' : '');
        if (step === 0) {
          // la photo de face doit être nette : visage droit, assez grand, immobile
          if (Math.abs(yaw) < 7 && Math.abs(pitch) < 10 && faceW >= 0.14) hold += dt; else hold = Math.max(0, hold - dt * 1.5);
          progress = Math.min(1, hold / 1.0) / STEPS.length;
          if (hold >= 1.0) { keep(lms, yaw, 2048); ui.onFlash(); ui.onShot?.(0); if (next()) return; }
        } else {
          const ok = Math.abs(pitch) < 16 && Math.abs(yaw) >= 18 && Math.abs(yaw) <= 40 && (step === 1 ? true : Math.sign(yaw) === -side);
          if (ok) hold += dt; else hold = Math.max(0, hold - dt);
          progress = (step + Math.min(1, hold / 0.35)) / STEPS.length;
          if (hold >= 0.35) {
            if (step === 1) side = Math.sign(yaw);
            keep(lms, yaw, 1280); ui.onFlash(); ui.onShot?.(step);
            if (next()) return;
          } else if (now - stepStart > 9000) { ui.onStatus('Angle passé'); if (next()) return; }
        }
      }
      ui.onProgress(progress);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
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
