// createFocusWhen (v1 focus_when の後継、2.0.0-alpha.2、設計書 §3.4 部品契約)
// 立ち上がりエッジでの focus 移動・true 継続時の再 focus 抑止・ref 不在時の警告・
// use() 忘れ検知を確認する。portal 内 ref との組み合わせ (#2 との連携) は
// tests/browser/uiFocusWhen.test.ts (実ブラウザ、実 focus 移動) で検証する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createFocusWhen, type FocusWhenInstance } from '../../src/ui/focusWhen.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createFocusWhen: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない fw を直接呼ぶと console.error を出し null を返す', () => {
    const fw = createFocusWhen();
    expect(fw('x', true)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createFocusWhen: 立ち上がりエッジでの focus', () => {
  it('false→true の立ち上がりで、render 完了後に ref 先の要素へ focus する', async () => {
    const app = setupApp();
    const state = { open: false };
    let fw: FocusWhenInstance;
    const handle = createApp('#app', state, (s) => {
      fw?.('theInput', s.open);
      return { tag: 'div', children: [{ tag: 'input', ref: 'theInput' }] };
    });
    fw = handle.use(createFocusWhen());
    await flush();
    expect(document.activeElement).not.toBe(app.querySelector('input'));

    handle.open = true;
    await flush();
    expect(document.activeElement).toBe(app.querySelector('input'));
  });

  it('true が継続している間は再 focus しない (別の要素に触れても奪い返さない)', async () => {
    const app = setupApp();
    const state = { open: false, other: 0 };
    let fw: FocusWhenInstance;
    const handle = createApp('#app', state, (s) => {
      fw?.('theInput', s.open);
      return { tag: 'div', children: [{ tag: 'input', ref: 'theInput' }, { tag: 'button', id: 'elsewhere', children: [String(s.other)] }] };
    });
    fw = handle.use(createFocusWhen());
    await flush();

    handle.open = true;
    await flush();
    expect(document.activeElement).toBe(app.querySelector('input'));

    (app.querySelector('#elsewhere') as HTMLElement).focus();
    expect(document.activeElement).toBe(app.querySelector('#elsewhere'));

    // condition は true のまま (立ち上がりではない) 別の理由で再描画させる
    handle.other = 1;
    await flush();
    expect(document.activeElement).toBe(app.querySelector('#elsewhere')); // 奪い返されない
  });

  it('false→false / true→false では focus しない', async () => {
    const app = setupApp();
    const state = { open: false, other: 0 };
    let fw: FocusWhenInstance;
    const handle = createApp('#app', state, (s) => {
      fw?.('theInput', s.open);
      return { tag: 'div', children: [{ tag: 'input', ref: 'theInput' }] };
    });
    fw = handle.use(createFocusWhen());
    await flush();

    handle.other = 1; // open は false のまま
    await flush();
    expect(document.activeElement).not.toBe(app.querySelector('input'));

    handle.open = true;
    await flush();
    expect(document.activeElement).toBe(app.querySelector('input'));

    handle.open = false; // 立ち下がり
    await flush();
    // 立ち下がりでは何もしない = 直前の focus 状態のまま何も操作されない
    // (dialog が閉じてフォーカスが外れるのは呼び出し側/他機構の責務)
    expect(document.activeElement).toBe(app.querySelector('input'));
  });

  it('複数 ref を 1 インスタンスで独立して扱える', async () => {
    const app = setupApp();
    const state = { a: false, b: false };
    let fw: FocusWhenInstance;
    const handle = createApp('#app', state, (s) => {
      fw?.('inputA', s.a);
      fw?.('inputB', s.b);
      return { tag: 'div', children: [{ tag: 'input', ref: 'inputA', id: 'a' }, { tag: 'input', ref: 'inputB', id: 'b' }] };
    });
    fw = handle.use(createFocusWhen());
    await flush();

    handle.b = true;
    await flush();
    expect(document.activeElement).toBe(app.querySelector('#b'));

    handle.a = true;
    await flush();
    expect(document.activeElement).toBe(app.querySelector('#a'));
  });
});

describe('createFocusWhen: ref が見つからない場合', () => {
  it('要素が無ければ何もしない (throw しない)、dev モードでは console.warn する', async () => {
    setupApp();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = { open: false };
    let fw: FocusWhenInstance;
    const handle = createApp('#app', state, (s) => {
      fw?.('nonexistent', s.open);
      return { tag: 'div' };
    });
    fw = handle.use(createFocusWhen());
    await flush();

    expect(() => {
      handle.open = true;
    }).not.toThrow();
    await flush();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
