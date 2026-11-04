// うつしえ：太い枠の盤面にピースを置くと、境目を鏡にしてほかの盤面に映る。映った側をすき間なく埋める
// 操作：手持ちのピースをドラッグで置く(タップでは何も起きない)。ドラッグなので震えない

import { configOf, generate, boardsOf, cellsAt, hintOf, LAYOUT_NAME } from './logic.js';

export const rules = [
  '太い枠の盤面にピースを置くと、境目を鏡にして、ほかの盤面に映る。',
  '置いた盤面には何も残らない。斜線の盤面は隠れていて見えない。',
  'ピースは回せない。ドラッグで置く。',
  '置いたピースは外せない。1手戻すか最初からで直す。',
  'ほかの盤面をすき間なく埋めたらクリア。',
];

export function describe(stage) {
  const c = configOf(stage);
  return `${c.n}×${c.n}・${LAYOUT_NAME[c.layout]}`;
}

const TRAY_CELL = 18;   // 手持ちのピースのマスの大きさ
const LIFT = 28;        // ドラッグ中、ピースを指より上に浮かせる距離
const DRAG_START = 8;   // これ以上動いたらドラッグ(それより小さいとタップで、何もしない)

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const hexRgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
// 色 a を b に t だけ近づける(最初から置いてあるピースのうすい色)
const blend = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
// ピースのマス([r,c] の並び)を、つながった1つの形として描く(試作と同じ)
function drawPieceCells(c, rc, ox, oy, sz, color) {
  const g = Math.max(1.5, sz * 0.07), key = new Set(rc.map(([r, cc]) => r + ',' + cc));
  c.fillStyle = color;
  for (const [r, cc] of rc) {
    const x = ox + cc * sz, y = oy + r * sz;
    roundRect(c, x + g, y + g, sz - 2 * g, sz - 2 * g, sz * 0.16); c.fill();
    if (key.has(r + ',' + (cc + 1))) c.fillRect(x + sz * 0.5, y + g, sz, sz - 2 * g);
    if (key.has((r + 1) + ',' + cc)) c.fillRect(x + g, y + sz * 0.5, sz - 2 * g, sz);
    if (key.has(r + ',' + (cc + 1)) && key.has((r + 1) + ',' + cc) && key.has((r + 1) + ',' + (cc + 1))) c.fillRect(x + sz - g - 1, y + sz - g - 1, 2 * g + 2, 2 * g + 2);
  }
}
// 点線でマスを囲む(ドラッグ中の形・ヒント)
function dashCells(c, cells, n, ox, oy, sz, color) {
  const g = Math.max(1.5, sz * 0.07);
  c.save(); c.setLineDash([4, 3]); c.strokeStyle = color; c.lineWidth = 2;
  for (const x of cells) { roundRect(c, ox + (x % n) * sz + g, oy + Math.floor(x / n) * sz + g, sz - 2 * g, sz - 2 * g, sz * 0.16); c.stroke(); }
  c.restore();
}
function sizeCanvas(cv, w, h) {
  const d = Math.max(1, window.devicePixelRatio || 1);
  cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const c = cv.getContext('2d');
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, w, h);
  return c;
}
function drawShape(cv, shape, sz, color) {
  const h = Math.max(...shape.map(p => p[0])) + 1, w = Math.max(...shape.map(p => p[1])) + 1;
  drawPieceCells(sizeCanvas(cv, w * sz, h * sz), shape, 0, 0, sz, color);
  return { w, h };
}

export function start(ctx) {
  const pz = generate(ctx.stage, ctx.rng);
  const { n } = pz;
  const boards = boardsOf(pz.layout, n);
  const placeBoard = boards.find(b => b.place);
  const cols = 2, rows = pz.layout === 'H' ? 1 : 2;
  const colorOf = id => ctx.colors[pz.pieces[id].color];
  const prePlaced = () => pz.pre.map(id => ({ id, cells: pz.pieces[id].sol.slice() }));
  let placed = prePlaced(); // { id, cells } を置いた順に(最初から置いてあるピースが先)
  let ghost = null;         // ドラッグ中に、太い枠の盤面に点線で出す形
  let hint = null;          // ヒントで光らせるピースと場所
  let locked = false;
  let drag = null;
  let B = 0, cell = 0;      // 盤面1枚の大きさ、マスの大きさ

  // 盤面：絵(canvas)を1枚と、ヒントの点滅用に重ねる絵、ドラッグ中に浮かせる絵
  const board = ctx.board;
  board.classList.add('utsushie');
  board.style.setProperty('--aspect', cols / rows);
  board.innerHTML = '<canvas class="us-main"></canvas><canvas class="us-hint"></canvas>';
  const main = board.querySelector('.us-main');
  const hintCv = board.querySelector('.us-hint');
  // 浮かせる絵は画面全体に置く(盤面の場所の中に置くと、画面の位置とずれるため)
  const dragCv = document.createElement('canvas');
  dragCv.className = 'us-drag';
  dragCv.hidden = true;
  document.body.appendChild(dragCv);

  // 手持ち(盤面の下)。ピースの部品は一度だけ作り、置いたら隠す
  ctx.bottom.innerHTML = '<div class="us-tray" aria-label="手持ちのピース"></div>';
  const tray = ctx.bottom.querySelector('.us-tray');
  const pieceEls = pz.pieces.map(p => {
    const el = document.createElement('div');
    el.className = 'us-piece';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'ピース。ドラッグで置く');
    el.appendChild(document.createElement('canvas'));
    el.addEventListener('pointerdown', e => onPieceDown(e, p.id));
    tray.appendChild(el);
    return el;
  });
  // 手持ちの順番は、最初から置いてあるピースを除いて、id の順(問題を作るときに混ぜてある)

  const isPlaced = id => placed.some(p => p.id === id);
  const occupied = () => new Set(placed.flatMap(p => p.cells));
  const ownCount = () => placed.length - pz.pre.length;
  const boardXY = b => [b.bx * B, b.by * B];

  function layout() {
    const w = board.clientWidth;
    if (!w) return;
    B = w / cols;
    cell = B / n;
    render();
  }

  function render() {
    if (!B) return;
    const c = sizeCanvas(main, B * cols, B * rows);
    const g = Math.max(1.5, cell * 0.07);
    const tile = css('--tile'), mirrorBg = css('--gap'), placeBg = css('--chip');
    for (const b of boards) {
      const [bx, by] = boardXY(b);
      if (b.hidden) {
        // 斜線のグレーで隠す(のびしろの障害物と同じ色)
        c.save();
        roundRect(c, bx + g, by + g, B - 2 * g, B - 2 * g, cell * 0.2);
        c.fillStyle = css('--wall'); c.fill(); c.clip();
        c.strokeStyle = css('--stripe'); c.lineWidth = Math.max(2, cell * 0.12);
        const step = Math.max(9, cell * 0.45);
        c.beginPath();
        for (let d = -B; d < B * 2; d += step) { c.moveTo(bx + d, by + B); c.lineTo(bx + d + B, by); }
        c.stroke();
        c.restore();
        continue;
      }
      for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) {
        roundRect(c, bx + cc * cell + g, by + r * cell + g, cell - 2 * g, cell - 2 * g, cell * 0.16);
        c.fillStyle = b.place ? placeBg : mirrorBg; c.fill();
      }
      if (b.place) {
        // 置く盤面：太い枠。置いたピースは何も残らない
        c.strokeStyle = css('--ink'); c.lineWidth = 2.5;
        roundRect(c, bx + 1.25, by + 1.25, B - 2.5, B - 2.5, cell * 0.2); c.stroke();
      } else {
        placed.forEach(p => {
          const rc = p.cells.map(x => b.map(Math.floor(x / n), x % n));
          const col = colorOf(p.id);
          drawPieceCells(c, rc, bx, by, cell, pz.pre.includes(p.id) ? blend(col, tile, 0.45) : col);
        });
      }
    }
    const [px, py] = boardXY(placeBoard);
    if (ghost) dashCells(c, ghost.cells, n, px, py, cell, colorOf(ghost.id));
    // 境目の鏡の線
    c.save(); c.strokeStyle = css('--mute'); c.lineWidth = 2; c.setLineDash([6, 5]);
    c.beginPath();
    if (pz.layout === 'H') { c.moveTo(B, 0); c.lineTo(B, B); c.stroke(); }
    else {
      c.moveTo(0, B); c.lineTo(2 * B, B); c.moveTo(B, 0); c.lineTo(B, 2 * B); c.stroke();
      c.setLineDash([]); c.fillStyle = css('--mute'); c.beginPath(); c.arc(B, B, 4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    // ヒント：置く場所を、ピースと同じ色の点線で(重ねた絵ごと点滅させる)
    const hc = sizeCanvas(hintCv, B * cols, B * rows);
    if (hint) dashCells(hc, hint.cells, n, px, py, cell, colorOf(hint.id));
    renderTray();
  }

  function renderTray() {
    pz.pieces.forEach(p => {
      const el = pieceEls[p.id];
      el.hidden = pz.pre.includes(p.id);
      el.classList.toggle('placed', isPlaced(p.id));
      el.classList.toggle('hint', !!hint && hint.id === p.id);
      el.style.setProperty('--hc', colorOf(p.id));
      drawShape(el.firstChild, p.shape, TRAY_CELL, colorOf(p.id));
    });
    ctx.setProgress(`あと${pz.pieces.length - placed.length}個`);
  }

  // ---------- ドラッグ ----------
  function onPieceDown(e, id) {
    if (locked || drag || isPlaced(id) || board.closest('[inert]')) return;
    const el = pieceEls[id];
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { id, el, pid: e.pointerId, sx: e.clientX, sy: e.clientY, moving: false };
    el.addEventListener('pointermove', onPieceMove);
    el.addEventListener('pointerup', onPieceUp);
    el.addEventListener('pointercancel', onPieceUp);
    e.preventDefault();
  }
  function onPieceMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moving) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_START) return;
      drag.moving = true;
      const p = pz.pieces[drag.id];
      const dims = drawShape(dragCv, p.shape, cell, colorOf(drag.id));
      drag.w = dims.w; drag.h = dims.h;
      dragCv.hidden = false;
      drag.el.classList.add('lifted');
    }
    position(e.clientX, e.clientY);
  }
  // 指の少し上に浮かせ、太い枠の盤面に合う所なら点線を出す
  function position(x, y) {
    const left = x - (drag.w * cell) / 2, top = y - drag.h * cell - LIFT;
    dragCv.style.transform = `translate(${left}px,${top}px)`;
    const rect = main.getBoundingClientRect(), [px, py] = boardXY(placeBoard);
    const c0 = Math.round((left - (rect.left + px)) / cell), r0 = Math.round((top - (rect.top + py)) / cell);
    const cells = cellsAt(n, pz.pieces[drag.id].shape, r0, c0);
    const occ = occupied();
    const ok = cells && !cells.some(i => occ.has(i));
    drag.target = ok ? cells : null;
    drag.near = r0 > -drag.h && r0 < n && c0 > -drag.w && c0 < n;
    const next = ok ? { id: drag.id, cells } : null;
    if (JSON.stringify(next) !== JSON.stringify(ghost)) { ghost = next; render(); }
  }
  function endDrag() {
    const d = drag;
    drag = null;
    d.el.removeEventListener('pointermove', onPieceMove);
    d.el.removeEventListener('pointerup', onPieceUp);
    d.el.removeEventListener('pointercancel', onPieceUp);
    d.el.classList.remove('lifted');
    dragCv.hidden = true;
    ghost = null;
    return d;
  }
  function onPieceUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = endDrag();
    if (!d.moving) return; // タップでは何も起きない(ピースは回せない)
    if (d.target && !locked && !board.closest('[inert]')) {
      placed.push({ id: d.id, cells: d.target });
      hint = null;
      ctx.sound.place();
      ctx.say('');
      if (placed.length === pz.pieces.length) locked = true;
      render();
      ctx.changed();
      if (locked) ctx.cleared();
      return;
    }
    // 置けない所で離した：手持ちに戻る。盤面の近くなら小さくゆれて、間違いの音
    if (d.near) {
      d.el.classList.remove('shake'); void d.el.offsetWidth; d.el.classList.add('shake');
      ctx.sound.mistake();
    }
    render();
  }

  // 暗い画面に切り替えたときや、大きさが変わったときに描き直す
  const ro = new ResizeObserver(layout);
  ro.observe(board);
  const mo = new MutationObserver(render);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', render);
  layout();

  return {
    canUndo: () => !locked && ownCount() > 0,
    undo() { if (ownCount() > 0) placed.pop(); hint = null; ctx.say(''); render(); },
    reset() { placed = prePlaced(); hint = null; ctx.say(''); render(); },
    hint() {
      const r = hintOf(pz, placed);
      placed = r.kept;
      hint = r.next;
      render();
      ctx.say(r.removed ? `${r.removed}手戻しました。光っている所に置いてみよう` : '光っている所に置いてみよう');
    },
    // すき間なく埋まった盤面全体が、ふわっと光る
    glow() {
      hint = null;
      render();
      main.classList.remove('glow'); void main.offsetWidth; main.classList.add('glow');
      return new Promise(res => setTimeout(res, 800));
    },
    destroy() {
      if (drag) endDrag();
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', render);
      dragCv.remove();
    },
  };
}
