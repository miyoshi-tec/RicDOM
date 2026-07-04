// RicUI — bind_range / bind_color / ui_tabs / bind_tabs の不足テスト
//
// 問題: ui_range/ui_color 本体はテスト済みだが bind_range/bind_color は
// 未検証。ui_tabs は属性 smoke のみで挙動 (active 切替 / onchange) 未検証。
// bind_tabs はテストがゼロ。
//
// 実装 (ric_ui/control/bind_range.js, bind_color.js,
// ric_ui/composite/ui_tabs.js, bind_tabs.js) を読んで確認した現在の挙動を
// そのまま固定する (期待値を推測で書かない)。

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { bind_range, bind_color, ui_tabs, bind_tabs } = require('../ric_ui');

// =====================================================================
// bind_range
// =====================================================================

describe('bind_range', () => {
  // ui_range の value/oninput は外側ラッパー div ではなく内部 input (ctx[0]) に掛かる
  // (rest スプレッド契約の隔離契約と同じ流儀)。

  test('oninput で s[key] に数値 (parseFloat 済み) が入る', () => {
    const s = { volume: 10 };
    const node = bind_range(s, 'volume', { min: 0, max: 100 });
    node.ctx[0].oninput({ target: { value: '42' } });
    assert.equal(s.volume, 42);
    assert.equal(typeof s.volume, 'number');
  });

  test('value は s[key] を反映する', () => {
    const s = { volume: 30 };
    const node = bind_range(s, 'volume', { min: 0, max: 100 });
    assert.equal(node.ctx[0].value, '30');
  });

  test('s[key] が未設定なら options.min (既定 0) が使われる', () => {
    const s = {};
    const node = bind_range(s, 'volume', { min: 5, max: 100 });
    assert.equal(node.ctx[0].value, '5');
  });
});

// =====================================================================
// bind_color
// =====================================================================

describe('bind_color', () => {
  // ui_color の value/oninput も外側ラッパー div ではなく内部 picker input (ctx[0]) に掛かる

  test('oninput で s[key] に文字列がそのまま入る', () => {
    const s = { bg: '#000000' };
    const node = bind_color(s, 'bg');
    node.ctx[0].oninput({ target: { value: '#ff0000' } });
    assert.equal(s.bg, '#ff0000');
    assert.equal(typeof s.bg, 'string');
  });

  test('value は s[key] を反映する', () => {
    const s = { bg: '#123456' };
    const node = bind_color(s, 'bg');
    assert.equal(node.ctx[0].value, '#123456');
  });

  test('s[key] が未設定なら既定 #000000 が使われる', () => {
    const s = {};
    const node = bind_color(s, 'bg');
    assert.equal(node.ctx[0].value, '#000000');
  });
});

// =====================================================================
// ui_tabs
// =====================================================================

describe('ui_tabs', () => {
  const items = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
  ];

  test('タブバーに button が items 数だけ生成される', () => {
    const node = ui_tabs({ items, active: 'a' });
    const tab_bar = node.ctx[0];
    assert.equal(tab_bar.ctx.length, 2);
    assert.ok(tab_bar.ctx.every(b => b.tag === 'button'));
  });

  test('active タブに --active クラスが付く', () => {
    const node = ui_tabs({ items, active: 'a' });
    const [tab_a, tab_b] = node.ctx[0].ctx;
    assert.ok(tab_a.class.includes('ric-tabs__tab--active'));
    assert.ok(!tab_b.class.includes('ric-tabs__tab--active'));
  });

  test('非 active タブの onclick で onchange(key) が呼ばれる', () => {
    let called = null;
    const node = ui_tabs({ items, active: 'a', onchange: (k) => { called = k; } });
    const tab_b = node.ctx[0].ctx[1];
    tab_b.onclick();
    assert.equal(called, 'b');
  });

  test('同じタブ (active) を再クリックしても onchange は呼ばれない', () => {
    let called = false;
    const node = ui_tabs({ items, active: 'a', onchange: () => { called = true; } });
    const tab_a = node.ctx[0].ctx[0];
    tab_a.onclick();
    assert.equal(called, false);
  });
});

// =====================================================================
// bind_tabs
// =====================================================================

describe('bind_tabs', () => {
  const items = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
  ];

  test('タブ onclick 相当の呼び出しで s[key] が更新される', () => {
    const s = { tab: 'a' };
    const node = bind_tabs(s, 'tab', { items });
    const tab_b = node.ctx[0].ctx[1];
    tab_b.onclick();
    assert.equal(s.tab, 'b');
  });

  test('active は s[key] を反映する', () => {
    const s = { tab: 'b' };
    const node = bind_tabs(s, 'tab', { items });
    const [tab_a, tab_b] = node.ctx[0].ctx;
    assert.ok(!tab_a.class.includes('ric-tabs__tab--active'));
    assert.ok(tab_b.class.includes('ric-tabs__tab--active'));
  });
});
