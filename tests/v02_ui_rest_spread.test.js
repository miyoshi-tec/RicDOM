// RicUI v0.2 — rest スプレッドテスト
// ui_range / ui_color / ui_separator / ui_select / ui_md_pre / ui_code_pre
//
// ui_button / ui_input / ui_panel 等と同じ流儀で任意属性を透過するか検証する。
// これらのコンポーネントは既存のテストファイルを持たないため、
// rest スプレッド用の最小テストを専用ファイルにまとめる。
//
// テスト方針:
//   - onclick が外側ラッパーに透過される
//   - id / data-* / aria-* が外側ラッパーに透過される
//   - class が基底クラスの後ろに連結される（基底クラス消失バグ回帰検知）
//   - rest で tag を上書きできない（計算済みフィールドが勝つ）

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_range     } = require('../ric_ui/control/ui_range');
const { ui_color     } = require('../ric_ui/control/ui_color');
const { ui_separator } = require('../ric_ui/control/ui_separator');
const { ui_select    } = require('../ric_ui/control/ui_select');
const { ui_md_pre    } = require('../ric_ui/text/ui_md_pre');
const { ui_code_pre  } = require('../ric_ui/text/ui_code_pre');

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
  // 隔離契約: oninput / value は内部 picker input に掛かり、wrapper div には漏れない
  test('oninput は picker input に掛かり wrapper に混入しない', () => {
    const fn = () => {};
    const node  = ui_color({ value: '#112233', oninput: fn });
    const picker = node.ctx[0];
    assert.equal(picker.tag, 'input');
    assert.equal(picker.type, 'color');
    assert.equal(typeof picker.oninput, 'function');
    assert.ok(!Object.prototype.hasOwnProperty.call(node, 'oninput'));
  });
  test('value は picker input に掛かり wrapper に混入しない', () => {
    const node = ui_color({ value: '#112233' });
    assert.equal(node.ctx[0].value, '#112233');
    assert.ok(!Object.prototype.hasOwnProperty.call(node, 'value'));
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

// =====================================================================
// ui_select
// =====================================================================

describe('ui_select: rest スプレッド', () => {
  test('onclick がラッパー select に透過される', () => {
    const fn = () => {};
    assert.equal(ui_select({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* がラッパー select に透過される', () => {
    const n = ui_select({ id: 'sel', 'data-role': 'picker', 'aria-label': 'Pick' });
    assert.equal(n.id, 'sel');
    assert.equal(n['data-role'], 'picker');
    assert.equal(n['aria-label'], 'Pick');
  });
  test('class が ric-select の後ろに連結される（基底クラス消失バグ回帰）', () => {
    assert.equal(ui_select({ class: 'my' }).class, 'ric-select my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_select({ tag: 'div' }).tag, 'select');
  });
  test('rest で ctx（option_nodes）を上書きできない', () => {
    const n = ui_select({ options: ['a', 'b'], ctx: ['EVIL'] });
    assert.equal(n.ctx.length, 2);
    assert.equal(n.ctx[0].tag, 'option');
  });
});

// =====================================================================
// ui_md_pre
// =====================================================================

describe('ui_md_pre: rest スプレッド', () => {
  test('onclick がラッパー div に透過される', () => {
    const fn = () => {};
    assert.equal(ui_md_pre({ ctx: ['# H'], onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* がラッパー div に透過される', () => {
    const n = ui_md_pre({ ctx: ['# H'], id: 'md', 'data-x': '1', 'aria-label': 'MD' });
    assert.equal(n.id, 'md');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'MD');
  });
  test('class が ric-md-pre の後ろに連結される（基底クラス消失バグ回帰）', () => {
    assert.equal(ui_md_pre({ ctx: ['# H'], class: 'my' }).class, 'ric-md-pre my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_md_pre({ ctx: ['# H'], tag: 'span' }).tag, 'div');
  });
  test('rest で ctx（parsed blocks）を上書きできない', () => {
    const n = ui_md_pre({ ctx: ['# Hello'] });
    // 内部パース後の ctx は h1 ブロックを含む
    assert.ok(Array.isArray(n.ctx) && n.ctx.length > 0);
    assert.equal(n.ctx[0].tag, 'h1');
  });
});

// =====================================================================
// ui_code_pre
// =====================================================================

describe('ui_code_pre: rest スプレッド', () => {
  test('onclick がラッパー pre に透過される', () => {
    const fn = () => {};
    assert.equal(ui_code_pre({ ctx: ['x'], onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* がラッパー pre に透過される', () => {
    const n = ui_code_pre({ ctx: ['x'], id: 'code', 'data-x': '1', 'aria-label': 'Code' });
    assert.equal(n.id, 'code');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'Code');
  });
  test('class が ric-code-pre の後ろに連結される（基底クラス消失バグ回帰）', () => {
    assert.equal(ui_code_pre({ ctx: ['x'], class: 'my' }).class, 'ric-code-pre my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_code_pre({ ctx: ['x'], tag: 'div' }).tag, 'pre');
  });
  test('rest で ctx（code node）を上書きできない', () => {
    const n = ui_code_pre({ ctx: ['const x = 1;'] });
    assert.equal(n.ctx.length, 1);
    assert.equal(n.ctx[0].tag, 'code');
  });
  test('max_height と rest.style がマージされる', () => {
    const n = ui_code_pre({ ctx: ['x'], max_height: '200px', style: { color: 'red' } });
    // style はオブジェクトマージされる（文字列化前のオブジェクト形式）
    assert.equal(typeof n.style, 'object');
    assert.equal(n.style.maxHeight, '200px');
    assert.equal(n.style.color, 'red');
  });
});
