// まじきりの問題作りと判定の確かめ
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRng } from '../public/js/core/rng.js';
import { configOf, generate, makeCounter, roomsOf, isSolved, badRooms, hintOf, lineChoices } from '../public/js/puzzles/majikiri/logic.js';

test('難易度表のとおり', () => {
  const t = s => { const c = configOf(s); return `${c.n} ${c.v}/${c.h} ${c.k}`; };
  assert.equal(t(1), '5 1/1 3');
  assert.equal(t(20), '5 1/1 3');
  assert.deepEqual([t(21), t(22)].sort(), ['6 1/2 4', '6 2/1 4']);
  assert.equal(t(41), '6 2/2 5');
  assert.equal(t(60), '6 2/2 5');
  assert.deepEqual([t(61), t(62), t(63)].sort(), ['7 1/3 5', '7 2/2 5', '7 3/1 5']);
  assert.deepEqual([t(81), t(82)].sort(), ['7 2/3 5', '7 3/2 5']);
  assert.deepEqual([t(101), t(102), t(103)].sort(), ['8 2/4 5', '8 3/3 5', '8 4/2 5']);
  assert.equal(t(1000).split(' ')[0], '8');
});

test('ステージ1〜300：答えが1つ、上限の数が入る、全部同じ数でない、どの部屋も●が1個〜上限', () => {
  let slowest = 0;
  for (let s = 1; s <= 300; s++) {
    const t0 = performance.now();
    const pz = generate(s, stageRng('majikiri', s));
    slowest = Math.max(slowest, performance.now() - t0);
    const count = makeCounter(pz.n, pz.marks);
    assert.ok(pz.target.includes(pz.k), `ステージ${s}：上限の数がない`);
    assert.ok(new Set(pz.target).size >= 2, `ステージ${s}：全部同じ数`);
    pz.target.forEach(x => assert.ok(x >= 1 && x <= pz.k, `ステージ${s}：部屋の●の数 ${x}`));
    assert.ok(isSolved(pz, count, pz.sol.h, pz.sol.v), `ステージ${s}：答えが合わない`);
    let answers = 0;
    for (const hs of lineChoices(pz.n, pz.h)) for (const vs of lineChoices(pz.n, pz.v)) if (isSolved(pz, count, hs, vs)) answers++;
    assert.equal(answers, 1, `ステージ${s}：答えが${answers}つ`);
  }
  console.log(`いちばん時間がかかった問題：${slowest.toFixed(1)}ms`);
  assert.ok(slowest < 100, `1問に${slowest.toFixed(0)}msかかった`);
});

test('同じステージ番号なら同じ問題', () => {
  assert.deepEqual(generate(57, stageRng('majikiri', 57)), generate(57, stageRng('majikiri', 57)));
});

test('赤くする部屋：組み合わせ1・1・2・3で、できた部屋が1・2・2・2なら「2」の3部屋', () => {
  // 4×4を縦1本・横1本で4部屋に分け、左上1個・右上2個・左下2個・右下2個にする
  const n = 4, at = (r, c) => r * n + c;
  const marks = [at(0, 0), at(0, 2), at(0, 3), at(2, 0), at(3, 0), at(2, 2), at(3, 3)];
  const pz = { n, h: 1, v: 1, target: [1, 1, 2, 3] };
  const count = makeCounter(n, marks);
  assert.deepEqual(roomsOf(n, count, [2], [2]).map(r => r.count), [1, 2, 2, 2]);
  const bad = badRooms(pz, count, [2], [2]);
  assert.equal(bad.length, 3);
  bad.forEach(r => assert.equal(r.count, 2));
});

test('ヒント：間違った線を除き、答えの線を1本返す', () => {
  const pz = { sol: { h: [2, 4], v: [3] } };
  const moves = [{ d: 'h', p: 2 }, { d: 'v', p: 1 }, { d: 'h', p: 3 }];
  const r = hintOf(pz, moves);
  assert.deepEqual(r.kept, [{ d: 'h', p: 2 }]);
  assert.equal(r.removed, 2);
  assert.deepEqual(r.next, { d: 'h', p: 4 });
  assert.deepEqual(hintOf(pz, [{ d: 'h', p: 2 }, { d: 'h', p: 4 }]).next, { d: 'v', p: 3 });
});

test('ヒントの回数は「線の本数−1」(上限3回)', async () => {
  const { hintLimit } = await import('../public/js/puzzles/majikiri/majikiri.js');
  assert.deepEqual([1, 20, 21, 40, 41, 101, 500].map(hintLimit), [1, 1, 2, 2, 3, 3, 3]);
});
