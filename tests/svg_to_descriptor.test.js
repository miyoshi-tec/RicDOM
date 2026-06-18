// RicDOM — svg_to_descriptor 変換器テスト (v0.3.28〜)
//
// アイコン SVG 文字列 → ui_icon descriptor { v?, s?, p } の変換を検証する。
// path 以外の要素 (line/polyline/polygon/rect/circle/ellipse) が path に
// 厳密変換されること、stroke/fill 判定、正準化 (既定値省略) を確認する。

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { svg_to_descriptor } = require('../docs/icons/svg_to_descriptor');

// Lucide スタイルの SVG ラッパ (fill=none, stroke=currentColor, stroke-width=2)
const lucide = (inner, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${attrs}>${inner}</svg>`;

describe('svg_to_descriptor: 基本 (path / stroke)', () => {

  test('単一 path の Lucide SVG → { p } (v も s も既定なので省略)', () => {
    const d = svg_to_descriptor(lucide('<path d="M20 6 9 17l-5-5"/>'));
    assert.deepEqual(d, { p: 'M20 6 9 17l-5-5' });
  });

  test('複数 path → p は配列、出現順を保つ', () => {
    const d = svg_to_descriptor(lucide('<path d="M5 12h14"/><path d="M12 5v14"/>'));
    assert.deepEqual(d.p, ['M5 12h14', 'M12 5v14']);
  });

  test('viewBox が既定でなければ v を保持', () => {
    const d = svg_to_descriptor(lucide('<path d="M0 0"/>', ' ').replace('0 0 24 24', '0 0 16 16'));
    assert.equal(d.v, '0 0 16 16');
  });

  test('stroke-width が 2 以外なら s を保持', () => {
    const svg = lucide('<path d="M0 0"/>').replace('stroke-width="2"', 'stroke-width="1.5"');
    assert.equal(svg_to_descriptor(svg).s, 1.5);
  });
});

describe('svg_to_descriptor: 図形 → path 変換', () => {

  test('<line> → M..L..', () => {
    const d = svg_to_descriptor(lucide('<line x1="4" y1="4" x2="20" y2="20"/>'));
    assert.equal(d.p, 'M4 4L20 20');
  });

  test('<polyline> → M..L.. (閉じない)', () => {
    const d = svg_to_descriptor(lucide('<polyline points="6 9 12 15 18 9"/>'));
    assert.equal(d.p, 'M6 9L12 15L18 9');
  });

  test('<polygon> → M..L..z (閉じる)', () => {
    const d = svg_to_descriptor(lucide('<polygon points="6 3 20 12 6 21"/>'));
    assert.equal(d.p, 'M6 3L20 12L6 21z');
  });

  test('<rect> (角丸なし) → M h v h z', () => {
    const d = svg_to_descriptor(lucide('<rect x="4" y="4" width="16" height="16"/>'));
    assert.equal(d.p, 'M4 4h16v16h-16z');
  });

  test('<rect rx> (角丸) → 弧つき path', () => {
    const d = svg_to_descriptor(lucide('<rect x="3" y="3" width="18" height="18" rx="2"/>'));
    // 角丸の弧 (a2 2 ...) が含まれる
    assert.match(d.p, /^M5 3h14a2 2 0 0 1 2 2/);
    assert.match(d.p, /z$/);
  });

  test('<circle> → 2 弧の path', () => {
    const d = svg_to_descriptor(lucide('<circle cx="12" cy="12" r="10"/>'));
    assert.equal(d.p, 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z');
  });

  test('<ellipse> → 2 弧の path (rx≠ry)', () => {
    const d = svg_to_descriptor(lucide('<ellipse cx="12" cy="12" rx="10" ry="6"/>'));
    assert.equal(d.p, 'M2 12a10 6 0 1 0 20 0a10 6 0 1 0 -20 0z');
  });

  test('混在 (circle + path) で出現順を保つ — settings 風', () => {
    const d = svg_to_descriptor(lucide('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0 0 0"/>'));
    assert.ok(Array.isArray(d.p));
    assert.equal(d.p.length, 2);
    assert.match(d.p[0], /^M9 12a3 3/);     // circle が先
    assert.equal(d.p[1], 'M19 12a7 7 0 0 0 0 0');
  });
});

describe('svg_to_descriptor: fill モード判定', () => {

  test('fill=currentColor かつ stroke 無し → s:null (塗り)', () => {
    const svg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 2 22h20z"/></svg>';
    const d = svg_to_descriptor(svg);
    assert.equal(d.s, null);
    assert.equal(d.p, 'M12 2 2 22h20z');
  });

  test('fill=none → stroke モード (s は省略 = 2)', () => {
    const d = svg_to_descriptor(lucide('<path d="M0 0"/>'));
    assert.ok(!('s' in d));
  });

  test('fill 指定なし → 既定 stroke (s 省略)', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    assert.ok(!('s' in svg_to_descriptor(svg)));
  });
});

describe('svg_to_descriptor: 異常系', () => {

  test('描画要素ゼロ → throw', () => {
    assert.throws(() => svg_to_descriptor('<svg viewBox="0 0 24 24"></svg>'), /描画要素/);
  });

  test('文字列以外 → throw', () => {
    assert.throws(() => svg_to_descriptor(null), /文字列/);
  });
});
