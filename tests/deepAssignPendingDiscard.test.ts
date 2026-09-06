// 深い代入の発火忘れ警告 — 「代入時に即警告」から「同じタスクの終わりに再描画が
// 発火しなかったと確定した時に警告」への契約変更 (パイロット第 9 号 Potopeta の push 前
// 指摘、統括確認済み)。
//
// 背景: v1 の canon (v1 docs 自身が推奨する書き方) は「深い場所をその場で書いてから、
// トップレベルへの代入 (`handle.pages = [...handle.pages]` や `handle.render_tick++`) で
// 発火する」——代入が先、発火が後——という順序。alpha.11 までの実装は代入の瞬間に
// console.warn していたため、canon 準拠のコードでも必ず鳴ってしまっていた (Potopeta の
// 実コードで静的に 29 箇所 + 実行時に数百件)。この赤 (旧実装で実際に鳴ること) は
// コミット 1bd53fb 時点のコードで確認済み — 本ファイルは変更後の緑を確認する。
//
// 対応する実装: src/reactivity.ts の PendingWarnCtx / scheduleFlush / notify。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createReactiveState } from '../src/reactivity.js';
import { flushMicrotasks, setupApp } from './_helpers/dom.js';

// テスト対象の「1 つのタスク内で複数の深い書き込みをまとめて行う」ことを表すためだけの
// 識別用ヘルパー (JS は同期実行なので呼び出し自体に特別な意味はない — 統括の指示にある
// `mutate(() => {...})` の疑似コードをそのままテストの見た目に反映するためのもの)。
const mutate = (fn: () => void): void => fn();

describe('深い代入の発火忘れ警告: Potopeta canon (代入が先・発火が後) は無警告', () => {
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

  it('(a) 深く書いてから配列を丸ごと差し替えて発火 → 警告なし', async () => {
    process.env.NODE_ENV = 'development';
    const app = createReactiveState({ pages: [{ page: { width: 100 } }] }, () => {});
    app.pages[0]!.page.width = 1;
    app.pages = [...app.pages];
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(b) 配列 mutating メソッドのあと、無関係な別のトップレベルを ++ して発火 → 警告なし', async () => {
    process.env.NODE_ENV = 'development';
    const app = createReactiveState<{ pages: Array<{ nodes: number[] }>; render_tick: number }>(
      { pages: [{ nodes: [] }], render_tick: 0 },
      () => {},
    );
    app.pages[0]!.nodes.push(9);
    app.render_tick++;
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(c) 複数の深い書き込みをまとめてから配列を丸ごと差し替えて発火 → 警告なし', async () => {
    process.env.NODE_ENV = 'development';
    const app = createReactiveState<{ pages: Array<{ x: number; y: number }> }>({ pages: [{ x: 0, y: 0 }] }, () => {});
    mutate(() => {
      app.pages[0]!.x = 1;
      app.pages[0]!.y = 2;
    });
    app.pages = [...app.pages];
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(d) 深く書いてから renderNow() で同期即描画 → 警告なし (renderNow は Proxy trap を経由しない)', async () => {
    setupApp();
    const handle = createApp('#app', { pages: [{ page: { width: 100 } }] }, (s) => ({
      tag: 'div',
      children: [String(s.pages[0]!.page.width)],
    }));
    handle.pages[0]!.page.width = 1;
    handle.renderNow();
    await flushMicrotasks();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('深い代入の発火忘れ警告: 本当に発火を忘れた代入は警告する', () => {
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

  it('深い代入だけで何も発火しなければ、path を含む警告が 1 回出る', async () => {
    process.env.NODE_ENV = 'development';
    const app = createReactiveState({ pages: [{ page: { width: 100 } }] }, () => {});
    app.pages[0]!.page.width = 1;
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('pages[0].page.width');
  });

  it('同じ path への複数回の代入は 1 回にまとめる', async () => {
    process.env.NODE_ENV = 'development';
    const app = createReactiveState({ pages: [{ page: { width: 100 } }] }, () => {});
    app.pages[0]!.page.width = 1;
    app.pages[0]!.page.width = 2;
    app.pages[0]!.page.width = 3;
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('異なる 2 つの path はそれぞれ警告し、合計 2 回になる', async () => {
    process.env.NODE_ENV = 'development';
    const app = createReactiveState({ pages: [{ page: { width: 100 } }, { page: { width: 200 } }] }, () => {});
    app.pages[0]!.page.width = 1;
    app.pages[1]!.page.width = 2;
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('push だけで完結すると 1 回警告する', async () => {
    process.env.NODE_ENV = 'development';
    const app = createReactiveState<{ arr: number[] }>({ arr: [1] }, () => {});
    app.arr.push(2);
    await flushMicrotasks();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('深い代入の発火忘れ警告: await をまたいで別タスクになると発火忘れとして警告する (FACT)', () => {
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

  it('await を挟んでから発火しても、await 前の microtask flush で既に 1 回警告している', async () => {
    process.env.NODE_ENV = 'development';
    const notify = vi.fn();
    const app = createReactiveState({ pages: [{ page: { width: 100 } }] }, notify);
    app.pages[0]!.page.width = 1;
    await Promise.resolve(); // 別タスク (次の microtask) に渡る — この await の前に flush 済み
    app.pages = [...app.pages]; // ここで発火しても手遅れ (既に警告済み)
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1); // 発火自体は通常どおり起きる
  });
});
