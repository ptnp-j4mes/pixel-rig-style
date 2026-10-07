import * as THREE from 'three';
import { snapToGrid, quantizeRotY } from './lib.js';

const CLICK_SLOP = 6; // px — between down and up that still counts as a click
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const HIGHLIGHT = 0x442200;

export function createEditor({ scene, camera, controls, dom, catalog, onChange, onSelection }) {
  const group = new THREE.Group(); // all placed objects
  scene.add(group);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let placing = null;   // asset name being placed
  let ghost = null;     // preview instance
  let dragging = null;  // instance being dragged
  let selected = null;  // instance
  let downPos = null;
  let objects = [];     // [{ id, asset, obj }]
  let nextId = 1;

  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  function setPointer(e) {
    const r = dom.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  function groundPoint(e) {
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(GROUND_PLANE, hit) ? hit : null;
  }

  function rootOf(obj3d) {
    let o = obj3d;
    while (o && !o.userData.editorRoot) o = o.parent;
    return o?.userData.editorRoot ?? null;
  }

  // ---- placement ----

  async function setPlace(assetName) {
    cancelPlace();
    placing = assetName;
    const model = await catalog.loadModel(assetName);
    if (placing !== assetName) return; // user switched away while loading
    model.traverse((c) => {
      if (c.isMesh) {
        c.material.transparent = true;
        c.material.opacity = 0.5;
        c.material.depthWrite = false;
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

  async function addInstance(asset, position, rotY, scale = [1, 1, 1]) {
    const obj = await catalog.loadModel(asset);
    obj.position.copy(position);
    obj.rotation.y = THREE.MathUtils.degToRad(rotY);
    obj.scale.set(...scale);
    const inst = { id: nextId++, asset, obj };
    obj.userData.editorRoot = inst;
    group.add(obj);
    objects.push(inst);
    return inst;
  }

  // ---- selection / highlight ----

  function select(inst) {
    if (selected === inst) return;
    deselect();
    selected = inst;
    inst.obj.traverse((c) => {
      if (c.isMesh && c.material.emissive) {
        c.material.userData.origEmissive = c.material.emissive.getHex();
        c.material.emissive.setHex(HIGHLIGHT);
      }
    });
    onSelection(inst);
  }

  function deselect() {
    if (!selected) return;
    selected.obj.traverse((c) => {
      if (c.isMesh && c.material.emissive && c.material.userData.origEmissive !== undefined) {
        c.material.emissive.setHex(c.material.userData.origEmissive);
      }
    });
    selected = null;
    onSelection(null);
  }

  // ---- pointer interaction ----

  function onPointerDown(e) {
    if (e.button !== 0) return;
    downPos = { x: e.clientX, y: e.clientY };
    if (placing) return; // click-through handled on up
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(group.children, true);
    if (hits.length) {
      const inst = rootOf(hits[0].object);
      if (!inst) return;
      select(inst);
      dragging = inst;
      dom.style.cursor = 'grabbing';
      controls.enabled = false; // don't orbit while moving an object
    }
  }

  function onPointerMove(e) {
    if (placing && ghost) {
      const p = groundPoint(e);
      if (p) {
        ghost.visible = true;
        ghost.position.set(snapToGrid(p.x), 0, snapToGrid(p.z));
      }
      return;
    }
    if (dragging) {
      const p = groundPoint(e);
      if (p) {
        dragging.obj.position.x = snapToGrid(p.x);
        dragging.obj.position.z = snapToGrid(p.z);
      }
    }
  }

  function onPointerUp(e) {
    controls.enabled = true;
    dom.style.cursor = '';
    const wasClick = downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) <= CLICK_SLOP;
    downPos = null;
    if (dragging) {
      dragging = null;
      if (!wasClick) onChange();
      return;
    }
    if (!wasClick) return;
    if (placing && ghost) {
      const p = groundPoint(e);
      if (p) ghost.position.set(snapToGrid(p.x), 0, snapToGrid(p.z));
      addInstance(placing, ghost.position.clone(), quantizeRotY(THREE.MathUtils.radToDeg(ghost.rotation.y)));
      onChange();
      return; // stay in placing mode for rapid placement
    }
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.intersectObjects(group.children, true).length) deselect();
  }

  // ---- keyboard ----

  function onKeyDown(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') {
      if (ghost) {
        ghost.rotation.y -= Math.PI / 2; // clockwise seen from above
      } else if (selected) {
        selected.obj.rotation.y -= Math.PI / 2;
        onChange();
      }
    } else if (e.key === 'Escape') {
      if (placing) cancelPlace();
      else deselect();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
    }
  }

  // ---- commands used by panels / toolbar ----

  function deleteSelected() {
    if (!selected) return;
    group.remove(selected.obj);
    objects = objects.filter((o) => o !== selected);
    selected = null;
    onSelection(null);
    onChange();
  }

  function rotateSelected90() {
    if (!selected) return;
    selected.obj.rotation.y -= Math.PI / 2;
    onChange();
  }

  function getObjects() {
    return objects.map((o) => ({
      asset: o.asset,
      pos: [
        +o.obj.position.x.toFixed(3),
        +o.obj.position.y.toFixed(3),
        +o.obj.position.z.toFixed(3),
      ],
      rotY: +THREE.MathUtils.radToDeg(o.obj.rotation.y).toFixed(2),
      scale: [o.obj.scale.x, o.obj.scale.y, o.obj.scale.z],
    }));
  }

  async function loadObjects(list) {
    clear();
    const missing = [];
    for (const entry of list) {
      if (!catalog.has(entry.asset)) {
        if (!missing.includes(entry.asset)) missing.push(entry.asset);
        continue;
      }
      try {
        await addInstance(
          entry.asset,
          new THREE.Vector3(...entry.pos),
          entry.rotY ?? 0,
          entry.scale ?? [1, 1, 1]
        );
      } catch (err) {
        console.warn('skipped bad object entry', entry, err);
      }
    }
    return { missing };
  }

  function clear() {
    cancelPlace();
    deselect();
    dragging = null;
    while (group.children.length) group.remove(group.children[0]);
    objects = [];
  }

  return {
    setPlace, cancelPlace, deleteSelected, rotateSelected90,
    getSelected: () => selected,
    changed: onChange,
    getObjects, loadObjects, clear,
  };
}
