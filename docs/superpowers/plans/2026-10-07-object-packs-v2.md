# Object Packs (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the editor from grid-snapped modular pieces to freely placing complete objects from multiple asset packs (Japan Village folder, VillagePack.glb single-file library).

**Architecture:** Same module layout as v1. New "pack" layer: `public/packs/<id>/` holds a `.gltf` folder or a single `.glb`; the manifest becomes an array of packs; `catalog.js` loads per pack (glb packs are loaded once and split by named node) and normalizes every prototype so its bounding-box base sits on y=0, centered on X/Z. `editor.js` replaces mandatory 2 m snapping with free placement + a 1 m snap toggle.

**Tech Stack:** unchanged (Three.js, Vite, vanilla JS, Python stdlib, node:test).

**Spec:** `docs/superpowers/specs/2026-10-07-3d-map-editor-design.md` (Revision v2 section).

**Source packs (already on disk):**
- `/tmp/packcheck/FreePack/GLTF/` (from `/Users/bic-patanaphong/Downloads/Free_JapanVillage.zip`)
- `/tmp/packcheck/VillagePack.glb` (from `/Users/bic-patanaphong/Downloads/VillagePack.rar`)
Re-extract with the commands in Task 1 if `/tmp/packcheck` is gone.

## Global Constraints

- Map document v2: `{version: 2, gridSize: 1, mapName, objects: [{pack, asset, pos:[x,y,z], rotY, scale:[x,y,z]}]}`; `deserializeMap` accepts versions 1 and 2, rejects others. v1 objects (no `pack`) load as missing and are reported.
- Snap: free placement default; snap unit **1 m** when toggled on. `R` still rotates 90°.
- Every prototype normalized: X/Z center at origin, bbox base at y=0; runtime size on `obj.userData.size = [w,h,d]`.
- Medieval kit fully removed from palette and `public/kit/` deleted; `public/packs/` git-ignored; `public/manifest.json` committed.
- Expected pack contents: `japan-village` = 35 entries, `village-pack` = 84 entries.
- Palette: Pack → category (prefix before first `_`) → items; search spans all packs.
- UI copy Thai; code/comments English. No undo/redo/duplicate (still v2 exclusions).

---

### Task 1: Packs on disk + gen_manifest.py v2

**Files:**
- Create: `public/packs/japan-village/` (copied, not committed)
- Create: `public/packs/village-pack/VillagePack.glb` (copied, not committed)
- Delete: `public/kit/`
- Modify: `.gitignore` (`public/kit/` → `public/packs/`)
- Modify: `scripts/gen_manifest.py`
- Create: `public/manifest.json` (generated, committed)

**Interfaces:**
- Produces: `public/manifest.json` — array of packs:
  `{"id": "japan-village", "name": "Japan Village", "type": "gltf-folder", "entries": [{"name": "House_4x5", "size": [5.52, 4.78, 6.35]}, ...]}` and
  `{"id": "village-pack", "name": "Village Pack", "type": "glb", "file": "VillagePack.glb", "entries": [{"name": "altar", "size": [2.42, 5.03, 2.42]}, ...]}`
  (glb entry size = accessor bounds × node scale, rounded 2dp; entries sorted by name).

- [ ] **Step 1: Copy packs, remove kit**

```bash
mkdir -p public/packs/japan-village public/packs/village-pack
if [ ! -d /tmp/packcheck/FreePack/GLTF ]; then
  mkdir -p /tmp/packcheck && cd /tmp/packcheck && \
  ditto -x -k /Users/bic-patanaphong/Downloads/Free_JapanVillage.zip . && \
  bsdtar -xf /Users/bic-patanaphong/Downloads/VillagePack.rar && cd - > /dev/null
fi
ditto /tmp/packcheck/FreePack/GLTF public/packs/japan-village
cp /tmp/packcheck/VillagePack.glb public/packs/village-pack/
rm -rf public/kit
ls public/packs/japan-village/*.gltf | wc -l   # expect 35
```

- [ ] **Step 2: Update .gitignore** — replace the line `public/kit/` with `public/packs/`.

- [ ] **Step 3: Rewrite scripts/gen_manifest.py**

```python
#!/usr/bin/env python3
"""Scan public/packs/* -> public/manifest.json (array of packs).

Pack types:
  gltf-folder: a directory of *.gltf files (each = one object)
  glb:         a single .glb whose named mesh nodes are the objects
"""
import json
import os
import struct
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
PACKS_DIR = os.path.join(ROOT, 'public', 'packs')
OUT = os.path.join(ROOT, 'public', 'manifest.json')


def gltf_size(path):
    """[w, h, d] from POSITION accessor min/max."""
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
    return [round(maxs[i] - mins[i], 2) for i in range(3)]


def glb_nodes(path):
    """Named mesh nodes of a .glb with size = bounds * node scale."""
    with open(path, 'rb') as f:
        data = f.read()
    chunk_len, chunk_type = struct.unpack_from('<II', data, 12)
    d = json.loads(data[20:20 + chunk_len])
    entries = []
    for node in d.get('nodes', []):
        if 'mesh' not in node or not node.get('name'):
            continue
        scale = node.get('scale', [1, 1, 1])
        mins = [1e9] * 3
        maxs = [-1e9] * 3
        mesh = d['meshes'][node['mesh']]
        for prim in mesh.get('primitives', []):
            acc = d['accessors'][prim['attributes']['POSITION']]
            for i in range(3):
                mins[i] = min(mins[i], acc['min'][i] * scale[i])
                maxs[i] = max(maxs[i], acc['max'][i] * scale[i])
        size = [round(maxs[i] - mins[i], 2) for i in range(3)]
        entries.append({'name': node['name'], 'size': size})
    entries.sort(key=lambda e: e['name'])
    return entries


def main():
    packs = []
    for dir_name in sorted(os.listdir(PACKS_DIR)):
        pack_dir = os.path.join(PACKS_DIR, dir_name)
        if not os.path.isdir(pack_dir):
            continue
        glb_files = [f for f in os.listdir(pack_dir) if f.endswith('.glb')]
        gltf_files = sorted(f[:-5] for f in os.listdir(pack_dir) if f.endswith('.gltf'))
        if glb_files:
            assert len(glb_files) == 1, f'{dir_name}: expected one .glb'
            packs.append({
                'id': dir_name,
                'name': dir_name.replace('-', ' ').title(),
                'type': 'glb',
                'file': glb_files[0],
                'entries': glb_nodes(os.path.join(pack_dir, glb_files[0])),
            })
        elif gltf_files:
            packs.append({
                'id': dir_name,
                'name': dir_name.replace('-', ' ').title(),
                'type': 'gltf-folder',
                'entries': [
                    {'name': name, 'size': gltf_size(os.path.join(pack_dir, name + '.gltf'))}
                    for name in gltf_files
                ],
            })
    assert len(packs) == 2, f'expected 2 packs, found {len(packs)}'
    by_id = {p['id']: p for p in packs}
    assert len(by_id['japan-village']['entries']) == 35, 'japan-village should have 35 objects'
    assert len(by_id['village-pack']['entries']) == 84, 'village-pack should have 84 objects'
    for p in packs:
        assert all(e['size'][0] > 0 and e['size'][1] > 0 and e['size'][2] > 0 for e in p['entries']), \
            f"degenerate size in {p['id']}"
    with open(OUT, 'w') as f:
        json.dump(packs, f, indent=1)
    total = sum(len(p['entries']) for p in packs)
    print(f'wrote {OUT}: {len(packs)} packs, {total} objects')
    for p in packs:
        print(f"  {p['id']} ({p['type']}): {len(p['entries'])} objects")


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 4: Run and verify**

Run: `python3 scripts/gen_manifest.py`
Expected: `wrote .../public/manifest.json: 2 packs, 119 objects`, then `japan-village (gltf-folder): 35 objects` and `village-pack (glb): 84 objects`. Assert failures mean the copy step is wrong.

- [ ] **Step 5: Commit**

```bash
git add .gitignore scripts/gen_manifest.py public/manifest.json
git commit -m "feat: pack-based manifest generator (japan-village, village-pack)"
```

---

### Task 2: lib.js v2 (TDD)

**Files:**
- Modify: `src/lib.js`
- Modify: `test/lib.test.mjs`

**Interfaces:**
- Produces: `MAP_VERSION = 2`, `SNAP_SIZE = 1` (`GRID_SIZE` deleted), `serializeMap` emits `pack` per object and `gridSize: 1`; `deserializeMap` accepts versions 1 and 2, rejects others. `snapToGrid`, `quantizeRotY`, `CATEGORY_ORDER` (still used for category prefixes) unchanged.

- [ ] **Step 1: Update the failing test** (change the imports to drop `GRID_SIZE`, add `SNAP_SIZE`; roundtrip objects carry `pack`; version tests: accepts 1 and 2, rejects 3)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SNAP_SIZE, MAP_VERSION,
  snapToGrid, quantizeRotY,
  serializeMap, deserializeMap,
} from '../src/lib.js';

test('snapToGrid rounds to the lattice', () => {
  assert.equal(snapToGrid(3.7), 4);
  assert.equal(snapToGrid(3.4), 4);
  assert.equal(snapToGrid(1), 1);
  assert.equal(snapToGrid(0), 0);
  assert.equal(snapToGrid(-1.2), -1);
  assert.equal(snapToGrid(5, 5), 5);
});

test('quantizeRotY snaps to 90° steps, normalized 0-270', () => {
  assert.equal(quantizeRotY(95), 90);
  assert.equal(quantizeRotY(450), 90);
  assert.equal(quantizeRotY(-15), 0);
  assert.equal(quantizeRotY(270), 270);
});

test('serialize -> deserialize round-trips objects with pack', () => {
  const objects = [{ pack: 'japan-village', asset: 'House_4x5', pos: [2, 0, 4], rotY: 90, scale: [1, 1, 1] }];
  const doc = serializeMap('test-map', objects);
  assert.equal(doc.version, MAP_VERSION);
  assert.equal(doc.gridSize, SNAP_SIZE);
  assert.equal(doc.mapName, 'test-map');
  const back = deserializeMap(JSON.stringify(doc));
  assert.deepEqual(back.objects, objects);
});

test('deserializeMap accepts legacy v1 docs', () => {
  const v1 = { version: 1, gridSize: 2, mapName: 'old', objects: [{ asset: 'A', pos: [0, 0, 0], rotY: 0, scale: [1, 1, 1] }] };
  assert.equal(deserializeMap(JSON.stringify(v1)).version, 1);
});

test('deserializeMap rejects bad input', () => {
  assert.throws(() => deserializeMap('not json'));
  assert.throws(() => deserializeMap(JSON.stringify({ version: 3, objects: [] })));
  assert.throws(() => deserializeMap(JSON.stringify({ version: MAP_VERSION })));
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` FAILS (`SNAP_SIZE` not exported, version mismatch).

- [ ] **Step 3: Update src/lib.js** — constants become

```js
export const SNAP_SIZE = 1;       // optional snap unit (m); free placement by default
export const MAP_EXTENT = 128;    // 64x64 m of ground
export const MAP_VERSION = 2;
```

`serializeMap` becomes

```js
export function serializeMap(mapName, objects) {
  return {
    version: MAP_VERSION,
    gridSize: SNAP_SIZE,
    mapName,
    objects: objects.map((o) => ({
      pack: o.pack,
      asset: o.asset,
      pos: [...o.pos],
      rotY: o.rotY,
      scale: [...o.scale],
    })),
  };
}
```

`deserializeMap` version check becomes

```js
if (![1, MAP_VERSION].includes(doc.version)) throw new Error(`unsupported map version: ${doc.version}`);
```

- [ ] **Step 4: Run to verify pass** — `npm test` → 5 pass, 0 fail.

- [ ] **Step 5: Commit** — `git add src/lib.js test/lib.test.mjs && git commit -m "feat: map format v2 with pack field and 1m snap"`

---

### Task 3: catalog.js — pack loading, glb node extraction, normalization

**Files:**
- Modify: `src/catalog.js` (full rework of loading; grouping/thumbnails kept)

**Interfaces:**
- Consumes: manifest array of packs (Task 1).
- Produces:
  - `fetchManifest()` → packs array (throws with gen_manifest hint if missing)
  - `getPacks()`, `has(pack, name)`, `entrySize(pack, name) -> [w,h,d] | null`
  - `loadModel(pack, name)` → Promise<Object3D> — fresh instance per call, per-instance cloned materials, cast/receiveShadow, **normalized: X/Z centered, base at y=0**, `obj.userData.size = [w,h,d]` (measured after normalization). Never rejects (placeholder fallback). Inflight dedupe per `pack/name`.
  - `groupByPack(packs) -> Map<packId, entries[]>`; `packName(id) -> string`
  - `makeThumb(pack, name)` → dataURL (unchanged mechanism)
- glb packs: the .glb is loaded once per pack and cached; a node is extracted by exact name match from the loaded scene.

- [ ] **Step 1: Rewrite src/catalog.js**

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const prototypes = new Map(); // "pack/name" -> normalized prototype
const inflight = new Map();   // "pack/name" -> Promise<boolean: ok>
const thumbs = new Map();     // "pack/name" -> dataURL
const glbCache = new Map();   // pack id -> loaded glb scene (for 'glb' packs)
let manifest = null;

let thumbRenderer, thumbScene, thumbCamera;

export async function fetchManifest() {
  const res = await fetch('/manifest.json');
  if (!res.ok) throw new Error(`manifest.json ${res.status} — run: python3 scripts/gen_manifest.py`);
  manifest = await res.json();
  return manifest;
}

export function getPacks() {
  return manifest ?? [];
}

export function packName(id) {
  return manifest?.find((p) => p.id === id)?.name ?? id;
}

export function has(pack, name) {
  const p = manifest?.find((x) => x.id === pack);
  return !!p?.entries?.some((e) => e.name === name);
}

export function entrySize(pack, name) {
  const p = manifest?.find((x) => x.id === pack);
  return p?.entries?.find((e) => e.name === name)?.size ?? null;
}

export function groupByPack(packs) {
  const groups = new Map();
  for (const p of packs) groups.set(p.id, p.entries);
  return groups;
}

function key(pack, name) {
  return `${pack}/${name}`;
}

// Per-model LoadingManager: onLoad fires only after .bin AND textures finished.
function loadGLTF(url) {
  return new Promise((resolve, reject) => {
    let gltf = null;
    const manager = new THREE.LoadingManager();
    manager.onLoad = () => resolve(gltf);
    new GLTFLoader(manager).load(url, (result) => { gltf = result; }, undefined, reject);
  });
}

// Re-centre: X/Z center at origin, bbox base on y=0. Records measured size.
function normalizePrototype(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const wrapper = new THREE.Group();
  obj.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  wrapper.add(obj);
  wrapper.userData.size = [+size.x.toFixed(3), +size.y.toFixed(3), +size.z.toFixed(3)];
  return wrapper;
}

async function getPrototype(pack, name) {
  const k = key(pack, name);
  if (prototypes.has(k)) return prototypes.get(k);
  const entry = manifest.find((p) => p.id === pack);
  if (!entry) throw new Error(`unknown pack: ${pack}`);
  let raw;
  if (entry.type === 'glb') {
    if (!glbCache.has(pack)) {
      const gltf = await loadGLTF('/packs/' + pack + '/' + entry.file);
      glbCache.set(pack, gltf.scene);
    }
    const scene = glbCache.get(pack);
    let node = null;
    scene.traverse((c) => { if (!node && c.name === name && c.isMesh) node = c; });
    if (!node) throw new Error(`node not found in ${pack}: ${name}`);
    // detach a copy of the node (with its transform) as a standalone object
    raw = node.clone(true);
  } else {
    const gltf = await loadGLTF('/packs/' + pack + '/' + name + '.gltf');
    raw = gltf.scene;
  }
  const proto = normalizePrototype(raw);
  prototypes.set(k, proto);
  return proto;
}

export function loadModel(pack, name) {
  const k = key(pack, name);
  if (prototypes.has(k)) return Promise.resolve(instantiate(prototypes.get(k)));
  if (!inflight.has(k)) {
    inflight.set(
      k,
      getPrototype(pack, name)
        .then((proto) => { inflight.delete(k); return true; })
        .catch((err) => { console.warn(`model missing: ${pack}/${name}`, err); inflight.delete(k); return false; })
    );
  }
  return inflight.get(k).then((ok) => (ok ? instantiate(prototypes.get(k)) : placeholder(pack, name)));
}

function instantiate(proto) {
  const obj = proto.clone(true);
  obj.userData.size = proto.userData.size;
  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone(); // per-instance: highlight must not leak
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return obj;
}

function placeholder(pack, name) {
  const s = entrySize(pack, name) ?? [1, 1, 1];
  const geo = new THREE.BoxGeometry(Math.max(s[0], 0.5), Math.max(s[1], 0.5), Math.max(s[2], 0.5));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }));
}

export function makeThumb(pack, name) {
  const k = key(pack, name);
  if (thumbs.has(k)) return Promise.resolve(thumbs.get(k));
  if (!thumbRenderer) initThumbStage();
  return loadModel(pack, name).then((obj) => {
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
    thumbs.set(k, url);
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

- [ ] **Step 2: Verify** — `npm run dev` + `npx vite build` succeed (nothing imports the new signatures yet; main.js is updated in Task 5, so the app is temporarily broken between Task 3 and Task 5 — verify with build only, note it).

- [ ] **Step 3: Commit** — `git add src/catalog.js && git commit -m "feat: pack-aware catalog with glb node extraction and base normalization"`

---

### Task 4: editor.js — free placement + snap toggle

**Files:**
- Modify: `src/editor.js`

**Interfaces:**
- Consumes: `snapToGrid` (1 m), `loadModel(pack, name)`, `has(pack, name)` from catalog.
- Produces:
  - `setPlace(pack, assetName)`, rest of the v1 API unchanged in shape
  - `setSnap(on)`, `getSnap()` — when on, X/Z positions round to 1 m; when off, positions round to 0.01 m (float-noise guard)
  - instances `{id, pack, asset, obj}`; `getObjects()` emits `{pack, asset, pos, rotY, scale}`; `loadObjects(list)` uses `catalog.has(entry.pack, entry.asset)`
  - keeps the window-level pointermove/pointerup listeners, setPointerCapture on drags, panel re-sync after drag/R (v1 fixes)

- [ ] **Step 1: Apply these changes to src/editor.js**

1. Import `SNAP_SIZE` instead of nothing extra (snapToGrid already imported):

```js
import { snapToGrid, quantizeRotY, SNAP_SIZE } from './lib.js';
```

2. Snap state + position rounding (add near the top, inside `createEditor`, after `let nextId = 1;`):

```js
  let snap = false;

  function rounded(v) {
    const q = snap ? SNAP_SIZE : 0.01;
    return Math.round(v / q) * q;
  }
```

3. Placement — `setPlace` signature and ghost loading:

```js
  let placing = null;   // { pack, asset } being placed
```

(replaces the `let placing = null; // asset name being placed` line)

```js
  async function setPlace(pack, assetName) {
    cancelPlace();
    placing = { pack, asset: assetName };
    const model = await catalog.loadModel(pack, assetName);
    if (placing?.asset !== assetName) return; // user switched away while loading
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
```

4. In `onPointerMove`, replace the two `snapToGrid(p.x)` / `snapToGrid(p.z)` calls with `rounded(p.x)` / `rounded(p.z)` (both the ghost branch and the dragging branch).

5. In the `onPointerUp` place branch:

```js
    if (placing && ghost) {
      const p = groundPoint(e);
      if (p) ghost.position.set(rounded(p.x), 0, rounded(p.z));
      // onChange must wait for the instance to exist, or the autosave misses it
      addInstance(placing.pack, placing.asset, ghost.position.clone(), quantizeRotY(THREE.MathUtils.radToDeg(ghost.rotation.y))).then(onChange);
      return; // stay in placing mode for rapid placement
    }
```

6. `addInstance` gains pack:

```js
  async function addInstance(pack, asset, position, rotY, scale = [1, 1, 1]) {
    const obj = await catalog.loadModel(pack, asset);
    obj.position.copy(position);
    obj.rotation.y = THREE.MathUtils.degToRad(rotY);
    obj.scale.set(...scale);
    const inst = { id: nextId++, pack, asset, obj };
    obj.userData.editorRoot = inst;
    group.add(obj);
    objects.push(inst);
    return inst;
  }
```

7. `getObjects` emits pack:

```js
  function getObjects() {
    return objects.map((o) => ({
      pack: o.pack,
      asset: o.asset,
      pos: [
        +o.obj.position.x.toFixed(2),
        +o.obj.position.y.toFixed(3),
        +o.obj.position.z.toFixed(2),
      ],
      rotY: +THREE.MathUtils.radToDeg(o.obj.rotation.y).toFixed(2),
      scale: [o.obj.scale.x, o.obj.scale.y, o.obj.scale.z],
    }));
  }
```

8. `loadObjects` validates pack+asset and passes pack:

```js
      if (!catalog.has(entry.pack, entry.asset)) {
        if (!missing.includes(entry.asset)) missing.push(entry.asset);
        continue;
      }
      try {
        await addInstance(
          entry.pack,
          entry.asset,
          new THREE.Vector3(...entry.pos),
          entry.rotY ?? 0,
          entry.scale ?? [1, 1, 1]
        );
      } catch (err) {
        console.warn('skipped bad object entry', entry, err);
      }
```

9. Snap API in the returned object:

```js
  return {
    setPlace, cancelPlace, deleteSelected, rotateSelected90,
    setSnap: (on) => { snap = !!on; },
    getSnap: () => snap,
    getSelected: () => selected,
    changed: onChange,
    getObjects, loadObjects, clear,
  };
```

- [ ] **Step 2: Verify** — `npx vite build` (main.js still calls the old signature; full app verification happens in Task 5/6), `npm test` 5/5.

- [ ] **Step 3: Commit** — `git add src/editor.js && git commit -m "feat: free placement with 1m snap toggle and pack-aware instances"`

---

### Task 5: main.js + index.html — pack palette, snap button

**Files:**
- Modify: `index.html` (add Snap button)
- Modify: `src/main.js` (palette two levels; snap wiring; import SNAP_SIZE for grid helper)

**Interfaces:**
- Consumes: catalog `fetchManifest/getPacks/groupByPack/makeThumb/loadModel`; editor `setPlace(pack, name)`, `setSnap/getSnap`; lib `SNAP_SIZE`.
- Produces: palette renders Pack → category → items; toolbar "Snap 1m" button toggles (`.active` class); grid helper lines at 1 m.

- [ ] **Step 1: index.html** — add next to the Grid button:

```html
    <button id="btn-snap">Snap 1m</button>
```

- [ ] **Step 2: src/main.js changes**

1. Grid helper subdivision switches to 1 m lines:

```js
import { SNAP_SIZE, MAP_EXTENT, serializeMap, CATEGORY_ORDER } from './lib.js';
// ...
const grid = new THREE.GridHelper(MAP_EXTENT, MAP_EXTENT / SNAP_SIZE, 0x5a7a44, 0x5a7a44);
```

2. Category order helper — categories now derive from a pack's entries; keep `CATEGORY_ORDER` for ordering, extras sorted after:

```js
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
```

3. Palette becomes two-level (replace `renderPalette`/`fillItems`/search handler and the init block):

```js
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
```

4. Init block — fetchManifest now returns packs:

```js
try {
  const packs = await catalog.fetchManifest();
  renderPackPalette(packs, false);
} catch (err) {
  const banner = document.getElementById('banner');
  banner.textContent = err.message;
  banner.hidden = false;
}
```

5. Snap button wiring (next to the Grid button handler):

```js
const btnSnap = document.getElementById('btn-snap');
btnSnap.onclick = () => {
  editor.setSnap(!editor.getSnap());
  btnSnap.classList.toggle('active', editor.getSnap());
};
```

6. In the load/restore paths, `missing` reporting stays (editor returns `{missing}` keyed by asset name).

- [ ] **Step 3: Verify** — `npx vite build` succeeds; `npm test` 5/5; `npm run dev` serves (curl 200). Interactive checks deferred to the controller's browser pass.

- [ ] **Step 4: Commit** — `git add index.html src/main.js && git commit -m "feat: two-level pack palette and snap toggle"`

---

### Task 6: README + CLI verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README** — replace the "เตรียม asset" section with both packs:

````markdown
## เตรียม asset (ครั้งเดียว)

asset pack ไม่ได้อยู่ใน git (สิทธิ์/ขนาด) — copy เอง:

```bash
mkdir -p public/packs/japan-village public/packs/village-pack
# Japan Village (zip): ใช้โฟลเดอร์ GLTF ข้างใน
ditto -x -k "/path/to/Free_JapanVillage.zip" /tmp/pack && ditto /tmp/pack/FreePack/GLTF public/packs/japan-village
# Village Pack (rar): ไฟล์ VillagePack.glb ไฟล์เดียว
bsdtar -xf "/path/to/VillagePack.rar" -C /tmp/pack && cp /tmp/pack/VillagePack.glb public/packs/village-pack/
python3 scripts/gen_manifest.py   # สแกน packs → manifest (คาดหวัง 35 + 84 objects)
```
````

And the usage section: mention free placement + "Snap 1m" toggle, `R`, Del, Esc unchanged.

- [ ] **Step 2: CLI verification** — `npm test` (5/5), `npx vite build`, `npm run dev` + curl page/manifest/model URLs (`/packs/japan-village/House_4x5.gltf`, `/packs/village-pack/VillagePack.glb` → 200). Interactive checks deferred to the controller.

- [ ] **Step 3: Commit** — `git add README.md && git commit -m "docs: pack setup for v2"`

---

## Self-Review (done during planning)

- **Spec coverage:** pack manifest + generator (T1), doc v2 + legacy load (T2), glb node extraction + base normalization + per-instance materials (T3), free placement + snap toggle + pack-aware instances (T4), two-level palette + snap button (T5), docs (T6). Medieval removed (T1 Step 1). v1-map loading reported-missing (T2/T4). Thumbnails, save/load files, autosave, camera clamp unchanged from v1 (verified working).
- **Placeholder scan:** all steps carry complete code/commands; no TBDs.
- **Type consistency:** `setPlace(pack, name)` used by palette (T5) matches editor (T4); `loadModel(pack, name)`/`has(pack, name)` used by editor (T4) match catalog (T3); doc shape `{pack, asset, ...}` consistent across lib (T2), editor (T4), storage passthrough unchanged.
