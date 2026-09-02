// renderNow() / nextRender() の対 (設計書 §3.3、v1 tests/render_now.test.js 相当)。
// renderNow = 強制・同期。nextRender = 観測専用・render 予約が無ければ resolve しない。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('renderNow()', () => {
  it('同期的に再描画する (rAF を待たない)', async () => {
    setupApp();
    let renderCount = 0;
    const handle = createApp('#app', { n: 1 }, (s) => {
      renderCount++;
      return { tag: 'div', children: [String(s.n)] };
    });
    const afterInit = renderCount;

    handle.n = 2;
    handle.renderNow();
    expect(renderCount).toBe(afterInit + 1);
  });

  it('renderNow 後にバックストップが発火しても二重描画にならない', async () => {
    setupApp();
    let renderCount = 0;
    const handle = createApp('#app', { n: 1 }, (s) => {
      renderCount++;
      return { tag: 'div', children: [String(s.n)] };
    });
    const afterInit = renderCount;

    handle.n = 2;
    handle.renderNow();
    expect(renderCount).toBe(afterInit + 1);

    await new Promise((r) => setTimeout(r, 250));
    expect(renderCount).toBe(afterInit + 1);
  });
});

describe('nextRender()', () => {
  it('state 変化後 await すると resolve し、DOM は新しい値になっている', async () => {
    const app = setupApp();
    const handle = createApp('#app', { n: 1 }, (s) => ({ tag: 'div', children: [String(s.n)] }));
    handle.n = 2;
    await handle.nextRender();
    expect(app.querySelector('div')!.textContent).toBe('2');
  });

  it('render 予約が無ければ resolve しない', async () => {
    setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div', children: ['x'] }));

    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 30));
    const result = await Promise.race([handle.nextRender(), timeout]);
    expect(result).toBe('timeout');
  });

  it('複数箇所からの同時 await は同じ Promise を共有し、1 回の render で全員 resolve する', async () => {
    setupApp();
    const handle = createApp('#app', { n: 1 }, (s) => ({ tag: 'div', children: [String(s.n)] }));
    const p1 = handle.nextRender();
    const p2 = handle.nextRender();
    expect(p1).toBe(p2);

    handle.n = 2;
    await Promise.all([p1, p2]);
  });

  it('renderNow() による強制描画でも resolve する', async () => {
    setupApp();
    const handle = createApp('#app', { n: 1 }, (s) => ({ tag: 'div', children: [String(s.n)] }));
    const p = handle.nextRender();
    handle.n = 2;
    handle.renderNow();
    await p;
  });

  it('resolve 後の再呼び出しは次の render を待つ新しい Promise になる', async () => {
    const app = setupApp();
    const handle = createApp('#app', { n: 1 }, (s) => ({ tag: 'div', children: [String(s.n)] }));
    const p1 = handle.nextRender();
    handle.n = 2;
    await p1;

    const p2 = handle.nextRender();
    expect(p1).not.toBe(p2);

    handle.n = 3;
    await p2;
    expect(app.querySelector('div')!.textContent).toBe('3');
  });
});
