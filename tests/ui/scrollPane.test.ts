// createScrollPane (設計書 §3.4 部品契約)
// follow:'bottom' で実際に scrollTop が末尾になることの確認は jsdom がレイアウトを
// 持たない (scrollHeight/clientHeight が常に 0) ため tests/browser/uiScrollPane.test.ts
// (実ブラウザ) で検証する。ここでは DOM 構造・rest スプレッド・use() 忘れ検知・
// scrollToBottom/scrollToTop が例外なく動くことを確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createScrollPane } from '../../src/ui/scrollPane.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createScrollPane: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない pane を直接呼ぶと console.error を出し null を返す', () => {
    const pane = createScrollPane();
    expect(pane({})).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createScrollPane: 構造', () => {
  it('div.ric-scroll-pane を overflow-y:auto + data-ricdom-scroll-pane-id で描画する', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({ children: [{ tag: 'span', children: ['1'] }, { tag: 'span', children: ['2'] }] }) : null));
    pane = handle.use(createScrollPane());
    await flush();

    const el = app.querySelector('.ric-scroll-pane') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.overflowY).toBe('auto');
    expect(el.hasAttribute('data-ricdom-scroll-pane-id')).toBe(true);
    expect(el.getAttribute('data-ricdom-role')).toBe('scroll-pane');
    expect(el.children.length).toBe(2);
  });

  it('rest スプレッドで class/style/id 等を透過する', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({ id: 'p1', class: 'extra', style: { maxHeight: '200px' } }) : null));
    pane = handle.use(createScrollPane());
    await flush();

    const el = app.querySelector('#p1') as HTMLElement;
    expect(el.className).toBe('ric-scroll-pane extra');
    expect(el.style.maxHeight).toBe('200px');
    expect(el.style.overflowY).toBe('auto'); // 計算済みの overflow-y は消えない
  });

  it('複数インスタンスはそれぞれ異なる data-ricdom-scroll-pane-id を持つ', async () => {
    const app = setupApp();
    let paneA: ReturnType<typeof createScrollPane>;
    let paneB: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (paneA !== undefined && paneB !== undefined ? [paneA({ id: 'a' }), paneB({ id: 'b' })] : null));
    paneA = handle.use(createScrollPane());
    paneB = handle.use(createScrollPane());
    await flush();

    const idA = app.querySelector('#a')!.getAttribute('data-ricdom-scroll-pane-id');
    const idB = app.querySelector('#b')!.getAttribute('data-ricdom-scroll-pane-id');
    expect(idA).not.toBe(idB);
  });
});

describe('createScrollPane: scrollToBottom/scrollToTop', () => {
  it('呼び出しても例外を投げず、再描画を予約する', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    let renderCount = 0;
    const handle = createApp('#app', {}, () => {
      renderCount++;
      return pane ? pane({}) : null;
    });
    pane = handle.use(createScrollPane());
    await flush();
    const before = renderCount;

    expect(() => pane!.scrollToBottom()).not.toThrow();
    await flush();
    expect(renderCount).toBeGreaterThan(before);

    expect(() => pane!.scrollToTop()).not.toThrow();
    await flush();
  });
});

describe('createScrollPane: dispose', () => {
  it('unmount 後は再度呼んでも描画されない', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({}) : null));
    pane = handle.use(createScrollPane());
    await flush();
    handle.unmount();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(pane!({})).toBeNull();
    errorSpy.mockRestore();
  });
});
