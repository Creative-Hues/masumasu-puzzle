// 設定画面：効果音・音量・触感・画面の明るさ・バックアップ。変えるとその場で効き、保存する

import { setSoundEnabled, setVolume, sound } from '../core/sound.js';
import { setHapticsEnabled } from '../core/haptics.js';
import { applyTheme } from '../core/theme.js';
import { parseBackup } from '../core/storage.js';

const THEME_LABELS = [['auto', 'スマホに合わせる'], ['light', '明るい'], ['dark', '暗い']];

// 書き出すファイルの名前(日付つき)
function backupName(d = new Date()) {
  const p = x => String(x).padStart(2, '0');
  return `ますます-バックアップ-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

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
        <div class="row column">
          <span>バックアップ</span>
          <div class="pair">
            <button data-act="export">書き出す</button>
            <button data-act="import">読み込む</button>
          </div>
          <input type="file" accept=".json,application/json" data-act="file" hidden>
          <p class="backup-msg" aria-live="polite"></p>
        </div>
      </div>
    </div>
    <div class="modal" data-act="import-confirm" hidden>
      <div class="modal-box" role="dialog" aria-modal="true" aria-label="読み込みの確認">
        <p>今の進み具合を、読み込んだもので置き換えますか。</p>
        <div class="pair">
          <button class="primary" data-act="import-yes">置き換える</button>
          <button data-act="import-no">やめる</button>
        </div>
      </div>
    </div>`;

  const slider = root.querySelector('[data-act="volume"]');

  function refresh() {
    const s = store.settings;
    root.querySelectorAll('.toggle').forEach(b => b.setAttribute('aria-checked', String(s[b.dataset.key])));
    root.querySelectorAll('[data-theme-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.themeMode === s.theme)));
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

  // ---------- バックアップ ----------
  const $ = sel => root.querySelector(sel);
  const msg = $('.backup-msg'), confirmBox = $('[data-act="import-confirm"]'), fileInput = $('[data-act="file"]');
  let pending = null; // 読み込んで、置き換えるのを待っている中身

  // 書き出す：iPhoneは共有の画面(AirDrop・「ファイル」など)、共有の画面がない所はダウンロード
  $('[data-act="export"]').onclick = async () => {
    msg.textContent = '';
    const name = backupName();
    const file = new File([store.exportBackup()], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'ますますのバックアップ' }); } catch (e) { /* やめたとき */ }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // 読み込む：ファイルを選び、中身を確かめてから、置き換えるか一度聞く
  $('[data-act="import"]').onclick = () => { msg.textContent = ''; fileInput.click(); };
  fileInput.onchange = async () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = ''; // 同じファイルをもう一度選べるように
    msg.textContent = '';
    if (!f) return;
    let text = '';
    try { text = await f.text(); } catch (e) { text = ''; }
    pending = parseBackup(text);
    if (!pending) { msg.textContent = '読み込めませんでした。'; return; }
    confirmBox.hidden = false;
  };
  $('[data-act="import-no"]').onclick = () => { pending = null; confirmBox.hidden = true; };
  $('[data-act="import-yes"]').onclick = () => {
    if (!pending) return;
    store.replaceWith(pending);
    pending = null;
    // 読み込んだ設定を、その場で効かせる
    const s = store.settings;
    setSoundEnabled(s.sound); setVolume(s.volume); setHapticsEnabled(s.haptics); applyTheme(s.theme);
    confirmBox.hidden = true;
    go('#/');
  };
  refresh();
}
