// alpha.11 の regression 修正 (2.0.0-alpha.13、パイロット第 9 号 Potopeta の差分実験で
// 特定、統括再現済み)。
//
// alpha.11 で配列も src/reactivity.ts の wrapDeepWarn (dev の深い代入警告 Proxy) で
// 包むようになった結果、canon の `app.pages = [...app.pages]` が壊れていた: spread は
// 各要素を配列 Proxy の get トラップ経由で読むため、新しい配列の中身は生オブジェクトでは
// なく wrapDeepWarn の Proxy そのものになり、それがそのまま root の set で生 state に
// 書き戻ってしまう。Potopeta の再現は以下の手順:
//   - spread 前: `util.types.isProxy(state.pages[0]) === false`
//   - spread 後 (`state.pages = [...state.pages]`): `true` になってしまう
//   - 以後、別タスクで `state.pages[0].nodes.push({})` すると、`push()` 単独のはずが
//     `push()` + `nodes[0]` + `nodes.length` の 3 件警告になる (内側 Proxy に
//     fn.apply してしまうため)
//   - spread を 3 回繰り返すと生 state 自体に Proxy が深く紛れ込み、
//     `structuredClone(state)` が DataCloneError になる
//
// 修正 (src/reactivity.ts, wrapDeepWarn 定義直前のコメント参照): (1) wrap の冪等化
// (Proxy → raw の WeakMap で常に raw を正規化してからキャッシュ・target に使う)、
// (2) root Proxy / wrapChild / wrapDeepWarn 自身の set で代入値を再帰的に unwrap する。
// このファイルは "red" (修正前は落ちる) だったことを統括が確認したうえでの "green" 化。

import { types } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReactiveState } from '../src/reactivity.js';
import { flushMicrotasks } from './_helpers/dom.js';

describe('alpha.13: 配列 spread が dev 警告 Proxy を生 state に混入させない', () => {
  let originalNodeEnv: string | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    warnSpy.mockRestore();
  });

  it('シナリオ A: push のみ (別タスク) → 警告 1 件', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState<{ pages: Array<{ nodes: unknown[] }> }>({ pages: [{ nodes: [] }] }, () => {});
    state.pages[0]!.nodes.push({});
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('pages[0].nodes.push()');
  });

  it('シナリオ B: 深い代入 → spread 差し替え (同じタスク、無警告) → 別タスクで push → 警告 1 件 (修正前は 3 件)', async () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState<{ pages: Array<{ page: { width: number }; nodes: unknown[] }> }>(
      { pages: [{ page: { width: 100 }, nodes: [] }] },
      () => {},
    );
    state.pages[0]!.page.width = 2;
    state.pages = [...state.pages]; // canon: 深く書いてから差し替えて発火
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled(); // 発火済みなので無警告 (deepAssignPendingDiscard.test.ts と同じ契約)

    // 別タスクで push だけ行う (発火忘れ) → 修正前は内側 Proxy への fn.apply により
    // push()/nodes[0]/nodes.length の 3 件になっていた。
    state.pages[0]!.nodes.push({});
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('nodes.push()');
  });

  it('spread 前後で isProxy(raw.pages[0]) は常に false (raw のまま)', () => {
    process.env.NODE_ENV = 'development';
    // `state` (rootProxy) 越しの読み取りは常に Proxy を返しうる (それ自体は仕様どおり)。
    // 検証したいのは「生 state (createReactiveState に渡した実オブジェクト) の中身に
    // Proxy が紛れ込んでいないか」なので、Proxy を経由しない `raw` を直接見る。
    const raw = { pages: [{ x: 1 }] };
    const state = createReactiveState(raw, () => {});
    expect(types.isProxy(raw.pages)).toBe(false);
    expect(types.isProxy(raw.pages[0])).toBe(false);

    state.pages = [...state.pages];
    expect(types.isProxy(raw.pages)).toBe(false);
    expect(types.isProxy(raw.pages[0])).toBe(false);
  });

  it('入れ子 spread ({ ...pages[0], nodes: [...pages[0].nodes] }) を代入しても raw に Proxy が残らない', async () => {
    process.env.NODE_ENV = 'development';
    const raw = { pages: [{ page: { width: 1 }, nodes: [1, 2] as number[] }] };
    const state = createReactiveState(raw, () => {});
    state.pages[0]!.page.width = 2;
    state.pages = [{ ...state.pages[0]!, nodes: [...state.pages[0]!.nodes] }];
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();

    expect(types.isProxy(raw.pages[0])).toBe(false);
    expect(types.isProxy(raw.pages[0]!.nodes)).toBe(false);
    expect(types.isProxy(raw.pages[0]!.page)).toBe(false);
  });

  it('spread を 3 回繰り返しても structuredClone(raw state) は成功する (修正前は DataCloneError)', () => {
    process.env.NODE_ENV = 'development';
    const raw = { pages: [{ page: { width: 1 }, nodes: [1, 2] as number[] }] };
    const state = createReactiveState(raw, () => {});
    for (let i = 0; i < 3; i++) {
      state.pages[0]!.page.width = i;
      state.pages = [...state.pages];
    }
    expect(() => structuredClone(raw)).not.toThrow();
  });

  it('wrapChild Proxy (app.user) を配列に代入しても raw は生オブジェクトになる', () => {
    process.env.NODE_ENV = 'development';
    const raw: { user: { name: string }; list: Array<{ name: string }> } = { user: { name: 'a' }, list: [] };
    const state = createReactiveState(raw, () => {});
    const userProxy = state.user; // wrapChild の Proxy
    expect(types.isProxy(userProxy)).toBe(true);

    state.list = [userProxy];
    expect(types.isProxy(raw.list[0])).toBe(false);
    expect(raw.list[0]).toEqual({ name: 'a' });
    expect(raw.list[0]).toBe(raw.user); // 中身が無変更なのでコピーではなく同じ raw 参照になる
  });

  it('raw キーでキャッシュが安定する: 同じ raw を指す限り同じ Proxy が返る (spread 前後含む)', () => {
    process.env.NODE_ENV = 'development';
    const state = createReactiveState<{ pages: Array<{ x: number }> }>({ pages: [{ x: 1 }, { x: 2 }] }, () => {});
    const first = state.pages[0];
    expect(state.pages[0]).toBe(first); // 同一呼び出し内での同一性

    state.pages = [...state.pages]; // raw な要素はそのまま (変更が無いので unwrapDeep はコピーしない)
    expect(state.pages[0]).toBe(first); // spread 後も同じ raw を指すので同じ Proxy が返る
  });

  it('代入値に Proxy を含まない場合は同じ参照が格納される (不要なコピーをしない)', () => {
    process.env.NODE_ENV = 'development';
    const raw: { pages: unknown[] } = { pages: [{ x: 1 }] };
    const state = createReactiveState(raw, () => {});
    const freshArray = [{ x: 9 }]; // state を経由せず作った、Proxy を一切含まない配列
    state.pages = freshArray;
    expect(raw.pages).toBe(freshArray); // 参照そのまま (コピーされていない)
  });

  it('production (NODE_ENV=production) では unwrap コードが走らず、代入値の参照がそのまま保持される', () => {
    process.env.NODE_ENV = 'production';
    const raw: { pages: unknown[] } = { pages: [] };
    const state = createReactiveState(raw, () => {});
    const value = [{ x: 1 }];
    state.pages = value;
    expect(raw.pages).toBe(value); // unwrapDeep を経由せず素通しなので同一参照
  });
});
