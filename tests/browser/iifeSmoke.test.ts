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

  // パイロット第 9 号 = Potopeta からの報告 (2.0.0-alpha.10): Potopeta の自己完結 HTML
  // バンドル (v1 の LZ 自己展開ツールで生成) は復元コードを `(()=>{ eval(s) })()` という
  // 「関数スコープの中で eval する」形で実行する。esbuild が出す IIFE のトップレベル
  // `var ricdom=(()=>{...})();` は通常の <script> 実行 (グローバルスコープでの評価) では
  // 問題なく window に付くが、関数スコープの中では `var` がそのローカル変数になるだけで
  // window/globalThis には現れない。`new Function(code)` は文字列をちょうどそういう
  // 「関数スコープ」で評価する組み込み手段なので、この罠を再現するのに使う
  // (`eval` 直接呼び出しは呼び出し元スコープに影響するため代用にならない —
  // `new Function` は必ず独立した新しい関数スコープを作る点が本質的に同じ)。
  it('関数スコープで評価 (new Function) しても globalThis.ricdom が定義される (footer の global 代入、修正前は赤)', async () => {
    const code = await commands.readFile('dist/ricdom.iife.min.js');
    // 直前のテストで <script> タグ経由 (通常のグローバルスコープ実行) の
    // window.ricdom が既に立っている。トップレベル `var` 由来のグローバルは
    // 非 configurable (delete できない) だが writable ではあるので、undefined で
    // 上書きしてから関数スコープ eval の効果だけを見る (残っていると footer が
    // 無くても偽陽性で緑になってしまう)。
    (window as unknown as { ricdom?: unknown }).ricdom = undefined;
    // eslint 的には Function コンストラクタは避けたいが、ここではまさに
    // 「関数スコープでの eval」を検証したいので意図的に使う。
    const fn = new Function(code);
    fn();

    const ricdom = (window as unknown as { ricdom?: RicdomGlobal }).ricdom;
    expect(ricdom).toBeTruthy();
    expect(typeof ricdom!.createApp).toBe('function');
  });
});
