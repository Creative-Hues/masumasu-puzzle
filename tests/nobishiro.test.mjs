// のびしろの問題作り・伸び方・ヒントの確かめ
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRng, mulberry32, randInt } from '../public/js/core/rng.js';
import { configOf, limitOf, generate, spread, baseBoard, stateOf, isFull, findNext, hintOf, WALL, EMPTY, MADE_STAGES } from '../public/js/puzzles/nobishiro/logic.js';

test('難易度表のとおり', () => {
  const t = s => { const c = configOf(s); return `${c.n} ${c.walls} ${c.limit}`; };
  assert.equal(t(1), '5 4 4');
  assert.equal(t(10), '5 4 4');
  assert.equal(t(11), '5 4 5');
  assert.equal(t(21), '6 6 5');
  assert.equal(t(41), '6 6 6');
  assert.equal(t(61), '7 8 7');
  assert.equal(t(81), '7 8 8');
  assert.equal(t(101), '8 10 8');
  assert.equal(t(121), '8 10 9');
  assert.equal(t(1000), '8 10 9');
});

test('置ける数は、ステージが進んでも減らない', () => {
  for (let s = 2; s <= 1000; s++) assert.ok(limitOf(s) >= limitOf(s - 1), `ステージ${s}で減った`);
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

// 置ける数ぴったりで埋まる置き方があるか、1個少ないと埋まらないか
const fillsWith = (pz, rem) => findNext(pz.n, baseBoard(pz.n, pz.walls), rem, 5e6);

test(`ステージ1〜${MADE_STAGES}と、その先：障害物の数・置ける数が表どおり、答えの置き方でちょうど埋まる`, () => {
  const stages = [];
  for (let s = 1; s <= MADE_STAGES; s++) stages.push(s);
  stages.push(301, 302, 450, 501, 777, 1000);
  for (const s of stages) {
    const pz = generate(s);
    const c = configOf(s);
    assert.equal(pz.n, c.n, `ステージ${s}：盤面`);
    assert.equal(pz.walls.length, c.walls, `ステージ${s}：障害物`);
    assert.equal(new Set(pz.walls).size, c.walls, `ステージ${s}：障害物が重なっている`);
    assert.equal(pz.limit, c.limit, `ステージ${s}：置ける数`);
    assert.equal(pz.sol.length, pz.limit);
    assert.ok(isFull(stateOf(pz, pz.sol)), `ステージ${s}：答えで埋まらない`);
  }
});

test('1個少ないと埋まらない(1〜80は全部、81〜は抜き出して確かめる)', () => {
  const stages = [];
  for (let s = 1; s <= 80; s++) stages.push(s);
  stages.push(81, 100, 101, 120, 121, 301);
  for (const s of stages) {
    const pz = generate(s);
    assert.equal(fillsWith(pz, pz.limit - 1), -1, `ステージ${s}：${pz.limit - 1}個で埋まってしまう`);
  }
});

test('301〜は、121〜300の問題を回したり裏返したりしたもので、元とは見た目がちがう', () => {
  const a = generate(121), b = generate(301);
  assert.notDeepEqual(a.walls, b.walls);
  assert.equal(a.limit, b.limit);
});

test('同じステージ番号なら同じ問題', () => {
  assert.deepEqual(generate(77), generate(77));
});

test('ヒント：埋めきれない手を戻し、光らせた場所に置けば残りの数で埋めきれる(8×8も)', () => {
  const rand = mulberry32(12345);
  let slowest = 0;
  for (const s of [1, 5, 25, 45, 65, 85, 101, 120, 150, 199]) {
    const pz = generate(s);
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
  const pz = generate(3);
  assert.deepEqual(hintOf(pz, pz.sol.slice(0, 1)), { kept: pz.sol.slice(0, 1), removed: 0, next: pz.sol[1] });
  assert.deepEqual(hintOf(pz, []), { kept: [], removed: 0, next: pz.sol[0] });
});
