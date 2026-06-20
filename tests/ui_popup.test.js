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

  // chevron オプション (v0.3.28〜): label モードに開閉インジケータを足す
  it('chevron: true (label モード) → label の後ろに chevron アイコンが付く', () => {
    const inst = create_ui_popup();
    const root = inst({ label: '言語', chevron: true, ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.equal(btn.ctx.length, 2, 'label span + chevron の 2 要素');
    assert.equal(btn.ctx[0].tag, 'span');
    const chev = btn.ctx[1];
    assert.equal(chev.tag, 'svg');
    assert.match(chev.class, /ric-popup__chevron/);
    assert.doesNotMatch(chev.class, /--open/, '閉じている間は --open なし');
  });

  it('chevron: true + open → chevron に --open クラス (CSS で 180° 回転)', () => {
    const inst = create_ui_popup();
    inst._o = true;
    inst.__notify = () => {};
    const root = inst({ label: '言語', chevron: true, ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.match(btn.ctx[1].class, /ric-popup__chevron--open/);
  });

  it('chevron 省略 → label のみ (後方互換)', () => {
    const inst = create_ui_popup();
    const root = inst({ label: '言語', ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.equal(btn.ctx.length, 1, 'chevron 無しなら label span のみ');
  });

  it('chevron は icon モードには影響しない', () => {
    const inst = create_ui_popup();
    const root = inst({ icon: '⚙', chevron: true, ctx: [] });
    drain_portal();
    const btn = find_by_class(root, 'ric-popup__trigger')[0];
    assert.deepEqual(btn.ctx, ['⚙'], 'icon モードは chevron を付けない');
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

// ─────────────────────────────────────────────────────────────
// 開き方向の実測 (v0.3.27〜)
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: 開き方向の実 DOM 実測 (v0.3.27〜)', () => {

  // jsdom + rAF shim + offsetHeight モックで「実測フェーズ」を再現する。
  const setup = (trigger_rect, body_height, innerHeight = 800) => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body><button id="t"></button></body></html>');
    global.window   = dom.window;
    global.document = dom.window.document;
    global.getComputedStyle = dom.window.getComputedStyle;
    // rAF shim は setImmediate (setTimeout(0) は Node の timer phase 跨ぎで
    // 稀に starve する。collapse_box テストで確立した canon に合わせる)
    global.requestAnimationFrame = (cb) => setImmediate(cb);
    Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: innerHeight });
    // trigger の rect をモック
    const btn = document.getElementById('t');
    btn.getBoundingClientRect = () => trigger_rect;
    // popup body の offsetHeight をモック (querySelector で拾われる本体に効かせる)
    Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetHeight', {
      configurable: true, get() { return body_height; },
    });
    return { dom, btn };
  };
  const flush = (ms = 10) => new Promise((r) => setTimeout(r, ms));

  it('実測で本体が下に収まらなければ above に補正される', async () => {
    // trigger は画面下部 (bottom=780/800)、下の空きは 20px しかない。
    // ctx は 1 個のラッパー (= 旧実装なら 1*38+8=46px と過小評価 → below 誤判定)。
    // 実測 body = 300px なら above に開くべき。
    const { btn } = setup({ top: 760, bottom: 780, left: 100, right: 140, width: 40 }, 300);
    const p = create_ui_popup();
    p.__notify = () => {};
    const root = p({ icon: '⋯', ctx: [{ tag: 'div', ctx: ['wrapper with 4 items'] }] });
    drain_portal();
    const trigger = find_by_class(root, 'ric-popup__trigger')[0];

    trigger.onclick({ currentTarget: btn });
    // 開いた直後は measuring 中 (visibility:hidden)
    assert.equal(p._m, true, 'onclick 直後は実測フェーズ');

    await flush();   // rAF で実測 → 方向確定

    assert.equal(p._m, false, '実測完了で measuring 解除');
    assert.equal(p._d, 'above', '下に収まらないので above に補正される');
  });

  it('実測で本体が下に収まれば below のまま', async () => {
    // trigger は画面上部、下に十分な空き。body 100px。
    const { btn } = setup({ top: 50, bottom: 70, left: 100, right: 140, width: 40 }, 100);
    const p = create_ui_popup();
    p.__notify = () => {};
    const root = p({ icon: '⋯', ctx: [{ tag: 'div', ctx: ['x'] }] });
    drain_portal();
    const trigger = find_by_class(root, 'ric-popup__trigger')[0];

    trigger.onclick({ currentTarget: btn });
    await flush();

    assert.equal(p._d, 'below', '下に収まるので below');
    assert.equal(p._m, false);
  });

  it('measuring 中は body に visibility:hidden が付く', () => {
    const { btn } = setup({ top: 50, bottom: 70, left: 100, right: 140, width: 40 }, 100);
    const p = create_ui_popup();
    p.__notify = () => {};
    let root = p({ icon: '⋯', ctx: [{ tag: 'div', ctx: ['x'] }] });
    drain_portal();
    find_by_class(root, 'ric-popup__trigger')[0].onclick({ currentTarget: btn });
    // measuring 中の render を 1 回観測
    root = p({ icon: '⋯', ctx: [{ tag: 'div', ctx: ['x'] }] });
    const items = drain_portal();
    const body = items[1];
    assert.equal(body.style.visibility, 'hidden', 'measuring 中は hidden');
  });
});

// ─────────────────────────────────────────────────────────────
// ESC で閉じる (v0.3.27〜)
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: ESC キー (v0.3.27〜)', () => {

  const setup_jsdom = () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.window   = dom.window;
    global.document = dom.window.document;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    return dom;
  };

  it('開いている間に ESC で閉じアニメーションが始まる', () => {
    setup_jsdom();
    const p = create_ui_popup();
    let notified = 0;
    p.__notify = () => { notified++; };
    p._o = true;
    p({ icon: '≡', ctx: [{ tag: 'div', ctx: ['x'] }] });   // ESC ハンドラ bind
    drain_portal();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(p._c, true, 'ESC で closing 開始');
    assert.ok(notified > 0, 'ESC で再描画が走る');
  });

  it('閉じている時の ESC は無視される', () => {
    setup_jsdom();
    const p = create_ui_popup();
    p.__notify = () => {};
    p({ icon: '≡', ctx: [] });   // _o=false なので bind されない
    drain_portal();
    // ESC を投げても何も起きない (例外も出ない)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(p._c, false);
    assert.equal(p._o, false);
  });
});

// ─────────────────────────────────────────────────────────────
// close() が __notify を発火する (v0.3.27〜)
// ─────────────────────────────────────────────────────────────
describe('create_ui_popup: close() の __notify (v0.3.27〜)', () => {

  it('close() で safe_notify が発火する (dialog と挙動を揃える)', () => {
    const p = create_ui_popup();
    let notified = 0;
    p.__notify = () => { notified++; };
    p._o = true;
    p.close();
    assert.equal(p._o, false);
    assert.equal(p._c, false);
    assert.equal(notified, 1, 'close() で再描画が 1 回スケジュールされる');
  });
});
