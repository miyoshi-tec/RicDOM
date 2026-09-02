// createTooltip (設計書 §3.4 部品契約 + §5/付録 E a11y)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTooltip } from '../../src/ui/tooltip.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createTooltip: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない tooltip を直接呼ぶと console.error を出し null を返す', () => {
    const tip = createTooltip();
    expect(tip({ content: 'x', children: ['y'] })).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createTooltip: aria-describedby / 表示', () => {
  it('トリガーに aria-describedby が付き、対応する id を持つ tooltip 要素が hover で現れる', async () => {
    const app = setupApp();
    let tip: ReturnType<typeof createTooltip>;
    const handle = createApp('#app', {}, () => (tip ? tip({ content: 'ヒント', children: [{ tag: 'button', children: ['?'] }] }) : null));
    tip = handle.use(createTooltip());
    await flush();

    const trigger = app.querySelector('.ric-tooltip')!;
    const describedBy = trigger.getAttribute('aria-describedby')!;
    expect(describedBy).toBeTruthy();
    expect(app.querySelector(`#${describedBy}`)).toBeNull(); // まだ非表示

    trigger.dispatchEvent(new Event('mouseenter'));
    await flush();

    const popup = document.getElementById(describedBy)!;
    expect(popup).not.toBeNull();
    expect(popup.getAttribute('role')).toBe('tooltip');
    expect(popup.textContent).toBe('ヒント');
  });

  it('mouseleave で消える', async () => {
    const app = setupApp();
    let tip: ReturnType<typeof createTooltip>;
    const handle = createApp('#app', {}, () => (tip ? tip({ content: 'ヒント', children: ['x'] }) : null));
    tip = handle.use(createTooltip());
    await flush();

    const trigger = app.querySelector('.ric-tooltip')!;
    trigger.dispatchEvent(new Event('mouseenter'));
    await flush();
    expect(app.querySelector('[role="tooltip"]')).not.toBeNull();

    trigger.dispatchEvent(new Event('mouseleave'));
    await flush();
    expect(app.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('focus で表示し、Esc で消える', async () => {
    const app = setupApp();
    let tip: ReturnType<typeof createTooltip>;
    const handle = createApp('#app', {}, () => (tip ? tip({ content: 'ヒント', children: ['x'] }) : null));
    tip = handle.use(createTooltip());
    await flush();

    const trigger = app.querySelector('.ric-tooltip')!;
    trigger.dispatchEvent(new Event('focus'));
    await flush();
    expect(app.querySelector('[role="tooltip"]')).not.toBeNull();

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(app.querySelector('[role="tooltip"]')).toBeNull();
  });
});
