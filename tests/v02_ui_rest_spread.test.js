// RicUI v0.2 — rest スプレッドテスト（ui_range / ui_color / ui_separator）
//
// ui_button / ui_input / ui_panel 等と同じ流儀で任意属性を透過するか検証する。
// これらのコンポーネントは既存のテストファイルを持たないため、
// rest スプレッド用の最小テストを専用ファイルにまとめる。
//
// テスト方針:
//   - onclick が外側ラッパーに透過される
//   - id / data-* / aria-* が外側ラッパーに透過される
//   - class が基底クラスの後ろに連結される
//   - rest で tag を上書きできない（計算済みフィールドが勝つ）

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_range     } = require('../ric_ui/control/ui_range');
const { ui_color     } = require('../ric_ui/control/ui_color');
const { ui_separator } = require('../ric_ui/control/ui_separator');

// =====================================================================
// ui_range
// =====================================================================

describe('ui_range: rest スプレッド', () => {
  test('onclick がラッパー div に透過される', () => {
    const fn = () => {};
    assert.equal(ui_range({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* がラッパー div に透過される', () => {
    const n = ui_range({ id: 'rng', 'data-role': 'volume', 'aria-label': 'Volume' });
    assert.equal(n.id, 'rng');
    assert.equal(n['data-role'], 'volume');
    assert.equal(n['aria-label'], 'Volume');
  });
  test('class が ric-range の後ろに連結される', () => {
    assert.equal(ui_range({ class: 'my' }).class, 'ric-range my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_range({ tag: 'span' }).tag, 'div');
  });
  test('oninput は input 要素に掛かり rest には混入しない', () => {
    const fn = () => {};
    const node = ui_range({ oninput: fn });
    const input = node.ctx[0];
    assert.equal(input.oninput, fn);
    // rest として wrapper に漏れていないこと
    assert.ok(!Object.prototype.hasOwnProperty.call(node, 'oninput'));
  });
});

// =====================================================================
// ui_color
// =====================================================================

describe('ui_color: rest スプレッド (hex モード)', () => {
  test('onclick がラッパー div に透過される', () => {
    const fn = () => {};
    assert.equal(ui_color({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* がラッパー div に透過される', () => {
    const n = ui_color({ id: 'c1', 'data-x': '1', 'aria-label': 'Color' });
    assert.equal(n.id, 'c1');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'Color');
  });
  test('class が ric-color の後ろに連結される', () => {
    assert.equal(ui_color({ class: 'my' }).class, 'ric-color my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_color({ tag: 'span' }).tag, 'div');
  });
});

describe('ui_color: rest スプレッド (rgba モード)', () => {
  test('id が透過される', () => {
    const n = ui_color({ value: 'rgba(255,0,0,0.5)', id: 'c2' });
    assert.equal(n.id, 'c2');
  });
  test('class が ric-color ric-color--rgba の後ろに連結される', () => {
    const n = ui_color({ value: 'rgba(255,0,0,0.5)', class: 'my' });
    assert.equal(n.class, 'ric-color ric-color--rgba my');
  });
  test('rest で tag を上書きできない', () => {
    const n = ui_color({ value: 'rgba(0,0,0,1)', tag: 'span' });
    assert.equal(n.tag, 'div');
  });
});

// =====================================================================
// ui_separator
// =====================================================================

describe('ui_separator: rest スプレッド', () => {
  test('基本構造は hr + ric-separator', () => {
    const n = ui_separator();
    assert.equal(n.tag, 'hr');
    assert.equal(n.class, 'ric-separator');
  });
  test('onclick が透過される', () => {
    const fn = () => {};
    assert.equal(ui_separator({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* が透過される', () => {
    const n = ui_separator({ id: 'sep', 'data-x': '1', 'aria-label': 'Sep' });
    assert.equal(n.id, 'sep');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'Sep');
  });
  test('class が ric-separator の後ろに連結される', () => {
    assert.equal(ui_separator({ class: 'my' }).class, 'ric-separator my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_separator({ tag: 'div' }).tag, 'hr');
  });
});
