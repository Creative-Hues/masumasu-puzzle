// アイコンB(白地に、すき間をあけた2×2のマス)のPNGとSVGを作る。追加の部品は使わない
// 使い方：node tools/make-icons.mjs
// 比率はアイコン案のページと同じ(120pxに対して 余白14・すき間6・角の丸み10)
// iPhoneは自分で角を丸めるので、PNGの外側は角を丸めない正方形にする

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const COLORS = ['#b5838d', '#e5989b', '#8e9aaf', '#a3b18a']; // 左上・右上・左下・右下
const PAD = 14 / 120, GAP = 6 / 120, RADIUS = 10 / 120;
const SIDE = (1 - PAD * 2 - GAP) / 2;

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function squares(size) {
  return COLORS.map((c, k) => ({
    x: (PAD + (k % 2) * (SIDE + GAP)) * size,
    y: (PAD + Math.floor(k / 2) * (SIDE + GAP)) * size,
    w: SIDE * size, r: RADIUS * size, color: rgb(c),
  }));
}

function inRounded(px, py, s) {
  const cx = Math.min(Math.max(px, s.x + s.r), s.x + s.w - s.r);
  const cy = Math.min(Math.max(py, s.y + s.r), s.y + s.w - s.r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= s.r * s.r && px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.w;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const sq = squares(size), SS = 4; // 1画素を4×4に分けて、ふちをなめらかにする
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        const hit = sq.find(s => inRounded(px, py, s));
        const c = hit ? hit.color : [255, 255, 255];
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (size * 3 + 1) + 1 + x * 3, n = SS * SS;
      raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit・RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function svg() {
  const rects = squares(120).map(s => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.w}" rx="${s.r}" fill="#${s.color.map(v => v.toString(16).padStart(2, '0')).join('')}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="27" fill="#fff"/>${rects}</svg>\n`;
}

const out = new URL('../icons/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('apple-touch-icon.png', out), png(180));
writeFileSync(new URL('icon-192.png', out), png(192));
writeFileSync(new URL('icon-512.png', out), png(512));
writeFileSync(new URL('icon.svg', out), svg());
console.log('icons/ にアイコンを作りました');
