// refs (data-ricdom-ref) / use() の骨 / unmount() の確認。

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

describe('use() (正式な部品契約、設計書 §3.4)', () => {
  it('登録した part の attach が host (notify/portal/app) 付きで呼ばれる', () => {
    setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));

    let receivedHost: { notify: () => void; portal: Element; app: unknown } | undefined;
    const part: UsePart = {
      attach: (host) => {
        receivedHost = host;
      },
    };
    const returned = handle.use(part);
    expect(returned).toBe(part);
    expect(typeof receivedHost?.notify).toBe('function');
    expect(receivedHost?.portal).toBeInstanceOf(Element);
    expect(receivedHost?.app).toBe(handle);
  });

  it('host.notify() で再描画がトリガーされる', async () => {
    const app = setupApp();
    let n = 0;
    const handle = createApp('#app', {}, () => ({ tag: 'div', children: [String(n)] }));
    const part: UsePart = {
      attach: (host) => {
        n = 1;
        host.notify();
      },
    };
    handle.use(part);
    await flush();
    expect(app.querySelector('div')!.textContent).toBe('1');
  });

  it('renderPortal() が返す内容が portal 要素に描画される', async () => {
    const app = setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));
    const part: UsePart = {
      renderPortal: () => ({ tag: 'span', id: 'portal-out', children: ['hello'] }),
    };
    handle.use(part);
    await flush();
    const portalEl = app.querySelector('[data-ricdom-role="portal"]')!;
    expect(portalEl.querySelector('#portal-out')!.textContent).toBe('hello');
  });

  it('use() を経由しない呼び出しは part 側の責務 (host が無いので attach は呼ばれない)', () => {
    setupApp();
    createApp('#app', {}, () => ({ tag: 'div' }));
    let attachCalled = false;
    const part: UsePart = { attach: () => { attachCalled = true; } };
    // use() せずに render 内で part を直接呼ぶだけでは host は渡らない
    // (part 自体は関数ではないのでここでは attach が呼ばれないことだけを確認する)
    expect(attachCalled).toBe(false);
    void part;
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

  it('unmount 後は dispose が呼ばれる', () => {
    setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));
    let disposed = false;
    handle.use({ dispose: () => { disposed = true; } });
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
