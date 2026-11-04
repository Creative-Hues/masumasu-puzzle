// のびしろの問題作り・伸び方・ヒントの確かめ
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRng, mulberry32, randInt } from '../public/js/core/rng.js';
import { configOf, generate, spread, baseBoard, stateOf, isFull, findNext, hintOf, WALL, EMPTY } from '../public/js/puzzles/nobishiro/logic.js';

test('難易度表のとおり', () => {
  const t = s => { const c = configOf(s); return `${c.n} ${c.lo}-${c.hi} ${c.walls}`; };
  assert.equal(t(1), '5 3-4 4');
  assert.equal(t(20), '5 3-4 4');
  assert.equal(t(21), '6 4-5 6');
  assert.equal(t(41), '6 5-6 6');
  assert.equal(t(61), '7 5-7 8');
  assert.equal(t(81), '7 6-8 8');
  assert.equal(t(101), '8 7-10 10');
  assert.equal(t(500), '8 7-10 10');
});

test('伸び方：壁・障害物・先に伸びた色で止まる', () => {
  // 3×3、真ん中の右が障害物
  const n = 3;
  let b = baseBoard(n, [5]);
  const first = spread(n, b, 4, 0); // 真ん中に1個目
  assert.deepEqual(first.out, [EMPTY, 0, EMPTY, 0, 0, WALL, EMPTY, 0, EMPTY]);
  assert.deepEqual(first.info[4], { d: 0, dir: 'o' });
  assert.deepEqual(first.info[1], { d: 1, dir: 'up' });
  const second = spread(n, first.out, 0, 1); // 左上に2個目：右も下も1個目の色で止まる
  assert.deepEqual(second.out, [1, 0, EMPTY, 0, 0, WALL, EMPTY, 0, EMPTY]);
});

test('ステージ1〜300：作れて、障害物の数・置ける数が表どおり、答えの置き方で全部埋まる', () => {
  let slowest = 0, slowStage = 0;
  for (let s = 1; s <= 300; s++) {
    const t0 = performance.now();
    const pz = generate(s, stageRng('nobishiro', s));
    const ms = performance.now() - t0;
    if (ms > slowest) { slowest = ms; slowStage = s; }
    const c = configOf(s);
    assert.equal(pz.walls.length, c.walls, `ステージ${s}：障害物`);
    assert.ok(pz.limit >= c.lo && pz.limit <= c.hi, `ステージ${s}：置ける数 ${pz.limit}`);
    assert.equal(pz.sol.length, pz.limit);
    assert.ok(isFull(stateOf(pz, pz.sol)), `ステージ${s}：答えで埋まらない`);
  }
  console.log(`いちばん時間がかかった問題：ステージ${slowStage}・${slowest.toFixed(1)}ms`);
  assert.ok(slowest < 100, `1問に${slowest.toFixed(0)}msかかった`);
});

test('同じステージ番号なら同じ問題', () => {
  assert.deepEqual(generate(77, stageRng('nobishiro', 77)), generate(77, stageRng('nobishiro', 77)));
});

test('ヒント：埋めきれない手を戻し、光らせた場所に置けば残りの数で埋めきれる(8×8も)', () => {
  const rand = mulberry32(12345);
  let slowest = 0;
  for (const s of [1, 5, 25, 45, 65, 85, 101, 120, 150, 199]) {
    const pz = generate(s, stageRng('nobishiro', s));
    for (let round = 0; round < 5; round++) {
      // でたらめに何手か置く
      let b = baseBoard(pz.n, pz.walls);
      const moves = [];
      const count = 1 + randInt(rand, pz.limit);
      while (moves.length < count && !isFull(b)) {
        const empty = b.map((v, i) => (v === EMPTY ? i : -1)).filter(i => i >= 0);
        const i = empty[randInt(rand, empty.length)];
        b = spread(pz.n, b, i, moves.length).out;
        moves.push(i);
      }
      if (isFull(b)) continue;
      const t0 = performance.now();
      const h = hintOf(pz, moves);
      slowest = Math.max(slowest, performance.now() - t0);
      assert.deepEqual(h.kept, moves.slice(0, h.kept.length), '戻すのは新しいほうから');
      assert.equal(h.removed, moves.length - h.kept.length);
      const after = spread(pz.n, stateOf(pz, h.kept), h.next, h.kept.length).out;
      assert.equal(stateOf(pz, h.kept)[h.next], EMPTY, '光らせるのは空いたマス');
      const rem = pz.limit - h.kept.length - 1;
      assert.ok(isFull(after) || findNext(pz.n, after, rem, 5e6) !== -1, `ステージ${s}：ヒントのあと埋めきれない`);
    }
  }
  console.log(`ヒントにいちばん時間がかかったとき：${slowest.toFixed(1)}ms`);
  assert.ok(slowest < 200, `ヒントに${slowest.toFixed(0)}msかかった`);
});

test('ヒント：答えの置き方と同じ順番なら、答えの次の1手', () => {
  const pz = generate(3, stageRng('nobishiro', 3));
  assert.deepEqual(hintOf(pz, pz.sol.slice(0, 1)), { kept: pz.sol.slice(0, 1), removed: 0, next: pz.sol[1] });
  assert.deepEqual(hintOf(pz, []), { kept: [], removed: 0, next: pz.sol[0] });
});
