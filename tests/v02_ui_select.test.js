// RicUI v0.2 — ui_select / bind_select テスト
//
// テスト方針:
//   1. 構造テスト  ── option ノード生成・selected 判定・placeholder
//   2. DOM テスト  ── bind_select の初期選択と onchange

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_select }   = require('../ric_ui/control/ui_select');
const { bind_select } = require('../ric_ui/control/bind_select');

const setup_jsdom = () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>',
  );
  global.window      = dom.window;
  global.document    = dom.window.document;
  global.Node        = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  return dom;
};

const flush_raf = () => new Promise(resolve => setTimeout(resolve, 10));

// =====================================================================
// 1. 構造テスト：ui_select
// =====================================================================

describe('ui_select: 基本構造', () => {

  test('tag は select', () => {
    assert.equal(ui_select().tag, 'select');
  });

  test('class は ric-select', () => {
    assert.equal(ui_select().class, 'ric-select');
  });

  test('options なしのとき ctx が空配列', () => {
    assert.deepEqual(ui_select().ctx, []);
  });
});

describe('ui_select: options の正規化', () => {

  test('string[] を渡すと option ノードが生成される', () => {
    const node = ui_select({ options: ['a', 'b', 'c'] });
    assert.equal(node.ctx.length, 3);
  });

  test('string option の value と ctx（ラベル）が同じになる', () => {
    const opt = ui_select({ options: ['viewer'] }).ctx[0];
    assert.equal(opt.value, 'viewer');
    assert.deepEqual(opt.ctx, ['viewer']);
  });

  test('{value, label}[] を渡すと正規化される', () => {
    const node = ui_select({
      options: [{ value: 'ja', label: '日本語' }],
    });
    const opt = node.ctx[0];
    assert.equal(opt.value, 'ja');
    assert.deepEqual(opt.ctx, ['日本語']);
  });

  test('value に一致する option の selected は 1（numeric）', () => {
    const node = ui_select({ value: 'b', options: ['a', 'b', 'c'] });
    const opts = node.ctx;
    assert.equal(opts[0].selected, 0);
    assert.equal(opts[1].selected, 1);
    assert.equal(opts[2].selected, 0);
  });

  test('value に一致する option がなければすべて selected=0', () => {
    const node = ui_select({ value: 'x', options: ['a', 'b'] });
    assert.equal(node.ctx[0].selected, 0);
    assert.equal(node.ctx[1].selected, 0);
  });

  test('数値 value は String 変換で比較される', () => {
    // value=1（数値）は options の '1' と一致する
    const node = ui_select({ value: 1, options: ['1', '2'] });
    assert.equal(node.ctx[0].selected, 1);
    assert.equal(node.ctx[1].selected, 0);
  });
});

describe('ui_select: placeholder', () => {

  test('placeholder を指定すると先頭に disabled option が追加される', () => {
    const node = ui_select({
      options: ['a'],
      placeholder: '選択してください',
    });
    assert.equal(node.ctx.length, 2);
    const ph_opt = node.ctx[0];
    assert.equal(ph_opt.disabled, true);
    assert.equal(ph_opt.value,    '');
    assert.deepEqual(ph_opt.ctx, ['選択してください']);
  });

  test('value=\'\' のとき placeholder option の selected=1', () => {
    const node = ui_select({
      value: '',
      options: ['a'],
      placeholder: '---',
    });
    assert.equal(node.ctx[0].selected, 1);
  });

  test('value が空でないとき placeholder option の selected=0', () => {
    const node = ui_select({
      value: 'a',
      options: ['a'],
      placeholder: '---',
    });
    assert.equal(node.ctx[0].selected, 0);
  });

  test('placeholder なしのとき先頭 option は通常の option', () => {
    const node = ui_select({ options: ['a', 'b'] });
    assert.ok(!node.ctx[0].disabled, 'disabled が付いていない');
  });
});

describe('ui_select: disabled / onchange', () => {

  test('disabled=true のとき select に disabled が含まれる', () => {
    assert.equal(ui_select({ disabled: true }).disabled, true);
  });

  test('disabled=false のとき disabled が含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_select({ disabled: false }), 'disabled'));
  });

  test('onchange を指定するとノードに含まれる', () => {
    const fn = () => {};
    assert.equal(ui_select({ onchange: fn }).onchange, fn);
  });

  test('onchange を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_select(), 'onchange'));
  });
});

// =====================================================================
// 2. DOM テスト：bind_select
// =====================================================================

describe('bind_select: 初期描画', () => {

  test('初期値に一致する option が selected になる', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ role: 'editor' }, target, s =>
      bind_select(s, 'role', { options: ['viewer', 'editor', 'admin'] }),
    );

    const sel = target.querySelector('select');
    assert.ok(sel, 'select 要素が存在する');
    assert.equal(sel.value, 'editor');
  });
});

describe('bind_select: 双方向バインド', () => {

  test('onchange で s[key] が更新される', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM({ role: 'viewer' }, target, s =>
      bind_select(s, 'role', { options: ['viewer', 'editor', 'admin'] }),
    );

    const sel = target.querySelector('select');
    sel.value = 'admin';
    sel.dispatchEvent(new dom.window.Event('change'));
    await flush_raf();

    assert.equal(panel.role, 'admin');
  });

  test('panel 経由で state を変えると select が再描画される', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM({ role: 'viewer' }, target, s =>
      bind_select(s, 'role', { options: ['viewer', 'editor', 'admin'] }),
    );

    panel.role = 'admin';
    await flush_raf();

    // admin option の selected 属性を確認
    const opts = target.querySelectorAll('option');
    const admin_opt = [...opts].find(o => o.value === 'admin');
    assert.ok(admin_opt, 'admin option が存在する');
    // jsdom では selected プロパティで確認
    assert.equal(admin_opt.selected, true);
  });
});
