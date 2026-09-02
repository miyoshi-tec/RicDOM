// applyTheme / createTheme / exportTheme (設計書 §4)

import { describe, expect, it } from 'vitest';
import { applyTheme, createTheme, exportTheme } from '../../src/ui/theme.js';

const THEMES = ['light', 'dark', 'teal', 'cyber', 'aqua'] as const;
const DARK_LIKE = new Set(['dark', 'cyber']);

describe('applyTheme: 5 テーマの color-scheme が bg 明暗と整合する', () => {
  it.each(THEMES)('%s テーマは意図した color-scheme を持つ', (theme) => {
    const el = document.createElement('div');
    applyTheme(el, { theme });
    const expected = DARK_LIKE.has(theme) ? 'dark' : 'light';
    expect(el.style.getPropertyValue('color-scheme')).toBe(expected);
  });

  it('CSS 変数 (--ric-color-fg 等) が inline style に設定される', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'dark' });
    expect(el.style.getPropertyValue('--ric-color-fg')).toBe('#e5e7eb');
    expect(el.style.getPropertyValue('--ric-color-bg')).toBe('#111318');
  });

  it('density / fontSize も反映される', () => {
    const el = document.createElement('div');
    applyTheme(el, { density: 'compact', fontSize: 'lg' });
    expect(el.style.getPropertyValue('--ric-control-h')).toBe('28px');
    expect(el.style.getPropertyValue('--ric-font-size')).toBe('16px');
  });

  it('未指定の派生トークン (scrollbar-thumb 等) は color-mix で自動導出される', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'light' }); // 組み込みテーマは scrollbar-thumb を明示しない
    expect(el.style.getPropertyValue('--ric-scrollbar-thumb')).toContain('color-mix');
    expect(el.style.getPropertyValue('--ric-scrollbar-thumb-hover')).toContain('color-mix');
    expect(el.style.getPropertyValue('--ric-gap-md')).toContain('calc');
  });

  it('カスタムテーマで fg-muted を省略すると fg から color-mix で自動導出される', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: { '--ric-color-fg': '#000000' } });
    expect(el.style.getPropertyValue('--ric-color-fg-muted')).toContain('color-mix');
  });

  it('無効な要素を渡すと console.error して何もしない (throw しない)', () => {
    expect(() => applyTheme(null as unknown as Element)).not.toThrow();
    expect(() => applyTheme({} as Element)).not.toThrow();
  });

  it('同じ要素に複数回 applyTheme しても正しく上書きされる (テーマ切替)', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'light' });
    expect(el.style.getPropertyValue('color-scheme')).toBe('light');
    applyTheme(el, { theme: 'dark' });
    expect(el.style.getPropertyValue('color-scheme')).toBe('dark');
    expect(el.style.getPropertyValue('--ric-color-fg')).toBe('#e5e7eb');
  });

  it('data-ricdom-theme 属性を付与する (スクロールバー既定スタイルのスコープ用マーカー、設計書 §13)', () => {
    const el = document.createElement('div');
    expect(el.hasAttribute('data-ricdom-theme')).toBe(false);
    applyTheme(el, { theme: 'dark' });
    expect(el.hasAttribute('data-ricdom-theme')).toBe(true);
  });
});

describe('createTheme: 継承・上書き', () => {
  it('ベーステーマの値を継承する', () => {
    const custom = createTheme('teal');
    expect(custom['--ric-color-accent']).toBe('#007f6d');
  });

  it('overrides で個別の変数を上書きできる', () => {
    const custom = createTheme('teal', { '--ric-color-accent': '#e91e8c' });
    expect(custom['--ric-color-accent']).toBe('#e91e8c');
    expect(custom['--ric-color-fg']).toBe('#0d2b24'); // 上書きしていない値は teal のまま
  });

  it('applyTheme に渡してそのまま使える', () => {
    const el = document.createElement('div');
    const custom = createTheme('dark', { '--ric-color-accent': '#ff00ff' });
    applyTheme(el, { theme: custom });
    expect(el.style.getPropertyValue('--ric-color-accent')).toBe('#ff00ff');
    expect(el.style.getPropertyValue('color-scheme')).toBe('dark'); // dark ベースの color-scheme も継承
  });
});

describe('exportTheme: round-trip', () => {
  it('applyTheme した内容を exportTheme で取り出せる (round-trip)', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'dark' });
    const exported = exportTheme(el);
    expect(exported['color-scheme']).toBe('dark');
    expect(exported['--ric-color-fg']).toBe('#e5e7eb');
  });

  it('density / fontSize 系の変数は除外される', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'light', density: 'compact', fontSize: 'lg' });
    const exported = exportTheme(el);
    expect(exported['--ric-control-h']).toBeUndefined();
    expect(exported['--ric-font-size']).toBeUndefined();
    expect(exported['--ric-color-fg']).toBeDefined();
  });

  it('exportTheme の結果を別要素に applyTheme できる (往復)', () => {
    const el1 = document.createElement('div');
    applyTheme(el1, { theme: 'cyber' });
    const exported = exportTheme(el1);

    const el2 = document.createElement('div');
    applyTheme(el2, { theme: exported });
    expect(el2.style.getPropertyValue('color-scheme')).toBe('dark');
    expect(el2.style.getPropertyValue('--ric-color-accent')).toBe('#38bdf8');
  });

  it('無効な要素を渡すと console.error して空オブジェクトを返す', () => {
    expect(exportTheme(null as unknown as Element)).toEqual({});
  });
});
