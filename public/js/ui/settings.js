// 設定画面：効果音・音量・触感・画面の明るさ。変えるとその場で効き、保存する

import { setSoundEnabled, setVolume, sound, PLACE_VARIANTS, getPlaceVariant, setPlaceVariant } from '../core/sound.js';
import { setHapticsEnabled } from '../core/haptics.js';
import { applyTheme } from '../core/theme.js';

const THEME_LABELS = [['auto', 'スマホに合わせる'], ['light', '明るい'], ['dark', '暗い']];

export function settingsScreen(root, { store, go }) {
  root.innerHTML = `
    <div class="app">
      <header class="bar">
        <button class="text" data-act="back">もどる</button>
        <h1>設定</h1>
        <span class="bar-space"></span>
      </header>
      <div class="settings">
        <div class="row">
          <span>効果音</span>
          <button class="toggle" role="switch" data-key="sound" aria-label="効果音"></button>
        </div>
        <div class="row volume">
          <span>音量</span>
          <input type="range" min="0" max="100" step="1" data-act="volume" aria-label="音量">
        </div>
        <div class="row">
          <span>触感</span>
          <button class="toggle" role="switch" data-key="haptics" aria-label="触感"></button>
        </div>
        <div class="row column">
          <span>画面の明るさ</span>
          <div class="segment" role="radiogroup" aria-label="画面の明るさ">
            ${THEME_LABELS.map(([v, t]) => `<button role="radio" data-theme-mode="${v}">${t}</button>`).join('')}
          </div>
        </div>
        <!-- 置く音の聞き比べ用(一時的)。選んだら消す -->
        <div class="row column">
          <span>置く音の聞き比べ(一時的)</span>
          <div class="segment even" role="radiogroup" aria-label="置く音">
            ${PLACE_VARIANTS.map((_, i) => `<button role="radio" data-silent data-place="${i + 1}">置く${i + 1}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  const slider = root.querySelector('[data-act="volume"]');

  function refresh() {
    const s = store.settings;
    root.querySelectorAll('.toggle').forEach(b => b.setAttribute('aria-checked', String(s[b.dataset.key])));
    root.querySelectorAll('[data-theme-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeMode === s.theme)));
    root.querySelectorAll('[data-place]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.place === getPlaceVariant())));
    slider.value = String(Math.round(s.volume * 100));
    slider.disabled = !s.sound; // 効果音がオフのときは、音量を変えられない
  }

  root.querySelector('[data-act="back"]').onclick = () => go('#/');
  root.querySelectorAll('.toggle').forEach(b => {
    b.onclick = () => {
      const key = b.dataset.key;
      const on = !store.settings[key];
      store.setSetting(key, on);
      if (key === 'sound') setSoundEnabled(on);
      if (key === 'haptics') setHapticsEnabled(on);
      refresh();
    };
  });
  // 動かしているあいだは音量だけ変え、離したら置く音を一度鳴らして大きさを確かめる
  slider.addEventListener('input', () => setVolume(slider.value / 100));
  slider.addEventListener('change', () => {
    store.setSetting('volume', slider.value / 100);
    setVolume(slider.value / 100);
    sound.place();
  });
  root.querySelectorAll('[data-theme-mode]').forEach(b => {
    b.onclick = () => { store.setSetting('theme', b.dataset.themeMode); applyTheme(b.dataset.themeMode); refresh(); };
  });
  // 押すと、その案に切り替えて鳴らす。選んだ案は、遊ぶときにもそのまま使われる
  root.querySelectorAll('[data-place]').forEach(b => {
    b.onclick = () => {
      setPlaceVariant(+b.dataset.place);
      refresh();
      sound.place();
    };
  });
  refresh();
}
