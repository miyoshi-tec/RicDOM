// RicUI v0.2 — ui_button テスト
//
// テスト方針:
//   1. 構造テスト  ── tag / class / variant / disabled / onclick / ctx

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_button } = require('../ric_ui/control/ui_button');

// =====================================================================
// 1. 構造テスト：vdom ノード
// =====================================================================

describe('ui_button: 基本構造', () => {

  test('デフォルト引数でノードが返る', () => {
    const node = ui_button();
    assert.equal(node.tag, 'button');
  });

  test('デフォルト class は ric-button のみ（バリアントなし）', () => {
    assert.equal(ui_button().class, 'ric-button');
  });

  test('variant=default を明示しても class は ric-button のみ', () => {
    assert.equal(ui_button({ variant: 'default' }).class, 'ric-button');
  });

  test('variant=primary のとき class が ric-button ric-button--primary になる', () => {
    assert.equal(ui_button({ variant: 'primary' }).class, 'ric-button ric-button--primary');
  });

  test('variant=danger のとき class が ric-button ric-button--danger になる', () => {
    assert.equal(ui_button({ variant: 'danger' }).class, 'ric-button ric-button--danger');
  });

  test('ctx が伝播される', () => {
    const node = ui_button({ ctx: ['送信'] });
    assert.deepEqual(node.ctx, ['送信']);
  });

  test('ctx のデフォルトは空配列', () => {
    assert.deepEqual(ui_button().ctx, []);
  });
});

describe('ui_button: disabled', () => {

  test('disabled=true のとき disabled プロパティが含まれる', () => {
    assert.equal(ui_button({ disabled: true }).disabled, true);
  });

  test('disabled=false のとき disabled プロパティが含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_button({ disabled: false }), 'disabled'));
  });

  test('disabled 省略のとき disabled プロパティが含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_button(), 'disabled'));
  });
});

describe('ui_button: onclick', () => {

  test('onclick を指定するとノードに含まれる', () => {
    const fn = () => {};
    assert.equal(ui_button({ onclick: fn }).onclick, fn);
  });

  test('onclick を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_button(), 'onclick'));
  });
});
