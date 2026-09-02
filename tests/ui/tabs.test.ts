// createTabs (設計書 §3.4 部品契約 + 付録 E a11y、Phase 3b)
// 矢印キー移動で実フォーカスが動くことの確認は jsdom のフォーカス/レイアウト非対応のため
// tests/browser/uiTabs.test.ts (実ブラウザ) で検証する。ここでは構造・ARIA・
// controlled/uncontrolled・roving tabindex の状態・use() 忘れ検知を確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTabs } from '../../src/ui/tabs.js';
import { flush, setupApp } from '../_helpers/dom.js';

const ITEMS = [
  { key: 'a', label: 'A', children: [{ tag: 'span', children: ['content-a'] }] },
  { key: 'b', label: 'B', children: [{ tag: 'span', children: ['content-b'] }] },
  { key: 'c', label: 'C', children: [{ tag: 'span', children: ['content-c'] }] },
];

describe('createTabs: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない tabs を直接呼ぶと console.error を出し null を返す', () => {
    const tabs = createTabs();
    expect(tabs({ items: ITEMS })).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createTabs: 構造 / ARIA', () => {
  it('role=tablist/tab/tabpanel + aria-selected + roving tabindex', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS }) : null));
    tabs = handle.use(createTabs());
    await flush();

    expect(app.querySelector('[role="tablist"]')).not.toBeNull();
    const tabEls = Array.from(app.querySelectorAll('[role="tab"]')) as HTMLElement[];
    expect(tabEls.length).toBe(3);
    expect(tabEls[0]!.getAttribute('aria-selected')).toBe('true'); // uncontrolled 既定で先頭
    expect(tabEls[0]!.getAttribute('tabindex')).toBe('0');
    expect(tabEls[1]!.getAttribute('aria-selected')).toBe('false');
    expect(tabEls[1]!.getAttribute('tabindex')).toBe('-1');

    const panel = app.querySelector('[role="tabpanel"]')!;
    expect(panel.getAttribute('aria-labelledby')).toBe(tabEls[0]!.id);
    expect(tabEls[0]!.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('content-a');
  });

  it('variant:"pill" で ric-tabs--pill クラスが付く', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS, variant: 'pill' }) : null));
    tabs = handle.use(createTabs());
    await flush();
    expect(app.querySelector('.ric-tabs')!.className).toContain('ric-tabs--pill');
  });
});

describe('createTabs: uncontrolled', () => {
  it('クリックでアクティブが切り替わり、roving tabindex が移動する', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS }) : null));
    tabs = handle.use(createTabs());
    await flush();

    (Array.from(app.querySelectorAll('[role="tab"]'))[1] as HTMLElement).click();
    await flush();

    const tabEls = Array.from(app.querySelectorAll('[role="tab"]')) as HTMLElement[];
    expect(tabEls[1]!.getAttribute('aria-selected')).toBe('true');
    expect(tabEls[1]!.getAttribute('tabindex')).toBe('0');
    expect(tabEls[0]!.getAttribute('tabindex')).toBe('-1');
    expect(app.querySelector('[role="tabpanel"]')!.textContent).toBe('content-b');
    expect(tabs!.active()).toBe('b');
  });

  it('defaultActive で初期タブを指定できる', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS, defaultActive: 'c' }) : null));
    tabs = handle.use(createTabs());
    await flush();
    expect(app.querySelector('[role="tabpanel"]')!.textContent).toBe('content-c');
  });

  it('矢印キー (ArrowRight/Home/End) でアクティブが切り替わる (フォーカス移動自体は実ブラウザで検証)', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS }) : null));
    tabs = handle.use(createTabs());
    await flush();

    const firstTab = () => app.querySelectorAll('[role="tab"]')[0] as HTMLElement;
    firstTab().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(tabs!.active()).toBe('b');

    const activeTab = () => app.querySelector('[aria-selected="true"]') as HTMLElement;
    activeTab().dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await flush();
    expect(tabs!.active()).toBe('c');

    activeTab().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await flush();
    expect(tabs!.active()).toBe('a');
  });
});

describe('createTabs: controlled', () => {
  it('active props で表示が決まり、選択は onChange 経由でのみ反映される', async () => {
    const app = setupApp();
    const changes: string[] = [];
    let tabs: ReturnType<typeof createTabs>;
    const state = { tab: 'a' };
    const handle = createApp('#app', state, (s) =>
      tabs
        ? tabs({
            items: ITEMS,
            active: s.tab,
            onChange: (k) => {
              changes.push(k);
            },
          })
        : null,
    );
    tabs = handle.use(createTabs());
    await flush();

    (Array.from(app.querySelectorAll('[role="tab"]'))[1] as HTMLElement).click();
    await flush();
    expect(changes).toEqual(['b']);
    // 親が active を更新しない限り表示は変わらない (controlled)
    expect(app.querySelector('[role="tabpanel"]')!.textContent).toBe('content-a');

    handle.tab = 'b';
    await flush();
    expect(app.querySelector('[role="tabpanel"]')!.textContent).toBe('content-b');
  });
});

describe('createTabs: dispose', () => {
  it('unmount 後は再度呼んでも描画されない', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS }) : null));
    tabs = handle.use(createTabs());
    await flush();
    handle.unmount();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(tabs!({ items: ITEMS })).toBeNull();
    errorSpy.mockRestore();
  });
});
