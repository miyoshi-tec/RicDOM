'use strict';

// create_ui_toast テスト
// show() によるアイテム追加、ポータル構造、自動消去（fake timer）、手動 close。

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_toast } = require('../ric_ui');
const _portal = require('../ric_ui/popup/_page_portal_queue');
const { find_by_class } = require('./_helpers/dom_find');

// setTimeout をファイル全体でスタブして実タイマーを予約しない
// （テスト終了後のコールバック発火を防ぎ、テスト時間を短縮する）。
// 「setTimeout が呼ばれたか」を検証する duration テスト群は内部で別途
// スタブを掛け直す。
let _original_setTimeout;
before(() => {
  _original_setTimeout = global.setTimeout;
  global.setTimeout = () => 0; // no-op fake handle
});
after(() => { global.setTimeout = _original_setTimeout; });

const drain_portal = () => _portal.drain();

// ─────────────────────────────────────────────────────────────
// 基本挙動
// ─────────────────────────────────────────────────────────────
describe('create_ui_toast: 基本挙動', () => {

  it('inst() は null を返す（副作用のみ）', () => {
    const inst = create_ui_toast();
    const result = inst();
    drain_portal();
    assert.equal(result, null);
  });

  it('引数なしで呼び出せる', () => {
    const inst = create_ui_toast();
    assert.doesNotThrow(() => inst());
    drain_portal();
  });

  it('初期状態は _it = []', () => {
    const inst = create_ui_toast();
    assert.deepEqual(inst._it, []);
  });

  it('アイテムが無いときはポータルに何も積まれない', () => {
    const inst = create_ui_toast();
    inst();
    const items = drain_portal();
    assert.equal(items.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// show() で追加
// ─────────────────────────────────────────────────────────────
describe('create_ui_toast: show()', () => {

  it('show(msg) で _it に 1 件追加', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('保存しました');
    assert.equal(inst._it.length, 1);
    assert.equal(inst._it[0].msg, '保存しました');
    assert.equal(inst._it[0].type, 'default');
  });

  it('show() で __notify が呼ばれる', () => {
    const inst = create_ui_toast();
    let count = 0;
    inst.__notify = () => { count++; };
    inst.show('hi');
    assert.ok(count >= 1);
  });

  it('show(msg, { type }) で type が反映される', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    for (const type of ['success', 'error', 'warning', 'info']) {
      inst.show('x', { type });
    }
    assert.equal(inst._it.length, 4);
    assert.deepEqual(inst._it.map(i => i.type), ['success', 'error', 'warning', 'info']);
  });

  it('show() を複数回 → id がインクリメントされる', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('a');
    inst.show('b');
    inst.show('c');
    const ids = inst._it.map(i => i.id);
    assert.equal(new Set(ids).size, 3, 'ids are unique');
  });
});

// ─────────────────────────────────────────────────────────────
// ポータル構造
// ─────────────────────────────────────────────────────────────
describe('create_ui_toast: ポータル構造', () => {

  it('アイテムがあるとき container がポータルに積まれる', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('hello');
    inst();
    const items = drain_portal();
    assert.equal(items.length, 1);
    assert.ok(items[0].class.includes('ric-toast__container'));
  });

  it('container 内にアイテム数ぶんの ric-toast__item が入る', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('a'); inst.show('b'); inst.show('c');
    inst();
    const items = drain_portal();
    const toast_items = find_by_class(items[0], 'ric-toast__item');
    assert.equal(toast_items.length, 3);
  });

  it('type クラスが --{type} 形式で付く（default は variant 修飾を付けない）', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('ok', { type: 'success' });
    inst.show('plain');
    inst();
    const items = drain_portal();
    const toast_items = find_by_class(items[0], 'ric-toast__item');
    // success は --success が付く
    assert.ok(toast_items[0].class.includes('ric-toast__item--success'));
    // default は ric-toast__item--{type} の variant クラスがまったく含まれない
    const plain_variants = toast_items[1].class.split(' ')
      .filter(c => c.startsWith('ric-toast__item--') && c !== 'ric-toast__item--in');
    assert.deepEqual(plain_variants, [], 'default は variant 修飾子を持たない');
  });

  it('✕ ボタンが各アイテムに付く', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('x');
    inst();
    const items = drain_portal();
    const closes = find_by_class(items[0], 'ric-toast__close');
    assert.equal(closes.length, 1);
    assert.equal(typeof closes[0].onclick, 'function');
  });
});

// ─────────────────────────────────────────────────────────────
// close とアニメーション
// ─────────────────────────────────────────────────────────────
describe('create_ui_toast: close', () => {

  it('✕ クリックで item._c=true になる', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('x');
    inst();
    const items = drain_portal();
    const close = find_by_class(items[0], 'ric-toast__close')[0];
    close.onclick();
    assert.equal(inst._it[0]._c, true);
  });

  it('閉じ中は --out クラスが付く', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('x');
    inst._it[0]._c = true;
    inst();
    const items = drain_portal();
    const toast_items = find_by_class(items[0], 'ric-toast__item');
    assert.ok(toast_items[0].class.includes('ric-toast__item--out'));
  });

  it('閉じアニメーション終了で _it から除去される', () => {
    const inst = create_ui_toast();
    inst.__notify = () => {};
    inst.show('x');
    inst._it[0]._c = true;
    inst();
    const items = drain_portal();
    const toast_items = find_by_class(items[0], 'ric-toast__item');
    toast_items[0].onanimationend();
    assert.equal(inst._it.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// 自動消去（duration）
// ─────────────────────────────────────────────────────────────
describe('create_ui_toast: duration', () => {

  // setTimeout をスタブして「呼ばれたか」だけを検証する。
  // 実 timer は予約しない（テスト終了後のコールバック実行を防ぐ）。
  const _with_stubbed_setTimeout = (fn) => {
    const original = global.setTimeout;
    let called_with = null;
    global.setTimeout = (cb, ms) => { called_with = { cb, ms }; return 0; };
    try { fn(() => called_with); }
    finally { global.setTimeout = original; }
  };

  it('duration: 0 のとき setTimeout が呼ばれない（自動消去なし）', () => {
    _with_stubbed_setTimeout((get_call) => {
      const inst = create_ui_toast();
      inst.__notify = () => {};
      inst.show('永続', { type: 'error', duration: 0 });
      assert.equal(get_call(), null);
    });
  });

  it('duration: 3000 のとき setTimeout(..., 3000) が呼ばれる', () => {
    _with_stubbed_setTimeout((get_call) => {
      const inst = create_ui_toast();
      inst.__notify = () => {};
      inst.show('一時', { duration: 3000 });
      const call = get_call();
      assert.ok(call);
      assert.equal(call.ms, 3000);
      assert.equal(typeof call.cb, 'function');
    });
  });

  it('duration デフォルト（未指定）は 3000ms', () => {
    _with_stubbed_setTimeout((get_call) => {
      const inst = create_ui_toast();
      inst.__notify = () => {};
      inst.show('default');
      const call = get_call();
      assert.ok(call);
      assert.equal(call.ms, 3000);
    });
  });
});
