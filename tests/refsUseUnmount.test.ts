// refs (data-ricdom-ref) / use() の骨 (Phase 1) / unmount() の確認。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';
import type { UsePart } from '../src/types.js';

describe('refs', () => {
  it('ref 名で DOM 要素を取得できる (data-ricdom-ref 属性)', async () => {
    const app = setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div', children: [{ tag: 'input', ref: 'nameInput' }] }));
    await flush();
    const el = handle.refs.get('nameInput');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el).toBe(app.querySelector('input'));
    expect((el as HTMLElement).getAttribute('data-ricdom-ref')).toBe('nameInput');
  });

  it('render ごとに refs が再収集される', async () => {
    setupApp();
    const handle = createApp('#app', { show: true }, (s) => ({
      tag: 'div',
      children: [s.show ? { tag: 'input', ref: 'x' } : null],
    }));
    await flush();
    expect(handle.refs.get('x')).toBeTruthy();

    handle.show = false;
    await flush();
    expect(handle.refs.get('x')).toBeUndefined();
  });
});

describe('use() (Phase 1: 骨のみ)', () => {
  it('登録した part の onUse が notify 関数付きで呼ばれる', () => {
    setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));

    let receivedNotify: (() => void) | undefined;
    const part: UsePart = {
      onUse: (ctx) => {
        receivedNotify = ctx.notify;
      },
    };
    const returned = handle.use(part);
    expect(returned).toBe(part);
    expect(typeof receivedNotify).toBe('function');
  });

  it('use() 経由の notify で再描画がトリガーされる', async () => {
    const app = setupApp();
    let n = 0;
    const handle = createApp('#app', {}, () => ({ tag: 'div', children: [String(n)] }));
    const part: UsePart = {
      onUse: (ctx) => {
        n = 1;
        ctx.notify();
      },
    };
    handle.use(part);
    await flush();
    expect(app.querySelector('div')!.textContent).toBe('1');
  });
});

describe('unmount()', () => {
  it('unmount 後は state 変更で再描画されない', async () => {
    const app = setupApp();
    const handle = createApp('#app', { n: 1 }, (s) => ({ tag: 'div', children: [String(s.n)] }));
    await flush();
    handle.unmount();

    handle.n = 2;
    await flush();
    expect(app.querySelector('div')!.textContent).toBe('1'); // 変わらない
  });

  it('unmount 後は onDispose が呼ばれる', () => {
    setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));
    let disposed = false;
    handle.use({ onDispose: () => { disposed = true; } });
    handle.unmount();
    expect(disposed).toBe(true);
  });

  it('unmount は refs をクリアする', async () => {
    setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div', children: [{ tag: 'input', ref: 'x' }] }));
    await flush();
    expect(handle.refs.get('x')).toBeTruthy();
    handle.unmount();
    expect(handle.refs.get('x')).toBeUndefined();
  });
});
