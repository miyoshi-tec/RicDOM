// 実ブラウザ回帰テスト (d): IIFE ビルド (dist/ricdom.iife.min.js) を <script> で読み込んで
// `ricdom.createApp` が動く smoke テスト。consumer の典型的な使い方 (CDN 経由の
// `<script src>` 1 本、ビルド不要、設計書 G1) をそのまま検証する。
// dist は事前にビルドされている必要がある (package.json の `pretest:browser` で
// `npm run build` を回す)。

import { describe, expect, it } from 'vitest';
import { commands } from '@vitest/browser/context';
import { flush, setupApp } from '../_helpers/dom.js';

interface RicdomGlobal {
  createApp: (target: string | Element, state: object, render: (s: never) => unknown) => { count: number };
}

describe('実ブラウザ smoke: IIFE ビルドを <script> 1 本で読み込む', () => {
  it('window.ricdom.createApp がビルド不要で動く', async () => {
    // dist/ricdom.iife.min.js を読み、<script> タグとして実行する
    // (commands.readFile はプロジェクトルート基準で解決される)。
    const code = await commands.readFile('dist/ricdom.iife.min.js');
    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);

    const ricdom = (window as unknown as { ricdom?: RicdomGlobal }).ricdom;
    expect(ricdom).toBeTruthy();
    expect(typeof ricdom!.createApp).toBe('function');

    const app = setupApp();
    const handle = ricdom!.createApp('#app', { count: 1 }, (s) => ({
      tag: 'div',
      id: 'out',
      children: [String((s as { count: number }).count)],
    }));
    await flush();
    expect(app.querySelector('#out')!.textContent).toBe('1');

    handle.count = 2;
    await flush();
    expect(app.querySelector('#out')!.textContent).toBe('2');
  });
});
