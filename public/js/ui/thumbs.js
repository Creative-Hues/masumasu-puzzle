// 最初の画面の小さな絵：パズルごとに決まった見本の盤面を、答えの半分くらいまで進めた所を描く
// 小さな図(SVG)で描く。色はアプリアイコンの4色。マスのすき間・角の丸み・地の色は盤面と同じ決まり
// 地とマスの色は色の名前(var(--bg) など)で描くので、明るい・暗いに自動で合う

import { look, pale } from './look.js';
import { spread, baseBoard, WALL, EMPTY } from '../puzzles/nobishiro/logic.js';

const SIZE = 64;   // 絵の大きさ(px)
const INNER = 56;  // 地の内側で、マスを並べる幅
const N = 5;       // 見本はどれも5×5
const ICON = ['#b5838d', '#e5989b', '#8e9aaf', '#a3b18a']; // アプリアイコンの4色

const svgOpen = () => `<svg class="thumb" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" aria-hidden="true">`
  + `<rect width="${SIZE}" height="${SIZE}" rx="10" style="fill:var(--bg)"/>`;
const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${r.toFixed(2)}" ${fill.startsWith('var') ? `style="fill:${fill}"` : `fill="${fill}"`} ${extra}/>`;

// n マスをすき間をはさんで幅 w に並べるときの、1マスの場所(pitch)とマスの大きさ(sq)・角の丸み(r)
function grid(w, n) {
  const L = look(), sq = w / (n + L.gap * (n - 1));
  return { sq, pitch: sq * (1 + L.gap), r: sq * L.radius };
}
// 斜線のマス(のびしろの障害物と同じ色。絵が小さいので線も細くする)
function stripes(id, x, y, s, r) {
  return `<defs><pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<rect width="3" height="3" style="fill:var(--wall)"/><rect width="1" height="3" style="fill:var(--stripe)"/></pattern></defs>`
    + rect(x, y, s, s, r, `url(#${id})`);
}

// のびしろ：障害物が3つ、2個置いて色が伸びた所
function nobishiro() {
  const g = grid(INNER, N), o = (SIZE - INNER) / 2;
  const walls = [7, 13, 21];
  let b = baseBoard(N, walls);
  const moves = [1, 19];
  moves.forEach((i, k) => { b = spread(N, b, i, k).out; });
  let s = svgOpen();
  b.forEach((v, i) => {
    const x = o + (i % N) * g.pitch, y = o + Math.floor(i / N) * g.pitch;
    if (v === WALL) s += stripes('nbw' + i, x, y, g.sq, g.r);
    else s += rect(x, y, g.sq, g.sq, g.r, v === EMPTY ? 'var(--cell)' : [ICON[0], ICON[2]][v]); // 見分けやすい2色
  });
  // 置いた所の白い丸(番号のかわり)
  moves.forEach(i => {
    const cx = o + (i % N) * g.pitch + g.sq / 2, cy = o + Math.floor(i / N) * g.pitch + g.sq / 2;
    s += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(g.sq * 0.31).toFixed(2)}" fill="rgba(255,255,255,.6)"/>`;
  });
  return s + '</svg>';
}

// まじきり：●と、縦線が1本引いてある所
function majikiri() {
  const L = look(), g = grid(INNER, N), o = (SIZE - INNER) / 2;
  const dots = [1, 3, 8, 11, 17, 19, 23];
  let s = svgOpen();
  for (let i = 0; i < N * N; i++) s += rect(o + (i % N) * g.pitch, o + Math.floor(i / N) * g.pitch, g.sq, g.sq, g.r, 'var(--cell)');
  dots.forEach(i => {
    const cx = o + (i % N) * g.pitch + g.sq / 2, cy = o + Math.floor(i / N) * g.pitch + g.sq / 2;
    s += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(g.sq * 0.18).toFixed(2)}" style="fill:var(--dot)"/>`;
  });
  // 2列目と3列目のすき間の上に、縦線を1本
  const w = Math.max(1.6, g.sq * L.line), x = o + 2 * g.pitch - (g.pitch - g.sq) / 2;
  s += rect(x - w / 2, o, w, INNER, w / 2, ICON[1]); // 4つの絵で、アイコンの4色をみな使う
  return s + '</svg>';
}

// よつつじ：1本はつながり、もう1本は途中の所。交差マスが1つ
function yotsutsuji() {
  const L = look(), gut = 0.85, pitch = INNER / (N + 2 * gut), sq = pitch / (1 + L.gap), pad = (pitch - sq) / 2;
  const ox = (SIZE - INNER) / 2 + gut * pitch, oy = (SIZE - N * pitch) / 2;
  const center = i => [ox + (i % N + 0.5) * pitch, oy + (Math.floor(i / N) + 0.5) * pitch];
  const left = r => [ox - gut * pitch * 0.54, oy + (r + 0.5) * pitch];
  const right = r => [ox + N * pitch + gut * pitch * 0.54, oy + (r + 0.5) * pitch];
  const bridge = 13, colorCell = 22;
  let s = svgOpen();
  for (let i = 0; i < N * N; i++) {
    const x = ox + (i % N) * pitch + pad, y = oy + Math.floor(i / N) * pitch + pad;
    s += rect(x, y, sq, sq, sq * L.radius, i === colorCell ? pale(ICON[2]) : 'var(--cell)');
    if (i === bridge) {
      const [cx, cy] = center(i), a = sq * 0.3, t = Math.max(1, sq * 0.08);
      s += rect(cx - a, cy - t / 2, a * 2, t, t / 2, 'var(--stripe)') + rect(cx - t / 2, cy - a, t, a * 2, t / 2, 'var(--stripe)');
    }
  }
  const lw = pitch * 0.3, R = pitch * 0.31;
  const path = pts => `<polyline points="${pts.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${lw.toFixed(2)}"`;
  // 1本目：上の円から、右の2行目の円へつながっている
  s += path([left(0), ...[0, 1, 2, 7, 8, 9].map(center), right(1)]) + ` stroke="${ICON[0]}"/>`;
  // 2本目：下の円から途中まで
  s += path([left(3), ...[15, 16, 21].map(center)]) + ` stroke="${ICON[2]}"/>`;
  const circle = (p, fill) => `<circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="${R.toFixed(2)}" ${fill.startsWith('var') ? `style="fill:${fill}"` : `fill="${fill}"`}/>`;
  s += circle(left(0), ICON[0]) + circle(left(3), ICON[2]) + circle(right(1), ICON[0]) + circle(right(4), 'var(--stripe)');
  return s + '</svg>';
}

// うつしえ：横に2つ。左の盤面に、ピースが3つ映った所。右は太い枠の置く盤面
function utsushie() {
  const L = look(), B = INNER / 2, g = grid(B - 1, N), ox = (SIZE - INNER) / 2, oy = (SIZE - B) / 2;
  const pieces = [[[0, 0], [0, 1], [1, 0]], [[1, 3], [1, 4], [2, 4]], [[3, 1], [4, 1], [4, 2]]];
  const owner = new Map();
  pieces.forEach((p, k) => p.forEach(([r, c]) => owner.set(r * N + c, k)));
  let s = svgOpen();
  for (const bx of [0, 1]) {
    const x0 = ox + bx * B + 0.5;
    for (let i = 0; i < N * N; i++) {
      const k = bx === 0 ? owner.get(i) : undefined;
      s += rect(x0 + (i % N) * g.pitch, oy + 0.5 + Math.floor(i / N) * g.pitch, g.sq, g.sq, g.r, k === undefined ? 'var(--cell)' : [ICON[0], ICON[2], ICON[3]][k]);
    }
    // 同じピースのとなりのマスはつなげて、1つの形に見せる
    if (bx === 0) owner.forEach((k, i) => {
      const r = Math.floor(i / N), c = i % N, x = x0 + c * g.pitch, y = oy + 0.5 + r * g.pitch, col = [ICON[0], ICON[2], ICON[3]][k];
      if (c < N - 1 && owner.get(i + 1) === k) s += rect(x + g.sq / 2, y, g.pitch, g.sq, 0, col);
      if (r < N - 1 && owner.get(i + N) === k) s += rect(x, y + g.sq / 2, g.sq, g.pitch, 0, col);
    });
  }
  s += `<rect x="${(ox + B + 0.6).toFixed(2)}" y="${(oy + 0.1).toFixed(2)}" width="${(B - 1.2).toFixed(2)}" height="${(B - 0.2).toFixed(2)}" rx="${(g.r + 1).toFixed(2)}" fill="none" style="stroke:var(--ink)" stroke-width="1.2"/>`;
  s += `<line x1="${(ox + B).toFixed(2)}" y1="${oy.toFixed(2)}" x2="${(ox + B).toFixed(2)}" y2="${(oy + B).toFixed(2)}" style="stroke:var(--mute)" stroke-width="0.8" stroke-dasharray="2 1.6"/>`;
  return s + '</svg>';
}

const DRAW = { nobishiro, majikiri, yotsutsuji, utsushie };
export function thumbnail(id) {
  return DRAW[id] ? DRAW[id]() : '';
}
