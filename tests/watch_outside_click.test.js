// RicUI — watch_outside_click テスト
//
// 検証範囲:
//   1. document クリックで callback が呼ばれる
//   2. unsubscribe を呼ぶと callback が呼ばれなくなる
//   3. 複数回登録すると各 callback が独立に呼ばれる (1 callback 1 listener)
//   4. ui_inline_menu の onclick (stopPropagation) と組み合わせたとき、
//      menu 内クリックでは callback が走らない（契約のすり合わせ確認）

'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// jsdom セットアップ — watch_outside_click は document を直接触るので、
// require の前に document を用意する必要がある
const setup_jsdom = () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
  global.window   = dom.window;
  global.document = dom.window.document;
  global.Event    = dom.window.Event;
  return dom;
};

describe('watch_outside_click: 基本動作', () => {

  before(setup_jsdom);

  test('document クリックで callback が呼ばれる', () => {
    const { watch_outside_click } = require('../ric_ui/dom_helpers');
    let called = 0;
    const unsub = watch_outside_click(() => { called++; });

    document.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(called, 1);

    unsub();  // 後片付け
  });

  test('unsubscribe を呼ぶと callback が止まる', () => {
    const { watch_outside_click } = require('../ric_ui/dom_helpers');
    let called = 0;
    const unsub = watch_outside_click(() => { called++; });

    document.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(called, 1);

    unsub();
    document.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(called, 1, 'unsub 後はクリックしても呼ばれない');
  });

  test('複数 callback を登録すると各々独立に発火する', () => {
    const { watch_outside_click } = require('../ric_ui/dom_helpers');
    let a = 0, b = 0;
    const unsub_a = watch_outside_click(() => { a++; });
    const unsub_b = watch_outside_click(() => { b++; });

    document.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(a, 1);
    assert.equal(b, 1);

    unsub_a();
    document.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(a, 1, '解除した方は止まる');
    assert.equal(b, 2);

    unsub_b();
  });
});

describe('watch_outside_click: ui_inline_menu との連携', () => {

  before(setup_jsdom);

  test('inline-menu 内をクリックすると stopPropagation で document に届かない', () => {
    const { watch_outside_click } = require('../ric_ui/dom_helpers');
    const { ui_inline_menu } = require('../ric_ui/composite/ui_inline_menu');

    // DOM 上に inline-menu 相当の要素を 1 つ作る
    const menu_node = ui_inline_menu({ open: true, ctx: ['x'] });
    const div = document.createElement('div');
    div.className = menu_node.class;
    // onclick を実 DOM 要素に attach
    div.addEventListener('click', menu_node.onclick);
    document.body.appendChild(div);

    let called = 0;
    const unsub = watch_outside_click(() => { called++; });

    // menu 自身をクリック → onclick が stopPropagation → document に届かない
    div.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(called, 0, 'menu 内クリックは外クリックとして検知されない');

    // document を直接クリック → ちゃんと呼ばれる
    document.dispatchEvent(new window.Event('click', { bubbles: true }));
    assert.equal(called, 1, 'menu 外クリックは検知される');

    unsub();
    document.body.removeChild(div);
  });
});
