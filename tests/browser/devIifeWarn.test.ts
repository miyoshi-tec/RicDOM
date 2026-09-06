// 実ブラウザ回帰テスト: dev IIFE (`dist/ricdom.iife.js`、2.0.0-alpha.10) は深い代入で
// console.warn が出るが、production IIFE (`dist/ricdom.iife.min.js`) では出ない
// (統括決定: `.iife.min.js` は NODE_ENV='production' を静的注入し、コアの isDevMode
// (src/reactivity.ts) の `process.env.NODE_ENV !== 'production'` という一部分だけを
// ビルド時に literal `false` へ定数畳み込みするため、CDN からの `<script> 1 行` という
// 主要な配布形態では深い代入警告 (§3.3) が仕組み上「最初から効かせようがない」— という
// のが本来の狙いだった。V1_VS_V2 の「dev ビルドで警告」との整合を取るため、非 minify・
// NODE_ENV 未注入の dev 版を別出力する (React の development/production ビルドと
// 同じ発想、tsup.config.ts 参照)。
//
// **実装中に判明した注意点 (コア未変更、src/*.ts は本タスクの対象外のため報告のみ)**:
// `isDevMode()` は `typeof process === 'undefined' || typeof process.env === 'undefined'
// || process.env.NODE_ENV !== 'production'` の OR 連鎖で、tsup の `define` は最後の
// `process.env.NODE_ENV` という「トークン」だけを `"production"` に置換する
// (`"production" !== "production"` に畳み込まれ `false` になる)。だが最初の 2 つの
// `typeof` ガードは置換対象外のまま **生きたコードとして残る** — `process` グローバルが
// 一切存在しない素のブラウザ (`<script>` タグ読み込み、bundler も Electron の Node
// 統合も無い環境) では `typeof process === 'undefined'` が常に true になり、
// `.iife.min.js` でも isDevMode() は true を返し続ける (「判定不能なら dev 扱いにする」
// という reactivity.ts 自身のコメント通りの動作ではあるが、SPEC.md 「dead-code
// elimination でこの経路ごと削れる」という記述とは食い違う — 実際には warn の文字列
// 自体もバンドルから消えていない)。つまり **素のブラウザで `<script>` 1 本だけ読む
// 構成では、dev/production の 2 本を分けても両方 warn する** ため、このテストでは
// `window.process` を明示的に注入し (Electron レンダラーや process shim 付き
// bundler 経由での配布を模す)、「NODE_ENV の値そのものが baked かどうか」という
// 本来分けたかった差異だけを決定的に検証する。
//
// dist は事前にビルドされている必要がある (package.json の `pretest:browser`)。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@vitest/browser/context';
import { flush, setupApp } from '../_helpers/dom.js';

interface RicdomGlobal {
  createApp: (target: string | Element, state: object, render: (s: never) => unknown) => Record<string, unknown>;
}

const loadScript = (code: string): void => {
  const script = document.createElement('script');
  script.textContent = code;
  document.head.appendChild(script);
};

describe('実ブラウザ: dev IIFE (.iife.js) は深い代入で warn する / production (.iife.min.js) は warn しない', () => {
  beforeEach(() => {
    // process shim: NODE_ENV を 'production' 以外にしておく (Electron レンダラー等、
    // `process` が実在する配布先を模す — 素のブラウザには無いが、typeof process
    // ガードを通過させて NODE_ENV の baked/非-baked の差だけを見るための注入)。
    (window as unknown as { process?: unknown }).process = { env: { NODE_ENV: 'development' } };
  });
  afterEach(() => {
    delete (window as unknown as { process?: unknown }).process;
  });

  it('dist/ricdom.iife.js (dev、非 minify・NODE_ENV 未注入) は深い代入 (2 段目) で console.warn する', async () => {
    const code = await commands.readFile('dist/ricdom.iife.js');
    loadScript(code);

    const ricdom = (window as unknown as { ricdom?: RicdomGlobal }).ricdom;
    expect(ricdom).toBeTruthy();

    const app = setupApp();
    // obj.nested.prop への代入は 2 段目 (未追跡) — dev ビルドでは読み出し時に
    // 警告用 Proxy で包まれ、set で console.warn する (src/reactivity.ts の wrapDeepWarn)。
    const handle = ricdom!.createApp('#app', { obj: { nested: { prop: 1 } } }, () => ({ tag: 'div' })) as {
      obj: { nested: { prop: number } };
    };
    await flush();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handle.obj.nested.prop = 2; // 2 段目への代入 (未追跡 = 再描画はトリガーされない)
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes('再描画をトリガーしません'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('dist/ricdom.iife.min.js (production) は同じ深い代入をしても console.warn しない (NODE_ENV=production の baked 定数畳み込みが効く)', async () => {
    const code = await commands.readFile('dist/ricdom.iife.min.js');
    loadScript(code);

    const ricdom = (window as unknown as { ricdom?: RicdomGlobal }).ricdom;
    expect(ricdom).toBeTruthy();

    const app = setupApp();
    const handle = ricdom!.createApp('#app', { obj: { nested: { prop: 1 } } }, () => ({ tag: 'div' })) as {
      obj: { nested: { prop: number } };
    };
    await flush();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handle.obj.nested.prop = 2;
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
