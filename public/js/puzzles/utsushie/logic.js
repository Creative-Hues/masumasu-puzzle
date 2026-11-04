// うつしえの、画面を持たない計算(難易度表・切り分け・色分け・映り方・置けるか・ヒントの探し方)
// マスの番号は r*n+c。ピースの形 shape は [行, 列] の並び(左上が0,0。上から順、同じ行は左から順)

import { tierOf } from '../../core/stages.js';
import { randInt, shuffle } from '../../core/rng.js';

// 難易度表(docs/plan.md)。layout：H=横に2つ、Q2=4分割(左上と上)、Q1=4分割(左上だけ)
const TIERS = [
  { layout: 'H', n: 5, minP: 2, maxP: 4 },
  { layout: 'H', n: 6, minP: 3, maxP: 4 },
  { layout: 'Q2', n: 5, minP: 3, maxP: 4 },
  { layout: 'Q2', n: 6, minP: 3, maxP: 4 },
  { layout: 'Q1', n: 5, minP: 3, maxP: 4 },
  { layout: 'Q1', n: 6, minP: 3, maxP: 5 },
];
export const LAYOUT_NAME = { H: '横に2つ', Q2: '4分割(左上と上)', Q1: '4分割(左上だけ)' };

export function configOf(stage) {
  return { ...TIERS[tierOf(stage)] };
}

// 盤面の並びと映り方。bx・by は盤面の位置(盤面1枚ぶんを1と数える)、map は置く盤面のマス(r,c)が映る位置
// place：置く盤面(太い枠)、hidden：斜線のグレーで隠れた盤面
export function boardsOf(layout, n) {
  const same = (r, c) => [r, c];
  if (layout === 'H') {
    return [
      { bx: 0, by: 0, map: (r, c) => [r, n - 1 - c] }, // 左：境目をはさんで左右反転
      { bx: 1, by: 0, place: true, map: same },
    ];
  }
  return [
    { bx: 0, by: 0, map: (r, c) => [n - 1 - r, n - 1 - c] },                 // 左上：点対称
    { bx: 1, by: 0, map: (r, c) => [n - 1 - r, c], hidden: layout === 'Q1' }, // 上：上下反転
    { bx: 0, by: 1, map: (r, c) => [r, n - 1 - c], hidden: true },           // 左下：いつも隠れる
    { bx: 1, by: 1, place: true, map: same },                                // 右下：置く盤面
  ];
}

function neighbors(n) {
  const nb = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, a = [];
    if (r > 0) a.push(i - n);
    if (r < n - 1) a.push(i + n);
    if (c > 0) a.push(i - 1);
    if (c < n - 1) a.push(i + 1);
    nb.push(a);
  }
  return nb;
}

// 正方形の盤面を、minP〜maxP マスのピースにランダムに切り分ける(試作の genTiling と同じ作り方)
// 空いたマスのとなりが少ない所から広げていくので、すき間が取り残されにくい
export function genTiling(n, minP, maxP, rng) {
  const N = n * n, nb = neighbors(n);
  for (let attempt = 0; attempt < 500; attempt++) {
    const owner = new Int16Array(N).fill(-1), pieces = [];
    const freeDeg = x => { let d = 0; for (const y of nb[x]) if (owner[y] < 0) d++; return d; };
    let remaining = N;
    while (remaining > 0) {
      let best = [], bd = 9;
      for (let x = 0; x < N; x++) {
        if (owner[x] >= 0) continue;
        const d = freeDeg(x);
        if (d < bd) { bd = d; best = [x]; } else if (d === bd) best.push(x);
      }
      const start = best[randInt(rng, best.length)];
      const id = pieces.length, target = minP + randInt(rng, maxP - minP + 1);
      const cells = [start];
      owner[start] = id; remaining--;
      while (cells.length < target) {
        const front = [];
        for (const x of cells) for (const y of nb[x]) if (owner[y] < 0 && !front.includes(y)) front.push(y);
        if (!front.length) break;
        let fb = [], fd = 9;
        for (const y of front) { const d = freeDeg(y); if (d < fd) { fd = d; fb = [y]; } else if (d === fd) fb.push(y); }
        const pick = rng() < 0.7 ? fb[randInt(rng, fb.length)] : front[randInt(rng, front.length)];
        cells.push(pick); owner[pick] = id; remaining--;
      }
      pieces.push(cells);
    }
    // 小さすぎるピースは、となりのピースにくっつける
    let ok = true, changed = true;
    while (changed && ok) {
      changed = false;
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (!p || p.length >= minP) continue;
        let bestJ = -1, bs = 99;
        for (const x of p) for (const y of nb[x]) {
          const j = owner[y];
          if (j !== i && j >= 0 && pieces[j] && pieces[j].length + p.length <= maxP && pieces[j].length < bs) { bs = pieces[j].length; bestJ = j; }
        }
        if (bestJ < 0) { ok = false; break; }
        for (const x of p) { owner[x] = bestJ; pieces[bestJ].push(x); }
        pieces[i] = null; changed = true;
      }
    }
    if (!ok) continue;
    const res = pieces.filter(Boolean);
    if (res.some(p => p.length < minP || p.length > maxP)) continue;
    return res;
  }
  return null;
}

export function normShape(rc) {
  let mr = Infinity, mc = Infinity;
  for (const [r, c] of rc) { mr = Math.min(mr, r); mc = Math.min(mc, c); }
  return rc.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// 形を、左上を(r0,c0)に合わせて置いたときのマス。盤面からはみ出すなら null
export function cellsAt(n, shape, r0, c0) {
  const out = [];
  for (const [r, c] of shape) {
    const rr = r0 + r, cc = c0 + c;
    if (rr < 0 || rr >= n || cc < 0 || cc >= n) return null;
    out.push(rr * n + cc);
  }
  return out;
}

// 問題を作る。pieces：{ id, shape, sol(答えのマス), color(8色のどれか) }、pre：最初から置いてあるピースの id
export function generate(stage, rng) {
  const cfg = configOf(stage);
  const { n } = cfg;
  let tiling = null;
  for (let tries = 0; !tiling && tries < 50; tries++) tiling = genTiling(n, cfg.minP, cfg.maxP, rng);
  if (!tiling) throw new Error('うつしえの問題が作れなかった：ステージ ' + stage);
  shuffle(tiling, rng);
  const owner = new Int16Array(n * n);
  tiling.forEach((cells, i) => cells.forEach(x => { owner[x] = i; }));
  // となり合うピースはちがう色にする
  const nb = neighbors(n), colors = new Array(tiling.length).fill(-1);
  tiling.forEach((cells, i) => {
    const used = new Set();
    for (const x of cells) for (const y of nb[x]) { const j = owner[y]; if (j !== i && colors[j] >= 0) used.add(colors[j]); }
    let c = randInt(rng, 8);
    for (let t = 0; t < 8 && used.has(c); t++) c = (c + 1) % 8;
    colors[i] = c;
  });
  const pieces = tiling.map((cells, i) => ({
    id: i,
    shape: normShape(cells.map(x => [Math.floor(x / n), x % n])),
    sol: cells.slice().sort((a, b) => a - b),
    color: colors[i],
  }));
  // 最初から置いてあるピースは1〜20だけ。ステージ1で半分、20で0個
  const half = Math.round(pieces.length / 2);
  const preCount = stage <= 20 ? Math.round(half * (20 - stage) / 19) : 0;
  const pre = shuffle(pieces.map(p => p.id), rng).slice(0, preCount).sort((a, b) => a - b);
  return { ...cfg, stage, pieces, pre };
}

// 残りのマスを、残りのピースで敷き詰める置き方を探す(向きは変えず、ずらすだけ)
// 見つかれば [{ id, cells }] の並び、見つからなければ null。調べる数が budget を超えたら TOO_MANY を投げる
const BUDGET = 50000;
const TOO_MANY = { tooMany: true };
function tile(n, occ, pieces, budget) {
  let nodes = 0;
  const used = new Array(pieces.length).fill(false);
  const out = [];
  function go() {
    const e = occ.indexOf(0);
    if (e < 0) return true;
    if (++nodes > budget) throw TOO_MANY;
    const er = Math.floor(e / n), ec = e % n;
    const tried = new Set();
    for (let k = 0; k < pieces.length; k++) {
      if (used[k]) continue;
      const p = pieces[k], key = JSON.stringify(p.shape);
      if (tried.has(key)) continue; // 同じ形は1回だけ試す
      tried.add(key);
      // いちばん上の空きマスは、ピースの上の左端のマスで埋まるはず
      const cells = cellsAt(n, p.shape, er - p.shape[0][0], ec - p.shape[0][1]);
      if (!cells || cells.some(x => occ[x])) continue;
      cells.forEach(x => { occ[x] = 1; });
      used[k] = true;
      out.push({ id: p.id, cells });
      if (go()) return true;
      out.pop();
      used[k] = false;
      cells.forEach(x => { occ[x] = 0; });
    }
    return false;
  }
  return go() ? out : null;
}

// 今の置き方(placed：{ id, cells } の並び)のまま、残りのピースで埋めきれるか。調べきれなければ例外
function solveFrom(pz, placed, budget) {
  const occ = new Uint8Array(pz.n * pz.n);
  placed.forEach(p => p.cells.forEach(x => { occ[x] = 1; }));
  const left = pz.pieces.filter(p => !placed.some(q => q.id === p.id));
  return tile(pz.n, occ, left, budget);
}

export function canFinish(pz, placed, budget = BUDGET) {
  try { return solveFrom(pz, placed, budget) !== null; } catch (e) { if (e === TOO_MANY) return null; throw e; }
}

// ヒント：埋めきれる所まで、自分で置いたピースを新しいほうから戻す。最初から置いてあるピースは戻さない
//   kept：戻したあとの置き方、removed：戻した数、next：次に置くピースと場所 { id, cells }
export function hintOf(pz, placed, budget = BUDGET) {
  const isPre = p => pz.pre.includes(p.id);
  const kept = placed.slice();
  try {
    while (true) {
      const sol = solveFrom(pz, kept, budget);
      if (sol) return { kept, removed: placed.length - kept.length, next: sol[0] };
      if (!kept.length || isPre(kept[kept.length - 1])) break;
      kept.pop();
    }
  } catch (e) {
    if (e !== TOO_MANY) throw e;
  }
  // 調べきれないときは、答えの位置と違う所に置いたピースを戻し、答えの位置で次の1手
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const ok = placed.filter(p => isPre(p) || same([...p.cells].sort((a, b) => a - b), pz.pieces[p.id].sol));
  const nextPiece = pz.pieces.find(p => !ok.some(q => q.id === p.id));
  return { kept: ok, removed: placed.length - ok.length, next: { id: nextPiece.id, cells: nextPiece.sol.slice() } };
}
