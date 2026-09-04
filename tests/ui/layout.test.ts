// uiCol / uiRow / uiGrid / uiPanel (設計書 §3.4/§13)
// v2 には createPage が無い (設計書 §13) — テーマ変数は applyTheme(el) が当てた祖先要素から
// 継承する前提で、レイアウト部品自体は色・背景を持たない (uiPanel を除く)。

import { describe, expect, it } from 'vitest';
import { uiCol } from '../../src/ui/col.js';
import { uiGrid } from '../../src/ui/grid.js';
import { uiPanel } from '../../src/ui/panel.js';
import { uiRow } from '../../src/ui/row.js';

interface TestNode {
  tag: string;
  class: string;
  style?: Record<string, unknown>;
  inert?: boolean;
  'data-ricdom-role'?: string;
  children: unknown[];
  [key: string]: unknown;
}

describe('uiCol', () => {
  it('既定は tag:div, class:ric-col', () => {
    const node = uiCol({ children: ['a'] }) as unknown as TestNode;
    expect(node.tag).toBe('div');
    expect(node.class).toBe('ric-col');
    expect(node['data-ricdom-role']).toBe('col');
    expect(node.children).toEqual(['a']);
  });

  it('rest スプレッドで id/class 等を透過する', () => {
    const node = uiCol({ id: 'c1', class: 'extra' }) as unknown as TestNode;
    expect(node.id).toBe('c1');
    expect(node.class).toBe('ric-col extra');
  });

  it('gap prop は style.gap に書かれ、属性 (data-*) には出ない (2.0.0-alpha.2 v1 parity)', () => {
    const node = uiCol({ gap: '4px' }) as unknown as TestNode;
    expect(node.style).toEqual({ gap: '4px' });
    expect('gap' in node).toBe(false); // rest 経由で setAttribute('gap',...) にならない
  });

  it('gap: number は px 化される', () => {
    const node = uiCol({ gap: 8 }) as unknown as TestNode;
    expect(node.style?.gap).toBe('8px');
  });

  it('gap と style を同時に渡すとマージされる', () => {
    const node = uiCol({ gap: 4, style: { color: 'red' } }) as unknown as TestNode;
    expect(node.style).toEqual({ color: 'red', gap: '4px' });
  });
});

describe('uiRow', () => {
  it('既定は tag:div, class:ric-row', () => {
    const node = uiRow({ children: ['a'] }) as unknown as TestNode;
    expect(node.tag).toBe('div');
    expect(node.class).toBe('ric-row');
    expect(node['data-ricdom-role']).toBe('row');
  });

  it('style を渡すと透過され、無指定なら省略される', () => {
    const withStyle = uiRow({ style: { gap: '4px' } }) as unknown as TestNode;
    expect(withStyle.style).toEqual({ gap: '4px' });
    const withoutStyle = uiRow() as unknown as TestNode;
    expect('style' in withoutStyle).toBe(false);
  });

  it('gap prop は style.gap に書かれる (2.0.0-alpha.2 v1 parity、25 箇所以上で rest 経由の属性化に崩れていた報告への対応)', () => {
    const node = uiRow({ gap: '12px' }) as unknown as TestNode;
    expect(node.style).toEqual({ gap: '12px' });
    expect('gap' in node).toBe(false);
  });

  it('gap: number は px 化される', () => {
    const node = uiRow({ gap: 8 }) as unknown as TestNode;
    expect(node.style?.gap).toBe('8px');
  });
});

describe('uiGrid', () => {
  it('既定は class:ric-grid、columns/rows/gap 未指定なら style は付かない', () => {
    const node = uiGrid({ children: ['a'] }) as unknown as TestNode;
    expect(node.tag).toBe('div');
    expect(node.class).toBe('ric-grid');
    expect(node['data-ricdom-role']).toBe('grid');
    expect('style' in node).toBe(false);
  });

  it('columns: number は "1fr 1fr ..." (n 個) に展開される', () => {
    const node = uiGrid({ columns: 3 }) as unknown as TestNode;
    expect(node.style?.gridTemplateColumns).toBe('1fr 1fr 1fr');
  });

  it('columns: string はそのまま渡される', () => {
    const node = uiGrid({ columns: '120px 1fr' }) as unknown as TestNode;
    expect(node.style?.gridTemplateColumns).toBe('120px 1fr');
  });

  it("columns: 'auto-fit 200px' は repeat(...) の省略記法として展開される", () => {
    const node = uiGrid({ columns: 'auto-fit 200px' }) as unknown as TestNode;
    expect(node.style?.gridTemplateColumns).toBe('repeat(auto-fit, minmax(200px, 1fr))');
  });

  it('rows/gap も指定できる (gap: number は px 化)', () => {
    const node = uiGrid({ rows: 2, gap: 8 }) as unknown as TestNode;
    expect(node.style?.gridTemplateRows).toBe('1fr 1fr');
    expect(node.style?.gap).toBe('8px');
  });

  it('style と columns を同時に渡すとマージされる', () => {
    const node = uiGrid({ columns: 2, style: { color: 'red' } }) as unknown as TestNode;
    expect(node.style?.color).toBe('red');
    expect(node.style?.gridTemplateColumns).toBe('1fr 1fr');
  });
});

describe('uiPanel', () => {
  it('既定は tag:section, class:ric-panel (col)、inert は付かない', () => {
    const node = uiPanel({ children: ['a'] }) as unknown as TestNode;
    expect(node.tag).toBe('section');
    expect(node.class).toBe('ric-panel');
    expect(node['data-ricdom-role']).toBe('panel');
    expect('inert' in node).toBe(false);
  });

  it("layout: 'row' で修飾子クラスが付く", () => {
    const node = uiPanel({ layout: 'row' }) as unknown as TestNode;
    expect(node.class).toBe('ric-panel ric-panel--row');
  });

  it('disabled: true で inert 属性が付く (opacity は CSS 側の [inert] セレクタが担う)', () => {
    const node = uiPanel({ disabled: true }) as unknown as TestNode;
    expect(node.inert).toBe(true);
  });

  it('rest スプレッドで id/class 等を透過する', () => {
    const node = uiPanel({ id: 'p1', class: 'extra' }) as unknown as TestNode;
    expect(node.id).toBe('p1');
    expect(node.class).toBe('ric-panel extra');
  });

  it('v1 のテーマ上書き props (theme/density/fontSize) は持たない (rest 経由でも DOM 属性として透過するだけ)', () => {
    // uiPanel は theme/density/fontSize を計算に使わない。渡しても rest 経由で
    // そのまま (無関係な) 属性として透過されるだけで、CSS 変数計算には関与しない。
    const node = uiPanel({ theme: 'dark' } as unknown as Parameters<typeof uiPanel>[0]) as unknown as TestNode;
    expect(node.class).toBe('ric-panel'); // theme によってクラスは変化しない
  });
});
