// createScrollPane (設計書 §3.4 部品契約)
// follow:'bottom' で実際に scrollTop が末尾になることの確認は jsdom がレイアウトを
// 持たない (scrollHeight/clientHeight が常に 0) ため tests/browser/uiScrollPane.test.ts
// (実ブラウザ) で検証する。ここでは DOM 構造・rest スプレッド・use() 忘れ検知・
// scrollToBottom/scrollToTop が例外なく動くことを確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createScrollPane } from '../../src/ui/scrollPane.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createScrollPane: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない pane を直接呼ぶと console.error を出し null を返す', () => {
    const pane = createScrollPane();
    expect(pane({})).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createScrollPane: 構造', () => {
  it('div.ric-scroll-pane を overflow-y:auto + data-ricdom-scroll-pane-id で描画する', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({ children: [{ tag: 'span', children: ['1'] }, { tag: 'span', children: ['2'] }] }) : null));
    pane = handle.use(createScrollPane());
    await flush();

    const el = app.querySelector('.ric-scroll-pane') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.overflowY).toBe('auto');
    expect(el.hasAttribute('data-ricdom-scroll-pane-id')).toBe(true);
    expect(el.getAttribute('data-ricdom-role')).toBe('scroll-pane');
    expect(el.children.length).toBe(2);
  });

  it('rest スプレッドで class/style/id 等を透過する', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({ id: 'p1', class: 'extra', style: { maxHeight: '200px' } }) : null));
    pane = handle.use(createScrollPane());
    await flush();

    const el = app.querySelector('#p1') as HTMLElement;
    expect(el.className).toBe('ric-scroll-pane extra');
    expect(el.style.maxHeight).toBe('200px');
    expect(el.style.overflowY).toBe('auto'); // 計算済みの overflow-y は消えない
  });

  it('複数インスタンスはそれぞれ異なる data-ricdom-scroll-pane-id を持つ', async () => {
    const app = setupApp();
    let paneA: ReturnType<typeof createScrollPane>;
    let paneB: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (paneA !== undefined && paneB !== undefined ? [paneA({ id: 'a' }), paneB({ id: 'b' })] : null));
    paneA = handle.use(createScrollPane());
    paneB = handle.use(createScrollPane());
    await flush();

    const idA = app.querySelector('#a')!.getAttribute('data-ricdom-scroll-pane-id');
    const idB = app.querySelector('#b')!.getAttribute('data-ricdom-scroll-pane-id');
    expect(idA).not.toBe(idB);
  });
});

describe('createScrollPane: scrollToBottom/scrollToTop', () => {
  it('呼び出しても例外を投げず、再描画を予約する', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    let renderCount = 0;
    const handle = createApp('#app', {}, () => {
      renderCount++;
      return pane ? pane({}) : null;
    });
    pane = handle.use(createScrollPane());
    await flush();
    const before = renderCount;

    expect(() => pane!.scrollToBottom()).not.toThrow();
    await flush();
    expect(renderCount).toBeGreaterThan(before);

    expect(() => pane!.scrollToTop()).not.toThrow();
    await flush();
  });
});

// rAF + setTimeout(200ms) バックストップの二重化 (LCP #5)。requestAnimationFrame が
// 発火しない環境 (Electron の隠れウィンドウ・最小化タブ等) でも追従が効くことと、
// 両方来ても 1 回だけ適用されることを確認する (コアの scheduler.test.ts と同じ
// rAF スタブの流儀)。
describe('createScrollPane: rAF + 200ms バックストップの二重化 (LCP #5)', () => {
  let originalRaf: typeof requestAnimationFrame;
  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
  });

  it('rAF が永久に発火しない環境でも 200ms 後の setTimeout バックストップで scrollTop が更新される', async () => {
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame; // 何もしない rAF
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({}) : null));
    pane = handle.use(createScrollPane({ follow: 'bottom' }));
    // .use() 自体もコアのスケジューラ (scheduleRender) 経由で再描画を予約するだけなので、
    // rAF を止めている今回はそれも 200ms バックストップ待ちになってしまう —
    // renderNow() で同期的に初回マウントを終わらせる (この rAF スタブは
    // createScrollPane 側の 200ms バックストップだけを計測したいためのもの)。
    handle.renderNow();

    const el = app.querySelector('.ric-scroll-pane') as HTMLElement;
    // jsdom はレイアウトを持たず scrollHeight は常に 0 なので、scrollTo で観測できる
    // ように scrollHeight を明示的にスタブする (forceTo='bottom' → el.scrollTop =
    // el.scrollHeight を検証したいだけで、実レイアウトは無関係)。
    Object.defineProperty(el, 'scrollHeight', { value: 777, configurable: true });

    // scrollToBottom() 自体はコアの描画スケジューラ (host.notify = scheduleRender、
    // これも rAF+200ms バックストップの二重化を持つ) 経由で再描画を予約するだけなので、
    // ここで検証したい「createScrollPane 自身の 200ms バックストップ」の時間計測が
    // コア側の 200ms と合算されて紛れないよう、handle.renderNow() で同期的に
    // 即時再描画させる (pane() が同期的に呼ばれ、scheduleApplyScroll() だけが
    // 新たにスケジュールされる状態を作る)。
    pane!.scrollToBottom(); // forceTo='bottom' をセットする
    handle.renderNow();
    await new Promise((r) => setTimeout(r, 250)); // rAF は発火しないので 200ms バックストップ経由のはず

    expect(el.scrollTop).toBe(777);
  });

  it('rAF と 200ms バックストップの両方が来ても、scrollTop の適用は 1 回だけ (二重適用しない)', async () => {
    // 健常な rAF (即座に発火する) をスタブする。setTimeout(200ms) のバックストップも
    // 同時に張られるが、rAF 側が先に run() を呼んで applyScheduled を倒すので、
    // 200ms 後のバックストップは no-op になるはず。
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)) as unknown as typeof requestAnimationFrame;
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({}) : null));
    pane = handle.use(createScrollPane({ follow: 'bottom' }));
    handle.renderNow(); // 初回マウントを同期的に終わらせる (上のテストと同じ理由)

    const el = app.querySelector('.ric-scroll-pane') as HTMLElement;
    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true });
    let setCount = 0;
    let scrollTopValue = 0;
    Object.defineProperty(el, 'scrollTop', {
      get: () => scrollTopValue,
      set: (v: number) => {
        setCount++;
        scrollTopValue = v;
      },
      configurable: true,
    });

    pane!.scrollToBottom();
    handle.renderNow(); // コア側のスケジューラを介さず同期的に再描画し、scheduleApplyScroll() だけを検証する
    await new Promise((r) => setTimeout(r, 300)); // rAF 経由 (即時) + 200ms バックストップの両方が過ぎるまで待つ

    expect(scrollTopValue).toBe(500);
    expect(setCount).toBe(1); // 二重適用されていない
  });
});

describe('createScrollPane: dispose', () => {
  it('unmount 後は再度呼んでも描画されない', async () => {
    const app = setupApp();
    let pane: ReturnType<typeof createScrollPane>;
    const handle = createApp('#app', {}, () => (pane ? pane({}) : null));
    pane = handle.use(createScrollPane());
    await flush();
    handle.unmount();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(pane!({})).toBeNull();
    errorSpy.mockRestore();
  });
});
