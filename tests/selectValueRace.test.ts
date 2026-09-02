// <select> の value/option 構築順レース (v1 tests/select_value_race.test.js 相当)。
// value 代入は option が生えた後でないと反映されない DOM 仕様への対策を確認する。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('select value/option 構築順レース', () => {
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
  });

  it('patch 中に select が新規生成される場合も正しい value になる', async () => {
    const app = setupApp();
    const handle = createApp('#app', { showSelect: false }, (s) =>
      s.showSelect
        ? {
            tag: 'select',
            value: 'c',
            children: [
              { tag: 'option', value: 'x', children: ['X'] },
              { tag: 'option', value: 'c', children: ['C'] },
            ],
          }
        : { tag: 'div', children: ['no select yet'] },
    );
    await flush();
    expect(app.querySelector('select')).toBeNull();

    handle.showSelect = true;
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel).not.toBeNull();
    expect(sel.value).toBe('c');
  });

  it('regression: 既存 select への value 差分パッチは従来どおり動く', async () => {
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

  it('regression: value 未指定の select は従来どおり先頭 option が選ばれる', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({
      tag: 'select',
      children: [
        { tag: 'option', value: 'a', children: ['A'] },
        { tag: 'option', value: 'b', children: ['B'] },
      ],
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('a');
  });
});
