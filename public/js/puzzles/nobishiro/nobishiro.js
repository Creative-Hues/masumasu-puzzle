// のびしろ：置くと上下左右に伸び、先に伸びた色があとから置いたものの壁になる。決まった数で盤面を全部埋める
// 操作：空いたマスをタップして置く。触感は空いたマスに置いたときだけ

import { stageRng } from '../../core/rng.js';
import { configOf, generate, spread, stateOf, isFull, hintOf, EMPTY } from './logic.js';
import { look, hintBox } from '../../ui/look.js';

export const rules = [
  '丸の数だけ、空いたマスに置いて、全部埋めたらクリア。',
  '置くと、上下左右に、壁か色のマスにぶつかるまで伸びる。',
  '先に伸びた色は、あとから置いたものの壁になる。',
];

// 「4個置く」の数は問題を作らないとわからないので、作った問題を覚えておく
// 乱数は枠の ctx.rng と同じ作り方(stageRng)なので、同じステージ番号ならいつも同じ問題
const cache = new Map();
function puzzleFor(stage) {
  if (!cache.has(stage)) {
    cache.set(stage, generate(stage, stageRng('nobishiro', stage)));
    if (cache.size > 6) cache.delete(cache.keys().next().value);
  }
  return cache.get(stage);
}

export function describe(stage) {
  const c = configOf(stage);
  return `${c.n}×${c.n}・${puzzleFor(stage).limit}個置く`;
}

const FLOW_MS = 120; // 端まで伸びるのにかかる時間
const GLOW_STEP = 280; // クリアで、1色ごとに光る間隔
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function start(ctx) {
  const pz = puzzleFor(ctx.stage);
  const { n } = pz;
  const color = k => ctx.colors[k % ctx.colors.length]; // 9個目からは1色目に戻る
  let moves = [];
  let locked = false;
  let hintCell = -1;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  // 上に、置ける数だけ丸
  ctx.top.innerHTML = `<div class="nb-dots" aria-label="置ける数">${'<span class="nb-dot"></span>'.repeat(pz.limit)}</div>`;
  const dots = [...ctx.top.querySelectorAll('.nb-dot')];

  // 盤面のマスは最初に一度だけ作り、あとは中身だけ書き換える(触感用のスイッチを消さないため)
  const board = ctx.board;
  board.classList.add('nobishiro', 'cells');
  board.style.setProperty('--n', n);
  const walls = new Set(pz.walls);
  const cells = [];
  for (let i = 0; i < n * n; i++) {
    const cell = document.createElement('div');
    cell.className = 'nb-cell' + (walls.has(i) ? ' wall stripes' : '');
    const fill = document.createElement('div');
    fill.className = 'nb-fill';
    const num = document.createElement('span');
    num.className = 'nb-num';
    cell.append(fill, num);
    board.appendChild(cell);
    cells.push({ cell, fill, num });
    if (!walls.has(i)) ctx.tapCell(cell, { onTap: () => place(i), buzz: () => canPlace(i) });
  }

  const now = () => stateOf(pz, moves);
  const canPlace = i => !locked && moves.length < pz.limit && now()[i] === EMPTY;

  function place(i) {
    if (!canPlace(i)) return;
    const { info, out } = spread(n, now(), i, moves.length);
    moves.push(i);
    hintCell = -1;
    // 全部埋まったらクリア(少ない数で埋まったときも、ふつうのクリア)。伸び終わってから知らせる
    if (isFull(out)) locked = true;
    ctx.sound.place();
    ctx.say('');
    render(info);
    ctx.changed();
    if (locked) {
      later(() => ctx.cleared(), FLOW_MS + 250);
    } else if (moves.length === pz.limit) {
      later(() => ctx.sound.mistake(), 150);
      ctx.say('埋まりきらなかった。1手戻してみよう');
    }
  }

  // ヒント：光らせるマスに、共通の点線の四角を重ねる
  function showHint(cell, on) {
    const old = cell.querySelector('.hint-box');
    if (old) old.remove();
    if (on) cell.appendChild(hintBox(cell.clientWidth, cell.clientHeight, parseFloat(getComputedStyle(cell).borderTopLeftRadius) || 0));
  }

  // anim：いま置いた色の伸び方(spread の info)。あれば、絵の具がにじむように流す
  function render(anim) {
    const own = now();
    const flow = anim && !reduceMotion();
    let maxD = 1;
    const armLen = {};
    if (flow) {
      Object.values(anim).forEach(a => {
        maxD = Math.max(maxD, a.d);
        if (a.dir !== 'o') armLen[a.dir] = Math.max(armLen[a.dir] || 0, a.d);
      });
    }
    own.forEach((v, i) => {
      const { cell, fill, num } = cells[i];
      cell.classList.toggle('empty', v === EMPTY);
      showHint(cell, i === hintCell);
      fill.className = 'nb-fill';
      fill.style.cssText = '';
      if (v >= 0) {
        fill.style.backgroundColor = color(v);
        const a = flow && anim[i];
        if (a && a.dir !== 'o') {
          // じわっと始まり、途中は速く、端でやさしく止まる(試作と同じ計算)
          const L = armLen[a.dir], T = FLOW_MS * (0.5 + 0.5 * L / maxD);
          const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
          const s = T * ease((a.d - 1) / L), e = T * ease(a.d / L);
          const D = Math.max(40, e - s) / 0.6; // 色の先頭がマスを渡るのは動きの後半6割
          fill.style.setProperty('--fc', color(v));
          fill.style.animationDuration = D + 'ms';
          fill.style.animationDelay = (s - 0.4 * D) + 'ms';
          void fill.offsetWidth;
          fill.classList.add('flow', a.dir);
        }
      }
      const k = moves.indexOf(i);
      num.textContent = k >= 0 ? String(k + 1) : '';
    });
    dots.forEach((d, k) => { d.style.backgroundColor = k < moves.length ? color(k) : ''; });
    ctx.setProgress(`あと${pz.limit - moves.length}個`);
  }

  render();

  return {
    canUndo: () => !locked && moves.length > 0,
    undo() { moves.pop(); hintCell = -1; ctx.say(''); render(); },
    reset() { moves = []; hintCell = -1; ctx.say(''); render(); },
    hint() {
      const r = hintOf(pz, moves);
      moves = r.kept;
      hintCell = r.next;
      render();
      ctx.say(r.removed ? `${r.removed}手戻しました。光っている所に置いてみよう` : '光っている所に置いてみよう');
    },
    // 1個目、2個目…と、置いた順にその色のマスが光る
    glow() {
      hintCell = -1;
      render();
      const own = now();
      moves.forEach((_, k) => later(() => {
        own.forEach((v, i) => {
          if (v !== k) return;
          const c = cells[i].cell;
          c.classList.remove('glow');
          void c.offsetWidth;
          c.classList.add('glow');
        });
      }, k * GLOW_STEP));
      // 1色の光りは共通の長さ(0.7秒)。最後の色が光り終わるまで待つ
      return new Promise(res => later(res, Math.max(0, moves.length - 1) * GLOW_STEP + look().glowMs + 100));
    },
    destroy() { timers.forEach(clearTimeout); },
  };
}
