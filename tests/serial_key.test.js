// collect_duplicate_tags / build_serial_key_list の単体テスト
// input フォーカス問題を解決したシリアルキー方式の核心ロジック

'use strict';

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const { strict: assert } = require('node:assert');

const { __test_exports } = require('../src/ricdom');
const { collect_duplicate_tags, build_serial_key_list } = __test_exports;

// =====================================================================
// collect_duplicate_tags
// =====================================================================

test('重複なしの場合は空 Set を返す', () => {
  const prev = [{ tag: 'div', ctx: ['a'] }, { tag: 'span', ctx: ['b'] }];
  const next = [{ tag: 'div', ctx: ['c'] }, { tag: 'span', ctx: ['d'] }];
  const dup = collect_duplicate_tags(prev, next);
  assert.equal(dup.size, 0);
});

test('next に div が2つある場合 div が Set に入る', () => {
  const prev = [{ tag: 'div', ctx: ['a'] }];
  const next = [{ tag: 'div', ctx: ['b'] }, { tag: 'div', ctx: ['c'] }];
  const dup = collect_duplicate_tags(prev, next);
  assert.ok(dup.has('div'));
});

test('prev に div が2つある場合も div が Set に入る（union）', () => {
  const prev = [{ tag: 'div', ctx: ['a'] }, { tag: 'div', ctx: ['b'] }];
  const next = [{ tag: 'div', ctx: ['c'] }];
  const dup = collect_duplicate_tags(prev, next);
  assert.ok(dup.has('div'));
});

test('テキストノードや数値は対象外', () => {
  const prev = ['text', 42];
  const next = ['hello', 99];
  const dup = collect_duplicate_tags(prev, next);
  assert.equal(dup.size, 0);
});

test('div が1個ずつ（重複なし）は Set に入らない', () => {
  // input フォーカス問題の元凶：prev に div が1個、next に div が1個は重複ではない
  const prev = [{ tag: 'div', ctx: ['ラベル'] }, { tag: 'input' }];
  const next = [{ tag: 'div', ctx: ['ラベル'] }, { tag: 'input' }, { tag: 'div', ctx: ['挨拶'] }];
  // next に div が 2 個あるので重複
  const dup = collect_duplicate_tags(prev, next);
  assert.ok(dup.has('div'));
  // input は 1 個なので重複なし
  assert.ok(!dup.has('input'));
});

// =====================================================================
// build_serial_key_list
// =====================================================================

test('重複タグなしの場合はタグ名そのまま', () => {
  const children = [{ tag: 'div' }, { tag: 'span' }, { tag: 'input' }];
  const dup_tags = new Set(); // 重複なし
  const keys = build_serial_key_list(children, dup_tags);
  assert.deepEqual(keys, ['div', 'span', 'input']);
});

test('重複タグにはシリアル番号が付く', () => {
  const children = [{ tag: 'div', ctx: ['a'] }, { tag: 'span' }, { tag: 'div', ctx: ['b'] }];
  const dup_tags = new Set(['div']);
  const keys = build_serial_key_list(children, dup_tags);
  assert.deepEqual(keys, ['div@0', 'span', 'div@1']);
});

test('テキストノードは "text" キーになる', () => {
  const children = ['hello', { tag: 'div' }, 'world'];
  const dup_tags = new Set();
  const keys = build_serial_key_list(children, dup_tags);
  assert.deepEqual(keys, ['text', 'div', 'text']);
});

test('input フォーカス問題のシナリオ：prev/next 両方でシリアルキーが対応する', () => {
  // s.name = '' → '' のとき（名前入力前）
  const prev_children = [{ tag: 'div', ctx: ['ラベル'] }, { tag: 'input' }];
  // s.name = 'x' のとき（挨拶 div が出現）
  const next_children = [{ tag: 'div', ctx: ['ラベル'] }, { tag: 'input' }, { tag: 'div', ctx: ['挨拶'] }];

  const dup_tags = collect_duplicate_tags(prev_children, next_children);
  const prev_keys = build_serial_key_list(prev_children, dup_tags);
  const next_keys = build_serial_key_list(next_children, dup_tags);

  // prev の div は @0、next の最初の div も @0 → 同一ノードとして対応する
  assert.equal(prev_keys[0], 'div@0');
  assert.equal(next_keys[0], 'div@0');

  // input は重複なし → タグ名そのまま
  assert.equal(prev_keys[1], 'input');
  assert.equal(next_keys[1], 'input');

  // next の 2番目の div は @1
  assert.equal(next_keys[2], 'div@1');
});
