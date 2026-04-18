// RicUI v0.2 — ui_col / ui_row / ui_panel / ui_panel テスト
//
// テスト方針:
//   1. tag・class・layout variant の検証（純粋関数）
//   2. ctx・style の伝播

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_col }   = require('../ric_ui/layout/ui_col');
const { ui_row }   = require('../ric_ui/layout/ui_row');
const { ui_panel } = require('../ric_ui/surface/ui_panel');

// =====================================================================
// ui_col
// =====================================================================

describe('ui_col: 基本構造', () => {

  test('tag は div', () => {
    assert.equal(ui_col().tag, 'div');
  });

  test('class は ric-col', () => {
    assert.equal(ui_col().class, 'ric-col');
  });

  test('ctx のデフォルトは空配列', () => {
    assert.deepEqual(ui_col().ctx, []);
  });

  test('ctx が伝播される', () => {
    const child = { tag: 'span' };
    assert.deepEqual(ui_col({ ctx: [child] }).ctx, [child]);
  });

  test('style を渡すとノードに含まれる', () => {
    const node = ui_col({ style: { gap: '4px' } });
    assert.ok(Object.prototype.hasOwnProperty.call(node, 'style'));
  });

  test('style を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_col(), 'style'));
  });
});

describe('ui_col: rest スプレッド', () => {
  test('onclick が透過される', () => {
    const fn = () => {};
    assert.equal(ui_col({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* が透過される', () => {
    const n = ui_col({ id: 'a', 'data-x': '1', 'aria-label': 'L' });
    assert.equal(n.id, 'a');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'L');
  });
  test('class が ric-col の後ろに連結される', () => {
    assert.equal(ui_col({ class: 'my' }).class, 'ric-col my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_col({ tag: 'span' }).tag, 'div');
  });
});

// =====================================================================
// ui_row
// =====================================================================

describe('ui_row: 基本構造', () => {

  test('tag は div', () => {
    assert.equal(ui_row().tag, 'div');
  });

  test('class は ric-row', () => {
    assert.equal(ui_row().class, 'ric-row');
  });

  test('ctx のデフォルトは空配列', () => {
    assert.deepEqual(ui_row().ctx, []);
  });

  test('ctx が伝播される', () => {
    const child = { tag: 'button' };
    assert.deepEqual(ui_row({ ctx: [child] }).ctx, [child]);
  });

  test('style を渡すとノードに含まれる', () => {
    const node = ui_row({ style: { alignItems: 'center' } });
    assert.ok(Object.prototype.hasOwnProperty.call(node, 'style'));
  });

  test('style を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_row(), 'style'));
  });
});

describe('ui_row: rest スプレッド', () => {
  test('onclick が透過される', () => {
    const fn = () => {};
    assert.equal(ui_row({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* が透過される', () => {
    const n = ui_row({ id: 'a', 'data-x': '1', 'aria-label': 'L' });
    assert.equal(n.id, 'a');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'L');
  });
  test('class が ric-row の後ろに連結される', () => {
    assert.equal(ui_row({ class: 'my' }).class, 'ric-row my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_row({ tag: 'span' }).tag, 'div');
  });
});

// =====================================================================
// ui_panel
// =====================================================================

describe('ui_panel: 基本構造', () => {

  test('tag は section', () => {
    assert.equal(ui_panel().tag, 'section');
  });

  test('デフォルト class は ric-panel（layout=col）', () => {
    assert.equal(ui_panel().class, 'ric-panel');
  });

  test('layout=col を明示しても class は ric-panel のみ', () => {
    assert.equal(ui_panel({ layout: 'col' }).class, 'ric-panel');
  });

  test('layout=row のとき class は ric-panel ric-panel--row', () => {
    assert.equal(ui_panel({ layout: 'row' }).class, 'ric-panel ric-panel--row');
  });

  test('ctx が伝播される', () => {
    const child = { tag: 'div' };
    assert.deepEqual(ui_panel({ ctx: [child] }).ctx, [child]);
  });

  test('ctx のデフォルトは空配列', () => {
    assert.deepEqual(ui_panel().ctx, []);
  });

  test('style を渡すとノードに含まれる', () => {
    const node = ui_panel({ style: { padding: '8px' } });
    assert.ok(Object.prototype.hasOwnProperty.call(node, 'style'));
  });

  test('style を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_panel(), 'style'));
  });
});

// =====================================================================
// ui_panel: rest スプレッド（ui_input / ui_button と同じ流儀で任意属性透過）
// =====================================================================

describe('ui_panel: rest スプレッド', () => {

  test('onclick が DOM 属性として透過される', () => {
    const fn = () => {};
    const node = ui_panel({ onclick: fn });
    assert.equal(node.onclick, fn);
  });

  test('id / data-* / aria-* が透過される', () => {
    const node = ui_panel({ id: 'main', 'data-role': 'panel', 'aria-label': 'Main' });
    assert.equal(node.id, 'main');
    assert.equal(node['data-role'], 'panel');
    assert.equal(node['aria-label'], 'Main');
  });

  test('onmouseenter / onmouseleave が透過される', () => {
    const enter = () => {};
    const leave = () => {};
    const node = ui_panel({ onmouseenter: enter, onmouseleave: leave });
    assert.equal(node.onmouseenter, enter);
    assert.equal(node.onmouseleave, leave);
  });

  test('rest に class を渡すと ric-panel の後ろに連結される', () => {
    const node = ui_panel({ class: 'my-card' });
    assert.equal(node.class, 'ric-panel my-card');
  });

  test('rest に class を渡しても layout=row 基底クラスは保たれる', () => {
    const node = ui_panel({ layout: 'row', class: 'my-card' });
    assert.equal(node.class, 'ric-panel ric-panel--row my-card');
  });

  test('rest で tag を上書きしようとしても section のまま（計算済みフィールドが優先）', () => {
    const node = ui_panel({ tag: 'div' });
    assert.equal(node.tag, 'section');
  });

  test('rest で ctx を上書きしようとしても ctx が優先される', () => {
    const real_child = { tag: 'span' };
    const node = ui_panel({ ctx: [real_child], style: {} });
    assert.deepEqual(node.ctx, [real_child]);
  });

  test('rest と既知プロパティが混在しても両方通る', () => {
    const fn = () => {};
    const node = ui_panel({
      layout: 'row', disabled: false, style: { padding: '8px' },
      onclick: fn, id: 'x',
    });
    assert.equal(node.onclick, fn);
    assert.equal(node.id, 'x');
    assert.equal(node.class, 'ric-panel ric-panel--row');
    assert.ok(Object.prototype.hasOwnProperty.call(node, 'style'));
  });
});

// =====================================================================
// ui_panel
// =====================================================================
// ui_card は ui_panel に統合されたため、このセクションは削除済み
