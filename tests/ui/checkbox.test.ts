// uiCheckbox (設計書 §3.4、隔離契約: checked/onchange は内部 input 限定)

import { describe, expect, it, vi } from 'vitest';
import { uiCheckbox } from '../../src/ui/checkbox.js';

interface TestInputNode {
  tag: string;
  type: string;
  checked: boolean;
  disabled?: boolean;
  onchange?: (ev: unknown) => void;
}
interface TestSpanNode {
  tag: string;
  children: unknown[];
}
interface TestLabelNode {
  tag: string;
  class: string;
  'data-ricdom-role'?: string;
  checked?: boolean;
  onchange?: (ev: unknown) => void;
  children: [TestInputNode, TestSpanNode?];
  [key: string]: unknown;
}

describe('uiCheckbox', () => {
  it('既定は外側 label / 内側 input[type=checkbox]、checked:false', () => {
    const node = uiCheckbox() as unknown as TestLabelNode;
    expect(node.tag).toBe('label');
    expect(node.class).toBe('ric-checkbox');
    expect(node['data-ricdom-role']).toBe('checkbox');
    const input = node.children[0];
    expect(input.tag).toBe('input');
    expect(input.type).toBe('checkbox');
    expect(input.checked).toBe(false);
  });

  it('checked: true が内部 input に反映される', () => {
    const node = uiCheckbox({ checked: true }) as unknown as TestLabelNode;
    expect(node.children[0].checked).toBe(true);
  });

  it('children (ラベルテキスト) があると span で包まれる', () => {
    const node = uiCheckbox({ children: ['同意する'] }) as unknown as TestLabelNode;
    expect(node.children.length).toBe(2);
    expect((node.children[1] as unknown as { tag: string; children: unknown[] }).tag).toBe('span');
  });

  it('children が無ければ span は追加されない', () => {
    const node = uiCheckbox() as unknown as TestLabelNode;
    expect(node.children.length).toBe(1);
  });

  it('disabled: true で外側 class に修飾子が付き、内部 input にも disabled が付く', () => {
    const node = uiCheckbox({ disabled: true }) as unknown as TestLabelNode;
    expect(node.class).toBe('ric-checkbox ric-checkbox--disabled');
    expect(node.children[0].disabled).toBe(true);
  });

  it('隔離契約: onchange は外側 label に漏れず、内部 input にだけ付く', () => {
    const handler = vi.fn();
    const node = uiCheckbox({ onchange: handler }) as unknown as TestLabelNode;
    expect(node.onchange).toBeUndefined();
    expect(node.children[0].onchange).toBe(handler);
  });

  it('rest スプレッドで id/data-* 等は外側 label に付き、class は連結される', () => {
    const node = uiCheckbox({ id: 'agree', class: 'extra' }) as unknown as TestLabelNode;
    expect(node.id).toBe('agree');
    expect(node.class).toBe('ric-checkbox extra');
  });
});
