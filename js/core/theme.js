// 画面の明るさ。'auto' はスマホに合わせる、'light' は明るい、'dark' は暗い

const mq = window.matchMedia('(prefers-color-scheme: dark)');
let mode = 'auto';

function isDark() {
  return mode === 'dark' || (mode === 'auto' && mq.matches);
}

// 上のバー(時計などの所)の色も下地にそろえる
function updateBarColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark() ? '#1a1d1c' : '#f4f5f4';
}

export function applyTheme(m) {
  mode = m;
  const root = document.documentElement;
  if (m === 'auto') delete root.dataset.theme;
  else root.dataset.theme = m;
  updateBarColor();
}

mq.addEventListener('change', updateBarColor);
