# Object Layers and Groups Tree Design

## Goal

Provide a right-side Layers panel that lists and manages every placed object, similar to the layer layouts in Illustrator, Photoshop, and Figma.

## Tree and operations

- Show the hierarchy `Layer > Group > Obj`; objects may also sit directly in a layer. Groups are one level deep.
- Create, rename, reorder, and delete layers. `Default Layer` cannot be deleted; deleting another layer moves its contents to Default.
- Create a group from selected objects, rename it, move it within or between layers, and ungroup it without deleting its members. Grouping may include objects from different layers; the new group is placed in the active layer.
- Select multiple objects with tree checkboxes for Group/Ungroup actions. Groups transform as a unit. Dragging a group or editing its position, rotation, or scale updates the group transform while preserving each child's relative transform. Grouping, ungrouping, and moving an object to a new parent preserve its world transform.
- Rename, select, delete, hide/show, lock/unlock, and reorder objects from the tree. Selecting an object also updates the existing transform inspector; viewport selection updates the tree. Object transform fields and viewport dragging use world coordinates, including for grouped objects.
- Hide/show and lock/unlock are available on layers, groups, and objects. Parent visibility hides all descendants; parent locking prevents viewport movement and disables transform editing for descendants. Tree selection remains available for hidden or locked items.
- Drag objects between layers and groups and reorder rows. Tree order is organizational only; 3D placement and depth continue to determine viewport rendering.
- Layer children may mix direct objects and groups; each row's order is among siblings under its layer or group. Active Layer is a separate placement target, starts at Default Layer when a map opens, and is not part of Undo/Redo.
- Clicking a row selects one viewport item; separate checkboxes select multiple objects for Group actions. Choosing an active layer does not change viewport selection.
- New placements go into the active layer. All persistent edits autosave.

## Undo and redo

- Provide toolbar buttons and keyboard shortcuts: Ctrl/Cmd+Z for Undo and Ctrl/Cmd+Shift+Z or Ctrl+Y for Redo.
- Undo/Redo covers committed map edits: placing, deleting, moving, renaming, grouping, ungrouping, reparenting, reordering, transforms, visibility, and locking.
- One numeric-field edit sequence is one history step; one viewport drag is one history step. Selection, camera movement, and map-name edits are not history steps.
- A new edit after Undo clears the Redo branch. Opening, creating, or restoring a map resets history to that map's current state. History is in-memory only.
- Keep at most 50 map snapshots. Store map data only, not model geometry.

## Touch and map tools

- On touch devices, one-finger drag on empty map space rotates the camera around its target through 360° while keeping the top-down pitch constrained; pinching zooms/pans. The Pan tool changes one-finger drag to pan. Tapping an object selects it, and the Move tool drags the selected object on the ground plane.
- Mouse left- or right-button drag rotates the camera around its target through 360°; the Pan tool maps left-button drag to pan.
- Use pointer events for mouse and touch, cancel cleanly on `pointercancel`, and disable browser scrolling only on the map canvas. Keep toolbar touch targets at least 44 px.
- Add an icon tool strip for Select, Pan, and Move, with clear active-tool state and accessible labels. Use the four-direction icon for Move; provide icons for the existing map actions such as rotate, reset view, grid/snap, layer/group, delete, Undo, and Redo.
- Use Flaticon's Four Arrows icon by Grand Iconic for Move and credit it with a visible `Designed by Grand Iconic from Flaticon` link. Keep the remaining icons as small local SVGs; add no icon dependency.

## Saved map compatibility

- Advance the map document to version 3. Persist stable layer, group, and object IDs; names; layer/group membership; tree order; group transforms; object transforms; visibility; and lock state.
- Load version 1 and 2 documents with all objects in `Default Layer`, no groups, visible and unlocked, and object names defaulted to their asset names. Preserve their transforms.
- If a loaded object references a missing layer or group, retain the object in `Default Layer` without the invalid group parent.
- Save group child transforms relative to their group; ungrouping or moving an object to another parent must preserve its world transform.
- Groups created in the editor use uniform scale so child transforms remain representable after ungrouping. Preserve non-uniform group scales from loaded v3 files; disable child transforms and extraction until the group scale is reset to `1:1:1`.

## Acceptance criteria

1. The right panel shows every placed object in the Layer > Group > Obj tree, even when none is selected.
2. Tree and viewport selection stay synchronized; object and group transform controls edit the selected item.
3. Objects can be renamed, deleted, hidden, locked, reordered, moved between layers/groups, and grouped/ungrouped without losing map content or changing world transforms unexpectedly.
4. Layer/group visibility and locking apply to descendants; hidden/locked state survives save and reload.
5. Undo and Redo restore map edits and update the tree, scene, inspector, and autosave; a new edit after Undo clears Redo.
6. New version 3 maps preserve tree structure and state. Version 1/2 maps load in Default Layer with their original transforms.
7. Touch users can rotate the camera 360°, pan and zoom the view, and select or move objects without the browser stealing gestures; tool buttons are usable by touch.

## Scope limits

No nested groups, layer-based 3D draw ordering, or changes to asset geometry. Tree order does not override 3D depth.
