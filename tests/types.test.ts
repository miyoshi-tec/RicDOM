// 型テスト (設計書 §2 G2: 型でオブジェクトツリーの補完・検査が効く)。
// expect-type の expectTypeOf は型レベルのアサーションで実行時は no-op。
// 「型エラーになるべき」ケースは `@ts-expect-error` で表現する (次の行が実際に型エラーに
// ならないと `tsc --noEmit` 自体がこのディレクティブを "unused" として弾くため、
// これ自体が生きた回帰テストになる)。

import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'expect-type';
import { createApp } from '../src/app.js';
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

describe('型テスト: createApp(target, state, render) の 3 引数 (設計書 §12)', () => {
  it('render 内の `s` は state から推論され、既知プロパティは正しい型で補完される', () => {
    // render を第 3 引数として独立させたことで、state に「render を同梱する」形の
    // 自己参照が無くなり、render コールバック内の `s` が `any` に落ちずに完全に型付く
    // ことを確認する (Phase 1 実装での確定事項)。
    createApp('#app', { count: 0 }, (s) => {
      expectTypeOf(s.count).toEqualTypeOf<number>();
      return { tag: 'div', children: [String(s.count)] };
    });
    expect(true).toBe(true);
  });

  it('render 内で state に存在しないプロパティへのアクセスは型エラーになる', () => {
    createApp('#app', { count: 0 }, (s) => {
      // @ts-expect-error -- `nope` は state に存在しないプロパティ
      const _bad = s.nope;
      return { tag: 'div' };
    });
    expect(true).toBe(true);
  });

  it('state に render を同梱する v1 形式のオーバーロードは存在しない (2 引数呼び出しは型エラー)', () => {
    // @ts-expect-error -- render を state に同梱する 2 引数の呼び出しは canon から削除された
    createApp('#app', { count: 0, render: (s: { count: number }) => ({ tag: 'div', children: [s.count] }) });
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

  it('tag は型上必須。省略 ({}) は型エラーになる (Phase 1 実装での確定事項、設計書 §12)', () => {
    // @ts-expect-error -- tag が無いノードは RicElementNode を満たさない (v1 の暗黙 div 扱いは廃止)
    const bad: RicElementNode = {};
    expect(true).toBe(true);
  });

  it('tag のみでも RicElementNode として妥当 (必須なのは tag だけ)', () => {
    const ok: RicElementNode = { tag: 'div' };
    expect(ok.tag).toBe('div');
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
