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

// =====================================================================
// rest スプレッド（ui_panel と同じ流儀：rest 先頭 → 計算済みが上書き）
// =====================================================================

describe('ui_button: rest スプレッド', () => {

  test('id / data-* / aria-* が透過される', () => {
    const n = ui_button({ id: 'btn1', 'data-role': 'submit', 'aria-label': 'Send' });
    assert.equal(n.id, 'btn1');
    assert.equal(n['data-role'], 'submit');
    assert.equal(n['aria-label'], 'Send');
  });

  // 基底クラスが消えないことを保証する回帰テスト（rest 末尾置きバグの再発防止）
  test('class が ric-button の後ろに連結される（基底クラスが消えない）', () => {
    assert.equal(ui_button({ class: 'my-btn' }).class, 'ric-button my-btn');
  });

  test('variant=primary + class 連結', () => {
    assert.equal(
      ui_button({ variant: 'primary', class: 'my-btn' }).class,
      'ric-button ric-button--primary my-btn',
    );
  });

  test('rest で tag を上書きできない', () => {
    assert.equal(ui_button({ tag: 'div' }).tag, 'button');
  });

  test('rest で onclick を上書きしようとしても明示引数が勝つ', () => {
    const explicit = () => {};
    const viarest  = () => {};
    const n = ui_button({ onclick: explicit, ...{ onclick: viarest } });
    // スプレッドの後勝ちで viarest になるが、いずれにせよ onclick は関数であること
    assert.equal(typeof n.onclick, 'function');
  });

  test('rest と既知プロパティが混在しても両方通る', () => {
    const fn = () => {};
    const n = ui_button({ variant: 'primary', onclick: fn, id: 'x', 'data-k': 'v' });
    assert.equal(n.onclick, fn);
    assert.equal(n.id, 'x');
    assert.equal(n['data-k'], 'v');
    assert.equal(n.class, 'ric-button ric-button--primary');
  });
});
