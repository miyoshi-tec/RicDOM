// 実ブラウザ回帰テスト: uiMdPre の javascript: リンクが href を持たない (設計書 F)。
// jsdom でも同じロジックの単体テストは既にあるが (tests/ui/mdPre.test.ts)、実ブラウザの
// <a> 要素として本当に href 属性が無い (= クリックしても遷移しない) ことを DOM から確認する。

import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { uiMdPre } from '../../src/ui/mdPre.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

describe('実ブラウザ: uiMdPre の危険スキームリンク', () => {
  it('javascript: リンクは実 DOM 上で href 属性を持たない', async () => {
    const app = setupApp();
    createApp('#app', {}, () => uiMdPre({ children: ['[click me](javascript:alert(1))'] }));
    await flush();

    const a = app.querySelector('a')!;
    expect(a).not.toBeNull();
    expect(a.hasAttribute('href')).toBe(false);
    expect(a.textContent).toBe('click me');
  });

  it('通常の https: リンクは href 属性を持つ (対照確認)', async () => {
    const app = setupApp();
    createApp('#app', {}, () => uiMdPre({ children: ['[go](https://example.com)'] }));
    await flush();

    const a = app.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://example.com');
  });
});
