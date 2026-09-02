// uiInlineMenu (設計書 §3.4: 状態を持たない純粋関数部品、Phase 3b)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { uiInlineMenu } from '../../src/ui/inlineMenu.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('uiInlineMenu: open', () => {
  it('open:false は null を返す (render 結果ごと消える)', () => {
    expect(uiInlineMenu({ open: false, children: ['x'] })).toBeNull();
  });

  it('open:true は role="menu" の div を返す', () => {
    const node = uiInlineMenu({ open: true, children: ['x'] }) as unknown as { tag: string; role: string; 'data-ricdom-role': string };
    expect(node.tag).toBe('div');
    expect(node.role).toBe('menu');
    expect(node['data-ricdom-role']).toBe('inline-menu');
  });
});

describe('uiInlineMenu: anchor', () => {
  it.each([
    ['br', { top: '100%', right: 0 }],
    ['bl', { top: '100%', left: 0 }],
    ['tr', { bottom: '100%', right: 0 }],
    ['tl', { bottom: '100%', left: 0 }],
  ] as const)('anchor="%s" は対応する position スタイルを持つ', (anchor, expected) => {
    const node = uiInlineMenu({ open: true, anchor, children: [] }) as unknown as { style: Record<string, unknown> };
    for (const [k, v] of Object.entries(expected)) expect(node.style[k]).toBe(v);
    expect(node.style.position).toBe('absolute');
  });

  it('style props は anchor 由来のスタイルを上書きできる (rest 的にマージされる)', () => {
    const node = uiInlineMenu({ open: true, anchor: 'br', style: { zIndex: 999 }, children: [] }) as unknown as { style: Record<string, unknown> };
    expect(node.style.zIndex).toBe(999);
  });
});

describe('uiInlineMenu: class', () => {
  it('class 文字列は ric-inline-menu に連結される', () => {
    const node = uiInlineMenu({ open: true, class: 'extra', children: [] }) as unknown as { class: string };
    expect(node.class).toBe('ric-inline-menu extra');
  });
});

describe('uiInlineMenu: クリックの伝播抑止', () => {
  it('onclick は stopPropagation する (外クリック検知との衝突防止、v1 継承)', () => {
    const node = uiInlineMenu({ open: true, children: [] }) as unknown as { onclick: (ev: { stopPropagation: () => void }) => void };
    const stop = vi.fn();
    node.onclick({ stopPropagation: stop });
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('uiInlineMenu: onClose (Phase 3b の新規追加)', () => {
  it('onClose 省略時は Escape で何も起きない (v1 と同じ後方互換の挙動)', () => {
    const node = uiInlineMenu({ open: true, children: [] }) as unknown as { onkeydown?: (ev: unknown) => void };
    expect(node.onkeydown).toBeUndefined();
  });

  it('onClose 指定時は Escape で呼ばれる', () => {
    const onClose = vi.fn();
    const node = uiInlineMenu({ open: true, children: [], onClose }) as unknown as { onkeydown: (ev: { key: string; stopPropagation: () => void }) => void };
    const stop = vi.fn();
    node.onkeydown({ key: 'Escape', stopPropagation: stop });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);

    node.onkeydown({ key: 'Enter', stopPropagation: stop });
    expect(onClose).toHaveBeenCalledTimes(1); // Escape 以外では呼ばれない
  });
});

describe('uiInlineMenu: dev モードの親 position 警告', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it('親要素に position 指定が無いと console.warn する (rAF 後、1 度だけ)', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', children: [uiInlineMenu({ open: true, children: ['x'] })] }));
    await flush();
    await flush(); // rAF による親チェックの完了を待つ
    expect(warnSpy).toHaveBeenCalled();
    expect(app.querySelector('.ric-inline-menu')).not.toBeNull();
  });

  it('親要素に position:relative があれば警告しない', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', style: { position: 'relative' }, children: [uiInlineMenu({ open: true, children: ['x'] })] }));
    await flush();
    await flush();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
