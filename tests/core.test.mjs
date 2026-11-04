// 共通の計算の確かめ。node --test で動かす
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageRng } from '../js/core/rng.js';
import { tierOf } from '../js/core/stages.js';
import { THEMES, themeFor } from '../js/core/palettes.js';
import { createHintCounter } from '../js/core/hints.js';
import { createStore, STORE_KEY } from '../js/core/storage.js';

const take = (rng, n) => Array.from({ length: n }, rng);

test('同じパズル・同じ番号からは同じ乱数が出る', () => {
  assert.deepEqual(take(stageRng('majikiri', 12), 10), take(stageRng('majikiri', 12), 10));
  assert.notDeepEqual(take(stageRng('majikiri', 12), 10), take(stageRng('majikiri', 13), 10));
  assert.notDeepEqual(take(stageRng('majikiri', 12), 10), take(stageRng('nobishiro', 12), 10));
});

test('20ステージごとに段階が変わる', () => {
  assert.equal(tierOf(1), 0);
  assert.equal(tierOf(20), 0);
  assert.equal(tierOf(21), 1);
  assert.equal(tierOf(40), 1);
  assert.equal(tierOf(41), 2);
  assert.equal(tierOf(100), 4);
  assert.equal(tierOf(101), 5);
  assert.equal(tierOf(5000), 5);
});

test('配色はステージ1から表の順に回る', () => {
  const names = [1, 2, 3, 4, 5, 6].map(s => themeFor(s).name);
  assert.deepEqual(names, ['秋の山', '古い喫茶店', '古本屋', 'あじさいの小道', '砂浜', '秋の山']);
  THEMES.forEach(t => assert.equal(t.colors.length, 8));
});

test('ヒントは3回で終わる', () => {
  const h = createHintCounter();
  assert.equal(h.left, 3);
  assert.equal(h.use(), true);
  assert.equal(h.use(), true);
  assert.equal(h.exhausted, false);
  assert.equal(h.use(), true);
  assert.equal(h.exhausted, true);
  assert.equal(h.use(), false);
  assert.equal(h.left, 0);
});

function memory(initial) {
  const m = new Map(initial === undefined ? [] : [[STORE_KEY, initial]]);
  return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v), raw: () => m.get(STORE_KEY) };
}

test('保存：空の状態から始められる', () => {
  const s = createStore(memory());
  assert.deepEqual(s.settings, { sound: true, haptics: true, theme: 'auto' });
  assert.deepEqual(s.progress('nobishiro'), { maxCleared: 0, current: 1, skipped: [] });
});

test('保存：壊れたデータでも止まらない', () => {
  for (const bad of ['{こわれた', '42', '"x"', 'null', '{"settings":{"sound":"はい","theme":"青"},"puzzles":{"a":{"maxCleared":-3}}}']) {
    const s = createStore(memory(bad));
    assert.deepEqual(s.settings, { sound: true, haptics: true, theme: 'auto' });
    assert.deepEqual(s.progress('a'), { maxCleared: 0, current: 1, skipped: [] });
  }
});

test('保存：古い版(版の番号や項目がない)のデータも読める', () => {
  const s = createStore(memory(JSON.stringify({ settings: { sound: false }, puzzles: { majikiri: { maxCleared: 5, current: 3 } } })));
  assert.equal(s.settings.sound, false);
  assert.equal(s.settings.theme, 'auto');
  assert.deepEqual(s.progress('majikiri'), { maxCleared: 5, current: 3, skipped: [] });
});

test('保存：クリアと飛ばすを覚え、読み直しても残る', () => {
  const mem = memory();
  const s = createStore(mem);
  s.markCleared('yotsutsuji', 1);
  s.markSkipped('yotsutsuji', 2);
  s.setCurrent('yotsutsuji', 3);
  s.setSetting('theme', 'dark');
  const again = createStore(memory(mem.raw()));
  assert.deepEqual(again.progress('yotsutsuji'), { maxCleared: 2, current: 3, skipped: [2] });
  assert.equal(again.settings.theme, 'dark');
});

test('保存：飛ばしたステージをあとで解くと、ふつうのクリアになる', () => {
  const s = createStore(memory());
  s.markSkipped('utsushie', 1);
  s.markCleared('utsushie', 1);
  assert.deepEqual(s.progress('utsushie').skipped, []);
});

test('保存：解いたステージを飛ばしても、飛ばした印はつかない', () => {
  const s = createStore(memory());
  s.markCleared('utsushie', 1);
  s.markSkipped('utsushie', 1);
  assert.deepEqual(s.progress('utsushie').skipped, []);
});

test('保存：今のステージは、次に遊べるステージより先にならない', () => {
  const s = createStore(memory());
  s.setCurrent('nobishiro', 9);
  assert.equal(s.progress('nobishiro').current, 1);
});
