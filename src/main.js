import * as THREE from 'three';
import { createCamera } from './camera.js';
import * as catalog from './catalog.js';
import { createEditor } from './editor.js';
import { createHistory } from './history.js';
import { createPlayMode } from './play.js';
import * as storage from './storage.js';
import { SNAP_SIZE, MAP_EXTENT, DEFAULT_SPAWN, serializeMap, CATEGORY_ORDER } from './lib.js';

const viewport = document.getElementById('viewport');

const toolIcons = {
  select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 3 13 11-6 .8-3.2 5.2L5 3Z"/><path d="m13 15 4 5"/></svg>',
  pan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6.5 7H12c-2 0-3.2-.8-4.2-2.1L4 16a1.7 1.7 0 0 1 2.5-2.3L8 15"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4.8 9A7.5 7.5 0 0 1 18 6l2 2M4 17v-5h5m10.2 3A7.5 7.5 0 0 1 6 18l-2-2"/></svg>',
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 10v9h13v-9M9 19v-5h6v5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/></svg>',
  snap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h4M5 5v4M19 5h-4m4 0v4M5 19h4m-4 0v-4m14 4h-4m4 0v-4M8 12h8M12 8v8"/></svg>',
  layer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="8.5" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4M7 10l3 4M17 10l-3 4"/></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 0 14h-2"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5m5 5h-9a7 7 0 0 0 0 14h2"/></svg>',
};
for (const button of document.querySelectorAll('[data-icon]')) {
  const name = button.dataset.icon;
  button.innerHTML = name === 'move'
    ? '<img src="/icons/four-arrows.png" alt="">'
    : toolIcons[name];
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);

scene.add(new THREE.HemisphereLight(0xfffaed, 0x606850, 1.05));
const sun = new THREE.DirectionalLight(0xfffaed, 1.8);
sun.position.set(35, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.04;
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
const play = createPlayMode({ catalog, dom: renderer.domElement });

new ResizeObserver(() => {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  cam.camera.aspect = w / h;
  cam.camera.updateProjectionMatrix();
  play.camera.aspect = w / h;
  play.camera.updateProjectionMatrix();
}).observe(viewport);

const mapNameInput = document.getElementById('map-name');
const toastEl = document.getElementById('toast');
const spawnButton = document.getElementById('btn-set-spawn');
const playButton = document.getElementById('btn-play');
const playHud = document.getElementById('play-hud');
const exitPlayButton = document.getElementById('btn-exit-play');
let spawn = { pos: [...DEFAULT_SPAWN.pos], rotY: DEFAULT_SPAWN.rotY };
let placingSpawn = false;

const spawnMarker = new THREE.Group();
const spawnMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf5d, side: THREE.DoubleSide, depthTest: false });
const spawnRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), spawnMarkerMaterial);
spawnRing.rotation.x = -Math.PI / 2;
spawnRing.position.y = 0.025;
const spawnStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, 0.65, 8), spawnMarkerMaterial);
spawnStem.position.y = 0.38;
const spawnTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.24, 8), spawnMarkerMaterial);
spawnTip.position.y = 0.83;
spawnMarker.add(spawnRing, spawnStem, spawnTip);
scene.add(spawnMarker);

function updateSpawnMarker() {
  spawnMarker.position.set(spawn.pos[0], 0, spawn.pos[2]);
}
updateSpawnMarker();

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!placingSpawn || event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, cam.camera);
  const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (!point || Math.abs(point.x) > MAP_EXTENT / 2 || Math.abs(point.z) > MAP_EXTENT / 2) {
    toast('เลือกจุดเกิดภายในขอบเขตพื้น map');
    return;
  }
  spawn = { pos: [Number(point.x.toFixed(2)), 0, Number(point.z.toFixed(2))], rotY: 0 };
  updateSpawnMarker();
  placingSpawn = false;
  spawnButton.classList.remove('active');
  spawnButton.setAttribute('aria-pressed', 'false');
  storage.scheduleAutosave(currentDoc());
  toast(`ตั้งจุดเกิดที่ ${spawn.pos[0]}, ${spawn.pos[2]} แล้ว`);
}, true);
let toastTimer;
function toast(msg, ms = 4000) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), ms);
}

function requestAction(options) {
  const dialog = document.getElementById('action-dialog');
  const form = document.getElementById('action-form');
  const inputRow = document.getElementById('action-input-row');
  const input = document.getElementById('action-value');
  const message = document.getElementById('action-message');
  const asksForName = Object.hasOwn(options, 'initial');
  document.getElementById('action-title').textContent = options.title;
  message.textContent = options.message || '';
  message.hidden = !options.message;
  inputRow.hidden = !asksForName;
  input.required = asksForName;
  if (asksForName) {
    document.getElementById('action-label').textContent = options.label || 'ชื่อ';
    input.value = options.initial;
  }
  document.getElementById('action-ok').textContent = options.confirmLabel || 'ตกลง';
  dialog.returnValue = '';
  form.onsubmit = (event) => { event.preventDefault(); dialog.close('confirm'); };
  document.getElementById('action-cancel').onclick = () => dialog.close('cancel');
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm' ? (asksForName ? input.value.trim() : true) : (asksForName ? null : false));
    }, { once: true });
    dialog.showModal();
    (asksForName ? input : document.getElementById('action-ok')).focus();
    if (asksForName) input.select();
  });
}

function askName(title, initial) {
  return requestAction({ title, initial, label: 'ชื่อ' });
}

function askConfirmation(title, message, confirmLabel = 'ยืนยัน') {
  return requestAction({ title, message, confirmLabel });
}

const undoButton = document.getElementById('btn-undo');
const redoButton = document.getElementById('btn-redo');
let history;
let suppressHistory = false;
let restoringHistory = false;

function mapContent() {
  return { objects: editor.getObjects(), layers: editor.getLayers(), groups: editor.getGroups() };
}

function currentDoc() {
  const map = mapContent();
  return serializeMap(mapNameInput.value.trim() || 'my-village', map.objects, map.layers, map.groups, spawn);
}

function updateHistoryButtons() {
  if (!history) return;
  undoButton.disabled = restoringHistory || !history.canUndo();
  redoButton.disabled = restoringHistory || !history.canRedo();
}

function persistEditorChange() {
  storage.scheduleAutosave(currentDoc());
  renderLayerTree();
  updateInspectorLock();
  if (!history || suppressHistory || restoringHistory) return;
  history.record(mapContent());
  updateHistoryButtons();
}

async function restoreHistoryState(state) {
  restoringHistory = true;
  updateHistoryButtons();
  try {
    await editor.loadObjects(state.objects, state.layers, state.groups);
    renderLayerTree();
    syncPanel();
    updateInspectorLock();
    storage.scheduleAutosave(currentDoc());
  } catch (err) {
    toast(`ย้อน map ไม่สำเร็จ: ${err.message}`);
  } finally {
    restoringHistory = false;
    updateHistoryButtons();
  }
}

const editor = createEditor({
  scene,
  camera: cam.camera,
  controls: cam.controls,
  dom: renderer.domElement,
  catalog,
  onChange: persistEditorChange,
  onSelection,
});
history = createHistory(mapContent());
updateHistoryButtons();

function undoMap() {
  if (restoringHistory) return;
  const state = history.undo();
  if (state) void restoreHistoryState(state);
}

function redoMap() {
  if (restoringHistory) return;
  const state = history.redo();
  if (state) void restoreHistoryState(state);
}

undoButton.onclick = undoMap;
redoButton.onclick = redoMap;
document.addEventListener('keydown', (e) => {
  if (play.isActive()) return;
  const target = e.target;
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redoMap();
    else undoMap();
  } else if (e.ctrlKey && key === 'y') {
    e.preventDefault();
    redoMap();
  }
});

document.getElementById('btn-new').onclick = async () => {
  const hasMapContent = editor.getObjects().length || editor.getGroups().length
    || editor.getLayers().some((layer) => layer.id !== 'layer-default' || layer.name !== 'Default Layer' || !layer.visible || layer.locked);
  if (hasMapContent && !await askConfirmation('เริ่ม map ใหม่', 'ล้าง object, layer และ group ใน map ปัจจุบัน?', 'ล้าง map')) return;
  selectedObjectIds.clear();
  collapsedNodes.clear();
  editor.clear();
  spawn = { pos: [...DEFAULT_SPAWN.pos], rotY: DEFAULT_SPAWN.rotY };
  updateSpawnMarker();
  renderLayerTree();
  syncPanel();
  updateInspectorLock();
  history.reset(mapContent());
  updateHistoryButtons();
  storage.clearAutosave();
  toast('เริ่ม map ใหม่แล้ว');
};

document.getElementById('btn-save').onclick = () => {
  storage.saveMapFile(currentDoc());
  toast('ส่งออก map JSON สำหรับเปิดเล่นใน web app แล้ว');
};

spawnButton.onclick = () => {
  placingSpawn = !placingSpawn;
  spawnButton.classList.toggle('active', placingSpawn);
  spawnButton.setAttribute('aria-pressed', String(placingSpawn));
  toast(placingSpawn ? 'คลิกบนพื้นเพื่อกำหนดจุดเกิด' : 'ยกเลิกการตั้งจุดเกิด');
};

async function enterPlayMode() {
  if (play.isActive() || playButton.disabled) return;
  playButton.disabled = true;
  placingSpawn = false;
  spawnButton.classList.remove('active');
  spawnButton.setAttribute('aria-pressed', 'false');
  const playHint = document.querySelector('#play-hud .play-hint p');
  exitPlayButton.disabled = true;
  playHint.textContent = 'กำลังโหลดฉาก…';
  document.body.classList.add('playing');
  playHud.hidden = false;
  editor.setEnabled(false);
  try {
    await play.enter(currentDoc());
    playHint.textContent = 'WASD / ลูกศร เพื่อเดิน · คลิกฉากแล้วเลื่อนเมาส์เพื่อหมุน (หรือคลิกค้างแล้วลาก) · Esc เพื่อปล่อยเมาส์';
    exitPlayButton.disabled = false;
  } catch (error) {
    play.exit();
    editor.setEnabled(true);
    document.body.classList.remove('playing');
    playHud.hidden = true;
    toast(`เข้า Play mode ไม่สำเร็จ: ${error.message}`);
    playButton.disabled = false;
    exitPlayButton.disabled = false;
  }
}

function exitPlayMode() {
  if (!play.isActive()) return;
  play.exit();
  editor.setEnabled(true);
  document.body.classList.remove('playing');
  playHud.hidden = true;
  playButton.disabled = false;
}

playButton.onclick = enterPlayMode;
exitPlayButton.onclick = exitPlayMode;

mapNameInput.addEventListener('input', () => storage.scheduleAutosave(currentDoc()));

document.getElementById('btn-load').onclick = async () => {
  const doc = await storage.openMapFile();
  if (!doc) return;
  if (doc.error) return toast(`เปิดไฟล์ไม่สำเร็จ: ${doc.error}`);
  const { missing } = await editor.loadObjects(doc.objects, doc.layers, doc.groups);
  spawn = { pos: [...doc.spawn.pos], rotY: doc.spawn.rotY };
  updateSpawnMarker();
  selectedObjectIds.clear();
  collapsedNodes.clear();
  renderLayerTree();
  syncPanel();
  updateInspectorLock();
  mapNameInput.value = doc.mapName || 'my-village';
  history.reset(mapContent());
  updateHistoryButtons();
  storage.scheduleAutosave(currentDoc());
  toast(`โหลด ${doc.objects.length - missing.length} ชิ้น` + (missing.length ? ` — ข้ามไม่รู้จัก: ${missing.join(', ')}` : ''));
};

document.getElementById('btn-reset-cam').onclick = () => cam.reset();

const btnGrid = document.getElementById('btn-grid');
btnGrid.onclick = () => {
  grid.visible = !grid.visible;
  btnGrid.classList.toggle('active', grid.visible);
  btnGrid.setAttribute('aria-pressed', String(grid.visible));
};

const btnSnap = document.getElementById('btn-snap');
btnSnap.onclick = () => {
  editor.setSnap(!editor.getSnap());
  btnSnap.classList.toggle('active', editor.getSnap());
  btnSnap.setAttribute('aria-pressed', String(editor.getSnap()));
};

for (const [tool, buttonId] of [['select', 'tool-select'], ['pan', 'tool-pan'], ['move', 'tool-move']]) {
  const button = document.getElementById(buttonId);
  button.onclick = () => {
    editor.setTool(tool);
    for (const candidate of ['select', 'pan', 'move']) {
      const active = candidate === tool;
      const toolButton = document.getElementById(`tool-${candidate}`);
      toolButton.classList.toggle('active', active);
      toolButton.setAttribute('aria-pressed', String(active));
    }
  };
}

// ---- properties panel ----
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
  renderLayerTree();
  syncPanel();
  updateInspectorLock();
}

function syncPanel() {
  const item = editor.getSelected();
  const transform = editor.getSelectedTransform();
  if (!item || !transform) {
    document.getElementById('prop-name').textContent = 'เลือก object หรือ group เพื่อแก้ไข';
    for (const field of Object.values(propFields)) field.value = '';
    return;
  }
  const nonUniformGroup = item.type === 'group' && transform.scale.some((value) => Math.abs(value - transform.scale[0]) > 1e-5);
  document.getElementById('prop-name').textContent = item.type === 'group'
    ? `${item.name} (Group · ${nonUniformGroup ? 'สเกลเดิมจากไฟล์' : 'สเกลเท่ากันทุกแกน'})`
    : item.name || item.asset;
  propFields.posX.value = transform.pos[0];
  propFields.posY.value = transform.pos[1];
  propFields.posZ.value = transform.pos[2];
  propFields.rotY.value = Math.round(transform.rotY);
  propFields.scaleX.value = transform.scale[0];
  propFields.scaleY.value = transform.scale[1];
  propFields.scaleZ.value = transform.scale[2];
}

function selectedIsLocked() {
  const item = editor.getSelected();
  if (!item) return true;
  if (item.locked || editor.getLayers().find((layer) => layer.id === item.layerId)?.locked) return true;
  return item.type === 'object' && item.groupId
    ? !!editor.getGroups().find((group) => group.id === item.groupId)?.locked
    : false;
}

function updateInspectorLock() {
  const item = editor.getSelected();
  const transform = item ? editor.getSelectedTransform() : null;
  const disabled = !item || selectedIsLocked();
  const transformDisabled = disabled || !editor.isItemTransformable(item.type, item.id);
  const nonUniformGroup = item?.type === 'group' && transform.scale.some((value) => Math.abs(value - transform.scale[0]) > 1e-5);
  for (const field of Object.values(propFields)) field.disabled = transformDisabled;
  if (item?.type === 'group') {
    propFields.scaleX.disabled = transformDisabled || nonUniformGroup;
    propFields.scaleY.disabled = transformDisabled || nonUniformGroup;
    propFields.scaleZ.disabled = transformDisabled || nonUniformGroup;
  }
  document.getElementById('scale-reset').disabled = transformDisabled;
  document.getElementById('rot-90').disabled = transformDisabled;
}

const treeEl = document.getElementById('layer-tree');
const selectedObjectIds = new Set();
const collapsedNodes = new Set();
let dragNode = null;

function actionButton(label, title, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.onclick = (event) => { event.stopPropagation(); onClick(event); };
  return button;
}

function treeNodeRow(type, item) {
  const row = document.createElement('div');
  row.className = 'tree-row';
  if (type === 'object') row.setAttribute('role', 'listitem');
  row.dataset.nodeType = type;
  row.dataset.nodeId = item.id;
  row.draggable = type === 'layer' || !editor.isItemLocked(type, item.id);
  row.addEventListener('dragstart', (event) => {
    dragNode = { type, id: item.id };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${type}:${item.id}`);
  });
  row.addEventListener('dragend', () => { dragNode = null; row.classList.remove('drop-target'); });
  row.addEventListener('dragover', (event) => {
    if (!dragNode || !canDropOn(dragNode, type, item)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    row.classList.add('drop-target');
  });
  row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
  row.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    row.classList.remove('drop-target');
    if (dragNode && canDropOn(dragNode, type, item)) dropOn(dragNode, type, item);
  });
  if (type === 'layer' && item.id === editor.getActiveLayerId()) row.classList.add('active-layer');
  const selected = editor.getSelected();
  if (selected?.type === type && selected.id === item.id) row.classList.add('selected');

  if (type !== 'object') {
    const children = type === 'layer' ? childrenOfLayer(item.id) : childrenOfGroup(item.id);
    const collapsed = collapsedNodes.has(item.id);
    const caret = actionButton(children.length ? (collapsed ? '›' : '⌄') : '·', children.length ? `${collapsed ? 'เปิด' : 'ยุบ'} ${item.name}` : 'ไม่มีรายการย่อย', 'tree-caret', () => {
      if (!children.length) return;
      if (collapsed) collapsedNodes.delete(item.id); else collapsedNodes.add(item.id);
      renderLayerTree();
    });
    caret.disabled = !children.length;
    row.appendChild(caret);
  } else {
    const checkWrap = document.createElement('label');
    checkWrap.className = 'tree-check';
    checkWrap.title = `เลือก ${item.name} สำหรับ Group`;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = selectedObjectIds.has(item.id);
    check.disabled = !editor.isItemTransformable('object', item.id);
    check.setAttribute('aria-label', `เลือก ${item.name} สำหรับ Group`);
    check.addEventListener('click', (event) => event.stopPropagation());
    check.addEventListener('change', () => {
      if (check.checked) selectedObjectIds.add(item.id); else selectedObjectIds.delete(item.id);
      updateGroupButton();
    });
    checkWrap.appendChild(check);
    row.appendChild(checkWrap);
  }

  if (type === 'layer') {
    const active = item.id === editor.getActiveLayerId();
    row.appendChild(actionButton(active ? '✓' : '○', `ตั้ง ${item.name} เป็น active layer สำหรับวาง object`, `tree-action${active ? ' tree-active' : ''}`, () => {
      editor.setActiveLayer(item.id);
      renderLayerTree();
    }));
  }

  const label = type === 'layer'
    ? `${item.name} (${childrenOfLayer(item.id).reduce((count, child) => count + (child.type === 'group' ? childrenOfGroup(child.id).length : 1), 0)})`
    : type === 'group' ? `${item.name} (${childrenOfGroup(item.id).length})` : item.name || item.asset;
  const select = actionButton(label, type === 'layer' ? item.name : `เลือก ${item.name || item.asset} ในแผนที่`, 'tree-select', () => {
    if (type !== 'layer') editor.selectItem(type, item.id);
  });
  row.appendChild(select);

  row.appendChild(actionButton(item.visible === false ? '○' : '◉', `${item.visible === false ? 'แสดง' : 'ซ่อน'} ${label}`, 'tree-action', () => editor.setItemVisibility(type, item.id, item.visible === false)));
  row.appendChild(actionButton(item.locked ? '🔒' : '🔓', `${item.locked ? 'ปลดล็อก' : 'ล็อก'} ${label}`, 'tree-action', () => editor.setItemLocked(type, item.id, !item.locked)));
  const rename = actionButton('✎', `เปลี่ยนชื่อ ${label}`, 'tree-action', async () => {
    const name = await askName(`เปลี่ยนชื่อ ${label}`, item.name || item.asset);
    if (name == null || !name.trim()) return;
    if (type === 'layer') editor.renameLayer(item.id, name);
    else if (type === 'group') editor.renameGroup(item.id, name);
    else editor.renameObject(item.id, name);
  });
  rename.disabled = editor.isItemLocked(type, item.id);
  row.appendChild(rename);
  if (type === 'layer' && item.id !== 'layer-default') {
    const remove = actionButton('×', `ลบ ${label} และย้าย object ไป Default Layer`, 'tree-action danger', async () => {
      if (await askConfirmation(`ลบ ${item.name}`, 'object ใน layer นี้จะย้ายไป Default Layer', 'ลบ Layer')) editor.deleteLayer(item.id);
    });
    remove.disabled = editor.isItemLocked('layer', item.id);
    row.appendChild(remove);
  } else if (type === 'group') {
    const nonUniform = item.scale.some((value) => Math.abs(value - item.scale[0]) > 1e-5);
    const ungroup = actionButton('↗', nonUniform ? 'ตั้งสเกล Group เป็น 1:1:1 ก่อน Ungroup' : `Ungroup ${item.name}`, 'tree-action', () => editor.ungroup(item.id));
    ungroup.disabled = editor.isItemLocked('group', item.id) || nonUniform;
    row.appendChild(ungroup);
  } else if (type === 'object') {
    const remove = actionButton('×', `ลบ ${label}`, 'tree-action danger', () => {
      selectedObjectIds.delete(item.id);
      editor.deleteObject(item.id);
    });
    remove.disabled = editor.isItemLocked('object', item.id);
    row.appendChild(remove);
  }
  return row;
}

function childrenOfLayer(layerId) {
  const groups = editor.getGroups().filter((group) => group.layerId === layerId).map((item) => ({ type: 'group', ...item }));
  const objects = editor.getObjects().filter((object) => object.layerId === layerId && !object.groupId).map((item) => ({ type: 'object', ...item }));
  return [...groups, ...objects].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function childrenOfGroup(groupId) {
  return editor.getObjects().filter((object) => object.groupId === groupId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function canDropOn(source, targetType, target) {
  if (!source || source.type === targetType && source.id === target.id) return false;
  if (source.type !== 'layer' && editor.isItemLocked(source.type, source.id)) return false;
  const sourceObject = source.type === 'object' ? editor.getObjects().find((object) => object.id === source.id) : null;
  const sameParent = sourceObject && sourceObject.layerId === target.layerId
    && (sourceObject.groupId || null) === (target.groupId || (targetType === 'group' ? target.id : null));
  if (sourceObject && !editor.isItemTransformable(source.type, source.id) && !sameParent) return false;
  if (targetType === 'layer' && editor.isItemLocked('layer', target.id)) return false;
  if (targetType === 'group' && editor.isItemLocked('group', target.id)) return false;
  if (targetType === 'group' && target.scale.some((value) => Math.abs(value - target.scale[0]) > 1e-5)
    && sourceObject?.groupId !== target.id) return false;
  if (targetType === 'object' && (editor.isItemLocked('layer', target.layerId)
    || (target.groupId && editor.isItemLocked('group', target.groupId)))) return false;
  if (source.type === 'layer') return targetType === 'layer';
  if (source.type === 'group') {
    if (targetType === 'layer' || targetType === 'group') return true;
    return targetType === 'object' && !target.groupId;
  }
  return targetType === 'layer' || targetType === 'group' || targetType === 'object';
}

function dropOn(source, targetType, target) {
  if (source.type === 'layer') return editor.reorderLayer(source.id, target.id);
  if (source.type === 'group') {
    if (targetType === 'layer') return editor.moveGroup(source.id, target.id);
    if (targetType === 'group') return editor.moveGroup(source.id, target.layerId, target.id);
    return editor.moveGroup(source.id, target.layerId, target.id);
  }
  if (targetType === 'layer') return editor.moveObject(source.id, target.id, null);
  if (targetType === 'group') return editor.moveObject(source.id, target.layerId, target.id);
  return editor.moveObject(source.id, target.layerId, target.groupId || null, target.id);
}

function renderLayerTree() {
  if (!treeEl) return;
  const scrollTop = treeEl.scrollTop;
  treeEl.replaceChildren();
  for (const layer of editor.getLayers()) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-layer';
    wrapper.setAttribute('role', 'listitem');
    wrapper.appendChild(treeNodeRow('layer', layer));
    if (!collapsedNodes.has(layer.id)) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      children.setAttribute('role', 'list');
      for (const item of childrenOfLayer(layer.id)) {
        if (item.type === 'object') children.appendChild(treeNodeRow('object', item, 1));
        else {
          const groupWrap = document.createElement('div');
          groupWrap.setAttribute('role', 'listitem');
          groupWrap.appendChild(treeNodeRow('group', item, 1));
          if (!collapsedNodes.has(item.id)) {
            const groupChildren = document.createElement('div');
            groupChildren.className = 'tree-children';
            groupChildren.setAttribute('role', 'list');
            for (const object of childrenOfGroup(item.id)) groupChildren.appendChild(treeNodeRow('object', object, 2));
            groupWrap.appendChild(groupChildren);
          }
          children.appendChild(groupWrap);
        }
      }
      wrapper.appendChild(children);
    }
    treeEl.appendChild(wrapper);
  }
  treeEl.scrollTop = scrollTop;
  updateGroupButton();
}

function updateGroupButton() {
  const objects = new Set(editor.getObjects().map((object) => object.id));
  for (const id of selectedObjectIds) if (!objects.has(id)) selectedObjectIds.delete(id);
  const activeLayer = editor.getLayers().find((layer) => layer.id === editor.getActiveLayerId());
  document.getElementById('btn-group').disabled = selectedObjectIds.size < 2 || !!activeLayer?.locked
    || [...selectedObjectIds].some((id) => !editor.isItemTransformable('object', id));
  const selected = editor.getSelected();
  const selectedGroupNonUniform = selected?.type === 'group' && selected.scale.some((value) => Math.abs(value - selected.scale[0]) > 1e-5);
  const canDeleteSelected = selected && !editor.isItemLocked(selected.type, selected.id) && !selectedGroupNonUniform;
  const canDeleteChecked = selectedObjectIds.size > 0 && [...selectedObjectIds].every((id) => !editor.isItemLocked('object', id));
  document.getElementById('btn-delete').disabled = !canDeleteSelected && !canDeleteChecked;
}

document.getElementById('btn-layer').onclick = async () => {
  const name = await askName('สร้าง Layer', `Layer ${editor.getLayers().length}`);
  if (!name) return;
  const id = editor.createLayer(name);
  editor.setActiveLayer(id);
  renderLayerTree();
};

document.getElementById('btn-group').onclick = async () => {
  const ids = [...selectedObjectIds];
  if (ids.length < 2) return;
  const name = await askName('จัด object เป็น Group', 'Group');
  if (!name) return;
  const group = editor.createGroup(ids, name);
  if (group) {
    selectedObjectIds.clear();
    editor.selectItem('group', group.id);
    renderLayerTree();
    syncPanel();
  }
};

document.getElementById('btn-delete').onclick = () => {
  if (selectedObjectIds.size) {
    const ids = [...selectedObjectIds];
    if (ids.some((id) => editor.isItemLocked('object', id))) return;
    selectedObjectIds.clear();
    suppressHistory = true;
    try { for (const id of ids) editor.deleteObject(id); }
    finally { suppressHistory = false; }
    history.record(mapContent());
    updateHistoryButtons();
    updateGroupButton();
  } else editor.deleteSelected();
};

renderLayerTree();
syncPanel();
updateInspectorLock();

for (const input of Object.values(propFields)) {
  input.addEventListener('input', () => {
    if (!editor.getSelected()) return;
    const number = (field, fallback) => parseFloat(field.value) || fallback;
    suppressHistory = true;
    try {
      editor.setSelectedTransform({
        pos: [number(propFields.posX, 0), number(propFields.posY, 0), number(propFields.posZ, 0)],
        rotY: number(propFields.rotY, 0),
        scale: [number(propFields.scaleX, 1), number(propFields.scaleY, 1), number(propFields.scaleZ, 1)],
      });
      if (editor.getSelected()?.type === 'group') {
        const scale = editor.getSelectedTransform().scale;
        for (const [index, key] of ['scaleX', 'scaleY', 'scaleZ'].entries()) propFields[key].value = scale[index];
      }
    } finally {
      suppressHistory = false;
    }
  });
  input.addEventListener('change', () => {
    if (!editor.getSelected()) return;
    history.record(mapContent());
    updateHistoryButtons();
    syncPanel();
  });
}

document.getElementById('rot-90').onclick = () => { editor.rotateSelected90(); syncPanel(); };
document.getElementById('scale-reset').onclick = () => {
  const transform = editor.getSelectedTransform();
  if (!transform) return;
  editor.setSelectedTransform({ ...transform, scale: [1, 1, 1] });
  syncPanel();
};
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
    btn.onclick = () => {
      const activeLayer = editor.getLayers().find((layer) => layer.id === editor.getActiveLayerId());
      if (activeLayer?.locked) return toast(`ปลดล็อก ${activeLayer.name} ก่อนวาง object`);
      void editor.setPlace(packId, item.name);
    };
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
if (saved) {
  const { missing } = await editor.loadObjects(saved.objects, saved.layers, saved.groups);
  spawn = { pos: [...saved.spawn.pos], rotY: saved.spawn.rotY };
  updateSpawnMarker();
  selectedObjectIds.clear();
  collapsedNodes.clear();
  renderLayerTree();
  syncPanel();
  updateInspectorLock();
  mapNameInput.value = saved.mapName || 'my-village';
  history.reset(mapContent());
  updateHistoryButtons();
  toast(`กู้คืน autosave ${saved.objects.length - missing.length} ชิ้น${missing.length ? ` (ข้าม ${missing.length})` : ''} — กด "ใหม่" เพื่อเริ่มใหม่`);
}

let previousFrameTime = 0;
renderer.setAnimationLoop((time) => {
  const delta = previousFrameTime ? (time - previousFrameTime) / 1000 : 0;
  previousFrameTime = time;
  if (play.isActive()) {
    play.update(delta);
    renderer.render(play.scene, play.camera);
    return;
  }
  cam.controls.update();
  renderer.render(scene, cam.camera);
});
