import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../src/history.js';

test('undo and redo restore independent snapshots', () => {
  const history = createHistory({ objects: [] });
  history.record({ objects: [{ id: 'one' }] });
  history.record({ objects: [{ id: 'one' }, { id: 'two' }] });
  const undone = history.undo();
  assert.deepEqual(undone, { objects: [{ id: 'one' }] });
  undone.objects.length = 0;
  assert.deepEqual(history.redo(), { objects: [{ id: 'one' }, { id: 'two' }] });
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);
});

test('record after undo clears redo branch', () => {
  const history = createHistory({ value: 0 });
  history.record({ value: 1 });
  history.record({ value: 2 });
  history.undo();
  history.record({ value: 3 });
  assert.equal(history.canRedo(), false);
  assert.deepEqual(history.undo(), { value: 1 });
});

test('duplicate snapshots are ignored', () => {
  const history = createHistory({ value: 0 });
  assert.equal(history.record({ value: 0 }), false);
  history.record({ value: 1 });
  assert.equal(history.record({ value: 1 }), false);
  assert.deepEqual(history.undo(), { value: 0 });
  assert.equal(history.canUndo(), false);
});

test('history retains at most 50 snapshots including current', () => {
  const history = createHistory({ value: 0 }, 50);
  for (let value = 1; value <= 55; value++) history.record({ value });
  let undoCount = 0;
  while (history.undo() !== null) undoCount++;
  assert.equal(undoCount, 49);
});
