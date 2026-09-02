// 実ブラウザ回帰テスト: createTabs の矢印キー移動で実フォーカスが動く (付録 E: roving tabindex)。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { createTabs } from '../../src/ui/tabs.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

const ITEMS = [
  { key: 'a', label: 'A', children: ['content-a'] },
  { key: 'b', label: 'B', children: ['content-b'] },
  { key: 'c', label: 'C', children: ['content-c'] },
];

describe('実ブラウザ: createTabs', () => {
  it('ArrowRight/ArrowLeft で実フォーカスが隣のタブへ移動する (ループする)', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS }) : null));
    tabs = handle.use(createTabs());
    await flush();

    const tabEls = () => Array.from(app.querySelectorAll('[role="tab"]')) as HTMLElement[];
    tabEls()[0]!.focus();
    expect(document.activeElement).toBe(tabEls()[0]);

    await userEvent.keyboard('{ArrowRight}');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(tabEls()[1]);

    await userEvent.keyboard('{ArrowRight}');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(tabEls()[2]);

    await userEvent.keyboard('{ArrowRight}'); // 末尾から先頭へループ
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(tabEls()[0]);

    await userEvent.keyboard('{ArrowLeft}'); // 先頭から末尾へループ
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(tabEls()[2]);
  });

  it('Home/End で実フォーカスが先頭/末尾のタブへ移動する', async () => {
    const app = setupApp();
    let tabs: ReturnType<typeof createTabs>;
    const handle = createApp('#app', {}, () => (tabs ? tabs({ items: ITEMS }) : null));
    tabs = handle.use(createTabs());
    await flush();

    const tabEls = () => Array.from(app.querySelectorAll('[role="tab"]')) as HTMLElement[];
    tabEls()[0]!.focus();

    await userEvent.keyboard('{End}');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(tabEls()[2]);

    await userEvent.keyboard('{Home}');
    await new Promise((r) => setTimeout(r, 50));
    expect(document.activeElement).toBe(tabEls()[0]);
  });
});
