// のびしろの、画面を持たない計算(難易度表・伸び方・問題作り・ヒントの探し方)
// 盤面は長さ n*n の配列。WALL は壁(障害物)、EMPTY は空いたマス、0以上は何個目に置いた色か

import { tierOf } from '../../core/stages.js';
import { randInt } from '../../core/rng.js';

export const WALL = -2;
export const EMPTY = -1;

// 難易度表(docs/plan.md)。lo〜hi は置ける数の範囲、walls は障害物の数
const TIERS = [
  { n: 5, lo: 3, hi: 4, walls: 4 },
  { n: 6, lo: 4, hi: 5, walls: 6 },
  { n: 6, lo: 5, hi: 6, walls: 6 },
  { n: 7, lo: 5, hi: 7, walls: 8 },
  { n: 7, lo: 6, hi: 8, walls: 8 },
  { n: 8, lo: 7, hi: 10, walls: 10 },
];

export function configOf(stage) {
  return { ...TIERS[tierOf(stage)] };
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

const RANDOM_PLAYS = 400;

// 問題を作る。障害物をランダムに置き、ランダムに置く遊び方を400回試して、いちばん少ない数を「置ける数」にする
//   walls：障害物のマス、limit：置ける数、sol：答えの置き方(ヒントに使う)
export function generate(stage, rng) {
  const cfg = configOf(stage);
  const { n } = cfg;
  for (let tries = 0; tries < 5000; tries++) {
    const walls = [];
    while (walls.length < cfg.walls) {
      const x = randInt(rng, n * n);
      if (!walls.includes(x)) walls.push(x);
    }
    const base = baseBoard(n, walls);
    let best = null;
    for (let t = 0; t < RANDOM_PLAYS; t++) {
      let b = base, seq = [];
      while (b.includes(EMPTY)) {
        const empty = [];
        b.forEach((v, i) => { if (v === EMPTY) empty.push(i); });
        const i = empty[randInt(rng, empty.length)];
        b = spread(n, b, i, seq.length).out;
        seq.push(i);
        if (best && seq.length >= best.length) break;
      }
      if (isFull(b) && (!best || seq.length < best.length)) best = seq;
    }
    if (best && best.length >= cfg.lo && best.length <= cfg.hi) {
      return { ...cfg, walls: walls.sort((a, b) => a - b), limit: best.length, sol: best };
    }
  }
  throw new Error('のびしろの問題が作れなかった：ステージ ' + stage);
}

// 残り rem 個で全部埋めきれるかを調べる道具。調べた結果は覚えておき、ヒントの中で使い回す
// 調べる数が budget を超えたら TOO_MANY を投げる(時間がかかりすぎないように)
const BUDGET = 8000;
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
    if (lonely(occ) > rem) { fail.set(key, rem); return -1; }
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
  // board：盤面(WALL・EMPTY・色)。埋めきれるなら次に置くマス、もう全部埋まっていれば -2、埋めきれなければ -1
  return (board, rem) => search(Uint8Array.from(board, v => (v === EMPTY ? 0 : 1)), rem);
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
