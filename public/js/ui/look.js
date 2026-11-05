// 盤面のデザインの決まり(css/base.css)を、絵(canvas・SVG)で描くパズルから読むための道具
// 4つのパズルは、マスのすき間・角の丸み・斜線・ヒントの点線・うすい色を、ここから同じ値で使う

const read = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// いまの決まり(明るい・暗いで変わる色も、そのときの色を読む)
export function look() {
  return {
    gap: parseFloat(read('--cell-gap')),          // すき間：マスに対する割合
    radius: parseFloat(read('--cell-radius')),    // 角の丸み：マスに対する割合
    line: parseFloat(read('--line-ratio')),       // まじきりの線の太さ：マスに対する割合
    stripeW: parseFloat(read('--stripe-width')),  // 斜線の太さ(px)
    stripeP: parseFloat(read('--stripe-period')), // 斜線の間隔(px)
    dash: [parseFloat(read('--hint-dash')), parseFloat(read('--hint-space'))], // ヒントの点線
    hintW: parseFloat(read('--hint-width')),      // ヒントの点線の太さ(px)
    pale: parseFloat(read('--pale')),             // うすい色の近づけ方
    glowMs: parseFloat(read('--glow-time')) * 1000, // クリアの光り1回の長さ(ミリ秒)
    color: read,                                  // 色の名前 → いまの色
  };
}

const hexRgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
// 色 a を色 b へ t だけ近づけた色(うすい色に使う。重なっても濃くならない、ふつうの色になる)
export function blend(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// うすい色：地の色(--bg)へ決まりの割合だけ近づける
export function pale(color) {
  const L = look();
  return blend(color, L.color('--bg'), L.pale);
}

// 部品(マス・ピース)のまわりに、ヒントの点線の四角を重ねる絵(SVG)を作る
//   w・h：部品の大きさ(px)、r：角の丸み(px)
export function hintBox(w, h, r) {
  const L = look();
  const ns = 'http://www.w3.org/2000/svg', half = L.hintW / 2;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'hint-box');
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const rect = document.createElementNS(ns, 'rect');
  rect.setAttribute('x', half); rect.setAttribute('y', half);
  rect.setAttribute('width', Math.max(0, w - L.hintW)); rect.setAttribute('height', Math.max(0, h - L.hintW));
  rect.setAttribute('rx', Math.max(0, r - half));
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', L.color('--accent'));
  rect.setAttribute('stroke-width', L.hintW);
  rect.setAttribute('stroke-dasharray', L.dash.join(' '));
  svg.appendChild(rect);
  return svg;
}

// 1マスの大きさ：盤面の幅 w に n マス並べ、すき間をはさむとき
export const cellSize = (w, n, gap) => w / (n + gap * (n - 1));
