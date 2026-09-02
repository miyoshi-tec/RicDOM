// createApp の入力バリデーション + NOOP App (設計書 §3.6、v1 tests/create_ricdom_validation.test.js 相当)。
// throw しない: console.error + 型付き NOOP App を返す。NOOP App への任意操作も安全。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('createApp: 入力バリデーション', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('target が見つからない場合、throw せず console.error + NOOP App を返す', () => {
    setupApp();
    let app: ReturnType<typeof createApp> | undefined;
    expect(() => {
      app = createApp('#does-not-exist', {}, () => ({ tag: 'div' }));
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    expect(app).toBeTruthy();
  });

  it('target が文字列でも Element でもない場合、NOOP App を返す', () => {
    let app: ReturnType<typeof createApp> | undefined;
    expect(() => {
      // @ts-expect-error -- 意図的に不正な型を渡すテスト
      app = createApp(123, {}, () => ({ tag: 'div' }));
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    expect(app).toBeTruthy();
  });

  it('state が null の場合、throw せず NOOP App を返す', () => {
    setupApp();
    let app: ReturnType<typeof createApp> | undefined;
    expect(() => {
      // @ts-expect-error -- 意図的に null を渡すテスト
      app = createApp('#app', null, () => ({ tag: 'div' }));
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    expect(app).toBeTruthy();
  });

  it('render が関数でない場合、throw せず NOOP App を返す', () => {
    setupApp();
    let app: ReturnType<typeof createApp> | undefined;
    expect(() => {
      // @ts-expect-error -- 意図的に不正な render を渡すテスト
      app = createApp('#app', {}, 'not-a-function');
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    expect(app).toBeTruthy();
  });

  it('render が未指定の場合、throw せず NOOP App を返す', () => {
    setupApp();
    let app: ReturnType<typeof createApp> | undefined;
    expect(() => {
      // @ts-expect-error -- 意図的に render を省略するテスト (3 引数が canon、設計書 §12)
      app = createApp('#app', {});
    }).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    expect(app).toBeTruthy();
  });

  it('正常な state では従来どおり動く (回帰確認)', async () => {
    const app = setupApp();
    createApp('#app', { n: 1 }, (s) => ({ tag: 'div', id: 'out', children: [String(s.n)] }));
    await flush();
    expect(app.querySelector('#out')!.textContent).toBe('1');
  });
});

describe('NOOP App: 任意アクセスが安全 (throw しない)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('プロパティ読み書き・関数呼び出しがすべて安全', () => {
    const app = createApp('#nope', {}, () => ({ tag: 'div' })) as unknown as Record<string, unknown> & {
      renderNow: () => void;
      refs: { get: (k: string) => unknown };
    };
    expect(() => {
      const _ = app.foo;
      app.bar = 1;
      app.renderNow();
      app.refs.get('x');
    }).not.toThrow();
  });
});
