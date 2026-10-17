// Unit test of the SearchableSelect keyboard reducer (E15).
// Run: node --experimental-strip-types --test src/components/common/searchableSelectKeys.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectKeyReducer, clampActiveIndex, openingIndex, INITIAL_SELECT_KEY_STATE } from './searchableSelectKeys.ts';

const closed = INITIAL_SELECT_KEY_STATE;
const open = (activeIndex) => ({ open: true, activeIndex });
const key = (k, count = 5, selectedIndex = -1) => ({ key: k, count, selectedIndex });

test('closed: arrows, Enter and Space open on the selected option (or the first)', () => {
  for (const k of ['ArrowDown', 'ArrowUp', 'Enter', ' ']) {
    const r = selectKeyReducer(closed, key(k, 5, 2));
    assert.deepEqual([r.open, r.activeIndex, r.handled], [true, 2, true], k);
  }
  const r = selectKeyReducer(closed, key('ArrowDown', 5, -1));
  assert.equal(r.activeIndex, 0);
  assert.equal(selectKeyReducer(closed, key('ArrowDown', 0)).activeIndex, -1);
});

test('closed: other keys are not handled', () => {
  const r = selectKeyReducer(closed, key('a'));
  assert.deepEqual([r.open, r.handled], [false, false]);
  assert.equal(selectKeyReducer(closed, key('Escape')).handled, false);
});

test('open: ArrowDown / ArrowUp move and clamp at the ends', () => {
  assert.equal(selectKeyReducer(open(-1), key('ArrowDown')).activeIndex, 0);
  assert.equal(selectKeyReducer(open(0), key('ArrowDown')).activeIndex, 1);
  assert.equal(selectKeyReducer(open(4), key('ArrowDown')).activeIndex, 4);
  assert.equal(selectKeyReducer(open(-1), key('ArrowUp')).activeIndex, 4);
  assert.equal(selectKeyReducer(open(3), key('ArrowUp')).activeIndex, 2);
  assert.equal(selectKeyReducer(open(0), key('ArrowUp')).activeIndex, 0);
});

test('open: Home / End jump to the edges', () => {
  assert.equal(selectKeyReducer(open(3), key('Home')).activeIndex, 0);
  assert.equal(selectKeyReducer(open(1), key('End')).activeIndex, 4);
  assert.equal(selectKeyReducer(open(1), key('End', 0)).activeIndex, -1);
});

test('open: Enter commits the highlighted option and closes; nothing highlighted keeps it open', () => {
  const r = selectKeyReducer(open(2), key('Enter'));
  assert.deepEqual([r.open, r.commit, r.handled, r.refocusTrigger], [false, 2, true, true]);
  const none = selectKeyReducer(open(-1), key('Enter', 0));
  assert.deepEqual([none.open, none.commit, none.handled], [true, undefined, true]);
});

test('open: Escape closes and refocuses the trigger; Tab closes without being handled', () => {
  const esc = selectKeyReducer(open(2), key('Escape'));
  assert.deepEqual([esc.open, esc.handled, esc.refocusTrigger, esc.commit], [false, true, true, undefined]);
  const tab = selectKeyReducer(open(2), key('Tab'));
  assert.deepEqual([tab.open, tab.handled], [false, false]);
});

test('open: typing keys are left to the search input', () => {
  const r = selectKeyReducer(open(2), key('x'));
  assert.deepEqual([r.open, r.activeIndex, r.handled], [true, 2, false]);
});

test('clampActiveIndex follows the filtered list', () => {
  assert.equal(clampActiveIndex(7, 3), 2);
  assert.equal(clampActiveIndex(-1, 3), 0);
  assert.equal(clampActiveIndex(1, 0), -1);
  assert.equal(openingIndex(9, 3), 0);
  assert.equal(openingIndex(1, 3), 1);
});
