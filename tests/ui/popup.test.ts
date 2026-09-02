// createPopup (設計書 §3.4 部品契約 + §5/付録 E a11y)。
// 実フォーカス移動 (矢印キー・Home/End) と実測位置は jsdom のレイアウト非対応のため
// tests/browser/uiPopup.test.ts (実ブラウザ) で検証する。ここでは ARIA 属性・
// menuitem 自動付与・use() 忘れ検知・openAt の入力検証を確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createPopup } from '../../src/ui/popup.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createPopup: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない popup を直接呼ぶと console.error を出し null を返す', () => {
    const menu = createPopup();
    expect(menu({ trigger: ['x'] })).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createPopup: トリガーの ARIA 属性', () => {
  it('aria-haspopup="menu" と aria-expanded を持つ', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () => (menu ? menu({ trigger: ['⋯'], children: [] }) : null));
    menu = handle.use(createPopup());
    await flush();

    const trigger = app.querySelector('button')!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('クリックで開くと role="menu" の本体が portal に現れ、項目に role="menuitem" が自動付与される', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [
              { tag: 'button', class: 'ric-button', children: ['項目 A'] },
              { tag: 'button', class: 'ric-button', children: ['項目 B'] },
            ],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    const trigger = app.querySelector('button')!;
    trigger.click();
    await flush();
    await flush(); // rAF による実測後の 2 段階目

    const body = app.querySelector('[role="menu"]');
    expect(body).not.toBeNull();
    expect(body!.getAttribute('data-ricdom-role')).toBe('popup'); // portal ルートの安定セレクタ
    const items = app.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(2);
    expect(items[0]!.className).toContain('ric-popup__item');
    expect(items[0]!.getAttribute('tabindex')).toBe('-1');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('menu.close() で閉じる', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () => (menu ? menu({ trigger: ['⋯'], children: [] }) : null));
    menu = handle.use(createPopup());
    await flush();

    app.querySelector('button')!.click();
    await flush();
    await flush();
    expect(app.querySelector('[role="menu"]')).not.toBeNull();
    expect(menu!.isOpen()).toBe(true);

    menu!.close();
    (app.querySelector('.ric-popup__body') as unknown as { onanimationend: () => void }).onanimationend();
    await flush();
    expect(app.querySelector('[role="menu"]')).toBeNull();
    expect(menu!.isOpen()).toBe(false);
  });
});

describe('createPopup: openAt の入力検証', () => {
  it('不正な point は console.error して何もしない', async () => {
    const app = setupApp();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));
    const menu = handle.use(createPopup());
    menu.openAt(null as unknown as { x: number; y: number });
    menu.openAt({ x: Number.NaN, y: 1 });
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(menu.isOpen()).toBe(false);
    errorSpy.mockRestore();
  });

  it('有効な座標で開く', async () => {
    const app = setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));
    const menu = handle.use(createPopup());
    menu.openAt({ x: 10, y: 20 });
    await flush();
    await flush();
    expect(menu.isOpen()).toBe(true);
    expect(app.querySelector('[role="menu"]')).not.toBeNull();
  });
});
