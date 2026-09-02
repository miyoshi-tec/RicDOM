// uiCodePre (設計書 §3.4、Phase 3a)

import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiCodePre } from '../../src/ui/codePre.js';
import { _resetHljsWarningForTest } from '../../src/ui/internal/hljs.js';

interface TestCodeNode {
  tag: string;
  class: string;
  innerHTML?: string;
  children?: string[];
}
interface TestPreNode {
  tag: string;
  class: string;
  style?: Record<string, unknown>;
  'data-ricdom-role'?: string;
  children: [TestCodeNode];
  [key: string]: unknown;
}

afterEach(() => {
  _resetHljsWarningForTest();
  delete (window as unknown as { hljs?: unknown }).hljs;
});

describe('uiCodePre', () => {
  it('children のテキストをそのまま <pre><code> に表示する (hljs 未読込)', () => {
    const node = uiCodePre({ children: ['const x = 1;'] }) as unknown as TestPreNode;
    expect(node.tag).toBe('pre');
    expect(node.class).toBe('ric-code-pre');
    expect(node['data-ricdom-role']).toBe('code-pre');
    expect(node.children[0].children).toEqual(['const x = 1;']);
  });

  it('obj を渡すと JSON.stringify されて lang が json 扱いになる', () => {
    const node = uiCodePre({ obj: { a: 1 } }) as unknown as TestPreNode;
    expect(node.children[0].children).toEqual([JSON.stringify({ a: 1 }, null, 2)]);
  });

  it('obj は children より優先される', () => {
    const node = uiCodePre({ children: ['ignored'], obj: { x: 1 } }) as unknown as TestPreNode;
    expect(node.children[0].children).toEqual([JSON.stringify({ x: 1 }, null, 2)]);
  });

  it('maxHeight を指定すると style に maxHeight/overflowY が入る', () => {
    const node = uiCodePre({ children: ['x'], maxHeight: '200px' }) as unknown as TestPreNode;
    expect(node.style?.maxHeight).toBe('200px');
    expect(node.style?.overflowY).toBe('auto');
  });

  it('rest.style と maxHeight ベースの style がマージされる (rest が優先)', () => {
    const node = uiCodePre({ children: ['x'], maxHeight: '100px', style: { maxHeight: '999px', color: 'red' } }) as unknown as TestPreNode;
    expect(node.style?.maxHeight).toBe('999px');
    expect(node.style?.color).toBe('red');
    expect(node.style?.overflowY).toBe('auto');
  });

  it('hljs があればハイライトされた HTML を innerHTML として使う', () => {
    (window as unknown as { hljs: unknown }).hljs = {
      highlight: (raw: string, opts: { language: string }) => ({ value: `<span data-lang="${opts.language}">${raw}</span>` }),
      highlightAuto: (raw: string) => ({ value: `<span>${raw}</span>` }),
    };
    const node = uiCodePre({ children: ['x'], lang: 'javascript' }) as unknown as TestPreNode;
    expect(node.children[0].class).toBe('hljs');
    expect(node.children[0].innerHTML).toBe('<span data-lang="javascript">x</span>');
  });

  it("lang: 'auto' は highlightAuto を使う", () => {
    const highlightAuto = vi.fn((raw: string) => ({ value: `<b>${raw}</b>` }));
    (window as unknown as { hljs: unknown }).hljs = { highlight: vi.fn(), highlightAuto };
    const node = uiCodePre({ children: ['x'] }) as unknown as TestPreNode; // lang 既定 'auto'
    expect(highlightAuto).toHaveBeenCalledWith('x');
    expect(node.children[0].innerHTML).toBe('<b>x</b>');
  });

  it('hljs 未読込なら console.warn (初回のみ) してプレーン表示のまま', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    uiCodePre({ children: ['x'] });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    uiCodePre({ children: ['y'] });
    expect(warnSpy).toHaveBeenCalledTimes(1); // 2 回目は warn しない
    warnSpy.mockRestore();
  });

  it('rest スプレッドで id/class 等を透過する (class は連結)', () => {
    const node = uiCodePre({ children: ['x'], id: 'c1', class: 'extra' }) as unknown as TestPreNode;
    expect(node.id).toBe('c1');
    expect(node.class).toBe('ric-code-pre extra');
  });
});
