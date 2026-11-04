// 触感。Androidは navigator.vibrate、iPhoneは見えないスイッチ部品を押して触感を借りる(iOS 18以降)
// 参考：https://azukiazusa.dev/blog/ios-safari-web-haptics 将来使えなくなる可能性がある

let enabled = true;
let label = null;

export function setHapticsEnabled(v) { enabled = v; }

function ensureSwitch() {
  if (label) return;
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.innerHTML = '<input type="checkbox" switch tabindex="-1">';
  Object.assign(label.style, { position: 'fixed', left: '-9999px', top: '0', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(label);
}

export function haptic() {
  if (!enabled) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(12); return; }
    ensureSwitch();
    label.click();
  } catch (e) {}
}
