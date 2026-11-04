// よつつじの問題作り・答えが1つか・ヒントの確かめ
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRng, mulberry32, randInt } from '../public/js/core/rng.js';
import { configOf, generate, buildLaneGraph, search, isSolved, hintOf, occupancy, mixColors } from '../public/js/puzzles/yotsutsuji/logic.js';

test('難易度表のとおり', () => {
  const t = s => { const c = configOf(s); return `${c.n} ${c.k} ${c.b}`; };
  assert.equal(t(1), '5 2 1');
  assert.equal(t(20), '5 2 1');
  assert.equal(t(21), '5 3 1');
  assert.deepEqual([t(41), t(42)].sort(), ['6 3 1', '6 3 2']);
  assert.deepEqual([t(61), t(62)].sort(), ['6 4 1', '6 4 2']);
  assert.deepEqual([81, 82, 83, 84].map(t).sort(), ['7 4 2', '7 4 3', '7 5 2', '7 5 3']);
  assert.deepEqual([101, 102, 103, 104].map(t).sort(), ['8 5 2', '8 5 3', '8 6 2', '8 6 3']);
  assert.equal(t(500).split(' ')[0], '8');
});

// 答えの線から、通り道の図の上での色の割り当てを作る
function assignOf(pz, G) {
  const a = new Int8Array(G.M).fill(-1);
  pz.paths.forEach((p, c) => p.forEach((x, i) => {
    if (G.bidx[x] >= 0) a[Math.abs(p[i - 1] - x) === 1 ? x : G.N + G.bidx[x]] = c;
    else a[x] = c;
  }));
  return a;
}

test('ステージ1〜300：答えが1つ、交差マスは縁になくとなり合わない、円の並びが入れ替わる、色マスは答えの色', () => {
  let slowest = 0, slowStage = 0, total = 0;
  for (let s = 1; s <= 300; s++) {
    const t0 = performance.now();
    const pz = generate(s, stageRng('yotsutsuji', s));
    const ms = performance.now() - t0;
    total += ms;
    if (ms > slowest) { slowest = ms; slowStage = s; }
    const { n } = pz, c = configOf(s);
    assert.equal(pz.n, c.n); assert.equal(pz.k, c.k); assert.equal(pz.bridges.length, c.b);
    pz.bridges.forEach(x => {
      const r = Math.floor(x / n), cc = x % n;
      assert.ok(r > 0 && r < n - 1 && cc > 0 && cc < n - 1, `ステージ${s}：交差マスが縁にある`);
      pz.bridges.forEach(y => {
        const touch = Math.abs(y - x) === n || (Math.abs(y - x) === 1 && Math.floor(y / n) === r);
        assert.ok(!touch, `ステージ${s}：交差マスがとなり合う`);
      });
    });
    const endRow = pz.paths.map(p => Math.floor(p[p.length - 1] / n));
    assert.ok(endRow.some((r, i) => i > 0 && r < endRow[i - 1]), `ステージ${s}：並びが入れ替わらない`);
    pz.cp.forEach((col, x) => { if (col >= 0) assert.ok(pz.paths[col].includes(x), `ステージ${s}：色マスの色がちがう`); });
    assert.ok(isSolved(pz, pz.paths), `ステージ${s}：答えでクリアにならない`);
    // 答えが1つ(ほかの引き方がない)
    const G = buildLaneGraph(n, pz.bridges);
    const cp = new Int8Array(G.M).fill(-1);
    pz.cp.forEach((v, i) => { cp[i] = v; });
    const starts = pz.paths.map(p => p[0]), ends = pz.paths.map(p => p[p.length - 1]);
    const res = search(G, pz.k, starts, ends, cp, { mode: 'diff', intended: assignOf(pz, G), limit: 1e7 });
    assert.equal(res.status, 'none', `ステージ${s}：ほかの答えがある`);
  }
  console.log(`いちばん時間がかかった問題：ステージ${slowStage}・${slowest.toFixed(0)}ms(平均 ${(total / 300).toFixed(0)}ms)`);
});

test('同じステージ番号なら同じ問題', () => {
  assert.deepEqual(generate(88, stageRng('yotsutsuji', 88)), generate(88, stageRng('yotsutsuji', 88)));
});

test('序盤ほど色マスが多い', () => {
  const ratio = s => { const pz = generate(s, stageRng('yotsutsuji', s)); return pz.cp.filter(x => x >= 0).length / (pz.n * pz.n); };
  const early = [1, 2, 3, 4, 5].map(ratio).reduce((a, b) => a + b) / 5;
  const late = [61, 63, 65, 67, 69].map(ratio).reduce((a, b) => a + b) / 5;
  assert.ok(early > late, `序盤 ${early.toFixed(2)}・61〜 ${late.toFixed(2)}`);
});

test('ヒント：戻した線は答えと最初から同じで、光らせるのはその線の次のマス', () => {
  const rand = mulberry32(5);
  for (const s of [1, 30, 50, 70, 90, 110]) {
    const pz = generate(s, stageRng('yotsutsuji', s));
    for (let round = 0; round < 10; round++) {
      // 答えの途中まで + でたらめな寄り道
      const lines = pz.paths.map(p => {
        const ln = p.slice(0, randInt(rand, p.length + 1));
        if (ln.length && rand() < 0.5) { const last = ln[ln.length - 1]; const side = last + (last % pz.n < pz.n - 1 ? 1 : -1); if (!p.includes(side)) ln.push(side); }
        return ln;
      });
      const h = hintOf(pz, lines);
      h.kept.forEach((ln, c) => assert.deepEqual(ln, pz.paths[c].slice(0, ln.length)));
      assert.equal(h.removed, lines.filter((ln, c) => ln.length !== h.kept[c].length).length);
      if (h.next) {
        assert.equal(h.next.cell, pz.paths[h.next.c][h.kept[h.next.c].length]);
        assert.equal(h.next.fromCircle, h.kept[h.next.c].length === 0);
      }
    }
  }
});

test('交差マスの線の数え方と、絵の具の混ぜ方', () => {
  const pz = { n: 3, bridges: [4], ends: [], cp: [] };
  const O = occupancy(pz, [[3, 4, 5], [1, 4, 7]]);
  assert.equal(O.oH[4], 0); assert.equal(O.oV[4], 1);
  assert.match(mixColors('#c18690', '#7899ba'), /^#[0-9a-f]{6}$/);
});
