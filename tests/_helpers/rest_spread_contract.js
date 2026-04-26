'use strict';

// rest スプレッド契約テスト共通化ヘルパー
//
// SPEC.md「任意属性の透過（rest スプレッド契約）」に対応する回帰テストを
// 1 関数呼び出しで生成する。各 ui_xxx に同じアサーションを散在させず、
// ここで契約を一元管理する。
//
// 契約:
//   1. onclick / id / data-* / aria-* が外側ラッパー要素に透過される
//   2. class を渡すと基底クラスに連結される（基底クラスは消えない）
//   3. rest で tag を上書きできない（計算済みフィールドが勝つ）
//
// 使い方:
//   const { run_rest_spread_contract } = require('./_helpers/rest_spread_contract');
//   run_rest_spread_contract({
//     name: 'ui_range',
//     factory: ui_range,
//     expected_tag: 'div',
//     base_class: 'ric-range',
//   });
//
// オプション:
//   extra_args       追加で factory に渡す必須引数（例: ctx: ['# H']）
//   wrapper_onclick  true ならラッパーに onclick が付くことを確認（デフォルト true）
//                    false の場合は「onclick がラッパーに漏れない」(隔離契約) を確認
//   no_class_test    基底クラス連結テストをスキップするとき true
//                    （一部コンポーネントで基底 class が動的に変わる場合）

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const run_rest_spread_contract = ({
  name,
  factory,
  expected_tag,
  base_class,
  extra_args = {},
  wrapper_onclick = true,
  no_class_test = false,
} = {}) => {
  describe(`${name}: rest スプレッド契約`, () => {

    test('id / data-* / aria-* が外側ラッパーに透過される', () => {
      const n = factory({
        ...extra_args,
        id: `${name}-id`,
        'data-role': 'test',
        'aria-label': 'Test',
      });
      assert.equal(n.id, `${name}-id`);
      assert.equal(n['data-role'], 'test');
      assert.equal(n['aria-label'], 'Test');
    });

    if (wrapper_onclick) {
      test('onclick が外側ラッパーに透過される', () => {
        const fn = () => {};
        const n = factory({ ...extra_args, onclick: fn });
        assert.equal(n.onclick, fn);
      });
    } else {
      test('onclick は外側ラッパーに漏れない（隔離契約）', () => {
        const fn = () => {};
        const n = factory({ ...extra_args, onclick: fn });
        assert.notEqual(n.onclick, fn, 'onclick should NOT leak to wrapper');
      });
    }

    if (!no_class_test) {
      test(`class が ${base_class} の後ろに連結される（基底クラス消失バグ回帰）`, () => {
        const n = factory({ ...extra_args, class: 'my-extra' });
        assert.equal(n.class, `${base_class} my-extra`);
      });
    }

    test('rest で tag を上書きできない', () => {
      const n = factory({ ...extra_args, tag: 'span-bogus' });
      assert.equal(n.tag, expected_tag);
    });
  });
};

module.exports = { run_rest_spread_contract };
