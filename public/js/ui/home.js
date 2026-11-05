// 最初の画面：4つのパズルの名前とひとこと説明と、解いている途中の盤面の小さな絵

import { PUZZLES } from '../puzzles/registry.js';
import { thumbnail } from './thumbs.js';

export function homeScreen(root, { go }) {
  root.innerHTML = `
    <div class="app">
      <header class="bar">
        <h1 class="logo">ますます</h1>
        <button class="text" data-act="settings">設定</button>
      </header>
      <ul class="cards">
        ${PUZZLES.map(p => `
          <li><button class="card" data-id="${p.id}">
            <span class="card-text"><b>${p.name}</b><span>${p.tagline}</span></span>
            ${thumbnail(p.id)}
          </button></li>`).join('')}
      </ul>
    </div>`;
  root.querySelector('[data-act="settings"]').onclick = () => go('#/settings');
  root.querySelectorAll('.card').forEach(b => { b.onclick = () => go('#/play/' + b.dataset.id); });
}
