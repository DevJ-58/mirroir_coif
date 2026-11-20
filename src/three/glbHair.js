// Coiffures déposées en fichier 3D (.glb), modélisées sur le mannequin GARO.
// Conventions du kit artiste : même repère que le mannequin, unités en mètres ou en centimètres
// (détectées), seule la coiffure est exportée (les objets « GARO_mannequin » sont ignorés).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const templates = new Map();   // id de style → groupe modèle (cm, repère du mannequin)
const loader = new GLTFLoader();

/** Charge un .glb (ArrayBuffer) et l'enregistre sous cet id. Renvoie des infos de contrôle. */
export async function registerGlb(id, buffer) {
  const gltf = await new Promise((res, rej) => loader.parse(buffer, '', res, rej));
  const root = gltf.scene;
  // le mannequin de référence, s'il a été exporté avec la coiffure, est retiré
  const drop = [];
  root.traverse((o) => { if (/^GARO_mannequin/i.test(o.name)) drop.push(o); });
  drop.forEach((o) => o.parent?.remove(o));
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error('Le fichier ne contient aucune forme 3D.');
  const size = box.getSize(new THREE.Vector3());
  // exporté en mètres (Blender, par défaut) : le mannequin fait ~0,3 m de haut pour la tête
  const scale = Math.max(size.x, size.y, size.z) < 3 ? 100 : 1;
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  group.add(root);
  let meshes = 0, tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    o.frustumCulled = false;
    o.castShadow = false;
  });
  // l'animation d'apparition agit sur le groupe extérieur ; la conversion d'unités reste dessous
  const holder = new THREE.Group();
  holder.add(group);
  templates.set(id, holder);
  return { meshes, tris: Math.round(tris), size: size.multiplyScalar(scale).toArray().map((v) => +v.toFixed(1)), scale };
}

export function hasGlb(id) { return templates.has(id); }
export function forgetGlb(id) { templates.delete(id); }

/**
 * Instance d'une coiffure déposée, avec les mêmes réglages que les coiffures générées :
 * uColor / uTip (teinte), uGrow (apparition), uTint (0 = couleurs d'origine du fichier).
 */
export function buildGlbHair(id, common) {
  const tpl = templates.get(id);
  if (!tpl) throw new Error(`Coiffure 3D absente : ${id}`);
  const group = tpl.clone(true);
  common.uTint = common.uTint || { value: 0 };
  group.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material : [o.material];
    const mats = src.map((m) => {
      const mat = m.clone();
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uColor = common.uColor; sh.uniforms.uTip = common.uTip;
        sh.uniforms.uGrow = common.uGrow; sh.uniforms.uTint = common.uTint;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vHy;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHy = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uColor; uniform vec3 uTip; uniform float uGrow; uniform float uTint; varying float vHy;')
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            // apparition : trame qui se remplit (pas de tri de transparence)
            float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
            if (n > uGrow) discard;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
            // teinte choisie : on garde la lumière et le grain du fichier, on change la couleur
            float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 tinted = mix(uColor, uTip, 0.35) * (0.45 + 3.2 * lum);
            diffuseColor.rgb = mix(diffuseColor.rgb, tinted, uTint);`);
      };
      mat.customProgramCacheKey = () => 'garo-glb-' + (m.uuid || '');
      return mat;
    });
    o.material = Array.isArray(o.material) ? mats : mats[0];
  });
  return group;
}

// ---------- sauvegarde locale (IndexedDB) ----------
const DB = 'garo', STORE = 'coiffures';
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
/** Enregistre une coiffure déposée : { id, name, cat, duration, price, desc, data: ArrayBuffer }. */
export const saveStyle = (rec) => tx('readwrite', (s) => s.put(rec));
export const deleteStyle = (id) => tx('readwrite', (s) => s.delete(id));
export async function loadStyles() {
  try { return (await tx('readonly', (s) => s.getAll())) || []; } catch { return []; }
}
