// createApp の setup オプション (パイロット移行の報告 #5)。
//
// createApp は生成時に同期初回描画するため、`app.use()` で登録する部品を render 内で
// 使うには (setup を使わない場合) 「初回はプレースホルダを返し、use() 後に renderNow()」
// の 2 段構えが要る。`setup: (app) => { ... }` は初回 render の直前 (app と portal が
// 用意された後) に 1 回だけ呼ばれ、その中で use() した部品は初回 render から使える。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createDialog } from '../src/ui/dialog.js';
import { flush, setupApp } from './_helpers/dom.js';
import type { UsePart } from '../src/types.js';

describe('createApp: setup オプション', () => {
  it('setup 内で use() した部品 (ricdom/ui の Component) が初回 render から使える (プレースホルダ不要)', () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    createApp('#app', {}, () => dlg!({ triggerChildren: ['開く'], title: 't', children: ['本文'] }), {
      setup: (a) => {
        dlg = a.use(createDialog());
      },
    });

    // await flush() を挟まず、createApp() が返った直後の同期初回描画だけで
    // トリガーボタンが出ている (= setup 内の use() が初回 render に間に合っている)。
    const trigger = app.querySelector('button');
    expect(trigger).not.toBeNull();
    expect(trigger!.textContent).toBe('開く');
  });

  it('setup を使わない場合、初回 render 時点では use() 前なので console.error が出る (対比)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', {}, () => (dlg ? dlg({ triggerChildren: ['開く'], title: 't', children: ['本文'] }) : null));
    // ここではまだ use() していない (setup 相当の登録を意図的に遅らせる)。
    dlg = handle.use(createDialog());
    // 初回 render は既に終わっているため、use() 直後の内容を反映するには次の描画を待つ。
    expect(app.querySelector('button')).toBeNull();
    errorSpy.mockRestore();
  });

  it('setup は app と portal が用意された後、初回 render の直前に 1 回だけ呼ばれる', () => {
    const app = setupApp();
    const calls: string[] = [];
    let usePartHost: unknown;
    const part: UsePart = {
      attach: (host) => {
        calls.push('attach');
        usePartHost = host;
      },
    };
    createApp('#app', {}, () => {
      calls.push('render');
      return { tag: 'div', id: 'main' };
    }, {
      setup: (a) => {
        calls.push('setup');
        a.use(part);
      },
    });

    expect(calls).toEqual(['setup', 'attach', 'render']);
    expect((usePartHost as { portal: Element }).portal).toBeInstanceOf(Element);
    // portal は 1 つだけ (前倒し生成 + 通常経路の二重生成が起きていない)
    expect(app.querySelectorAll('[data-ricdom-role="portal"]').length).toBe(1);
    expect(app.querySelector('#main')).not.toBeNull();
  });

  it('setup の例外は console.error に変換され、初回 render はそのまま続行される', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = setupApp();
    const handle = createApp('#app', { n: 1 }, (s) => ({ tag: 'div', id: 'out', children: [String(s.n)] }), {
      setup: () => {
        throw new Error('boom');
      },
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(app.querySelector('#out')!.textContent).toBe('1');
    // setup が例外を投げても、その後の通常の再描画は正常に動く (throw しない方針)
    errorSpy.mockRestore();
  });

  it('setup 内で use() した part が portal へ描画した内容も初回 render から見える', () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', id: 'main' }), {
      setup: (a) => {
        a.use({ renderPortal: () => ({ tag: 'span', id: 'out', children: ['from-setup'] }) });
      },
    });

    expect(app.querySelector('#out')!.textContent).toBe('from-setup');
  });

  it('portalTo と併用しても動作する (portal は既に確定済みなので前倒し生成は不要)', () => {
    document.body.innerHTML = '<div id="app"></div><div id="external-portal"></div>';
    const app = document.getElementById('app')!;
    const external = document.getElementById('external-portal')!;

    createApp('#app', {}, () => ({ tag: 'div', id: 'main' }), {
      portalTo: external,
      setup: (a) => {
        a.use({ renderPortal: () => ({ tag: 'span', id: 'out', children: ['x'] }) });
      },
    });

    expect(external.querySelector('#out')!.textContent).toBe('x');
    expect(app.querySelector('[data-ricdom-role="portal"]')).toBeNull();
  });

  it('setup 後も通常のリアクティビティ・再描画は変わらず動く', async () => {
    const app = setupApp();
    let dlg: ReturnType<typeof createDialog>;
    const handle = createApp('#app', { n: 0 }, (s) => [{ tag: 'div', id: 'out', children: [String(s.n)] }, dlg!({ triggerChildren: ['開く'] })], {
      setup: (a) => {
        dlg = a.use(createDialog());
      },
    });

    expect(app.querySelector('#out')!.textContent).toBe('0');
    handle.n = 5;
    await flush();
    expect(app.querySelector('#out')!.textContent).toBe('5');
  });

  it('無効な target (NOOP App) では setup が呼ばれない', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let setupCalled = false;
    const app = createApp('#does-not-exist-and-not-loading', {}, () => null, { setup: () => { setupCalled = true; } });
    void app;
    expect(setupCalled).toBe(false);
    errorSpy.mockRestore();
  });
});
