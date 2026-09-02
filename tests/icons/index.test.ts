// ricdom/icons — 同梱データの検証 (設計書付録 B A17)

import { describe, expect, it } from 'vitest';
import * as icons from '../../src/icons/index.js';
import { ICONS_BY_NAME, ICON_NAMES, svgToDescriptor } from '../../src/icons/index.js';

// index.ts の named export のうち、descriptor そのもの (ICON_NAMES/ICONS_BY_NAME/
// svgToDescriptor/型 export を除いた 36 個) を機械的に集める。
const NON_ICON_EXPORTS = new Set(['ICON_NAMES', 'ICONS_BY_NAME', 'svgToDescriptor']);
const iconEntries = Object.entries(icons).filter(([name]) => !NON_ICON_EXPORTS.has(name)) as [string, { v?: string; s?: number | null; p?: string | string[] }][];

describe('ricdom/icons: 同梱 36 個の descriptor', () => {
  it('ちょうど 36 個の named export (descriptor) を持つ', () => {
    expect(iconEntries.length).toBe(36);
  });

  it('全て p を持ち、p は string か string[] (かつ空でない)', () => {
    for (const [name, d] of iconEntries) {
      expect(d, `${name} は descriptor object`).toBeTypeOf('object');
      expect(d.p, `${name}.p が存在する`).toBeDefined();
      if (Array.isArray(d.p)) {
        expect(d.p.length, `${name}.p (配列) は空でない`).toBeGreaterThan(0);
        for (const seg of d.p) expect(typeof seg, `${name}.p の各要素は string`).toBe('string');
      } else {
        expect(typeof d.p, `${name}.p は string`).toBe('string');
        expect((d.p as string).length, `${name}.p は空文字でない`).toBeGreaterThan(0);
      }
    }
  });

  it('v が指定されていれば string、指定なしなら既定 (0 0 24 24) 相当', () => {
    for (const [name, d] of iconEntries) {
      if ('v' in d) expect(typeof d.v, `${name}.v`).toBe('string');
    }
  });

  it('s は省略 / 数値 / null のいずれか', () => {
    for (const [name, d] of iconEntries) {
      if ('s' in d) {
        expect(d.s === null || typeof d.s === 'number', `${name}.s`).toBe(true);
      }
    }
  });

  it('circleDot は s:null (fill モード)', () => {
    expect(icons.circleDot.s).toBe(null);
  });
});

describe('ricdom/icons: ICON_NAMES / ICONS_BY_NAME の対応表', () => {
  it('ICON_NAMES は camelCase export 名 → ケバブケース名の対応を 36 個持つ', () => {
    expect(Object.keys(ICON_NAMES).length).toBe(36);
    expect(ICON_NAMES.chevronDown).toBe('chevron-down');
    expect(ICON_NAMES.trash2).toBe('trash-2');
    expect(ICON_NAMES.x).toBe('x');
  });

  it('ICON_NAMES の全キーが実際の named export と一致する', () => {
    for (const camelName of Object.keys(ICON_NAMES)) {
      expect((icons as Record<string, unknown>)[camelName], `export '${camelName}' が存在する`).toBeDefined();
    }
  });

  it('ICONS_BY_NAME はケバブケース名 → descriptor で、named export と同一の値を指す', () => {
    expect(Object.keys(ICONS_BY_NAME).length).toBe(36);
    expect(ICONS_BY_NAME['chevron-down']).toBe(icons.chevronDown);
    expect(ICONS_BY_NAME['trash-2']).toBe(icons.trash2);
  });

  it('ICON_NAMES と ICONS_BY_NAME のケバブ名集合が一致する', () => {
    const fromNames = new Set(Object.values(ICON_NAMES));
    const fromByName = new Set(Object.keys(ICONS_BY_NAME));
    expect(fromNames).toEqual(fromByName);
  });
});

describe('ricdom/icons: svgToDescriptor (re-export の疎通確認)', () => {
  it('path のみの Lucide 風 SVG から descriptor を作れる', () => {
    const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
    expect(svgToDescriptor(svg)).toEqual({ p: 'M20 6 9 17l-5-5' });
  });
});
