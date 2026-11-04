// まじきりの、画面を持たない計算(難易度表・問題作り・部屋の数え方・赤くする部屋・ヒントの線)
// 線の位置 p は「上(左)から何マス目の下(右)の境目か」。1〜n-1

import { tierOf } from '../../core/stages.js';
import { randInt, shuffle } from '../../core/rng.js';

// 難易度表(docs/plan.md)。lines は [縦の本数, 横の本数] の候補で、ステージごとに順番に入れ替える
const TIERS = [
  { n: 5, lines: [[1, 1]], k: 3 },
  { n: 6, lines: [[1, 2], [2, 1]], k: 4 },
  { n: 6, lines: [[2, 2]], k: 5 },
  { n: 7, lines: [[2, 2], [1, 3], [3, 1]], k: 5 },
  { n: 7, lines: [[2, 3], [3, 2]], k: 5 },
  { n: 8, lines: [[3, 3], [2, 4], [4, 2]], k: 5 },
];

// n：盤面の大きさ、v：縦線の本数、h：横線の本数、k：1部屋の●の上限
export function configOf(stage) {
  const t = TIERS[tierOf(stage)];
  const [v, h] = t.lines[(stage - 1) % t.lines.length];
  return { n: t.n, v, h, k: t.k };
}

// 1〜n-1 から count 本選ぶ選び方を全部
export function lineChoices(n, count) {
  const out = [];
  (function go(from, picked) {
    if (picked.length === count) { out.push(picked.slice()); return; }
    for (let p = from; p <= n - 1; p++) { picked.push(p); go(p + 1, picked); picked.pop(); }
  })(1, []);
  return out;
}

// ●の数を長方形ごとにすぐ数えるための表(累積和)
export function makeCounter(n, marks) {
  const has = new Uint8Array(n * n);
  marks.forEach(i => { has[i] = 1; });
  const P = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) P[r + 1][c + 1] = has[r * n + c] + P[r][c + 1] + P[r + 1][c] - P[r][c];
  return (r0, c0, r1, c1) => P[r1][c1] - P[r0][c1] - P[r1][c0] + P[r0][c0];
}

// 線で分かれた部屋。r0〜r1・c0〜c1(r1・c1は含まない)と、●の数 count
export function roomsOf(n, count, hs, vs) {
  const rows = [0, ...[...hs].sort((a, b) => a - b), n];
  const cols = [0, ...[...vs].sort((a, b) => a - b), n];
  const out = [];
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < cols.length - 1; j++) {
      const r0 = rows[i], r1 = rows[i + 1], c0 = cols[j], c1 = cols[j + 1];
      out.push({ r0, r1, c0, c1, count: count ? count(r0, c0, r1, c1) : 0 });
    }
  }
  return out;
}

const signature = counts => [...counts].sort((a, b) => a - b).join(',');

// 決まった本数の線で、組み合わせがぴったり合っているか
export function isSolved(pz, count, hs, vs) {
  if (hs.length !== pz.h || vs.length !== pz.v) return false;
  return signature(roomsOf(pz.n, count, hs, vs).map(r => r.count)) === signature(pz.target);
}

// 組み合わせより多く出てきた数の部屋(●を赤くする部屋)
export function badRooms(pz, count, hs, vs) {
  const rooms = roomsOf(pz.n, count, hs, vs);
  const need = {}, have = {};
  pz.target.forEach(x => { need[x] = (need[x] || 0) + 1; });
  rooms.forEach(r => { have[r.count] = (have[r.count] || 0) + 1; });
  return rooms.filter(r => have[r.count] > (need[r.count] || 0));
}

// 合う引き方の数(2つ目が見つかったら止める)
function countAnswers(pz, count, H, V) {
  let found = 0;
  for (const hs of H) {
    for (const vs of V) {
      if (isSolved(pz, count, hs, vs) && ++found > 1) return found;
    }
  }
  return found;
}

// 問題を作る。答えが1つに決まり、上限の数が組み合わせに入り、全部同じ数でない問題だけ
//   marks：●のあるマスの番号(r*n+c)、target：組み合わせ(小さい順)、sol：答えの線
export function generate(stage, rng) {
  const cfg = configOf(stage);
  const { n, v, h, k } = cfg;
  const H = lineChoices(n, h), V = lineChoices(n, v);
  for (let tries = 0; tries < 50000; tries++) {
    const hs = H[randInt(rng, H.length)], vs = V[randInt(rng, V.length)];
    const marks = [], counts = [];
    for (const room of roomsOf(n, null, hs, vs)) {
      const cells = [];
      for (let r = room.r0; r < room.r1; r++) for (let c = room.c0; c < room.c1; c++) cells.push(r * n + c);
      const put = 1 + randInt(rng, Math.min(k, cells.length));
      shuffle(cells, rng);
      marks.push(...cells.slice(0, put));
      counts.push(put);
    }
    if (!counts.includes(k) || new Set(counts).size < 2) continue;
    const pz = { ...cfg, marks: marks.sort((a, b) => a - b), target: counts.sort((a, b) => a - b), sol: { h: hs, v: vs } };
    if (countAnswers(pz, makeCounter(n, pz.marks), H, V) === 1) return pz;
  }
  throw new Error('まじきりの問題が作れなかった：ステージ ' + stage);
}

// ヒント：答えにない線を除いた手と、次に引く答えの線(横線を先に、上・左から)
export function hintOf(pz, moves) {
  const inSol = m => (m.d === 'h' ? pz.sol.h : pz.sol.v).includes(m.p);
  const kept = moves.filter(inSol);
  const drawn = d => kept.filter(m => m.d === d).map(m => m.p);
  const nh = pz.sol.h.find(p => !drawn('h').includes(p));
  const nv = pz.sol.v.find(p => !drawn('v').includes(p));
  const next = nh !== undefined ? { d: 'h', p: nh } : nv !== undefined ? { d: 'v', p: nv } : null;
  return { kept, removed: moves.length - kept.length, next };
}
