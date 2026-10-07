import * as THREE from 'three';
import { createCamera } from './camera.js';
import * as catalog from './catalog.js';
import { createEditor } from './editor.js';
import * as storage from './storage.js';
import { SNAP_SIZE, MAP_EXTENT, serializeMap, CATEGORY_ORDER } from './lib.js';

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

const grid = new THREE.GridHelper(MAP_EXTENT, MAP_EXTENT / SNAP_SIZE, 0x5a7a44, 0x5a7a44);
grid.position.y = 0.02;
scene.add(grid);

const cam = createCamera(viewport);

new ResizeObserver(() => {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  cam.camera.aspect = w / h;
  cam.camera.updateProjectionMatrix();
}).observe(viewport);

const mapNameInput = document.getElementById('map-name');
const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg, ms = 4000) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), ms);
}

function currentDoc() {
  return serializeMap(mapNameInput.value.trim() || 'my-village', editor.getObjects());
}

const editor = createEditor({
  scene,
  camera: cam.camera,
  controls: cam.controls,
  dom: renderer.domElement,
  catalog,
  onChange: () => storage.scheduleAutosave(currentDoc()),
  onSelection,
});

document.getElementById('btn-new').onclick = () => {
  if (editor.getObjects().length && !confirm('ล้าง map ปัจจุบัน?')) return;
  editor.clear();
  storage.clearAutosave();
  toast('เริ่ม map ใหม่แล้ว');
};

document.getElementById('btn-save').onclick = () => storage.saveMapFile(currentDoc());

mapNameInput.addEventListener('input', () => storage.scheduleAutosave(currentDoc()));

document.getElementById('btn-load').onclick = async () => {
  const doc = await storage.openMapFile();
  if (!doc) return;
  if (doc.error) return toast(`เปิดไฟล์ไม่สำเร็จ: ${doc.error}`);
  const { missing } = await editor.loadObjects(doc.objects);
  mapNameInput.value = doc.mapName || 'my-village';
  storage.scheduleAutosave(currentDoc());
  toast(`โหลด ${doc.objects.length - missing.length} ชิ้น` + (missing.length ? ` — ข้ามไม่รู้จัก: ${missing.join(', ')}` : ''));
};

document.getElementById('btn-reset-cam').onclick = () => cam.reset();

const btnGrid = document.getElementById('btn-grid');
btnGrid.onclick = () => {
  grid.visible = !grid.visible;
  btnGrid.classList.toggle('active', grid.visible);
};

const btnSnap = document.getElementById('btn-snap');
btnSnap.onclick = () => {
  editor.setSnap(!editor.getSnap());
  btnSnap.classList.toggle('active', editor.getSnap());
};

// ---- properties panel ----
const propsEl = document.getElementById('properties');
const propFields = {
  posX: document.getElementById('pos-x'),
  posY: document.getElementById('pos-y'),
  posZ: document.getElementById('pos-z'),
  rotY: document.getElementById('rot-y'),
  scaleX: document.getElementById('scale-x'),
  scaleY: document.getElementById('scale-y'),
  scaleZ: document.getElementById('scale-z'),
};

function onSelection(inst) {
  propsEl.hidden = !inst;
  if (inst) syncPanel();
}

function syncPanel() {
  const inst = editor.getSelected();
  if (!inst) return;
  const o = inst.obj;
  document.getElementById('prop-name').textContent = inst.asset;
  propFields.posX.value = o.position.x;
  propFields.posY.value = o.position.y;
  propFields.posZ.value = o.position.z;
  propFields.rotY.value = Math.round(THREE.MathUtils.radToDeg(o.rotation.y));
  propFields.scaleX.value = o.scale.x;
  propFields.scaleY.value = o.scale.y;
  propFields.scaleZ.value = o.scale.z;
}

for (const [key, input] of Object.entries(propFields)) {
  input.addEventListener('input', () => {
    const inst = editor.getSelected();
    if (!inst) return;
    const o = inst.obj;
    o.position.x = parseFloat(propFields.posX.value) || 0;
    o.position.y = parseFloat(propFields.posY.value) || 0;
    o.position.z = parseFloat(propFields.posZ.value) || 0;
    o.rotation.y = THREE.MathUtils.degToRad(parseFloat(propFields.rotY.value) || 0);
    o.scale.set(
      parseFloat(propFields.scaleX.value) || 1,
      parseFloat(propFields.scaleY.value) || 1,
      parseFloat(propFields.scaleZ.value) || 1
    );
    editor.changed(); // autosave
  });
}

document.getElementById('rot-90').onclick = () => { editor.rotateSelected90(); syncPanel(); };
document.getElementById('scale-reset').onclick = () => {
  const inst = editor.getSelected();
  if (!inst) return;
  inst.obj.scale.set(1, 1, 1);
  editor.changed();
  syncPanel();
};
document.getElementById('btn-delete').onclick = () => editor.deleteSelected();

function categoriesOf(entries) {
  const cats = new Map();
  for (const e of entries) {
    const c = e.name.split('_')[0];
    if (!cats.has(c)) cats.set(c, []);
    cats.get(c).push(e);
  }
  const known = CATEGORY_ORDER.filter((c) => cats.has(c));
  const extra = [...cats.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
  return [...known, ...extra].map((c) => [c, cats.get(c)]);
}

function renderPackPalette(packs, autoOpen) {
  const wrap = document.getElementById('palette');
  wrap.innerHTML = '';
  for (const pack of packs) {
    const packDetails = document.createElement('details');
    packDetails.open = !!autoOpen;
    const packSummary = document.createElement('summary');
    packSummary.textContent = `${pack.name} (${pack.entries.length})`;
    packDetails.appendChild(packSummary);
    packDetails.addEventListener('toggle', () => { if (packDetails.open) fillPack(packDetails, pack); });
    if (autoOpen) fillPack(packDetails, pack);
    wrap.appendChild(packDetails);
  }
}

function fillPack(details, pack) {
  if (details.dataset.filled) return;
  details.dataset.filled = '1';
  for (const [cat, entries] of categoriesOf(pack.entries)) {
    const catDetails = document.createElement('details');
    const catSummary = document.createElement('summary');
    catSummary.textContent = `${cat} (${entries.length})`;
    catDetails.appendChild(catSummary);
    catDetails.addEventListener('toggle', () => { if (catDetails.open) fillItems(catDetails, pack.id, entries); });
    fillItems(catDetails, pack.id, entries); // categories are small — fill eagerly
    details.appendChild(catDetails);
  }
}

function fillItems(details, packId, entries) {
  if (details.dataset.filled) return;
  details.dataset.filled = '1';
  const gridEl = document.createElement('div');
  gridEl.className = 'palette-grid';
  for (const item of entries) {
    const btn = document.createElement('button');
    btn.className = 'palette-item';
    btn.title = item.name;
    const img = document.createElement('img');
    img.alt = item.name;
    catalog.makeThumb(packId, item.name).then((url) => { img.src = url; });
    const label = document.createElement('span');
    label.textContent = item.name;
    btn.append(img, label);
    btn.onclick = () => editor.setPlace(packId, item.name);
    gridEl.appendChild(btn);
  }
  details.appendChild(gridEl);
}

document.getElementById('palette-search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const packs = catalog.getPacks();
  const filtered = q
    ? packs.map((p) => ({ ...p, entries: p.entries.filter((i) => i.name.toLowerCase().includes(q)) })).filter((p) => p.entries.length)
    : packs;
  renderPackPalette(filtered, !!q);
});

try {
  const packs = await catalog.fetchManifest();
  renderPackPalette(packs, false);
} catch (err) {
  const banner = document.getElementById('banner');
  banner.textContent = err.message;
  banner.hidden = false;
}

const saved = storage.readAutosave();
if (saved && saved.objects.length) {
  const { missing } = await editor.loadObjects(saved.objects);
  mapNameInput.value = saved.mapName || 'my-village';
  toast(`กู้คืน autosave ${saved.objects.length - missing.length} ชิ้น${missing.length ? ` (ข้าม ${missing.length})` : ''} — กด "ใหม่" เพื่อเริ่มใหม่`);
}

renderer.setAnimationLoop(() => {
  cam.controls.update();
  renderer.render(scene, cam.camera);
});
