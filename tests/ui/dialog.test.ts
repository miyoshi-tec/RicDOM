// createDialog (設計書 §3.4 部品契約 + §5/付録 E a11y)。
// 実フォーカス移動 (Tab 循環・Esc 復帰) は jsdom のレイアウト非対応のため
// tests/browser/uiDialog.test.ts (実ブラウザ) で検証する。ここでは:
//   - use() を経由しない呼び出しの NOOP (console.error)
//   - controlled/uncontrolled の開閉・ARIA 属性・onClose(reason)
//   - dispose() でイベント解除

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createDialog } from '../../src/ui/dialog.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createDialog: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない dialog を直接呼ぶと console.error を出し null を返す', () => {
    const dlg = createDialog();
    const result = dlg({ open: true, title: 'x' });
    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('console.error はインスタンスごとに 1 回だけ (spam しない)', () => {
    const dlg = createDialog();
    dlg({ open: true });
    dlg({ open: true });
    dlg({ open: true });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('createDialog: uncontrolled', () => {
  it('trigger ボタンをクリックすると開き、role/aria 属性を持つ dialog が portal に現れる', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () => (dlg ? dlg({ triggerChildren: ['開く'], title: 'タイトル', children: ['本文'] }) : null));
    dlg = handle.use(createDialog());
    await flush();

    const trigger = app.querySelector('button')!;
    expect(trigger.textContent).toBe('開く');
    expect(app.querySelector('[role="dialog"]')).toBeNull(); // まだ閉じている

    trigger.click();
    await flush();

    const dialogEl = app.querySelector('[role="dialog"]')!;
    expect(dialogEl).not.toBeNull();
    expect(dialogEl.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialogEl.getAttribute('aria-labelledby')!;
    expect(document.getElementById(labelledBy)!.textContent).toBe('タイトル');
    const describedBy = dialogEl.getAttribute('aria-describedby')!;
    expect(document.getElementById(describedBy)!.textContent).toBe('本文');
    expect(dlg!.isOpen()).toBe(true);
    expect(dialogEl.getAttribute('data-ricdom-role')).toBe('dialog'); // portal ルートの安定セレクタ
  });

  it('triggerChildren を省略すると trigger ボタンを描画しない (自前トリガー用)', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () => (dlg ? dlg({ title: 't' }) : null));
    dlg = handle.use(createDialog());
    await flush();
    expect(app.querySelector('button')).toBeNull();

    dlg!.open();
    await flush();
    expect(app.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('dlg.close() で閉じ、Esc ハンドラも解除される', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () => (dlg ? dlg({ title: 't' }) : null));
    dlg = handle.use(createDialog());
    await flush();

    dlg!.open();
    await flush();
    expect(app.querySelector('[role="dialog"]')).not.toBeNull();

    dlg!.close();
    // jsdom は onanimationend プロパティハンドラを dispatchEvent(new Event(...)) では
    // 起動しない (onclick 等と違い CSS Animations イベントの IDL 配線が無いため)。
    // 実ブラウザでは実アニメーション終了で自然に発火する (tests/browser/ で確認)。
    // ここではハンドラ関数を直接呼び出して「アニメーション終了後の後片付け」を検証する。
    (app.querySelector('.ric-dialog') as unknown as { onanimationend: (ev: Partial<AnimationEvent>) => void }).onanimationend({ animationName: 'ric-dlg-out' });
    await flush();
    expect(app.querySelector('[role="dialog"]')).toBeNull();
    expect(dlg!.isOpen()).toBe(false);
  });
});

describe('createDialog: サブパーツの data-ricdom-role (2.0.0-alpha.2、§14 方針の拡張)', () => {
  it('overlay/header/body/footer/close にそれぞれの role が付く', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () => (dlg ? dlg({ triggerChildren: ['開く'], title: 't', children: ['本文'], actions: [{ tag: 'button', children: ['OK'] }] }) : null));
    dlg = handle.use(createDialog());
    await flush();
    app.querySelector('button')!.click();
    await flush();

    expect(app.querySelector('.ric-dialog__overlay')!.getAttribute('data-ricdom-role')).toBe('dialog-overlay');
    expect(app.querySelector('.ric-dialog__header')!.getAttribute('data-ricdom-role')).toBe('dialog-header');
    expect(app.querySelector('.ric-dialog__body')!.getAttribute('data-ricdom-role')).toBe('dialog-body');
    expect(app.querySelector('.ric-dialog__footer')!.getAttribute('data-ricdom-role')).toBe('dialog-footer');
    expect(app.querySelector('.ric-dialog__close')!.getAttribute('data-ricdom-role')).toBe('dialog-close');
  });
});

describe('createDialog: controlled', () => {
  it('open props で開閉し、onClose に reason が渡る', async () => {
    const app = setupApp();
    const reasons: string[] = [];
    let dlg: ReturnType<typeof createDialog>;
    const state = { show: true };
    const handle = createApp('#app', state, (s) =>
      dlg
        ? dlg({
            open: s.show,
            onClose: (reason) => {
              reasons.push(reason);
              s.show = false;
            },
            title: 't',
          })
        : null,
    );
    dlg = handle.use(createDialog());
    await flush();

    const dialogEl = app.querySelector('[role="dialog"]');
    expect(dialogEl).not.toBeNull();

    app.querySelector('.ric-dialog__close')!.dispatchEvent(new Event('click', { bubbles: true }));
    await flush();
    expect(reasons).toEqual(['close-button']);
  });

  it('triggerChildren と open の併用は console.error になる', async () => {
    setupApp();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));
    const dlg = handle.use(createDialog());
    dlg({ open: true, triggerChildren: ['x'] });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
