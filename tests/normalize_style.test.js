// normalize_style の単体テスト
// node:test + node:assert を使う（外部依存なし）

'use strict';

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const { strict: assert } = require('node:assert');

const { __test_exports } = require('../src/ricdom');
const { normalize_style } = __test_exports;

// =====================================================================
// キャメルケースオブジェクト（形式1）
// =====================================================================

test('キャメルケースオブジェクトはそのまま返す', () => {
  const result = normalize_style({ paddingTop: '3px', backgroundColor: 'red' });
  assert.deepEqual(result, { paddingTop: '3px', backgroundColor: 'red' });
});

test('空オブジェクトは空オブジェクトを返す', () => {
  assert.deepEqual(normalize_style({}), {});
});

// =====================================================================
// ハイフンケースオブジェクト（形式2）
// =====================================================================

test('ハイフンケースをキャメルケースに変換する', () => {
  const result = normalize_style({ 'padding-top': '3px', 'background-color': 'red' });
  assert.deepEqual(result, { paddingTop: '3px', backgroundColor: 'red' });
});

test('ハイフンなしのキーはそのまま返す', () => {
  const result = normalize_style({ color: 'blue', margin: '0' });
  assert.deepEqual(result, { color: 'blue', margin: '0' });
});

// =====================================================================
// 文字列（形式3）
// =====================================================================

test('文字列形式はそのまま返す（cssText用）', () => {
  const css = 'padding-top: 3px; color: red';
  assert.equal(normalize_style(css), css);
});

test('テンプレートリテラルの文字列もそのまま返す', () => {
  const px = 10;
  const css = `padding: ${px}px; color: blue`;
  assert.equal(normalize_style(css), css);
});

// =====================================================================
// 配列マージ（形式4）
// =====================================================================

test('配列は後勝ちでマージされる', () => {
  const result = normalize_style([
    { padding: '10px', color: '#333' },
    { color: '#fff', background: 'blue' },
  ]);
  assert.deepEqual(result, { padding: '10px', color: '#fff', background: 'blue' });
});

test('配列の null 要素はスキップされる', () => {
  const result = normalize_style([
    { padding: '10px' },
    null,
    { color: 'red' },
  ]);
  assert.deepEqual(result, { padding: '10px', color: 'red' });
});

test('配列の undefined 要素はスキップされる', () => {
  const result = normalize_style([
    { padding: '10px' },
    undefined,
    { color: 'red' },
  ]);
  assert.deepEqual(result, { padding: '10px', color: 'red' });
});

test('配列の空オブジェクトは上書きしない（後勝ちだが空なのでそのまま）', () => {
  const result = normalize_style([
    { padding: '10px', color: '#333' },
    {},
  ]);
  assert.deepEqual(result, { padding: '10px', color: '#333' });
});

test('配列内でハイフンケースもキャメルケースに変換される', () => {
  const result = normalize_style([
    { 'padding-top': '3px' },
    { 'background-color': 'red' },
  ]);
  assert.deepEqual(result, { paddingTop: '3px', backgroundColor: 'red' });
});

test('配列内の文字列はマージ対象外（スキップ）', () => {
  // 文字列がある場合は無視し、前のマージ結果を返す
  const result = normalize_style([
    { padding: '10px' },
    'color: red',
    { color: 'blue' },
  ]);
  assert.deepEqual(result, { padding: '10px', color: 'blue' });
});

test('要素がすべて null の配列は空オブジェクトを返す', () => {
  assert.deepEqual(normalize_style([null, null, undefined]), {});
});

// =====================================================================
// falsy 値のガード（normalize_style の冒頭 !style チェック）
// =====================================================================

test('null は空オブジェクトを返す', () => {
  assert.deepEqual(normalize_style(null), {});
});

test('undefined は空オブジェクトを返す', () => {
  assert.deepEqual(normalize_style(undefined), {});
});

test('false は空オブジェクトを返す', () => {
  assert.deepEqual(normalize_style(false), {});
});
