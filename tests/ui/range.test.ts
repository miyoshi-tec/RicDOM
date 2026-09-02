// uiRange (設計書 §3.4、Phase 3a、隔離契約 + wheel でのステップ増減)

import { describe, expect, it, vi } from 'vitest';
import { uiRange } from '../../src/ui/range.js';

interface TestRangeInputNode {
  tag: string;
  type: string;
  min: string;
  max: string;
  step: string;
  value: string;
  disabled?: boolean;
  oninput?: (ev: unknown) => void;
  onwheel: (ev: unknown) => void;
}
interface TestRangeValueSpan {
  tag: string;
  class: string;
  children: string[];
}
interface TestRangeNode {
  tag: string;
  class: string;
  'data-ricdom-role'?: string;
  children: [TestRangeInputNode, TestRangeValueSpan];
  [key: string]: unknown;
}

describe('uiRange', () => {
  it('既定は value:0, min:0, max:100, step:1 の range input + 値表示 span', () => {
    const node = uiRange() as unknown as TestRangeNode;
    expect(node.tag).toBe('div');
    expect(node.class).toBe('ric-range');
    expect(node['data-ricdom-role']).toBe('range');
    const [input, span] = node.children;
    expect(input.tag).toBe('input');
    expect(input.type).toBe('range');
    expect(input.value).toBe('0');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('1');
    expect(span.children).toEqual(['0']);
  });

  it('隔離契約: oninput/value は内部 input にのみ付く', () => {
    const handler = vi.fn();
    const node = uiRange({ value: 42, oninput: handler }) as unknown as TestRangeNode;
    expect((node as unknown as Record<string, unknown>).oninput).toBeUndefined();
    expect(node.children[0].oninput).toBe(handler);
    expect(node.children[0].value).toBe('42');
  });

  it('disabled: true で内部 input に disabled が付く', () => {
    const node = uiRange({ disabled: true }) as unknown as TestRangeNode;
    expect(node.children[0].disabled).toBe(true);
  });

  it('onwheel: deltaY < 0 で 1 step 増加し、oninput を合成イベントで呼ぶ', () => {
    const handler = vi.fn();
    const node = uiRange({ value: 5, step: 1, min: 0, max: 10, oninput: handler }) as unknown as TestRangeNode;
    const target = { value: '5' } as unknown as HTMLInputElement;
    node.children[0].onwheel({ preventDefault: vi.fn(), deltaY: -10, target });
    expect(target.value).toBe('6');
    expect(handler).toHaveBeenCalledWith({ target: { value: '6' } });
  });

  it('onwheel: deltaY > 0 で 1 step 減少し、max/min でクランプされる', () => {
    const node = uiRange({ value: 0, step: 5, min: 0, max: 10 }) as unknown as TestRangeNode;
    const target = { value: '0' } as unknown as HTMLInputElement;
    node.children[0].onwheel({ preventDefault: vi.fn(), deltaY: 10, target });
    expect(target.value).toBe('0'); // min でクランプ
  });

  it('rest スプレッドで id/class 等は外側 div に付く', () => {
    const node = uiRange({ id: 'volume', class: 'extra' }) as unknown as TestRangeNode;
    expect(node.id).toBe('volume');
    expect(node.class).toBe('ric-range extra');
  });
});
