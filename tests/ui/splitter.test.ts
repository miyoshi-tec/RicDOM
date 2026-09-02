// createSplitter (設計書 §3.4 部品契約 + 付録 E a11y、Phase 3b)
// 実ドラッグ (pointer events) と矢印キーでの実リサイズは jsdom のレイアウト非対応のため
// tests/browser/uiSplitter.test.ts (実ブラウザ) で検証する。ここでは ARIA 属性・
// controlled/uncontrolled・use() 忘れ検知・getSize/setSize を確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createSplitter } from '../../src/ui/splitter.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createSplitter: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない splitter を直接呼ぶと console.error を出し null を返す', () => {
    const split = createSplitter();
    expect(split({})).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createSplitter: 構造 / ARIA (side="left" 既定)', () => {
  it('side/divider/main の順で並び、divider に role=separator + aria-orientation=vertical を持つ', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({ side: [{ tag: 'span', children: ['S'] }], main: [{ tag: 'span', children: ['M'] }] }) : null));
    split = handle.use(createSplitter({ size: 200, min: 60, max: 400 }));
    await flush();

    const root = app.querySelector('.ric-splitter')!;
    const children = Array.from(root.children);
    expect(children[0]!.className).toContain('ric-splitter__side');
    expect(children[1]!.className).toContain('ric-splitter__divider');
    expect(children[2]!.className).toContain('ric-splitter__main');

    const divider = app.querySelector('.ric-splitter__divider')!;
    expect(divider.getAttribute('role')).toBe('separator');
    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    expect(divider.getAttribute('aria-valuenow')).toBe('200');
    expect(divider.getAttribute('aria-valuemin')).toBe('60');
    expect(divider.getAttribute('aria-valuemax')).toBe('400');
    expect(divider.getAttribute('tabindex')).toBe('0');
  });

  it('max 省略時は aria-valuemax を持たない', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter());
    await flush();
    expect(app.querySelector('.ric-splitter__divider')!.hasAttribute('aria-valuemax')).toBe(false);
  });

  it('side="right"/"top"/"bottom" で並び順と aria-orientation が変わる', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter({ side: 'top' }));
    await flush();

    const root = app.querySelector('.ric-splitter')!;
    expect(root.className).toContain('ric-splitter--vertical');
    expect(Array.from(root.children)[0]!.className).toContain('ric-splitter__side'); // top はサイドが先
    expect(app.querySelector('.ric-splitter__divider')!.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('collapsible:false では折り畳みボタンを描画しない', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter({ collapsible: false }));
    await flush();
    expect(app.querySelector('.ric-splitter__collapse-btn')).toBeNull();
  });
});

describe('createSplitter: uncontrolled の折り畳み', () => {
  it('collapse-btn クリックで toggle し、collapsed クラスが付く', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter());
    await flush();

    expect(split!.collapsed()).toBe(false);
    (app.querySelector('.ric-splitter__collapse-btn') as HTMLElement).click();
    await flush();
    expect(split!.collapsed()).toBe(true);
    expect(app.querySelector('.ric-splitter')!.className).toContain('ric-splitter--collapsed');
    expect(app.querySelector('.ric-splitter__side')!.className).toContain('ric-splitter__side--collapsed');
  });

  it('inst.toggle() でも同様に切り替わる', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter());
    await flush();
    split!.toggle();
    await flush();
    expect(split!.collapsed()).toBe(true);
  });
});

describe('createSplitter: controlled の折り畳み', () => {
  it('collapsed props で表示が決まり、ボタンクリックは onCollapseChange を呼ぶだけで内部状態を変えない', async () => {
    const app = setupApp();
    const calls: boolean[] = [];
    let split: ReturnType<typeof createSplitter>;
    const state = { collapsed: false };
    const handle = createApp('#app', state, (s) =>
      split
        ? split({
            collapsed: s.collapsed,
            onCollapseChange: (v) => {
              calls.push(v);
            },
          })
        : null,
    );
    split = handle.use(createSplitter());
    await flush();

    (app.querySelector('.ric-splitter__collapse-btn') as HTMLElement).click();
    await flush();
    expect(calls).toEqual([true]);
    // 親が collapsed を更新しない限り見た目は変わらない (controlled)
    expect(app.querySelector('.ric-splitter')!.className).not.toContain('ric-splitter--collapsed');

    handle.collapsed = true;
    await flush();
    expect(app.querySelector('.ric-splitter')!.className).toContain('ric-splitter--collapsed');
  });
});

describe('createSplitter: getSize/setSize', () => {
  it('getSize() は現在のサイズを返し、setSize() は min/max で clamp する', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter({ size: 100, min: 50, max: 200 }));
    await flush();

    expect(split!.getSize()).toBe(100);
    split!.setSize(500);
    expect(split!.getSize()).toBe(200); // max clamp
    split!.setSize(10);
    expect(split!.getSize()).toBe(50); // min clamp
  });
});

describe('createSplitter: dispose', () => {
  it('unmount 後は再登録するまで描画されない', async () => {
    const app = setupApp();
    let split: ReturnType<typeof createSplitter>;
    const handle = createApp('#app', {}, () => (split ? split({}) : null));
    split = handle.use(createSplitter());
    await flush();
    expect(app.querySelector('.ric-splitter')).not.toBeNull();

    handle.unmount();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => split!({})).not.toThrow();
    expect(split!({})).toBeNull();
    errorSpy.mockRestore();
  });
});
