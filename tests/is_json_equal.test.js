// is_json_equal の単体テスト
// 関数は参照同一性で比較する（異なるクロージャ → false → ハンドラが正しく更新される）

'use strict';

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const { strict: assert } = require('node:assert');

const { __test_exports } = require('../src/ricdom');
const { is_json_equal } = __test_exports;

// =====================================================================
// 関数は参照同一性で比較する
// =====================================================================

test('異なる関数参照は false（クロージャが変わったら再バインドが必要）', () => {
  const fn_a = () => {};
  const fn_b = () => {};
  assert.equal(is_json_equal(fn_a, fn_b), false);
});

test('同じ関数参照は true', () => {
  const fn = () => {};
  assert.equal(is_json_equal(fn, fn), true);
});

// =====================================================================
// プリミティブ値
// =====================================================================

test('同じ文字列は true', () => {
  assert.equal(is_json_equal('hello', 'hello'), true);
});

test('異なる文字列は false', () => {
  assert.equal(is_json_equal('hello', 'world'), false);
});

test('同じ数値は true', () => {
  assert.equal(is_json_equal(42, 42), true);
});

test('異なる数値は false', () => {
  assert.equal(is_json_equal(1, 2), false);
});

test('true === true は true', () => {
  assert.equal(is_json_equal(true, true), true);
});

test('true !== false は false', () => {
  assert.equal(is_json_equal(true, false), false);
});

test('null === null は true', () => {
  assert.equal(is_json_equal(null, null), true);
});

test('null !== undefined は false', () => {
  assert.equal(is_json_equal(null, undefined), false);
});

// =====================================================================
// オブジェクト
// =====================================================================

test('同じ構造のオブジェクトは true', () => {
  assert.equal(is_json_equal({ a: 1, b: 'x' }, { a: 1, b: 'x' }), true);
});

test('値が違うオブジェクトは false', () => {
  assert.equal(is_json_equal({ a: 1 }, { a: 2 }), false);
});

test('キーが違うオブジェクトは false', () => {
  assert.equal(is_json_equal({ a: 1 }, { b: 1 }), false);
});

test('キー数が違うオブジェクトは false', () => {
  assert.equal(is_json_equal({ a: 1 }, { a: 1, b: 2 }), false);
});

test('空オブジェクト同士は true', () => {
  assert.equal(is_json_equal({}, {}), true);
});

test('ネストしたオブジェクトの等値判定', () => {
  assert.equal(
    is_json_equal({ style: { color: 'red', paddingTop: '3px' } },
                  { style: { color: 'red', paddingTop: '3px' } }),
    true,
  );
});

test('ネストしたオブジェクトの差分判定', () => {
  assert.equal(
    is_json_equal({ style: { color: 'red' } },
                  { style: { color: 'blue' } }),
    false,
  );
});

// =====================================================================
// 配列
// =====================================================================

test('同じ配列は true', () => {
  assert.equal(is_json_equal([1, 2, 3], [1, 2, 3]), true);
});

test('要素が違う配列は false', () => {
  assert.equal(is_json_equal([1, 2], [1, 3]), false);
});

test('長さが違う配列は false', () => {
  assert.equal(is_json_equal([1, 2], [1, 2, 3]), false);
});

test('空配列同士は true', () => {
  assert.equal(is_json_equal([], []), true);
});

// =====================================================================
// 型の混在
// =====================================================================

test('オブジェクトと配列は false', () => {
  assert.equal(is_json_equal({}, []), false);
});

test('文字列と数値は false', () => {
  assert.equal(is_json_equal('1', 1), false);
});

// typeof null === 'object' のため a がオブジェクト・b が null のケースは明示ガードが必要
// （Object.keys(null) が TypeError: Cannot convert undefined or null to object を投げる）
test('a がオブジェクト・b が null → false（クラッシュしない）', () => {
  assert.equal(is_json_equal({ a: 1 }, null), false);
});

test('a が null・b がオブジェクト → false（クラッシュしない）', () => {
  assert.equal(is_json_equal(null, { a: 1 }), false);
});

// =====================================================================
// reconciliation での典型的なシナリオ
// =====================================================================

test('onclick が異なる関数なら不等（再バインドが必要なため）', () => {
  const node_a = { tag: 'button', onclick: () => { } };
  const node_b = { tag: 'button', onclick: () => { } };
  assert.equal(is_json_equal(node_a, node_b), false);
});

test('テキストが変わったノードは不等（再描画対象になる）', () => {
  const node_a = { tag: 'div', ctx: ['カウント: 0'] };
  const node_b = { tag: 'div', ctx: ['カウント: 1'] };
  assert.equal(is_json_equal(node_a, node_b), false);
});
