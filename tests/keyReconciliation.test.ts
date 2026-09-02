// key ベースの子要素 reconciliation (v1 tests/key_reconciliation.test.js 相当)。
// 並べ替え・中央挿入・削除で DOM ノードが再利用される (= 同一参照が保たれる) ことを確認する。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

interface Item {
  id: string;
  label: string;
}

describe('key-based reconciliation', () => {
  it('並べ替えで DOM ノードが再利用される (同一参照のまま順序だけ変わる)', async () => {
    const app = setupApp();
    const handle = createApp(
      '#app',
      {
        items: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ] as Item[],
      },
      (s) => ({
        tag: 'ul',
        children: s.items.map((i: Item) => ({ tag: 'li', key: i.id, children: [i.label] })),
      }),
    );
    await flush();

    const liA = app.querySelectorAll('li')[0]!;
    const liB = app.querySelectorAll('li')[1]!;
    const liC = app.querySelectorAll('li')[2]!;

    handle.items = [
      { id: 'c', label: 'C' },
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    await flush();

    const after = app.querySelectorAll('li');
    expect(after[0]).toBe(liC);
    expect(after[1]).toBe(liA);
    expect(after[2]).toBe(liB);
  });

  it('中央への挿入で前後のノードが再利用される', async () => {
    const app = setupApp();
    const handle = createApp(
      '#app',
      {
        items: [
          { id: 'a', label: 'A' },
          { id: 'c', label: 'C' },
        ] as Item[],
      },
      (s) => ({
        tag: 'ul',
        children: s.items.map((i: Item) => ({ tag: 'li', key: i.id, children: [i.label] })),
      }),
    );
    await flush();
    const liA = app.querySelectorAll('li')[0]!;
    const liC = app.querySelectorAll('li')[1]!;

    handle.items = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];
    await flush();

    const after = app.querySelectorAll('li');
    expect(after).toHaveLength(3);
    expect(after[0]).toBe(liA);
    expect(after[2]).toBe(liC);
    expect(after[1]!.textContent).toBe('B');
  });

  it('削除されたノードは DOM から除去される', async () => {
    const app = setupApp();
    const handle = createApp(
      '#app',
      {
        items: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ] as Item[],
      },
      (s) => ({
        tag: 'ul',
        children: s.items.map((i: Item) => ({ tag: 'li', key: i.id, children: [i.label] })),
      }),
    );
    await flush();

    handle.items = [{ id: 'b', label: 'B' }];
    await flush();

    const after = app.querySelectorAll('li');
    expect(after).toHaveLength(1);
    expect(after[0]!.textContent).toBe('B');
  });

  it('key の無い兄弟は position-based と同様に扱われる (混在時の後方互換)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { show: false }, (s) => ({
      tag: 'div',
      children: [
        { tag: 'span', key: 'fixed', children: ['fixed'] },
        s.show ? { tag: 'span', children: ['extra'] } : null,
      ],
    }));
    await flush();
    expect(app.querySelectorAll('span')).toHaveLength(1);

    handle.show = true;
    await flush();
    expect(app.querySelectorAll('span')).toHaveLength(2);
    expect(app.querySelectorAll('span')[1]!.textContent).toBe('extra');
  });
});
