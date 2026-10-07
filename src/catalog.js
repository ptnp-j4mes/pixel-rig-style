import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const KIT_BASE = '/kit/';

const prototypes = new Map(); // name -> original Object3D
const inflight = new Map();   // name -> Promise<boolean: loaded ok>
const thumbs = new Map();     // name -> dataURL
let manifest = null;

let thumbRenderer, thumbScene, thumbCamera;

export async function fetchManifest() {
  const res = await fetch('/manifest.json');
  if (!res.ok) throw new Error(`manifest.json ${res.status} — run: python3 scripts/gen_manifest.py`);
  manifest = await res.json();
  return manifest;
}

export function getManifest() {
  return manifest;
}

export function has(name) {
  return !!manifest?.some((e) => e.name === name);
}

export function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return groups;
}

// Per-model LoadingManager so onLoad fires only after the .bin AND textures finished.
function loadGLTF(name) {
  return new Promise((resolve, reject) => {
    let gltf = null;
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => resolve(gltf);
    new GLTFLoader(manager).load(
      KIT_BASE + name + '.gltf',
      (result) => { gltf = result; },
      undefined,
      reject
    );
  });
}

export function loadModel(name) {
  if (prototypes.has(name)) return Promise.resolve(instantiate(prototypes.get(name)));
  if (!inflight.has(name)) {
    inflight.set(
      name,
      loadGLTF(name)
        .then((gltf) => { prototypes.set(name, gltf.scene); inflight.delete(name); return true; })
        .catch(() => { inflight.delete(name); return false; })
    );
  }
  return inflight.get(name).then((ok) => (ok ? instantiate(prototypes.get(name)) : placeholder(name)));
}

function instantiate(proto) {
  const obj = proto.clone(true);
  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone(); // per-instance: highlight must not leak to siblings
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return obj;
}

function placeholder(name) {
  console.warn(`model missing: ${name}`);
  const entry = manifest?.find((e) => e.name === name);
  const s = entry?.size ?? [1, 1, 1];
  const geo = new THREE.BoxGeometry(Math.max(s[0], 0.5), Math.max(s[1], 0.5), Math.max(s[2], 0.5));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }));
}

export function makeThumb(name) {
  if (thumbs.has(name)) return Promise.resolve(thumbs.get(name));
  if (!thumbRenderer) initThumbStage();
  return loadModel(name).then((obj) => {
    thumbScene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fit = Math.max(size.x, size.y, size.z) || 1;
    thumbCamera.position.set(center.x + fit * 1.2, center.y + fit, center.z + fit * 1.2);
    thumbCamera.lookAt(center);
    thumbRenderer.render(thumbScene, thumbCamera);
    const url = thumbRenderer.domElement.toDataURL('image/png');
    thumbScene.remove(obj);
    thumbs.set(name, url);
    return url;
  });
}

function initThumbStage() {
  thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  thumbRenderer.setSize(96, 96);
  thumbScene = new THREE.Scene();
  thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.5));
  const dir = new THREE.DirectionalLight(0xffffff, 2);
  dir.position.set(3, 5, 2);
  thumbScene.add(dir);
  thumbCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
}
