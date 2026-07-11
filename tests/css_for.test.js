// RicUI — css_for() テスト (v0.3.34〜)
//
// テスト方針:
//   1. 単一 / 複数指定で該当テンプレートの CSS が含まれる
//   2. 引数なしで全テンプレートが含まれる
//   3. 未知キーは console.warn の上でスキップ（例外にしない）
//   4. make_css_vars が公開経路 (require('../ric_ui')) から取れる
//   5. create_ui_page が注入する CSS と css_for の出力が同一規則であること
//      （build_css / CSS_TEMPLATES 共有の確認）

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { css_for } = require('../ric_ui/css_registry');
const ric_ui = require('../ric_ui');

describe('css_for: 単一 / 複数指定', () => {

  test('ric-button 指定で .ric-page .ric-button の規則が含まれる', () => {
    const css = css_for('ric-button');
    assert.ok(css.includes('.ric-page .ric-button'), css);
  });

  test('複数指定で両方のテンプレートが含まれる', () => {
    const css = css_for('ric-button', 'ric-input');
    assert.ok(css.includes('.ric-page .ric-button'), 'ric-button 規則あり');
    assert.ok(css.includes('.ric-page .ric-input'), 'ric-input 規則あり');
  });

  test('指定しなかったテンプレートは含まれない', () => {
    const css = css_for('ric-button');
    assert.ok(!css.includes('.ric-page .ric-dialog'), 'ric-dialog 規則は含まれない');
  });
});

describe('css_for: 引数なし（全テンプレート）', () => {

  test('ric-button と ric-dialog の両方を含む', () => {
    const { CSS_TEMPLATES } = require('../ric_ui/css_templates');
    const css = css_for();
    // ric-button は .ric-page スコープ、ric-dialog はポータル系で
    // スコープ形式が異なるため、各テンプレート自身の出力断片で含有確認する
    assert.ok(css.includes(CSS_TEMPLATES['ric-button']()), 'ric-button 規則あり');
    assert.ok(css.includes(CSS_TEMPLATES['ric-dialog']()), 'ric-dialog 規則あり');
  });
});

describe('css_for: 未知キー', () => {

  test('未知キーで console.warn が出て、既知分だけ返る', (t) => {
    const warn_calls = [];
    t.mock.method(console, 'warn', (...args) => { warn_calls.push(args); });

    const css = css_for('ric-button', 'ric-not-a-real-template');

    assert.equal(warn_calls.length, 1, 'warn が 1 回呼ばれる');
    assert.ok(warn_calls[0][0].includes('ric-not-a-real-template'), 'warn 文言に未知キー名が入る');
    assert.ok(css.includes('.ric-page .ric-button'), '既知分 (ric-button) は返る');
  });

  test('全部未知キーなら空文字を返す（例外にしない）', (t) => {
    t.mock.method(console, 'warn', () => {});
    assert.equal(css_for('totally-unknown'), '');
  });
});

describe('css_for / make_css_vars: 公開経路 (require("../ric_ui"))', () => {

  test('ric_ui.css_for が動作する', () => {
    const css = ric_ui.css_for('ric-button');
    assert.ok(css.includes('.ric-page .ric-button'), css);
  });

  test('ric_ui.make_css_vars({ theme: "dark" }) が --ric-color-fg 等を含む', () => {
    const vars = ric_ui.make_css_vars({ theme: 'dark' });
    assert.ok(vars.includes('--ric-color-fg'), 'fg 変数あり');
    assert.ok(vars.includes('--ric-'), '--ric- 変数プレフィックスあり');
  });
});

describe('css_for: create_ui_page 注入と同一規則（build_css 共有）', () => {

  test('page が注入する CSS に css_for(\'ric-page\',\'ric-button\') の規則が含有される', () => {
    const { create_ui_page } = require('../ric_ui/layout/ui_page');
    const { ui_button } = require('../ric_ui/control/ui_button');

    const page = create_ui_page()({ ctx: [ui_button({ ctx: ['OK'] })] });
    const injected_css = page.ctx[0].ctx[0];

    const standalone_css = css_for('ric-page', 'ric-button');

    // 完全一致でなくてよい（page 側は使用クラス集合が動的）。
    // build_css / CSS_TEMPLATES を共有しているため、同じテンプレート単位の
    // CSS 文字列がそのまま含まれるはず。
    assert.ok(injected_css.includes('.ric-page .ric-button'), 'page 注入側に ric-button 規則あり');
    assert.ok(standalone_css.includes('.ric-page .ric-button'), 'css_for 側に ric-button 規則あり');

    // ric-button テンプレート単体の CSS 断片が両者で完全に一致することを確認
    // (= 同じ CSS_TEMPLATES['ric-button']() の出力を共有している証拠)
    const { CSS_TEMPLATES } = require('../ric_ui/css_templates');
    const ric_button_fragment = CSS_TEMPLATES['ric-button']();
    assert.ok(injected_css.includes(ric_button_fragment), 'page 注入側は同一断片を含む');
    assert.ok(standalone_css.includes(ric_button_fragment), 'css_for 側は同一断片を含む');
  });
});
