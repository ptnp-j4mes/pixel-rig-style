# Object Layers, Groups, and Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Layer > Group > Obj tree for managing map objects, with group transforms, visibility/locking, and Undo/Redo.

**Architecture:** Keep Layers as persisted organizational records and Groups as actual `THREE.Group` nodes so group transforms work. Persist map state in version 3 and keep a bounded in-memory snapshot history for committed edits; v1/v2 maps migrate into `Default Layer`.

**Tech Stack:** JavaScript ES modules, Three.js, native DOM drag-and-drop, Node's built-in test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-object-layers-tree-design.md`

## Global Constraints

- Use the hierarchy `Layer > Group > Obj`; groups are one level deep.
- Keep a non-deletable `Default Layer`; deleting another layer moves its contents to Default.
- Grouping, ungrouping, and reparenting preserve object world transforms.
- Group child transforms are relative to the group; object transform controls and viewport dragging use world coordinates.
- `order` is sibling order under a layer or group; layer children can mix direct objects and groups. Reordering is allowed across those siblings.
- Visibility and locking inherit from parent layers and groups.
- The active layer is editor state, shown in the tree, starts at Default Layer when a map opens, and is not an undo step.
- Touch uses one finger to orbit around the camera target in Select/Move, one finger to pan in Pan, pinch to zoom/pan, tap to select, and the Move tool to drag selected objects; browser scrolling is disabled only over the canvas.
- Mouse left- or right-button drag orbits around the camera target; the Pan tool maps left-button drag to pan.
- Tool and action buttons have at least 44 px touch targets; use Flaticon Four Arrows by Grand Iconic for Move and credit the author in the app's usage/credits.
- Tree order does not change 3D viewport depth or render order.
- Load v1/v2 objects into Default as ungrouped, visible, unlocked objects named after their assets.
- Undo/Redo covers committed map edits, excludes selection/camera/map name, resets on map load/new, clears Redo after a new edit, and retains at most 50 in-memory snapshots.
- Do not add dependencies or change asset geometry.

## Review Focus

- Legacy maps retain transforms while receiving default layer/object state — pin in Task 1.
- Missing layer/group references retain objects in Default Layer; groups with invalid layer references move into Default — pin in Task 1.
- Group, ungroup, and reparent preserve world transforms across translated, rotated, and scaled parents — pin in Task 2.
- Parent visibility/lock changes affect descendants while child state is retained — pin in Task 2.
- Undo/Redo restore edits, clear the Redo branch after a new edit, and remain bounded — pin in Task 3.

---

### Task 1: Version 3 map format and legacy migration

**Files:**
- Modify: `src/lib.js`
- Test: `test/lib.test.mjs`

**Interfaces:**
- `Layer`: `{ id, name, visible, locked }`; layer array order is display order.
- `Group`: `{ id, name, layerId, pos, rotY, scale, visible, locked, order }`; group transforms are world-space.
- `Object`: `{ id, pack, asset, name, layerId, groupId?, pos, rotY, scale, visible, locked, order }`; grouped transforms are group-local and `layerId` matches the group's layer.
- `order` is shared by direct objects and groups in a layer; inside a group it orders its objects. A missing group or layer reference sends its object to Default Layer; a group with a missing layer is retained in Default Layer.
- `serializeMap(mapName, objects, layers, groups)` emits v3 and omits runtime-only fields.
- `deserializeMap(text)` preserves the stored version, normalizes v3 hierarchy/state, and fills legacy defaults. Invalid parent IDs send objects/groups to Default Layer without dropping map content.

- [x] Add failing test `version 3 map round-trips hierarchy and state`; assert IDs, parent IDs, order, transforms, visibility, and locking survive serialization.
- [x] Add failing test `legacy v1 and v2 maps use default visible unlocked objects`; assert original transforms survive and object names default to asset names.
- [x] Add failing test `dangling layer and group IDs retain objects in Default Layer`; assert no objects are dropped.
- [x] Update existing round-trip and invalid-document tests for version 3 while retaining v1 compatibility.
- [x] Run `rtk npm test`; confirm the new cases fail before implementation.
- [x] Implement version 3 serialization and normalization in `src/lib.js` without changing existing JSON parse/error behavior.
- [x] Run `rtk npm test`; confirm all map-format cases pass.

### Task 2: Editor hierarchy, selection, and transforms

**Files:**
- Modify: `src/editor.js`
- Modify: `src/camera.js`
- Test: `test/editor.test.mjs`

**Interfaces:**
- `getLayers()`, `getGroups()`, and `getObjects()` return tree records with stable IDs, names, state, parent IDs, and order; `getActiveLayerId()` exposes the current placement target.
- `createLayer(name)`, `renameLayer(id, name)`, `deleteLayer(id)`, `reorderLayer(id, beforeId)`, `setActiveLayer(id)`, `setItemVisibility(type, id, visible)`, and `setItemLocked(type, id, locked)` manage layer state.
- `createGroup(objectIds, name)`, `renameGroup(id, name)`, `ungroup(id)`, `moveGroup(id, layerId, beforeId)`, and `moveObject(id, layerId, groupId, beforeId)` manage hierarchy; `beforeId` may refer to any valid sibling node. New groups are placed in the active layer.
- `renameObject(id, name)` changes its label without changing asset identity.
- `selectItem(type, id)` selects an object or group; `getSelectedTransform()` and `setSelectedTransform(transform)` expose world-space transforms; locked ancestors reject edits.
- `setTool('select' | 'pan' | 'move')` selects the active viewport tool; Select taps to select, Pan drags the view, and Move drags the selected object.
- `deleteObject(id)` removes that object; deleting a layer moves members to Default; ungrouping preserves members.
- `loadObjects(objects, layers, groups)` restores groups before attaching their objects; `clear()` restores only Default Layer.

- [x] Add failing test `grouping preserves selected objects world transforms` using objects at differing positions and rotations.
- [x] Add failing tests `group transform updates child world transforms` and `ungroup preserves child world transforms` with translated, rotated, and scaled group transforms.
- [x] Add failing test `reparenting an object preserves world transform` for moving between groups and layers.
- [x] Add failing tests `parent visibility and locking affect descendants`, `deleting a layer preserves descendants`, and `reordering changes tree order only`.
- [x] Add failing test `renaming an object preserves asset identity`; assert its `asset` remains unchanged.
- [x] Add failing tests `Pan tool moves the camera without moving objects`, `Move tool drags only the selected object`, and `pointercancel ends touch movement cleanly`.
- [x] Build the test helper with real Three.js objects and fake DOM/window event targets; only stub catalog model loading.
- [x] Run `rtk node --test test/editor.test.mjs`; confirm the new cases fail before implementation.
- [x] Implement Groups as `THREE.Group` nodes with world-preserving attach/detach; keep Layers as metadata.
- [x] Keep viewport dragging and object transform edits in world coordinates; disable them when any ancestor is locked.
- [x] Map one-finger OrbitControls touch to 360° rotate in Select/Move and pan in Pan; keep two-finger touch on dolly/pan, while Move uses ground-plane object dragging.
- [x] Implement inherited visibility/lock, stable IDs, active-layer placement, selection, deletion, reparenting, and sibling ordering.
- [x] Run `rtk node --test test/editor.test.mjs`; confirm hierarchy and transform cases pass.

### Task 3: Undo/Redo history

**Files:**
- Create: `src/history.js`
- Test: `test/history.test.mjs`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `package.json`

**Interfaces:**
- `createHistory(initialState, limit = 50)` returns `record(state)`, `undo()`, `redo()`, `reset(state)`, `canUndo()`, and `canRedo()`; the limit includes the current snapshot, identical snapshots are ignored, and methods return independent parsed values.
- Main creates snapshots from objects/layers/groups, excluding map name and view state. Restore calls `editor.loadObjects` and autosaves the restored map.

- [x] Add failing tests `undo and redo restore snapshots`, `record after undo clears redo`, `duplicate snapshots are ignored`, and `history retains at most 50 snapshots`.
- [x] Run `rtk node --test test/history.test.mjs`; confirm all four tests fail before implementation.
- [x] Implement the bounded snapshot history in `src/history.js`; add a `ponytail:` comment naming the 50-snapshot ceiling and delta-history upgrade path.
- [x] Change the npm test script to run all `test/*.test.mjs` files.
- [x] Add Undo/Redo buttons and keyboard shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y. Do not intercept typing inside inputs.
- [x] Record one history step per committed action; coalesce numeric-field input until `change`, and record viewport dragging once on pointer-up.
- [x] Reset history after new/open/autosave restore; on Undo/Redo restore the map without recording a second entry and refresh the tree, inspector, and autosave.
- [x] Run `rtk node --test test/history.test.mjs` and `rtk npm test`; confirm history and existing tests pass.

### Task 4: Layers panel UI and usage notes

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `README.md`

**Interfaces:**
- `currentDoc()` passes `editor.getObjects()`, `editor.getLayers()`, and `editor.getGroups()` to `serializeMap`.
- Loading passes normalized `doc.objects`, `doc.layers`, and `doc.groups` to `editor.loadObjects`.
- Editor state changes refresh the tree and autosave; selection updates the tree and transform inspector.

- [x] Replace the selection-only right panel with an always-visible expandable Layer > Group > Obj tree above the inspector.
- [x] Add a compact icon tool strip for Select, Pan, Move, Rotate, view reset, grid/snap, Layer, Group, Delete, Undo, and Redo; show active tool state, tooltips/accessible labels, and touch targets at least 44 px.
- [x] Use the Flaticon Four Arrows icon by Grand Iconic for Move; add the required `Designed by Grand Iconic from Flaticon` credit with a link in the usage/credits section. Use local inline SVGs for the other icons, with no new icon dependency.
- [x] Add controls for layer/group/object create or rename, layer delete, group ungroup, object delete, tree multi-select, visibility, and locking. Provide an explicit active-layer control and indicator; selecting a layer for placement must not change viewport selection.
- [x] Use row clicks for single viewport selection; use separate checkboxes for multi-select actions such as Group. Keep checkboxes separate from viewport selection.
- [x] Add drag/drop to reorder siblings and move objects/groups across valid parents; tree order must not affect Three.js render order.
- [x] Sync tree selection with viewport selection; display world-space object transforms or group transforms and disable editing beneath locked ancestors.
- [x] Wire v3 layers/groups through save, open, and autosave; keep legacy maps in Default Layer.
- [x] Update README usage notes for layer, group, touch gestures, tool icons, Undo/Redo, and the Flaticon attribution.
- [x] Run `rtk npm test` and `rtk npm run build`.
- [ ] In the browser, verify mouse and touch selection/movement, one-finger orbit in Select/Move, one-finger pan in Pan, pinch zoom, tool switching, touch target size, selection/rename/delete, active-layer placement and Default Layer after reopening, hide/lock inheritance, group/ungroup world-transform preservation, mixed group/object reordering, v3 save/reopen, v2 migration, Undo/Redo buttons and shortcuts, redo-branch clearing, and one-step numeric edits. (not fully verified: physical touch/pinch and file chooser).
