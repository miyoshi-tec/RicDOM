// normalize_ric_node の単体テスト
// class/style/ctx の分離・非表示値の判定を確認する

'use strict';

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const { strict: assert } = require('node:assert');

const { __test_exports } = require('../src/ricdom');
const { normalize_ric_node } = __test_exports;

// =====================================================================
// テキストノード・非表示値
// =====================================================================

test('文字列はテキストノードとして返す', () => {
  const result = normalize_ric_node('hello');
  assert.equal(result.node_type, 'text');
  assert.equal(result.text, 'hello');
});

test('数値はテキストノードとして返す', () => {
  const result = normalize_ric_node(42);
  assert.equal(result.node_type, 'text');
  assert.equal(result.text, '42');
});

test('null は invisible を返す', () => {
  assert.equal(normalize_ric_node(null).node_type, 'invisible');
});

test('false は invisible を返す', () => {
  assert.equal(normalize_ric_node(false).node_type, 'invisible');
});

test('空配列 [] は invisible を返す', () => {
  assert.equal(normalize_ric_node([]).node_type, 'invisible');
});

test('空オブジェクト {} は invisible を返す', () => {
  assert.equal(normalize_ric_node({}).node_type, 'invisible');
});

// =====================================================================
// 基本構文：tag のみ
// =====================================================================

test("{ tag: 'div', ctx: ['text'] } は tag=div として展開される", () => {
  const result = normalize_ric_node({ tag: 'div', ctx: ['text'] });
  assert.equal(result.node_type, 'element');
  assert.equal(result.tag, 'div');
  assert.deepEqual(result.class, []);
  assert.equal(result.id, null);
  assert.deepEqual(result.ctx, ['text']);
});

test("tag 未指定は div にフォールバックする", () => {
  const result = normalize_ric_node({ ctx: ['hello'] });
  assert.equal(result.tag, 'div');
  assert.deepEqual(result.ctx, ['hello']);
});

// =====================================================================
// class プロパティ
// =====================================================================

test("class 文字列が配列に分解される", () => {
  const result = normalize_ric_node({ tag: 'button', class: 'ric-button ric-button--primary', ctx: ['OK'] });
  assert.deepEqual(result.class, ['ric-button', 'ric-button--primary']);
});

test("class 配列がそのまま配列になる", () => {
  const result = normalize_ric_node({ tag: 'button', class: ['a', 'b'], ctx: [] });
  assert.deepEqual(result.class, ['a', 'b']);
});

test("class の空文字列は除外される", () => {
  const result = normalize_ric_node({ tag: 'div', class: 'a  b  ' });
  assert.deepEqual(result.class, ['a', 'b']);
});

// =====================================================================
// id プロパティ
// =====================================================================

test("id プロパティが保持される", () => {
  const result = normalize_ric_node({ tag: 'button', id: 'my-id', ctx: ['押す'] });
  assert.equal(result.id, 'my-id');
});

// =====================================================================
// style の正規化
// =====================================================================

test('style オブジェクトが正規化されて返る', () => {
  const result = normalize_ric_node({
    tag: 'div',
    style: { 'padding-top': '4px', color: 'red' },
  });
  // ハイフンケースがキャメルケースに変換されている
  assert.equal(result.style.paddingTop, '4px');
  assert.equal(result.style.color, 'red');
});

// =====================================================================
// ctx の正規化
// =====================================================================

test('ctx 文字列が配列に正規化される', () => {
  const result = normalize_ric_node({ tag: 'div', ctx: 'テキスト' });
  assert.deepEqual(result.ctx, ['テキスト']);
});

test('ctx が null の場合は空配列になる', () => {
  const result = normalize_ric_node({ tag: 'div', ctx: null });
  assert.deepEqual(result.ctx, []);
});

// =====================================================================
// その他の属性（イベントハンドラ・value 等）
// =====================================================================

test('onclick はそのまま extra_attrs に入る', () => {
  const fn = () => {};
  const result = normalize_ric_node({ tag: 'button', ctx: ['押す'], onclick: fn });
  assert.equal(result.onclick, fn);
});

test('value はそのまま extra_attrs に入る', () => {
  const result = normalize_ric_node({ tag: 'input', value: 'hello', type: 'text' });
  assert.equal(result.value, 'hello');
  assert.equal(result.type, 'text');
});

test('disabled はそのまま extra_attrs に入る', () => {
  const result = normalize_ric_node({ tag: 'button', disabled: true });
  assert.equal(result.disabled, true);
});

test('title 属性は保持される', () => {
  const result = normalize_ric_node({
    tag: 'button',
    ctx: ['+1'],
    title: 'increment',
  });
  assert.equal(result.tag, 'button');
  assert.equal(result.title, 'increment');
});
