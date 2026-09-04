// 実ブラウザ回帰テスト: createFocusWhen (v1 focus_when の後継、2.0.0-alpha.2)。
// 実 focus() の移動 (jsdom の activeElement 追跡はブラウザの厳密な focus 挙動の近似) と、
// portal 内 ref (#2 の「portal 内 ref の 1 render 遅れ」修正) との組み合わせで、
// dialog を開いた最初の render から portal 内の ref へ正しく focus が移ることを確認する。

import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createFocusWhen } from '../../src/ui/focusWhen.js';
import { flush, setupApp } from '../_helpers/dom.js';
import type { UsePart } from '../../src/types.js';

describe('実ブラウザ: createFocusWhen', () => {
  it('立ち上がりエッジで portal 内の ref へ実際に focus が移る (#2 の portal ref 修正と組み合わせ)', async () => {
    const app = setupApp();
    let fw: ReturnType<typeof createFocusWhen>;
    const state = { open: false };
    const handle = createApp('#app', state, (s) => {
      fw?.('portalInput', s.open);
      return { tag: 'div' };
    });
    fw = handle.use(createFocusWhen());
    // dialog 等を経由せず、生の UsePart で「portal 内に ref 付き要素が現れる」最小構成を再現する。
    const part: UsePart = { renderPortal: () => (state.open ? { tag: 'input', ref: 'portalInput' } : null) };
    handle.use(part);
    await flush();
    expect(document.activeElement?.tagName).not.toBe('INPUT');

    // Proxy (handle) 経由で書く (SPEC §3 FACT: 元の state を直接書き換えても再描画されない)。
    // createReactiveState は同じオブジェクトを target にラップしているため、
    // part.renderPortal() が閉じ込めている `state` からもこの書き込みは見える。
    handle.open = true;
    await flush();
    await new Promise((r) => setTimeout(r, 60)); // nextRender().then() のマイクロタスクを待つ余裕

    const portalInput = app.querySelector('[data-ricdom-role="portal"] input');
    expect(portalInput).not.toBeNull();
    expect(document.activeElement).toBe(portalInput);
  });
});
