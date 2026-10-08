import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const PITCH_MIN = 40; // degrees from horizontal (spec)
export const PITCH_MAX = 55;
const ZOOM_MIN = 4;   // dolly limits in meters
const ZOOM_MAX = 200;
const DEFAULT_PITCH = 50;
const DEFAULT_DIST = 40;

export function createCamera(container) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const controls = new OrbitControls(camera, container);
  // Polar angle is measured from +Y: pitch 40° -> polar 50°, pitch 55° -> polar 35°.
  controls.minPolarAngle = THREE.MathUtils.degToRad(90 - PITCH_MAX);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(90 - PITCH_MIN);
  controls.minDistance = ZOOM_MIN;
  controls.maxDistance = ZOOM_MAX;
  // Left/right = orbit; middle = dolly. The editor claims left-presses on objects first.
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  const reset = () => {
    const pitch = THREE.MathUtils.degToRad(DEFAULT_PITCH);
    camera.position.set(0, DEFAULT_DIST * Math.sin(pitch), DEFAULT_DIST * Math.cos(pitch));
    controls.target.set(0, 0, 0);
    controls.update();
  };
  reset();
  return { camera, controls, reset };
}
