import * as THREE from 'three';
import { quantizeRotY, SNAP_SIZE } from './lib.js';

const CLICK_SLOP = 6;
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const HIGHLIGHT = 0x442200;
const DEFAULT_LAYER = { id: 'layer-default', name: 'Default Layer', visible: true, locked: false };

export function createEditor({ scene, camera, controls, dom, catalog, onChange, onSelection }) {
  const root = new THREE.Group();
  scene.add(root);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let layers = [{ ...DEFAULT_LAYER }];
  let objects = [];
  let groups = [];
  let activeLayerId = DEFAULT_LAYER.id;
  let nextId = 1;
  let snap = false;
  let tool = 'select';
  let placing = null;
  let ghost = null;
  let selected = null;
  let dragging = null;
  let dragStart = null;
  let downPos = null;
  let controlsWasEnabled = true;
  let enabled = true;

  const round = (v) => {
    const quantum = snap ? SNAP_SIZE : 0.01;
    return parseFloat((Math.round(v / quantum) * quantum).toFixed(2));
  };
  const next = (prefix) => {
    let id;
    do { id = `${prefix}-${nextId++}`; }
    while (layers.some((item) => item.id === id) || groups.some((item) => item.id === id) || objects.some((item) => item.id === id));
    return id;
  };
  const layerById = (id) => layers.find((layer) => layer.id === id);
  const groupById = (id) => groups.find((group) => group.id === id);
  const objectById = (id) => objects.find((object) => object.id === id);
  const isUniformScale = (scale) => Math.abs(scale.x - scale.y) < 1e-5 && Math.abs(scale.x - scale.z) < 1e-5;

  function setPointer(e) {
    const rect = dom.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }

  function groundPoint(e) {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(GROUND_PLANE, new THREE.Vector3());
  }

  function worldTransform(node) {
    node.updateWorldMatrix(true, false);
    const position = node.getWorldPosition(new THREE.Vector3());
    const quaternion = node.getWorldQuaternion(new THREE.Quaternion());
    const rotation = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    const scale = node.getWorldScale(new THREE.Vector3());
    return {
      pos: position.toArray(),
      rotY: THREE.MathUtils.radToDeg(rotation.y),
      scale: scale.toArray(),
    };
  }

  function setWorldTransform(node, transform) {
    const position = new THREE.Vector3(...transform.pos);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(transform.rotY ?? 0), 0, 'YXZ'));
    const scale = new THREE.Vector3(...(transform.scale ?? [1, 1, 1]));
    const matrix = new THREE.Matrix4().compose(position, rotation, scale);
    if (node.parent) {
      node.parent.updateWorldMatrix(true, false);
      const local = node.parent.matrixWorld.clone().invert().multiply(matrix);
      local.decompose(node.position, node.quaternion, node.scale);
      node.rotation.setFromQuaternion(node.quaternion, 'YXZ');
    } else {
      node.position.copy(position);
      node.rotation.setFromQuaternion(rotation, 'YXZ');
      node.scale.copy(scale);
    }
    node.updateMatrixWorld(true);
  }

  function objectRoot(node) {
    let current = node;
    while (current && !current.userData.editorRoot) current = current.parent;
    return current?.userData.editorRoot ?? null;
  }

  function itemNode(type, id) {
    return type === 'group' ? groupById(id)?.obj : objectById(id)?.obj;
  }

  function selectedRecord() {
    if (!selected) return null;
    const record = selected.type === 'group' ? groupById(selected.id) : objectById(selected.id);
    return record ? { ...record, type: selected.type } : null;
  }

  function notifySelection() {
    onSelection(selectedRecord());
  }

  function isItemLocked(type, id) {
    if (type === 'layer') {
      const layer = layerById(id);
      return !layer || layer.locked;
    }
    const item = type === 'group' ? groupById(id) : objectById(id);
    return !item || item.locked || isItemLocked('layer', item.layerId)
      || (type === 'object' && item.groupId && isItemLocked('group', item.groupId));
  }

  function isItemTransformable(type, id) {
    if (isItemLocked(type, id)) return false;
    const object = type === 'object' && objectById(id);
    const group = object?.groupId && groupById(object.groupId);
    return !group || isUniformScale(group.obj.scale);
  }

  function selectedLocked() {
    return !selected || !isItemTransformable(selected.type, selected.id);
  }

  function applyHighlight(object, on) {
    object.obj.traverse((node) => {
      if (!node.isMesh || !node.material?.emissive) return;
      if (on) {
        node.material.userData.origEmissive = node.material.emissive.getHex();
        node.material.emissive.setHex(HIGHLIGHT);
      } else if (node.material.userData.origEmissive !== undefined) {
        node.material.emissive.setHex(node.material.userData.origEmissive);
        delete node.material.userData.origEmissive;
      }
    });
  }

  function clearHighlight() {
    if (!selected || selected.type !== 'object') return;
    const object = objectById(selected.id);
    if (object) applyHighlight(object, false);
  }

  function selectItem(type, id) {
    if (!itemNode(type, id)) return false;
    if (selected?.type === type && selected.id === id) return true;
    clearHighlight();
    selected = { type, id };
    if (type === 'object') applyHighlight(objectById(id), true);
    notifySelection();
    return true;
  }

  function deselect() {
    if (!selected) return;
    clearHighlight();
    selected = null;
    notifySelection();
  }

  function effectiveVisibility(layerId, groupId, visible) {
    return visible !== false && layerById(layerId)?.visible !== false && (!groupId || groupById(groupId)?.visible !== false);
  }

  function applyVisibility() {
    for (const group of groups) group.obj.visible = group.visible && layerById(group.layerId)?.visible !== false;
    for (const object of objects) object.obj.visible = effectiveVisibility(object.layerId, object.groupId, object.visible);
  }

  function layerChildren(layerId) {
    return [
      ...groups.filter((group) => group.layerId === layerId).map((item) => ({ type: 'group', id: item.id, order: item.order, item })),
      ...objects.filter((object) => object.layerId === layerId && !object.groupId).map((item) => ({ type: 'object', id: item.id, order: item.order, item })),
    ].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function groupChildren(groupId) {
    return objects.filter((object) => object.groupId === groupId)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function renumber(items) { items.forEach((row, index) => { row.item.order = index; }); }

  function reorderInLayer(layerId, id, beforeId) {
    const children = layerChildren(layerId);
    const index = children.findIndex((row) => row.id === id);
    if (index < 0) return false;
    const [moving] = children.splice(index, 1);
    const before = beforeId == null ? -1 : children.findIndex((row) => row.id === beforeId);
    children.splice(before < 0 ? children.length : before, 0, moving);
    renumber(children);
    return true;
  }

  function reorderInGroup(groupId, id, beforeId) {
    const children = groupChildren(groupId).map((item) => ({ id: item.id, item }));
    const index = children.findIndex((row) => row.id === id);
    if (index < 0) return false;
    const [moving] = children.splice(index, 1);
    const before = beforeId == null ? -1 : children.findIndex((row) => row.id === beforeId);
    children.splice(before < 0 ? children.length : before, 0, moving);
    renumber(children);
    return true;
  }

  function cleanEmptyGroup(id) {
    const group = groupById(id);
    if (!group || groupChildren(id).length) return;
    root.remove(group.obj);
    groups = groups.filter((item) => item !== group);
    reorderInLayer(group.layerId, group.id, null);
  }

  async function addInstance(entry) {
    const object3d = await catalog.loadModel(entry.pack, entry.asset);
    const object = {
      id: entry.id || next('object'),
      pack: entry.pack,
      asset: entry.asset,
      name: entry.name || String(entry.asset),
      layerId: entry.layerId || activeLayerId,
      groupId: entry.groupId,
      pos: entry.pos,
      rotY: entry.rotY,
      scale: entry.scale,
      visible: entry.visible !== false,
      locked: entry.locked === true,
      order: entry.order,
      obj: object3d,
    };
    object3d.userData.editorRoot = object;
    object3d.position.set(...(entry.pos ?? [0, 0, 0]));
    object3d.rotation.y = THREE.MathUtils.degToRad(entry.rotY ?? 0);
    object3d.scale.set(...(entry.scale ?? [1, 1, 1]));
    const parent = object.groupId ? groupById(object.groupId)?.obj : root;
    if (!parent || !layerById(object.layerId)) {
      object.groupId = undefined;
      object.layerId = activeLayerId;
      object.order = Number.isFinite(entry.order) ? entry.order : layerChildren(activeLayerId).length;
      root.add(object3d);
    } else {
      object.order = Number.isFinite(entry.order) ? entry.order : object.groupId ? groupChildren(object.groupId).length : layerChildren(object.layerId).length;
      parent.add(object3d);
    }
    objects.push(object);
    applyVisibility();
    return object;
  }

  async function setPlace(pack, asset) {
    if (isItemLocked('layer', activeLayerId)) return false;
    cancelPlace();
    const entry = { pack, asset };
    placing = entry;
    const model = await catalog.loadModel(pack, asset);
    if (placing !== entry) return;
    model.traverse((node) => {
      if (node.isMesh) {
        node.material.transparent = true;
        node.material.opacity = 0.5;
        node.material.depthWrite = false;
      }
    });
    model.visible = false;
    ghost = model;
    scene.add(ghost);
  }

  function cancelPlace() {
    if (ghost) scene.remove(ghost);
    ghost = null;
    placing = null;
  }

  function hitAt(e) {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(root.children, true);
    if (!hits.length) return null;
    const object = objectRoot(hits[0].object);
    return object ? { type: 'object', id: object.id } : null;
  }

  function setTool(nextTool) {
    if (!['select', 'pan', 'move'].includes(nextTool)) throw new Error(`unknown editor tool: ${nextTool}`);
    tool = nextTool;
    controls.mouseButtons ??= {};
    controls.mouseButtons.LEFT = tool === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches ??= {};
    controls.touches.ONE = tool === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    return tool;
  }

  function beginDrag(type, id, e) {
    if (type === 'object' && (selected?.type !== 'object' || selected.id !== id)) return false;
    if (type === 'group' && (selected?.type !== 'group' || selected.id !== id)) return false;
    if (selectedLocked()) return false;
    dragStart = worldTransform(itemNode(type, id));
    const point = groundPoint(e);
    dragging = {
      type, id,
      offset: point ? { x: dragStart.pos[0] - point.x, z: dragStart.pos[2] - point.z } : { x: 0, z: 0 },
    };
    controlsWasEnabled = controls.enabled;
    controls.enabled = false;
    dom.style.cursor = 'grabbing';
    try { dom.setPointerCapture(e.pointerId); } catch { /* pointer already ended */ }
    return true;
  }

  function attachPreservingTransform(node, parent) {
    const transform = worldTransform(node);
    root.updateMatrixWorld(true);
    parent.attach(node);
    setWorldTransform(node, transform);
  }

  function onPointerDown(e) {
    if (!enabled) return;
    if (e.button !== 0) return;
    downPos = { x: e.clientX, y: e.clientY };
    controlsWasEnabled = controls.enabled;
    if (placing || tool === 'pan') return;
    const hit = hitAt(e);
    if (!hit) return;
    if (tool === 'move' && selected?.type === 'group' && objectById(hit.id)?.groupId === selected.id) {
      beginDrag('group', selected.id, e);
      return;
    }
    const wasSelected = selected?.type === hit.type && selected.id === hit.id;
    selectItem(hit.type, hit.id);
    if (tool === 'move' && wasSelected && beginDrag(hit.type, hit.id, e)) return;
    controls.enabled = false;
    try { dom.setPointerCapture(e.pointerId); } catch { /* pointer already ended */ }
  }

  function onPointerMove(e) {
    if (!enabled) return;
    if (placing && ghost) {
      if (isItemLocked('layer', activeLayerId)) {
        cancelPlace();
        return;
      }
      const point = groundPoint(e);
      if (point) {
        ghost.visible = true;
        ghost.position.set(round(point.x), 0, round(point.z));
      }
      return;
    }
    if (!dragging) return;
    if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) <= CLICK_SLOP) return;
    const point = groundPoint(e);
    if (!point) return;
    const node = itemNode(dragging.type, dragging.id);
    const current = worldTransform(node);
    current.pos[0] = round(point.x + dragging.offset.x);
    current.pos[2] = round(point.z + dragging.offset.z);
    setWorldTransform(node, current);
  }

  function onPointerUp(e) {
    if (!enabled) return;
    const wasClick = downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) <= CLICK_SLOP;
    downPos = null;
    if (dragging) {
      const current = worldTransform(itemNode(dragging.type, dragging.id));
      const changed = dragStart && (new THREE.Vector3(...current.pos).distanceTo(new THREE.Vector3(...dragStart.pos)) > 1e-5 || Math.abs(current.rotY - dragStart.rotY) > 1e-5 || new THREE.Vector3(...current.scale).distanceTo(new THREE.Vector3(...dragStart.scale)) > 1e-5);
      const item = selectedRecord();
      dragging = null;
      dragStart = null;
      controls.enabled = controlsWasEnabled;
      dom.style.cursor = '';
      if (changed) onChange();
      if (item) onSelection(item);
      return;
    }
    controls.enabled = controlsWasEnabled;
    dom.style.cursor = '';
    if (!wasClick) return;
    if (placing && ghost) {
      const point = groundPoint(e);
      if (point) ghost.position.set(round(point.x), 0, round(point.z));
      const entry = { ...placing, pos: ghost.position.toArray(), rotY: quantizeRotY(THREE.MathUtils.radToDeg(ghost.rotation.y)), scale: [1, 1, 1] };
      addInstance(entry).then(onChange);
      return;
    }
    if (tool !== 'pan' && !hitAt(e)) deselect();
  }

  function onPointerCancel() {
    if (!enabled) return;
    if (dragging && dragStart) setWorldTransform(itemNode(dragging.type, dragging.id), dragStart);
    dragging = null;
    dragStart = null;
    downPos = null;
    controls.enabled = controlsWasEnabled;
    dom.style.cursor = '';
  }

  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('keydown', onKeyDown);

  function deleteObject(id) {
    const object = objectById(id);
    if (!object || isItemLocked('object', id)) return false;
    const oldGroup = object.groupId;
    object.obj.parent?.remove(object.obj);
    objects = objects.filter((item) => item !== object);
    if (selected?.type === 'object' && selected.id === id) deselect();
    if (oldGroup) cleanEmptyGroup(oldGroup);
    reorderInLayer(object.layerId, id, null);
    onChange();
    return true;
  }

  function ungroup(id) {
    const group = groupById(id);
    if (!group || isItemLocked('group', id) || !isUniformScale(group.obj.scale)) return false;
    const children = groupChildren(id);
    root.updateMatrixWorld(true);
    for (const object of children) {
      attachPreservingTransform(object.obj, root);
      object.groupId = undefined;
      object.layerId = group.layerId;
    }
    groups = groups.filter((item) => item !== group);
    root.remove(group.obj);
    const siblingRows = layerChildren(group.layerId);
    const groupOrder = group.order;
    const ordered = [...siblingRows.filter((row) => row.id !== id)];
    const moved = children.map((item) => ({ id: item.id, item, type: 'object' }));
    ordered.splice(Math.min(groupOrder, ordered.length), 0, ...moved);
    renumber(ordered);
    if (selected?.type === 'group' && selected.id === id) deselect();
    applyVisibility();
    onChange();
    return true;
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.type === 'group') return ungroup(selected.id);
    deleteObject(selected.id);
  }

  function onKeyDown(e) {
    if (!enabled) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') rotateSelected90();
    else if (e.key === 'Escape') {
      if (placing) cancelPlace();
      else deselect();
    } else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  }

  function rotateSelected90() {
    if (!selected || selectedLocked()) return false;
    const transform = getSelectedTransform();
    const changed = setSelectedTransform({ ...transform, rotY: transform.rotY - 90 });
    if (changed) notifySelection();
    return true;
  }

  function createLayer(name) {
    const id = next('layer');
    layers.push({ id, name: String(name || 'Layer'), visible: true, locked: false });
    onChange();
    return id;
  }

  function renameLayer(id, name) {
    const layer = layerById(id);
    if (!layer || isItemLocked('layer', id) || !String(name).trim()) return false;
    layer.name = String(name).trim();
    onChange();
    return true;
  }

  function deleteLayer(id) {
    if (id === DEFAULT_LAYER.id) return false;
    const layer = layerById(id);
    if (!layer || isItemLocked('layer', id)) return false;
    for (const group of groups.filter((item) => item.layerId === id)) {
      group.layerId = DEFAULT_LAYER.id;
      for (const object of groupChildren(group.id)) object.layerId = DEFAULT_LAYER.id;
    }
    for (const object of objects) if (object.layerId === id) object.layerId = DEFAULT_LAYER.id;
    layers = layers.filter((item) => item !== layer);
    if (activeLayerId === id) activeLayerId = DEFAULT_LAYER.id;
    applyVisibility();
    onChange();
    return true;
  }

  function reorderLayer(id, beforeId) {
    const index = layers.findIndex((layer) => layer.id === id);
    if (index < 0) return false;
    const [layer] = layers.splice(index, 1);
    const before = beforeId == null ? -1 : layers.findIndex((item) => item.id === beforeId);
    layers.splice(before < 0 ? layers.length : before, 0, layer);
    onChange();
    return true;
  }

  function setActiveLayer(id) {
    if (!layerById(id)) return false;
    activeLayerId = id;
    return true;
  }

  function setItemVisibility(type, id, visible) {
    const item = type === 'layer' ? layerById(id) : type === 'group' ? groupById(id) : objectById(id);
    if (!item) return false;
    item.visible = !!visible;
    applyVisibility();
    onChange();
    return true;
  }

  function setItemLocked(type, id, locked) {
    const item = type === 'layer' ? layerById(id) : type === 'group' ? groupById(id) : objectById(id);
    if (!item) return false;
    item.locked = !!locked;
    onChange();
    return true;
  }

  function createGroup(objectIds, name = 'Group') {
    const members = [...new Set(objectIds)].map(objectById).filter(Boolean);
    if (!members.length || isItemLocked('layer', activeLayerId) || members.some((object) => !isItemTransformable('object', object.id))) return null;
    const center = members.reduce((sum, object) => sum.add(object.obj.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).multiplyScalar(1 / members.length);
    const group = { id: next('group'), name: String(name || 'Group'), layerId: activeLayerId, visible: true, locked: false, order: layerChildren(activeLayerId).length, obj: new THREE.Group() };
    group.obj.position.copy(center);
    group.obj.userData.editorGroup = group.id;
    root.add(group.obj);
    root.updateMatrixWorld(true);
    const oldGroups = new Set(members.map((object) => object.groupId).filter(Boolean));
    members.forEach((object, index) => {
      attachPreservingTransform(object.obj, group.obj);
      object.groupId = group.id;
      object.layerId = group.layerId;
      object.order = index;
    });
    groups.push(group);
    for (const id of oldGroups) cleanEmptyGroup(id);
    reorderInLayer(group.layerId, group.id, null);
    applyVisibility();
    onChange();
    return groupView(group);
  }

  function renameGroup(id, name) {
    const group = groupById(id);
    if (!group || isItemLocked('group', id) || !String(name).trim()) return false;
    group.name = String(name).trim();
    onChange();
    return true;
  }

  function moveGroup(id, layerId, beforeId) {
    const group = groupById(id);
    if (!group || isItemLocked('group', id) || isItemLocked('layer', layerId)) return false;
    const oldLayerId = group.layerId;
    group.layerId = layerId;
    for (const object of groupChildren(id)) object.layerId = layerId;
    reorderInLayer(oldLayerId, id, null);
    reorderInLayer(layerId, id, beforeId);
    applyVisibility();
    onChange();
    return true;
  }

  function moveObject(id, layerId, groupId, beforeId) {
    const object = objectById(id);
    const targetGroup = groupId ? groupById(groupId) : null;
    if (!object || isItemLocked('object', id) || isItemLocked('layer', layerId)
      || (groupId && (!targetGroup || targetGroup.layerId !== layerId || isItemLocked('group', groupId)
        || !isUniformScale(targetGroup.obj.scale) && object.groupId !== groupId))) return false;
    const previousGroupId = object.groupId;
    const oldLayerId = object.layerId;
    const parent = targetGroup?.obj ?? root;
    if (parent !== object.obj.parent && !isItemTransformable('object', id)) return false;
    if (parent !== object.obj.parent) {
      attachPreservingTransform(object.obj, parent);
    }
    object.groupId = targetGroup?.id;
    object.layerId = layerId;
    if (targetGroup) reorderInGroup(targetGroup.id, id, beforeId);
    else reorderInLayer(layerId, id, beforeId);
    if (previousGroupId && previousGroupId !== groupId) cleanEmptyGroup(previousGroupId);
    if (oldLayerId !== layerId && !targetGroup) reorderInLayer(oldLayerId, id, null);
    applyVisibility();
    onChange();
    return true;
  }

  function renameObject(id, name) {
    const object = objectById(id);
    if (!object || isItemLocked('object', id) || !String(name).trim()) return false;
    object.name = String(name).trim();
    onChange();
    return true;
  }

  function getSelectedTransform() {
    if (!selected) return null;
    return worldTransform(itemNode(selected.type, selected.id));
  }

  function setSelectedTransform(transform) {
    if (!selected || selectedLocked() || !transform || !Array.isArray(transform.pos)) return false;
    if (selected.type === 'group' && Array.isArray(transform.scale)) {
      const currentScale = getSelectedTransform().scale;
      const scaleChanged = transform.scale.some((value, index) => Math.abs(value - currentScale[index]) > 1e-5);
      if (scaleChanged) transform = { ...transform, scale: [transform.scale[0], transform.scale[0], transform.scale[0]] };
    }
    setWorldTransform(itemNode(selected.type, selected.id), transform);
    onChange();
    return true;
  }

  function groupView(group) {
    const transform = worldTransform(group.obj);
    return {
      id: group.id, name: group.name, layerId: group.layerId,
      pos: transform.pos, rotY: transform.rotY, scale: transform.scale,
      visible: group.visible, locked: group.locked, order: group.order,
    };
  }

  function getLayers() { return layers.map(({ id, name, visible, locked }) => ({ id, name, visible, locked })); }
  function getGroups() { return groups.map(groupView).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)); }
  function getObjects() {
    return [...objects].sort((a, b) => {
      const layerOrder = layers.findIndex((layer) => layer.id === a.layerId) - layers.findIndex((layer) => layer.id === b.layerId);
      if (layerOrder) return layerOrder;
      const aGroup = a.groupId && groupById(a.groupId);
      const bGroup = b.groupId && groupById(b.groupId);
      const aParentOrder = aGroup ? aGroup.order : a.order;
      const bParentOrder = bGroup ? bGroup.order : b.order;
      return aParentOrder - bParentOrder || (aGroup ? a.order : -1) - (bGroup ? b.order : -1) || a.id.localeCompare(b.id);
    }).map((object) => ({
      id: object.id, pack: object.pack, asset: object.asset, name: object.name,
      layerId: object.layerId, ...(object.groupId ? { groupId: object.groupId } : {}),
      pos: object.obj.position.toArray(), rotY: THREE.MathUtils.radToDeg(object.obj.rotation.y),
      scale: object.obj.scale.toArray(), visible: object.visible, locked: object.locked, order: object.order,
    }));
  }

  async function loadObjects(list, layerList, groupList) {
    clear();
    layers = [{ ...DEFAULT_LAYER }, ...(Array.isArray(layerList) ? layerList.filter((layer) => layer.id !== DEFAULT_LAYER.id).map((layer) => ({ ...layer })) : [])];
    if (Array.isArray(layerList)) {
      const savedDefault = layerList.find((layer) => layer.id === DEFAULT_LAYER.id);
      if (savedDefault) layers[0] = { ...DEFAULT_LAYER, ...savedDefault };
    }
    activeLayerId = DEFAULT_LAYER.id;
    groups = (Array.isArray(groupList) ? groupList : []).map((entry) => {
      const group = {
        id: entry.id || next('group'), name: entry.name || 'Group',
        layerId: layerById(entry.layerId) ? entry.layerId : DEFAULT_LAYER.id,
        visible: entry.visible !== false, locked: entry.locked === true,
        order: Number.isFinite(entry.order) ? entry.order : 0, obj: new THREE.Group(),
      };
      group.obj.position.set(...(entry.pos ?? [0, 0, 0]));
      group.obj.rotation.y = THREE.MathUtils.degToRad(entry.rotY ?? 0);
      group.obj.scale.set(...(entry.scale ?? [1, 1, 1]));
      group.obj.userData.editorGroup = group.id;
      root.add(group.obj);
      return group;
    });
    const missing = [];
    for (const entry of list) {
      let pack = entry.pack;
      if (!catalog.has(pack, entry.asset)) {
        const matches = catalog.getPacks?.().filter((candidate) => candidate.entries.some((item) => item.name === entry.asset)) ?? [];
        if (matches.length !== 1) {
          if (!missing.includes(entry.asset)) missing.push(entry.asset);
          continue;
        }
        pack = matches[0].id;
      }
      const validGroup = entry.groupId && groupById(entry.groupId);
      const layerId = layerById(entry.layerId) ? entry.layerId : DEFAULT_LAYER.id;
      try {
        await addInstance({ ...entry, pack, layerId, groupId: validGroup && validGroup.layerId === layerId ? entry.groupId : undefined });
      } catch (error) {
        console.warn('skipped bad object entry', entry, error);
        if (!missing.includes(entry.asset)) missing.push(entry.asset);
      }
    }
    applyVisibility();
    return { missing };
  }

  function clear() {
    cancelPlace();
    deselect();
    dragging = null;
    dragStart = null;
    while (root.children.length) root.remove(root.children[0]);
    objects = [];
    groups = [];
    layers = [{ ...DEFAULT_LAYER }];
    activeLayerId = DEFAULT_LAYER.id;
  }

  function setEnabled(value) {
    enabled = !!value;
    if (!enabled) {
      if (dragging && dragStart) setWorldTransform(itemNode(dragging.type, dragging.id), dragStart);
      dragging = null;
      dragStart = null;
      downPos = null;
      cancelPlace();
      dom.style.cursor = '';
    }
    controls.enabled = enabled;
  }

  return {
    setPlace, cancelPlace, deleteSelected, deleteObject, rotateSelected90,
    createLayer, renameLayer, deleteLayer, reorderLayer, setActiveLayer, isItemLocked,
    createGroup, renameGroup, ungroup, moveGroup, moveObject, renameObject,
    setItemVisibility, setItemLocked, selectItem, getSelectedTransform, setSelectedTransform,
    getLayers, getGroups, getObjects, getActiveLayerId: () => activeLayerId,
    setTool, getTool: () => tool, isItemTransformable, setEnabled,
    setSnap: (on) => { snap = !!on; }, getSnap: () => snap,
    getSelected: selectedRecord, changed: onChange, loadObjects, clear,
  };
}
