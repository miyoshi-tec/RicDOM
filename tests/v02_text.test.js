// RicUI v0.2 — ui_text テスト（variant: default / muted / title / label）
//
// テスト方針:
//   1. tag・class・variant の検証（純粋関数）
//   2. ctx・style の伝播

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_text } = require('../ric_ui/text/ui_text');

// =====================================================================
// ui_text
// =====================================================================

describe('ui_text: 基本構造', () => {

  test('tag は span', () => {
    assert.equal(ui_text().tag, 'span');
  });

  test('デフォルト class は ric-text', () => {
    assert.equal(ui_text().class, 'ric-text');
  });

  test('ctx のデフォルトは空配列', () => {
    assert.deepEqual(ui_text().ctx, []);
  });

  test('ctx が伝播される', () => {
    assert.deepEqual(ui_text({ ctx: ['hello'] }).ctx, ['hello']);
  });
});

describe('ui_text: variant', () => {

  test('variant=default のとき class は ric-text のみ', () => {
    assert.equal(ui_text({ variant: 'default' }).class, 'ric-text');
  });

  test('variant=muted のとき class は ric-text ric-text--muted', () => {
    assert.equal(ui_text({ variant: 'muted' }).class, 'ric-text ric-text--muted');
  });

  test('variant 省略のとき class は ric-text のみ（default 扱い）', () => {
    assert.equal(ui_text().class, 'ric-text');
  });
});

describe('ui_text: style', () => {

  test('style を渡すとノードに含まれる', () => {
    const node = ui_text({ style: { color: 'red' } });
    assert.ok(Object.prototype.hasOwnProperty.call(node, 'style'));
    assert.equal(node.style.color, 'red');
  });

  test('style を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_text(), 'style'));
  });

  test('空オブジェクト {} を渡すとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_text({ style: {} }), 'style'));
  });
});

// =====================================================================
// ui_title
// =====================================================================

describe('ui_text variant: title', () => {

  test('tag は h2', () => {
    assert.equal(ui_text({ variant: 'title' }).tag, 'h2');
  });

  test('class は ric-text ric-text--title', () => {
    assert.equal(ui_text({ variant: 'title' }).class, 'ric-text ric-text--title');
  });

  test('ctx が伝播される', () => {
    assert.deepEqual(ui_text({ variant: 'title', ctx: ['見出し'] }).ctx, ['見出し']);
  });
});

// =====================================================================
// variant: label
// =====================================================================

describe('ui_text variant: label', () => {

  test('tag は label', () => {
    assert.equal(ui_text({ variant: 'label' }).tag, 'label');
  });

  test('class は ric-text ric-text--label', () => {
    assert.equal(ui_text({ variant: 'label' }).class, 'ric-text ric-text--label');
  });

  test('ctx が伝播される', () => {
    assert.deepEqual(ui_text({ variant: 'label', ctx: ['名前'] }).ctx, ['名前']);
  });
});

// =====================================================================
// rest スプレッド
// =====================================================================

describe('ui_text: rest スプレッド', () => {
  test('onclick が透過される', () => {
    const fn = () => {};
    assert.equal(ui_text({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* が透過される', () => {
    const n = ui_text({ id: 'a', 'data-x': '1', 'aria-label': 'L' });
    assert.equal(n.id, 'a');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'L');
  });
  test('class が ric-text の後ろに連結される', () => {
    assert.equal(ui_text({ class: 'my' }).class, 'ric-text my');
  });
  test('variant=muted + class 連結', () => {
    assert.equal(ui_text({ variant: 'muted', class: 'my' }).class, 'ric-text ric-text--muted my');
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_text({ tag: 'div' }).tag, 'span');
  });
});
