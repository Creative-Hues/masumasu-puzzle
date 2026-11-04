// オフライン用の一覧(sw.js の FILES)に、公開するファイルが全部入っているかの確かめ
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p).split(sep).join('/')];
  });
}

test('公開するファイルが全部、オフライン用の一覧に入っている', () => {
  const src = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const listed = JSON.parse(src.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const needed = ['manifest.webmanifest', ...['css', 'js', 'icons'].flatMap(d => walk(join(ROOT, d)))];
  assert.ok(listed.includes('./'));
  for (const f of needed) assert.ok(listed.includes(f), `${f} が sw.js の FILES にない`);
  for (const f of listed) if (f !== './') assert.ok(needed.includes(f), `${f} は sw.js の FILES にあるが、ファイルがない`);
});
