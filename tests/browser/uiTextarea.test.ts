// 実ブラウザ回帰テスト: uiTextarea の autoResize が実 layout で高さを変える (設計書 F)。
// jsdom は scrollHeight/getComputedStyle(line-height 等) の実レイアウト値を持たない
// (常に 0 を返す) ため、autoResize の実効果はここでのみ検証できる。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { uiTextarea } from '../../src/ui/textarea.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

describe('実ブラウザ: uiTextarea の autoResize', () => {
  it('内容量が増えると実際の高さ (getBoundingClientRect) が大きくなる', async () => {
    const app = setupApp();
    let value = '';
    createApp('#app', {}, () =>
      uiTextarea({
        value,
        autoResize: { minRows: 1, maxRows: 10 },
        oninput: (ev) => {
          value = (ev.target as HTMLTextAreaElement).value;
        },
      }),
    );
    await flush();

    const textarea = app.querySelector('textarea')!;
    const initialHeight = textarea.getBoundingClientRect().height;

    // 実際にユーザー入力で複数行に増やす (autoResize の oninput ハンドラが実測 DOM に対して走る)
    await userEvent.fill(textarea, 'line1\nline2\nline3\nline4\nline5');
    await flush();

    const grownHeight = textarea.getBoundingClientRect().height;
    expect(grownHeight).toBeGreaterThan(initialHeight);
  });

  it('maxRows を超える内容では overflowY: auto になる (無制限には伸びない)', async () => {
    const app = setupApp();
    let value = '';
    createApp('#app', {}, () =>
      uiTextarea({
        value,
        autoResize: { minRows: 1, maxRows: 2 },
        oninput: (ev) => {
          value = (ev.target as HTMLTextAreaElement).value;
        },
      }),
    );
    await flush();

    const textarea = app.querySelector('textarea')!;
    await userEvent.fill(textarea, Array.from({ length: 20 }, (_, i) => `line${i}`).join('\n'));
    await flush();

    expect(textarea.style.overflowY).toBe('auto');
  });
});
