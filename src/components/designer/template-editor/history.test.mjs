// Unit test of the template-editor undo / redo history and its reducer
// integration (coalescing, bounds, time travel).
// Run: node --experimental-strip-types --test src/components/designer/template-editor/history.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HISTORY_LIMIT, canRedo, canUndo, historyInit, historyPush, historyRedo, historySeal, historyUndo } from './history.ts';

test('push / undo / redo', () => {
  let h = historyInit('a');
  h = historyPush(h, 'b');
  h = historyPush(h, 'c');
  assert.deepEqual([h.past, h.present, h.future], [['a', 'b'], 'c', []]);
  assert.ok(canUndo(h) && !canRedo(h));
  h = historyUndo(h);
  assert.deepEqual([h.past, h.present, h.future], [['a'], 'b', ['c']]);
  h = historyUndo(h);
  assert.deepEqual([h.past, h.present, h.future], [[], 'a', ['b', 'c']]);
  assert.equal(historyUndo(h), h, 'nothing to undo: same object');
  h = historyRedo(h);
  assert.deepEqual([h.past, h.present, h.future], [['a'], 'b', ['c']]);
  // A new push after undo drops the redo branch.
  h = historyPush(h, 'd');
  assert.deepEqual([h.past, h.present, h.future], [['a', 'b'], 'd', []]);
  assert.equal(historyRedo(h), h);
});

test('coalescing: same key merges into one step; seal / undo end the run', () => {
  let h = historyInit({ x: 0 });
  h = historyPush(h, { x: 1 }, 'drag:1');
  h = historyPush(h, { x: 2 }, 'drag:1');
  h = historyPush(h, { x: 3 }, 'drag:1');
  assert.equal(h.past.length, 1, 'a whole drag is one step');
  assert.deepEqual(h.present, { x: 3 });
  h = historySeal(h);
  h = historyPush(h, { x: 4 }, 'drag:1');
  assert.equal(h.past.length, 2, 'after seal the same key starts a new step');
  h = historyPush(h, { x: 5 }, 'drag:2');
  assert.equal(h.past.length, 3, 'a different key is a new step');
  h = historyUndo(h);
  assert.deepEqual(h.present, { x: 4 });
  h = historyPush(h, { x: 6 }, 'drag:2');
  assert.equal(h.past.length, 3, 'undo clears the key: no merge into the undone step');
  assert.deepEqual(h.future, []);
  // A keyless push never merges.
  h = historyPush(h, { x: 7 });
  h = historyPush(h, { x: 8 });
  assert.equal(h.past.length, 5);
});

test('bounded to HISTORY_LIMIT steps (oldest dropped)', () => {
  let h = historyInit(0);
  for (let i = 1; i <= HISTORY_LIMIT + 25; i++) h = historyPush(h, i);
  assert.equal(h.past.length, HISTORY_LIMIT);
  assert.equal(h.past[0], 25, 'the oldest entries are gone');
  assert.equal(h.present, HISTORY_LIMIT + 25);
  for (let i = 0; i < HISTORY_LIMIT; i++) h = historyUndo(h);
  assert.equal(h.present, 25);
  assert.ok(!canUndo(h));
});
