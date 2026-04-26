// RicUI v0.2 — ui_textarea / bind_textarea テスト
//
// テスト方針:
//   1. 構造テスト   ── VDOM ノードが正しく組まれるか（純粋関数）
//   2. rest 契約    ── 既存の ui_input と同じ流儀の rest スプレッド
//   3. auto_resize  ── handler が合成され、oninput 呼出時に計算が走るか
//   4. bind_textarea ── state と双方向バインド（jsdom）

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_textarea   } = require('../ric_ui/control/ui_textarea');
const { bind_textarea } = require('../ric_ui/control/bind_textarea');
const { run_rest_spread_contract } = require('./_helpers/rest_spread_contract');

const setup_jsdom = () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
  global.window      = dom.window;
  global.document    = dom.window.document;
  global.Node        = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  return dom;
};
const flush_raf = () => new Promise(r => setTimeout(r, 10));

// ─────────────────────────────────────────────────────────────
// 構造
// ─────────────────────────────────────────────────────────────

describe('ui_textarea: 基本構造', () => {

  test('tag は textarea', () => {
    assert.equal(ui_textarea().tag, 'textarea');
  });

  test('デフォルト class は ric-textarea', () => {
    assert.equal(ui_textarea().class, 'ric-textarea');
  });

  test('value / placeholder / rows が反映される', () => {
    const n = ui_textarea({ value: 'hi', placeholder: '入力', rows: 4 });
    assert.equal(n.value, 'hi');
    assert.equal(n.placeholder, '入力');
    assert.equal(n.rows, 4);
  });

  test('disabled を渡すと disabled: true が付く', () => {
    const n = ui_textarea({ disabled: true });
    assert.equal(n.disabled, true);
  });

  test('maxlength が反映される', () => {
    assert.equal(ui_textarea({ maxlength: 100 }).maxlength, 100);
  });

  test('onkeydown が透過する', () => {
    const fn = () => {};
    assert.equal(ui_textarea({ onkeydown: fn }).onkeydown, fn);
  });
});

// ─────────────────────────────────────────────────────────────
// rest 契約（共通）
// ─────────────────────────────────────────────────────────────

run_rest_spread_contract({
  name: 'ui_textarea', factory: ui_textarea,
  expected_tag: 'textarea', base_class: 'ric-textarea',
});

// ─────────────────────────────────────────────────────────────
// auto_resize
// ─────────────────────────────────────────────────────────────

describe('ui_textarea: auto_resize', () => {

  test('auto_resize.min_rows が rows に反映される', () => {
    const n = ui_textarea({ auto_resize: { min_rows: 2, max_rows: 5 } });
    assert.equal(n.rows, 2);
  });

  test('auto_resize 指定時は oninput ハンドラが自動で付く', () => {
    const n = ui_textarea({ auto_resize: { min_rows: 1 } });
    assert.equal(typeof n.oninput, 'function');
  });

  test('auto_resize 指定 + 外部 oninput → 両方呼ばれる', () => {
    setup_jsdom();
    let called_with = null;
    const n = ui_textarea({
      auto_resize: { min_rows: 1, max_rows: 3 },
      oninput: (e) => { called_with = e.target.value; },
    });
    const fake_el = document.createElement('textarea');
    fake_el.value = 'hello';
    // インデックスで直接値を与える（jsdom の scrollHeight は 0 でも例外なく動く）
    n.oninput({ target: fake_el });
    assert.equal(called_with, 'hello');
  });

  test('auto_resize なしのとき oninput を外部指定しなければハンドラは付かない', () => {
    const n = ui_textarea();
    assert.equal(n.oninput, undefined);
  });
});

// ─────────────────────────────────────────────────────────────
// bind_textarea（双方向バインド）
// ─────────────────────────────────────────────────────────────

describe('bind_textarea: 双方向バインド', () => {

  test('初期値が value に反映される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM(target, { memo: 'hello',
      render: s => bind_textarea(s, 'memo'),
    });

    assert.equal(target.querySelector('textarea').value, 'hello');
  });

  test('入力で s[key] が更新される', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(target, { memo: '',
      render: s => bind_textarea(s, 'memo'),
    });
    const el = target.querySelector('textarea');
    el.value = 'xxx';
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await flush_raf();
    assert.equal(panel.memo, 'xxx');
  });

  test('state を書き換えると textarea.value が追従する', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(target, { memo: 'a',
      render: s => bind_textarea(s, 'memo'),
    });
    panel.memo = 'b';
    await flush_raf();
    assert.equal(target.querySelector('textarea').value, 'b');
  });

  test('options を透過する（auto_resize 等）', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM(target, { memo: '',
      render: s => bind_textarea(s, 'memo', { auto_resize: { min_rows: 3 } }),
    });
    assert.equal(Number(target.querySelector('textarea').getAttribute('rows')), 3);
  });
});
