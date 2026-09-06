// dev ビルドの深い代入警告 (設計書 §3.3): 2 段目以降のオブジェクト読み出しを
// read-only 相当の Proxy で包み、set を検知して警告する。
// production 相当 (NODE_ENV=production) では警告を出さない。
//
// パイロット第 9 号 (Potopeta) の push 前指摘 (統括確認済み) により、代入の瞬間の
// 即時警告から「同じタスクの終わりに再描画が発火しなかったことが確定した時」の
// 遅延警告 (queueMicrotask) に契約が変わった (src/reactivity.ts の wrapDeepWarn
// 定義直前のコメント参照)。このファイルのテストは「発火しなかった」ケースのみを
// 扱うため、microtask を 1 回 flush してから assert する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactiveState } from '../src/reactivity.js';
import { flushMicrotasks } from './_helpers/dom.js';

describe('dev の深い代入警告 (発火忘れ、microtask flush 後)', () => {
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

  it('dev (NODE_ENV !== production) では 2 段目以降への代入だけで完結すると console.warn が出る', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ user: { address: { city: 'Tokyo' } } }, () => {});
    state.user.address.city = 'Osaka';
    expect(warnSpy).not.toHaveBeenCalled(); // 代入した瞬間はまだ警告しない (発火忘れと確定していない)
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('shallow copy');
  });

  it('production (NODE_ENV=production) では警告が出ない', async () => {
    process.env.NODE_ENV = 'production';
    const state = createReactiveState({ user: { address: { city: 'Tokyo' } } }, () => {});
    state.user.address.city = 'Osaka';
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(state.user.address.city).toBe('Osaka'); // 代入自体は production と同じく行われる
  });

  it('1段目までの代入は dev でも警告が出ない (正しい使い方)', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ user: { name: 'a' } }, () => {});
    state.user.name = 'b';
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('3段目以降でも、発火せずに終われば継続して警告が出る (再帰的に read-only wrap される)', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ a: { b: { c: { d: 1 } } } }, () => {});
    state.a.b.c.d = 2;
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('v1 canon: 深く書いてから同じタスク内でトップレベルを shallow copy で差し替えれば警告なし', async () => {
    process.env.NODE_ENV = 'development';
    const notify = vi.fn();
    const state = createReactiveState({ user: { address: { city: 'Tokyo' } } }, notify);
    state.user.address.city = 'Osaka'; // その場で深く書く (代入が先)
    state.user = { ...state.user }; // トップレベルを差し替えて発火 (発火が後、v1 canon)
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('同じ path への複数回の代入は 1 回にまとめて警告する', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ user: { address: { city: 'Tokyo' } } }, () => {});
    state.user.address.city = 'Osaka';
    state.user.address.city = 'Kyoto';
    state.user.address.city = 'Nara';
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('異なる 2 つの path への代入は 2 回警告する', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ a: { b: { x: 1 } }, c: { d: { y: 1 } } }, () => {});
    state.a.b.x = 2;
    state.c.d.y = 2;
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
