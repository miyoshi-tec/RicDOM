// internal/popupPosition.ts (Phase 3b、createPopup/createDropdown/createTooltip 共有の位置計算)

import { describe, expect, it } from 'vitest';
import { clampLeft, computeFlipDir, computeFlipDirAt, posToStyle } from '../../src/ui/internal/popupPosition.js';

describe('posToStyle', () => {
  it('定義されているキーだけを px 文字列に変換する', () => {
    expect(posToStyle({ top: 10, left: 20 })).toEqual({ top: '10px', left: '20px' });
    expect(posToStyle({ bottom: 5, right: 5, minWidth: 100 })).toEqual({ bottom: '5px', right: '5px', minWidth: '100px' });
    expect(posToStyle({})).toEqual({});
  });
});

describe('computeFlipDir / computeFlipDirAt', () => {
  const originalHeight = window.innerHeight;

  it('下に十分なスペースがあれば below', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    const rect = { bottom: 100, top: 80 } as DOMRect;
    expect(computeFlipDir(rect, 160)).toBe('below');
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
  });

  it('下のスペースが足りず、上のスペースの方が広ければ above', () => {
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    const rect = { bottom: 190, top: 180 } as DOMRect; // 下 10px、上 180px
    expect(computeFlipDir(rect, 160)).toBe('above');
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
  });

  it('computeFlipDirAt は rect の代わりに y 一点で判定する', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    expect(computeFlipDirAt(100, 160)).toBe('below');
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    expect(computeFlipDirAt(190, 160)).toBe('above');
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true });
  });
});

describe('clampLeft', () => {
  const originalWidth = window.innerWidth;

  it('width 未指定なら left をそのまま返す (未計測フェーズ)', () => {
    expect(clampLeft(500, undefined)).toBe(500);
  });

  it('viewport をはみ出す場合は [margin, innerWidth - width - margin] に収める', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    expect(clampLeft(-50, 100)).toBe(8); // 左にはみ出し → margin
    expect(clampLeft(350, 100)).toBe(292); // 右にはみ出し → 400-100-8
    expect(clampLeft(150, 100)).toBe(150); // 収まっていればそのまま
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });
});
