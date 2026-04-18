// RicUI v0.2 — ui_input / bind_input テスト
//
// テスト方針:
//   1. 構造テスト  ── ui_input が正しい vdom ノードを返すか（純粋関数）
//   2. DOM テスト  ── bind_input が DOM と state を正しく結ぶか（jsdom）
//   3. リセット回帰テスト
//          value='' でも value キーを必ず含む修正の確認
//          state を '' にリセットすると el.value が '' になること

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_input }   = require('../ric_ui/control/ui_input');
const { bind_input } = require('../ric_ui/control/bind_input');

// jsdom 環境をテストごとに生成する
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

// rAF（setTimeout 0 代替）の完了を待つ
const flush_raf = () => new Promise(resolve => setTimeout(resolve, 10));

// =====================================================================
// 1. 構造テスト：ui_input の vdom ノード
// =====================================================================

describe('ui_input: vdom 構造', () => {

  test('デフォルト引数でノードが返る', () => {
    const node = ui_input();
    assert.equal(node.tag,   'input');
    assert.equal(node.class, 'ric-input');
  });

  test('type のデフォルトは text', () => {
    assert.equal(ui_input().type, 'text');
  });

  test('value キーは空文字のときも必ず含まれる（リセットバグ修正の保証）', () => {
    const node = ui_input({ value: '' });
    assert.ok(
      Object.prototype.hasOwnProperty.call(node, 'value'),
      'value: "" でも key が存在する',
    );
    assert.equal(node.value, '');
  });

  test('value に文字列を渡すと反映される', () => {
    assert.equal(ui_input({ value: 'hello' }).value, 'hello');
  });

  test('placeholder を指定するとノードに含まれる', () => {
    const node = ui_input({ placeholder: '名前を入力' });
    assert.equal(node.placeholder, '名前を入力');
  });

  test('placeholder を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_input(), 'placeholder'));
  });

  test('type を email に指定できる', () => {
    assert.equal(ui_input({ type: 'email' }).type, 'email');
  });

  test('disabled=true のとき disabled プロパティが含まれる', () => {
    assert.equal(ui_input({ disabled: true }).disabled, true);
  });

  test('disabled=false のとき disabled プロパティが含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_input({ disabled: false }), 'disabled'));
  });

  test('oninput を指定するとノードに含まれる', () => {
    const fn = () => {};
    assert.equal(ui_input({ oninput: fn }).oninput, fn);
  });

  test('oninput を省略するとノードに含まれない', () => {
    assert.ok(!Object.prototype.hasOwnProperty.call(ui_input(), 'oninput'));
  });
});

// =====================================================================
// rest スプレッド（ui_panel と同じ流儀：rest 先頭 → 計算済みが上書き）
// =====================================================================

describe('ui_input: rest スプレッド', () => {

  test('id / data-* / aria-* が透過される', () => {
    const n = ui_input({ id: 'in1', 'data-role': 'email', 'aria-label': 'Email' });
    assert.equal(n.id, 'in1');
    assert.equal(n['data-role'], 'email');
    assert.equal(n['aria-label'], 'Email');
  });

  // 基底クラスが消えないことを保証する回帰テスト（rest 末尾置きバグの再発防止）
  test('class が ric-input の後ろに連結される（基底クラスが消えない）', () => {
    assert.equal(ui_input({ class: 'my-input' }).class, 'ric-input my-input');
  });

  test('rest で tag を上書きできない', () => {
    assert.equal(ui_input({ tag: 'div' }).tag, 'input');
  });

  test('rest で type を上書きできない（明示引数が勝つ）', () => {
    assert.equal(ui_input({ type: 'password' }).type, 'password');
  });

  test('onchange が透過される（input 要素に直接付く）', () => {
    const fn = () => {};
    const n = ui_input({ onchange: fn });
    assert.equal(n.onchange, fn);
  });
});

// =====================================================================
// 2. DOM テスト：bind_input の初期描画と双方向バインド
// =====================================================================

describe('bind_input: 初期描画', () => {

  test('初期値が input.value に反映される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const state  = { name: 'Taro' };
    const target = dom.window.document.querySelector('#app');

    create_RicDOM(state, target, s =>
      bind_input(s, 'name'),
    );

    const el = target.querySelector('input');
    assert.ok(el, 'input 要素が存在する');
    assert.equal(el.value, 'Taro');
  });

  test('placeholder が input に反映される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ name: '' }, target, s =>
      bind_input(s, 'name', { placeholder: '名前を入力' }),
    );

    assert.equal(target.querySelector('input').placeholder, '名前を入力');
  });

  test('disabled=true が input に反映される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ val: '' }, target, s =>
      bind_input(s, 'val', { disabled: true }),
    );

    assert.equal(target.querySelector('input').disabled, true);
  });

  test('type=email が input に反映される', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM({ email: '' }, target, s =>
      bind_input(s, 'email', { type: 'email' }),
    );

    assert.equal(target.querySelector('input').type, 'email');
  });
});

describe('bind_input: 双方向バインド', () => {

  test('oninput イベントで s[key] が更新される', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const state  = { name: '' };
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(state, target, s =>
      bind_input(s, 'name'),
    );

    const el = target.querySelector('input');
    el.value = 'Alice';
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await flush_raf();

    assert.equal(panel.name, 'Alice');
  });

  test('panel 経由で state を変えると input.value が追従する', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const state  = { name: 'Taro' };
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(state, target, s =>
      bind_input(s, 'name'),
    );

    panel.name = 'Hanako';
    await flush_raf();

    assert.equal(target.querySelector('input').value, 'Hanako');
  });
});

// =====================================================================
// 3. リセット回帰テスト（バグ修正 v0.2.x の確認）
// =====================================================================

describe('bind_input: リセット（value="" への変更が DOM に反映される）', () => {

  test('文字を入力後に state を "" にすると input.value が空になる', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const state  = { name: '' };
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(state, target, s =>
      bind_input(s, 'name'),
    );

    // 文字を入力
    const el = target.querySelector('input');
    el.value = 'あああ';
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await flush_raf();

    assert.equal(panel.name, 'あああ', '入力後 state が更新されている');
    assert.equal(el.value,   'あああ', '入力後 DOM が更新されている');

    // リセット
    panel.name = '';
    await flush_raf();

    assert.equal(panel.name, '',    'reset 後 state が "" になっている');
    assert.equal(el.value,   '',    'reset 後 DOM input.value が "" になっている');
  });

  test('初期値あり → 編集 → リセットで input が空になる', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(
      { text: 'initial' },
      target,
      s => bind_input(s, 'text'),
    );

    const el = target.querySelector('input');
    assert.equal(el.value, 'initial');

    el.value = '変更後';
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await flush_raf();

    panel.text = '';
    await flush_raf();

    assert.equal(el.value, '');
  });

  test('email フィールドでも同様にリセットが機能する', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(
      { email: 'a@example.com' },
      target,
      s => bind_input(s, 'email', { type: 'email' }),
    );

    const el = target.querySelector('input');
    el.value = '||||';
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await flush_raf();

    panel.email = '';
    await flush_raf();

    assert.equal(el.value, '');
  });
});
