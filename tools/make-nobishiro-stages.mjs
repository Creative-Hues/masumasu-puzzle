// のびしろの問題を、あらかじめ作って public/js/puzzles/nobishiro/stages.js に書き出す道具
// 使い方：node tools/make-nobishiro-stages.mjs            (1〜300を全部作る)
//         node tools/make-nobishiro-stages.mjs 101 200    (一部だけ作って tools/out/ に置く。あとで引数なしの merge で1つにまとめる)
//         node tools/make-nobishiro-stages.mjs merge
// 後半の盤面は1問に数秒〜数十秒かかる。乱数はステージ番号から作るので、何度作っても同じ問題になる
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stageRng } from '../public/js/core/rng.js';
import { makePuzzle, MADE_STAGES } from '../public/js/puzzles/nobishiro/logic.js';

const OUT = fileURLToPath(new URL('../public/js/puzzles/nobishiro/stages.js', import.meta.url));
const PART = fileURLToPath(new URL('./out/', import.meta.url));

function make(from, to) {
  const rows = [];
  for (let s = from; s <= to; s++) {
    const t0 = Date.now();
    const pz = makePuzzle(s, stageRng('nobishiro', s));
    rows.push({ s, w: pz.walls, p: pz.sol });
    console.log(`ステージ${s}：${pz.n}×${pz.n}・${pz.limit}個・${Date.now() - t0}ms`);
  }
  return rows;
}

function write(rows) {
  rows.sort((a, b) => a.s - b.s);
  rows.forEach((r, i) => { if (r.s !== i + 1) throw new Error(`ステージ${i + 1}がない`); });
  if (rows.length !== MADE_STAGES) throw new Error(`${MADE_STAGES}ステージそろっていない(${rows.length})`);
  const body = rows.map(r => `{w:[${r.w}],s:[${r.p}]}`).join(',\n');
  writeFileSync(OUT, `// のびしろの問題(ステージ1〜${MADE_STAGES})。tools/make-nobishiro-stages.mjs で作ったもの。手で書き換えない\n// w：障害物のマス、s：答えの置き方(ヒントに使う)\nexport const STAGES = [\n${body},\n];\n`);
  console.log('書き出した：' + OUT);
}

const [a, b] = process.argv.slice(2);
if (a === 'merge') {
  write(readdirSync(PART).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(PART + f, 'utf8'))));
} else if (a) {
  mkdirSync(PART, { recursive: true });
  writeFileSync(`${PART}${a}-${b}.json`, JSON.stringify(make(+a, +b)));
} else {
  write(make(1, MADE_STAGES));
}
