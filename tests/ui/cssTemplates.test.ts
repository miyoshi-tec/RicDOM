// buildStylesheet (設計書 §4/§13、状態を持たない部品 + スクロールバー既定スタイル)

import { describe, expect, it } from 'vitest';
import { buildStylesheet } from '../../src/ui/cssTemplates.js';

describe('buildStylesheet: 状態を持たない部品の規則を含む', () => {
  const css = buildStylesheet();

  it.each(['.ric-textarea', '.ric-checkbox', '.ric-select', '.ric-radiogroup', '.ric-range', '.ric-color', '.ric-separator', '.ric-text', '.ric-icon', '.ric-col', '.ric-row', '.ric-grid', '.ric-panel', '.ric-md-pre', '.ric-code-pre'])(
    '%s の規則を含む',
    (selector) => {
      expect(css).toContain(selector);
    },
  );

  it('[data-ricdom-theme] スコープのスクロールバー既定スタイルを含む (v1 の .ric-page 相当、設計書 §13)', () => {
    expect(css).toContain('[data-ricdom-theme]');
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).toContain('scrollbar-color');
  });

  it('.ric-panel[inert] で disabled の見た目 (opacity) を表現する', () => {
    expect(css).toContain('.ric-panel[inert]');
  });

  it('既存の規則も引き続き含まれる', () => {
    expect(css).toContain('.ric-button');
    expect(css).toContain('.ric-dialog');
    expect(css).toContain('.ric-popup__body');
    expect(css).toContain('.ric-toast__item');
    expect(css).toContain('.ric-tooltip__popup');
  });
});
