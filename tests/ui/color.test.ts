// uiColor (設計書 §3.4、hex/rgba 自動判定 + 隔離契約)

import { describe, expect, it, vi } from 'vitest';
import { uiColor } from '../../src/ui/color.js';

interface TestPickerNode {
  tag: string;
  type: string;
  class: string;
  value: string;
  disabled?: boolean;
  oninput?: (ev: unknown) => void;
}
interface TestValueSpan {
  tag: string;
  class: string;
  children: string[];
}
interface TestColorNode {
  tag: string;
  class: string;
  'data-ricdom-role'?: string;
  children: [TestPickerNode, TestValueSpan] | [TestPickerNode, { tag: string; class: string; children: [Record<string, unknown>, TestValueSpan] }];
  [key: string]: unknown;
}

describe('uiColor: hex モード', () => {
  it('既定は #000000 の hex picker + 値表示', () => {
    const node = uiColor() as unknown as TestColorNode;
    expect(node.tag).toBe('div');
    expect(node.class).toBe('ric-color');
    expect(node['data-ricdom-role']).toBe('color');
    const picker = node.children[0] as TestPickerNode;
    expect(picker.type).toBe('color');
    expect(picker.value).toBe('#000000');
  });

  it('hex 値を渡すとそのまま picker value になる', () => {
    const node = uiColor({ value: '#ff00ff' }) as unknown as TestColorNode;
    expect((node.children[0] as TestPickerNode).value).toBe('#ff00ff');
    expect((node.children[1] as TestValueSpan).children).toEqual(['#ff00ff']);
  });

  it('oninput は picker にだけ付き、picker の変更でそのまま呼ばれる', () => {
    const handler = vi.fn();
    const node = uiColor({ value: '#111111', oninput: handler }) as unknown as TestColorNode;
    const picker = node.children[0] as TestPickerNode;
    picker.oninput?.({ target: { value: '#222222' } });
    expect(handler).toHaveBeenCalledWith({ target: { value: '#222222' } });
  });

  it('disabled: true で picker に disabled が付く', () => {
    const node = uiColor({ disabled: true }) as unknown as TestColorNode;
    expect((node.children[0] as TestPickerNode).disabled).toBe(true);
  });
});

describe('uiColor: rgba モード', () => {
  it('rgba(...) を渡すと --rgba 修飾子付きの 2 段組になる', () => {
    const node = uiColor({ value: 'rgba(10,20,30,0.5)' }) as unknown as TestColorNode;
    expect(node.class).toBe('ric-color ric-color--rgba');
    const picker = node.children[0] as TestPickerNode;
    expect(picker.value).toBe('#0a141e'); // hex 変換された rgb
  });

  it('alpha スライダー変更で rgba(...) 形式の合成イベントが oninput に渡る', () => {
    const handler = vi.fn();
    const node = uiColor({ value: 'rgba(10,20,30,0.5)', oninput: handler }) as unknown as TestColorNode;
    const alphaRow = node.children[1] as { children: [Record<string, unknown>, TestValueSpan] };
    const alphaInput = alphaRow.children[0] as { oninput?: (ev: unknown) => void };
    alphaInput.oninput?.({ target: { value: '0.8' } });
    expect(handler).toHaveBeenCalledWith({ target: { value: 'rgba(10,20,30,0.8)' } });
  });

  it('rest スプレッドで id/class 等は外側 div に付く (class は連結される)', () => {
    const node = uiColor({ value: 'rgba(1,2,3,1)', id: 'bg', class: 'extra' }) as unknown as TestColorNode;
    expect(node.id).toBe('bg');
    expect(node.class).toBe('ric-color ric-color--rgba extra');
  });
});
