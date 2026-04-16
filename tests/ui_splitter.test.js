'use strict';

// create_ui_splitter テスト
// VDOM 構造検査 + 内部状態操作で controlled / uncontrolled 両モードを検証。

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_splitter } = require('../ric_ui');

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
    assert.ok(side_panel.style.includes('flex-basis:300px'));
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
    assert.ok(side_panel.style.includes('flex-basis:0px'));
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
    assert.ok(side_panel.style.includes('flex-basis:0px'));
  });

  it('collapsed:false → 通常表示', () => {
    const inst = create_ui_splitter({ side: 'left', size: 240 });
    const root = inst({ collapsed: false, side: { ctx: [] }, main: { ctx: [] } });
    assert.ok(!root.class.includes('ric-splitter--collapsed'));
    const side_panel = find_by_class(root, 'ric-splitter__side')[0];
    assert.ok(side_panel.style.includes('flex-basis:240px'));
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
