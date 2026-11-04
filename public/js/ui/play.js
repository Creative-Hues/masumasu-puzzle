// 遊ぶ画面の枠。4つのパズルで同じ
// 上：もどる・◀ステージ▶・一覧、盤面の中身・進み具合・ヒントの残り
// 下：1手戻す・最初から・ヒント、その下にルールの説明。クリアすると下から帯

import { stageRng } from '../core/rng.js';
import { tierOf } from '../core/stages.js';
import { colorsFor } from '../core/palettes.js';
import { createHintCounter } from '../core/hints.js';
import { sound } from '../core/sound.js';
import { bindCellTap } from '../core/haptics.js';

export function playScreen(root, { store, go }, entry) {
  root.innerHTML = `
    <div class="app play">
      <header class="bar">
        <button class="text" data-act="home">もどる</button>
        <div class="stage">
          <button class="icon" data-act="prev" aria-label="前のステージ">◀</button>
          <b class="stage-no"></b>
          <button class="icon" data-act="next" aria-label="次のステージ">▶</button>
        </div>
        <button class="text" data-act="list">一覧</button>
      </header>
      <div class="info">
        <span class="size"></span><span class="progress"></span><span>ヒント残り<b class="hints-left"></b></span>
      </div>
      <div class="top"></div>
      <div class="msg" aria-live="polite"></div>
      <div class="board-wrap">
        <div class="board"></div>
        <div class="confirm" hidden>
          <p>このステージを飛ばしますか。</p>
          <div class="row">
            <button class="primary" data-act="skip-yes">飛ばす</button>
            <button data-act="skip-no">やめる</button>
          </div>
        </div>
      </div>
      <div class="ctrl">
        <button data-act="undo">1手戻す</button>
        <button data-act="reset">最初から</button>
        <button data-act="hint" class="hint-btn"></button>
      </div>
      <ul class="rules">${entry.game.rules.map(r => `<li>${r}</li>`).join('')}</ul>
    </div>
    <div class="band" aria-live="polite">
      <div class="band-in">
        <b>クリア。</b>
        <button class="primary" data-act="band-next">次へ</button>
      </div>
    </div>`;

  const $ = sel => root.querySelector(sel);
  const btn = act => $(`[data-act="${act}"]`);
  const band = $('.band'), confirmBox = $('.confirm'), msg = $('.msg');

  let stage = 1, inst = null, hints = createHintCounter(), busy = false, token = 0;

  function refresh() {
    const p = store.progress(entry.id);
    $('.stage-no').textContent = `ステージ ${stage}`;
    btn('prev').disabled = stage <= 1;
    btn('next').disabled = stage > p.maxCleared;
    btn('undo').disabled = busy || !inst || !inst.canUndo();
    btn('reset').disabled = busy || !inst;
    btn('hint').disabled = busy || !inst;
    btn('hint').textContent = hints.exhausted ? 'このステージを飛ばす' : 'ヒント';
    $('.hints-left').textContent = hints.left;
  }

  async function load(s) {
    const my = ++token;
    if (inst && inst.destroy) inst.destroy();
    inst = null;
    stage = s;
    busy = false;
    hints = createHintCounter();
    store.setCurrent(entry.id, s);
    band.classList.remove('show');
    confirmBox.hidden = true;
    msg.textContent = '';
    $('.top').innerHTML = '';
    $('.progress').textContent = '';
    const board = $('.board');
    board.innerHTML = '';
    board.className = 'board';
    board.removeAttribute('style');
    $('.size').textContent = entry.game.describe(s);
    refresh();

    const ctx = {
      stage: s,
      tier: tierOf(s),
      rng: stageRng(entry.id, s),
      colors: colorsFor(s),
      board,
      top: $('.top'),
      sound: { place: sound.place, mistake: sound.mistake },
      tapCell: bindCellTap,
      setProgress: t => { if (my === token) $('.progress').textContent = t; },
      say: t => { if (my === token) msg.textContent = t; },
      changed: () => { if (my === token) refresh(); },
      cleared: () => { if (my === token) onCleared(my); },
    };
    const made = await entry.game.start(ctx);
    if (my !== token) { if (made && made.destroy) made.destroy(); return; }
    inst = made;
    refresh();
  }

  async function onCleared(my) {
    busy = true;
    store.markCleared(entry.id, stage);
    refresh();
    sound.clear();
    await inst.glow();
    if (my !== token) return;
    band.classList.add('show');
  }

  btn('home').onclick = () => go('#/');
  btn('list').onclick = () => go('#/list/' + entry.id);
  btn('prev').onclick = () => load(stage - 1);
  btn('next').onclick = () => load(stage + 1);
  btn('band-next').onclick = () => load(stage + 1);
  btn('undo').onclick = () => { if (busy || !inst) return; confirmBox.hidden = true; inst.undo(); refresh(); };
  btn('reset').onclick = () => { if (busy || !inst) return; confirmBox.hidden = true; inst.reset(); refresh(); };
  btn('hint').onclick = () => {
    if (busy || !inst) return;
    if (hints.exhausted) { confirmBox.hidden = false; return; }
    hints.use();
    inst.hint();
    refresh();
  };
  // 飛ばすとクリア扱い。光り方も帯も出さず、すぐ次のステージへ
  btn('skip-yes').onclick = () => { store.markSkipped(entry.id, stage); load(stage + 1); };
  btn('skip-no').onclick = () => { confirmBox.hidden = true; };

  load(store.progress(entry.id).current);
  return () => { token++; if (inst && inst.destroy) inst.destroy(); };
}
