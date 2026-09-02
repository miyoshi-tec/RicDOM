// uiText (設計書 §3.4、variant → タグ/class マッピング)

import { describe, expect, it } from 'vitest';
import { uiText } from '../../src/ui/text.js';

interface TestTextNode {
  tag: string;
  class: string;
  style?: Record<string, unknown>;
  'data-ricdom-role'?: string;
  children: unknown[];
  [key: string]: unknown;
}

describe('uiText', () => {
  it('既定 (variant: default) は tag:span, class:ric-text', () => {
    const node = uiText({ children: ['hi'] }) as unknown as TestTextNode;
    expect(node.tag).toBe('span');
    expect(node.class).toBe('ric-text');
    expect(node['data-ricdom-role']).toBe('text');
    expect(node.children).toEqual(['hi']);
  });

  it('variant: muted は class に修飾子が付き tag は span のまま', () => {
    const node = uiText({ variant: 'muted' }) as unknown as TestTextNode;
    expect(node.tag).toBe('span');
    expect(node.class).toBe('ric-text ric-text--muted');
  });

  it('variant: title は tag:h2 になる', () => {
    const node = uiText({ variant: 'title' }) as unknown as TestTextNode;
    expect(node.tag).toBe('h2');
    expect(node.class).toBe('ric-text ric-text--title');
  });

  it('variant: label は tag:label になる', () => {
    const node = uiText({ variant: 'label' }) as unknown as TestTextNode;
    expect(node.tag).toBe('label');
    expect(node.class).toBe('ric-text ric-text--label');
  });

  it('style を渡すと透過される (未指定なら省略される)', () => {
    const withStyle = uiText({ style: { color: 'red' } }) as unknown as TestTextNode;
    expect(withStyle.style).toEqual({ color: 'red' });
    const withoutStyle = uiText() as unknown as TestTextNode;
    expect('style' in withoutStyle).toBe(false);
  });

  it('rest スプレッドで id/class 等を透過する', () => {
    const node = uiText({ id: 't1', class: 'extra' }) as unknown as TestTextNode;
    expect(node.id).toBe('t1');
    expect(node.class).toBe('ric-text extra');
  });
});
