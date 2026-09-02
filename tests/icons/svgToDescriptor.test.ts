// ricdom/icons — svgToDescriptor 変換器テスト (Phase 3c、v1 tests/svg_to_descriptor.test.js の移植)
//
// アイコン SVG 文字列 → uiIcon descriptor { v?, s?, p } の変換を検証する。
// path 以外の要素 (line/polyline/polygon/rect/circle/ellipse) が path に
// 厳密変換されること、stroke/fill 判定、正準化 (既定値省略) を確認する。

import { describe, expect, it } from 'vitest';
import { svgToDescriptor } from '../../src/icons/svgToDescriptor.js';

// Lucide スタイルの SVG ラッパ (fill=none, stroke=currentColor, stroke-width=2)
const lucide = (inner: string, attrs = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${attrs}>${inner}</svg>`;

describe('svgToDescriptor: 基本 (path / stroke)', () => {
  it('単一 path の Lucide SVG → { p } (v も s も既定なので省略)', () => {
    const d = svgToDescriptor(lucide('<path d="M20 6 9 17l-5-5"/>'));
    expect(d).toEqual({ p: 'M20 6 9 17l-5-5' });
  });

  it('複数 path → p は配列、出現順を保つ', () => {
    const d = svgToDescriptor(lucide('<path d="M5 12h14"/><path d="M12 5v14"/>'));
    expect(d.p).toEqual(['M5 12h14', 'M12 5v14']);
  });

  it('viewBox が既定でなければ v を保持', () => {
    const svg = lucide('<path d="M0 0"/>', ' ').replace('0 0 24 24', '0 0 16 16');
    expect(svgToDescriptor(svg).v).toBe('0 0 16 16');
  });

  it('stroke-width が 2 以外なら s を保持', () => {
    const svg = lucide('<path d="M0 0"/>').replace('stroke-width="2"', 'stroke-width="1.5"');
    expect(svgToDescriptor(svg).s).toBe(1.5);
  });
});

describe('svgToDescriptor: 図形 → path 変換', () => {
  it('<line> → M..L..', () => {
    const d = svgToDescriptor(lucide('<line x1="4" y1="4" x2="20" y2="20"/>'));
    expect(d.p).toBe('M4 4L20 20');
  });

  it('<polyline> → M..L.. (閉じない)', () => {
    const d = svgToDescriptor(lucide('<polyline points="6 9 12 15 18 9"/>'));
    expect(d.p).toBe('M6 9L12 15L18 9');
  });

  it('<polygon> → M..L..z (閉じる)', () => {
    const d = svgToDescriptor(lucide('<polygon points="6 3 20 12 6 21"/>'));
    expect(d.p).toBe('M6 3L20 12L6 21z');
  });

  it('<rect> (角丸なし) → M h v h z', () => {
    const d = svgToDescriptor(lucide('<rect x="4" y="4" width="16" height="16"/>'));
    expect(d.p).toBe('M4 4h16v16h-16z');
  });

  it('<rect rx> (角丸) → 弧つき path', () => {
    const d = svgToDescriptor(lucide('<rect x="3" y="3" width="18" height="18" rx="2"/>'));
    expect(d.p as string).toMatch(/^M5 3h14a2 2 0 0 1 2 2/);
    expect(d.p as string).toMatch(/z$/);
  });

  it('<circle> → 2 弧の path', () => {
    const d = svgToDescriptor(lucide('<circle cx="12" cy="12" r="10"/>'));
    expect(d.p).toBe('M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z');
  });

  it('<ellipse> → 2 弧の path (rx≠ry)', () => {
    const d = svgToDescriptor(lucide('<ellipse cx="12" cy="12" rx="10" ry="6"/>'));
    expect(d.p).toBe('M2 12a10 6 0 1 0 20 0a10 6 0 1 0 -20 0z');
  });

  it('混在 (circle + path) で出現順を保つ — settings 風', () => {
    const d = svgToDescriptor(lucide('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0 0 0"/>'));
    expect(Array.isArray(d.p)).toBe(true);
    const p = d.p as string[];
    expect(p.length).toBe(2);
    expect(p[0]).toMatch(/^M9 12a3 3/); // circle が先
    expect(p[1]).toBe('M19 12a7 7 0 0 0 0 0');
  });
});

describe('svgToDescriptor: fill モード判定', () => {
  it('fill=currentColor かつ stroke 無し → s:null (塗り)', () => {
    const svg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 2 22h20z"/></svg>';
    const d = svgToDescriptor(svg);
    expect(d.s).toBe(null);
    expect(d.p).toBe('M12 2 2 22h20z');
  });

  it('fill=none → stroke モード (s は省略 = 2)', () => {
    const d = svgToDescriptor(lucide('<path d="M0 0"/>'));
    expect('s' in d).toBe(false);
  });

  it('fill 指定なし → 既定 stroke (s 省略)', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
    expect('s' in svgToDescriptor(svg)).toBe(false);
  });
});

describe('svgToDescriptor: 異常系', () => {
  it('描画要素ゼロ → throw', () => {
    expect(() => svgToDescriptor('<svg viewBox="0 0 24 24"></svg>')).toThrow(/描画要素/);
  });

  it('文字列以外 → throw', () => {
    expect(() => svgToDescriptor(null as unknown as string)).toThrow(/文字列/);
  });
});
