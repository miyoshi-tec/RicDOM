// dev ビルドの深い代入警告 (設計書 §3.3): 2 段目以降のオブジェクト読み出しを
// read-only 相当の Proxy で包み、set を検知して console.warn する。
// production 相当 (NODE_ENV=production) では警告を出さない。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactiveState } from '../src/reactivity.js';

describe('dev の深い代入警告', () => {
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

  it('dev (NODE_ENV !== production) では 2 段目以降への代入で console.warn が出る', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ user: { address: { city: 'Tokyo' } } }, () => {});
    state.user.address.city = 'Osaka';
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('shallow copy');
  });

  it('production (NODE_ENV=production) では警告が出ない', () => {
    process.env.NODE_ENV = 'production';
    const state = createReactiveState({ user: { address: { city: 'Tokyo' } } }, () => {});
    state.user.address.city = 'Osaka';
    expect(warnSpy).not.toHaveBeenCalled();
    expect(state.user.address.city).toBe('Osaka'); // 代入自体は production と同じく行われる
  });

  it('1段目までの代入は dev でも警告が出ない (正しい使い方)', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ user: { name: 'a' } }, () => {});
    state.user.name = 'b';
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('3段目以降でも継続して警告が出る (再帰的に read-only wrap される)', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState({ a: { b: { c: { d: 1 } } } }, () => {});
    state.a.b.c.d = 2;
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
