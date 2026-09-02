// injectStyles (設計書 §4) — 1 回だけ注入 (idempotent) / 1 枚に部品規則が含まれる

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { injectStyles, warnIfStylesMissing, _resetStyleWarningForTest } from '../../src/ui/injectStyles.js';
import { buildStylesheet } from '../../src/ui/cssTemplates.js';

describe('injectStyles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    _resetStyleWarningForTest();
  });

  it('<style data-ricdom-role="styles"> を document.head に注入する', () => {
    injectStyles(document);
    const styleEl = document.querySelector('style[data-ricdom-role="styles"]');
    expect(styleEl).not.toBeNull();
    expect(styleEl!.textContent).toContain('.ric-button');
  });

  it('2 回呼んでも <style> は 1 つだけ (idempotent)', () => {
    injectStyles(document);
    injectStyles(document);
    injectStyles(document);
    expect(document.querySelectorAll('style[data-ricdom-role="styles"]').length).toBe(1);
  });

  it('注入される内容は buildStylesheet() と一致する (単一ソース)', () => {
    injectStyles(document);
    const styleEl = document.querySelector('style[data-ricdom-role="styles"]')!;
    expect(styleEl.textContent).toBe(buildStylesheet());
  });

  it('1 枚に 4 部品 + 共通規則がすべて含まれる (dialog/popup/toast/tooltip/button/input)', () => {
    const css = buildStylesheet();
    expect(css).toContain('.ric-button');
    expect(css).toContain('.ric-input');
    expect(css).toContain('.ric-dialog');
    expect(css).toContain('.ric-popup__body');
    expect(css).toContain('.ric-toast__item');
    expect(css).toContain('.ric-tooltip__popup');
  });

  it('無効な Document を渡すと console.error して throw しない', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => injectStyles(null as unknown as Document)).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('warnIfStylesMissing', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    _resetStyleWarningForTest();
  });

  it('スタイル未注入なら console.warn する', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('1 回だけ warn する (spam しない)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    warnIfStylesMissing(document);
    warnIfStylesMissing(document);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('injectStyles 済みなら warn しない', () => {
    injectStyles(document);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('<link href="...ricdom-ui.css"> があれば warn しない', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://example.com/dist/ricdom-ui.css';
    document.head.appendChild(link);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
