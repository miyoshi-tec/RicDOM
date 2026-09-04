// internal/popupPosition.ts (createPopup/createDropdown/createTooltip 共有の位置計算)

import { afterEach, describe, expect, it } from 'vitest';
import { clampLeft, computeAnchoredLeft, computeFlipDir, computeFlipDirAt, measuringLeft, posToStyle } from '../../src/ui/internal/popupPosition.js';

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

describe('computeAnchoredLeft (2.0.0-alpha.2、createPopup トリガー経路の横方向 clamp)', () => {
  const originalWidth = window.innerWidth;
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });

  it('measuredWidth 未指定 (実測前) は rect.left をそのまま返す', () => {
    expect(computeAnchoredLeft({ left: 300, right: 340 }, undefined)).toBe(300);
  });

  it('rect.left から開いて収まるならそのまま (従来どおり)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    expect(computeAnchoredLeft({ left: 100, right: 140 }, 160)).toBe(100);
  });

  it('viewport 右端付近のトリガーではみ出す場合、トリガーの右端に揃える', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    // トリガーが right=392 (viewport 右端 40px 以内相当) にあり、本体幅 160px だと
    // left=rect.left (352 とする) では 352+160=512 > 400 ではみ出す → rect.right - 160 に揃える
    const rect = { left: 352, right: 392 };
    expect(computeAnchoredLeft(rect, 160)).toBe(392 - 160);
  });

  it('右端揃えでもなお画面外にはみ出す (コンテンツが viewport より広い) 場合は viewport 内に clamp する', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const rect = { left: 10, right: 50 };
    // 右端揃え候補: 50 - 500 = -450 (大幅に画面外) → clampLeft で margin (8) まで戻す
    expect(computeAnchoredLeft(rect, 500)).toBe(8);
  });
});

describe('measuringLeft (2.0.0-alpha.5、#14 バグ修正: 実測 render 専用の仮 left 位置)', () => {
  it('既定 margin (8px) を返す', () => {
    expect(measuringLeft()).toBe(8);
  });

  it('margin を明示指定すればそれを返す (clampLeft/computeAnchoredLeft の margin と揃えられる)', () => {
    expect(measuringLeft(16)).toBe(16);
  });
});
