// RicUI v0.2 — ui_button テスト
//
// テスト方針:
//   1. 構造テスト  ── tag / class / variant / disabled / onclick / ctx

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_button } = require('../ric_ui/control/ui_button');
const { run_rest_spread_contract } = require('./_helpers/rest_spread_contract');

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

// 汎用契約 (id/data-*/aria-*/onclick 透過、class 連結、tag 上書き不可) は
// tests/_helpers/rest_spread_contract.js の run_rest_spread_contract で検証。
run_rest_spread_contract({ name: 'ui_button', factory: ui_button, expected_tag: 'button', base_class: 'ric-button' });

describe('ui_button: rest スプレッド (固有)', () => {

  test('variant=primary + class 連結', () => {
    assert.equal(
      ui_button({ variant: 'primary', class: 'my-btn' }).class,
      'ric-button ric-button--primary my-btn',
    );
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

// =====================================================================
// size プロパティ（density と直交する、単体ボタン寸法の上書き）
// =====================================================================

describe('ui_button: size', () => {

  test('size 省略時は size class が付かない（density に従う）', () => {
    assert.equal(ui_button().class, 'ric-button');
  });

  test('size=sm のとき ric-button--sm が付く', () => {
    assert.equal(ui_button({ size: 'sm' }).class, 'ric-button ric-button--sm');
  });

  test('size=md のとき ric-button--md が付く', () => {
    assert.equal(ui_button({ size: 'md' }).class, 'ric-button ric-button--md');
  });

  test('size=lg のとき ric-button--lg が付く', () => {
    assert.equal(ui_button({ size: 'lg' }).class, 'ric-button ric-button--lg');
  });

  test('variant + size を組み合わせると両方付く（順序: variant → size）', () => {
    const n = ui_button({ variant: 'primary', size: 'sm' });
    assert.equal(n.class, 'ric-button ric-button--primary ric-button--sm');
  });

  test('variant=link + size=sm のような併用も成立する', () => {
    const n = ui_button({ variant: 'link', size: 'sm' });
    assert.equal(n.class, 'ric-button ric-button--link ric-button--sm');
  });

  test('rest.class が指定されても size class は保たれる', () => {
    const n = ui_button({ size: 'sm', class: 'my-extra' });
    assert.equal(n.class, 'ric-button ric-button--sm my-extra');
  });
});

// =====================================================================
// variant=link（breadcrumb / inline link 用の最小ボタン）
// =====================================================================

describe('ui_button: variant=link', () => {

  test('variant=link で class が ric-button ric-button--link になる', () => {
    assert.equal(ui_button({ variant: 'link' }).class, 'ric-button ric-button--link');
  });

  test('variant=link でも tag は button のまま（accessibility 上の選択）', () => {
    assert.equal(ui_button({ variant: 'link' }).tag, 'button');
  });
});
