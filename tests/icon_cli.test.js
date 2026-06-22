// ricdom-icon CLI (scripts/icon.js) のテスト
//
// ネット必須の Lucide fetch は CI 非依存にするためテストしない。
// 同梱解決・出力整形・引数なしのオフライン経路のみを検証する。

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  build_block, build_json, resolve_all, load_bundled, LUCIDE_NOTICE,
} = require('../scripts/icon');

describe('ricdom-icon: load_bundled', () => {
  it('同梱 icons.json を読めて 35 個ある', () => {
    const b = load_bundled();
    assert.equal(typeof b, 'object');
    assert.ok(b.x && b.x.p, 'x が descriptor を持つ');
    assert.ok(Object.keys(b).length >= 35);
  });
});

describe('ricdom-icon: build_block', () => {
  it('貼れる const ICONS ブロックを出す (inline コメント無し)', () => {
    const out = build_block([['x', { p: 'M..' }], ['check', { p: 'M..' }]], []);
    assert.match(out, /^const ICONS = \{/);
    assert.match(out, /\};$/);
    // ICONS 本体に inline コメントが無い (reformat 安全)
    const body = out.slice(out.indexOf('{'), out.lastIndexOf('}'));
    assert.ok(!body.includes('//'), '本体に // が無い');
  });

  it('Lucide 由来があれば冒頭に ISC 帰属ブロック + 由来一覧', () => {
    const out = build_block([['settings', { p: ['a', 'b'] }]], ['settings']);
    assert.ok(out.includes(LUCIDE_NOTICE), 'ISC notice がある');
    assert.match(out, /\/\/ Lucide 由来: settings/);
  });

  it('Lucide が無ければ帰属ブロックを出さない', () => {
    const out = build_block([['x', { p: 'M..' }]], []);
    assert.ok(!out.includes('Lucide'), 'Lucide 行が無い');
  });

  it('ハイフン入りの名前はキーをクォートする', () => {
    const out = build_block([['refresh-cw', { p: 'M..' }]], []);
    assert.match(out, /"refresh-cw":/);
  });

  it('生成物が JS としてパースできる (ESM 安全)', () => {
    const out = build_block([['x', { p: 'M..' }], ['refresh-cw', { p: ['a'] }]], ['refresh-cw']);
    const body = out.slice(out.indexOf('const ICONS'));
    assert.doesNotThrow(() => new Function(body + '; return ICONS;'));
  });
});

describe('ricdom-icon: build_json', () => {
  it('const ラッパー無しの素の descriptor を出す', () => {
    const out = build_json([['x', { p: 'M..' }]]);
    const obj = JSON.parse(out);
    assert.deepEqual(obj, { x: { p: 'M..' } });
  });
});

describe('ricdom-icon: resolve_all (同梱・オフライン)', () => {
  it('同梱名は fetch せずに解決し、lucide/errors は空', async () => {
    const b = load_bundled();
    const { entries, lucide, errors } = await resolve_all(['x', 'check'], b);
    assert.equal(entries.length, 2);
    assert.equal(lucide.length, 0);
    assert.equal(errors.length, 0);
    assert.equal(entries[0][0], 'x');
    assert.ok(entries[0][1].p, 'descriptor を持つ');
  });
});
