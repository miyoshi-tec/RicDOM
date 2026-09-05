// 実ブラウザ回帰テスト: createAccordion の controlled モード (2.0.0-alpha.7)。
// jsdom でも動く内容だが、実ブラウザで aria-expanded / hidden の反映を一度も確認していなかった
// ため (createTabs 同様、controlled 系は実ブラウザ回帰の対象に含める規約)。

import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createAccordion } from '../../src/ui/accordion.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

const ITEMS = [
  { id: 'a', title: 'A', children: ['content-a'] },
  { id: 'b', title: 'B', children: ['content-b'] },
];

describe('実ブラウザ: createAccordion (controlled)', () => {
  it('外部ボタンで open props を更新すると aria-expanded と hidden に反映される', async () => {
    const app = setupApp();
    let acc: ReturnType<typeof createAccordion>;
    const state = { acc: { a: false, b: false } as Record<string, boolean> };
    const handle = createApp('#app', state, (s) =>
      acc
        ? acc({
            items: ITEMS,
            open: s.acc,
            onToggle: (_id, _next, map) => {
              handle.acc = map;
            },
          })
        : null,
    );
    acc = handle.use(createAccordion());
    await flush();

    const header = () => app.querySelectorAll('.ric-accordion__header')[0] as HTMLElement;
    const panel = () => app.querySelectorAll('.ric-accordion__body')[0] as HTMLElement;

    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(true);

    // ヘッダクリック (実ブラウザの click イベント) → onToggle 経由で親 state を更新
    header().click();
    await flush();

    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hidden).toBe(false);

    // 外部 (アプリ側) からも open を直接書き換えて閉じられる (これが controlled の要件)
    handle.acc = { a: false, b: false };
    await flush();

    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hidden).toBe(true);
  });
});
