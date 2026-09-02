// Proxy リアクティビティ (設計書 §3.3): トップレベル代入・1段目オブジェクトへの代入は
// 追跡される。2段目以降は追跡されない (shallow copy 差し替えが canon)。ignore 配下は
// 追跡されない。v1 (tests/auto_inject_notify_child.test.js 等) の契約を移植。

import { describe, expect, it, vi } from 'vitest';
import { createReactiveState } from '../src/reactivity.js';

describe('createReactiveState', () => {
  it('トップレベル代入で notify が呼ばれる', () => {
    const notify = vi.fn();
    const state = createReactiveState({ count: 0 }, notify);
    state.count = 1;
    expect(notify).toHaveBeenCalledTimes(1);
    expect(state.count).toBe(1);
  });

  it('1段目オブジェクトのプロパティ代入でも notify が呼ばれる', () => {
    const notify = vi.fn();
    const state = createReactiveState({ user: { name: 'a' } }, notify);
    state.user.name = 'b';
    expect(notify).toHaveBeenCalledTimes(1);
    expect(state.user.name).toBe('b');
  });

  it('2段目以降 (プロパティのプロパティ) への代入は notify されない', () => {
    const notify = vi.fn();
    const state = createReactiveState({ user: { address: { city: 'Tokyo' } } }, notify);
    state.user.address.city = 'Osaka'; // 代入自体は行われる (production と同じ結果)
    expect(notify).not.toHaveBeenCalled();
    expect(state.user.address.city).toBe('Osaka');
  });

  it('配列は追跡されない (mutation では notify されない)', () => {
    const notify = vi.fn();
    const state = createReactiveState({ list: [1, 2, 3] }, notify);
    state.list.push(4);
    expect(notify).not.toHaveBeenCalled();
    // 配列の置き換え (shallow copy canon) は通常のトップレベル代入なので追跡される
    state.list = [...state.list, 5];
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('ignore 配下への代入は notify されない', () => {
    const notify = vi.fn();
    const state = createReactiveState<{ ignore: { cache: number } }>({ ignore: { cache: 0 } }, notify);
    state.ignore.cache = 1;
    expect(notify).not.toHaveBeenCalled();
    expect(state.ignore.cache).toBe(1);

    // ignore 自体へのトップレベル代入も notify されない
    state.ignore = { cache: 2 };
    expect(notify).not.toHaveBeenCalled();
  });

  it('delete も変更として notify される (ignore は除く)', () => {
    const notify = vi.fn();
    const state = createReactiveState<{ a?: number; ignore?: { b?: number } }>({ a: 1, ignore: { b: 1 } }, notify);
    delete state.a;
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('同じオブジェクトへの複数回アクセスは同じ子 Proxy を返す (参照安定)', () => {
    const notify = vi.fn();
    const state = createReactiveState({ user: { name: 'a' } }, notify);
    expect(state.user).toBe(state.user);
  });
});
