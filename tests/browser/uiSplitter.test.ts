// 実ブラウザ回帰テスト: createSplitter の実ドラッグ (pointer/mouse events) と
// 矢印キーでの実リサイズ (設計書 F、付録 E: APG window splitter)。jsdom は
// getBoundingClientRect が実レイアウト値を持たないため、ドラッグ量に基づく
// リサイズの実効果はここでのみ検証できる。

import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createSplitter } from '../../src/ui/splitter.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

describe('実ブラウザ: createSplitter', () => {
  it('divider を実ドラッグするとサイドパネルの実サイズが変わり、mouseup で onResizeEnd(size) が 1 回呼ばれる', async () => {
    const app = setupApp();
    app.style.height = '400px';
    let split: ReturnType<typeof createSplitter>;
    const sizes: number[] = [];
    const handle = createApp('#app', {}, () => (split ? split({ side: [{ tag: 'div', children: ['side'] }], main: [{ tag: 'div', children: ['main'] }] }) : null));
    split = handle.use(createSplitter({ size: 200, min: 60, max: 400, onResizeEnd: (s) => sizes.push(s) }));
    await flush();

    const divider = app.querySelector('.ric-splitter__divider') as HTMLElement;
    const rect = divider.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    divider.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true, cancelable: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: startX + 80, clientY: startY, bubbles: true }));
    await flush();

    const side = app.querySelector('.ric-splitter__side') as HTMLElement;
    // side='left' の正方向ドラッグ (右へ 80px) → 200 + 80 = 280px まで拡大
    expect(side.style.flexBasis).toBe('280px');
    expect(sizes).toEqual([]); // mouseup 前はまだ呼ばれない

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();

    expect(sizes).toEqual([280]);
    expect(split!.getSize()).toBe(280);
  });

  it('min/max を超えるドラッグは clamp される', async () => {
    const app = setupApp();
    app.style.height = '400px';
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter({ size: 200, min: 60, max: 400 }));
    await flush();

    const divider = app.querySelector('.ric-splitter__divider') as HTMLElement;
    const rect = divider.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;

    divider.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: rect.top, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: startX + 10000, clientY: rect.top, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();

    expect(split!.getSize()).toBe(400); // max clamp
  });

  it('divider にフォーカスして矢印キーを押すと実際にサイズが変わる', async () => {
    const app = setupApp();
    app.style.height = '400px';
    let split: ReturnType<typeof createSplitter>;
    const sizes: number[] = [];
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter({ size: 200, min: 60, max: 400, onResizeEnd: (s) => sizes.push(s) }));
    await flush();

    const divider = app.querySelector('.ric-splitter__divider') as HTMLElement;
    divider.focus();
    expect(document.activeElement).toBe(divider);

    // side='left' は ArrowRight で拡大 (マウスドラッグの正方向と揃える)
    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await flush();
    expect(split!.getSize()).toBe(210); // KEY_STEP=10px
    expect(sizes).toEqual([210]);

    divider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await flush();
    expect(split!.getSize()).toBe(200);
    expect(sizes).toEqual([210, 200]);
  });
});
