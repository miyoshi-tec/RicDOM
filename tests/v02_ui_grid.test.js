// RicUI v0.2 — ui_grid テスト
//
// 検証範囲:
//   1. 基本構造 (tag/class/ctx)
//   2. columns プロパティ: 数値展開 / 文字列スルー / auto-fit 省略形
//   3. rows プロパティ: 数値展開 / 文字列スルー
//   4. gap プロパティ: 文字列 / 数値 (px 付与)
//   5. style override / rest スプレッド契約

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_grid } = require('../ric_ui/layout/ui_grid');

describe('ui_grid: 基本構造', () => {
  test('tag は div', () => {
    assert.equal(ui_grid().tag, 'div');
  });
  test('デフォルト class は ric-grid', () => {
    assert.equal(ui_grid().class, 'ric-grid');
  });
  test('引数なしのとき style は付かない (CSS から gap が降ってくる)', () => {
    const n = ui_grid();
    assert.ok(!('style' in n), 'style プロパティが含まれない');
  });
  test('ctx が伝播される', () => {
    const ctx = [{ tag: 'span', ctx: ['a'] }];
    assert.deepEqual(ui_grid({ ctx }).ctx, ctx);
  });
});

describe('ui_grid: columns', () => {
  test('数値 3 で "1fr 1fr 1fr" に展開される', () => {
    assert.equal(ui_grid({ columns: 3 }).style.gridTemplateColumns, '1fr 1fr 1fr');
  });
  test('数値 1 で "1fr"', () => {
    assert.equal(ui_grid({ columns: 1 }).style.gridTemplateColumns, '1fr');
  });
  test('文字列 "120px 1fr" はそのまま', () => {
    assert.equal(ui_grid({ columns: '120px 1fr' }).style.gridTemplateColumns, '120px 1fr');
  });
  test('"auto-fit 200px" は repeat(...) に展開される', () => {
    assert.equal(
      ui_grid({ columns: 'auto-fit 200px' }).style.gridTemplateColumns,
      'repeat(auto-fit, minmax(200px, 1fr))',
    );
  });
  test('"auto-fill 120px" も repeat(...) に展開される', () => {
    assert.equal(
      ui_grid({ columns: 'auto-fill 120px' }).style.gridTemplateColumns,
      'repeat(auto-fill, minmax(120px, 1fr))',
    );
  });
});

describe('ui_grid: rows', () => {
  test('数値 2 で "1fr 1fr"', () => {
    assert.equal(ui_grid({ rows: 2 }).style.gridTemplateRows, '1fr 1fr');
  });
  test('"80px auto 1fr" はそのまま', () => {
    assert.equal(ui_grid({ rows: '80px auto 1fr' }).style.gridTemplateRows, '80px auto 1fr');
  });
});

describe('ui_grid: gap', () => {
  test('数値 12 で "12px"', () => {
    assert.equal(ui_grid({ gap: 12 }).style.gap, '12px');
  });
  test('文字列 "8px 16px" はそのまま', () => {
    assert.equal(ui_grid({ gap: '8px 16px' }).style.gap, '8px 16px');
  });
});

describe('ui_grid: style override / rest スプレッド契約', () => {
  test('style で追加 CSS を渡せる', () => {
    const n = ui_grid({ columns: 2, style: { padding: '8px' } });
    assert.equal(n.style.gridTemplateColumns, '1fr 1fr');
    assert.equal(n.style.padding, '8px');
  });
  test('style で gridTemplateColumns を明示しても columns 引数が優先される (後出し)', () => {
    // 仕様: 引数で渡したものが後 spread されるため引数勝ち。
    const n = ui_grid({ columns: 3, style: { gridTemplateColumns: '1fr' } });
    assert.equal(n.style.gridTemplateColumns, '1fr 1fr 1fr');
  });
  test('rest で id / data-* / onclick が透過する', () => {
    const fn = () => {};
    const n = ui_grid({ columns: 2, id: 'g1', 'data-k': 'v', onclick: fn });
    assert.equal(n.id, 'g1');
    assert.equal(n['data-k'], 'v');
    assert.equal(n.onclick, fn);
  });
  test('rest.class が ric-grid の後ろに連結される (基底クラス保持)', () => {
    const n = ui_grid({ class: 'my' });
    assert.equal(n.class, 'ric-grid my');
  });
});
