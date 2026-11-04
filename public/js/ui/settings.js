// 設定画面：効果音・触感・画面の明るさ。変えるとその場で効き、保存する

import { setSoundEnabled, sound, STEP_VARIANTS, getStepVariant, setStepVariant } from '../core/sound.js';
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
        <!-- 聞き比べ用(一時的)。選んだら消す -->
        <div class="row column">
          <span>よつつじのなぞる音(聞き比べ用)</span>
          <div class="segment even" role="radiogroup" aria-label="なぞる音">
            ${STEP_VARIANTS.map((_, i) => `<button role="radio" data-silent data-step="${i + 1}">なぞる音${i + 1}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  function refresh() {
    const s = store.settings;
    root.querySelectorAll('.toggle').forEach(b => b.setAttribute('aria-checked', String(s[b.dataset.key])));
    root.querySelectorAll('[data-theme-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeMode === s.theme)));
    root.querySelectorAll('[data-step]').forEach(b => b.setAttribute('aria-checked', String(+b.dataset.step === getStepVariant())));
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
  root.querySelectorAll('[data-theme-mode]').forEach(b => {
    b.onclick = () => { store.setSetting('theme', b.dataset.themeMode); applyTheme(b.dataset.themeMode); refresh(); };
  });
  // 押すと、その案に切り替えて、なぞるときのように3回続けて鳴らす
  root.querySelectorAll('[data-step]').forEach(b => {
    b.onclick = () => {
      setStepVariant(+b.dataset.step);
      refresh();
      [0, 110, 220].forEach(ms => setTimeout(() => sound.step(), ms));
    };
  });
  refresh();
}
