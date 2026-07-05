'use strict';

// create_ui_splitter テスト
// VDOM 構造検査 + 内部状態操作で controlled / uncontrolled 両モードを検証。
// on_resize_end (v0.3.33〜) は実 DOM イベントが要るため jsdom マウントで検証する。

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_splitter } = require('../ric_ui');
const { find_by_class } = require('./_helpers/dom_find');
const { setup_jsdom, flush } = require('./_helpers/jsdom_env');

// ─────────────────────────────────────────────────────────────
// 基本構造
// ─────────────────────────────────────────────────────────────
describe('create_ui_splitter: 基本構造', () => {

  it('ルート要素は ric-splitter', () => {
    const inst = create_ui_splitter();
    const root = inst();
    assert.equal(root.tag, 'div');
    assert.ok(root.class.includes('ric-splitter'));
  });

  it('side=left → horizontal クラス', () => {
    const inst = create_ui_splitter({ side: 'left' });
    const root = inst();
    assert.ok(root.class.includes('ric-splitter--horizontal'));
  });

  it('side=top → vertical クラス', () => {
    const inst = create_ui_splitter({ side: 'top' });
    const root = inst();
    assert.ok(root.class.includes('ric-splitter--vertical'));
  });

  it('子要素は 3 つ（side / divider / main）', () => {
    const inst = create_ui_splitter();
    const root = inst({ side: { ctx: ['SIDE'] }, main: { ctx: ['MAIN'] } });
    assert.equal(root.ctx.length, 3);
  });

  it('side=left → 順序: side, divider, main', () => {
    const inst = create_ui_splitter({ side: 'left' });
    const root = inst();
    const [a, b, c] = root.ctx;
    assert.ok(a.class.includes('ric-splitter__side'));
    assert.ok(b.class.includes('ric-splitter__divider'));
    assert.ok(c.class.includes('ric-splitter__main'));
  });

  it('side=right → 順序: main, divider, side', () => {
    const inst = create_ui_splitter({ side: 'right' });
    const root = inst();
    const [a, b, c] = root.ctx;
    assert.ok(a.class.includes('ric-splitter__main'));
    assert.ok(b.class.includes('ric-splitter__divider'));
    assert.ok(c.class.includes('ric-splitter__side'));
  });

  it('side パネルの flex-basis が size に一致', () => {
    const inst = create_ui_splitter({ side: 'left', size: 300 });
    const root = inst();
    const side_panel = find_by_class(root, 'ric-splitter__side')[0];
    assert.equal(side_panel.style.flexBasis, '300px');
  });

  it('collapsible:true → 折り畳みボタンあり', () => {
    const inst = create_ui_splitter({ collapsible: true });
    const root = inst();
    const btns = find_by_class(root, 'ric-splitter__collapse-btn');
    assert.equal(btns.length, 1);
  });

  it('collapsible:false → 折り畳みボタンなし', () => {
    const inst = create_ui_splitter({ collapsible: false });
    const root = inst();
    const btns = find_by_class(root, 'ric-splitter__collapse-btn');
    assert.equal(btns.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// uncontrolled collapse
// ─────────────────────────────────────────────────────────────
describe('create_ui_splitter: uncontrolled collapse', () => {

  it('初期状態は collapsed() === false', () => {
    const inst = create_ui_splitter();
    assert.equal(inst.collapsed(), false);
  });

  it('toggle() で collapsed が反転する', () => {
    const inst = create_ui_splitter();
    let notify_count = 0;
    inst.__notify = () => { notify_count++; };
    inst.toggle();
    assert.equal(inst.collapsed(), true);
    assert.equal(notify_count, 1);
  });

  it('toggle() で _tg=true（アニメーション有効化）', () => {
    const inst = create_ui_splitter();
    inst.__notify = () => {};
    inst.toggle();
    assert.equal(inst._tg, true);
  });

  it('collapsed 時: side パネルの flex-basis=0、--collapsed クラス', () => {
    const inst = create_ui_splitter({ side: 'left', size: 240 });
    inst.__notify = () => {};
    inst.toggle();
    const root = inst();
    const side_panel = find_by_class(root, 'ric-splitter__side')[0];
    assert.equal(side_panel.style.flexBasis, '0px');
    assert.ok(side_panel.class.includes('ric-splitter__side--collapsed'));
    assert.ok(root.class.includes('ric-splitter--collapsed'));
  });
});

// ─────────────────────────────────────────────────────────────
// controlled collapse
// ─────────────────────────────────────────────────────────────
describe('create_ui_splitter: controlled collapse', () => {

  it('collapsed:true → collapsed クラスが付く', () => {
    const inst = create_ui_splitter({ side: 'left', size: 240 });
    const root = inst({ collapsed: true, side: { ctx: [] }, main: { ctx: [] } });
    assert.ok(root.class.includes('ric-splitter--collapsed'));
    const side_panel = find_by_class(root, 'ric-splitter__side')[0];
    assert.equal(side_panel.style.flexBasis, '0px');
  });

  it('collapsed:false → 通常表示', () => {
    const inst = create_ui_splitter({ side: 'left', size: 240 });
    const root = inst({ collapsed: false, side: { ctx: [] }, main: { ctx: [] } });
    assert.ok(!root.class.includes('ric-splitter--collapsed'));
    const side_panel = find_by_class(root, 'ric-splitter__side')[0];
    assert.equal(side_panel.style.flexBasis, '240px');
  });

  it('collapsed 変化で _tg=true（トランジション有効化）', () => {
    const inst = create_ui_splitter({ side: 'left', size: 240 });
    // 初回 render: collapsed=false → _cl=false（変化なし、_tg=false）
    inst({ collapsed: false, side: { ctx: [] }, main: { ctx: [] } });
    assert.equal(inst._tg, false);
    // 2回目: collapsed=true → _cl が変化 → _tg=true
    inst({ collapsed: true, side: { ctx: [] }, main: { ctx: [] } });
    assert.equal(inst._tg, true);
    assert.equal(inst._cl, true);
  });

  it('on_collapse_change: ボタンクリックで callback 呼出', () => {
    const inst = create_ui_splitter({ side: 'left', collapsible: true });
    let received = null;
    inst({ collapsed: false, on_collapse_change: (v) => { received = v; },
           side: { ctx: [] }, main: { ctx: [] } });
    // 折り畳みボタンの onclick を取得して呼ぶ
    const root = inst({ collapsed: false, on_collapse_change: (v) => { received = v; },
                        side: { ctx: [] }, main: { ctx: [] } });
    const btn = find_by_class(root, 'ric-splitter__collapse-btn')[0];
    assert.ok(btn, 'collapse button should exist');
    btn.onclick();
    // collapsed=false の逆 → true を通知
    assert.equal(received, true);
  });

  it('controlled 時 toggle() は内部 _cl を変更しない', () => {
    const inst = create_ui_splitter({ side: 'left' });
    let received = null;
    inst({ collapsed: false, on_collapse_change: (v) => { received = v; },
           side: { ctx: [] }, main: { ctx: [] } });
    const cl_before = inst._cl;
    inst.toggle();
    assert.equal(inst._cl, cl_before, '_cl should not change in controlled mode');
    assert.equal(received, true, 'on_collapse_change should have been called');
  });

  it('collapsed が同値なら _tg は変化しない', () => {
    const inst = create_ui_splitter({ side: 'left' });
    inst({ collapsed: true, side: { ctx: [] }, main: { ctx: [] } });
    // _tg は最初の変化で true になっている（false → true）
    assert.equal(inst._tg, true);
    // transitionend をシミュレート
    inst._tg = false;
    // 同じ値で再 render → _tg は false のまま
    inst({ collapsed: true, side: { ctx: [] }, main: { ctx: [] } });
    assert.equal(inst._tg, false);
  });
});

// ─────────────────────────────────────────────────────────────
// バグ修正: set_size
// ─────────────────────────────────────────────────────────────
describe('create_ui_splitter: set_size バグ修正', () => {

  it('set_size() が例外を投げない', () => {
    const inst = create_ui_splitter({ size: 200, min: 50, max: 400 });
    assert.doesNotThrow(() => inst.set_size(300));
  });

  it('set_size() で _sz が更新される', () => {
    const inst = create_ui_splitter({ size: 200, min: 50, max: 400 });
    inst.set_size(300);
    assert.equal(inst.get_size(), 300);
  });

  it('set_size() で min/max clamp が効く', () => {
    const inst = create_ui_splitter({ size: 200, min: 50, max: 400 });
    inst.set_size(10);
    assert.equal(inst.get_size(), 50);
    inst.set_size(999);
    assert.equal(inst.get_size(), 400);
  });

  it('max=null のとき上限なし', () => {
    const inst = create_ui_splitter({ size: 200, min: 50, max: null });
    inst.set_size(9999);
    assert.equal(inst.get_size(), 9999);
  });
});

// ─────────────────────────────────────────────────────────────
// バグ修正: transitionend
// ─────────────────────────────────────────────────────────────
describe('create_ui_splitter: transitionend バグ修正', () => {

  it('transitionend handler が __notify を呼ぶ', () => {
    const inst = create_ui_splitter({ side: 'left' });
    let notify_count = 0;
    inst.__notify = () => { notify_count++; };
    // toggle で _tg=true にする
    inst.toggle();
    const before = notify_count;
    // render して ontransitionend を取得
    const root = inst();
    const side_panel = find_by_class(root, 'ric-splitter__side')[0];
    assert.ok(side_panel.ontransitionend, 'ontransitionend should be set when _tg is true');
    // handler 呼び出し
    side_panel.ontransitionend();
    assert.equal(inst._tg, false, '_tg should be reset');
    assert.ok(notify_count > before, '__notify should have been called');
  });

  it('_tg=false のとき ontransitionend は undefined', () => {
    const inst = create_ui_splitter({ side: 'left' });
    const root = inst();
    const side_panel = find_by_class(root, 'ric-splitter__side')[0];
    assert.equal(side_panel.ontransitionend, undefined);
  });
});

// ─────────────────────────────────────────────────────────────
// on_resize_end (v0.3.33〜、Rancha 要望)
// 実 DOM イベント (mousedown → mousemove → mouseup) が要るため jsdom マウントで検証する。
// jsdom は getBoundingClientRect が常に 0 を返すが、_on_mouse_down はドラッグ量を
// clientX/clientY の差分で計算するだけで getBoundingClientRect には依存しない
// (実装確認済み) ので、MouseEvent の clientX/clientY を直接指定すれば成立する。
// ─────────────────────────────────────────────────────────────
describe('create_ui_splitter: on_resize_end (v0.3.33〜)', () => {

  // divider 要素をマウント済み DOM から取得
  const get_divider = () => document.querySelector('[data-ric-role="splitter-divider"]');

  const dispatch_mouse = (type, opts = {}) => {
    const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, ...opts });
    document.dispatchEvent(ev);
  };

  const dispatch_mousedown_on = (el, opts = {}) => {
    const ev = new window.MouseEvent('mousedown', { bubbles: true, cancelable: true, ...opts });
    el.dispatchEvent(ev);
  };

  it('ドラッグ (mousedown→mousemove→mouseup) で on_resize_end が1回・数値で呼ばれる', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    setup_jsdom();

    let calls = [];
    const split = create_ui_splitter({
      side: 'left', size: 200, min: 50, max: 400,
      on_resize_end: (sz) => calls.push(sz),
    });

    const handle = create_RicDOM('#app', {
      render: () => split({ side: { ctx: ['SIDE'] }, main: { ctx: ['MAIN'] } }),
    });
    await flush();

    const divider = get_divider();
    assert.ok(divider, 'divider element should exist in mounted DOM');

    dispatch_mousedown_on(divider, { clientX: 100, clientY: 0 });
    dispatch_mouse('mousemove', { clientX: 150, clientY: 0 });
    dispatch_mouse('mouseup', { clientX: 150, clientY: 0 });

    assert.equal(calls.length, 1, 'on_resize_end は1回だけ呼ばれる');
    assert.equal(typeof calls[0], 'number', 'on_resize_end の引数は数値');

    handle._internal.destroy?.();
  });

  it('mousemove なしの mousedown→mouseup でも1回呼ばれる（変化なしドラッグ）', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    setup_jsdom();

    let calls = [];
    const split = create_ui_splitter({
      side: 'left', size: 200,
      on_resize_end: (sz) => calls.push(sz),
    });

    const handle = create_RicDOM('#app', {
      render: () => split({ side: { ctx: ['SIDE'] }, main: { ctx: ['MAIN'] } }),
    });
    await flush();

    const divider = get_divider();
    dispatch_mousedown_on(divider, { clientX: 100, clientY: 0 });
    dispatch_mouse('mouseup', { clientX: 100, clientY: 0 });

    assert.equal(calls.length, 1, 'mousemove が無くても mouseup で1回呼ばれる');
    assert.equal(calls[0], 200, 'サイズが変化していなければ元の size がそのまま渡る');

    handle._internal.destroy?.();
  });

  it('ドラッグしなければ (マウント直後) 呼ばれない', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    setup_jsdom();

    let calls = [];
    const split = create_ui_splitter({
      side: 'left', size: 200,
      on_resize_end: (sz) => calls.push(sz),
    });

    const handle = create_RicDOM('#app', {
      render: () => split({ side: { ctx: ['SIDE'] }, main: { ctx: ['MAIN'] } }),
    });
    await flush();

    assert.equal(calls.length, 0, 'ドラッグしていないので呼ばれない');

    handle._internal.destroy?.();
  });

  it('on_resize_end 未指定でもドラッグがエラーなく動く（後方互換）', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    setup_jsdom();

    // on_resize_end を渡さない
    const split = create_ui_splitter({ side: 'left', size: 200, min: 50, max: 400 });

    const handle = create_RicDOM('#app', {
      render: () => split({ side: { ctx: ['SIDE'] }, main: { ctx: ['MAIN'] } }),
    });
    await flush();

    const divider = get_divider();
    assert.doesNotThrow(() => {
      dispatch_mousedown_on(divider, { clientX: 100, clientY: 0 });
      dispatch_mouse('mousemove', { clientX: 150, clientY: 0 });
      dispatch_mouse('mouseup', { clientX: 150, clientY: 0 });
    });

    handle._internal.destroy?.();
  });

  it('collapse ボタンのクリックでは呼ばれない', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    setup_jsdom();

    let calls = [];
    const split = create_ui_splitter({
      side: 'left', size: 200, collapsible: true,
      on_resize_end: (sz) => calls.push(sz),
    });

    // split を state トップレベルに置き __notify を自動注入させる
    // (collapse トグルは safe_notify を発火するため、警告なしで再描画させたい)
    const handle = create_RicDOM('#app', {
      split,
      render: (s) => s.split({ side: { ctx: ['SIDE'] }, main: { ctx: ['MAIN'] } }),
    });
    await flush();

    const toggle_btn = document.querySelector('[data-ric-role="splitter-toggle"]');
    assert.ok(toggle_btn, 'collapse button should exist');

    toggle_btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await flush();

    assert.equal(calls.length, 0, 'collapse トグルでは on_resize_end は呼ばれない');

    handle._internal.destroy?.();
  });
});
