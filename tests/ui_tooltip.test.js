'use strict';

// create_ui_tooltip テスト
// ホバー挙動（onmouseenter/leave で _o 切替）+ ポータル内容検証。

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { create_ui_tooltip } = require('../ric_ui');
const _portal = require('../ric_ui/popup/_page_portal_queue');
const { find_by_class } = require('./_helpers/dom_find');

const drain_portal = () => _portal.drain();

// ─────────────────────────────────────────────────────────────
// 基本構造
// ─────────────────────────────────────────────────────────────
describe('create_ui_tooltip: 基本構造', () => {

  it('トリガー wrapper は span.ric-tooltip', () => {
    const inst = create_ui_tooltip();
    const root = inst({ content: 'hint', ctx: [{ tag: 'button', ctx: ['btn'] }] });
    drain_portal();
    assert.equal(root.tag, 'span');
    assert.ok(root.class.includes('ric-tooltip'));
  });

  it('ctx がトリガー要素として埋め込まれる', () => {
    const inst = create_ui_tooltip();
    const btn = { tag: 'button', ctx: ['btn'] };
    const root = inst({ content: 'hint', ctx: [btn] });
    drain_portal();
    assert.deepEqual(root.ctx, [btn]);
  });

  it('onmouseenter / onmouseleave ハンドラが付く', () => {
    const inst = create_ui_tooltip();
    const root = inst({ content: 'hint', ctx: [] });
    drain_portal();
    assert.equal(typeof root.onmouseenter, 'function');
    assert.equal(typeof root.onmouseleave, 'function');
  });
});

// ─────────────────────────────────────────────────────────────
// 初期状態・閉じている状態
// ─────────────────────────────────────────────────────────────
describe('create_ui_tooltip: 初期状態', () => {

  it('_o=false で初期化', () => {
    const inst = create_ui_tooltip();
    assert.equal(inst._o, false);
  });

  it('_o=false のときポータルに何も積まれない', () => {
    const inst = create_ui_tooltip();
    inst({ content: 'hint', ctx: [] });
    const items = drain_portal();
    assert.equal(items.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// 表示中のポータル内容
// ─────────────────────────────────────────────────────────────
describe('create_ui_tooltip: 表示中', () => {

  it('_o=true で render → ポータルに 1 要素（popup）積まれる', () => {
    const inst = create_ui_tooltip();
    inst._o = true;
    inst._d = 'top';
    inst.__notify = () => {};
    inst({ content: 'hint', ctx: [] });
    const items = drain_portal();
    assert.equal(items.length, 1);
    assert.ok(items[0].class.includes('ric-tooltip__popup'));
  });

  it('方向クラスが dir に応じて付く', () => {
    for (const dir of ['top', 'bottom', 'right', 'left']) {
      const inst = create_ui_tooltip();
      inst._o = true;
      inst._d = dir;
      inst.__notify = () => {};
      inst({ content: 'hint', ctx: [] });
      const items = drain_portal();
      assert.ok(items[0].class.includes('ric-tooltip__popup--' + dir),
        `dir=${dir} should produce ric-tooltip__popup--${dir}`);
    }
  });

  it('content が文字列 → span でラップされる', () => {
    const inst = create_ui_tooltip();
    inst._o = true;
    inst._d = 'top';
    inst.__notify = () => {};
    inst({ content: 'ヘルプ', ctx: [] });
    const items = drain_portal();
    const popup_body = items[0].ctx[0];
    assert.equal(popup_body.tag, 'span');
    assert.deepEqual(popup_body.ctx, ['ヘルプ']);
  });

  it('content が VDOM オブジェクト → そのまま埋め込まれる', () => {
    const inst = create_ui_tooltip();
    inst._o = true;
    inst._d = 'top';
    inst.__notify = () => {};
    const custom = { tag: 'div', class: 'custom', ctx: ['rich'] };
    inst({ content: custom, ctx: [] });
    const items = drain_portal();
    assert.equal(items[0].ctx[0], custom);
  });
});

// ─────────────────────────────────────────────────────────────
// onmouseleave で閉じる
// ─────────────────────────────────────────────────────────────
describe('create_ui_tooltip: ホバー終了', () => {

  it('onmouseleave で _o=false になる', () => {
    const inst = create_ui_tooltip();
    inst._o = true;
    let notify_count = 0;
    inst.__notify = () => { notify_count++; };
    const root = inst({ content: 'hint', ctx: [] });
    drain_portal();
    root.onmouseleave();
    assert.equal(inst._o, false);
    assert.ok(notify_count > 0);
  });
});
