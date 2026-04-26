'use strict';

// create_ui_accordion テスト
// VDOM 構造、default_open、multi モード、onclick トグル挙動。

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_accordion } = require('../ric_ui');
const { find_by_class } = require('./_helpers/dom_find');

// ─────────────────────────────────────────────────────────────
// 基本構造
// ─────────────────────────────────────────────────────────────
describe('create_ui_accordion: 基本構造', () => {

  it('ルート要素は ric-accordion', () => {
    const inst = create_ui_accordion();
    const root = inst({ items: [] });
    assert.equal(root.tag, 'div');
    assert.ok(root.class.includes('ric-accordion'));
  });

  it('items の数だけ __item が並ぶ', () => {
    const inst = create_ui_accordion();
    const root = inst({ items: [
      { id: 'a', title: 'A', ctx: [] },
      { id: 'b', title: 'B', ctx: [] },
      { id: 'c', title: 'C', ctx: [] },
    ]});
    const items = find_by_class(root, 'ric-accordion__item');
    assert.equal(items.length, 3);
  });

  it('各 item は header / body を持つ', () => {
    const inst = create_ui_accordion();
    const root = inst({ items: [{ id: 'a', title: 'A', ctx: [] }] });
    const headers = find_by_class(root, 'ric-accordion__header');
    const bodies  = find_by_class(root, 'ric-accordion__body');
    assert.equal(headers.length, 1);
    assert.equal(bodies.length, 1);
  });

  it('title が header 内の span に入る', () => {
    const inst = create_ui_accordion();
    const root = inst({ items: [{ id: 'a', title: 'タイトル', ctx: [] }] });
    const titles = find_by_class(root, 'ric-accordion__title');
    assert.deepEqual(titles[0].ctx, ['タイトル']);
  });

  it('item ctx が body-inner に入る', () => {
    const inst = create_ui_accordion();
    const content = { tag: 'p', ctx: ['本文'] };
    const root = inst({ items: [{ id: 'a', title: 'A', ctx: [content] }] });
    const inner = find_by_class(root, 'ric-accordion__body-inner')[0];
    assert.equal(inner.ctx[0], content);
  });

  it('単一 VDOM (配列でない) ctx もラップされる', () => {
    const inst = create_ui_accordion();
    const single = { tag: 'p', ctx: ['single'] };
    const root = inst({ items: [{ id: 'a', title: 'A', ctx: single }] });
    const inner = find_by_class(root, 'ric-accordion__body-inner')[0];
    assert.ok(Array.isArray(inner.ctx));
    assert.equal(inner.ctx[0], single);
  });
});

// ─────────────────────────────────────────────────────────────
// default_open
// ─────────────────────────────────────────────────────────────
describe('create_ui_accordion: default_open', () => {

  it('default_open なしなら全部閉じ', () => {
    const inst = create_ui_accordion();
    const root = inst({ items: [
      { id: 'a', title: 'A', ctx: [] },
      { id: 'b', title: 'B', ctx: [] },
    ]});
    const open_headers = find_by_class(root, 'ric-accordion__header--open');
    assert.equal(open_headers.length, 0);
  });

  it('default_open: { a: true } → a だけ open クラス', () => {
    const inst = create_ui_accordion({ default_open: { a: true } });
    const root = inst({ items: [
      { id: 'a', title: 'A', ctx: [] },
      { id: 'b', title: 'B', ctx: [] },
    ]});
    const open_headers = find_by_class(root, 'ric-accordion__header--open');
    const open_bodies  = find_by_class(root, 'ric-accordion__body--open');
    assert.equal(open_headers.length, 1);
    assert.equal(open_bodies.length, 1);
  });

  it('inst._om が初期状態を保持する', () => {
    const inst = create_ui_accordion({ default_open: { a: true, b: false } });
    assert.deepEqual(inst._om, { a: true, b: false });
  });
});

// ─────────────────────────────────────────────────────────────
// onclick トグル
// ─────────────────────────────────────────────────────────────
describe('create_ui_accordion: トグル', () => {

  it('header クリックで _om[id] がトグル', () => {
    const inst = create_ui_accordion();
    inst.__notify = () => {};
    const root = inst({ items: [{ id: 'a', title: 'A', ctx: [] }] });
    const header = find_by_class(root, 'ric-accordion__header')[0];
    header.onclick();
    assert.equal(inst._om.a, true);
    // 再度 render + click で false に戻す
    const root2 = inst({ items: [{ id: 'a', title: 'A', ctx: [] }] });
    const header2 = find_by_class(root2, 'ric-accordion__header')[0];
    header2.onclick();
    assert.equal(inst._om.a, false);
  });

  it('onclick で __notify が呼ばれる', () => {
    const inst = create_ui_accordion();
    let count = 0;
    inst.__notify = () => { count++; };
    const root = inst({ items: [{ id: 'a', title: 'A', ctx: [] }] });
    find_by_class(root, 'ric-accordion__header')[0].onclick();
    assert.ok(count >= 1);
  });
});

// ─────────────────────────────────────────────────────────────
// multi モード
// ─────────────────────────────────────────────────────────────
describe('create_ui_accordion: multi モード', () => {

  it('multi: true（デフォルト）→ 複数同時展開可', () => {
    const inst = create_ui_accordion();
    inst.__notify = () => {};
    const items = [
      { id: 'a', title: 'A', ctx: [] },
      { id: 'b', title: 'B', ctx: [] },
    ];
    const root1 = inst({ items });
    find_by_class(root1, 'ric-accordion__header')[0].onclick(); // open a
    const root2 = inst({ items });
    find_by_class(root2, 'ric-accordion__header')[1].onclick(); // open b
    assert.equal(inst._om.a, true);
    assert.equal(inst._om.b, true);
  });

  it('multi: false → 他のパネルは強制的に閉じる', () => {
    const inst = create_ui_accordion({ default_open: { a: true } });
    inst.__notify = () => {};
    const items = [
      { id: 'a', title: 'A', ctx: [] },
      { id: 'b', title: 'B', ctx: [] },
    ];
    const root = inst({ items, multi: false });
    // b を開く → a は閉じる
    find_by_class(root, 'ric-accordion__header')[1].onclick();
    assert.equal(inst._om.a, false);
    assert.equal(inst._om.b, true);
  });
});
