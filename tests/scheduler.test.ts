// 描画スケジューラ (rAF + setTimeout(200ms) バックストップ、v1 tests/scheduler_backstop.test.js 相当)。
// rAF が永久に発火しない環境 (hidden タブ・kiosk・Electron の backgroundThrottling 等) でも
// バックストップが再描画し、かつ健常な rAF 環境では二重描画しないことを確認する。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRenderScheduler } from '../src/scheduler.js';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('createRenderScheduler (低レベル)', () => {
  let originalRaf: typeof requestAnimationFrame;
  let originalCaf: typeof cancelAnimationFrame;

  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
    originalCaf = globalThis.cancelAnimationFrame;
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
  });

  it('rAF が永久に発火しない環境でも setTimeout バックストップで描画される', async () => {
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame; // 何もしない rAF
    let renderCount = 0;
    const { scheduleRender } = createRenderScheduler(() => {
      renderCount++;
    });
    scheduleRender();
    await new Promise((r) => setTimeout(r, 250));
    expect(renderCount).toBe(1);
  });

  it('バックストップ経由の描画後も、次の schedule で再度効く (永久停止しない)', async () => {
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
    let renderCount = 0;
    const { scheduleRender } = createRenderScheduler(() => {
      renderCount++;
    });
    scheduleRender();
    await new Promise((r) => setTimeout(r, 250));
    expect(renderCount).toBe(1);

    scheduleRender();
    await new Promise((r) => setTimeout(r, 250));
    expect(renderCount).toBe(2);
  });

  it('健常な rAF ならバックストップは発火せず、描画は 1 回だけ', async () => {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as unknown as typeof requestAnimationFrame;
    let renderCount = 0;
    const { scheduleRender } = createRenderScheduler(() => {
      renderCount++;
    });
    scheduleRender();
    await new Promise((r) => setTimeout(r, 350));
    expect(renderCount).toBe(1);
  });

  it('cancelPending 後は保留中の rAF/バックストップが発火しても二重描画にならない', async () => {
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
    let renderCount = 0;
    const { scheduleRender, cancelPending } = createRenderScheduler(() => {
      renderCount++;
    });
    scheduleRender();
    cancelPending();
    renderCount++; // render_now 相当の即時描画をシミュレート
    await new Promise((r) => setTimeout(r, 250));
    expect(renderCount).toBe(1);
  });
});

describe('createApp 経由の統合テスト: rAF 停止環境でも再描画される', () => {
  let originalRaf: typeof requestAnimationFrame;
  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
  });

  it('requestAnimationFrame = () => {} でもバックストップにより DOM が更新される', async () => {
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
    const app = setupApp();
    const handle = createApp('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', children: [String(s.n)] }),
    });
    expect(app.querySelector('div')!.textContent).toBe('1'); // 初回は同期描画

    handle.n = 2;
    await new Promise((r) => setTimeout(r, 250));
    expect(app.querySelector('div')!.textContent).toBe('2');
  });
});
