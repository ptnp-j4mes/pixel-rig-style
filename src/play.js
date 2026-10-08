import * as THREE from 'three';
import { MAP_EXTENT } from './lib.js';

const EYE_HEIGHT = 1.65;
const CAMERA_HEIGHT = 12;
const PITCH_MIN = -1.05;
const PITCH_MAX = -0.55;
const PLAYER_RADIUS = 0.32;
const WALK_SPEED = 5;
// ponytail: fixed-height ray collision does not support slopes or jumping; add physics when maps need vertical traversal.

export function createPlayMode({ catalog, dom }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.add(new THREE.HemisphereLight(0xfffaed, 0x606850, 1.05));
  const sun = new THREE.DirectionalLight(0xfffaed, 1.8);
  sun.position.set(35, 55, 20);
  sun.castShadow = true;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_EXTENT, MAP_EXTENT),
    new THREE.MeshStandardMaterial({ color: 0x7d9b5e })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const content = new THREE.Group();
  scene.add(content);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
  const raycaster = new THREE.Raycaster();
  const colliders = [];
  const keys = new Set();
  let active = false;
  let dragging = false;
  let yaw = 0;
  let pitch = 0;
  const playerPosition = new THREE.Vector3();

  function clearContent() {
    content.traverse((node) => {
      if (!node.isMesh) return;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.dispose();
    });
    content.clear();
    colliders.length = 0;
  }

  async function enter(doc) {
    clearContent();
    const layers = new Map((doc.layers ?? []).map((layer) => [layer.id, layer]));
    const groups = new Map();
    for (const group of doc.groups ?? []) {
      const layer = layers.get(group.layerId);
      if (group.visible === false || layer?.visible === false) continue;
      const node = new THREE.Group();
      node.position.fromArray(group.pos ?? [0, 0, 0]);
      node.rotation.y = THREE.MathUtils.degToRad(group.rotY ?? 0);
      node.scale.fromArray(group.scale ?? [1, 1, 1]);
      content.add(node);
      groups.set(group.id, { node, layerId: group.layerId });
    }

    const loaded = await Promise.all((doc.objects ?? []).map(async (entry) => {
      const layer = layers.get(entry.layerId);
      const group = groups.get(entry.groupId);
      if (entry.visible === false || layer?.visible === false || (entry.groupId && !group)) return null;
      if (!catalog.has(entry.pack, entry.asset)) return null;
      try {
        const model = await catalog.loadModel(entry.pack, entry.asset);
        model.position.fromArray(entry.pos ?? [0, 0, 0]);
        model.rotation.y = THREE.MathUtils.degToRad(entry.rotY ?? 0);
        model.scale.fromArray(entry.scale ?? [1, 1, 1]);
        return { model, group };
      } catch (error) {
        console.warn(`Could not load ${entry.pack}/${entry.asset} for play mode`, error);
        return null;
      }
    }));

    for (const item of loaded) {
      if (!item) continue;
      (item.group?.node ?? content).add(item.model);
    }
    content.updateMatrixWorld(true);
    content.traverse((node) => {
      if (!node.isMesh) return;
      const bounds = new THREE.Box3().setFromObject(node);
      if (bounds.max.y > 0.15 && bounds.min.y < EYE_HEIGHT) colliders.push(node);
    });

    const spawn = doc.spawn ?? { pos: [0, 0, 8], rotY: 0 };
    const [x, y, z] = spawn.pos ?? [0, 0, 8];
    playerPosition.set(x, y + EYE_HEIGHT, z);
    camera.position.set(x, y + CAMERA_HEIGHT, z);
    yaw = THREE.MathUtils.degToRad(spawn.rotY ?? 0) + Math.PI / 4;
    pitch = -Math.PI / 4;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);
    keys.clear();
    active = true;
  }

  function blocked(position, dx, dz) {
    const distance = Math.hypot(dx, dz);
    if (!distance) return false;
    const direction = new THREE.Vector3(dx / distance, 0, dz / distance);
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    for (const offset of [-PLAYER_RADIUS, 0, PLAYER_RADIUS]) {
      const origin = new THREE.Vector3(
        position.x + side.x * offset,
        position.y - EYE_HEIGHT + 0.9,
        position.z + side.z * offset
      );
      raycaster.set(origin, direction);
      raycaster.far = distance + PLAYER_RADIUS;
      if (raycaster.intersectObjects(colliders, false).length) return true;
    }
    return false;
  }

  function update(delta) {
    if (!active) return;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const movement = new THREE.Vector3();
    if (keys.has('KeyW') || keys.has('ArrowUp')) movement.add(forward);
    if (keys.has('KeyS') || keys.has('ArrowDown')) movement.sub(forward);
    if (keys.has('KeyD') || keys.has('ArrowRight')) movement.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) movement.sub(right);
    if (!movement.lengthSq()) return;
    movement.normalize().multiplyScalar(WALK_SPEED * Math.min(delta, 0.05));

    const position = playerPosition;
    const dx = movement.x, dz = movement.z;
    if (!blocked(position, dx, dz)) {
      position.x = THREE.MathUtils.clamp(position.x + dx, -MAP_EXTENT / 2 + PLAYER_RADIUS, MAP_EXTENT / 2 - PLAYER_RADIUS);
      position.z = THREE.MathUtils.clamp(position.z + dz, -MAP_EXTENT / 2 + PLAYER_RADIUS, MAP_EXTENT / 2 - PLAYER_RADIUS);
      camera.position.set(position.x, camera.position.y, position.z);
      return;
    }
    if (!blocked(position, dx, 0)) position.x = THREE.MathUtils.clamp(position.x + dx, -MAP_EXTENT / 2 + PLAYER_RADIUS, MAP_EXTENT / 2 - PLAYER_RADIUS);
    if (!blocked(position, 0, dz)) position.z = THREE.MathUtils.clamp(position.z + dz, -MAP_EXTENT / 2 + PLAYER_RADIUS, MAP_EXTENT / 2 - PLAYER_RADIUS);
    camera.position.set(position.x, camera.position.y, position.z);
  }

  function onKeyDown(event) {
    if (!active) return;
    if (event.code.startsWith('Key') || event.code.startsWith('Arrow')) event.preventDefault();
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    if (!active || document.pointerLockElement !== dom) return;
    rotateCamera(event.movementX, event.movementY);
  }

  function onPointerDown(event) {
    if (!active || event.button !== 0 || document.pointerLockElement === dom) return;
    dragging = true;
    try { dom.setPointerCapture(event.pointerId); } catch { /* pointer already ended */ }
  }

  function onPointerMove(event) {
    if (!active || !dragging || document.pointerLockElement === dom) return;
    rotateCamera(event.movementX, event.movementY);
  }

  function onPointerUp(event) {
    if (event.button === 0) dragging = false;
  }

  function rotateCamera(movementX, movementY) {
    yaw -= movementX * 0.002;
    pitch = THREE.MathUtils.clamp(pitch - movementY * 0.002, PITCH_MIN, PITCH_MAX);
    camera.rotation.set(pitch, yaw, 0);
  }

  function onClick() {
    if (!active || document.pointerLockElement === dom) return;
    try {
      const request = dom.requestPointerLock?.();
      request?.catch?.(() => {});
    } catch { /* pointer lock is browser-controlled */ }
  }

  function exit() {
    active = false;
    dragging = false;
    keys.clear();
    if (document.pointerLockElement === dom) document.exitPointerLock();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', () => { dragging = false; });
  dom.addEventListener('click', onClick);

  return {
    scene,
    camera,
    enter,
    exit,
    update,
    isActive: () => active,
  };
}
