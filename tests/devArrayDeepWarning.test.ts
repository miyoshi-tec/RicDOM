// dev ビルドの配列経由の深い代入警告 (2.0.0-alpha.11、設計書 §3.3 続き、Potopeta の
// 最小再現): 配列は「再描画の追跡対象外」(shallow copy 差し替えが canon) のままだが、
// 旧実装は配列を素通しにしていたため配列要素を経由した先の代入がどの深さでも
// dev 警告の対象外になっていた (tests/devDeepAssignWarning.test.ts のオブジェクト版に
// 対する配列版)。production ではこれまでどおり一切包まない。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactiveState } from '../src/reactivity.js';

describe('dev の配列経由の深い代入警告', () => {
  let originalNodeEnv: string | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    warnSpy.mockRestore();
  });

  it('app.arr[0].x = 2 で警告 1 回', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ arr: [{ x: 1 }] }, () => {});
    state.arr[0]!.x = 2;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('arr[0].x');
    expect(state.arr[0]!.x).toBe(2); // 代入自体は production と同じく行われる
  });

  it('app.arr[0].p.q = 2 (配列要素のさらに先) で警告 1 回', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ arr: [{ p: { q: 1 } }] }, () => {});
    state.arr[0]!.p.q = 2;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('arr[0].p.q');
  });

  it('app.pages[0].page.width = 1 (list 状 state の典型形) で警告 1 回', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ pages: [{ page: { width: 100 } }] }, () => {});
    state.pages[0]!.page.width = 1;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('pages[0].page.width');
  });

  it('app.pages = [...app.pages] (canon の差し替え) では警告なし', () => {
    process.env.NODE_ENV = 'development';
    const notify = vi.fn();
    const state = createReactiveState({ pages: [{ page: { width: 100 } }] }, notify);
    state.pages = [...state.pages];
    expect(warnSpy).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1); // トップレベル代入として通常どおり追跡される
  });

  it.each(['push', 'splice', 'sort'] as const)('mutating メソッド %s は 1 回の呼び出しで警告 1 回 (要素数分にならない)', (method) => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ arr: [3, 1, 2, 4, 5] }, () => {});
    if (method === 'push') state.arr.push(6);
    if (method === 'splice') state.arr.splice(1, 2, 9, 9, 9);
    if (method === 'sort') state.arr.sort();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain(`arr.${method}()`);
  });

  it('非 mutating な読み取り (map/filter/for...of/Array.isArray/JSON.stringify/length) は警告なしで正しく動く', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ arr: [{ x: 1 }, { x: 2 }, { x: 3 }] }, () => {});

    expect(state.arr.map((v) => v.x)).toEqual([1, 2, 3]);
    expect(state.arr.filter((v) => v.x > 1).length).toBe(2);
    const collected: number[] = [];
    for (const v of state.arr) collected.push(v.x);
    expect(collected).toEqual([1, 2, 3]);
    expect(Array.isArray(state.arr)).toBe(true);
    expect(JSON.stringify(state.arr)).toBe(JSON.stringify([{ x: 1 }, { x: 2 }, { x: 3 }]));
    expect(state.arr.length).toBe(3);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('production (NODE_ENV=production) では配列が Proxy で包まれない (素通し・同一性維持)', () => {
    process.env.NODE_ENV = 'production';
    const raw = { arr: [{ x: 1 }] };
    const state = createReactiveState(raw, () => {});
    expect(state.arr).toBe(raw.arr); // 包まれていれば別オブジェクト (Proxy) になるはず
    state.arr[0]!.x = 2; // 代入自体は行われる
    expect(warnSpy).not.toHaveBeenCalled();
    expect(state.arr[0]!.x).toBe(2);
  });
});
