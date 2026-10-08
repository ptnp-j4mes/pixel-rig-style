# Object Layers Tree Design

## Goal

Show every placed object in a right-side tree view, let the user select or delete an object there, and organize objects into layers that survive save and reload.

## Design

- Replace the selection-only right panel with an always-visible outliner: `Layer > Obj`.
- Keep a non-deletable `Default Layer`. Add a layer action creates a named layer; selecting a layer makes it the destination for newly placed objects.
- Show objects as children of their assigned layer. Dragging an object row onto a layer moves it there. Expand/collapse layer rows.
- Selecting an object row selects the same scene object and shows its existing transform properties. Deleting from the row removes it from the scene and saved map.
- Deleting a non-default layer moves its objects to `Default Layer`; renaming a layer changes only its label. Do not add object groups or group transforms.
- Keep the scene transforms of objects independent. Layer membership is organizational metadata, not a Three.js parent relationship.

## Saved map compatibility

- Advance the map document version and serialize layer IDs/names plus each object's `layerId`.
- Load version 1 and 2 documents into `Default Layer` with their existing transforms unchanged.
- If a loaded object references a missing layer, place it in `Default Layer` rather than dropping the object.
- Autosave after layer creation, rename, delete, object reassignment, placement, or object deletion.

## Acceptance criteria

1. The right panel lists all placed objects even when none is selected.
2. Selecting an object in the tree selects it in the viewport and updates transform properties; selecting in the viewport updates the tree selection.
3. An object can be deleted from its tree row, and it disappears from both the viewport and tree.
4. Layers can be created, renamed, expanded/collapsed, and deleted under the stated Default Layer rule. Objects can be reassigned by dragging their rows to another layer.
5. New map files preserve layer membership. Existing version 1 and 2 files load all objects in Default Layer.

## Scope limits

No groups, multi-object transform, layer visibility/locking, or multi-select. Layers organize object rows only.
