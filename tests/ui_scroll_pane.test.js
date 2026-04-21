'use strict';

// create_ui_scroll_pane テスト
// VDOM 構造、data-ric-sp 属性、scroll_to_top / scroll_to_bottom のステート遷移、
// jsdom 経由の DOM 要素判定。

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_scroll_pane } = require('../ric_ui');

const setup_jsdom = () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window   = dom.window;
  global.document = dom.window.document;
  global.Node     = dom.window.Node;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  return dom;
};

// ─────────────────────────────────────────────────────────────
// 基本構造
// ─────────────────────────────────────────────────────────────
describe('create_ui_scroll_pane: 基本構造', () => {

  it('ルート要素は div.ric-scroll-pane', () => {
    const inst = create_ui_scroll_pane();
    const node = inst();
    assert.equal(node.tag, 'div');
    assert.ok(node.class.includes('ric-scroll-pane'));
  });

  it('overflow-y:auto が style に含まれる', () => {
    const inst = create_ui_scroll_pane();
    const node = inst();
    assert.ok(String(node.style).includes('overflow-y:auto'));
  });

  it('ctx が要素にそのまま渡る', () => {
    const inst = create_ui_scroll_pane();
    const items = [{ tag: 'div', ctx: ['a'] }, { tag: 'div', ctx: ['b'] }];
    const node = inst({ ctx: items });
    assert.equal(node.ctx, items);
  });

  it('data-ric-sp 属性がインスタンス毎にユニーク', () => {
    const a = create_ui_scroll_pane();
    const b = create_ui_scroll_pane();
    assert.notEqual(a()['data-ric-sp'], b()['data-ric-sp']);
  });

  it('rest の class が基底クラスに連結される', () => {
    const inst = create_ui_scroll_pane();
    const node = inst({ class: 'my-extra' });
    assert.equal(node.class, 'ric-scroll-pane my-extra');
  });

  it('rest の style（文字列）が先頭に結合される', () => {
    const inst = create_ui_scroll_pane();
    const node = inst({ style: 'height: 400px' });
    assert.ok(String(node.style).includes('height: 400px'));
    assert.ok(String(node.style).includes('overflow-y:auto'));
  });

  it('rest で tag を上書きできない', () => {
    const inst = create_ui_scroll_pane();
    assert.equal(inst({ tag: 'section' }).tag, 'div');
  });
});

// ─────────────────────────────────────────────────────────────
// 公開 API（scroll_to_bottom / scroll_to_top）
// ─────────────────────────────────────────────────────────────
describe('create_ui_scroll_pane: 公開 API', () => {

  it('scroll_to_bottom() で _force_to = "bottom" になり __notify が呼ばれる', () => {
    const inst = create_ui_scroll_pane();
    let count = 0;
    inst.__notify = () => { count++; };
    inst.scroll_to_bottom();
    assert.equal(inst._force_to, 'bottom');
    assert.equal(count, 1);
  });

  it('scroll_to_top() で _force_to = "top" になる', () => {
    const inst = create_ui_scroll_pane();
    inst.__notify = () => {};
    inst.scroll_to_top();
    assert.equal(inst._force_to, 'top');
  });
});

// ─────────────────────────────────────────────────────────────
// スクロール追従ロジック（jsdom）
// ─────────────────────────────────────────────────────────────
describe('create_ui_scroll_pane: follow 判定（jsdom）', () => {

  it('初回 render（DOM 未存在）では follow_now=false', () => {
    setup_jsdom();
    const inst = create_ui_scroll_pane({ follow: 'bottom' });
    inst({ ctx: [] });
    assert.equal(inst._follow_now, false);
  });

  it('DOM 生成後、最下部にいれば follow_now=true（follow:bottom）', async () => {
    const dom = setup_jsdom();
    const inst = create_ui_scroll_pane({ follow: 'bottom', threshold: 10 });
    // DOM に要素を 1 個作り、data-ric-sp でマッチさせる
    const id = inst()['data-ric-sp'];
    const el = dom.window.document.createElement('div');
    el.setAttribute('data-ric-sp', id);
    // scrollHeight / scrollTop / clientHeight を差し替えて「最下部にいる」状況を作る
    Object.defineProperty(el, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 90,  configurable: true });
    el.scrollTop = 10;   // 100 - 10 - 90 = 0 → threshold=10 以内
    dom.window.document.body.appendChild(el);
    inst({ ctx: [] });
    assert.equal(inst._follow_now, true);
  });

  it('最上部から遠い時は follow_now=false（follow:bottom）', () => {
    const dom = setup_jsdom();
    const inst = create_ui_scroll_pane({ follow: 'bottom', threshold: 10 });
    const id = inst()['data-ric-sp'];
    const el = dom.window.document.createElement('div');
    el.setAttribute('data-ric-sp', id);
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 100,  configurable: true });
    el.scrollTop = 200;  // 1000 - 200 - 100 = 700 px → threshold=10 超
    dom.window.document.body.appendChild(el);
    inst({ ctx: [] });
    assert.equal(inst._follow_now, false);
  });

  it('follow:none は常に追従しない', () => {
    const dom = setup_jsdom();
    const inst = create_ui_scroll_pane({ follow: 'none' });
    const id = inst()['data-ric-sp'];
    const el = dom.window.document.createElement('div');
    el.setAttribute('data-ric-sp', id);
    Object.defineProperty(el, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
    el.scrollTop = 0;
    dom.window.document.body.appendChild(el);
    inst({ ctx: [] });
    assert.equal(inst._follow_now, false);
  });
});
