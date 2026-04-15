// RicUI v0.2 — ui_checkbox / bind_checkbox テスト
//
// テスト方針:
//   1. 構造テスト  ── ui_checkbox の vdom ノード（純粋関数）
//   2. DOM テスト  ── bind_checkbox が DOM と state を正しく結ぶか（jsdom）

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_checkbox }   = require('../ric_ui/control/ui_checkbox');
const { bind_checkbox } = require('../ric_ui/control/bind_checkbox');

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
// 1. 構造テスト：ui_checkbox
// =====================================================================

describe('ui_checkbox: 基本構造', () => {

  test('tag は label', () => {
    assert.equal(ui_checkbox().tag, 'label');
  });

  test('デフォルト class は ric-checkbox', () => {
    assert.equal(ui_checkbox().class, 'ric-checkbox');
  });

  test('ctx 配列が存在する', () => {
    assert.ok(Array.isArray(ui_checkbox().ctx));
  });

  test('先頭の子ノードが input[type=checkbox]', () => {
    const child = ui_checkbox().ctx[0];
    assert.equal(child.tag,  'input');
    assert.equal(child.type, 'checkbox');
  });
});

describe('ui_checkbox: checked', () => {

  test('checked=true のとき input の checked に 1（numeric）が設定される', () => {
    const input = ui_checkbox({ checked: true }).ctx[0];
    assert.equal(input.checked, 1);
  });

  test('checked=false のとき input の checked に 0（numeric）が設定される', () => {
    const input = ui_checkbox({ checked: false }).ctx[0];
    assert.equal(input.checked, 0);
  });

  test('デフォルト（checked 省略）は 0', () => {
    const input = ui_checkbox().ctx[0];
    assert.equal(input.checked, 0);
  });
});

describe('ui_checkbox: ラベルテキスト（ctx）', () => {

  test('ctx あり → span ラベルが追加される', () => {
    const node = ui_checkbox({ ctx: ['同意する'] });
    const span = node.ctx[1];
    assert.ok(span, 'ctx[1] が存在する');
    assert.equal(span.tag, 'span');
    assert.deepEqual(span.ctx, ['同意する']);
  });

  test('ctx なし（デフォルト []）→ span が追加されない', () => {
    const node = ui_checkbox();
    assert.equal(node.ctx.length, 1, 'input のみで span はない');
  });

  test('ctx に複数要素を渡せる', () => {
    const node = ui_checkbox({ ctx: ['利用規約', 'に同意する'] });
    const span = node.ctx[1];
    assert.deepEqual(span.ctx, ['利用規約', 'に同意する']);
  });
});

describe('ui_checkbox: disabled', () => {

  test('disabled=true のとき class に ric-checkbox--disabled が付く', () => {
    assert.ok(ui_checkbox({ disabled: true }).class.includes('ric-checkbox--disabled'));
  });

  test('disabled=false のとき ric-checkbox--disabled が付かない', () => {
    assert.ok(!ui_checkbox({ disabled: false }).class.includes('disabled'));
  });

  test('disabled=true のとき input に disabled: true が含まれる', () => {
    const input = ui_checkbox({ disabled: true }).ctx[0];
    assert.equal(input.disabled, true);
  });

  test('disabled=false のとき input に disabled が含まれない', () => {
    const input = ui_checkbox({ disabled: false }).ctx[0];
    assert.ok(!Object.prototype.hasOwnProperty.call(input, 'disabled'));
  });
});

describe('ui_checkbox: onchange', () => {

  test('onchange を指定すると input ノードに含まれる', () => {
    const fn = () => {};
    const input = ui_checkbox({ onchange: fn }).ctx[0];
    assert.equal(input.onchange, fn);
  });

  test('onchange を省略すると input ノードに含まれない', () => {
    const input = ui_checkbox().ctx[0];
    assert.ok(!Object.prototype.hasOwnProperty.call(input, 'onchange'));
  });
});

describe('ui_checkbox: rest スプレッド', () => {
  test('onclick が label に透過される', () => {
    const fn = () => {};
    assert.equal(ui_checkbox({ onclick: fn }).onclick, fn);
  });
  test('id / data-* / aria-* が label に透過される', () => {
    const n = ui_checkbox({ id: 'cb1', 'data-x': '1', 'aria-label': 'L' });
    assert.equal(n.id, 'cb1');
    assert.equal(n['data-x'], '1');
    assert.equal(n['aria-label'], 'L');
  });
  test('class が ric-checkbox の後ろに連結される', () => {
    assert.equal(ui_checkbox({ class: 'my' }).class, 'ric-checkbox my');
  });
  test('disabled=true + class 連結', () => {
    assert.equal(
      ui_checkbox({ disabled: true, class: 'my' }).class,
      'ric-checkbox ric-checkbox--disabled my',
    );
  });
  test('rest で tag を上書きできない', () => {
    assert.equal(ui_checkbox({ tag: 'div' }).tag, 'label');
  });
});

// =====================================================================
// 2. DOM テスト：bind_checkbox
// =====================================================================

describe('bind_checkbox: 初期描画', () => {

  test('checked=true のとき input.checked が true になる', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ agreed: true }, target, s =>
      bind_checkbox(s, 'agreed'),
    );

    assert.equal(target.querySelector('input[type="checkbox"]').checked, true);
  });

  test('checked=false のとき input.checked が false になる', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ agreed: false }, target, s =>
      bind_checkbox(s, 'agreed'),
    );

    assert.equal(target.querySelector('input[type="checkbox"]').checked, false);
  });

  test('ctx でラベルテキストが span として描画される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ ok: false }, target, s =>
      bind_checkbox(s, 'ok', { ctx: ['利用規約に同意する'] }),
    );

    const span = target.querySelector('span');
    assert.ok(span, 'span が存在する');
    assert.equal(span.textContent, '利用規約に同意する');
  });

  test('ctx 省略のとき span が描画されない', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ flag: false }, target, s =>
      bind_checkbox(s, 'flag'),
    );

    assert.equal(target.querySelector('span'), null);
  });
});

describe('bind_checkbox: 双方向バインド', () => {

  test('チェックすると s[key] が boolean true になる', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM({ agreed: false }, target, s =>
      bind_checkbox(s, 'agreed'),
    );

    const el = target.querySelector('input[type="checkbox"]');
    el.checked = true;
    el.dispatchEvent(new dom.window.Event('change'));
    await flush_raf();

    assert.equal(panel.agreed, true);
    assert.equal(typeof panel.agreed, 'boolean');
  });

  test('チェックを外すと s[key] が boolean false になる', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM({ agreed: true }, target, s =>
      bind_checkbox(s, 'agreed'),
    );

    const el = target.querySelector('input[type="checkbox"]');
    el.checked = false;
    el.dispatchEvent(new dom.window.Event('change'));
    await flush_raf();

    assert.equal(panel.agreed, false);
    assert.equal(typeof panel.agreed, 'boolean');
  });

  test('panel 経由で state を変えると checked が再描画される', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM({ agreed: false }, target, s =>
      bind_checkbox(s, 'agreed'),
    );

    panel.agreed = true;
    await flush_raf();

    assert.equal(target.querySelector('input[type="checkbox"]').checked, true);
  });
});

describe('bind_checkbox: truthy/falsy 変換', () => {

  test('truthy 値（数値 1）は checked=true に変換される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ count: 1 }, target, s =>
      bind_checkbox(s, 'count'),
    );

    assert.equal(target.querySelector('input[type="checkbox"]').checked, true);
  });

  test('falsy 値（null）は checked=false に変換される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ val: null }, target, s =>
      bind_checkbox(s, 'val'),
    );

    assert.equal(target.querySelector('input[type="checkbox"]').checked, false);
  });
});
