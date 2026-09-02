// 実ブラウザ回帰テスト: createDialog の focus trap (設計書 F、付録 E)。
// jsdom はレイアウト・visibility を持たず offsetParent/フォーカス許可判定が
// 実ブラウザと異なるため、Tab 循環・Esc 復帰の「実フォーカス移動」はここで確認する。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { createDialog } from '../../src/ui/dialog.js';
import { uiButton } from '../../src/ui/button.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

// CSS を読み込んでおく (実 CSS アニメーションの animationend で焦点移動・
// クローズ処理が完了する。ANIMATION_FALLBACK_MS の backstop 経由ではなく
// 本来の経路を検証するため)。
injectStyles(document);

describe('実ブラウザ: createDialog の focus trap', () => {
  it('開くと最初の focusable 要素にフォーカスが移る', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () =>
      dlg
        ? dlg({
            triggerChildren: ['開く'],
            title: 't',
            children: [uiButton({ children: ['最初'] }), uiButton({ children: ['次'] })],
          })
        : null,
    );
    dlg = handle.use(createDialog());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    // エントランスアニメーション終了 (onanimationend) を待つ
    await new Promise((r) => setTimeout(r, 300));

    // DOM 順で最初の focusable 要素はヘッダーの ✕ (close) ボタン (body の項目より先)。
    const firstFocusable = app.querySelector('[role="dialog"] button')!;
    expect(firstFocusable.className).toBe('ric-dialog__close');
    expect(document.activeElement).toBe(firstFocusable);
  });

  it('Tab / Shift+Tab がダイアログ内でループする (focus trap)', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () =>
      dlg
        ? dlg({
            triggerChildren: ['開く'],
            title: 't',
            children: [uiButton({ children: ['A'] }), uiButton({ children: ['B'] })],
          })
        : null,
    );
    dlg = handle.use(createDialog());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 300));

    const closeBtn = app.querySelector('.ric-dialog__close') as HTMLElement;
    const [itemA, itemB] = Array.from(app.querySelectorAll('.ric-dialog__body button')) as HTMLElement[];

    // フォーカス可能要素は DOM 順で [close, A, B]。開いた直後は close (最初の focusable)。
    expect(document.activeElement).toBe(closeBtn);
    await userEvent.tab();
    expect(document.activeElement).toBe(itemA);
    await userEvent.tab();
    expect(document.activeElement).toBe(itemB);
    await userEvent.tab(); // 最後 (B) から Tab すると先頭 (close) へループ
    expect(document.activeElement).toBe(closeBtn);
    await userEvent.tab({ shift: true }); // Shift+Tab で先頭 (close) から末尾 (B) へループ
    expect(document.activeElement).toBe(itemB);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(itemA);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('Esc で閉じ、起動元 (trigger ボタン) へフォーカスが復帰する', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () => (dlg ? dlg({ triggerChildren: ['開く'], title: 't', children: [uiButton({ children: ['x'] })] }) : null));
    dlg = handle.use(createDialog());
    await flush();

    const trigger = app.querySelector('button')!;
    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 300));
    expect(app.querySelector('[role="dialog"]')).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    await new Promise((r) => setTimeout(r, 300)); // exit アニメーション終了を待つ

    expect(app.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('背景 (トリガーボタン側) が inert になる', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', { count: 0 }, (s) =>
      dlg
        ? [
            { tag: 'button', id: 'outside', children: [String(s.count)] },
            dlg({ triggerChildren: ['開く'], title: 't', children: ['本文'] }),
          ]
        : null,
    );
    dlg = handle.use(createDialog());
    await flush();

    const outside = app.querySelector('#outside') as HTMLElement;
    expect(outside.inert).toBe(false);

    await userEvent.click(app.querySelectorAll('button')[1]!); // trigger は 2 番目
    await new Promise((r) => setTimeout(r, 300));
    expect(outside.inert).toBe(true);

    await userEvent.keyboard('{Escape}');
    await new Promise((r) => setTimeout(r, 300));
    expect(outside.inert).toBe(false);
  });
});
