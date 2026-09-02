// island: true (設計書 §3.1) — 子孫を一切 build/patch しない契約の確認。
// v1 は「children (ctx) 省略」で暗黙に島扱いだったが、v2 は明示フラグに変更した。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('island: true', () => {
  it('island 要素は children を build しない', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', island: true, children: [{ tag: 'span', children: ['ignored'] }] }));
    await flush();
    const div = app.querySelector('div')!;
    // island の children はそもそも build されないので span は存在しない
    expect(div.querySelector('span')).toBeNull();
  });

  it('island 要素に外部から挿入した DOM は再描画後も保持される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { n: 0 }, (s) => ({
      tag: 'div',
      children: [String(s.n), { tag: 'div', ref: 'mount', island: true }],
    }));
    await flush();
    const mount = handle.refs.get('mount')! as HTMLElement;
    const manual = document.createElement('p');
    manual.textContent = 'manual-child';
    mount.appendChild(manual);

    handle.n = 1;
    await flush();
    expect(mount.contains(manual)).toBe(true);
    expect(mount.querySelector('p')!.textContent).toBe('manual-child');
  });

  it('island 要素自身の属性は通常どおり patch される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { cls: 'a' }, (s) => ({ tag: 'div', class: s.cls, island: true }));
    await flush();
    expect(app.querySelector('div')!.className).toBe('a');
    handle.cls = 'b';
    await flush();
    expect(app.querySelector('div')!.className).toBe('b');
  });

  it('island でない通常要素は children 省略時「空として管理」される (子を除去する)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { show: true }, (s) => ({
      tag: 'div',
      children: [s.show ? { tag: 'span', children: ['x'] } : null],
    }));
    await flush();
    expect(app.querySelector('span')).not.toBeNull();

    // 通常要素は子を消す (外部挿入されたノードがあっても保護しない = island との対比)
    const div = app.querySelector('div')!;
    const manual = document.createElement('p');
    div.appendChild(manual);

    handle.show = false;
    await flush();
    expect(div.querySelector('span')).toBeNull();
  });
});
