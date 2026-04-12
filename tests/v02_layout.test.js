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
// ui_panel
// =====================================================================
// ui_card は ui_panel に統合されたため、このセクションは削除済み
