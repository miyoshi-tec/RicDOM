// internal/hljs.ts — warnHljsMissing (v1 `_factory_helpers.js:59-69` の
// warn_hljs_missing 継承、v1→v2 パリティ一括監査 #7)。console 自体が無い/console.warn が
// 関数でない環境 (一部の組み込み/SSR 実行系) でも throw しないことを確認する。
// 通常の warn 挙動 (1 回だけ、mdPre/codePre から共有) は tests/ui/mdPre.test.ts /
// tests/ui/codePre.test.ts で確認済み。

import { afterEach, describe, expect, it } from 'vitest';
import { _resetHljsWarningForTest, warnHljsMissing } from '../../src/ui/internal/hljs.js';

describe('warnHljsMissing: console 未対応環境の防御', () => {
  afterEach(() => {
    _resetHljsWarningForTest();
  });

  it('console が存在しなくても throw しない', () => {
    const original = globalThis.console;
    // @ts-expect-error -- テストのため意図的に console を消す
    delete globalThis.console;
    try {
      expect(() => warnHljsMissing()).not.toThrow();
    } finally {
      globalThis.console = original;
    }
  });

  it('console.warn が関数でなくても throw しない', () => {
    const original = globalThis.console;
    globalThis.console = { ...original, warn: undefined } as unknown as Console;
    try {
      expect(() => warnHljsMissing()).not.toThrow();
    } finally {
      globalThis.console = original;
    }
  });

  it('console が使えない間は「1 回だけ」の状態を消費しない (後で使えるようになれば warn できる)', () => {
    const original = globalThis.console;
    // @ts-expect-error -- テストのため意図的に console を消す
    delete globalThis.console;
    warnHljsMissing();
    globalThis.console = original;

    let called = false;
    const warnSpy = (globalThis.console.warn = () => {
      called = true;
    });
    warnHljsMissing();
    expect(called).toBe(true);
    void warnSpy;
  });
});
