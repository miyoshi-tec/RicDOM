// createToast (設計書 §3.4 部品契約 + §5/付録 E a11y)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createToast } from '../../src/ui/toast.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createToast: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない toast を直接呼ぶと console.error を出す', () => {
    const toast = createToast();
    toast();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createToast: role/aria-live', () => {
  it('通常の toast は role="status" + aria-live="polite"', async () => {
    const app = setupApp();
    let toast: ReturnType<typeof createToast>;
    const handle = createApp('#app', {}, () => {
      toast?.();
      return { tag: 'div' };
    });
    toast = handle.use(createToast());
    await flush();

    toast!.show('保存しました');
    await flush();

    const item = app.querySelector('.ric-toast__item')!;
    expect(item.getAttribute('role')).toBe('status');
    expect(item.getAttribute('aria-live')).toBe('polite');
    expect(item.textContent).toContain('保存しました');
    expect(app.querySelector('.ric-toast__container')!.getAttribute('data-ricdom-role')).toBe('toast'); // portal ルートの安定セレクタ
  });

  it('type: error の toast は role="alert" + aria-live="assertive"', async () => {
    const app = setupApp();
    let toast: ReturnType<typeof createToast>;
    const handle = createApp('#app', {}, () => {
      toast?.();
      return { tag: 'div' };
    });
    toast = handle.use(createToast());
    await flush();

    toast!.show('エラーです', { type: 'error' });
    await flush();

    const item = app.querySelector('.ric-toast__item')!;
    expect(item.getAttribute('role')).toBe('alert');
    expect(item.getAttribute('aria-live')).toBe('assertive');
    expect(item.className).toContain('ric-toast__item--error');
  });

  it('フォーカスを奪わない (トリガー等に focus() を呼ばない)', async () => {
    const app = setupApp();
    let toast: ReturnType<typeof createToast>;
    const handle = createApp('#app', {}, () => {
      toast?.();
      return { tag: 'button', id: 'btn', children: ['x'] };
    });
    toast = handle.use(createToast());
    await flush();
    const btn = app.querySelector('#btn') as HTMLElement;
    btn.focus();
    expect(document.activeElement).toBe(btn);

    toast!.show('通知');
    await flush();
    expect(document.activeElement).toBe(btn); // フォーカスは移動しない
  });

  it('duration: 0 は自動消去しない (バックストップの 200ms を跨いでも残る)', async () => {
    const app = setupApp();
    let toast: ReturnType<typeof createToast>;
    const handle = createApp('#app', {}, () => {
      toast?.();
      return { tag: 'div' };
    });
    toast = handle.use(createToast());
    await flush();

    toast!.show('残り続ける', { duration: 0 });
    await flush(250); // スケジューラのバックストップ (200ms) を跨いでも消えないことを確認する
    const item = app.querySelector('.ric-toast__item');
    expect(item).not.toBeNull();
    expect(item!.className).not.toContain('ric-toast__item--out');
  });

  it('✕ ボタンで手動クローズできる', async () => {
    const app = setupApp();
    let toast: ReturnType<typeof createToast>;
    const handle = createApp('#app', {}, () => {
      toast?.();
      return { tag: 'div' };
    });
    toast = handle.use(createToast());
    await flush();

    toast!.show('x', { duration: 0 });
    await flush();
    expect(app.querySelector('.ric-toast__item')).not.toBeNull();

    app.querySelector('.ric-toast__close')!.dispatchEvent(new Event('click', { bubbles: true }));
    await flush(); // closing=true が再描画で反映され、onanimationend が「消去」用に張り替わるのを待つ
    expect(app.querySelector('.ric-toast__item')!.className).toContain('ric-toast__item--out');

    (app.querySelector('.ric-toast__item') as unknown as { onanimationend: () => void }).onanimationend();
    await flush();
    expect(app.querySelector('.ric-toast__item')).toBeNull();
  });
});
