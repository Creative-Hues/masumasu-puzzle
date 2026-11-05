// 最初の画面：4つのパズルを、アイコンのような2×2の白いマスに並べる(左上から、のびしろ・まじきり・よつつじ・うつしえ)
// 各マスに、解いている途中の盤面の小さな絵・名前・ひとこと説明。マスの上に、アイコンの4色の大きな「ますます」

import { PUZZLES } from '../puzzles/registry.js';
import { thumbnail } from './thumbs.js';

// タイトルの4文字を、アプリアイコンの4色で1文字ずつ塗る(アイコンの左上・右上・左下・右下の順)
const TITLE = [['ま', '#b5838d'], ['す', '#e5989b'], ['ま', '#8e9aaf'], ['す', '#a3b18a']];

export function homeScreen(root, { go }) {
  root.innerHTML = `
    <div class="app home">
      <header class="bar">
        <span class="bar-space"></span>
        <span class="bar-space"></span>
        <button class="text" data-act="settings">設定</button>
      </header>
      <div class="home-main">
      <h1 class="home-title" aria-label="ますます">${TITLE.map(([ch, color]) => `<span style="color:${color}">${ch}</span>`).join('')}</h1>
      <ul class="cards">
        ${PUZZLES.map(p => `
          <li><button class="card" data-id="${p.id}">
            ${thumbnail(p.id)}
            <span class="card-text"><b>${p.name}</b><span>${p.tagline}</span></span>
          </button></li>`).join('')}
      </ul>
      </div>
    </div>`;
  root.querySelector('[data-act="settings"]').onclick = () => go('#/settings');
  root.querySelectorAll('.card').forEach(b => { b.onclick = () => go('#/play/' + b.dataset.id); });
}
