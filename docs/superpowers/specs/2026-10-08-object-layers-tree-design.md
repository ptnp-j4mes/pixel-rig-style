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
- New placements go into the active layer. All persistent edits autosave.

## Saved map compatibility

- Advance the map document to version 3. Persist stable layer, group, and object IDs; names; layer/group membership; tree order; group transforms; object transforms; visibility; and lock state.
- Load version 1 and 2 documents with all objects in `Default Layer`, no groups, visible and unlocked, and object names defaulted to their asset names. Preserve their transforms.
- If a loaded object references a missing layer or group, retain the object in `Default Layer` without the invalid group parent.
- Save group child transforms relative to their group; ungrouping or moving an object to another parent must preserve its world transform.

## Acceptance criteria

1. The right panel shows every placed object in the Layer > Group > Obj tree, even when none is selected.
2. Tree and viewport selection stay synchronized; object and group transform controls edit the selected item.
3. Objects can be renamed, deleted, hidden, locked, reordered, moved between layers/groups, and grouped/ungrouped without losing map content or changing world transforms unexpectedly.
4. Layer/group visibility and locking apply to descendants; hidden/locked state survives save and reload.
5. New version 3 maps preserve tree structure and state. Version 1/2 maps load in Default Layer with their original transforms.

## Scope limits

No nested groups, layer-based 3D draw ordering, or changes to asset geometry. Tree order does not override 3D depth.
