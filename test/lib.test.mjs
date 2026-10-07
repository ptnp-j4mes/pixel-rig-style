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
