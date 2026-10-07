import * as THREE from 'three';
import { createCamera } from './camera.js';
import * as catalog from './catalog.js';
import { createEditor } from './editor.js';
import { CATEGORY_ORDER, GRID_SIZE, MAP_EXTENT } from './lib.js';

const viewport = document.getElementById('viewport');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 50, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, far: 200 });
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP_EXTENT, MAP_EXTENT),
  new THREE.MeshStandardMaterial({ color: 0x7d9b5e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(MAP_EXTENT, MAP_EXTENT / GRID_SIZE, 0x5a7a44, 0x5a7a44);
grid.position.y = 0.02;
scene.add(grid);

const cam = createCamera(viewport);

new ResizeObserver(() => {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  cam.camera.aspect = w / h;
  cam.camera.updateProjectionMatrix();
}).observe(viewport);

const editor = createEditor({
  scene,
  camera: cam.camera,
  controls: cam.controls,
  dom: renderer.domElement,
  catalog,
  onChange: () => console.log('changed', editor.getObjects().length, 'objects'),
  onSelection: (inst) => console.log('selection', inst?.asset ?? null),
});
window.editor = editor; // console test hook

function renderPalette(items, autoOpen) {
  const wrap = document.getElementById('palette');
  wrap.innerHTML = '';
  const groups = catalog.groupByCategory(items);
  const known = CATEGORY_ORDER.filter((c) => groups.has(c));
  const extra = [...groups.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
  for (const cat of [...known, ...extra]) {
    const details = document.createElement('details');
    details.open = !!autoOpen;
    const summary = document.createElement('summary');
    summary.textContent = `${cat} (${groups.get(cat).length})`;
    details.appendChild(summary);
    details.addEventListener('toggle', () => {
      if (details.open) fillItems(details, groups.get(cat));
    });
    if (autoOpen) fillItems(details, groups.get(cat));
    wrap.appendChild(details);
  }
}

function fillItems(details, items) {
  if (details.dataset.filled) return;
  details.dataset.filled = '1';
  const grid = document.createElement('div');
  grid.className = 'palette-grid';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'palette-item';
    btn.title = item.name;
    const img = document.createElement('img');
    img.alt = item.name;
    catalog.makeThumb(item.name).then((url) => { img.src = url; });
    const label = document.createElement('span');
    label.textContent = item.name;
    btn.append(img, label);
    btn.onclick = () => editor.setPlace(item.name);
    grid.appendChild(btn);
  }
  details.appendChild(grid);
}

document.getElementById('palette-search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  renderPalette(q ? allItems.filter((i) => i.name.toLowerCase().includes(q)) : allItems, !!q);
});

let allItems = [];
try {
  allItems = await catalog.fetchManifest();
  renderPalette(allItems, false);
} catch (err) {
  const banner = document.getElementById('banner');
  banner.textContent = err.message;
  banner.hidden = false;
}

renderer.setAnimationLoop(() => {
  cam.controls.update();
  renderer.render(scene, cam.camera);
});
