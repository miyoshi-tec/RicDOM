// uiSelect (設計書 §3.4、value/option 構築順はコアが解決済み)

import { describe, expect, it, vi } from 'vitest';
import { uiSelect } from '../../src/ui/select.js';

interface TestOptionNode {
  tag: string;
  value: string;
  disabled?: boolean;
  children: string[];
}
interface TestSelectNode {
  tag: string;
  class: string;
  value: string;
  disabled?: boolean;
  'data-ricdom-role'?: string;
  onchange?: (ev: unknown) => void;
  children: TestOptionNode[];
  [key: string]: unknown;
}

describe('uiSelect', () => {
  it('文字列 options を { value, label } に正規化する', () => {
    const node = uiSelect({ value: 'b', options: ['a', 'b', 'c'] }) as unknown as TestSelectNode;
    expect(node.tag).toBe('select');
    expect(node.class).toBe('ric-select');
    expect(node['data-ricdom-role']).toBe('select');
    expect(node.value).toBe('b');
    expect(node.children.map((o) => o.value)).toEqual(['a', 'b', 'c']);
    expect(node.children[1]!.children).toEqual(['b']);
  });

  it('{ value, label } 形式の options を扱える', () => {
    const node = uiSelect({ options: [{ value: 'ja', label: '日本語' }] }) as unknown as TestSelectNode;
    expect(node.children[0]!.value).toBe('ja');
    expect(node.children[0]!.children).toEqual(['日本語']);
  });

  it('placeholder があると先頭に選択不可オプションが追加される', () => {
    const node = uiSelect({ options: ['a'], placeholder: '選んでください' }) as unknown as TestSelectNode;
    expect(node.children.length).toBe(2);
    expect(node.children[0]!.value).toBe('');
    expect(node.children[0]!.disabled).toBe(true);
    expect(node.children[0]!.children).toEqual(['選んでください']);
  });

  it('placeholder が無ければ選択不可オプションは追加されない', () => {
    const node = uiSelect({ options: ['a'] }) as unknown as TestSelectNode;
    expect(node.children.length).toBe(1);
  });

  it('rest スプレッドで onchange/disabled/id/class 等を透過する', () => {
    const handler = vi.fn();
    const node = uiSelect({ onchange: handler, disabled: true, id: 'role', class: 'extra' }) as unknown as TestSelectNode;
    expect(node.onchange).toBe(handler);
    expect(node.disabled).toBe(true);
    expect(node.id).toBe('role');
    expect(node.class).toBe('ric-select extra');
  });

  it('value は空文字でも常に含まれる', () => {
    const node = uiSelect() as unknown as TestSelectNode;
    expect('value' in node).toBe(true);
    expect(node.value).toBe('');
  });
});
