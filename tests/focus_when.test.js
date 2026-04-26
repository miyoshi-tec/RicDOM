// focus_when ヘルパーテスト
// WeakMap による立ち上がりエッジ検知と disabled ガードを確認する。

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { focus_when } = require('../ric_ui/control/focus_when');

const setup_jsdom = () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window   = dom.window;
  global.document = dom.window.document;
  global.Node     = dom.window.Node;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  return dom;
};
const flush = () => new Promise((r) => setTimeout(r, 20)); // rAF 2 回分余裕

describe('focus_when', () => {

  test('el が null のとき何もしない（例外を投げない）', () => {
    assert.doesNotThrow(() => focus_when(null, true));
    assert.doesNotThrow(() => focus_when(undefined, true));
  });

  test('cond が false のとき focus されない', async () => {
    const dom = setup_jsdom();
    const el = dom.window.document.createElement('input');
    dom.window.document.body.appendChild(el);
    let focused = false;
    el.focus = () => { focused = true; };
    focus_when(el, false);
    await flush();
    assert.equal(focused, false);
  });

  test('初回 cond=true は focus する（false → true エッジ扱い）', async () => {
    const dom = setup_jsdom();
    const el = dom.window.document.createElement('input');
    dom.window.document.body.appendChild(el);
    let focused = false;
    el.focus = () => { focused = true; };
    focus_when(el, true);
    await flush();
    assert.equal(focused, true);
  });

  test('立ち下がりエッジ（true → false）では focus しない', async () => {
    const dom = setup_jsdom();
    const el = dom.window.document.createElement('input');
    dom.window.document.body.appendChild(el);
    // 一旦 true で焦点を当てた後、false に戻す
    focus_when(el, true);
    await flush();
    let focused = false;
    el.focus = () => { focused = true; };
    focus_when(el, false);
    await flush();
    assert.equal(focused, false);
  });

  test('連続 true の呼び出しでは 2 回目は焦点を当て直さない', async () => {
    const dom = setup_jsdom();
    const el = dom.window.document.createElement('input');
    dom.window.document.body.appendChild(el);
    let focus_count = 0;
    el.focus = () => { focus_count++; };
    focus_when(el, true);   // 1 回目: false → true エッジで focus
    await flush();
    focus_when(el, true);   // 2 回目: 変化なし → スキップ
    await flush();
    assert.equal(focus_count, 1);
  });

  test('false → true → false → true で 2 回 focus する', async () => {
    const dom = setup_jsdom();
    const el = dom.window.document.createElement('input');
    dom.window.document.body.appendChild(el);
    let focus_count = 0;
    el.focus = () => { focus_count++; };
    focus_when(el, true);   // 1 回目
    await flush();
    focus_when(el, false);
    await flush();
    focus_when(el, true);   // 2 回目
    await flush();
    assert.equal(focus_count, 2);
  });

  test('disabled な要素には focus しない', async () => {
    const dom = setup_jsdom();
    const el = dom.window.document.createElement('input');
    el.disabled = true;
    dom.window.document.body.appendChild(el);
    let focused = false;
    el.focus = () => { focused = true; };
    focus_when(el, true);
    await flush();
    assert.equal(focused, false);
  });
});
