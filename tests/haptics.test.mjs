// タップの判定の確かめ
import test from 'node:test';
import assert from 'node:assert/strict';
import { isTap, TAP_MOVE_LIMIT } from '../public/js/core/haptics.js';

test('ほとんど動かなければタップ、動いたらタップでない', () => {
  assert.equal(isTap(0, 0), true);
  assert.equal(isTap(6, -6), true);
  assert.equal(isTap(TAP_MOVE_LIMIT, 0), true);
  assert.equal(isTap(TAP_MOVE_LIMIT + 1, 0), false);
  assert.equal(isTap(0, 20), false);
  assert.equal(isTap(15, 0, 20), true); // パズルごとに上限を変えられる
});
