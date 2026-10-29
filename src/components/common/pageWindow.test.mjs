import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageWindow } from './pageWindow.ts';

test('small page counts show every page', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(2, 4), [1, 2, 3, 4]);
});

test('long lists show first, last and the current neighbourhood', () => {
  assert.deepEqual(pageWindow(1, 30), [1, 2, null, 30]);
  assert.deepEqual(pageWindow(15, 30), [1, null, 14, 15, 16, null, 30]);
  assert.deepEqual(pageWindow(30, 30), [1, null, 29, 30]);
});

test('a one-page gap is filled instead of shown as an ellipsis', () => {
  assert.deepEqual(pageWindow(4, 30), [1, 2, 3, 4, 5, null, 30]);
  assert.deepEqual(pageWindow(27, 30), [1, null, 26, 27, 28, 29, 30]);
});
