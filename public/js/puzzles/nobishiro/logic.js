// のびしろの、画面を持たない計算(難易度表・伸び方・問題作り・ヒントの探し方)
// 盤面は長さ n*n の配列。WALL は壁(障害物)、EMPTY は空いたマス、0以上は何個目に置いた色か

import { tierOf } from '../../core/stages.js';
import { STAGES } from './stages.js';
import { randInt } from '../../core/rng.js';

export const WALL = -2;
export const EMPTY = -1;

// 難易度表(docs/plan.md)。盤面の大きさ n と障害物の数 walls
const TIERS = [
  { n: 5, walls: 4 },
  { n: 6, walls: 6 },
  { n: 6, walls: 6 },
  { n: 7, walls: 8 },
  { n: 7, walls: 8 },
  { n: 8, walls: 10 },
];

// 置ける数。ステージが進んでも減らない(同じか増える)。どの問題も、この数ぴったりでないと埋まらない
export function limitOf(stage) {
  if (stage <= 10) return 4;
  if (stage <= 40) return 5;
  if (stage <= 60) return 6;
  if (stage <= 80) return 7;
  if (stage <= 120) return 8;
  return 9;
}

export function configOf(stage) {
  return { ...TIERS[tierOf(stage)], limit: limitOf(stage) };
}

const DIRS = [[1, 0, 'down'], [-1, 0, 'up'], [0, 1, 'right'], [0, -1, 'left']];

// マス i に k 個目を置く。上下左右に、壁か色のマスにぶつかるまで伸びる
//   out：置いたあとの盤面、info：色がついたマスごとの { d：置いた所からの距離, dir：伸びた向き('o' は置いた所) }
export function spread(n, board, i, k) {
  const out = board.slice();
  const info = { [i]: { d: 0, dir: 'o' } };
  out[i] = k;
  const r = Math.floor(i / n), c = i % n;
  for (const [dr, dc, dir] of DIRS) {
    let rr = r + dr, cc = c + dc, d = 1;
    while (rr >= 0 && rr < n && cc >= 0 && cc < n) {
      const j = rr * n + cc;
      if (out[j] !== EMPTY) break;
      out[j] = k;
      info[j] = { d: d++, dir };
      rr += dr; cc += dc;
    }
  }
  return { out, info };
}

export function baseBoard(n, walls) {
  const b = new Array(n * n).fill(EMPTY);
  walls.forEach(i => { b[i] = WALL; });
  return b;
}

export function stateOf(pz, moves) {
  let b = baseBoard(pz.n, pz.walls);
  moves.forEach((i, k) => { b = spread(pz.n, b, i, k).out; });
  return b;
}

export const isFull = board => !board.includes(EMPTY);

// 問題は、あらかじめ tools/make-nobishiro-stages.mjs で作ってある(stages.js)
// スマホで作ると、後半の盤面は「ぴったりの数でないと埋まらない」ことを確かめるのに時間がかかりすぎるため
// 301〜は、121〜300 の問題(どれも置ける数9個)を回したり裏返したりして使う(置ける数は変わらない)
export const MADE_STAGES = 300;
const LOOP_FROM = 121;

// 盤面を回す・裏返す(8通り)。k=0 はそのまま
function transform(n, i, k) {
  let r = Math.floor(i / n), c = i % n;
  if (k & 4) [r, c] = [c, r];
  if (k & 1) c = n - 1 - c;
  if (k & 2) r = n - 1 - r;
  return r * n + c;
}

export function puzzleOf(stage) {
  let src = stage, k = 0;
  if (stage > MADE_STAGES) {
    const span = MADE_STAGES - LOOP_FROM + 1;
    const lap = Math.floor((stage - LOOP_FROM) / span);
    src = LOOP_FROM + (stage - LOOP_FROM) % span;
    k = lap % 8 || 1;
  }
  const d = STAGES[src - 1];
  const cfg = configOf(stage);
  const n = cfg.n;
  return {
    ...cfg,
    walls: d.w.map(i => transform(n, i, k)).sort((a, b) => a - b),
    sol: d.s.map(i => transform(n, i, k)),
  };
}

// 今までの呼び方(generate(ステージ, 乱数))のまま使えるようにしておく
export function generate(stage) {
  return puzzleOf(stage);
}

// 問題を作る(tools/make-nobishiro-stages.mjs から使う)
// 障害物をランダムに置き、置ける数ぴったりで埋まり、1個少ないと埋まらない盤面だけを採用する
// 調べる数が budget を超えた盤面は、確かめきれないので使わない
export function makePuzzle(stage, rng, budget = 60000) {
  const cfg = configOf(stage);
  const { n, limit } = cfg;
  for (let tries = 0; tries < 100000; tries++) {
    const walls = [];
    while (walls.length < cfg.walls) {
      const x = randInt(rng, n * n);
      if (!walls.includes(x)) walls.push(x);
    }
    const base = baseBoard(n, walls);
    const solve = makeSearcher(n, budget);
    try {
      if (solve.lowerBound(base) > limit) continue;
      const sol = solve.path(base, limit);
      if (!sol || sol.length !== limit) continue;
      if (solve(base, limit - 1) !== -1) continue;
      return { ...cfg, walls: walls.sort((a, b) => a - b), sol };
    } catch (e) {
      if (e === TOO_MANY) continue;
      throw e;
    }
  }
  throw new Error('のびしろの問題が作れなかった：ステージ ' + stage);
}

// 残り rem 個で全部埋めきれるかを調べる道具。調べた結果は覚えておき、ヒントの中で使い回す
// 調べる数が budget を超えたら TOO_MANY を投げる(時間がかかりすぎないように)
const BUDGET = 2500;
const TOO_MANY = { tooMany: true };

function makeSearcher(n, budget) {
  const N = n * n;
  const win = new Map();  // 埋まり方 → [埋めきれた残りの数, 次に置くマス]
  const fail = new Map(); // 埋まり方 → 埋めきれないとわかった残りの数(それ以下でも埋めきれない)
  let nodes = 0;

  const keyOf = occ => {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) if (occ[i]) { if (i < 32) a |= 1 << i; else b |= 1 << (i - 32); }
    return a + ',' + b;
  };
  // 置くと埋まるマス(壁も色も同じく「埋まっている」で考える)
  function fill(occ, i) {
    const out = occ.slice();
    out[i] = 1;
    const r = Math.floor(i / n), c = i % n;
    let filled = 1;
    for (const [dr, dc] of DIRS) {
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < n && cc >= 0 && cc < n && !out[rr * n + cc]) { out[rr * n + cc] = 1; filled++; rr += dr; cc += dc; }
    }
    return { out, filled };
  }
  // あと何個は必要かの見積もり(少なめに見積もる)
  // 空きマスを、横につながったかたまりと、縦につながったかたまりの両方に属するものと考えると、
  // 1個置くと横のかたまり1つと縦のかたまり1つまでしか埋められない。全部の空きマスに届くかたまりの数(最大マッチング)の半分は必要
  const rowId = new Int32Array(N), colId = new Int32Array(N);
  function matching(occ) {
    let nr = 0, nc = 0;
    for (let r = 0; r < n; r++) { let p = false; for (let c = 0; c < n; c++) { const i = r * n + c; if (occ[i]) { p = false; continue; } if (!p) { nr++; p = true; } rowId[i] = nr - 1; } }
    for (let c = 0; c < n; c++) { let p = false; for (let r = 0; r < n; r++) { const i = r * n + c; if (occ[i]) { p = false; continue; } if (!p) { nc++; p = true; } colId[i] = nc - 1; } }
    const adj = Array.from({ length: nr }, () => []);
    for (let i = 0; i < N; i++) if (!occ[i]) adj[rowId[i]].push(colId[i]);
    const mate = new Int32Array(nc).fill(-1);
    let m = 0;
    for (let u = 0; u < nr; u++) {
      const seen = new Uint8Array(nc);
      const aug = x => { for (const v of adj[x]) { if (seen[v]) continue; seen[v] = 1; if (mate[v] < 0 || aug(mate[v])) { mate[v] = x; return true; } } return false; };
      if (aug(u)) m++;
    }
    return Math.ceil(m / 2);
  }
  // 上下左右に空いたマスがない空きマスは、そこに置くしか埋められない。その数より残りが少なければ埋めきれない
  function lonely(occ) {
    let k = 0;
    for (let i = 0; i < N; i++) {
      if (occ[i]) continue;
      const r = Math.floor(i / n), c = i % n;
      const open = (r > 0 && !occ[i - n]) || (r < n - 1 && !occ[i + n]) || (c > 0 && !occ[i - 1]) || (c < n - 1 && !occ[i + 1]);
      if (!open) k++;
    }
    return k;
  }
  function search(occ, rem) {
    if (!occ.includes(0)) return -2;
    if (rem === 0) return -1;
    const key = keyOf(occ);
    const w = win.get(key);
    if (w && w[0] <= rem) return w[1];
    const f = fail.get(key);
    if (f !== undefined && f >= rem) return -1;
    if (lonely(occ) > rem || matching(occ) > rem) { fail.set(key, rem); return -1; }
    if (++nodes > budget) throw TOO_MANY;
    // たくさん埋まる所から試す
    const tries = [];
    for (let i = 0; i < N; i++) if (!occ[i]) tries.push({ i, ...fill(occ, i) });
    tries.sort((x, y) => y.filled - x.filled);
    for (const t of tries) {
      if (search(t.out, rem - 1) !== -1) { win.set(key, [rem, t.i]); return t.i; }
    }
    fail.set(key, rem);
    return -1;
  }
  const toOcc = board => Uint8Array.from(board, v => (v === EMPTY ? 0 : 1));
  // board：盤面(WALL・EMPTY・色)。埋めきれるなら次に置くマス、もう全部埋まっていれば -2、埋めきれなければ -1
  const solve = (board, rem) => search(toOcc(board), rem);
  // 残り rem 個で埋めきる置き方(マスの並び)。埋めきれなければ null
  solve.path = (board, rem) => {
    let occ = toOcc(board);
    const out = [];
    while (occ.includes(0)) {
      const i = search(occ, rem - out.length);
      if (i < 0) return null;
      out.push(i);
      occ = fill(occ, i).out;
    }
    return out;
  };
  solve.lowerBound = board => { const occ = toOcc(board); return Math.max(lonely(occ), matching(occ)); };
  return solve;
}

// 残り rem 個で全部埋めきれるなら次に置くマス、埋めきれなければ -1。調べきれなければ null
export function findNext(n, board, rem, budget = BUDGET) {
  try { return makeSearcher(n, budget)(board, rem); } catch (e) { if (e === TOO_MANY) return null; throw e; }
}

// ヒント：埋めきれる所まで戻した手(kept)、戻した数(removed)、次に置くマス(next)
export function hintOf(pz, moves, budget = BUDGET) {
  const sameAsSol = k => moves.slice(0, k).every((m, i) => m === pz.sol[i]);
  // 答えの置き方と最初から同じ順番なら、答えの次の1手(すぐ終わる)
  if (moves.length < pz.sol.length && sameAsSol(moves.length)) {
    return { kept: moves.slice(), removed: 0, next: pz.sol[moves.length] };
  }
  // 新しい手から1つずつ戻し、残りの数で埋めきれる所を探す(調べた結果は使い回す)
  const canFill = makeSearcher(pz.n, budget);
  try {
    const kept = moves.slice();
    while (true) {
      const next = canFill(stateOf(pz, kept), pz.limit - kept.length);
      if (next >= 0) return { kept, removed: moves.length - kept.length, next };
      if (!kept.length) break;
      kept.pop();
    }
  } catch (e) {
    if (e !== TOO_MANY) throw e;
  }
  // 調べきれないときは、答えの置き方と同じ所まで戻して、答えの次の1手
  let k = 0;
  while (k < moves.length && k < pz.sol.length - 1 && moves[k] === pz.sol[k]) k++;
  return { kept: moves.slice(0, k), removed: moves.length - k, next: pz.sol[k] };
}
