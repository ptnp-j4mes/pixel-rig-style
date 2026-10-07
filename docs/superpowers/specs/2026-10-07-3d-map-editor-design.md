# 3D Map Editor — Design

Date: 2026-10-07
Status: Approved (design), pending spec review

## Goal

A personal web-based 3D map editor for building medieval-village scenes from the
Medieval Village MegaKit asset pack. The editor renders a top-down 3D view
(camera pitch locked to 40–55°), supports zoom and rotation, and lets the user
place, move, rotate, scale, and delete 3D mesh objects on a 2 m grid, then save
and reload maps as JSON.

## Decisions

- **Platform:** Web, Three.js, Vite + npm (user choice B).
- **Placement:** Grid snap, modular — the kit is built on a 2 m module
  (floors are 2×2 m, walls 2 m wide × 3 m high, roofs named `2x4` = 4×8 m).
  All pieces are modeled centered on origin, resting on y=0.
- **Scope (v1):** place / move / rotate (90° steps + free via panel) / scale via
  panel / delete; palette with search + categories + thumbnails; camera per
  spec; save/load JSON + localStorage autosave. No undo/redo, no duplicate, no
  sculpted terrain (flat ground plane with grid) — deferred.

## Asset facts (measured from glTF accessors)

- `assets` source: `Medieval Village MegaKit[Standard].zip` → `glTF/` folder:
  176 `.gltf` + 176 `.bin` + textures (PBR: baseColor/normal/roughness),
  self-contained, Blender-exported.
- Grid module: 2 m. Pieces sit on y=0, origin at piece center.
- Categories derived from filename prefix: Roof, Wall, Floor, Door, DoorFrame,
  Window, WindowShutters, Stairs, Overhang, Corner, Balcony, HoleCover, Prop.
- FBX/OBJ duplicates in the pack are ignored — web path uses glTF only.
- The kit folder lives at `public/kit/` (Vite serves it at `/kit/...`). The raw
  zip stays out of git (see `.gitignore`); a README note explains copying
  `glTF/*` from the pack into `public/kit/`.

## Architecture

Vite project, vanilla JS modules, no framework.

```
index.html                 # toolbar / left palette / viewport / right properties
package.json               # vite + three
src/main.js                # bootstrap, render loop, wiring
src/camera.js              # OrbitControls setup: pitch clamp, zoom/pan limits, reset
src/editor.js              # tools: place ghost, select, drag-move, rotate, delete
src/catalog.js             # manifest fetch, categories, lazy thumbnails
src/storage.js             # serialize/deserialize, file save/load, localStorage
src/lib.js                 # pure logic: snapToGrid, quantizeRotY, map JSON helpers
scripts/gen_manifest.py    # scans public/kit/*.gltf → public/manifest.json
                           # (name, category, size [w,h,d] from accessor min/max)
test/lib.test.mjs          # node assert: snap math, rotY quantization, JSON round-trip
public/kit/                # 176 glTF models + textures (from asset pack, not in git)
public/manifest.json       # generated catalog
```

Module boundaries: `lib.js` has zero three.js imports (testable in node);
`editor.js` owns all DOM↔scene interaction; `catalog.js` owns asset loading
cache (one GLTFLoader, cache by asset name, `.clone()` per instance);
`storage.js` owns the map document format; `camera.js` only touches the camera
and controls.

## Camera (spec)

- Perspective camera + OrbitControls.
- Default pitch 50° from horizontal. Polar angle clamped to [35°, 50°]
  (= pitch 40–55°). Constants in one place, trivially widened later.
- Wheel = zoom (dolly), distance clamped 4–200 m. Right-drag = pan.
  Left-drag = orbit rotate. Left-click (down/up within 6 px) = select/place —
  a click-vs-drag threshold keeps click editing and orbit from fighting.
- "Reset camera" button restores default position/target.

## Editor interactions

- **Place:** click a palette item → its model loads (cached) and a
  semi-transparent ghost follows the cursor, snapped to the 2 m lattice on X/Z,
  y=0. `R` rotates ghost 90° (CW). Click places a clone; Esc cancels. Placing
  again keeps the tool active for rapid placement.
- **Select:** click object → highlight (emissive tint) + properties panel shows
  asset name, grid position, rotation, scale.
- **Move:** drag selected object → follows ground raycast, snapped to 2 m.
- **Rotate:** `R` or panel button = 90° steps; panel number input = free.
- **Y / scale:** numeric inputs in properties panel (stacking floors, sinking
  props). Y step 0.25 m; scale is per-axis with a "reset to 1" shortcut.
- **Delete:** `Del`/`Backspace` or panel button.
- **Ground:** 128×128 m plane (64×64 cells of 2 m) + GridHelper; grid visibility
  toggle in toolbar. Map size is a constant, not user-configurable in v1.

## Palette

- Left sidebar: search box (substring on asset name) + collapsible categories
  (from manifest). 176 items render as name + thumbnail tiles.
- Thumbnails: rendered in-session — one offscreen renderer renders each model
  once to a 96×96 dataURL the first time its category is expanded; cached in
  memory for the session. Failure → plain initial-letter tile.

## Map document format

```json
{
  "version": 1,
  "gridSize": 2,
  "mapName": "my-village",
  "objects": [
    { "asset": "Floor_Brick", "pos": [2, 0, 4], "rotY": 90, "scale": [1, 1, 1] }
  ]
}
```

- `pos` is the snapped world position of the piece origin (piece center, base
  on y=0); `rotY` degrees, multiple of 90 in practice (free values preserved).
- **Save** = browser download of `<mapName>.json`. **Load** = file picker;
  unknown/missing assets are skipped and reported in a toast listing them.
- **Autosave** to localStorage on every mutation (debounced 500 ms), restored
  on open with a toast ("restored autosave — New Map to start fresh").

## Error handling

- Model file missing/unloadable at scene load → placeholder pink wireframe box
  sized to manifest footprint + console warning; toast groups them.
- Manifest missing → editor shows error banner with the `gen_manifest.py` hint.
- JSON parse failure on load → toast, keep current scene untouched.

## Testing

- `test/lib.test.mjs` (plain `node:assert`, no framework): snapToGrid rounds to
  lattice, quantizeRotY snaps to 90°, serialize→deserialize round-trip preserves
  objects, manifest category mapping. Run: `npm test` → `node test/lib.test.mjs`.
- Visual behaviors (camera clamp, ghost placement, thumbnails) verified by hand
  in the running editor.

## Run

```
npm install
python3 scripts/gen_manifest.py   # once, after public/kit/ is populated
npm run dev                       # http://localhost:5173
```
