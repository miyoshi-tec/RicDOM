// key ベースの子要素 reconciliation (v1 tests/key_reconciliation.test.js 相当)。
// 並べ替え・中央挿入・削除で DOM ノードが再利用される (= 同一参照が保たれる) ことを確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// 兄弟内での key 重複 (#13、v1 から継承していたバグ)。修正前は重複 key を持つ子要素が
// render のたびに増殖した (map.set の上書きで prev 側の DOM がリークする)。
describe('兄弟内での key 重複 (#13)', () => {
  it('重複 key があっても子要素数は増殖しない (4 回 render しても一定)', async () => {
    const app = setupApp();
    const keys = ['a', 'b', 'b', 'b', 'c'];
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'ul',
      children: keys.map((k, i) => ({ tag: 'li', key: k, children: [`${k}#${i} r${s.n}`] })),
    }));
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(5);

    for (let r = 1; r <= 4; r++) {
      handle.n = r;
      await flush();
      expect(app.querySelectorAll('li')).toHaveLength(5);
    }

    // 最新 render のテキストが反映されている
    const texts = [...app.querySelectorAll('li')].map((li) => li.textContent);
    expect(texts).toEqual(['a#0 r4', 'b#1 r4', 'b#2 r4', 'b#3 r4', 'c#4 r4']);
    // DOM 順が children の順と一致している (key='b' の 3 要素も含めて並び順が崩れない)
    expect(texts.map((t) => t!.split('#')[0])).toEqual(['a', 'b', 'b', 'b', 'c']);
  });

  it('重複した key の DOM ノードは render 間で再利用される (同一参照)', async () => {
    const app = setupApp();
    const keys = ['a', 'b', 'b', 'c'];
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'ul',
      children: keys.map((k) => ({ tag: 'li', key: k, children: [`${k}-${s.n}`] })),
    }));
    await flush();
    const before = [...app.querySelectorAll('li')];

    handle.n = 1;
    await flush();
    const after = [...app.querySelectorAll('li')];

    expect(after).toHaveLength(before.length);
    after.forEach((el, i) => expect(el).toBe(before[i]));
  });

  it('重複が解消された次の render で余分な要素が消える', async () => {
    const app = setupApp();
    const handle = createApp('#app', { dup: true }, (s) => ({
      tag: 'ul',
      children: s.dup
        ? [
            { tag: 'li', key: 'x', children: ['x1'] },
            { tag: 'li', key: 'x', children: ['x2'] },
          ]
        : [{ tag: 'li', key: 'x', children: ['x1'] }],
    }));
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(2);

    handle.dup = false;
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(1);
    expect(app.querySelectorAll('li')[0]!.textContent).toBe('x1');
  });

  it('重複 key が number でも同じ挙動になる', async () => {
    const app = setupApp();
    const keys = [1, 2, 2, 3];
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'ul',
      children: keys.map((k, i) => ({ tag: 'li', key: k, children: [`${k}-${i}-${s.n}`] })),
    }));
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(4);

    handle.n = 1;
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(4);
    handle.n = 2;
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(4);
  });

  // 統括からの指摘 (v1 対照検証): 重複 key の救済 (unkeyed 経路へのフォールスルー) は
  // 「同じ pass で既に見た key」だけに限定する必要がある。広く倒すと、keyed/unkeyed
  // 混在リストで新規の keyed 要素が同 tag の unkeyed prev ノード (例: 編集中の input) を
  // 横取りしてしまい、無関係な要素同士で DOM/状態が入れ替わる regression になる。
  it('新規の keyed 要素は既存の unkeyed 兄弟の DOM を横取りしない (混在リストの regression 防止)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { phase: 0 }, (s) => ({
      tag: 'ul',
      children:
        s.phase === 0
          ? [
              { tag: 'li', key: 'A', children: ['A'] },
              { tag: 'li', children: ['X'] },
            ]
          : [
              { tag: 'li', key: 'B', children: ['B'] },
              { tag: 'li', children: ['X'] },
            ],
    }));
    await flush();
    const liX = app.querySelectorAll('li')[1]!;
    liX.dataset.marker = 'kept-me'; // X が「編集中」であることを模した DOM 側の独自状態

    handle.phase = 1;
    await flush();

    const after = app.querySelectorAll('li');
    expect(after).toHaveLength(2);
    expect(after[1]).toBe(liX); // X の DOM は再利用される (同一参照)
    expect(after[1]!.dataset.marker).toBe('kept-me');
    expect(after[0]!.textContent).toBe('B'); // B は新規ノード (X の DOM を奪っていない)
  });
});

describe('兄弟内での key 重複の dev 警告 (#13)', () => {
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

  it('dev では重複 key を含む render のたびに console.warn が 1 回だけ出る (初回 mount は対象外)', async () => {
    process.env.NODE_ENV = 'development';
    const app = setupApp();
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'ul',
      children: [
        { tag: 'li', key: 'x', children: [`x1-${s.n}`] },
        { tag: 'li', key: 'x', children: [`x2-${s.n}`] },
      ],
    }));
    await flush();
    // 初回 mount は buildDomNode による新規構築のみで patchChildrenByKey を経由しない
    // (比較対象の prev が無いため)。よってこの時点では警告は出ない。
    expect(warnSpy).not.toHaveBeenCalled();

    handle.n = 1;
    await flush();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    handle.n = 2;
    await flush();
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('production (NODE_ENV=production) では警告が出ない', async () => {
    process.env.NODE_ENV = 'production';
    const app = setupApp();
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'ul',
      children: [
        { tag: 'li', key: 'x', children: [`x1-${s.n}`] },
        { tag: 'li', key: 'x', children: [`x2-${s.n}`] },
      ],
    }));
    await flush();

    handle.n = 1;
    await flush();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('重複の無い通常の key-based reconciliation では警告が出ない', async () => {
    process.env.NODE_ENV = 'development';
    const app = setupApp();
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'ul',
      children: [
        { tag: 'li', key: 'a', children: [`a-${s.n}`] },
        { tag: 'li', key: 'b', children: [`b-${s.n}`] },
      ],
    }));
    await flush();

    handle.n = 1;
    await flush();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
