import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEditor } from '../src/editor.js';

class Events {
  listeners = new Map();
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  dispatch(type, event) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}

function setup() {
  globalThis.window = new Events();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 8, 12);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const dom = Object.assign(new Events(), {
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    setPointerCapture() {},
  });
  const controls = { enabled: true, mouseButtons: { LEFT: THREE.MOUSE.ROTATE }, touches: {} };
  const catalog = {
    has: () => true,
    async loadModel() {
      const model = new THREE.Group();
      model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()));
      return model;
    },
  };
  let changes = 0;
  const editor = createEditor({ scene, camera, controls, dom, catalog, onChange: () => changes++, onSelection: () => {} });
  const load = (objects, layers, groups) => editor.loadObjects(objects, layers, groups);
  const runtime = (id) => {
    let inst;
    scene.traverse((node) => { if (node.userData.editorRoot?.id === id) inst = node.userData.editorRoot; });
    return inst;
  };
  const world = (id) => {
    const node = runtime(id).obj;
    node.updateWorldMatrix(true, false);
    const pos = node.getWorldPosition(new THREE.Vector3()).toArray();
    const quat = node.getWorldQuaternion(new THREE.Quaternion());
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    const scale = node.getWorldScale(new THREE.Vector3()).toArray();
    return { pos, rotY: THREE.MathUtils.radToDeg(euler.y), scale };
  };
  const pointer = (type, x, y, pointerType = 'mouse') => {
    const event = { button: 0, pointerId: 1, pointerType, clientX: x, clientY: y };
    if (type === 'pointerdown') dom.dispatch(type, event);
    else window.dispatch(type, event);
  };
  const groundAt = (x, y) => {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x / 50 - 1, 1 - y / 50), camera);
    return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  };
  const close = () => editor.clear();
  return { editor, scene, camera, controls, load, runtime, world, pointer, groundAt, get changes() { return changes; }, close };
}

const item = (id, pos, rotY = 0) => ({
  id, pack: 'test', asset: id, name: id, layerId: 'layer-default',
  pos, rotY, scale: [1, 1, 1], visible: true, locked: false, order: 0,
});

function assertWorldEqual(a, b) {
  const expected = JSON.stringify({ actual: a, expected: b });
  assert.ok(new THREE.Vector3(...a.pos).distanceTo(new THREE.Vector3(...b.pos)) < 1e-5, expected);
  assert.ok(Math.abs(a.rotY - b.rotY) < 1e-5, expected);
  assert.ok(new THREE.Vector3(...a.scale).distanceTo(new THREE.Vector3(...b.scale)) < 1e-5, expected);
}

test('grouping preserves selected objects world transforms', async () => {
  const h = setup();
  await h.load([item('one', [-2, 0, 1], 25), item('two', [3, 0, -4], 135)]);
  const before = ['one', 'two'].map(h.world);
  const group = h.editor.createGroup(['one', 'two'], 'Pair');
  assert.ok(group.id);
  ['one', 'two'].forEach((id, i) => assertWorldEqual(h.world(id), before[i]));
  h.close();
});

test('group transform updates child world transforms', async () => {
  const h = setup();
  await h.load([item('one', [1, 0, 2], 15), item('two', [4, 0, 2], 90)]);
  const group = h.editor.createGroup(['one', 'two'], 'Pair');
  h.editor.selectItem('group', group.id);
  assert.equal(h.editor.getSelected().type, 'group');
  const before = h.world('one');
  const transform = h.editor.getSelectedTransform();
  h.editor.setSelectedTransform({ ...transform, pos: [transform.pos[0] + 5, transform.pos[1], transform.pos[2] - 3] });
  const after = h.world('one');
  assert.ok(Math.abs(after.pos[0] - before.pos[0] - 5) < 1e-5);
  assert.ok(Math.abs(after.pos[2] - before.pos[2] + 3) < 1e-5);
  h.close();
});

test('ungroup preserves child world transforms after group transforms', async () => {
  const h = setup();
  await h.load([item('one', [-1, 0, 3], 20), item('two', [2, 0, -2], 160)]);
  const group = h.editor.createGroup(['one', 'two'], 'Pair');
  h.editor.selectItem('group', group.id);
  h.editor.setSelectedTransform({ pos: [5, 0, -2], rotY: 90, scale: [2, 2, 2] });
  const before = ['one', 'two'].map(h.world);
  h.editor.ungroup(group.id);
  ['one', 'two'].forEach((id, i) => assertWorldEqual(h.world(id), before[i]));
  h.close();
});

test('group scaling stays uniform so ungroup can preserve rotated children', async () => {
  const h = setup();
  await h.load([item('one', [1, 0, 2], 35), item('two', [4, 0, 1], 70)]);
  const group = h.editor.createGroup(['one', 'two'], 'Pair');
  h.editor.selectItem('group', group.id);
  h.editor.setSelectedTransform({ ...h.editor.getSelectedTransform(), scale: [3, 4, 5] });
  h.editor.getSelectedTransform().scale.forEach((value) => assert.ok(Math.abs(value - 3) < 1e-5));
  const before = h.world('one');
  h.editor.ungroup(group.id);
  assertWorldEqual(h.world('one'), before);
  h.close();
});

test('loading a non-uniform Group keeps its saved child world transform', async () => {
  const h = setup();
  const parent = new THREE.Group();
  parent.position.set(2, 0, -1);
  parent.rotation.y = THREE.MathUtils.degToRad(40);
  parent.scale.set(2, 3, 4);
  const child = new THREE.Group();
  child.position.set(1, 0, 2);
  child.rotation.y = THREE.MathUtils.degToRad(35);
  child.scale.set(1, 2, 1);
  parent.add(child);
  parent.updateWorldMatrix(true, true);
  const worldPos = child.getWorldPosition(new THREE.Vector3()).toArray();
  const worldRot = THREE.MathUtils.radToDeg(new THREE.Euler().setFromQuaternion(child.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y);
  const worldScale = child.getWorldScale(new THREE.Vector3()).toArray();
  await h.load([
    { ...item('one', [1, 0, 2], 35), groupId: 'group-one', scale: [1, 2, 1] },
    { ...item('two', [-2, 0, 1], 70), groupId: 'group-one', scale: [1, 1, 2] },
  ], undefined, [{
    id: 'group-one', name: 'Pair', layerId: 'layer-default', pos: [2, 0, -1], rotY: 40,
    scale: [2, 3, 4], visible: true, locked: false, order: 0,
  }]);
  assert.deepEqual(h.editor.getGroups()[0].scale, [2, 3, 4]);
  assertWorldEqual(h.world('one'), { pos: worldPos, rotY: worldRot, scale: worldScale });
  h.editor.selectItem('group', 'group-one');
  const transform = h.editor.getSelectedTransform();
  h.editor.setSelectedTransform({ ...transform, pos: [transform.pos[0] + 1, transform.pos[1], transform.pos[2]] });
  assert.deepEqual(h.editor.getSelectedTransform().scale, [2, 3, 4]);
  h.editor.selectItem('object', 'one');
  const beforeMove = h.world('one');
  assert.equal(h.editor.isItemTransformable('object', 'one'), false);
  assert.equal(h.editor.setSelectedTransform({ ...beforeMove, pos: [50, 0, 50] }), false);
  assertWorldEqual(h.world('one'), beforeMove);
  assert.equal(h.editor.moveObject('one', 'layer-default'), false);
  assertWorldEqual(h.world('one'), beforeMove);
  assert.equal(h.editor.createGroup(['one', 'two'], 'Nested'), null);
  assert.equal(h.editor.ungroup('group-one'), false);
  h.editor.selectItem('group', 'group-one');
  h.editor.setSelectedTransform({ ...h.editor.getSelectedTransform(), scale: [1, 1, 1] });
  const beforeUngroup = h.world('two');
  h.editor.ungroup('group-one');
  assertWorldEqual(h.world('two'), beforeUngroup);
  h.close();
});

test('reparenting an object preserves world transform', async () => {
  const h = setup();
  await h.load([item('one', [-2, 0, 1], 25), item('two', [3, 0, -4], 135)]);
  const first = h.editor.createGroup(['one'], 'First');
  const second = h.editor.createGroup(['two'], 'Second');
  h.editor.selectItem('group', first.id);
  h.editor.setSelectedTransform({ pos: [4, 0, 6], rotY: 35, scale: [1.5, 1.5, 1.5] });
  const before = h.world('one');
  h.editor.moveObject('one', 'layer-default', second.id);
  assertWorldEqual(h.world('one'), before);
  h.close();
});

test('parent visibility hides descendants and parent lock rejects transforms', async () => {
  const h = setup();
  await h.load([item('one', [1, 0, 2])]);
  const group = h.editor.createGroup(['one'], 'Pair');
  h.editor.setItemVisibility('group', group.id, false);
  assert.equal(h.editor.getGroups().find((g) => g.id === group.id).visible, false);
  assert.equal(h.editor.getObjects()[0].visible, true);
  h.editor.setItemLocked('group', group.id, true);
  h.editor.selectItem('object', 'one');
  const before = h.world('one');
  assert.equal(h.editor.setSelectedTransform({ pos: [50, 0, 50], rotY: 0, scale: [1, 1, 1] }), false);
  assertWorldEqual(h.world('one'), before);
  h.close();
});

test('ungroup restores child visibility after removing a hidden parent', async () => {
  const h = setup();
  await h.load([item('one', [1, 0, 2])]);
  const group = h.editor.createGroup(['one'], 'Pair');
  h.editor.setItemVisibility('group', group.id, false);
  assert.equal(h.runtime('one').obj.visible, false);
  h.editor.ungroup(group.id);
  assert.equal(h.runtime('one').obj.visible, true);
  h.close();
});

test('locked ancestors reject structural edits and locked layers reject placement', async () => {
  const h = setup();
  await h.load([item('one', [1, 0, 2]), item('two', [3, 0, 4])]);
  const group = h.editor.createGroup(['one', 'two'], 'Pair');
  h.editor.setItemLocked('group', group.id, true);
  assert.equal(h.editor.isItemLocked('object', 'one'), true);
  assert.equal(h.editor.renameObject('one', 'Renamed'), false);
  assert.equal(h.editor.deleteObject('one'), false);
  assert.equal(h.editor.moveObject('one', 'layer-default'), false);
  assert.equal(h.editor.ungroup(group.id), false);
  h.editor.setItemLocked('group', group.id, false);
  h.editor.setItemLocked('layer', 'layer-default', true);
  assert.equal(await h.editor.setPlace('test', 'new'), false);
  assert.equal(h.editor.getObjects().length, 2);
  h.close();
});

test('deleting a layer preserves descendants in Default Layer', async () => {
  const h = setup();
  await h.load([item('one', [1, 0, 2])]);
  const layerId = h.editor.createLayer('Upper');
  h.editor.moveObject('one', layerId);
  h.editor.setActiveLayer(layerId);
  const group = h.editor.createGroup(['one'], 'Pair');
  h.editor.deleteLayer(layerId);
  assert.equal(h.editor.getObjects().length, 1);
  assert.equal(h.editor.getObjects()[0].layerId, 'layer-default');
  assert.equal(h.editor.getGroups().find((g) => g.id === group.id).layerId, 'layer-default');
  h.close();
});

test('reordering changes tree order only', async () => {
  const h = setup();
  await h.load([item('one', [-2, 0, 0]), item('two', [2, 0, 0])]);
  const before = ['one', 'two'].map(h.world);
  const renderOrder = () => h.scene.children[0].children.map((node) => node.userData.editorRoot.id);
  const beforeRenderOrder = renderOrder();
  h.editor.moveObject('two', 'layer-default', undefined, 'one');
  assert.deepEqual(h.editor.getObjects().map((o) => o.id), ['two', 'one']);
  assert.deepEqual(renderOrder(), beforeRenderOrder);
  h.editor.moveObject('one', 'layer-default', undefined, 'two');
  assert.deepEqual(renderOrder(), beforeRenderOrder);
  ['one', 'two'].forEach((id, i) => assertWorldEqual(h.world(id), before[i]));
  h.close();
});

test('renaming an object preserves asset identity', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0])]);
  h.editor.renameObject('one', 'New label');
  assert.equal(h.editor.getObjects()[0].name, 'New label');
  assert.equal(h.editor.getObjects()[0].asset, 'one');
  h.close();
});

test('new layer and group IDs do not collide with loaded IDs', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0])],
    [{ id: 'layer-default', name: 'Default Layer', visible: true, locked: false }, { id: 'layer-1', name: 'Loaded', visible: true, locked: false }],
    [{ id: 'group-1', name: 'Loaded Group', layerId: 'layer-default', pos: [0, 0, 0], rotY: 0, scale: [1, 1, 1], visible: true, locked: false, order: 0 }]);
  const layerId = h.editor.createLayer('New');
  const group = h.editor.createGroup(['one'], 'New Group');
  assert.notEqual(layerId, 'layer-1');
  assert.notEqual(group.id, 'group-1');
  assert.equal(new Set([...h.editor.getLayers().map((row) => row.id), ...h.editor.getGroups().map((row) => row.id), ...h.editor.getObjects().map((row) => row.id)]).size,
    h.editor.getLayers().length + h.editor.getGroups().length + h.editor.getObjects().length);
  h.close();
});

test('new placements use the active layer and append after its current children', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0])]);
  const layerId = h.editor.createLayer('Upper');
  h.editor.moveObject('one', layerId);
  h.editor.setActiveLayer(layerId);
  await h.editor.setPlace('test', 'placed');
  h.pointer('pointerdown', 50, 50);
  h.pointer('pointerup', 50, 50);
  await new Promise((resolve) => setImmediate(resolve));
  const placed = h.editor.getObjects().find((object) => object.asset === 'placed');
  assert.equal(placed.layerId, layerId);
  assert.equal(placed.order, 1);
  h.close();
});

test('Pan tool moves the view without selecting or moving objects', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0])]);
  const before = h.world('one');
  h.editor.setTool('pan');
  assert.equal(h.controls.mouseButtons.LEFT, THREE.MOUSE.PAN);
  h.pointer('pointerdown', 50, 50);
  h.pointer('pointermove', 60, 55);
  h.pointer('pointerup', 60, 55);
  assert.equal(h.editor.getSelected(), null);
  assertWorldEqual(h.world('one'), before);
  h.close();
});

test('Move tool drags only the selected object', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0]), item('two', [4, 0, 0])]);
  h.editor.selectItem('object', 'one');
  h.editor.setTool('move');
  const before = h.world('one');
  const other = h.world('two');
  const from = h.groundAt(53, 50);
  const to = h.groundAt(63, 50);
  h.pointer('pointerdown', 53, 50);
  h.pointer('pointermove', 63, 50);
  h.pointer('pointerup', 63, 50);
  const after = h.world('one');
  assert.ok(Math.abs(after.pos[0] - before.pos[0] - (to.x - from.x)) < 0.02, JSON.stringify({ before, after, from, to }));
  assert.ok(Math.abs(after.pos[2] - before.pos[2] - (to.z - from.z)) < 0.02, JSON.stringify({ before, after, from, to }));
  assertWorldEqual(h.world('two'), other);
  assert.equal(h.changes, 1);
  h.close();
});

test('sub-threshold Move gestures do not change transforms or emit edits', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0])]);
  h.editor.selectItem('object', 'one');
  h.editor.setTool('move');
  const before = h.world('one');
  h.pointer('pointerdown', 53, 50);
  h.pointer('pointermove', 55, 50);
  h.pointer('pointerup', 55, 50);
  assertWorldEqual(h.world('one'), before);
  assert.equal(h.changes, 0);
  h.close();
});

test('Move tool drags a selected group as one unit', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0]), item('two', [2, 0, 0])]);
  const group = h.editor.createGroup(['one', 'two'], 'Pair');
  h.editor.selectItem('group', group.id);
  h.editor.setTool('move');
  const beforeOne = h.world('one');
  const beforeTwo = h.world('two');
  const from = h.groundAt(53, 50);
  const to = h.groundAt(63, 50);
  h.pointer('pointerdown', 53, 50);
  h.pointer('pointermove', 63, 50);
  h.pointer('pointerup', 63, 50);
  const afterOne = h.world('one');
  const afterTwo = h.world('two');
  assert.ok(Math.abs(afterOne.pos[0] - beforeOne.pos[0] - (to.x - from.x)) < 0.02, JSON.stringify({ beforeOne, afterOne, from, to }));
  assert.ok(Math.abs(afterOne.pos[2] - beforeOne.pos[2] - (to.z - from.z)) < 0.02, JSON.stringify({ beforeOne, afterOne, from, to }));
  assert.ok(Math.abs(afterTwo.pos[0] - beforeTwo.pos[0] - (to.x - from.x)) < 0.02, JSON.stringify({ beforeTwo, afterTwo, from, to }));
  assert.ok(Math.abs(afterTwo.pos[2] - beforeTwo.pos[2] - (to.z - from.z)) < 0.02, JSON.stringify({ beforeTwo, afterTwo, from, to }));
  assert.equal(h.editor.getSelected().id, group.id);
  h.close();
});

test('pointercancel restores an interrupted touch movement', async () => {
  const h = setup();
  await h.load([item('one', [0, 0, 0])]);
  h.editor.selectItem('object', 'one');
  h.editor.setTool('move');
  const before = h.world('one');
  h.pointer('pointerdown', 50, 50, 'touch');
  h.pointer('pointermove', 60, 50, 'touch');
  window.dispatch('pointercancel', { pointerId: 1, pointerType: 'touch', clientX: 60, clientY: 50 });
  assertWorldEqual(h.world('one'), before);
  assert.equal(h.changes, 0);
  h.close();
});
