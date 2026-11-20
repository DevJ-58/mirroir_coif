// Export du mannequin GARO en .glb (kit artiste) : tête, oreilles et buste, en mètres,
// dans le repère exact où les coiffures sont posées.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function exportMannequinGlb(avatar) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xe4dfd8, roughness: 0.6, name: 'GARO_mannequin_blanc' });
  const root = new THREE.Group();
  root.name = 'GARO_mannequin';
  root.scale.setScalar(0.01);   // centimètres → mètres (unité de Blender)
  const add = (mesh, name) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', mesh.geometry.attributes.position.clone());
    if (mesh.geometry.index) g.setIndex(mesh.geometry.index.clone());
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.position.copy(mesh.position); m.rotation.copy(mesh.rotation); m.scale.copy(mesh.scale);
    root.add(m);
  };
  add(avatar.head, 'GARO_mannequin_tete');
  avatar.ears.forEach((e, i) => add(e, `GARO_mannequin_oreille_${i ? 'droite' : 'gauche'}`));
  add(avatar.cape, 'GARO_mannequin_buste');
  const scene = new THREE.Scene();
  scene.add(root);
  const buf = await new GLTFExporter().parseAsync(scene, { binary: true });
  return buf;
}

/** Exporte un objet (ex. une coiffure générée) en .glb, en mètres, matière standard. */
export async function exportObjectGlb(object, color = 0x1a1310) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, name: 'cheveux' });
  const root = new THREE.Group();
  root.scale.setScalar(0.01);
  object.traverse((o) => {
    if (!o.isMesh) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', o.geometry.attributes.position.clone());
    if (o.geometry.attributes.normal) g.setAttribute('normal', o.geometry.attributes.normal.clone());
    if (o.geometry.index) g.setIndex(o.geometry.index.clone());
    const m = new THREE.Mesh(g, mat);
    m.name = o.name || 'meche';
    root.add(m);
  });
  const scene = new THREE.Scene();
  scene.add(root);
  return new GLTFExporter().parseAsync(scene, { binary: true });
}
