// 4つのパズルの登録表。最初の画面の並び順もこの順(計画書の表の順)
// まだできていないものは、確かめ用の仮パズルを使う。本物ができたものから game を差し替える
//
// game が持つもの(パズルを差し込む約束事)：
//   rules           ルール説明の文(配列)
//   describe(stage) 盤面の中身の文字(例「6×6・縦2本・横2本」)
//   start(ctx)      盤面を作る。Promiseを返してもよい。戻り値は次の操作を持つ
//     canUndo()  1手戻せるか
//     undo()     1手戻す
//     reset()    最初から
//     hint()     間違った手を戻し、次にする場所を1つ光らせる(回数は枠が数える)
//     glow()     クリアの光り方。終わったら解決するPromiseを返す
//     destroy()  (なくてもよい)ほかのステージへ移るときの後片付け
//   ctx(枠から渡す道具)：
//     stage, tier, rng, colors(その回の8色), board(盤面の場所), top(盤面の上の場所),
//     sound.place() / sound.mistake(), setProgress(文字), say(一言),
//     changed()(手が進んだら呼ぶ), cleared()(クリアしたら呼ぶ)
//     tapCell(マス, { onTap(e), buzz(e), moveLimit }) マスのタップの判定と触感(js/core/haptics.js)
//       震えるのはマスをタップした瞬間だけ。buzz() が false の手(間違い)と、はらう・なぞる・ドラッグでは震えない
//       タップを受けるマスは click ではなく、これでタップを受け取る

import * as trial from './trial/trial.js';
import * as majikiri from './majikiri/majikiri.js';

export const PUZZLES = [
  { id: 'nobishiro', name: 'のびしろ', tagline: '色を伸ばす。', game: trial },
  { id: 'majikiri', name: 'まじきり', tagline: '部屋を区切る。', game: majikiri },
  { id: 'yotsutsuji', name: 'よつつじ', tagline: '線をつなぐ。', game: trial },
  { id: 'utsushie', name: 'うつしえ', tagline: '形を映す。', game: trial },
];

export function findPuzzle(id) {
  return PUZZLES.find(p => p.id === id);
}
