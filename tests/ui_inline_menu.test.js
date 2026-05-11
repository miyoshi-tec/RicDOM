// RicUI — ui_inline_menu テスト
//
// 検証範囲:
//   1. open=false で null を返す (render から消える)
//   2. open=true で div ノードを返し、position:absolute + anchor が style に出る
//   3. anchor の 4 方向すべてで style 文字列が正しい
//   4. onclick は e.stopPropagation() を呼ぶ（外クリック検知パターンの前提）
//   5. ctx / class / style 透過

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_inline_menu } = require('../ric_ui/composite/ui_inline_menu');

describe('ui_inline_menu: 開閉', () => {

  test('open=false のとき null を返す', () => {
    assert.equal(ui_inline_menu({ open: false }), null);
  });

  test('open 省略時 (default=false) も null', () => {
    assert.equal(ui_inline_menu(), null);
  });

  test('open=true で div ノードを返す', () => {
    const n = ui_inline_menu({ open: true });
    assert.equal(n.tag, 'div');
  });

  test('open=true で ric-inline-menu class が付く', () => {
    assert.equal(ui_inline_menu({ open: true }).class, 'ric-inline-menu');
  });
});

describe('ui_inline_menu: anchor', () => {

  test('anchor=br (default) は top:100%; right:0', () => {
    const n = ui_inline_menu({ open: true });
    assert.match(n.style, /top:100%/);
    assert.match(n.style, /right:0/);
  });

  test('anchor=bl は top:100%; left:0', () => {
    const n = ui_inline_menu({ open: true, anchor: 'bl' });
    assert.match(n.style, /top:100%/);
    assert.match(n.style, /left:0/);
  });

  test('anchor=tr は bottom:100%; right:0', () => {
    const n = ui_inline_menu({ open: true, anchor: 'tr' });
    assert.match(n.style, /bottom:100%/);
    assert.match(n.style, /right:0/);
  });

  test('anchor=tl は bottom:100%; left:0', () => {
    const n = ui_inline_menu({ open: true, anchor: 'tl' });
    assert.match(n.style, /bottom:100%/);
    assert.match(n.style, /left:0/);
  });

  test('知らない anchor は default(br) に fallback', () => {
    const n = ui_inline_menu({ open: true, anchor: 'xx' });
    assert.match(n.style, /top:100%/);
    assert.match(n.style, /right:0/);
  });

  test('position:absolute が必ず含まれる', () => {
    for (const a of ['br', 'bl', 'tr', 'tl']) {
      const n = ui_inline_menu({ open: true, anchor: a });
      assert.match(n.style, /position:absolute/, `anchor=${a}`);
    }
  });
});

describe('ui_inline_menu: 外クリック検知の前提', () => {

  test('onclick が定義されている (stopPropagation のため)', () => {
    const n = ui_inline_menu({ open: true });
    assert.equal(typeof n.onclick, 'function');
  });

  test('onclick は e.stopPropagation() を呼ぶ', () => {
    const n = ui_inline_menu({ open: true });
    let called = false;
    const fake_event = { stopPropagation: () => { called = true; } };
    n.onclick(fake_event);
    assert.equal(called, true,
      'menu 内クリックは document に bubble させない — outside-click 検知の前提');
  });
});

describe('ui_inline_menu: 透過', () => {

  test('ctx が透過される', () => {
    const child = { tag: 'span', ctx: ['x'] };
    const n = ui_inline_menu({ open: true, ctx: [child] });
    assert.deepEqual(n.ctx, [child]);
  });

  test('class が ric-inline-menu の後ろに連結される', () => {
    const n = ui_inline_menu({ open: true, class: 'my-menu' });
    assert.equal(n.class, 'ric-inline-menu my-menu');
  });

  test('style (string) が末尾に追加される', () => {
    const n = ui_inline_menu({ open: true, style: 'min-width:120px' });
    assert.match(n.style, /min-width:120px$/);
  });

  test('style (object) が k:v;k:v 形式で末尾に追加される', () => {
    const n = ui_inline_menu({ open: true, style: { 'min-width': '120px', 'max-width': '300px' } });
    assert.match(n.style, /min-width:120px/);
    assert.match(n.style, /max-width:300px/);
  });
});
