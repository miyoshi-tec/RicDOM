// 実ブラウザ回帰テスト: dev IIFE (`dist/ricdom.iife.js`、2.0.0-alpha.10) は深い代入で
// console.warn が出るが、production IIFE (`dist/ricdom.iife.min.js`) では出ない。
//
// 2.0.0-alpha.10 で判明した穴 (統括確認済み、コア (src/reactivity.ts) 修正で対処):
// `isDevMode()` は `typeof process === 'undefined' || typeof process.env === 'undefined'
// || process.env.NODE_ENV !== 'production'` の OR 連鎖で、tsup の `define` は
// `process.env.NODE_ENV` という「トークン」だけを `"production"` に置換していた
// (`"production" !== "production"` に畳み込まれ `false` になる)。だが最初の 2 つの
// `typeof` ガードは置換対象外のまま生きたコードとして残っていたため、`process`
// グローバルが一切存在しない素のブラウザ (`<script>` タグ読み込み、bundler も
// Electron の Node 統合も無い環境 — 主要な配布形態そのもの) では
// `typeof process === 'undefined'` が常に true になり、`.iife.min.js` でも
// isDevMode() が true を返し続けていた (警告コード自体も DCE されずバンドルに残存)。
//
// 対策 (src/reactivity.ts): `__RICDOM_DEV__` というビルド時定数を導入し、
// `bakedDevMode`（`typeof __RICDOM_DEV__ === 'boolean' ? __RICDOM_DEV__ : undefined`）
// を経由することで `.iife.min.js` (`__RICDOM_DEV__: 'false'`) では警告コードが
// dead-code elimination で完全に消え、`.iife.js` (`__RICDOM_DEV__: 'true'`) では
// 常に警告が有効になる (tsup.config.ts 参照)。
//
// このテストは **`window.process` を注入しない** (real な `<script>` 1 行配布を
// 素のまま模す — Playwright/chromium の実ブラウザには元々 `process` が無い)。
// shim に頼っていた旧版は「NODE_ENV の baked/非-baked」という限定的な差異しか
// 見ておらず、本来問題だった「`process` が無いブラウザで min が正しく無警告になるか」
// を検証できていなかった。
//
// dist は事前にビルドされている必要がある (package.json の `pretest:browser`)。

import { describe, expect, it, vi } from 'vitest';
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

describe('実ブラウザ (process 未定義): dev IIFE (.iife.js) は深い代入で warn する / production (.iife.min.js) は warn しない', () => {
  it('window.process が存在しないこと (このテストの前提)', () => {
    expect((window as unknown as { process?: unknown }).process).toBeUndefined();
  });

  it('dist/ricdom.iife.js (dev、__RICDOM_DEV__=true 焼き込み) は深い代入 (2 段目) で console.warn する', async () => {
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

  it('dist/ricdom.iife.min.js (production、__RICDOM_DEV__=false 焼き込み) は process が無くても同じ深い代入で console.warn しない', async () => {
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
