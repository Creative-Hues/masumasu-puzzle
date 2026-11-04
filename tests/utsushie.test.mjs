// うつしえの問題作り・映り方・ヒントの確かめ
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRng, mulberry32, randInt } from '../public/js/core/rng.js';
import { configOf, generate, boardsOf, cellsAt, canFinish, hintOf } from '../public/js/puzzles/utsushie/logic.js';

test('難易度表のとおり', () => {
  const t = s => { const c = configOf(s); return `${c.layout} ${c.n} ${c.minP}-${c.maxP}`; };
  assert.equal(t(1), 'H 5 2-4');
  assert.equal(t(20), 'H 5 2-4');
  assert.equal(t(21), 'H 6 3-4');
  assert.equal(t(41), 'Q2 5 3-4');
  assert.equal(t(61), 'Q2 6 3-4');
  assert.equal(t(81), 'Q1 5 3-4');
  assert.equal(t(101), 'Q1 6 3-5');
  assert.equal(t(500), 'Q1 6 3-5');
});

test('ステージ1〜300：ピースの大きさが表の範囲、マス数が盤面と同じ、となりの色がちがう、最初から置く数が表どおり', () => {
  let slowest = 0;
  for (let s = 1; s <= 300; s++) {
    const t0 = performance.now();
    const pz = generate(s, stageRng('utsushie', s));
    slowest = Math.max(slowest, performance.now() - t0);
    const { n } = pz;
    pz.pieces.forEach(p => assert.ok(p.sol.length >= pz.minP && p.sol.length <= pz.maxP, `ステージ${s}：ピースの大きさ ${p.sol.length}`));
    const all = pz.pieces.flatMap(p => p.sol).sort((a, b) => a - b);
    assert.deepEqual(all, [...Array(n * n).keys()], `ステージ${s}：すき間か重なりがある`);
    const owner = new Map();
    pz.pieces.forEach(p => p.sol.forEach(x => owner.set(x, p)));
    for (let x = 0; x < n * n; x++) {
      const r = Math.floor(x / n), c = x % n;
      for (const y of [c < n - 1 ? x + 1 : -1, r < n - 1 ? x + n : -1]) {
        if (y < 0) continue;
        const a = owner.get(x), b = owner.get(y);
        if (a !== b) assert.notEqual(a.color, b.color, `ステージ${s}：となりのピースが同じ色`);
      }
    }
    const half = Math.round(pz.pieces.length / 2);
    if (s === 1) assert.equal(pz.pre.length, half);
    if (s >= 20) assert.equal(pz.pre.length, 0, `ステージ${s}：最初から置くピース`);
    if (s < 20) assert.ok(pz.pre.length <= half);
    // 形を答えの位置に置くと、答えのマスになる
    pz.pieces.forEach(p => {
      const r0 = Math.min(...p.sol.map(x => Math.floor(x / n))), c0 = Math.min(...p.sol.map(x => x % n));
      assert.deepEqual([...cellsAt(n, p.shape, r0, c0)].sort((a, b) => a - b), p.sol);
    });
  }
  console.log(`いちばん時間がかかった問題：${slowest.toFixed(1)}ms`);
  assert.ok(slowest < 100);
});

test('最初から置くピースは、ステージ1から20へだんだん減る', () => {
  const counts = [1, 5, 10, 15, 19, 20].map(s => {
    const pz = generate(s, stageRng('utsushie', s));
    return pz.pre.length / Math.round(pz.pieces.length / 2);
  });
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] <= counts[i - 1] + 0.2, `減っていない：${counts}`);
  assert.equal(counts[0], 1);
  assert.equal(counts[counts.length - 1], 0);
});

test('同じステージ番号なら同じ問題', () => {
  assert.deepEqual(generate(64, stageRng('utsushie', 64)), generate(64, stageRng('utsushie', 64)));
});

test('映り方：横に2つは左右反転、4分割は左上が点対称・上が上下反転、隠れる盤面', () => {
  const n = 5;
  const h = boardsOf('H', n);
  assert.deepEqual(h.find(b => b.place).map(1, 0), [1, 0]);
  assert.deepEqual(h[0].map(1, 0), [1, 4]);
  const q2 = boardsOf('Q2', n);
  assert.deepEqual(q2[0].map(0, 1), [4, 3]);
  assert.deepEqual(q2[1].map(0, 1), [4, 1]);
  assert.deepEqual(q2.map(b => !!b.hidden), [false, false, true, false]);
  assert.deepEqual(boardsOf('Q1', n).map(b => !!b.hidden), [false, true, true, false]);
});

test('ヒント：戻したあと埋めきれ、光らせた所に置いてもまだ埋めきれる', () => {
  const rand = mulberry32(99);
  let slowest = 0;
  for (const s of [1, 8, 25, 45, 65, 85, 105, 150, 220, 299]) {
    const pz = generate(s, stageRng('utsushie', s));
    for (let round = 0; round < 6; round++) {
      // 最初から置いてあるピースのあと、でたらめに置けるだけ置く
      const placed = pz.pre.map(id => ({ id, cells: pz.pieces[id].sol.slice() }));
      const occ = new Set(placed.flatMap(p => p.cells));
      const want = 1 + randInt(rand, 4);
      for (const p of pz.pieces) {
        if (placed.length - pz.pre.length >= want) break;
        if (placed.some(q => q.id === p.id)) continue;
        const spots = [];
        for (let r = 0; r < pz.n; r++) for (let c = 0; c < pz.n; c++) {
          const cells = cellsAt(pz.n, p.shape, r, c);
          if (cells && !cells.some(x => occ.has(x))) spots.push(cells);
        }
        if (!spots.length) continue;
        const cells = spots[randInt(rand, spots.length)];
        cells.forEach(x => occ.add(x));
        placed.push({ id: p.id, cells });
      }
      if (placed.length === pz.pieces.length) continue;
      const t0 = performance.now();
      const h = hintOf(pz, placed);
      slowest = Math.max(slowest, performance.now() - t0);
      assert.deepEqual(h.kept, placed.slice(0, h.kept.length), '戻すのは新しいほうから');
      pz.pre.forEach(id => assert.ok(h.kept.some(p => p.id === id), '最初から置いてあるピースは戻さない'));
      assert.ok(!h.kept.some(p => p.id === h.next.id), '光らせるのは手持ちのピース');
      assert.notEqual(canFinish(pz, [...h.kept, h.next], 1e7), false, `ステージ${s}：ヒントのあと埋めきれない`);
    }
  }
  console.log(`ヒントにいちばん時間がかかったとき：${slowest.toFixed(1)}ms`);
  assert.ok(slowest < 200);
});
