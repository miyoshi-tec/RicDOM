// 実ブラウザ回帰テスト: createDropdown の flip (viewport 下端付近で above になる、設計書 F)。
// jsdom は getBoundingClientRect/window.innerHeight による実測フローを持たないため、
// below/above の実測フリップはここでのみ検証できる。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { createDropdown } from '../../src/ui/dropdown.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

describe('実ブラウザ: createDropdown', () => {
  it('viewport 上部のトリガーは below 方向に開く (通常ケース)', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: '選択肢', children: [{ tag: 'div', children: ['項目'] }] }) : null));
    dd = handle.use(createDropdown());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100)); // rAF 実測フェーズ
    expect(app.querySelector('.ric-dropdown__body')!.className).toContain('ric-popup__body--below');
  });

  it('viewport 下端付近のトリガーは above 方向に開く (flip)', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () =>
      dd
        ? [
            { tag: 'div', style: { height: '92vh' } }, // トリガーを画面下端付近まで押し下げる
            dd({ label: '選択肢', children: Array.from({ length: 12 }, (_, i) => ({ tag: 'div', children: [`項目 ${i}`] })) }),
          ]
        : null,
    );
    dd = handle.use(createDropdown());
    await flush();

    const trigger = app.querySelector('button')!;
    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 100)); // rAF 実測フェーズ

    const body = app.querySelector('.ric-dropdown__body')!;
    expect(body.className).toContain('ric-popup__body--above');
    // above 方向では top ではなく bottom で位置決めしている (viewport をはみ出さない)
    expect((body as HTMLElement).style.top).toBe('');
    expect((body as HTMLElement).style.bottom).not.toBe('');
  });

  it('label モードでは本体の minWidth がトリガー幅に合わせて実測される', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: '幅の広いラベルです', children: [{ tag: 'div', children: ['項目'] }] }) : null));
    dd = handle.use(createDropdown());
    await flush();

    const trigger = app.querySelector('button')!;
    const triggerWidth = trigger.getBoundingClientRect().width;
    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 100));

    const body = app.querySelector('.ric-dropdown__body') as HTMLElement;
    expect(parseFloat(body.style.minWidth)).toBeCloseTo(triggerWidth, 0);
  });
});
