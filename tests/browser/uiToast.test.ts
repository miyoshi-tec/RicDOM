// 実ブラウザ回帰テスト: createToast の aria-live 要素とフォーカス非奪取 (設計書 F、付録 E)。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { createToast } from '../../src/ui/toast.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('実ブラウザ: createToast', () => {
  it('role="status" + aria-live="polite" の要素が現れ、フォーカスは奪わない', async () => {
    const app = setupApp();
    let toast: ReturnType<typeof createToast>;
    const handle = createApp('#app', {}, () => {
      toast?.();
      return { tag: 'button', id: 'btn', children: ['x'] };
    });
    toast = handle.use(createToast());
    await flush();

    const btn = app.querySelector('#btn') as HTMLElement;
    await userEvent.click(btn);
    expect(document.activeElement).toBe(btn);

    toast!.show('保存しました', { type: 'success' });
    await flush();

    const status = document.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(btn); // フォーカスは移動していない
  });

  it('type: error は role="alert"', async () => {
    const app = setupApp();
    let toast: ReturnType<typeof createToast>;
    const handle = createApp('#app', {}, () => {
      toast?.();
      return { tag: 'div' };
    });
    toast = handle.use(createToast());
    await flush();

    toast!.show('失敗', { type: 'error' });
    await flush();

    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });
});
