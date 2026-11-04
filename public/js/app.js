// 起動と画面の切り替え。今いる画面は URL の # のあとで覚える
//   #/            最初の画面
//   #/settings    設定
//   #/play/<id>   遊ぶ画面
//   #/list/<id>   ステージ一覧

import { createStore, browserBackend } from './core/storage.js';
import { sound, setSoundEnabled, unlockAudio } from './core/sound.js';
import { setHapticsEnabled } from './core/haptics.js';
import { applyTheme } from './core/theme.js';
import { findPuzzle } from './puzzles/registry.js';
import { homeScreen } from './ui/home.js';
import { playScreen } from './ui/play.js';
import { stageListScreen } from './ui/stage-list.js';
import { settingsScreen } from './ui/settings.js';

const store = createStore(browserBackend());
const root = document.getElementById('app');
let cleanup = null;

const settings = store.settings;
setSoundEnabled(settings.sound);
setHapticsEnabled(settings.haptics);
applyTheme(settings.theme);

function go(hash) {
  if (location.hash === hash) show();
  else location.hash = hash;
}

function show() {
  if (cleanup) cleanup();
  cleanup = null;
  const [, kind, id] = (location.hash || '#/').split('/');
  const app = { store, go };
  const entry = findPuzzle(id);
  if (kind === 'settings') cleanup = settingsScreen(root, app);
  else if (kind === 'play' && entry) cleanup = playScreen(root, app, entry);
  else if (kind === 'list' && entry) cleanup = stageListScreen(root, app, entry);
  else cleanup = homeScreen(root, app);
  if (kind !== 'list') window.scrollTo(0, 0);
}

window.addEventListener('hashchange', show);
show();

// iPhoneは触れたときにしか音の準備ができないので、触れるたびに準備する(準備ずみなら何もしない)
['touchend', 'click'].forEach(t => document.addEventListener(t, unlockAudio, { capture: true, passive: true }));

// ボタンを押したときの音
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && !b.disabled) sound.button();
});

// 保存したものを端末が勝手に消さないようにお願いする
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// オフラインで開けるようにする
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
