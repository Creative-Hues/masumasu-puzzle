// 一覧：1から次に遊べるステージまで、番号をマス目に並べる
// クリアしたものは色を変え、飛ばしたものはそれより薄く、今のステージには枠をつける

export function stageListScreen(root, { store, go }, entry) {
  const p = store.progress(entry.id);
  const last = p.maxCleared + 1;
  const skipped = new Set(p.skipped);
  let cells = '';
  for (let s = 1; s <= last; s++) {
    const cls = [s > p.maxCleared ? '' : skipped.has(s) ? 'skipped' : 'cleared', s === p.current ? 'current' : ''].join(' ').trim();
    cells += `<button class="${cls}" data-s="${s}">${s}</button>`;
  }
  root.innerHTML = `
    <div class="app">
      <header class="bar">
        <button class="text" data-act="back">もどる</button>
        <h1>ステージ一覧</h1>
        <span class="bar-space"></span>
      </header>
      <div class="stage-grid">${cells}</div>
    </div>`;
  root.querySelector('[data-act="back"]').onclick = () => go('#/play/' + entry.id);
  root.querySelectorAll('.stage-grid button').forEach(b => {
    b.onclick = () => { store.setCurrent(entry.id, +b.dataset.s); go('#/play/' + entry.id); };
  });
  const cur = root.querySelector('.stage-grid .current');
  if (cur) cur.scrollIntoView({ block: 'center' });
}
