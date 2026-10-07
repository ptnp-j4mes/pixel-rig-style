import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_SIZE, MAP_VERSION,
  snapToGrid, quantizeRotY,
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
