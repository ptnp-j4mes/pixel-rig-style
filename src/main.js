import * as THREE from 'three';
import { createCamera } from './camera.js';
import { GRID_SIZE, MAP_EXTENT } from './lib.js';

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

renderer.setAnimationLoop(() => {
  cam.controls.update();
  renderer.render(scene, cam.camera);
});
