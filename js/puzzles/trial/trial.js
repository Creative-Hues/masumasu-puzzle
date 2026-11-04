// 確かめ用の仮パズル(フェーズ1だけ。4つの本物がそろったら消す)
// 印のついたマスを全部押したらクリア。印のないマスを押すと間違い
// 共通部分(乱数・段階・配色・ヒント・クリアの帯・音・触感・保存)を全部通るように作ってある

import { tierOf } from '../../core/stages.js';
import { shuffle } from '../../core/rng.js';

const SIZES = [5, 6, 6, 7, 7, 8];

function sizeOf(stage) {
  return SIZES[tierOf(stage)];
}

export const rules = [
  '印のついたマスを、全部押したらクリア。',
  '印のないマスを押すと間違いになる。1手戻す・最初からで直す。',
];

export function describe(stage) {
  const n = sizeOf(stage);
  return `${n}×${n}`;
}

export function start(ctx) {
  const n = sizeOf(ctx.stage);
  const total = n * n;
  const want = Math.round(total * 0.28);
  // 印のマス。この並びをヒントで光らせる順番にも使う
  const order = shuffle([...Array(total).keys()], ctx.rng).slice(0, want);
  const marks = new Set(order);
  let moves = [];
  let locked = false;

  const board = ctx.board;
  board.classList.add('trial');
  board.style.setProperty('--n', n);
  const cells = [];
  for (let i = 0; i < total; i++) {
    const c = document.createElement('div');
    c.className = 'cell' + (marks.has(i) ? ' mark' : '');
    c.addEventListener('click', () => tap(i));
    board.appendChild(c);
    cells.push(c);
  }

  const solved = () => moves.length === want && moves.every(i => marks.has(i));

  function clearHint() {
    cells.forEach(c => c.classList.remove('hint'));
  }

  function render() {
    const hits = moves.filter(i => marks.has(i));
    cells.forEach((c, i) => {
      const h = hits.indexOf(i);
      c.classList.toggle('hit', h >= 0);
      c.classList.toggle('wrong', !marks.has(i) && moves.includes(i));
      c.style.backgroundColor = h >= 0 ? ctx.colors[h % ctx.colors.length] : '';
    });
    ctx.setProgress(`印${hits.length}/${want}`);
  }

  function finishIfSolved() {
    if (solved()) { locked = true; ctx.cleared(); }
  }

  function tap(i) {
    if (locked || moves.includes(i)) return;
    clearHint();
    moves.push(i);
    if (marks.has(i)) {
      ctx.sound.place();
      ctx.say('');
    } else {
      ctx.sound.mistake();
      ctx.say('印のないマスだった。1手戻してみよう');
    }
    ctx.haptic();
    render();
    ctx.changed();
    finishIfSolved();
  }

  render();

  return {
    canUndo: () => !locked && moves.length > 0,
    undo() { moves.pop(); clearHint(); ctx.say(''); render(); },
    reset() { moves = []; clearHint(); ctx.say(''); render(); },
    hint() {
      const before = moves.length;
      moves = moves.filter(i => marks.has(i));
      const back = before - moves.length;
      render();
      if (solved()) { ctx.say(''); finishIfSolved(); return; }
      const next = order.find(i => !moves.includes(i));
      clearHint();
      cells[next].classList.add('hint');
      ctx.say(back ? `${back}手戻しました。光っている所を押してみよう` : '光っている所を押してみよう');
    },
    glow() {
      clearHint();
      cells.forEach(c => { if (c.classList.contains('hit')) c.classList.add('glow'); });
      return new Promise(r => setTimeout(r, 700));
    },
  };
}
