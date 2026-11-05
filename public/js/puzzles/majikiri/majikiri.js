// まじきり：盤面を端から端までの直線で区切り、部屋ごとの●の数を上の組み合わせとぴったり同じにする
// 操作：境目の近くをタップ、または指を上下(縦線)・左右(横線)にはらう。触感はタップで線を引いたときだけ

import { configOf, generate, makeCounter, isSolved, badRooms, hintOf } from './logic.js';
import { look } from '../../ui/look.js';

export const rules = [
  '引きたい境目の近くをタップすると、端から端まで直線が引ける。マスの左右のふちの近くなら縦線、上下のふちの近くなら横線。',
  '指を上下にはらうと縦線、左右にはらうと横線が引ける。',
  '引いた線は消せない。1手戻す・最初からで直す。',
  '決まった本数の縦線と横線で、部屋の●の数が上の組み合わせとぴったり同じになるように分けたらクリア。',
];

// ヒントの回数：線の本数−1(上限3回)。1〜20は1回、21〜40は2回、41〜は3回
export function hintLimit(stage) {
  const c = configOf(stage);
  return Math.min(3, c.v + c.h - 1);
}

export function describe(stage) {
  const c = configOf(stage);
  return `${c.n}×${c.n}・縦${c.v}本・横${c.h}本`;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function start(ctx) {
  const pz = generate(ctx.stage, ctx.rng);
  const { n } = pz;
  const count = makeCounter(n, pz.marks);
  const hasDot = new Set(pz.marks);
  let moves = [];     // 引いた線 { d: 'h' | 'v', p } を引いた順に
  let hintLine = null;
  let grow = null;    // いま伸ばす線と、伸び始める位置(0〜1)
  let locked = false;
  let won = false;

  // 組み合わせ(小さい順の札)
  ctx.top.innerHTML = `
    <div class="mj-label">この組み合わせの部屋に分ける</div>
    <div class="mj-target">${pz.target.map(x => `<span class="mj-chip" aria-label="●${x}個">${'<i></i>'.repeat(x)}</span>`).join('')}</div>`;

  // 盤面：マス目と●、その上に線
  const board = ctx.board;
  board.classList.add('majikiri', 'cells');
  board.style.setProperty('--n', n);
  board.innerHTML = '<div class="mj-grid"></div><div class="mj-lines"></div>';
  const grid = board.querySelector('.mj-grid');
  const layer = board.querySelector('.mj-lines');
  const dots = new Map();
  const cellSize = () => board.getBoundingClientRect().width / span(); // 1マスの大きさ(px)
  const swipeLimit = () => cellSize() / 3;

  for (let i = 0; i < n * n; i++) {
    const cell = document.createElement('div');
    if (hasDot.has(i)) {
      const dot = document.createElement('span');
      dot.className = 'mj-dot';
      cell.appendChild(dot);
      dots.set(i, dot);
    }
    grid.appendChild(cell);
    ctx.tapCell(cell, {
      onTap: e => draw(lineAt(e.clientX, e.clientY)),
      buzz: e => canDraw(lineAt(e.clientX, e.clientY)),
      moveLimit: swipeLimit,
    });
  }

  // マスはすき間をはさんで並ぶので、盤面の幅はマス n 個とすき間 n-1 個ぶん(マスの大きさで数えて W)
  const gapR = () => look().gap;
  const span = () => n + gapR() * (n - 1);
  // 境目 p(すき間のまん中)の位置。盤面の幅に対する割合
  const boundaryPos = p => (p + (p - 0.5) * gapR()) / span();
  // 指の位置。fx・fy は境目で数えた位置(境目 p がちょうど p)、px・py は盤面の幅に対する割合
  function where(x, y) {
    const r = board.getBoundingClientRect(), g = gapR(), W = span();
    const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
    return { fx: (px * W + g / 2) / (1 + g), fy: (py * W + g / 2) / (1 + g), px: clamp01(px), py: clamp01(py) };
  }
  const nearest = f => Math.min(n - 1, Math.max(1, Math.round(f)));
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }

  // タップ：いちばん近い縦の境目と横の境目のうち、近いほう
  function lineAt(x, y) {
    const { fx, fy, px, py } = where(x, y);
    const pv = nearest(fx), ph = nearest(fy);
    return Math.abs(fx - pv) <= Math.abs(fy - ph)
      ? { d: 'v', p: pv, from: py }
      : { d: 'h', p: ph, from: px };
  }

  // はらう：上下なら縦線、左右なら横線を、はらい始めた所にいちばん近い境目に
  let swipe = null;
  function onSwipeUp(e) {
    if (!swipe || e.pointerId !== swipe.id) return;
    const s = swipe;
    endSwipe();
    if (board.closest('[inert]')) return; // 確認などが出ているあいだは受け付けない
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) <= swipeLimit()) return; // タップは tapCell が受け持つ
    const { fx, fy, px, py } = where(s.x, s.y);
    draw(Math.abs(dy) > Math.abs(dx)
      ? { d: 'v', p: nearest(fx), from: py }
      : { d: 'h', p: nearest(fy), from: px });
  }
  function endSwipe() {
    swipe = null;
    window.removeEventListener('pointerup', onSwipeUp);
    window.removeEventListener('pointercancel', endSwipe);
  }
  // 盤面が指をつかまえる仕組み(pointer capture)は使わない。iPhoneでスイッチが押されなくなるため
  board.addEventListener('pointerdown', e => {
    if (!e.isPrimary || locked || board.closest('[inert]')) return;
    endSwipe();
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
    window.addEventListener('pointerup', onSwipeUp);
    window.addEventListener('pointercancel', endSwipe);
  });

  const lines = d => moves.filter(m => m.d === d).map(m => m.p);
  const limitOf = d => (d === 'v' ? pz.v : pz.h);
  const exists = line => moves.some(m => m.d === line.d && m.p === line.p);
  const allDrawn = () => moves.length === pz.v + pz.h;

  function canDraw(line) {
    return !locked && !exists(line) && lines(line.d).length < limitOf(line.d);
  }

  function draw(line) {
    if (locked || exists(line)) return;
    if (lines(line.d).length >= limitOf(line.d)) {
      ctx.sound.mistake();
      ctx.say(line.d === 'v' ? '縦線はもう引けない。' : '横線はもう引けない。');
      return;
    }
    moves.push({ d: line.d, p: line.p });
    hintLine = null;
    grow = line;
    ctx.sound.place();
    ctx.say('');
    if (isSolved(pz, count, lines('h'), lines('v'))) {
      locked = true;
      render();
      ctx.changed();
      ctx.cleared();
      return;
    }
    render();
    ctx.changed();
    if (allDrawn()) {
      setTimeout(() => ctx.sound.mistake(), 150);
      ctx.say('数が合わない部屋がある。1手戻してみよう');
    }
  }

  function lineEl(line) {
    const el = document.createElement('div');
    el.className = 'mj-line ' + line.d;
    // 線はマスのすき間の上に引く
    if (line.d === 'h') el.style.top = (boundaryPos(line.p) * 100) + '%';
    else el.style.left = (boundaryPos(line.p) * 100) + '%';
    return el;
  }

  function render() {
    // 線(引いた順に、その回の8色で1本ずつ)
    layer.innerHTML = '';
    moves.forEach((m, i) => {
      const el = lineEl(m);
      el.style.backgroundColor = ctx.colors[i % ctx.colors.length];
      layer.appendChild(el);
      if (grow && i === moves.length - 1 && !reduceMotion()) {
        // 押した所から両端へスーッと伸びる
        const [a, b] = m.d === 'h' ? ['left', 'right'] : ['top', 'bottom'];
        el.style[a] = grow.from * 100 + '%';
        el.style[b] = (1 - grow.from) * 100 + '%';
        void el.offsetWidth;
        el.style.transition = `${a} .18s ease-out, ${b} .18s ease-out`;
        el.style[a] = '0';
        el.style[b] = '0';
      }
    });
    grow = null;
    if (hintLine) {
      const el = lineEl(hintLine);
      el.classList.add('hint');
      layer.appendChild(el);
    }
    // 全部引いて合わなければ、多く出てきた数の部屋の●を赤く
    const bad = !won && allDrawn() ? badRooms(pz, count, lines('h'), lines('v')) : [];
    dots.forEach((dot, i) => {
      const r = Math.floor(i / n), c = i % n;
      dot.classList.toggle('bad', bad.some(x => r >= x.r0 && r < x.r1 && c >= x.c0 && c < x.c1));
      dot.classList.toggle('win', won);
    });
    ctx.setProgress(`縦あと${pz.v - lines('v').length}本・横あと${pz.h - lines('h').length}本`);
  }

  render();

  return {
    canUndo: () => !locked && moves.length > 0,
    undo() { moves.pop(); hintLine = null; ctx.say(''); render(); },
    reset() { moves = []; hintLine = null; ctx.say(''); render(); },
    hint() {
      const r = hintOf(pz, moves);
      moves = r.kept;
      hintLine = r.next;
      render();
      ctx.say(r.removed ? `${r.removed}手戻しました。光っている所に引いてみよう` : '光っている所に引いてみよう');
    },
    // どの部屋の●も、いっせいに光る
    glow() {
      won = true;
      hintLine = null;
      render();
      return new Promise(res => setTimeout(res, 700));
    },
    destroy() { endSwipe(); },
  };
}
