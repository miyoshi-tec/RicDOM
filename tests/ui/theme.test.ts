// applyTheme / createTheme / exportTheme (設計書 §4)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, createTheme, createDensity, createFontSize, exportTheme } from '../../src/ui/theme.js';

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

describe('applyTheme: 無効な theme/density/fontSize の warn (2.0.0-alpha.7)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it('無効な theme 名は console.warn 1 回 + light にフォールバックする', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'nope' as unknown as 'light' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('theme "nope" は無効です');
    expect(el.style.getPropertyValue('color-scheme')).toBe('light'); // 既定 (light) にフォールバック
  });

  it('無効な density 名は console.warn 1 回 + comfortable にフォールバックする', () => {
    const el = document.createElement('div');
    applyTheme(el, { density: 'md' as unknown as 'comfortable' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('density "md" は無効です');
    expect(el.style.getPropertyValue('--ric-control-h')).toBe('36px'); // comfortable の値
  });

  it('無効な fontSize 名は console.warn 1 回 + md にフォールバックする', () => {
    const el = document.createElement('div');
    applyTheme(el, { fontSize: 'huge' as unknown as 'md' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('fontSize "huge" は無効です');
    expect(el.style.getPropertyValue('--ric-font-size')).toBe('14px'); // md の値
  });

  it('applyTheme を呼ぶたびに warn する (「1 回だけ」memo ではない)', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'nope' as unknown as 'light' });
    applyTheme(el, { theme: 'nope' as unknown as 'light' });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('有効な文字列名では warn しない', () => {
    const el = document.createElement('div');
    applyTheme(el, { theme: 'dark', density: 'compact', fontSize: 'lg' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ThemeVars (object) を渡した場合は warn しない (theme/density/fontSize いずれも)', () => {
    const el = document.createElement('div');
    applyTheme(el, {
      theme: { '--ric-color-fg': '#000' },
      density: { '--ric-gap': '2px' },
      fontSize: { '--ric-font-size': '20px' },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('省略時 (undefined) は warn しない', () => {
    const el = document.createElement('div');
    applyTheme(el, {});
    expect(warnSpy).not.toHaveBeenCalled();
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

describe('createDensity: v1 create_density 継承 (2.0.0-alpha.10)', () => {
  it('3 名前 (comfortable/compact/tight) それぞれの寸法値を返す', () => {
    expect(createDensity('comfortable')['--ric-control-h']).toBe('36px');
    expect(createDensity('compact')['--ric-control-h']).toBe('28px');
    expect(createDensity('tight')['--ric-control-h']).toBe('22px');
  });

  it('省略時は comfortable が既定', () => {
    expect(createDensity()).toEqual(createDensity('comfortable'));
  });

  it('overrides で個別の変数を上書きできる (継承していない値はベースのまま)', () => {
    const custom = createDensity('compact', { '--ric-gap': '2px' });
    expect(custom['--ric-gap']).toBe('2px');
    expect(custom['--ric-pad-x']).toBe('10px'); // compact のまま (上書きしていない)
  });

  it('ThemeVars (object) を直接渡すとそのまま (name 解決をバイパス)', () => {
    const custom = createDensity({ '--ric-control-h': '99px' });
    expect(custom).toEqual({ '--ric-control-h': '99px' });
  });

  it('applyTheme との round-trip: createDensity(\'compact\') を渡した結果が SIZE_VARS_COMPACT と一致する', () => {
    const el = document.createElement('div');
    applyTheme(el, { density: createDensity('compact') });
    expect(el.style.getPropertyValue('--ric-control-h')).toBe('28px');
    expect(el.style.getPropertyValue('--ric-gap')).toBe('4px');
    expect(el.style.getPropertyValue('--ric-pad-x')).toBe('10px');
    expect(el.style.getPropertyValue('--ric-pad-y')).toBe('4px');
  });
});

describe('createFontSize: v1 create_font_size 継承 (2.0.0-alpha.10)', () => {
  it('3 名前 (sm/md/lg) それぞれのフォントサイズを返す', () => {
    expect(createFontSize('sm')['--ric-font-size']).toBe('12px');
    expect(createFontSize('md')['--ric-font-size']).toBe('14px');
    expect(createFontSize('lg')['--ric-font-size']).toBe('16px');
  });

  it('省略時は md が既定', () => {
    expect(createFontSize()).toEqual(createFontSize('md'));
  });

  it('overrides で上書きできる', () => {
    const custom = createFontSize('sm', { '--ric-font-size': '10px' });
    expect(custom['--ric-font-size']).toBe('10px');
  });

  it('ThemeVars (object) を直接渡すとそのまま (name 解決をバイパス)', () => {
    const custom = createFontSize({ '--ric-font-size': '99px' });
    expect(custom).toEqual({ '--ric-font-size': '99px' });
  });

  it('applyTheme との round-trip: createFontSize(\'lg\') を渡した結果が FONT_VARS_LG と一致する', () => {
    const el = document.createElement('div');
    applyTheme(el, { fontSize: createFontSize('lg') });
    expect(el.style.getPropertyValue('--ric-font-size')).toBe('16px');
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
