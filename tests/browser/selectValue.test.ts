// 実ブラウザ回帰テスト (b): <select value="b"> + options の同時初回描画で 'b' が選択される。
// jsdom 版は tests/selectValueRace.test.ts にあるが、value 代入は option が生えた後で
// ないと反映されない、という DOM 仕様上の挙動 (value サニタイズ) は実ブラウザで確認する
// のが本来の目的 (設計書 §7、v1 でブラウザ固有だった回帰の 1 つ)。

import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('実ブラウザ: select value/option 構築順レース', () => {
  it('初回描画: value + options が同時出現しても指定 option が選択される', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({
      tag: 'select',
      value: 'b',
      children: [
        { tag: 'option', value: 'a', children: ['A'] },
        { tag: 'option', value: 'b', children: ['B'] },
      ],
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('b');
    expect(sel.selectedOptions).toHaveLength(1);
    expect(sel.selectedOptions[0]!.value).toBe('b');
  });

  it('state 変更で選択中の option が切り替わる', async () => {
    const app = setupApp();
    const handle = createApp('#app', { sel: 'a' }, (s) => ({
      tag: 'select',
      value: s.sel,
      children: [
        { tag: 'option', value: 'a', children: ['A'] },
        { tag: 'option', value: 'b', children: ['B'] },
        { tag: 'option', value: 'c', children: ['C'] },
      ],
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('a');

    handle.sel = 'c';
    await flush();
    expect(sel.value).toBe('c');
  });
});
