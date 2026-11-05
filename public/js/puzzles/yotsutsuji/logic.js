// よつつじの、画面を持たない計算(難易度表・問題作り・答えの探し方・絵の具の混ぜ方・ヒント)
// 問題作りと探し方は試作(docs/prototypes/yotsutsuji.html)を移したもの
// マスの番号は r*n+c。左の円のとなりのマス(starts)は0列目、右の円のとなりのマス(ends)は右端の列

import { tierOf } from '../../core/stages.js';
import { randInt, shuffle } from '../../core/rng.js';

// 難易度表(docs/plan.md)。「〜」の段階は、色の数と交差マスの数をステージごとに順に入れ替える
const TIERS = [
  { n: 5, k: [2], b: [1] },
  { n: 5, k: [3], b: [1] },
  { n: 6, k: [3], b: [1, 2] },
  { n: 6, k: [4], b: [1, 2] },
  { n: 7, k: [4, 5], b: [2, 3] },
  { n: 8, k: [5, 6], b: [2, 3] },
];

// n：盤面、k：色(線)の数、b：交差マスの数、extra：答えを決めたあとに足す色マスの割合(序盤ほど多い。61で0)
export function configOf(stage) {
  const t = TIERS[tierOf(stage)], i = stage - 1;
  const k = t.k[i % t.k.length];
  const b = t.b[Math.floor(i / t.k.length) % t.b.length];
  const extra = Math.max(0, 0.3 - i * 0.005);
  return { n: t.n, k, b, extra };
}

// 線の通り道の図。ふつうのマスは1つの点、交差マスは横の通り道(マスの番号)と縦の通り道(N+i)の2つの点にする
export function buildLaneGraph(n, bridges) {
  const N = n * n, B = bridges.length, M = N + B;
  const bidx = new Int32Array(N).fill(-1);
  bridges.forEach((x, i) => { bidx[x] = i; });
  const cellOf = new Int32Array(M), other = new Int32Array(M).fill(-1), isV = new Uint8Array(M);
  for (let i = 0; i < N; i++) cellOf[i] = i;
  bridges.forEach((x, i) => { cellOf[N + i] = x; other[x] = N + i; other[N + i] = x; isV[N + i] = 1; });
  const nodeFor = (y, horizontal) => (bidx[y] >= 0 && !horizontal ? N + bidx[y] : y);
  const nb = [];
  for (let v = 0; v < M; v++) {
    const x = cellOf[v], r = Math.floor(x / n), c = x % n, a = [];
    const br = bidx[x] >= 0;
    const allowH = !br || !isV[v], allowV = !br || isV[v] === 1;
    if (allowV) { if (r > 0) a.push(nodeFor(x - n, false)); if (r < n - 1) a.push(nodeFor(x + n, false)); }
    if (allowH) { if (c > 0) a.push(nodeFor(x - 1, true)); if (c < n - 1) a.push(nodeFor(x + 1, true)); }
    nb.push(a);
  }
  return { n, N, M, nb, cellOf, other, bidx };
}

// 全部のマスを埋める線の引き方を探す(試作の search)
//   mode 'gen'：ランダムな順に探し、最初に見つかった引き方を返す(答えの線を作るとき)
//   mode 'diff'：決まった順に探し、intended とちがう引き方を返す(答えが1つかを確かめるとき)
export function search(G, k, starts, ends, cp, opt) {
  const { M, nb, other } = G;
  const isRE = new Uint8Array(M); for (const e of ends) isRE[e] = 1;
  const occ = new Int8Array(M).fill(-1);
  const heads = new Int32Array(k), done = new Uint8Array(k), need = new Int32Array(k);
  for (let v = 0; v < M; v++) if (cp[v] >= 0) need[cp[v]]++;
  const pathNodes = [];
  for (let c = 0; c < k; c++) {
    occ[starts[c]] = c; heads[c] = starts[c];
    if (cp[starts[c]] === c) need[c]--;
    pathNodes.push([starts[c]]);
  }
  const gen = opt.mode === 'gen', rng = opt.rng, limit = opt.limit, intended = opt.intended;
  const headMark = new Int32Array(M), seen = new Int32Array(M), queue = new Int32Array(M);
  let st = 0, nodes = 0, hit = false, result = null;

  function canColorEnter(c, x) {
    const ct = cp[x];
    if (ct >= 0 && ct !== c) return false;
    const o = other[x];
    if (o >= 0 && occ[o] === c) return false;
    return true;
  }
  function valid(c, t) {
    if (occ[t] >= 0) return false;
    if (!canColorEnter(c, t)) return false;
    if (isRE[t] && need[c] - (cp[t] === c ? 1 : 0) !== 0) return false;
    return true;
  }
  function prune() {
    st++;
    for (let c = 0; c < k; c++) if (!done[c]) headMark[heads[c]] = st;
    for (let x = 0; x < M; x++) {
      if (occ[x] >= 0) continue;
      let emp = 0, hd = 0;
      const ns = nb[x];
      for (let q = 0; q < ns.length; q++) {
        const y = ns[q];
        if (occ[y] < 0) emp++;
        else if (headMark[y] === st && canColorEnter(occ[y], x)) hd++;
      }
      if (isRE[x]) { if (emp + hd < 1) return false; }
      else if (emp < 1 || emp + hd < 2) return false;
    }
    st++;
    for (let x = 0; x < M; x++) {
      if (occ[x] >= 0 || seen[x] === st) continue;
      let qh = 0, qt = 0; queue[qt++] = x; seen[x] = st;
      let re = 0, hmask = 0, cmask = 0;
      while (qh < qt) {
        const v = queue[qh++];
        if (isRE[v]) re++;
        if (cp[v] >= 0) cmask |= 1 << cp[v];
        const ns = nb[v];
        for (let q = 0; q < ns.length; q++) {
          const y = ns[q];
          if (occ[y] < 0) { if (seen[y] !== st) { seen[y] = st; queue[qt++] = y; } }
          else { const c = occ[y]; if (!done[c] && heads[c] === y) hmask |= 1 << c; }
        }
      }
      if (re === 0 || hmask === 0) return false;
      let pc = 0, m = hmask; while (m) { pc += m & 1; m >>= 1; }
      if (pc < re) return false;
      if (cmask & ~hmask) return false;
    }
    return true;
  }
  function dfs(remaining) {
    if (++nodes > limit) { hit = true; return true; }
    if (remaining === 0) {
      for (let i = 0; i < M; i++) if (occ[i] < 0) return false;
      if (gen) { result = { occ: Array.from(occ), paths: pathNodes.map(p => p.slice()) }; return true; }
      for (let i = 0; i < M; i++) if (occ[i] !== intended[i]) { result = { occ: Array.from(occ) }; return true; }
      return false;
    }
    let best = -1, bestCnt = 99;
    for (let c = 0; c < k; c++) {
      if (done[c]) continue;
      let cnt = 0; const ns = nb[heads[c]];
      for (let q = 0; q < ns.length; q++) if (valid(c, ns[q])) cnt++;
      if (cnt === 0) return false;
      if (cnt < bestCnt || (gen && cnt === bestCnt && rng() < 0.5)) { bestCnt = cnt; best = c; if (cnt === 1 && !gen) break; }
    }
    const h = heads[best], ns = nb[h], list = [];
    for (let q = 0; q < ns.length; q++) if (valid(best, ns[q])) list.push(ns[q]);
    if (gen) shuffle(list, rng);
    for (const t of list) {
      occ[t] = best; heads[best] = t; pathNodes[best].push(t);
      const cpHit = cp[t] === best; if (cpHit) need[best]--;
      const fin = isRE[t] === 1; if (fin) done[best] = 1;
      let stop = false;
      if (prune()) stop = dfs(remaining - (fin ? 1 : 0));
      if (fin) done[best] = 0;
      if (cpHit) need[best]++;
      pathNodes[best].pop(); heads[best] = h; occ[t] = -1;
      if (stop) return true;
    }
    return false;
  }
  dfs(k);
  if (hit) return { status: 'limit', nodes };
  if (result) return { status: 'found', nodes, ...result };
  return { status: 'none', nodes };
}

// 交差マス・左右の円の行を決め、答えの線を作る(試作の genWithBridges)。左右の円の並びが入れ替わるものだけ
function genWithBridges(n, k, b, rng) {
  const N = n * n;
  const parity = x => ((Math.floor(x / n) + (x % n)) & 1);
  for (let attempt = 0; attempt < 400; attempt++) {
    const cand = [];
    for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) cand.push(r * n + c);
    shuffle(cand, rng);
    const br = [];
    for (const x of cand) {
      if (br.length >= b) break;
      // 交差マス同士はとなり合わせにしない
      if (br.some(y => Math.abs(y - x) === n || (Math.abs(y - x) === 1 && Math.floor(y / n) === Math.floor(x / n)))) continue;
      br.push(x);
    }
    if (br.length < b) continue;
    const rows = [...Array(n).keys()];
    const sRows = shuffle(rows.slice(), rng).slice(0, k).sort((a, c) => a - c);
    const eRows = shuffle(rows.slice(), rng).slice(0, k).sort((a, c) => a - c);
    const starts = sRows.map(r => r * n), ends = eRows.map(r => r * n + n - 1);
    let diff = 0;
    for (let x = 0; x < N; x++) diff += parity(x) === 0 ? 1 : -1;
    for (const x of br) diff += parity(x) === 0 ? 1 : -1;
    let ed = 0;
    for (const x of starts.concat(ends)) ed += parity(x) === 0 ? 1 : -1;
    if (diff * 2 !== ed) continue;
    const G = buildLaneGraph(n, br);
    const cp = new Int8Array(G.M).fill(-1);
    const res = search(G, k, starts, ends, cp, { mode: 'gen', rng, limit: 6000 });
    if (res.status !== 'found') continue;
    const lens = res.paths.map(p => p.length);
    if (Math.min(...lens) < Math.max(n, 0.45 * G.M / k)) continue;
    const endRowOf = res.paths.map(p => Math.floor(G.cellOf[p[p.length - 1]] / n));
    let swapped = false;
    for (let i = 1; i < k; i++) if (endRowOf[i] < endRowOf[i - 1]) swapped = true;
    if (!swapped) continue;
    return { G, bridges: br, nodePaths: res.paths };
  }
  return null;
}

// 問題を作る。答えが1つに決まる問題だけを返す(確かめきれないときは作り直す)
//   paths：答えの線(色ごとのマスの並び。左の円のとなりから右の円のとなりまで)
//   starts・ends：左右の円のとなりのマス(上から順)、bridges：交差マス、cp：色マス(マスごとの色。なければ -1)
const UNIQUE_LIMIT = 60000;
export function generate(stage, rng) {
  const { n, k, b, extra } = configOf(stage);
  const N = n * n;
  for (let attempt = 0; attempt < 200; attempt++) {
    const part = genWithBridges(n, k, b, rng);
    if (!part) continue;
    const { G, bridges, nodePaths } = part;
    const starts = nodePaths.map(p => p[0]);
    const ends = nodePaths.map(p => p[p.length - 1]);
    const assign = new Int8Array(G.M);
    nodePaths.forEach((p, c) => p.forEach(v => { assign[v] = c; }));
    const isStart = new Uint8Array(N), isEnd = new Uint8Array(N), isBridge = new Uint8Array(N);
    starts.forEach(x => { isStart[x] = 1; });
    ends.forEach(x => { isEnd[x] = 1; });
    bridges.forEach(x => { isBridge[x] = 1; });
    // 色ごとに1つ色マスを置いてから、ほかの答えがなくなるまで1つずつ足す
    const cp = new Int8Array(G.M).fill(-1);
    nodePaths.forEach((p, c) => {
      const inner = p.slice(1, -1).filter(v => v < N && !isBridge[v]);
      if (inner.length) cp[inner[randInt(rng, inner.length)]] = c;
    });
    let unique = false;
    for (let it = 0; it < N; it++) {
      const res = search(G, k, starts, ends, cp, { mode: 'diff', intended: assign, limit: UNIQUE_LIMIT });
      if (res.status === 'none') { unique = true; break; }
      if (res.status === 'limit') break;
      const diff = [], diffEnd = [];
      for (let i = 0; i < N; i++) {
        if (isBridge[i] || res.occ[i] === assign[i] || cp[i] >= 0 || isStart[i]) continue;
        (isEnd[i] ? diffEnd : diff).push(i);
      }
      const pool = diff.length ? diff : diffEnd;
      if (!pool.length) break;
      const pick = pool[randInt(rng, pool.length)];
      cp[pick] = assign[pick];
    }
    if (!unique) continue; // 確かめきれなかったので作り直す
    // 序盤は色マスを多めにして、手がかりを増やす
    if (extra > 0) {
      const free = [];
      for (let i = 0; i < N; i++) if (cp[i] < 0 && !isStart[i] && !isEnd[i] && !isBridge[i]) free.push(i);
      let add = Math.round(extra * free.length);
      while (add-- > 0 && free.length) {
        const x = free.splice(randInt(rng, free.length), 1)[0];
        cp[x] = assign[x];
      }
    }
    return {
      stage, n, k, b,
      paths: nodePaths.map(p => p.map(v => G.cellOf[v])),
      starts, ends, bridges,
      cp: Array.from(cp.slice(0, N)),
    };
  }
  throw new Error('よつつじの問題が作れなかった：ステージ ' + stage);
}

// ---------- 遊んでいる線についての計算 ----------
// lines：色ごとのマスの並び(左の円のとなりのマスから)

// 交差マスの横の通り道・縦の通り道と、ふつうのマスに、どの色の線が通っているか
export function occupancy(pz, lines) {
  const N = pz.n * pz.n, isBridge = new Set(pz.bridges);
  const occ = new Int8Array(N).fill(-1), oH = new Int8Array(N).fill(-1), oV = new Int8Array(N).fill(-1);
  lines.forEach((ln, c) => {
    for (let i = 0; i < ln.length; i++) {
      const x = ln[i];
      if (isBridge.has(x)) (Math.abs(ln[i - 1] - x) === 1 ? oH : oV)[x] = c;
      else occ[x] = c;
    }
  });
  return { occ, oH, oV };
}

export const isConnected = (pz, ln) => ln.length > 0 && pz.ends.includes(ln[ln.length - 1]);

// 全色の線をつなぎ、色マスを全部通して、空白を残さず全マスを埋めたらクリア
export function isSolved(pz, lines) {
  const O = occupancy(pz, lines), N = pz.n * pz.n, isBridge = new Set(pz.bridges);
  for (let i = 0; i < N; i++) {
    if (isBridge.has(i) ? (O.oH[i] < 0 || O.oV[i] < 0) : O.occ[i] < 0) return false;
    if (pz.cp[i] >= 0 && O.occ[i] !== pz.cp[i]) return false;
  }
  return lines.every(ln => isConnected(pz, ln));
}

// ヒント：色ごとに、答えの線と最初から同じ所だけ残す。戻した線の本数と、次に光らせる色・マス
//   光らせるマス(cells)は、次に進む所から次の曲がり角まで(まっすぐ進む分)。交差マスもそのまま数える
//   線がまだないとき(fromCircle)は、左の円から右へまっすぐ進む分
export function hintOf(pz, lines) {
  let removed = 0;
  const kept = lines.map((ln, c) => {
    const sol = pz.paths[c];
    let k = 0;
    while (k < ln.length && k < sol.length && ln[k] === sol[k]) k++;
    if (k < ln.length) removed++;
    return ln.slice(0, k);
  });
  const c = kept.findIndex((ln, i) => ln.length < pz.paths[i].length);
  if (c < 0) return { kept, removed, next: null };
  const path = pz.paths[c], k0 = kept[c].length;
  const dir = k0 === 0 ? 1 : path[k0] - path[k0 - 1]; // 左の円からは右向き
  const cells = [path[k0]];
  for (let j = k0 + 1; j < path.length && path[j] - path[j - 1] === dir; j++) cells.push(path[j]);
  const next = { c, cells, fromCircle: k0 === 0 };
  return { kept, removed, next };
}

// ---------- 絵の具の混ぜ方(試作と同じ。赤・黄・青で混ぜる) ----------
function rgb2ryb(r, g, b) {
  const w = Math.min(r, g, b); r -= w; g -= w; b -= w;
  const mg = Math.max(r, g, b);
  let y = Math.min(r, g); r -= y; g -= y;
  if (b > 0 && g > 0) { b /= 2; g /= 2; }
  y += g; b += g;
  const my = Math.max(r, y, b);
  if (my > 0) { const k = mg / my; r *= k; y *= k; b *= k; }
  return [r + w, y + w, b + w];
}
function ryb2rgb(r, y, b) {
  const w = Math.min(r, y, b); r -= w; y -= w; b -= w;
  const my = Math.max(r, y, b);
  let g = Math.min(y, b); y -= g; b -= g;
  if (b > 0 && g > 0) { b *= 2; g *= 2; }
  r += y; g += y;
  const mg = Math.max(r, g, b);
  if (mg > 0) { const k = my / mg; r *= k; g *= k; b *= k; }
  return [r + w, g + w, b + w];
}
const parseHex = h => [0, 2, 4].map(i => parseInt(h.replace('#', '').substr(i, 2), 16) / 255);
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
export function mixColors(a, b) {
  const A = rgb2ryb(...parseHex(a)), B = rgb2ryb(...parseHex(b));
  return toHex(ryb2rgb((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2));
}
