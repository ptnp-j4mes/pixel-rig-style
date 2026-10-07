# 3D Map Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web-based 3D map editor (Vite + Three.js) that places/edits Medieval Village MegaKit meshes on a 2 m grid with a 40–55° locked camera and JSON save/load.

**Architecture:** Vanilla JS ES modules; `lib.js` holds pure logic (node-testable), `catalog.js` owns asset loading/caching, `editor.js` owns all pointer/keyboard interaction, `storage.js` owns map IO, `main.js` wires DOM UI (palette, panel, toolbar) to those modules. Vite serves `public/` at `/`.

**Tech Stack:** Three.js (npm), Vite, vanilla DOM, Python 3 stdlib for the manifest generator, `node:test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-10-07-3d-map-editor-design.md`

## Global Constraints

- Grid module: **2 m** (`GRID_SIZE = 2`). Map extent: **128 m** (`MAP_EXTENT = 128`, 64×64 cells).
- Camera pitch clamp: **40–55° from horizontal** (polar 35–50°). Zoom dolly limits: **4–200 m**. Default pitch: **50°**.
- Click-vs-drag threshold: **6 px**.
- Map document: `{version: 1, gridSize: 2, mapName, objects:[{asset, pos:[x,y,z], rotY, scale:[x,y,z]}]}` — `rotY` in degrees, free values preserved.
- Autosave: localStorage, debounced **500 ms**, key `mve.autosave`.
- Thumbnails: **96×96** dataURL, rendered in-session, cached in memory.
- Missing model → pink wireframe placeholder sized from manifest footprint (min 0.5 m per axis); missing manifest → visible banner; bad JSON on load → toast, scene untouched.
- v1 has **no** undo/redo, no duplicate, no sculpted terrain.
- 176 glTF assets in `public/kit/` (not in git — `.gitignore` already covers `assets/` and `public/kit/`); `public/manifest.json` IS committed.
- All UI copy in Thai; code/comments in English.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.js` (stub, replaced in Task 4)

**Interfaces:**
- Produces: runnable Vite app; DOM ids that later tasks bind to: `map-name`, `btn-new`, `btn-save`, `btn-load`, `btn-reset-cam`, `btn-grid`, `palette-search`, `palette`, `viewport`, `properties`, `prop-name`, `pos-x`, `pos-y`, `pos-z`, `rot-y`, `rot-90`, `scale-x`, `scale-y`, `scale-z`, `scale-reset`, `btn-delete`, `banner`, `toast`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "pixel-rig-style",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node test/lib.test.mjs"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install three && npm install -D vite`
Expected: `node_modules/` created, no errors; `package.json` gains `dependencies.three` and `devDependencies.vite` (whatever current versions npm resolves — do not pin by hand).

- [ ] **Step 3: Write index.html (full UI markup)**

```html
<!doctype html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pixel Rig Style — 3D Map Editor</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; height: 100vh; font: 13px system-ui, sans-serif;
      display: grid;
      grid-template: "toolbar toolbar toolbar" auto "sidebar viewport props" 1fr / 250px 1fr 230px;
      background: #1e1f22; color: #ddd;
    }
    #toolbar {
      grid-area: toolbar; display: flex; gap: 6px; align-items: center;
      padding: 6px 10px; background: #2a2b2f; border-bottom: 1px solid #000;
    }
    #toolbar .spacer { flex: 1; }
    #map-name { width: 140px; background: #1a1b1e; color: #ddd; border: 1px solid #444; border-radius: 4px; padding: 4px 6px; }
    button {
      background: #3a3b40; color: #ddd; border: 1px solid #555; border-radius: 4px;
      padding: 4px 10px; cursor: pointer; font: inherit;
    }
    button:hover { background: #4a4b50; }
    button.active { background: #3d5a2e; border-color: #5a8a3e; }
    button.danger { background: #5a2e2e; border-color: #8a3e3e; }
    #sidebar { grid-area: sidebar; display: flex; flex-direction: column; background: #26272b; border-right: 1px solid #000; }
    #palette-search { margin: 8px; padding: 5px 8px; background: #1a1b1e; color: #ddd; border: 1px solid #444; border-radius: 4px; }
    #palette { flex: 1; overflow-y: auto; padding-bottom: 10px; }
    #palette summary { padding: 6px 10px; cursor: pointer; user-select: none; }
    #palette summary:hover { background: #303136; }
    .palette-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px 8px; }
    .palette-item {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 4px; background: #2e2f34; border: 1px solid #444; border-radius: 4px;
    }
    .palette-item img { width: 72px; height: 72px; object-fit: contain; background: #1a1b1e; border-radius: 3px; }
    .palette-item span { font-size: 10px; text-align: center; word-break: break-all; max-height: 26px; overflow: hidden; }
    #viewport { grid-area: viewport; position: relative; min-width: 0; }
    #viewport canvas { display: block; }
    #properties {
      grid-area: props; background: #26272b; border-left: 1px solid #000;
      padding: 10px; overflow-y: auto;
    }
    #properties h3 { margin: 0 0 10px; font-size: 13px; color: #aab; word-break: break-all; }
    #properties label { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 6px; }
    #properties input { width: 80px; background: #1a1b1e; color: #ddd; border: 1px solid #444; border-radius: 4px; padding: 3px 5px; }
    #properties .row { display: flex; gap: 6px; margin-top: 8px; }
    #properties .row button { flex: 1; }
    #banner {
      position: fixed; top: 40px; left: 50%; transform: translateX(-50%);
      background: #6a1f1f; color: #faa; padding: 8px 16px; border-radius: 6px; z-index: 10;
    }
    #toast {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #2f4a2f; color: #cfc; padding: 8px 16px; border-radius: 6px; z-index: 10; max-width: 70%;
    }
  </style>
</head>
<body>
  <header id="toolbar">
    <input id="map-name" value="my-village" />
    <button id="btn-new">ใหม่</button>
    <button id="btn-save">บันทึก</button>
    <button id="btn-load">เปิดไฟล์</button>
    <span class="spacer"></span>
    <button id="btn-reset-cam">รีเซ็ตกล้อง</button>
    <button id="btn-grid" class="active">Grid</button>
  </header>
  <aside id="sidebar">
    <input id="palette-search" placeholder="ค้นหาชิ้นส่วน…" />
    <div id="palette"></div>
  </aside>
  <main id="viewport"></main>
  <aside id="properties" hidden>
    <h3 id="prop-name"></h3>
    <label>ตำแหน่ง X <input id="pos-x" type="number" step="2" /></label>
    <label>ตำแหน่ง Y <input id="pos-y" type="number" step="0.25" /></label>
    <label>ตำแหน่ง Z <input id="pos-z" type="number" step="2" /></label>
    <label>หมุน (°) <input id="rot-y" type="number" step="90" /></label>
    <div class="row">
      <button id="rot-90">+90°</button>
      <button id="scale-reset">สเกล 1:1:1</button>
    </div>
    <label>สเกล X <input id="scale-x" type="number" step="0.1" /></label>
    <label>สเกล Y <input id="scale-y" type="number" step="0.1" /></label>
    <label>สเกล Z <input id="scale-z" type="number" step="0.1" /></label>
    <div class="row">
      <button id="btn-delete" class="danger">ลบ (Del)</button>
    </div>
  </aside>
  <div id="banner" hidden></div>
  <div id="toast" hidden></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write src/main.js stub**

```js
console.log('scaffold ok');
```

- [ ] **Step 5: Run dev server and verify**

Run: `npm run dev`
Expected: Vite prints `Local: http://localhost:5173/`. Open the URL: dark layout with toolbar across the top, empty palette sidebar on the left, dark viewport center, hidden properties panel. Browser console shows `scaffold ok` and no errors. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json index.html src/main.js
git commit -m "feat: scaffold Vite app with editor layout"
```

---

### Task 2: Asset kit into public/kit + manifest generator

**Files:**
- Create: `public/kit/` (copied from the extracted pack — not committed)
- Create: `scripts/gen_manifest.py`
- Create: `public/manifest.json` (generated, committed)

**Interfaces:**
- Produces: `public/manifest.json` — a JSON array, one entry per asset:
  `{ "name": "Floor_Brick", "file": "Floor_Brick.gltf", "category": "Floor", "size": [2.0, 0.02, 2.0] }` (size = [w, h, d] meters from glTF POSITION accessor min/max, rounded to 3 decimals), sorted by (category, name).

- [ ] **Step 1: Copy glTF folder into public/kit**

Run:
```bash
mkdir -p public/kit && ditto "assets/Medieval Village MegaKit[Standard]/glTF" public/kit
ls public/kit | wc -l
```
Expected: file count = 176 `.gltf` + 176 `.bin` + ~34 `.png` ≈ **386+ files**. If `assets/Medieval Village MegaKit[Standard]/` does not exist, re-extract the zip first:
`ditto -x -k "/Users/bic-patanaphong/Downloads/Medieval Village MegaKit[Standard].zip" assets/`

- [ ] **Step 2: Write scripts/gen_manifest.py**

```python
#!/usr/bin/env python3
"""Scan public/kit/*.gltf -> public/manifest.json (name, file, category, size)."""
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
KIT_DIR = os.path.join(ROOT, 'public', 'kit')
OUT = os.path.join(ROOT, 'public', 'manifest.json')


def piece_size(path):
    """[w, h, d] in meters from POSITION accessor min/max."""
    with open(path) as f:
        d = json.load(f)
    mins = [1e9] * 3
    maxs = [-1e9] * 3
    for mesh in d.get('meshes', []):
        for prim in mesh.get('primitives', []):
            acc = d['accessors'][prim['attributes']['POSITION']]
            for i in range(3):
                mins[i] = min(mins[i], acc['min'][i])
                maxs[i] = max(maxs[i], acc['max'][i])
    return [round(maxs[i] - mins[i], 3) for i in range(3)]


def main():
    files = sorted(f for f in os.listdir(KIT_DIR) if f.endswith('.gltf'))
    assert len(files) > 100, f'expected full kit in public/kit, found {len(files)} .gltf files'
    entries = []
    for f in files:
        name = f[: -len('.gltf')]
        entries.append({
            'name': name,
            'file': f,
            'category': name.split('_')[0],
            'size': piece_size(os.path.join(KIT_DIR, f)),
        })
    entries.sort(key=lambda e: (e['category'], e['name']))
    assert all(e['size'][0] > 0 for e in entries), 'degenerate footprint found'
    cats = {}
    for e in entries:
        cats[e['category']] = cats.get(e['category'], 0) + 1
    with open(OUT, 'w') as f:
        json.dump(entries, f, indent=1)
    print(f'wrote {OUT}: {len(entries)} assets in {len(cats)} categories')
    for c in sorted(cats):
        print(f'  {c}: {cats[c]}')


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 3: Generate and verify the manifest**

Run: `python3 scripts/gen_manifest.py`
Expected: `wrote .../public/manifest.json: 176 assets in 13 categories` (or similar count) followed by per-category lines like `Floor: 12`, `Roof: 39`, `Wall: 20`. The assert lines are the script's self-check; a failure here means the kit copy is incomplete.

- [ ] **Step 4: Commit (manifest only — public/kit stays out of git)**

```bash
git add scripts/gen_manifest.py public/manifest.json
git commit -m "feat: asset manifest generator for medieval kit"
```

---

### Task 3: lib.js — pure logic (TDD)

**Files:**
- Create: `src/lib.js`
- Test: `test/lib.test.mjs`

**Interfaces:**
- Produces (used by Tasks 4, 6, 8):
  - `GRID_SIZE = 2`, `MAP_EXTENT = 128`, `MAP_VERSION = 1` (constants)
  - `CATEGORY_ORDER: string[]` — display order for palette categories
  - `snapToGrid(v: number, grid = GRID_SIZE) -> number`
  - `quantizeRotY(deg: number) -> number` — nearest 90° step, normalized to 0–345
  - `categoryOf(assetName: string) -> string`
  - `serializeMap(mapName: string, objects: Array) -> doc`
  - `deserializeMap(text: string) -> doc` — throws on bad JSON / wrong version / missing objects

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_SIZE, MAP_VERSION,
  snapToGrid, quantizeRotY, categoryOf,
  serializeMap, deserializeMap,
} from '../src/lib.js';

test('snapToGrid rounds to the lattice', () => {
  assert.equal(snapToGrid(3.7), 4);
  assert.equal(snapToGrid(3.4), 4);
  assert.equal(snapToGrid(1), 2);
  assert.equal(snapToGrid(0), 0);
  assert.equal(snapToGrid(-1.2), -2);
  assert.equal(snapToGrid(5, 5), 5); // custom grid size
});

test('quantizeRotY snaps to 90° steps, normalized 0-345', () => {
  assert.equal(quantizeRotY(95), 90);
  assert.equal(quantizeRotY(450), 90);
  assert.equal(quantizeRotY(-15), 0);
  assert.equal(quantizeRotY(270), 270);
});

test('categoryOf uses the prefix before the first underscore', () => {
  assert.equal(categoryOf('Roof_2x4_RoundTile'), 'Roof');
  assert.equal(categoryOf('Wall_Plaster_Door_Flat'), 'Wall');
});

test('serialize -> deserialize round-trips objects', () => {
  const objects = [{ asset: 'Floor_Brick', pos: [2, 0, 4], rotY: 90, scale: [1, 1, 1] }];
  const doc = serializeMap('test-map', objects);
  assert.equal(doc.version, MAP_VERSION);
  assert.equal(doc.gridSize, GRID_SIZE);
  assert.equal(doc.mapName, 'test-map');
  const back = deserializeMap(JSON.stringify(doc));
  assert.deepEqual(back.objects, objects);
});

test('deserializeMap rejects bad input', () => {
  assert.throws(() => deserializeMap('not json'));
  assert.throws(() => deserializeMap(JSON.stringify({ version: 9, objects: [] })));
  assert.throws(() => deserializeMap(JSON.stringify({ version: MAP_VERSION })));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module .../src/lib.js`.

- [ ] **Step 3: Write src/lib.js**

```js
// Pure logic — no three.js imports here so node can test it directly.

export const GRID_SIZE = 2;       // kit module: floors are 2x2 m, walls 2 m wide
export const MAP_EXTENT = 128;    // 64x64 cells
export const MAP_VERSION = 1;

export const CATEGORY_ORDER = [
  'Floor', 'Wall', 'Corner', 'Door', 'DoorFrame', 'Window', 'WindowShutters',
  'Overhang', 'Roof', 'Stairs', 'Balcony', 'HoleCover', 'Prop',
];

export function snapToGrid(v, grid = GRID_SIZE) {
  return Math.round(v / grid) * grid;
}

export function quantizeRotY(deg) {
  const norm = ((deg % 360) + 360) % 360;
  return (Math.round(norm / 90) * 90) % 360;
}

export function categoryOf(assetName) {
  return assetName.split('_')[0];
}

export function serializeMap(mapName, objects) {
  return {
    version: MAP_VERSION,
    gridSize: GRID_SIZE,
    mapName,
    objects: objects.map((o) => ({
      asset: o.asset,
      pos: [...o.pos],
      rotY: o.rotY,
      scale: [...o.scale],
    })),
  };
}

export function deserializeMap(text) {
  const doc = JSON.parse(text);
  if (doc.version !== MAP_VERSION) throw new Error(`unsupported map version: ${doc.version}`);
  if (!Array.isArray(doc.objects)) throw new Error('map has no objects array');
  return doc;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — `5 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/lib.js test/lib.test.mjs
git commit -m "feat: pure map/snap logic with node tests"
```

---

### Task 4: Camera + scene bootstrap

**Files:**
- Create: `src/camera.js`
- Modify: `src/main.js` (replace stub)

**Interfaces:**
- Consumes: `MAP_EXTENT`, `GRID_SIZE` from `src/lib.js`.
- Produces: `createCamera(container: HTMLElement) -> { camera: THREE.PerspectiveCamera, controls: OrbitControls, reset: () => void }`. Polar clamp = 90° − pitch clamp, i.e. `minPolarAngle = 35°`, `maxPolarAngle = 50°`.

- [ ] **Step 1: Write src/camera.js**

```js
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
  // Left = orbit, right = pan (editor claims left-presses on objects first —
  // controls live on the container so the canvas' own listeners run before these).
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
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
```

- [ ] **Step 2: Replace src/main.js with the scene bootstrap**

```js
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
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://localhost:5173/`. Expected, checked by hand or via browser automation:
1. Green ground with a 2 m grid, blue sky, no console errors.
2. Left-drag rotates the camera; dragging further up/down is **stopped** at the 40°/55° pitch limits.
3. Wheel zooms in/out and stops at close/far limits.
4. Right-drag pans.
5. `รีเซ็ตกล้อง` button is not wired yet (Task 8) — ignore it.
Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/camera.js src/main.js
git commit -m "feat: clamped orbit camera and scene bootstrap"
```

---

### Task 5: catalog.js — manifest, model cache, thumbnails

**Files:**
- Create: `src/catalog.js`

**Interfaces:**
- Produces (used by Tasks 6, 7, 8):
  - `fetchManifest() -> Promise<ManifestEntry[]>` — fetches `/manifest.json`, throws Error with the `gen_manifest.py` hint if missing. Manifest entry: `{name, file, category, size:[w,h,d]}`.
  - `getManifest() -> ManifestEntry[] | null`
  - `has(name: string) -> boolean`
  - `groupByCategory(items) -> Map<string, ManifestEntry[]>`
  - `loadModel(name) -> Promise<THREE.Object3D>` — resolves a fresh instance per call (deep clone, **cloned materials per instance**, cast/receiveShadow on). Resolves a pink wireframe placeholder (sized from manifest footprint, min 0.5 m) instead of rejecting. Concurrent calls for the same name share one load.
  - `makeThumb(name) -> Promise<string>` — 96×96 PNG dataURL, rendered with textures fully loaded, cached in memory.

- [ ] **Step 1: Write src/catalog.js**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const KIT_BASE = '/kit/';

const prototypes = new Map(); // name -> original Object3D
const inflight = new Map();   // name -> Promise<boolean: loaded ok>
const thumbs = new Map();     // name -> dataURL
let manifest = null;

let thumbRenderer, thumbScene, thumbCamera;

export async function fetchManifest() {
  const res = await fetch('/manifest.json');
  if (!res.ok) throw new Error(`manifest.json ${res.status} — run: python3 scripts/gen_manifest.py`);
  manifest = await res.json();
  return manifest;
}

export function getManifest() {
  return manifest;
}

export function has(name) {
  return !!manifest?.some((e) => e.name === name);
}

export function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return groups;
}

// Per-model LoadingManager so onLoad fires only after the .bin AND textures finished.
function loadGLTF(name) {
  return new Promise((resolve, reject) => {
    let gltf = null;
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => resolve(gltf);
    new GLTFLoader(manager).load(
      KIT_BASE + name + '.gltf',
      (result) => { gltf = result; },
      undefined,
      reject
    );
  });
}

export function loadModel(name) {
  if (prototypes.has(name)) return Promise.resolve(instantiate(prototypes.get(name)));
  if (!inflight.has(name)) {
    inflight.set(
      name,
      loadGLTF(name)
        .then((gltf) => { prototypes.set(name, gltf.scene); inflight.delete(name); return true; })
        .catch(() => { inflight.delete(name); return false; })
    );
  }
  return inflight.get(name).then((ok) => (ok ? instantiate(prototypes.get(name)) : placeholder(name)));
}

function instantiate(proto) {
  const obj = proto.clone(true);
  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone(); // per-instance: highlight must not leak to siblings
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return obj;
}

function placeholder(name) {
  console.warn(`model missing: ${name}`);
  const entry = manifest?.find((e) => e.name === name);
  const s = entry?.size ?? [1, 1, 1];
  const geo = new THREE.BoxGeometry(Math.max(s[0], 0.5), Math.max(s[1], 0.5), Math.max(s[2], 0.5));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }));
}

export function makeThumb(name) {
  if (thumbs.has(name)) return Promise.resolve(thumbs.get(name));
  if (!thumbRenderer) initThumbStage();
  return loadModel(name).then((obj) => {
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
    thumbs.set(name, url);
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
```

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev`, open the page, and in the browser console run:

```js
const c = await import('/src/catalog.js');
const items = await c.fetchManifest();
items.length;               // expect 176
const obj = await c.loadModel('Floor_Brick');
obj.userData;               // Object (fresh instance, no error)
await c.makeThumb('Floor_Brick');  // expect a "data:image/png;base64,..." string
await c.loadModel('Nope_Missing'); // console shows "model missing: Nope_Missing"; resolves an Object (wireframe)
```

Expected: all checks pass, no unhandled rejections. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/catalog.js
git commit -m "feat: asset catalog with cached loading and thumbnails"
```

---

### Task 6: editor.js — placement, selection, move, rotate, delete

**Files:**
- Create: `src/editor.js`
- Modify: `src/main.js` (create editor, temporary `window.editor` for console testing)

**Interfaces:**
- Consumes: `snapToGrid`, `quantizeRotY` from `lib.js`; `loadModel` from catalog (passed in).
- Produces: `createEditor({ scene, camera, controls, dom, catalog, onChange, onSelection }) -> editor` where:
  - `onChange()` fires after any scene mutation (place/move/rotate/delete) — main.js uses it for autosave.
  - `onSelection(instance | null)` fires on select/deselect; `instance = { id: number, asset: string, obj: THREE.Object3D }`.
  - `setPlace(assetName: string)` — enters placement mode (ghost follows cursor, snapped; `R` rotates ghost 90° CW; click places and stays in mode; `Esc` cancels).
  - `cancelPlace()`, `deleteSelected()`, `rotateSelected90()` (90° CW), `getSelected() -> instance | null`, `changed()` (call after panel edits), `getObjects() -> [{asset, pos:[x,y,z], rotY:number(deg), scale:[x,y,z]}]`, `loadObjects(list) -> Promise<{missing: string[]}>` (skips assets not in catalog), `clear()`.
  - Interaction rules: click (≤6 px move) selects; drag on a selected object moves it snapped on X/Z (Y unchanged); left-press on an object sets `controls.enabled = false` until pointerup so the camera does not orbit while moving; `R`/`Del`/`Backspace`/`Esc` ignored while typing in an input.

- [ ] **Step 1: Write src/editor.js**

```js
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
```

- [ ] **Step 2: Wire editor into main.js (append before the render loop)**

```js
import { createEditor } from './editor.js';

const cam = createCamera(viewport); // (already exists from Task 4 — keep the single call)

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
```

(`import * as catalog from './catalog.js'` added to the import block.)

- [ ] **Step 3: Verify interactions in the browser**

Run: `npm run dev`. In the console:

```js
await editor.setPlace('Floor_Brick');
```

Then, in the viewport:
1. Ghost of the floor follows the cursor, snapped to the 2 m grid; left-click places it and the ghost stays for the next placement. Place 2–3 tiles; they align seamlessly.
2. Press `R` while placing → ghost rotates 90°.
3. `Esc` → ghost disappears.
4. Click a placed tile → it highlights (emissive tint) and console logs `selection Floor_Brick`.
5. Drag it → it moves snapped to the grid; the camera does **not** orbit during the drag; on release console logs `changed`.
6. Left-drag on empty ground → camera orbits normally.
7. With a tile selected, press `Del` → it disappears, console logs `changed`.
No console errors. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/editor.js src/main.js
git commit -m "feat: grid-snapped placement, selection, move, rotate, delete"
```

---

### Task 7: Palette UI (search, categories, thumbnails)

**Files:**
- Modify: `src/main.js` (palette building + search; replace the Task 6 console callbacks where noted)

**Interfaces:**
- Consumes: `fetchManifest`, `groupByCategory`, `makeThumb` from catalog; `CATEGORY_ORDER` from lib; `editor.setPlace`.
- Produces: left sidebar renders one collapsible `<details>` per category (`{Cat} ({count})`); expanding lazily renders item buttons (thumbnail + name) that call `editor.setPlace(name)`; the search box filters by name substring across all categories and auto-expands matches.

- [ ] **Step 1: Add palette code to main.js**

```js
import { CATEGORY_ORDER } from './lib.js'; // (extend the existing lib import)

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
```

And in the init block (Task 8 adds startup restore — for now the manifest fetch):

```js
let allItems = [];
try {
  allItems = await catalog.fetchManifest();
  renderPalette(allItems, false);
} catch (err) {
  const banner = document.getElementById('banner');
  banner.textContent = err.message;
  banner.hidden = false;
}
```

Keep `window.editor` from Task 6 (harmless dev hook).

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev`. Expected:
1. Sidebar lists 13 categories with counts (Floor (12), Roof (39), …).
2. Expanding `Roof` renders thumbnails after a short load; images show actual textured models, not blank.
3. Typing `brick` in search collapses to matching items across categories, auto-expanded.
4. Clearing search restores the full category list.
5. Clicking any palette item starts ghost placement (from Task 6 behavior).
Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: searchable categorized palette with lazy thumbnails"
```

---

### Task 8: storage.js + toolbar (New / Save / Load / autosave / reset cam / grid toggle)

**Files:**
- Create: `src/storage.js`
- Modify: `src/main.js` (toolbar wiring; real onChange autosave; startup restore)

**Interfaces:**
- Consumes: `serializeMap`, `deserializeMap` from lib; editor API from Task 6.
- Produces:
  - `saveMapFile(doc)` — browser download `<mapName>.json`.
  - `openMapFile() -> Promise<doc | null | {error: string}>` — file picker; parses+validates via `deserializeMap`.
  - `scheduleAutosave(doc)` — debounced 500 ms to localStorage key `mve.autosave`.
  - `readAutosave() -> doc | null`, `clearAutosave()`.

- [ ] **Step 1: Write src/storage.js**

```js
import { deserializeMap } from './lib.js';

const AUTOSAVE_KEY = 'mve.autosave';
let timer = null;

export function saveMapFile(doc) {
  const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.mapName || 'map'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function openMapFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(deserializeMap(await file.text()));
      } catch (err) {
        resolve({ error: err.message });
      }
    };
    input.click();
  });
}

export function scheduleAutosave(doc) {
  clearTimeout(timer);
  timer = setTimeout(() => localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc)), 500);
}

export function readAutosave() {
  const text = localStorage.getItem(AUTOSAVE_KEY);
  if (!text) return null;
  try {
    return deserializeMap(text);
  } catch {
    return null;
  }
}

export function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
}
```

- [ ] **Step 2: Wire toolbar + autosave + restore in main.js**

Replace the Task 6 `onChange`/`onSelection` console callbacks and the init block:

```js
import * as storage from './storage.js';
import { serializeMap } from './lib.js'; // (extend the existing lib import)

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
  onSelection: onSelection, // Task 9 fills this in; keep a no-op `() => {}` until then
});

document.getElementById('btn-new').onclick = () => {
  if (editor.getObjects().length && !confirm('ล้าง map ปัจจุบัน?')) return;
  editor.clear();
  storage.clearAutosave();
  toast('เริ่ม map ใหม่แล้ว');
};

document.getElementById('btn-save').onclick = () => storage.saveMapFile(currentDoc());

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

let allItems = [];
try {
  allItems = await catalog.fetchManifest();
  renderPalette(allItems, false);
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
```

Remove `window.editor = editor` and its console callbacks (dev hook no longer needed).

- [ ] **Step 3: Verify persistence end-to-end**

Run: `npm run dev`. Expected:
1. Place 3 objects → wait 1 s → reload the page → toast `กู้คืน autosave 3 ชิ้น…` and the objects are back.
2. `บันทึก` downloads `my-village.json` containing `{"version":1,"gridSize":2,...}` with 3 objects.
3. `ใหม่` clears the scene (native confirm appears when objects exist).
4. `เปิดไฟล์` → pick the downloaded file → objects restored, toast without "ข้าม".
5. Hand-edit the JSON to `"version": 9`, load it → toast `เปิดไฟล์ไม่สำเร็จ: unsupported map version: 9`, scene unchanged.
6. `รีเซ็ตกล้อง` restores the default 50° view; `Grid` toggles grid lines.
Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/storage.js src/main.js
git commit -m "feat: map save/load files, autosave, toolbar actions"
```

---

### Task 9: Properties panel

**Files:**
- Modify: `src/main.js` (panel binding; replace the `onSelection` no-op)

**Interfaces:**
- Consumes: editor `getSelected/rotateSelected90/deleteSelected/changed`.
- Produces: selecting an object shows the panel (name + editable X/Y/Z, rotation °, scale X/Y/Z); inputs apply live to the object (`X/Z` free-form numbers, `Y` step 0.25 m for stacking); `+90°` rotates 90° CW; `สเกล 1:1:1` resets scale; `ลบ` deletes. Deselect hides the panel. Panel edits trigger autosave via `editor.changed()`.

- [ ] **Step 1: Add panel code to main.js**

```js
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
```

Note: `onSelection` must be defined before `createEditor` references it — declare the function above the editor creation in the file, or rely on function hoisting (it is a function declaration, so hoisting applies).

- [ ] **Step 2: Verify in the browser**

Run: `npm run dev`. Expected:
1. Click an object → panel appears on the right with its asset name; outline of values matches its position.
2. Change `ตำแหน่ง Y` to `3` → the object lifts 3 m (wall height step); change `หมุน (°)` to `45` → free rotation applied.
3. `+90°` rotates; `สเกล 1:1:1` resets any scale; `ลบ` removes the object and hides the panel.
4. Click empty ground → panel hides.
5. Reload after edits → autosave restored the edited transforms.
6. Typing numbers in panel inputs does NOT trigger `R`/`Del` shortcuts (keyboard guard).
Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: properties panel for selected object transforms"
```

---

### Task 10: README + full verification pass

**Files:**
- Create: `README.md`

**Interfaces:** none (docs + acceptance).

- [ ] **Step 1: Write README.md**

````markdown
# Pixel Rig Style — 3D Map Editor

Web-based 3D map editor สำหรับต่อบ้าน/หมู่บ้านจากชุด Medieval Village MegaKit
บน grid 2 เมตร มองมุมสูง 40–55° ซูม/หมุนกล้องได้ บันทึก/เปิด map เป็นไฟล์ JSON

## ติดตั้ง

```bash
npm install
python3 scripts/gen_manifest.py   # หลังจากขั้นตอน copy asset ด้านล่าง
npm run dev                       # http://localhost:5173
```

## เตรียม asset (ครั้งเดียว)

asset ไม่ได้อยู่ใน git (license + ขนาด) — copy จาก zip เอง:

```bash
mkdir -p public/kit assets
ditto -x -k "/path/to/Medieval Village MegaKit[Standard].zip" assets/
ditto "assets/Medieval Village MegaKit[Standard]/glTF" public/kit
python3 scripts/gen_manifest.py
```

## การใช้งาน

- **กล้อง:** ลากซ้าย = หมุน (ล็อกมุม 40–55°), ลากขวา = แพน, ล้อเมาส์ = ซูม, ปุ่มรีเซ็ตกล้อง
- **วาง:** เลือกชิ้นจาก palette ซ้าย (ค้นหาได้) → ghost เดินตามเมาส์ → คลิกวาง (วางซ้ำได้เรื่อย ๆ)
- `R` หมุน 90°, `Esc` ยกเลิก/ยกเลิกเลือก, `Del` ลบ
- **แก้ไข:** คลิกชิ้น → แผงขวา (ตำแหน่ง/หมุน/สเกล) — ลากชิ้นที่เลือกเพื่อย้ายแบบ snap
- **ไฟล์:** บันทึก = ดาวน์โหลด .json, เปิดไฟล์ = เลือก .json, มี autosave ในเบราว์เซอร์ทุกครั้งที่แก้

## ทดสอบ

```bash
npm test   # node:test — snap/rotY/serialize logic
```
````

- [ ] **Step 2: Run the full verification pass**

Run: `npm test` → expect `5 pass, 0 fail`.
Run: `npm run dev` and walk this checklist (manual or browser automation):

1. Camera: orbit clamps at 40°/55° pitch; zoom stops at near/far limits; pan works; reset works.
2. Palette: 13 categories, thumbnails render, search filters.
3. Place: ghost snaps, `R` rotates, click places repeatedly, `Esc` cancels.
4. Edit: select highlights, drag moves snapped, panel edits apply, `+90°`, scale reset, `Del`.
5. Persistence: autosave restore on reload; save downloads valid JSON (`npm_prettier` not needed — eyeball `{version:1,gridSize:2}`); load restores; version-9 file rejected with toast and scene intact.
6. No console errors during the whole pass.

Fix anything that fails, re-run until green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: setup and usage guide"
```

---

## Self-Review (done during planning)

- **Spec coverage:** camera clamp/zoom/pan/rotate (Task 4), placement ghost + grid snap + rotate + Esc (Task 6), select/move/delete/panel Y+scale (Tasks 6, 9), palette search/categories/thumbnails (Task 7), manifest generator (Task 2), map JSON v1 + file save/load + autosave + restore toast (Task 8), missing-model placeholder + missing-manifest banner + bad-JSON toast (Tasks 5, 8), node tests for pure logic (Task 3), README (Task 10). No undo/redo/duplicate/terrain — per spec v1 scope.
- **Placeholder scan:** every code step contains complete code; no TBDs.
- **Type consistency:** `instance = {id, asset, obj}` consistent between editor (Task 6) and panel (Task 9); manifest entry `{name, file, category, size}` consistent between generator (Task 2) and catalog (Task 5); doc shape `{version, gridSize, mapName, objects}` consistent between lib (Task 3), storage (Task 8), and the spec.
