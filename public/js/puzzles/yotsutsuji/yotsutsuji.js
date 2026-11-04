// よつつじ：左の色つきの円から線をなぞって右のグレーの円につなぎ、盤面を空白なく埋める
// 操作はなぞる(震えない)。1回のなぞり(指を置いてから離すまで)と、左の円のタップで消すのが1手
// 問題作りは裏側(worker.js)で行い、次のステージを先に作っておく

import { stageRng } from '../../core/rng.js';
import { configOf, generate, occupancy, isConnected, isSolved, hintOf, mixColors } from './logic.js';

export const rules = [
  '左の円からなぞって、右の円のどれかにつなぐ。',
  '線は、同じ色のマスを全部通る。',
  '線は交差しない。空白を残さず埋めたらクリア。',
  '＋のマスだけは交差できる。縦と横に、ちがう色の線を1本ずつまっすぐ通す。',
  '左の円をタップすると、その色の線が消える。',
];

export function describe(stage) {
  const c = configOf(stage);
  return `${c.n}×${c.n}・${c.k}色・交差${c.b}`;
}

// ---------- 問題の用意(裏側で作り、作ったものは覚えておく) ----------
const cache = new Map(), waiting = new Map();
let worker = null, workerTried = false;
function deliver(stage, pz) {
  cache.set(stage, pz);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  const fns = waiting.get(stage) || [];
  waiting.delete(stage);
  fns.forEach(fn => fn(pz));
}
// 裏側が使えない端末では、表で作る
function makeHere(stage) {
  setTimeout(() => deliver(stage, generate(stage, stageRng('yotsutsuji', stage))), 30);
}
function ensureWorker() {
  if (workerTried) return worker;
  workerTried = true;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => deliver(e.data.stage, e.data.pz);
    worker.onerror = () => { worker = null; [...waiting.keys()].forEach(makeHere); };
  } catch (e) {
    worker = null;
  }
  return worker;
}
function getPuzzle(stage) {
  return new Promise(resolve => {
    if (cache.has(stage)) { resolve(cache.get(stage)); return; }
    if (waiting.has(stage)) { waiting.get(stage).push(resolve); return; }
    waiting.set(stage, [resolve]);
    const w = ensureWorker();
    if (w) w.postMessage(stage); else makeHere(stage);
  });
}

// ---------- 絵 ----------
const G = 0.85; // 左右の円の場所の幅(マスいくつぶんか)
const GY = 0.08; // 上下の余白(マスいくつぶんか)
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
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

export async function start(ctx) {
  const { n: n0 } = configOf(ctx.stage);
  const board = ctx.board;
  board.classList.add('yotsutsuji');
  board.style.setProperty('--aspect', (n0 + 2 * G) / (n0 + 2 * GY));
  let pz = cache.get(ctx.stage);
  if (!pz) {
    board.innerHTML = '<p class="yt-wait">問題を作っています。</p>';
    pz = await getPuzzle(ctx.stage);
    // 待っているあいだに、ほかのステージへ移っていたら何もしない
    if (!ctx.isCurrent()) return { canUndo: () => false, undo() {}, reset() {}, hint() {}, glow: () => Promise.resolve() };
  }
  getPuzzle(ctx.stage + 1); // 次のステージを先に作っておく

  const { n, k } = pz, N = n * n;
  const col = ctx.colors.slice(0, k); // 上の円から1色目・2色目…
  const isStart = new Int8Array(N).fill(-1), endIndex = new Int8Array(N).fill(-1), bidx = new Int8Array(N).fill(-1);
  pz.starts.forEach((x, c) => { isStart[x] = c; });
  pz.ends.forEach((x, j) => { endIndex[x] = j; });
  pz.bridges.forEach((x, i) => { bidx[x] = i; });
  let lines = pz.starts.map(() => []);
  let history = [];
  let hint = null;
  let locked = false;
  let dead = false;
  const anims = [];
  let raf = 0;

  board.innerHTML = '<canvas class="yt-main"></canvas><canvas class="yt-hint"></canvas>';
  const main = board.querySelector('.yt-main');
  const hintCv = board.querySelector('.yt-hint');
  let cell = 40, gx = 30, gy = 3, W = 300, H = 300;

  function layout() {
    const w = board.clientWidth;
    if (!w) return;
    W = w;
    cell = W / (n + 2 * G);
    gx = G * cell; gy = GY * cell;
    H = n * cell + gy * 2;
    render();
  }
  const center = i => [gx + (i % n + 0.5) * cell, gy + (Math.floor(i / n) + 0.5) * cell];
  const leftCircle = c => [gx * 0.46, gy + (Math.floor(pz.starts[c] / n) + 0.5) * cell];
  const rightCircle = j => [gx + n * cell + gx * 0.54, gy + (Math.floor(pz.ends[j] / n) + 0.5) * cell];
  const connected = c => isConnected(pz, lines[c]);

  function animProgress(type, key, now) {
    const a = anims.find(z => z.type === type && z.key === key);
    return a ? Math.min(1, (now - a.t0) / a.dur) : -1;
  }
  function animate(a) {
    if (reduceMotion()) { render(); return; }
    for (let i = anims.length - 1; i >= 0; i--) if (anims[i].type === a.type && anims[i].key === a.key) anims.splice(i, 1);
    a.t0 = performance.now();
    anims.push(a);
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0;
    if (dead) return;
    for (let i = anims.length - 1; i >= 0; i--) if (now - anims[i].t0 > anims[i].dur) anims.splice(i, 1);
    render(now);
    if (anims.length) raf = requestAnimationFrame(tick); else render();
  }

  function render(now) {
    if (dead) return;
    now = now || performance.now();
    const c = sizeCanvas(main, W, H);
    const O = occupancy(pz, lines);
    const cellBg = css('--gap'), peg = css('--stripe'), surface = css('--tile');
    const pad = Math.max(1.5, cell * 0.05), rad = cell * 0.16, lw = cell * 0.3;
    for (let i = 0; i < N; i++) {
      const x = gx + (i % n) * cell + pad, y = gy + Math.floor(i / n) * cell + pad, s = cell - pad * 2;
      roundRect(c, x, y, s, s, rad); c.fillStyle = cellBg; c.fill();
      if (bidx[i] >= 0) {
        // 交差マス：2色が通ると、絵の具のように混ぜた色。＋の印
        const full = O.oH[i] >= 0 && O.oV[i] >= 0;
        if (full) {
          let a = 0.6;
          const t = animProgress('mix', i, now);
          if (t >= 0) a = 0.6 * (1 - Math.pow(1 - t, 3));
          c.globalAlpha = a; roundRect(c, x, y, s, s, rad); c.fillStyle = mixColors(col[O.oH[i]], col[O.oV[i]]); c.fill(); c.globalAlpha = 1;
        }
        const cx = x + s / 2, cy = y + s / 2, arm = s * 0.3, th = Math.max(2, cell * 0.08);
        c.fillStyle = full ? surface : peg;
        c.globalAlpha = full ? 0.55 : 1;
        roundRect(c, cx - arm, cy - th / 2, arm * 2, th, th / 2); c.fill();
        roundRect(c, cx - th / 2, cy - arm, th, arm * 2, th / 2); c.fill();
        c.globalAlpha = 1;
        continue;
      }
      const cp = pz.cp[i];
      if (cp >= 0) {
        // 色マス：その色をうすく塗り、ふちを描く
        c.globalAlpha = 0.38; roundRect(c, x, y, s, s, rad); c.fillStyle = col[cp]; c.fill();
        c.globalAlpha = 0.9; c.lineWidth = Math.max(1.5, cell * 0.04); c.strokeStyle = col[cp];
        roundRect(c, x + c.lineWidth / 2, y + c.lineWidth / 2, s - c.lineWidth, s - c.lineWidth, rad); c.stroke();
        c.globalAlpha = 1;
      } else if (O.occ[i] >= 0) {
        c.globalAlpha = 0.14; roundRect(c, x, y, s, s, rad); c.fillStyle = col[O.occ[i]]; c.fill(); c.globalAlpha = 1;
      }
    }
    // 線(クリアのときは少し太くなって戻る)
    c.lineCap = 'round'; c.lineJoin = 'round';
    const widthOf = ci => {
      const t = animProgress('flash', ci, now);
      return t >= 0 ? lw * (1 + 0.35 * Math.sin(t * Math.PI * 2) * (1 - t)) : lw;
    };
    lines.forEach((ln, ci) => {
      if (!ln.length) return;
      const pts = [leftCircle(ci), ...ln.map(center)];
      if (connected(ci)) pts.push(rightCircle(endIndex[ln[ln.length - 1]]));
      c.strokeStyle = col[ci]; c.lineWidth = widthOf(ci);
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let q = 1; q < pts.length; q++) c.lineTo(pts[q][0], pts[q][1]);
      c.stroke();
    });
    // 交差マスでは、横の線が縦の線の上を通るように描き直す
    pz.bridges.forEach(b => {
      const h = O.oH[b];
      if (h < 0 || O.oV[b] < 0) return;
      const x = gx + (b % n) * cell, y = gy + Math.floor(b / n) * cell, cy = center(b)[1];
      c.save();
      c.beginPath(); c.rect(x + pad, y, cell - pad * 2, cell); c.clip();
      c.lineCap = 'butt'; c.strokeStyle = surface; c.lineWidth = widthOf(h) + cell * 0.14;
      c.beginPath(); c.moveTo(x, cy); c.lineTo(x + cell, cy); c.stroke();
      c.restore();
      c.save();
      c.beginPath(); c.rect(x, y, cell, cell); c.clip();
      c.lineCap = 'butt'; c.strokeStyle = col[h]; c.lineWidth = widthOf(h);
      c.beginPath(); c.moveTo(x, cy); c.lineTo(x + cell, cy); c.stroke();
      c.restore();
    });
    // なぞっている線の先っぽ
    if (drag && drag.started && lines[drag.c].length) {
      const ln = lines[drag.c], [hx, hy] = center(ln[ln.length - 1]);
      c.fillStyle = col[drag.c]; c.beginPath(); c.arc(hx, hy, cell * 0.24, 0, Math.PI * 2); c.fill();
    }
    // 左の円(色つき)と右の円(グレー。つながるとその色)
    const R = cell * 0.31;
    pz.starts.forEach((x, ci) => {
      const [cx, cy] = leftCircle(ci);
      c.fillStyle = col[ci]; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      c.lineWidth = Math.max(2, cell * 0.06); c.strokeStyle = surface; c.stroke();
    });
    const endColor = new Array(k).fill(-1);
    lines.forEach((ln, ci) => { if (connected(ci)) endColor[endIndex[ln[ln.length - 1]]] = ci; });
    pz.ends.forEach((x, j) => {
      const [cx, cy] = rightCircle(j);
      let r = R;
      const t = animProgress('pop', j, now);
      if (t >= 0 && endColor[j] >= 0) r = R * (1 + 0.28 * Math.sin(t * Math.PI));
      c.fillStyle = endColor[j] >= 0 ? col[endColor[j]] : peg;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.lineWidth = Math.max(2, cell * 0.06); c.strokeStyle = surface; c.stroke();
    });
    // ヒント：次に進むマスを、その線の色の点線で(重ねた絵ごと点滅)。線がまだなければ左の円も
    const hc = sizeCanvas(hintCv, W, H);
    if (hint) {
      hc.save(); hc.setLineDash([5, 4]); hc.strokeStyle = col[hint.c]; hc.lineWidth = Math.max(2.5, cell * 0.07);
      const x = gx + (hint.cell % n) * cell + pad * 2, y = gy + Math.floor(hint.cell / n) * cell + pad * 2, s = cell - pad * 4;
      roundRect(hc, x, y, s, s, rad); hc.stroke();
      if (hint.fromCircle) {
        const [cx, cy] = leftCircle(hint.c);
        hc.beginPath(); hc.arc(cx, cy, R * 1.45, 0, Math.PI * 2); hc.stroke();
      }
      hc.restore();
    }
    let conn = 0;
    for (let ci = 0; ci < k; ci++) if (connected(ci)) conn++;
    ctx.setProgress(`あと${k - conn}本`);
  }

  // ---------- なぞる ----------
  let drag = null;
  let lastStep = 0;
  // 1マス進む・戻るごとに小さい「コッ」(続けて鳴りすぎないように少しあける)
  function stepSound() {
    const t = performance.now();
    if (t - lastStep < 35) return;
    lastStep = t;
    ctx.sound.step();
  }
  function hit(e) {
    const rect = main.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const r = Math.floor((y - gy) / cell), c = Math.floor((x - gx) / cell);
    if (r < 0 || r >= n) return null;
    if (c >= 0 && c < n) return { type: 'cell', i: r * n + c };
    if (x < gx) for (let ci = 0; ci < k; ci++) if (Math.floor(pz.starts[ci] / n) === r) return { type: 'left', c: ci };
    return null;
  }
  // 色 c の線が、h から x へ進めるか
  function canEnter(c, h, x, O) {
    if (isStart[x] >= 0 && isStart[x] !== c) return false;
    if (bidx[x] >= 0) {
      const horiz = Math.abs(x - h) === 1;
      const lane = horiz ? O.oH : O.oV, otherLane = horiz ? O.oV : O.oH;
      if (lane[x] >= 0) return false;
      if (otherLane[x] === c) return false; // 同じ色の線が自分と交差するのはだめ
      return true;
    }
    if (O.occ[x] >= 0) return false;
    const cp = pz.cp[x];
    return !(cp >= 0 && cp !== c);
  }
  // 指のいるマス t へ向かって、1マスずつたどって伸ばす・縮める
  function stepToward(c, t) {
    for (let guard = 0; guard < n * 4; guard++) {
      const ln = lines[c], h = ln[ln.length - 1];
      if (h === t) return;
      const own = ln.indexOf(t);
      if (own >= 0) { ln.length = own + 1; stepSound(); return; }
      const hr = Math.floor(h / n), hc = h % n, tr = Math.floor(t / n), tc = t % n;
      const dr = tr - hr, dc = tc - hc, opts = [];
      const vert = dr !== 0 ? h + Math.sign(dr) * n : -1, horz = dc !== 0 ? h + Math.sign(dc) : -1;
      if (Math.abs(dr) >= Math.abs(dc)) { if (vert >= 0) opts.push(vert); if (horz >= 0) opts.push(horz); }
      else { if (horz >= 0) opts.push(horz); if (vert >= 0) opts.push(vert); }
      const straight = (bidx[h] >= 0 && ln.length >= 2) ? h + (h - ln[ln.length - 2]) : -1; // 交差マスの中はまっすぐだけ
      let moved = false;
      const O = occupancy(pz, lines);
      for (const nx of opts) {
        const back = ln.indexOf(nx);
        if (back >= 0) { ln.length = back + 1; moved = true; stepSound(); break; }
        if (connected(c)) continue; // 右の円につながったら、そこで止まる
        if (straight >= 0 && nx !== straight) continue;
        if (canEnter(c, h, nx, O)) {
          ln.push(nx); moved = true;
          if (endIndex[nx] >= 0) { animate({ type: 'pop', key: endIndex[nx], dur: 320 }); ctx.sound.place(); }
          else stepSound();
          if (bidx[nx] >= 0) {
            const horiz = Math.abs(nx - h) === 1;
            if ((horiz ? O.oV : O.oH)[nx] >= 0) animate({ type: 'mix', key: nx, dur: 450 });
          }
          break;
        }
      }
      if (!moved) return;
    }
  }
  const snapshot = () => lines.map(a => a.slice());
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function onDown(e) {
    if (locked || drag || board.closest('[inert]')) return;
    const h = hit(e);
    if (!h) return;
    let d = null;
    if (h.type === 'left') d = { c: h.c, mode: 'circle', started: false };
    else {
      for (let ci = 0; ci < k; ci++) {
        const ln = lines[ci];
        if (ln.length && ln[ln.length - 1] === h.i) { d = { c: ci, mode: 'continue', started: true }; break; }
      }
      if (!d && isStart[h.i] >= 0) d = { c: isStart[h.i], mode: 'restart', started: false };
    }
    if (!d) return;
    d.before = snapshot(); d.id = e.pointerId; d.startCell = h.type === 'cell' ? h.i : -1;
    drag = d;
    try { main.setPointerCapture(e.pointerId); } catch (_) {} // なぞっているあいだ、指を盤面がつかまえる
    e.preventDefault();
    render();
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const h = hit(e);
    if (!h || h.type !== 'cell') return;
    if (!drag.started) {
      if (drag.mode === 'restart' && h.i === drag.startCell) return;
      drag.started = true;
      lines[drag.c] = [pz.starts[drag.c]]; // 引き直し
      stepSound();
    }
    stepToward(drag.c, h.i);
    hint = null;
    render();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    // 左の円をタップ：その色の線が消える
    if (d.mode === 'circle' && !d.started) {
      if (lines[d.c].length) ctx.sound.button();
      lines[d.c] = [];
    }
    commit(d.before);
  }
  function commit(before) {
    if (!same(before, lines)) { history.push(before); hint = null; }
    if (isSolved(pz, lines)) {
      locked = true;
      render();
      ctx.changed();
      ctx.cleared();
      return;
    }
    render();
    ctx.changed();
    if (!same(before, lines)) {
      if (lines.every((ln, ci) => connected(ci))) {
        // 全部つないだのに、空いたマスがある・通っていない色マスがある
        setTimeout(() => ctx.sound.mistake(), 150);
        ctx.say('空いたマスがある。1手戻してみよう');
      } else {
        ctx.say('');
      }
    }
  }
  main.addEventListener('pointerdown', onDown);
  main.addEventListener('pointermove', onMove);
  main.addEventListener('pointerup', onUp);
  main.addEventListener('pointercancel', onUp);

  // 暗い画面に切り替えたときや、大きさが変わったときに描き直す
  const ro = new ResizeObserver(layout);
  ro.observe(board);
  const mo = new MutationObserver(() => render());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => render();
  mq.addEventListener('change', onScheme);
  layout();

  return {
    canUndo: () => !locked && history.length > 0,
    undo() { if (history.length) lines = history.pop(); hint = null; ctx.say(''); render(); },
    reset() { lines = pz.starts.map(() => []); history = []; hint = null; ctx.say(''); render(); },
    hint() {
      const r = hintOf(pz, lines);
      lines = r.kept;
      hint = r.next;
      render();
      ctx.say(r.removed ? `${r.removed}本戻しました。光っている所までなぞってみよう` : '光っている所までなぞってみよう');
    },
    // 線が光る(少し太くなって戻り、明るくなる)
    glow() {
      hint = null;
      lines.forEach((ln, ci) => animate({ type: 'flash', key: ci, dur: 700 }));
      main.classList.remove('glow'); void main.offsetWidth; main.classList.add('glow');
      return new Promise(res => setTimeout(res, 750));
    },
    destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', onScheme);
    },
  };
}
