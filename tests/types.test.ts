// 型テスト (設計書 §2 G2: 型でオブジェクトツリーの補完・検査が効く)。
// expect-type の expectTypeOf は型レベルのアサーションで実行時は no-op。
// 「型エラーになるべき」ケースは `@ts-expect-error` で表現する (次の行が実際に型エラーに
// ならないと `tsc --noEmit` 自体がこのディレクティブを "unused" として弾くため、
// これ自体が生きた回帰テストになる)。

import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'expect-type';
import type { App, RicElementNode, RicNode } from '../src/types.js';

describe('型テスト: App<S>', () => {
  it('state のプロパティに型付きでアクセスできる', () => {
    const fakeApp = {} as App<{ count: number }>;
    expectTypeOf(fakeApp.count).toEqualTypeOf<number>();
    expectTypeOf(fakeApp.renderNow).toEqualTypeOf<() => void>();
    expectTypeOf(fakeApp.nextRender).toEqualTypeOf<() => Promise<void>>();
    expectTypeOf(fakeApp.refs).toEqualTypeOf<ReadonlyMap<string, Element>>();
    expect(true).toBe(true);
  });
});

describe('型テスト: RicElementNode (タグ → 属性型)', () => {
  it('未知の属性は既知タグでは型エラーになる ({ tag: "input", href: "" })', () => {
    // @ts-expect-error -- HTMLInputElement に href は存在しない
    const bad: RicElementNode = { tag: 'input', href: '' };
    expect(true).toBe(true);
  });

  it('a タグには href を書ける (正の確認、input との対比)', () => {
    const ok: RicElementNode = { tag: 'a', href: 'https://example.com' };
    expect(ok.tag).toBe('a');
  });

  it('style は object のみ許可される (v1 の string 形態は廃止)', () => {
    // @ts-expect-error -- style に string は渡せない
    const bad: RicElementNode = { tag: 'div', style: 'color:red' };
    expect(true).toBe(true);
  });

  it('input には value (string) を書ける (FORCE_REAPPLY 対象キーの型導出確認)', () => {
    const ok: RicElementNode = { tag: 'input', value: 'x' };
    expect(ok.tag).toBe('input');
  });
});

describe('型テスト: RicNode', () => {
  it('children はネストした配列を受け付ける', () => {
    const tree: RicNode = {
      tag: 'ul',
      children: [{ tag: 'li', children: ['a'] }, ['b', 'c']],
    };
    expect(tree).toBeTruthy();
  });

  it('null/false/undefined/文字列/数値はいずれも RicNode として妥当', () => {
    const a: RicNode = null;
    const b: RicNode = false;
    const c: RicNode = undefined;
    const d: RicNode = 'text';
    const e: RicNode = 42;
    expect([a, b, c, d, e]).toBeDefined();
  });
});
