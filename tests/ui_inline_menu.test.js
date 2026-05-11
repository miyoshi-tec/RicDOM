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

  test('anchor=br (default) は top:100% + right:0', () => {
    const s = ui_inline_menu({ open: true }).style;
    assert.equal(s.top, '100%');
    assert.equal(s.right, 0);
  });

  test('anchor=bl は top:100% + left:0', () => {
    const s = ui_inline_menu({ open: true, anchor: 'bl' }).style;
    assert.equal(s.top, '100%');
    assert.equal(s.left, 0);
  });

  test('anchor=tr は bottom:100% + right:0', () => {
    const s = ui_inline_menu({ open: true, anchor: 'tr' }).style;
    assert.equal(s.bottom, '100%');
    assert.equal(s.right, 0);
  });

  test('anchor=tl は bottom:100% + left:0', () => {
    const s = ui_inline_menu({ open: true, anchor: 'tl' }).style;
    assert.equal(s.bottom, '100%');
    assert.equal(s.left, 0);
  });

  test('知らない anchor は default(br) に fallback', () => {
    const s = ui_inline_menu({ open: true, anchor: 'xx' }).style;
    assert.equal(s.top, '100%');
    assert.equal(s.right, 0);
  });

  test('position:absolute と z-index が必ず含まれる', () => {
    for (const a of ['br', 'bl', 'tr', 'tl']) {
      const s = ui_inline_menu({ open: true, anchor: a }).style;
      assert.equal(s.position, 'absolute', `anchor=${a}`);
      assert.equal(s.zIndex,   10,         `anchor=${a}`);
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

  test('style (object) が base / anchor / 呼び出し側追加でマージされる', () => {
    const n = ui_inline_menu({
      open: true,
      style: { minWidth: '120px', maxWidth: '300px' },
    });
    // base
    assert.equal(n.style.position, 'absolute');
    // anchor (br)
    assert.equal(n.style.top, '100%');
    // 呼び出し側追加
    assert.equal(n.style.minWidth, '120px');
    assert.equal(n.style.maxWidth, '300px');
  });

  test('style (string 後方互換) も object に正規化されて受け入れられる', () => {
    // 公式は object 推奨だが、string 渡しも壊さない（後方互換）
    const n = ui_inline_menu({ open: true, style: 'min-width:120px' });
    assert.equal(n.style['min-width'], '120px');
  });
});
