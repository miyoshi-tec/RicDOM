// uiSeparator (設計書 §3.4)

import { describe, expect, it } from 'vitest';
import { uiSeparator } from '../../src/ui/separator.js';

interface TestHrNode {
  tag: string;
  class: string;
  'data-ricdom-role'?: string;
  [key: string]: unknown;
}

describe('uiSeparator', () => {
  it('既定は tag:hr, class:ric-separator', () => {
    const node = uiSeparator() as unknown as TestHrNode;
    expect(node.tag).toBe('hr');
    expect(node.class).toBe('ric-separator');
    expect(node['data-ricdom-role']).toBe('separator');
  });

  it('rest スプレッドで id/data-* 等を透過し、class は連結される', () => {
    const node = uiSeparator({ id: 'sep1', class: 'extra', 'data-testid': 'x' }) as unknown as TestHrNode;
    expect(node.id).toBe('sep1');
    expect(node.class).toBe('ric-separator extra');
    expect(node['data-testid']).toBe('x');
  });
});
