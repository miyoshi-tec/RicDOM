// RicUI v0.2 — rest スプレッドテスト
// ui_range / ui_color / ui_separator / ui_select / ui_md_pre / ui_code_pre
//
// 共通契約（id/data-*/aria-*/onclick 透過、class 連結、tag 上書き不可）は
// tests/_helpers/rest_spread_contract.js の run_rest_spread_contract で検証。
// 各コンポーネント固有の振る舞い（隔離契約、style マージ、variant class 等）
// はこのファイル内で個別にテストする。

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { run_rest_spread_contract } = require('./_helpers/rest_spread_contract');

const { ui_range     } = require('../ric_ui/control/ui_range');
const { ui_color     } = require('../ric_ui/control/ui_color');
const { ui_separator } = require('../ric_ui/control/ui_separator');
const { ui_select    } = require('../ric_ui/control/ui_select');
const { ui_md_pre    } = require('../ric_ui/text/ui_md_pre');
const { ui_code_pre  } = require('../ric_ui/text/ui_code_pre');

// =====================================================================
// 共通契約（id/data-*/aria-*/onclick 透過、class 連結、tag 上書き不可）
// =====================================================================

run_rest_spread_contract({ name: 'ui_range',     factory: ui_range,     expected_tag: 'div',    base_class: 'ric-range' });
run_rest_spread_contract({ name: 'ui_color',     factory: ui_color,     expected_tag: 'div',    base_class: 'ric-color' });
run_rest_spread_contract({ name: 'ui_separator', factory: ui_separator, expected_tag: 'hr',     base_class: 'ric-separator' });
run_rest_spread_contract({ name: 'ui_select',    factory: ui_select,    expected_tag: 'select', base_class: 'ric-select' });
run_rest_spread_contract({ name: 'ui_md_pre',    factory: ui_md_pre,    expected_tag: 'div',    base_class: 'ric-md-pre',
                           extra_args: { ctx: ['# H'] } });
run_rest_spread_contract({ name: 'ui_code_pre',  factory: ui_code_pre,  expected_tag: 'pre',    base_class: 'ric-code-pre',
                           extra_args: { ctx: ['x'] } });

// =====================================================================
// ui_range: 隔離契約（oninput は内部 input に限定）
// =====================================================================

describe('ui_range: 隔離契約', () => {
  test('oninput は input 要素に掛かり wrapper には混入しない', () => {
    const fn = () => {};
    const node = ui_range({ oninput: fn });
    const input = node.ctx[0];
    assert.equal(input.oninput, fn);
    assert.ok(!Object.prototype.hasOwnProperty.call(node, 'oninput'));
  });
});

// =====================================================================
// ui_color: 隔離契約 + rgba variant class
// =====================================================================

describe('ui_color: 隔離契約 (hex モード)', () => {
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

describe('ui_color: rgba モード', () => {
  test('class が ric-color ric-color--rgba の後ろに連結される', () => {
    const n = ui_color({ value: 'rgba(255,0,0,0.5)', class: 'my' });
    assert.equal(n.class, 'ric-color ric-color--rgba my');
  });
  test('id が透過される', () => {
    const n = ui_color({ value: 'rgba(255,0,0,0.5)', id: 'c2' });
    assert.equal(n.id, 'c2');
  });
  test('rest で tag を上書きできない', () => {
    const n = ui_color({ value: 'rgba(0,0,0,1)', tag: 'span' });
    assert.equal(n.tag, 'div');
  });
});

// =====================================================================
// ui_separator: 基本構造
// =====================================================================

describe('ui_separator: 基本構造', () => {
  test('引数なしで hr + ric-separator', () => {
    const n = ui_separator();
    assert.equal(n.tag, 'hr');
    assert.equal(n.class, 'ric-separator');
  });
});

// =====================================================================
// ui_select: ctx 上書き不可（option_nodes）
// =====================================================================

describe('ui_select: option_nodes 保護', () => {
  test('rest で ctx（option_nodes）を上書きできない', () => {
    const n = ui_select({ options: ['a', 'b'], ctx: ['EVIL'] });
    assert.equal(n.ctx.length, 2);
    assert.equal(n.ctx[0].tag, 'option');
  });
});

// =====================================================================
// ui_md_pre: ctx 上書き不可（parsed blocks）
// =====================================================================

describe('ui_md_pre: parsed blocks 保護', () => {
  test('rest で ctx を上書きしても内部パース結果が勝つ', () => {
    const n = ui_md_pre({ ctx: ['# Hello'] });
    assert.ok(Array.isArray(n.ctx) && n.ctx.length > 0);
    assert.equal(n.ctx[0].tag, 'h1');
  });
});

// =====================================================================
// ui_code_pre: ctx 保護 + style マージ
// =====================================================================

describe('ui_code_pre: code node 保護', () => {
  test('rest で ctx を上書きしても内部 code node が勝つ', () => {
    const n = ui_code_pre({ ctx: ['const x = 1;'] });
    assert.equal(n.ctx.length, 1);
    assert.equal(n.ctx[0].tag, 'code');
  });
});

describe('ui_code_pre: style マージ', () => {
  test('max_height と rest.style がオブジェクトマージされる', () => {
    const n = ui_code_pre({ ctx: ['x'], max_height: '200px', style: { color: 'red' } });
    assert.equal(typeof n.style, 'object');
    assert.equal(n.style.maxHeight, '200px');
    assert.equal(n.style.color, 'red');
  });
});
