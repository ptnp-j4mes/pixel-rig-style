import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SNAP_SIZE, MAP_VERSION,
  snapToGrid, quantizeRotY,
  serializeMap, deserializeMap,
} from '../src/lib.js';

test('snapToGrid rounds to the lattice', () => {
  assert.equal(snapToGrid(3.7), 4);
  assert.equal(snapToGrid(3.4), 3); // brief said 4 (stale from grid=2); Math.round at snap size 1 gives 3
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

test('version 3 map round-trips hierarchy and state', () => {
  const layers = [{ id: 'layer-default', name: 'Default Layer', visible: true, locked: false }];
  const groups = [{ id: 'group-1', name: 'Houses', layerId: 'layer-default', pos: [2, 0, 4], rotY: 90, scale: [1, 1, 1], visible: false, locked: true, order: 1 }];
  const objects = [{ id: 'obj-1', pack: 'japan-village', asset: 'House_4x5', name: 'North House', layerId: 'layer-default', groupId: 'group-1', pos: [1, 0, 2], rotY: 45, scale: [1, 2, 1], visible: true, locked: false, order: 0 }];
  const doc = serializeMap('test-map', objects, layers, groups);
  assert.equal(doc.version, MAP_VERSION);
  assert.equal(doc.gridSize, SNAP_SIZE);
  assert.equal(doc.mapName, 'test-map');
  const back = deserializeMap(JSON.stringify(doc));
  assert.deepEqual(back.objects, objects);
  assert.deepEqual(back.layers, layers);
  assert.deepEqual(back.groups, groups);
});

test('legacy v1 and v2 maps use default visible unlocked objects', () => {
  for (const version of [1, 2]) {
    const old = { version, gridSize: 2, mapName: 'old', objects: [{ pack: 'old-pack', asset: 'A', pos: [3, 1, -2], rotY: 90, scale: [2, 1, 2] }] };
    const migrated = deserializeMap(JSON.stringify(old));
    assert.equal(migrated.version, version);
    assert.equal(migrated.objects.length, 1);
    assert.deepEqual(migrated.objects[0].pos, [3, 1, -2]);
    assert.equal(migrated.objects[0].rotY, 90);
    assert.deepEqual(migrated.objects[0].scale, [2, 1, 2]);
    assert.equal(migrated.objects[0].name, 'A');
    assert.equal(migrated.objects[0].visible, true);
    assert.equal(migrated.objects[0].locked, false);
    assert.equal(migrated.objects[0].layerId, 'layer-default');
    assert.equal(migrated.objects[0].groupId, undefined);
    assert.deepEqual(migrated.groups, []);
    assert.equal(migrated.layers[0].name, 'Default Layer');
  }
});

test('dangling layer and group IDs retain objects in Default Layer', () => {
  const doc = {
    version: MAP_VERSION,
    mapName: 'broken-links',
    layers: [{ id: 'layer-default', name: 'Default Layer', visible: true, locked: false }, { id: 'layer-1', name: 'One', visible: true, locked: false }],
    groups: [{ id: 'group-1', name: 'Bad group', layerId: 'missing-layer', pos: [0, 0, 0], rotY: 0, scale: [1, 1, 1], visible: true, locked: false, order: 0 }],
    objects: [
      { id: 'obj-layer', pack: 'p', asset: 'A', name: 'A', layerId: 'missing-layer', groupId: 'group-1', pos: [1, 0, 0], rotY: 0, scale: [1, 1, 1] },
      { id: 'obj-group', pack: 'p', asset: 'B', name: 'B', layerId: 'layer-1', groupId: 'missing-group', pos: [2, 0, 0], rotY: 0, scale: [1, 1, 1] },
    ],
  };
  const migrated = deserializeMap(JSON.stringify(doc));
  assert.equal(migrated.objects.length, 2);
  assert.equal(migrated.objects[0].layerId, 'layer-default');
  assert.equal(migrated.objects[0].groupId, undefined);
  assert.equal(migrated.objects[1].layerId, 'layer-default');
  assert.equal(migrated.objects[1].groupId, undefined);
  assert.equal(migrated.groups[0].layerId, 'layer-default');
});

test('deserializeMap rejects bad input', () => {
  assert.throws(() => deserializeMap('not json'));
  assert.throws(() => deserializeMap(JSON.stringify({ version: 4, objects: [] })));
  assert.throws(() => deserializeMap(JSON.stringify({ version: MAP_VERSION })));
});
