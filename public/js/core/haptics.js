// 触感。震えるのは、盤面のマスをタップした瞬間だけ(はらう・なぞる・ドラッグ・間違いでは震えない)
// iPhone：マスの上に透明なスイッチ部品を重ね、指で本当にそのスイッチを押してもらう
//   (iOS 26.5から、プログラムから押したことにする方法では震えなくなった。将来また使えなくなる可能性がある)
// Android：navigator.vibrate

let enabled = true;

export function setHapticsEnabled(v) { enabled = v; }

// 指が触れてから離すまでに動いた距離がこれ以下なら「タップ」
export const TAP_MOVE_LIMIT = 10;

export function isTap(dx, dy, limit = TAP_MOVE_LIMIT) {
  return Math.hypot(dx, dy) <= limit;
}

function canVibrate() {
  return typeof navigator.vibrate === 'function';
}

function useSwitch() {
  return !canVibrate() && typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
}

// マスにタップの判定と触感をつける。各パズルは、遊ぶ画面の枠から ctx.tapCell として使う
//   onTap(e)  タップしたときに呼ぶ
//   buzz(e)   このタップが正しく置ける・引ける手なら true(間違いの手は false で、震えない)。e で指の位置がわかる
//   moveLimit タップと見なす動きの上限(px)。数か、その場で計算する関数
// タップの判定は click ではなく指の動き(pointer)で行う。透明なスイッチがあるとclickが当てにならないため
// 指の動きの知らせは、そのまま盤面まで伝わるので、はらう・なぞる・ドラッグの仕組みはじゃまされない
export function bindCellTap(el, { onTap, buzz = () => true, moveLimit = TAP_MOVE_LIMIT }) {
  let start = null;
  let moved = false;
  let allowSwitch = false; // 次のスイッチの切り替えを許すか(許すと震える)

  let sw = null;
  if (useSwitch()) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.setAttribute('switch', '');
    sw.className = 'tap-switch';
    sw.tabIndex = -1;
    sw.setAttribute('aria-hidden', 'true');
    // 震わせないときは、切り替わる直前で止める
    sw.addEventListener('click', e => {
      if (!allowSwitch) e.preventDefault();
      allowSwitch = false;
    });
    el.appendChild(sw);
  }

  // 盤面が指をつかまえて(pointer capture)いても届くよう、動きと離したことは window で受ける
  const limit = () => (typeof moveLimit === 'function' ? moveLimit() : moveLimit);
  function onMove(e) {
    if (start && e.pointerId === start.id && !isTap(e.clientX - start.x, e.clientY - start.y, limit())) moved = true;
  }
  function onUp(e) {
    if (!start || e.pointerId !== start.id) return;
    // 指を離すまでに盤面が受け付けなくなった(確認などが出た)ときは、タップにしない
    if (el.closest('[inert]')) { stop(); return; }
    const tap = !moved && isTap(e.clientX - start.x, e.clientY - start.y, limit());
    stop();
    if (!tap) return;
    // 置く前の状態で、震わせるかを決める
    const ok = enabled && !!buzz(e);
    allowSwitch = ok;
    if (ok && !sw && canVibrate()) navigator.vibrate(12);
    onTap(e);
  }
  function stop() {
    start = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', stop);
  }
  function onDown(e) {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || el.closest('[inert]')) return;
    stop();
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved = false;
    allowSwitch = false;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', stop);
  }

  el.addEventListener('pointerdown', onDown);
  return () => {
    stop();
    el.removeEventListener('pointerdown', onDown);
    if (sw) sw.remove();
  };
}
