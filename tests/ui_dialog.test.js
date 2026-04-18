'use strict';

// create_ui_dialog テスト
// VDOM 構造検査 + ポータルキュー検査 + __notify モックで
// uncontrolled / controlled 両モード・ESC キーを検証。

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_dialog } = require('../ric_ui');
const _portal = require('../ric_ui/popup/_page_portal_queue');

// ─────────────────────────────────────────────────────────────
// jsdom セットアップ（ESC テスト用）
// ─────────────────────────────────────────────────────────────
const setup_jsdom = () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(
    '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>',
  );
  global.window   = dom.window;
  global.document  = dom.window.document;
  global.Node      = dom.window.Node;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  return dom;
};

// ─────────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────────
const collect_nodes = (node, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const c of node) collect_nodes(c, out);
    return out;
  }
  out.push(node);
  if (Array.isArray(node.ctx)) {
    for (const child of node.ctx) collect_nodes(child, out);
  }
  return out;
};
const find_by_class = (root, cls) =>
  collect_nodes(root).filter(n => typeof n.class === 'string' && n.class.split(' ').includes(cls));

// ポータルをドレインして中身を返す。テスト後の残留を防ぐ。
const drain_portal = () => _portal.drain();

// ─────────────────────────────────────────────────────────────
// uncontrolled: trigger ボタン
// ─────────────────────────────────────────────────────────────
describe('create_ui_dialog: uncontrolled trigger', () => {

  it('デフォルトで trigger ボタンを返す', () => {
    const inst = create_ui_dialog();
    const btn = inst();
    drain_portal();
    assert.equal(btn.tag, 'button');
    assert.ok(btn.class.includes('ric-button'));
  });

  it('trigger_ctx でボタンラベルを指定', () => {
    const inst = create_ui_dialog();
    const btn = inst({ trigger_ctx: ['開く'] });
    drain_portal();
    assert.deepEqual(btn.ctx, ['開く']);
  });

  it('trigger_variant でボタンクラスを変更', () => {
    const inst = create_ui_dialog();
    const btn = inst({ trigger_variant: 'ghost' });
    drain_portal();
    assert.ok(btn.class.includes('ric-button--ghost'));
  });

  it('trigger_variant=default でベースクラスのみ', () => {
    const inst = create_ui_dialog();
    const btn = inst({ trigger_variant: 'default' });
    drain_portal();
    assert.equal(btn.class, 'ric-button');
  });
});

// ─────────────────────────────────────────────────────────────
// uncontrolled: open / close
// ─────────────────────────────────────────────────────────────
describe('create_ui_dialog: uncontrolled open/close', () => {

  it('初期状態で _o=false、ポータルは空', () => {
    const inst = create_ui_dialog();
    inst();
    const items = drain_portal();
    assert.equal(items.length, 0);
    assert.equal(inst._o, false);
  });

  it('inst.open() で _o=true になりポータルに積まれる', () => {
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    inst.open();
    assert.equal(inst._o, true);
    inst({ title: 'Test' });
    const items = drain_portal();
    assert.equal(items.length, 2); // overlay + dialog
  });

  it('inst.open() は既に開いているとき no-op', () => {
    const inst = create_ui_dialog();
    let count = 0;
    inst.__notify = () => { count++; };
    inst.open();
    const c1 = count;
    inst.open(); // 二重呼び出し
    assert.equal(count, c1); // __notify は呼ばれない
  });

  it('inst.close() でアニメーション開始（_c=true）', () => {
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    inst.open();
    inst.close();
    assert.equal(inst._c, true);
  });

  it('close 中のポータルに --out クラスが付く', () => {
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    inst.open();
    inst.close();
    inst({ title: 'Test' });
    const items = drain_portal();
    const overlay = items[0];
    const dialog  = items[1];
    assert.ok(overlay.class.includes('ric-dialog__overlay--out'));
    assert.ok(dialog.class.includes('ric-dialog--out'));
  });

  it('_on_anim_end 後に _o=false, _c=false', () => {
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    inst.open();
    inst.close();
    // render してから animationend をシミュレート
    inst({ title: 'Test' });
    const items = drain_portal();
    const dialog = items[1];
    dialog.onanimationend(); // _on_anim_end 呼び出し
    assert.equal(inst._o, false);
    assert.equal(inst._c, false);
  });
});

// ─────────────────────────────────────────────────────────────
// controlled: open prop
// ─────────────────────────────────────────────────────────────
describe('create_ui_dialog: controlled open', () => {

  it('open:true → ポータルあり・戻り値 null', () => {
    const inst = create_ui_dialog();
    const result = inst({ open: true, title: 'Test', on_close: () => {} });
    const items = drain_portal();
    assert.equal(result, null);
    assert.equal(items.length, 2);
  });

  it('open:false → ポータルなし・戻り値 null', () => {
    const inst = create_ui_dialog();
    const result = inst({ open: false, title: 'Test' });
    const items = drain_portal();
    assert.equal(result, null);
    assert.equal(items.length, 0);
  });

  it('open true→false で閉じアニメーション開始', () => {
    const inst = create_ui_dialog();
    // 1回目: open=true
    inst({ open: true, title: 'Test' });
    drain_portal();
    // 2回目: open=false → _c=true
    inst({ open: false, title: 'Test' });
    assert.equal(inst._c, true);
    const items = drain_portal();
    // アニメーション中なのでポータルにはまだ表示（--out クラス付き）
    assert.equal(items.length, 2);
    const dialog = items[1];
    assert.ok(dialog.class.includes('ric-dialog--out'));
  });

  it('閉じアニメーション完了後にポータルが空になる', () => {
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    // open=true → false → animationend
    inst({ open: true, title: 'Test' });
    drain_portal();
    inst({ open: false, title: 'Test' });
    const items = drain_portal();
    items[1].onanimationend(); // _on_anim_end
    assert.equal(inst._c, false);
    // 再 render → open=false, _c=false → ポータルなし
    inst({ open: false, title: 'Test' });
    const items2 = drain_portal();
    assert.equal(items2.length, 0);
  });

  it('open false→true で即座に表示（残留 _c をクリア）', () => {
    const inst = create_ui_dialog();
    // close アニメーション途中で再 open
    inst({ open: true, title: 'Test' });
    drain_portal();
    inst({ open: false, title: 'Test' });
    drain_portal();
    assert.equal(inst._c, true);
    // 再度 open=true
    inst({ open: true, title: 'Test' });
    assert.equal(inst._c, false);
    const items = drain_portal();
    assert.equal(items.length, 2);
    // --out クラスなし
    assert.ok(!items[1].class.includes('ric-dialog--out'));
  });

  it('controlled 時 inst._o は変更されない', () => {
    const inst = create_ui_dialog();
    inst({ open: true, title: 'Test' });
    drain_portal();
    assert.equal(inst._o, false); // _o は uncontrolled 用のまま
  });
});

// ─────────────────────────────────────────────────────────────
// controlled: on_close callback
// ─────────────────────────────────────────────────────────────
describe('create_ui_dialog: controlled on_close', () => {

  it('overlay click で on_close が呼ばれる', () => {
    const inst = create_ui_dialog();
    let called = false;
    inst({ open: true, title: 'Test', on_close: () => { called = true; } });
    const items = drain_portal();
    items[0].onclick(); // overlay click
    assert.equal(called, true);
  });

  it('✕ ボタン click で on_close が呼ばれる', () => {
    const inst = create_ui_dialog();
    let called = false;
    inst({ open: true, title: 'Test', on_close: () => { called = true; } });
    const items = drain_portal();
    const dialog = items[1];
    const close_btn = find_by_class(dialog, 'ric-dialog__close')[0];
    assert.ok(close_btn, 'close button should exist');
    close_btn.onclick();
    assert.equal(called, true);
  });

  it('inst.close() で on_close が呼ばれる', () => {
    const inst = create_ui_dialog();
    let called = false;
    inst({ open: true, title: 'Test', on_close: () => { called = true; } });
    drain_portal();
    inst.close();
    assert.equal(called, true);
  });

  it('on_close 呼出時に内部 _c は変更されない（親の判断を待つ）', () => {
    const inst = create_ui_dialog();
    inst({ open: true, title: 'Test', on_close: () => {} });
    drain_portal();
    inst.close();
    // controlled: _c は変更されない（親が open=false にしたとき初めて _c=true）
    assert.equal(inst._c, false);
  });
});

// ─────────────────────────────────────────────────────────────
// controlled: hybrid 禁止
// ─────────────────────────────────────────────────────────────
describe('create_ui_dialog: hybrid 禁止', () => {

  it('open + trigger_ctx → console.error', () => {
    const inst = create_ui_dialog();
    const errors = [];
    const orig = console.error;
    console.error = (...args) => { errors.push(args.join(' ')); };
    inst({ open: true, trigger_ctx: ['NG'], title: 'Test' });
    drain_portal();
    console.error = orig;
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes('open'));
    assert.ok(errors[0].includes('trigger_ctx'));
  });

  it('open + trigger_ctx でも戻り値は null（controlled 優先）', () => {
    const inst = create_ui_dialog();
    const orig = console.error;
    console.error = () => {};
    const result = inst({ open: false, trigger_ctx: ['NG'] });
    drain_portal();
    console.error = orig;
    assert.equal(result, null);
  });
});

// ─────────────────────────────────────────────────────────────
// inst.open() / controlled での no-op
// ─────────────────────────────────────────────────────────────
describe('create_ui_dialog: inst.open()', () => {

  it('uncontrolled: inst.open() で _o=true', () => {
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    inst.open();
    assert.equal(inst._o, true);
  });

  it('controlled mode 中は inst.open() が no-op', () => {
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    // controlled render で _cd=true にする
    inst({ open: false, title: 'Test' });
    drain_portal();
    inst.open();
    assert.equal(inst._o, false); // 変化なし
  });
});

// ─────────────────────────────────────────────────────────────
// ESC キー
// ─────────────────────────────────────────────────────────────
describe('create_ui_dialog: ESC キー', () => {

  it('open 時に ESC で _request_close が呼ばれる（uncontrolled）', () => {
    setup_jsdom();
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    inst.open();
    // render して ESC ハンドラを bind
    inst({ title: 'Test' });
    drain_portal();
    assert.equal(inst._eb, true, 'ESC handler should be bound');
    // ESC イベント発火
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
    assert.equal(inst._c, true, 'should start close animation');
  });

  it('open 時に ESC で on_close が呼ばれる（controlled）', () => {
    setup_jsdom();
    const inst = create_ui_dialog();
    let called = false;
    inst({ open: true, title: 'Test', on_close: () => { called = true; } });
    drain_portal();
    assert.equal(inst._eb, true);
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
    assert.equal(called, true);
  });

  it('closed 時に ESC ハンドラは unbind される', () => {
    setup_jsdom();
    const inst = create_ui_dialog();
    // open → ESC bind → close → ESC unbind
    inst.__notify = () => {};
    inst.open();
    inst({ title: 'Test' });
    drain_portal();
    assert.equal(inst._eb, true);
    // 完全に閉じる
    inst._o = false;
    inst._c = false;
    inst({ title: 'Test' });
    drain_portal();
    assert.equal(inst._eb, false, 'ESC handler should be unbound');
  });

  it('ESC 以外のキーでは close されない', () => {
    setup_jsdom();
    const inst = create_ui_dialog();
    inst.__notify = () => {};
    inst.open();
    inst({ title: 'Test' });
    drain_portal();
    const ev = new KeyboardEvent('keydown', { key: 'Enter' });
    document.dispatchEvent(ev);
    assert.equal(inst._c, false, 'Enter should not trigger close');
    assert.equal(inst._o, true, 'dialog should still be open');
  });
});
