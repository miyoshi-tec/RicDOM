'use strict';

// create_ui_popup テスト
// VDOM 構造検査 + ポータルキュー検査 + トリガーボタン onclick シミュレート。

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_popup } = require('../ric_ui');
const _portal = require('../ric_ui/popup/_page_portal_queue');
const { find_by_class } = require('./_helpers/dom_find');

const drain_portal = () => _portal.drain();

// ─────────────────────────────────────────────────────────────
// トリガー構造
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: トリガー構造', () => {

  it('引数なしで呼び出せる（default {} デフォルト引数）', () => {
    const inst = create_ui_popup();
    // インスタンス生成直後の inst() が例外を投げない
    assert.doesNotThrow(() => inst());
    drain_portal();
  });

  it('label/icon 未指定 → デフォルトアイコン ≡', () => {
    const inst = create_ui_popup();
    const root = inst({ ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.deepEqual(btn.ctx, ['≡']);
  });

  it('label モード → ラベルが span で入る', () => {
    const inst = create_ui_popup();
    const root = inst({ label: 'メニュー', ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.ok(btn.class.includes('ric-popup__trigger--label'));
    assert.equal(btn.ctx[0].tag, 'span');
    assert.deepEqual(btn.ctx[0].ctx, ['メニュー']);
  });

  it('icon モード → アイコン文字がそのまま入る', () => {
    const inst = create_ui_popup();
    const root = inst({ icon: '⚙', ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.ok(!btn.class.includes('ric-popup__trigger--label'));
    assert.deepEqual(btn.ctx, ['⚙']);
  });

  it('ghost: true → ghost クラスが付く', () => {
    const inst = create_ui_popup();
    const root = inst({ icon: '⋯', ghost: true, ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.ok(btn.class.includes('ric-popup__trigger--ghost'));
  });
});

// ─────────────────────────────────────────────────────────────
// 初期状態 / 閉じている状態
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: 初期状態', () => {

  it('_o=false で初期化される', () => {
    const inst = create_ui_popup();
    assert.equal(inst._o, false);
  });

  it('閉じているときはポータルに何も積まれない', () => {
    const inst = create_ui_popup();
    inst({ ctx: [{ tag: 'div', ctx: ['item'] }] });
    const items = drain_portal();
    assert.equal(items.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// 公開 API: close()
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: close() API', () => {

  it('close() で _o=false / _c=false が即座にリセット（アニメなし）', () => {
    const inst = create_ui_popup();
    inst._o = true;
    inst._c = true;
    inst.close();
    assert.equal(inst._o, false);
    assert.equal(inst._c, false);
  });
});

// ─────────────────────────────────────────────────────────────
// 開いた状態 (_o を直接 true にしてポータル検証)
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: 開いている状態のポータル', () => {

  it('_o=true で render → ポータルに overlay + body が積まれる', () => {
    const inst = create_ui_popup();
    inst._o = true;
    inst.__notify = () => {};
    inst({ icon: '≡', ctx: [{ tag: 'div', ctx: ['item'] }] });
    const items = drain_portal();
    assert.equal(items.length, 2, 'overlay + body');
  });

  it('ポータル本体に ctx が展開される', () => {
    const inst = create_ui_popup();
    inst._o = true;
    inst.__notify = () => {};
    inst({ icon: '≡', ctx: [{ tag: 'div', class: 'my-item', ctx: ['hello'] }] });
    const items = drain_portal();
    const body = items[1]; // [0] = overlay, [1] = body
    const my_items = find_by_class(body, 'my-item');
    assert.equal(my_items.length, 1);
  });

  it('閉じアニメーション中 (_c=true) は --out クラスが付く', () => {
    const inst = create_ui_popup();
    inst._o = true;
    inst._c = true;
    inst.__notify = () => {};
    inst({ icon: '≡', ctx: [] });
    const items = drain_portal();
    const body = items[1];
    assert.ok(body.class.includes('ric-popup__body--out'));
  });
});

// ─────────────────────────────────────────────────────────────
// 排他制御（_close_others: 1 つ開くと他が自動で閉じる）
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: 排他制御', () => {

  it('a を open すると、既に open の b が自動で閉じられる', () => {
    // 実際の onclick は getBoundingClientRect / window.innerHeight などを使うため
    // jsdom で DOM を用意する。
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body><button id="t"></button></body></html>');
    global.window   = dom.window;
    global.document = dom.window.document;
    global.getComputedStyle = dom.window.getComputedStyle;

    const a = create_ui_popup();
    const b = create_ui_popup();
    a.__notify = () => {};
    b.__notify = () => {};

    // b を開いた状態にしておく
    b._o = true;

    // a の trigger onclick を取得
    const a_root = a({ icon: '≡', ctx: [{ tag: 'div', ctx: ['item'] }] });
    drain_portal();
    const a_trigger = find_by_class(a_root, 'ric-popup__trigger')[0];

    // 実 DOM に用意したボタンを currentTarget として発火
    const btn = document.getElementById('t');
    a_trigger.onclick({ currentTarget: btn });

    assert.equal(b._o, false, 'b が自動で閉じられる');
    assert.equal(a._o, true,  'a は open になる');
  });
});
