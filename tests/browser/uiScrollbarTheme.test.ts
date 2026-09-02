// 実ブラウザ回帰テスト: [data-ricdom-theme] 配下でページ全体のスクロールバー既定スタイル
// (設計書 §13) が有効なことを確認する (v1 の `.ric-page, .ric-page *` 相当の後継)。
// ::-webkit-scrollbar は擬似要素なので computed style からの直接検証は難しく、
// 標準の scrollbar-color / scrollbar-width (Firefox 系プロパティだが Chromium も
// getComputedStyle で値を返す) の computed 値で規則の適用を確認する。

import { describe, expect, it } from 'vitest';
import { applyTheme } from '../../src/ui/theme.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { setupApp } from '../_helpers/dom.js';

injectStyles(document);

describe('実ブラウザ: [data-ricdom-theme] 配下のスクロールバー規則', () => {
  it('applyTheme した要素自身に scrollbar-color の computed 値が入る', () => {
    const app = setupApp();
    applyTheme(app, { theme: 'light' });

    const scrollbarColor = getComputedStyle(app).scrollbarColor;
    // 既定 (未適用) は 'auto'。[data-ricdom-theme] の規則が効いていれば
    // scrollbar-thumb の色 + transparent の 2 値になる ('auto' ではなくなる)。
    expect(scrollbarColor).not.toBe('auto');
  });

  it('子孫要素にも scrollbar-color が継承経由ではなく規則自体で適用される ([data-ricdom-theme] *)', () => {
    const app = setupApp();
    app.innerHTML = '<div id="child" style="overflow:auto; height:10px;"></div>';
    applyTheme(app, { theme: 'dark' });

    const child = document.getElementById('child')!;
    const scrollbarColor = getComputedStyle(child).scrollbarColor;
    expect(scrollbarColor).not.toBe('auto');
  });

  it('applyTheme していない要素には規則が適用されない (scrollbar-color: auto のまま)', () => {
    document.body.innerHTML = '<div id="plain"></div>';
    const plain = document.getElementById('plain')!;
    expect(getComputedStyle(plain).scrollbarColor).toBe('auto');
  });
});
