// normalizeNode / normalizeStyle / normalizeClass / isJsonEqual / normalizeChildren の単体テスト。
// v1 (tests/normalize_ric_node.test.js, tests/normalize_style.test.js, tests/is_json_equal.test.js) の
// コア相当を移植。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isJsonEqual, normalizeChildren, normalizeClass, normalizeNode, normalizeStyle } from '../src/normalize.js';
import type { RicElementNode } from '../src/types.js';

describe('normalizeNode', () => {
  it('文字列/数値はテキストノードになる', () => {
    expect(normalizeNode('hello')).toEqual({ kind: 'text', text: 'hello' });
    expect(normalizeNode(42)).toEqual({ kind: 'text', text: '42' });
  });

  it('null/false/undefined/空配列は不可視になる', () => {
    expect(normalizeNode(null)).toEqual({ kind: 'invisible' });
    expect(normalizeNode(false)).toEqual({ kind: 'invisible' });
    expect(normalizeNode(undefined)).toEqual({ kind: 'invisible' });
    expect(normalizeNode([])).toEqual({ kind: 'invisible' });
  });

  describe('tag 欠落 (型上は必須。実行時の防御パス)', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('tag が無いノードは console.error を出し、不可視ノードとして扱われる (v1 の暗黙 div 扱いは廃止)', () => {
      // tag は型上必須 (RicElementNode を満たさない `{}` を直接書くと型エラーになる)。
      // ここでは「型チェックを経由しない JS 利用側」を模して `as` でノードを偽装し、
      // 実行時の防御パス (console.error + 不可視) を確認する。
      const n = normalizeNode({} as RicElementNode);
      expect(n).toEqual({ kind: 'invisible' });
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  it('class は string/array/Record<string,boolean> の 3 形態を正規化できる', () => {
    const a = normalizeNode({ tag: 'div', class: 'foo bar' });
    const b = normalizeNode({ tag: 'div', class: ['foo', 'bar', ''] });
    const c = normalizeNode({ tag: 'div', class: { foo: true, bar: true, baz: false } });
    expect(a.kind === 'element' && a.class).toEqual(['foo', 'bar']);
    expect(b.kind === 'element' && b.class).toEqual(['foo', 'bar']);
    expect(c.kind === 'element' && c.class).toEqual(['foo', 'bar']);
  });

  it('children (単一値/配列) を配列として保持する', () => {
    const single = normalizeNode({ tag: 'div', children: 'x' });
    const multi = normalizeNode({ tag: 'div', children: ['a', 'b'] });
    expect(single.kind === 'element' && single.children).toEqual(['x']);
    expect(multi.kind === 'element' && multi.children).toEqual(['a', 'b']);
  });

  it('key は string/number をそのまま保持し、未指定は null になる', () => {
    const withKey = normalizeNode({ tag: 'li', key: 'a' });
    const noKey = normalizeNode({ tag: 'li' });
    expect(withKey.kind === 'element' && withKey.key).toBe('a');
    expect(noKey.kind === 'element' && noKey.key).toBe(null);
  });

  it('island: true を保持する (省略時は false)', () => {
    const island = normalizeNode({ tag: 'canvas', island: true });
    const normal = normalizeNode({ tag: 'div' });
    expect(island.kind === 'element' && island.island).toBe(true);
    expect(normal.kind === 'element' && normal.island).toBe(false);
  });

  it('tag/id/class/style/children/ref/key/island 以外は attrs に集約される', () => {
    const n = normalizeNode({ tag: 'input', type: 'text', placeholder: 'x', disabled: true });
    expect(n.kind === 'element' && n.attrs).toEqual({ type: 'text', placeholder: 'x', disabled: true });
  });
});

describe('normalizeStyle', () => {
  it('未指定は空オブジェクト', () => {
    expect(normalizeStyle(undefined)).toEqual({});
  });

  it('ハイフンケースをキャメルケースに変換する', () => {
    expect(normalizeStyle({ 'padding-top': '4px' })).toEqual({ paddingTop: '4px' });
  });

  it('CSS Custom Property (--*) は変換しない', () => {
    expect(normalizeStyle({ '--ric-color-bg': '#000' })).toEqual({ '--ric-color-bg': '#000' });
  });

  it('複数キーを同時に正規化する', () => {
    expect(normalizeStyle({ color: 'red', fontSize: 14 })).toEqual({ color: 'red', fontSize: 14 });
  });
});

describe('normalizeClass', () => {
  it('文字列は空白区切りで分割する', () => {
    expect(normalizeClass('a  b')).toEqual(['a', 'b']);
  });
  it('未指定/空文字は空配列', () => {
    expect(normalizeClass(undefined)).toEqual([]);
    expect(normalizeClass('')).toEqual([]);
  });
});

describe('isJsonEqual', () => {
  it('プリミティブの同値比較', () => {
    expect(isJsonEqual(1, 1)).toBe(true);
    expect(isJsonEqual(1, 2)).toBe(false);
    expect(isJsonEqual('a', 'a')).toBe(true);
  });

  it('配列の再帰比較 (長さ不一致は false)', () => {
    expect(isJsonEqual([1, 2], [1, 2])).toBe(true);
    expect(isJsonEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it('オブジェクトの再帰比較 (キー数不一致は false)', () => {
    expect(isJsonEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(isJsonEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('関数は参照同一性で比較する', () => {
    const fn = () => {};
    expect(isJsonEqual(fn, fn)).toBe(true);
    expect(isJsonEqual(fn, () => {})).toBe(false);
  });

  it('null と object の混在をクラッシュせず false にする', () => {
    expect(isJsonEqual(null, { a: 1 })).toBe(false);
    expect(isJsonEqual({ a: 1 }, null)).toBe(false);
  });
});

describe('normalizeChildren', () => {
  it('ネストした配列を平坦化する', () => {
    expect(normalizeChildren([['a', 'b'], 'c'])).toEqual(['a', 'b', 'c']);
  });
  it('invisible な値を除去する', () => {
    expect(normalizeChildren(['a', null, false, undefined, 'b'])).toEqual(['a', 'b']);
  });
});
