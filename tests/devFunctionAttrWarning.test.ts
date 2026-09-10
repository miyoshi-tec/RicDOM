// dev: 関数値が非イベント属性に渡ったときの警告 (設計書 §29「実害が確定した時点で
// 警告する」)。
//
// Raccoon Memo (パイロット第 5 号, alpha.14 報告): UI コンポーネントは未知の prop を
// rest-spread で要素ノードの属性へ素通しする (SPEC §10.5) が、v1 から移行した
// consumer が snake_case のままの prop 名 (例: transform_image_src) を渡すと
// isEventHandlerKey にもマッチせず applyPlainAttr に落ち、String(fn) で意味の無い
// 文字列が setAttribute されるだけで hook が無言で死んでいた。関数値が HTML 属性と
// して意味を持つことは無いので、applyPlainAttr に関数が来た瞬間を実害確定として
// 警告し、dev/prod 問わず属性としては設定しない。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { _resetFunctionAttrWarningsForTest } from '../src/dom.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('dev: 関数値が非イベント属性に渡ったときの警告', () => {
  let originalNodeEnv: string | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _resetFunctionAttrWarningsForTest();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    warnSpy.mockRestore();
    _resetFunctionAttrWarningsForTest();
  });

  it('非イベント属性キーに関数を渡すと警告が 1 回出て、要素にその属性は設定されない', async () => {
    const app = setupApp();
    const fn = () => {};
    createApp('#app', {}, () => ({ tag: 'div', transform_image_src: fn, children: ['x'] }));
    await flush();

    const div = app.querySelector('div') as HTMLDivElement;
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('transform_image_src');
    expect(div.hasAttribute('transform_image_src')).toBe(false);
  });

  it('onclick のようなイベントハンドラキーへの関数は警告しない', async () => {
    const app = setupApp();
    const fn = () => {};
    createApp('#app', {}, () => ({ tag: 'button', onclick: fn, children: ['click'] }));
    await flush();

    expect(warnSpy).not.toHaveBeenCalled();
    const button = app.querySelector('button') as HTMLButtonElement;
    expect(typeof button.onclick).toBe('function');
  });

  it('同じ key への再 render では 1 回だけ警告する (spam しない)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'div',
      // render のたびに新しいクロージャを作る (普通の使い方)
      on_resize_end: () => s.n,
      children: [String(s.n)],
    }));
    await flush();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    handle.n = 1;
    handle.renderNow();
    handle.n = 2;
    handle.renderNow();

    // key ("on_resize_end") 単位で dedupe するので、再 render しても総数は 1 のまま
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const div = app.querySelector('div') as HTMLDivElement;
    expect(div.hasAttribute('on_resize_end')).toBe(false);
  });

  it('通常の文字列属性では警告しない', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', title: 'hello', children: ['x'] }));
    await flush();

    expect(warnSpy).not.toHaveBeenCalled();
    const div = app.querySelector('div') as HTMLDivElement;
    expect(div.getAttribute('title')).toBe('hello');
  });
});
