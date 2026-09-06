// dev ビルドの配列経由の深い代入警告 (2.0.0-alpha.11、設計書 §3.3 続き、Potopeta の
// 最小再現): 配列は「再描画の追跡対象外」(shallow copy 差し替えが canon) のままだが、
// 旧実装は配列を素通しにしていたため配列要素を経由した先の代入がどの深さでも
// dev 警告の対象外になっていた (tests/devDeepAssignWarning.test.ts のオブジェクト版に
// 対する配列版)。production ではこれまでどおり一切包まない。
//
// パイロット第 9 号 (Potopeta) の push 前指摘 (統括確認済み) により、代入の瞬間の
// 即時警告から「同じタスクの終わりに再描画が発火しなかったことが確定した時」の
// 遅延警告 (queueMicrotask) に契約が変わった。Potopeta の canon (深く書いてから
// トップレベルを差し替えて発火) が無警告になることの網羅的な検証は
// tests/deepAssignPendingDiscard.test.ts 参照。このファイルは「発火しなかった」
// ケースのみを扱うため、microtask を 1 回 flush してから assert する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactiveState } from '../src/reactivity.js';
import { flushMicrotasks } from './_helpers/dom.js';

describe('dev の配列経由の深い代入警告 (発火忘れ、microtask flush 後)', () => {
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

  it('app.arr[0].x = 2 だけで完結すると警告 1 回', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ arr: [{ x: 1 }] }, () => {});
    state.arr[0]!.x = 2;
    expect(warnSpy).not.toHaveBeenCalled(); // 代入した瞬間はまだ警告しない
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('arr[0].x');
    expect(state.arr[0]!.x).toBe(2); // 代入自体は production と同じく行われる
  });

  it('app.arr[0].p.q = 2 (配列要素のさらに先) で警告 1 回', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ arr: [{ p: { q: 1 } }] }, () => {});
    state.arr[0]!.p.q = 2;
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('arr[0].p.q');
  });

  it('app.pages[0].page.width = 1 (list 状 state の典型形) で警告 1 回', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ pages: [{ page: { width: 100 } }] }, () => {});
    state.pages[0]!.page.width = 1;
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('pages[0].page.width');
  });

  it('app.pages = [...app.pages] (canon の差し替え、同じタスク内) では警告なし', async () => {
    process.env.NODE_ENV = 'development';
    const notify = vi.fn();
    const state = createReactiveState({ pages: [{ page: { width: 100 } }] }, notify);
    state.pages = [...state.pages];
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1); // トップレベル代入として通常どおり追跡される
  });

  it.each(['push', 'splice', 'sort'] as const)(
    'mutating メソッド %s だけで完結すると 1 回の呼び出しで警告 1 回 (要素数分にならない)',
    async (method) => {
      process.env.NODE_ENV = 'development';
      const state = createReactiveState({ arr: [3, 1, 2, 4, 5] }, () => {});
      if (method === 'push') state.arr.push(6);
      if (method === 'splice') state.arr.splice(1, 2, 9, 9, 9);
      if (method === 'sort') state.arr.sort();
      await flushMicrotasks();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]![0]).toContain(`arr.${method}()`);
    },
  );

  it('push を複数回呼んでも同じ呼び出し形は 1 件にまとめられ、警告は 1 回', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ arr: [1] }, () => {});
    state.arr.push(2);
    state.arr.push(3);
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('非 mutating な読み取り (map/filter/for...of/Array.isArray/JSON.stringify/length) は警告なしで正しく動く', async () => {
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

    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('production (NODE_ENV=production) では配列が Proxy で包まれない (素通し・同一性維持)', async () => {
    process.env.NODE_ENV = 'production';
    const raw = { arr: [{ x: 1 }] };
    const state = createReactiveState(raw, () => {});
    expect(state.arr).toBe(raw.arr); // 包まれていれば別オブジェクト (Proxy) になるはず
    state.arr[0]!.x = 2; // 代入自体は行われる
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(state.arr[0]!.x).toBe(2);
  });
});
