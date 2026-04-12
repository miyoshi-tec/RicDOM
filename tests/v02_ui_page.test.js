// RicUI v0.2 — create_ui_page テスト
//
// テスト方針:
//   1. 出力ノードの構造（tag / class / ctx 先頭の style タグ）
//   2. theme / density / font_size が CSS variables 文字列に変換される
//   3. ctx が style タグの後ろに展開される

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_page } = require('../ric_ui/layout/ui_page');
const { make_css_vars }  = require('../ric_ui/context');

// create_ui_page() のインスタンスを呼び出すヘルパー（旧 ui_page() 相当）
const ui_page = (props) => create_ui_page()(props);

// =====================================================================
// 1. 出力ノードの構造
// =====================================================================

describe('ui_page: 基本構造', () => {

  test('tag は div', () => {
    assert.equal(ui_page().tag, 'div');
  });

  test('class は ric-page', () => {
    assert.equal(ui_page().class, 'ric-page');
  });

  test('ctx[0] が style タグ', () => {
    const node = ui_page();
    const style_node = node.ctx[0];
    assert.equal(style_node.tag, 'style');
  });

  test('style タグの ctx[0] が文字列（CSS）', () => {
    const node = ui_page();
    const css = node.ctx[0].ctx[0];
    assert.equal(typeof css, 'string');
  });

  test('渡した ctx が style タグの後ろに展開される', () => {
    const child1 = { tag: 'div' };
    const child2 = { tag: 'p' };
    const node = ui_page({ ctx: [child1, child2] });

    assert.equal(node.ctx[1], child1);
    assert.equal(node.ctx[2], child2);
  });

  test('ctx が空のとき ctx.length は 1（style タグのみ）', () => {
    assert.equal(ui_page().ctx.length, 1);
  });
});

describe('ui_page: style（CSS variables）', () => {

  test('style が文字列（cssText 形式）で設定される', () => {
    const node = ui_page();
    assert.equal(typeof node.style, 'string');
  });

  test('style に --ric- 変数が含まれる', () => {
    const node = ui_page();
    assert.ok(node.style.includes('--ric-'), 'style に --ric-* 変数がある');
  });
});

// =====================================================================
// 2. theme / density / font_size の CSS variables 変換
// =====================================================================

describe('make_css_vars: theme', () => {

  test('theme=light のとき light カラー変数が含まれる', () => {
    const vars = make_css_vars({ theme: 'light' });
    assert.ok(vars.includes('--ric-color-bg: #f9fafb'), 'light の bg 色');
  });

  test('theme=dark のとき dark カラー変数が含まれる', () => {
    const vars = make_css_vars({ theme: 'dark' });
    assert.ok(vars.includes('--ric-color-bg: #111318'), 'dark の bg 色');
  });

  test('theme=cyber のとき accent が水色系', () => {
    const vars = make_css_vars({ theme: 'cyber' });
    assert.ok(vars.includes('--ric-color-accent: #38bdf8'), 'cyber の accent 色');
  });

  test('theme=aqua のとき accent がブルー系', () => {
    const vars = make_css_vars({ theme: 'aqua' });
    assert.ok(vars.includes('--ric-color-accent: #0284c7'), 'aqua の accent 色');
  });

  test('theme 省略（デフォルト）は light と同じ', () => {
    const with_default = make_css_vars({});
    const with_light   = make_css_vars({ theme: 'light' });
    assert.equal(with_default, with_light);
  });

  test('不明な theme は light にフォールバックする', () => {
    const vars_unknown = make_css_vars({ theme: 'unknown' });
    const vars_light   = make_css_vars({ theme: 'light' });
    assert.equal(vars_unknown, vars_light);
  });
});

describe('make_css_vars: density', () => {

  test('density=comfortable のとき gap が 6px', () => {
    const vars = make_css_vars({ density: 'comfortable' });
    assert.ok(vars.includes('--ric-gap: 6px'));
  });

  test('density=compact のとき gap が 4px', () => {
    const vars = make_css_vars({ density: 'compact' });
    assert.ok(vars.includes('--ric-gap: 4px'));
  });

  test('gap-md は gap から自動導出される', () => {
    const vars = make_css_vars({ density: 'comfortable' });
    assert.ok(vars.includes('--ric-gap-md: calc(var(--ric-gap) * 2)'));
  });

  test('density=comfortable のとき control-h が 36px', () => {
    const vars = make_css_vars({ density: 'comfortable' });
    assert.ok(vars.includes('--ric-control-h: 36px'));
  });

  test('density=compact のとき control-h が 28px', () => {
    const vars = make_css_vars({ density: 'compact' });
    assert.ok(vars.includes('--ric-control-h: 28px'));
  });

  test('density 省略（デフォルト）は comfortable と同じ', () => {
    const with_default      = make_css_vars({});
    const with_comfortable  = make_css_vars({ density: 'comfortable' });
    assert.equal(with_default, with_comfortable);
  });
});

describe('make_css_vars: font_size', () => {

  test('font_size=md のとき font-size が 14px', () => {
    const vars = make_css_vars({ font_size: 'md' });
    assert.ok(vars.includes('--ric-font-size: 14px'));
  });

  test('font_size=sm のとき font-size が 12px', () => {
    const vars = make_css_vars({ font_size: 'sm' });
    assert.ok(vars.includes('--ric-font-size: 12px'));
  });

  test('font_size=lg のとき font-size が 16px', () => {
    const vars = make_css_vars({ font_size: 'lg' });
    assert.ok(vars.includes('--ric-font-size: 16px'));
  });

  test('font_size 省略（デフォルト）は md と同じ', () => {
    const with_default = make_css_vars({});
    const with_md      = make_css_vars({ font_size: 'md' });
    assert.equal(with_default, with_md);
  });
});

describe('make_css_vars: theme が density の --ric-radius を上書きできる', () => {

  test('cyber テーマは --ric-radius: 0px で density の radius を上書きする', () => {
    const vars = make_css_vars({ theme: 'cyber', density: 'comfortable' });
    // comfortable は 8px だが cyber の 0px が優先される
    // 文字列内に複数あっても、最後の値が 0px であることを確認
    const entries = vars.split(';').map(s => s.trim()).filter(Boolean);
    const radius_entries = entries.filter(e => e.startsWith('--ric-radius'));
    // 最後のエントリが cyber の値
    const last_radius = radius_entries[radius_entries.length - 1];
    assert.ok(last_radius.includes('0px'), `cyber は radius=0px だが実際は: ${last_radius}`);
  });
});

// =====================================================================
// 3. ui_page と CSS 収集
// =====================================================================

describe('ui_page: CSS 収集（collect_classes）', () => {

  test('ctx に ric-col を含む子を渡すと style に .ric-col の CSS が入る', () => {
    const { ui_col } = require('../ric_ui/layout/ui_col');
    const node = ui_page({ ctx: [ui_col({ ctx: ['テスト'] })] });
    const css = node.ctx[0].ctx[0];
    assert.ok(css.includes('ric-col'), 'ric-col の CSS が生成されている');
  });

  test('ui_page 自身の ric-page CSS も含まれる', () => {
    const node = ui_page();
    const css = node.ctx[0].ctx[0];
    assert.ok(css.includes('ric-page'), 'ric-page の CSS が含まれる');
  });
});
