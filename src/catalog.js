import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const prototypes = new Map(); // "pack/name" -> normalized prototype
const inflight = new Map();   // "pack/name" -> Promise<boolean: ok>
const thumbs = new Map();     // "pack/name" -> dataURL
const glbCache = new Map();   // pack/file -> Promise<scene> (for 'glb' packs)
let manifest = null;

let thumbRenderer, thumbScene, thumbCamera;

export async function fetchManifest() {
  const res = await fetch('/manifest.json');
  if (!res.ok) throw new Error(`manifest.json ${res.status} — run: python3 scripts/gen_manifest.py`);
  manifest = await res.json();
  return manifest;
}

export function getPacks() {
  return manifest ?? [];
}

export function has(pack, name) {
  const p = manifest?.find((x) => x.id === pack);
  return !!p?.entries?.some((e) => e.name === name);
}

export function entrySize(pack, name) {
  const p = manifest?.find((x) => x.id === pack);
  return p?.entries?.find((e) => e.name === name)?.size ?? null;
}

function key(pack, name) {
  return `${pack}/${name}`;
}

// Per-model LoadingManager: onLoad fires only after .bin AND textures finished.
function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    let gltf = null;
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => resolve(gltf);
    new GLTFLoader(manager).load(url, (result) => { gltf = result; }, undefined, reject);
  });
}

// Re-centre: X/Z center at origin, bbox base on y=0. Records measured size.
function normalizePrototype(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const wrapper = new THREE.Group();
  obj.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  wrapper.add(obj);
  wrapper.userData.size = [+size.x.toFixed(3), +size.y.toFixed(3), +size.z.toFixed(3)];
  return wrapper;
}

async function getPrototype(pack, name) {
  const k = key(pack, name);
  if (prototypes.has(k)) return prototypes.get(k);
  const entry = manifest.find((p) => p.id === pack);
  if (!entry) throw new Error(`unknown pack: ${pack}`);
  const modelEntry = entry.entries.find((item) => item.name === name);
  let raw;
  if (entry.type === 'glb') {
    const file = modelEntry?.file ?? entry.file;
    const cacheKey = `${pack}/${file}`;
    if (!glbCache.has(cacheKey)) {
      glbCache.set(cacheKey, loadGLTF('/packs/' + pack + '/' + file).then((gltf) => gltf.scene));
    }
    const scene = await glbCache.get(cacheKey);
    let node = null;
    scene.traverse((c) => { if (!node && c.name === name) node = c; });
    if (!node) throw new Error(`node not found in ${pack}: ${name}`);
    // detach a copy of the node (with its transform) as a standalone object
    raw = node.clone(true);
  } else {
    const gltf = await loadGLTF('/packs/' + pack + '/' + name + '.gltf');
    raw = gltf.scene;
  }
  const proto = normalizePrototype(raw);
  prototypes.set(k, proto);
  return proto;
}

export function loadModel(pack, name) {
  const k = key(pack, name);
  if (prototypes.has(k)) return Promise.resolve(instantiate(prototypes.get(k), pack, name));
  if (!inflight.has(k)) {
    inflight.set(
      k,
      getPrototype(pack, name)
        .then((proto) => { inflight.delete(k); return true; })
        .catch((err) => { console.warn(`model missing: ${pack}/${name}`, err); inflight.delete(k); return false; })
    );
  }
  return inflight.get(k).then((ok) => (ok ? instantiate(prototypes.get(k), pack, name) : placeholder(pack, name)));
}

function instantiate(proto, pack, name) {
  const obj = proto.clone(true);
  obj.userData.size = proto.userData.size;
  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone(); // per-instance: highlight must not leak
      child.castShadow = !(pack === 'village-pack' && name.startsWith('Road_'));
      child.receiveShadow = true;
    }
  });
  return obj;
}

function placeholder(pack, name) {
  const s = entrySize(pack, name) ?? [1, 1, 1];
  const geo = new THREE.BoxGeometry(Math.max(s[0], 0.5), Math.max(s[1], 0.5), Math.max(s[2], 0.5));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }));
}

export function makeThumb(pack, name) {
  const k = key(pack, name);
  if (thumbs.has(k)) return Promise.resolve(thumbs.get(k));
  if (!thumbRenderer) initThumbStage();
  return loadModel(pack, name).then((obj) => {
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
    thumbs.set(k, url);
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
