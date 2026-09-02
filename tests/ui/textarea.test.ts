// uiTextarea (設計書 §3.4、v1 A15 の rest スプレッド契約継承)

import { describe, expect, it, vi } from 'vitest';
import { uiTextarea } from '../../src/ui/textarea.js';

interface TestTextareaNode {
  tag: string;
  class: string;
  rows: number;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  maxlength?: number;
  'data-ricdom-role'?: string;
  oninput?: (ev: unknown) => void;
  onkeydown?: (ev: unknown) => void;
  [key: string]: unknown;
}

describe('uiTextarea', () => {
  it('既定は tag:textarea, class:ric-textarea, rows:1, value:""', () => {
    const node = uiTextarea() as unknown as TestTextareaNode;
    expect(node.tag).toBe('textarea');
    expect(node.class).toBe('ric-textarea');
    expect(node.rows).toBe(1);
    expect(node.value).toBe('');
  });

  it('data-ricdom-role="textarea" が付与される', () => {
    const node = uiTextarea() as unknown as TestTextareaNode;
    expect(node['data-ricdom-role']).toBe('textarea');
  });

  it('rest スプレッドで onchange/id 等を透過しつつ、基底 class は保たれる', () => {
    const node = uiTextarea({ value: 'hi', class: 'extra', id: 'memo', 'data-testid': 'x' }) as unknown as TestTextareaNode;
    expect(node.class).toBe('ric-textarea extra');
    expect(node.id).toBe('memo');
    expect(node['data-testid']).toBe('x');
  });

  it('disabled: true で disabled 属性が付く', () => {
    const node = uiTextarea({ disabled: true }) as unknown as TestTextareaNode;
    expect(node.disabled).toBe(true);
  });

  it('maxlength を渡すと透過される', () => {
    const node = uiTextarea({ maxlength: 100 }) as unknown as TestTextareaNode;
    expect(node.maxlength).toBe(100);
  });

  it('autoResize 指定時は rows が min_rows に固定される', () => {
    const node = uiTextarea({ autoResize: { minRows: 3 } }) as unknown as TestTextareaNode;
    expect(node.rows).toBe(3);
  });

  it('oninput ハンドラが呼ばれる (autoResize 無指定)', () => {
    const handler = vi.fn();
    const node = uiTextarea({ oninput: handler }) as unknown as TestTextareaNode;
    const fakeEl = { value: 'typed' } as unknown as EventTarget;
    node.oninput?.({ target: fakeEl });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('autoResize 指定時、SSR 相当環境 (getComputedStyle 無し) でも oninput が例外を投げない', () => {
    const handler = vi.fn();
    const node = uiTextarea({ oninput: handler, autoResize: { minRows: 1, maxRows: 5 } }) as unknown as TestTextareaNode;
    // jsdom の HTMLTextAreaElement で検証 (scrollHeight は 0 が既定)
    const el = document.createElement('textarea');
    expect(() => node.oninput?.({ target: el })).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
