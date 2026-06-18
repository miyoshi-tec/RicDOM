// RicUI — ui_icon テスト (v0.3.28〜)
//
// 1. VDOM 構造テスト (純関数として戻り値を検査)
// 2. jsdom レンダーテスト (SVG namespace / viewBox の大文字保持を確認)

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_icon } = require('../ric_ui/control/ui_icon');

// テスト用 descriptor
const CHECK = { s: 2, p: 'M20 6 9 17l-5-5' };               // stroke (Lucide 系)
const HEART = { p: 'M12 21 3 12a5 5 0 0 1 9-3 5 5 0 0 1 9 3z' }; // fill (solid 系)
const MULTI = { s: 2, p: ['M4 4h16', 'M4 12h16', 'M4 20h16'] };  // 複数 path

// =====================================================================
// 1. 構造テスト
// =====================================================================

describe('ui_icon: 基本構造', () => {

  test('svg ノードを返す', () => {
    assert.equal(ui_icon(CHECK).tag, 'svg');
  });

  test('viewBox は既定 0 0 24 24', () => {
    assert.equal(ui_icon(CHECK).viewBox, '0 0 24 24');
  });

  test('descriptor.v で viewBox を上書きできる', () => {
    assert.equal(ui_icon({ v: '0 0 16 16', p: 'M0 0' }).viewBox, '0 0 16 16');
  });

  test('class は ric-icon を含む', () => {
    assert.match(ui_icon(CHECK).class, /\bric-icon\b/);
  });

  test('path が ctx に展開される (単一)', () => {
    const n = ui_icon(CHECK);
    assert.equal(n.ctx.length, 1);
    assert.equal(n.ctx[0].tag, 'path');
    assert.equal(n.ctx[0].d, 'M20 6 9 17l-5-5');
  });

  test('複数 path (配列) が複数の path ノードになる', () => {
    const n = ui_icon(MULTI);
    assert.equal(n.ctx.length, 3);
    assert.ok(n.ctx.every((c) => c.tag === 'path'));
    assert.equal(n.ctx[1].d, 'M4 12h16');
  });

  test('空 descriptor でも落ちず ctx は空配列', () => {
    const n = ui_icon();
    assert.equal(n.tag, 'svg');
    assert.deepEqual(n.ctx, []);
  });
});

describe('ui_icon: stroke / fill モード', () => {

  test('descriptor.s ありは stroke モード (fill:none, stroke:currentColor)', () => {
    const n = ui_icon(CHECK);
    assert.equal(n.fill, 'none');
    assert.equal(n.stroke, 'currentColor');
    assert.equal(n['stroke-width'], 2);
    assert.equal(n['stroke-linecap'], 'round');
    assert.equal(n['stroke-linejoin'], 'round');
  });

  test('descriptor.s 無しは fill モード (fill:currentColor, stroke 無し)', () => {
    const n = ui_icon(HEART);
    assert.equal(n.fill, 'currentColor');
    assert.equal(n.stroke, undefined);
    assert.equal(n['stroke-width'], undefined);
  });

  test('strokeWidth で descriptor.s を上書きできる', () => {
    assert.equal(ui_icon(CHECK, { strokeWidth: 1.5 })['stroke-width'], 1.5);
  });

  test('strokeWidth を渡すと fill descriptor でも stroke モードになる', () => {
    const n = ui_icon(HEART, { strokeWidth: 2 });
    assert.equal(n.fill, 'none');
    assert.equal(n.stroke, 'currentColor');
    assert.equal(n['stroke-width'], 2);
  });
});

describe('ui_icon: size', () => {

  test('既定 size は 1em (font-size 追従)', () => {
    const n = ui_icon(CHECK);
    assert.equal(n.style.width, '1em');
    assert.equal(n.style.height, '1em');
  });

  test('数値 size は px に変換される', () => {
    const n = ui_icon(CHECK, { size: 16 });
    assert.equal(n.style.width, '16px');
    assert.equal(n.style.height, '16px');
  });

  test('CSS 文字列 size はそのまま使われる', () => {
    const n = ui_icon(CHECK, { size: '1.25rem' });
    assert.equal(n.style.width, '1.25rem');
  });

  test('size は opts.style.width より優先される', () => {
    const n = ui_icon(CHECK, { size: 20, style: { width: '999px', opacity: 0.5 } });
    assert.equal(n.style.width, '20px');
    assert.equal(n.style.opacity, 0.5, 'style の他プロパティは保持される');
  });
});

describe('ui_icon: アクセシビリティ (label)', () => {

  test('label あり → role=img + aria-label、aria-hidden なし', () => {
    const n = ui_icon(CHECK, { label: '完了' });
    assert.equal(n.role, 'img');
    assert.equal(n['aria-label'], '完了');
    assert.equal(n['aria-hidden'], undefined);
  });

  test('label 省略 → aria-hidden=true、role なし (装飾)', () => {
    const n = ui_icon(CHECK);
    assert.equal(n['aria-hidden'], 'true');
    assert.equal(n.role, undefined);
    assert.equal(n['aria-label'], undefined);
  });
});

describe('ui_icon: spin / class / rest 透過', () => {

  test('spin:true で class に ric-icon--spin が付く', () => {
    assert.match(ui_icon(CHECK, { spin: true }).class, /\bric-icon--spin\b/);
  });

  test('spin 省略時は ric-icon--spin が付かない', () => {
    assert.doesNotMatch(ui_icon(CHECK).class, /ric-icon--spin/);
  });

  test('class が透過される (ric-icon の後ろに連結)', () => {
    const n = ui_icon(CHECK, { class: 'my-ic' });
    assert.match(n.class, /\bric-icon\b/);
    assert.match(n.class, /\bmy-ic\b/);
  });

  test('rest 属性 (data-*) が透過される', () => {
    assert.equal(ui_icon(CHECK, { 'data-id': 'x' })['data-id'], 'x');
  });
});

// =====================================================================
// 2. jsdom レンダーテスト (SVG namespace + viewBox 大文字保持)
// =====================================================================

describe('ui_icon: 実 DOM レンダー (SVG)', () => {

  const setup = () => {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
    global.window   = dom.window;
    global.document = dom.window.document;
    global.Node     = dom.window.Node;
    global.HTMLElement = dom.window.HTMLElement;
    global.requestAnimationFrame = (cb) => setImmediate(cb);
  };
  const flush = () => new Promise((r) => setTimeout(r, 10));

  test('svg が SVG namespace で生成され viewBox / path が正しく出る', async () => {
    setup();
    const { create_RicDOM } = require('../src/ricdom');
    create_RicDOM('#app', {
      render: () => ui_icon(CHECK, { size: 20, label: '完了' }),
    });
    await flush();

    const svg = document.querySelector('svg');
    assert.ok(svg, 'svg が描画される');
    assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg', 'SVG namespace');
    // viewBox は大文字を保持していること (setAttribute はケース保持)
    assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(svg.getAttribute('aria-label'), '完了');
    assert.equal(svg.getAttribute('role'), 'img');
    assert.equal(svg.style.width, '20px');

    const path = svg.querySelector('path');
    assert.ok(path, 'path が子に存在する');
    assert.equal(path.namespaceURI, 'http://www.w3.org/2000/svg', 'path も SVG namespace');
    assert.equal(path.getAttribute('d'), 'M20 6 9 17l-5-5');
  });
});
