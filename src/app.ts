// RicDOM 2 — createApp (v1 の create_RicDOM 後継)
//
// v1 との主な相違点 (設計書 + タスク指示に基づく意図的な変更、詳細は最終報告に記載):
//   - target 探索のリトライ (v1 は最大 20 秒ポーリング) を廃止。target は呼び出し時点で
//     同期的に解決できる必要があり、解決できなければ「無効 target」として NOOP App を返す
//     (タスク指示: 「target 解決済みなら同期初回描画。無効 target は console.error + 型付き
//     NOOP App を返す」を文字通り実装)。
//   - 複数 createApp() 呼び出し間での state 共有 (v1 の WeakMap 経由の shared state) は
//     持たない。1 createApp = 1 独立 state。設計書にこの機能への言及が無いため実装しない。
//   - `render` は state の他プロパティとは別枠で管理する (v1 踏襈: 代入は同期描画、
//     Proxy の 1 段目/2 段目追跡ルールの対象外)。

import type { App, AppState, RicNode, UsePart } from './types.js';
import { buildDomNode, patchChildren } from './dom.js';
import { createRenderScheduler } from './scheduler.js';
import { createReactiveState } from './reactivity.js';

// =====================================================================
// NOOP App (設計書 §3.6、v1 の NOOP_PROXY を型付きで再定義)
// =====================================================================

// ターゲットを関数にすることで apply トラップが使える (NOOP_APP() のような誤用でも壊れない)。
// モジュールスコープの単一インスタンスとして保持する (get のたびに新規生成すると
// メモリリークするため、自分自身を返す設計。v1 踏襈)。
const noopFunction = (): unknown => NOOP_INSTANCE;
const NOOP_INSTANCE: object = new Proxy(noopFunction, {
  get: () => NOOP_INSTANCE,
  set: () => true,
  apply: () => NOOP_INSTANCE,
  deleteProperty: () => true,
});

/**
 * 無効な target・state に対して返す「型付き NOOP App」。
 * 実体は v1 と同じ universal proxy だが、戻り値の型は `App<S>` を満たすため、
 * 呼び出し側の TypeScript コードは分岐なしに `app.count` や `app.renderNow()` を
 * そのまま書ける (throw しない・グルーコードを連鎖破壊しない、という v1 の哲学 A9 を
 * 型安全なまま継承する。設計書 §3.6 / B14)。
 */
export const createNoopApp = <S extends object>(): App<S> => NOOP_INSTANCE as unknown as App<S>;

// =====================================================================
// target 解決
// =====================================================================

const isDomElement = (target: unknown): target is Element => typeof Element !== 'undefined' && target instanceof Element;

const resolveTargetElement = (target: string | Element): Element | null => {
  if (typeof target === 'string') return document.querySelector(target);
  if (isDomElement(target)) return target;
  return null;
};

// =====================================================================
// createApp
// =====================================================================
//
// 公開シグネチャはタスク指示どおり「単一の state 引数に render を同梱する」形にしたいが、
// `S & { render(state: S): RicNode }` のように型パラメータ S が自分自身の一部 (render の
// 引数) を参照する単一ジェネリック関数だと、TypeScript は object リテラル引数から S を
// 正しく推論できず S が制約の `object` に丸められてしまう (実装前に空の .ts で実証済み。
// Omit<T,'render'> を自己参照させる変種でも同様に失敗する)。
// そのため、外部向けには「render あり / render 省略」の 2 つのオーバーロードとして
// 宣言する (render ありのオーバーロードを先に書くことで、render を持つ引数はそちらが
// 優先的にマッチする)。実装本体 (createAppImpl) は緩い型で書き、オーバーロードから
// 委譲する。
//
// 既知の制約: render あり オーバーロードでは、外側 (`app.count` 等) の型は正しく推論
// されるが、render コールバック自身の引数 `s` は `any` になる (推論を成立させるための
// トレードオフ)。厳密な補完が欲しい場合は `render: (s: MyState) => {...}` のように
// 明示的に注釈すればよい。設計書に記載の無い純粋な TypeScript 型推論上の制約であり、
// 「未決定は v1 踏襲」の対象外 (v1 に型は無いため)。

/** render を含む state を渡すシグネチャ (通常の使い方) */
export function createApp<T extends { render: (state: any) => RicNode }>(
  target: string | Element,
  state: T,
): App<Omit<T, 'render'>>;
/** render を省略するシグネチャ (v1 踏襈: 後から `app.render = fn` で設定する) */
export function createApp<T extends object>(target: string | Element, state: T): App<T>;
export function createApp(target: string | Element, state: object): App<object> {
  return createAppImpl(target, state);
}

const createAppImpl = <S extends object>(target: string | Element, state: AppState<S>): App<S> => {
  // ── 引数バリデーション (throw しない: console.error + NOOP App、設計書 §3.6) ──
  if (typeof target !== 'string' && !isDomElement(target)) {
    console.error(
      'RicDOM: createApp の第 1 引数は CSS セレクタ文字列または DOM 要素です。\n' +
        "✅ 例: createApp('#app', { count: 0, render: (s) => ({ tag: 'div', children: [s.count] }) })",
    );
    return createNoopApp<S>();
  }

  if (state === null || typeof state !== 'object') {
    console.error('RicDOM: createApp の第 2 引数 state はオブジェクトである必要があります。');
    return createNoopApp<S>();
  }

  const renderFnCandidate = (state as { render?: unknown }).render;
  if (renderFnCandidate !== undefined && typeof renderFnCandidate !== 'function') {
    console.error(
      'RicDOM: state.render は関数である必要があります。\n' +
        "✅ 例: { count: 0, render: (s) => ({ tag: 'div', children: [s.count] }) }",
    );
    return createNoopApp<S>();
  }

  const targetEl = resolveTargetElement(target);
  if (!targetEl) {
    console.error(`RicDOM: target "${String(target)}" が見つかりません。`);
    return createNoopApp<S>();
  }

  // ── ここから有効な target が確定した状態 ──────────────────────

  let isDestroyed = false;
  let prevTree: RicNode = null;
  let currentRenderFn = (renderFnCandidate as ((s: S) => RicNode) | undefined) ?? null;
  const refsMap = new Map<string, Element>();
  const registeredParts = new Set<UsePart>();

  // nextRender() 用の保留 Promise (呼ばれるまで作らない、v1 踏襈)
  let pendingResolve: (() => void) | null = null;
  let pendingPromise: Promise<void> | null = null;

  const registerRefs = (root: Element): void => {
    refsMap.clear();
    const nodes = root.querySelectorAll<HTMLElement>('[data-ricdom-ref]');
    for (const node of nodes) {
      const name = node.dataset.ricdomRef;
      if (name) refsMap.set(name, node);
    }
  };

  const doRender = (): void => {
    if (isDestroyed) return;
    if (!currentRenderFn) return; // render 未設定時はスキップ (v1 踏襈)

    const nextTree = currentRenderFn(appHandle);

    if (prevTree === null) {
      // 初回描画: DOM を全量構築する
      targetEl.innerHTML = '';
      const domEl = buildDomNode(nextTree, targetEl.namespaceURI);
      if (domEl) targetEl.appendChild(domEl);
    } else {
      // 2 回目以降: 差分更新 (ルートノードを単一の子ノードとして扱う)
      patchChildren([prevTree], [nextTree], targetEl);
    }

    registerRefs(targetEl);
    prevTree = nextTree;

    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      pendingPromise = null;
      resolve();
    }
  };

  const { scheduleRender, cancelPending } = createRenderScheduler(() => {
    if (!isDestroyed) doRender();
  });

  // state 本体 (render を除く) は浅い Proxy でラップする (設計書 §3.3)
  const reactiveState = createReactiveState(state as unknown as Record<string, unknown>, scheduleRender);

  // ── API 実装 ──────────────────────────────────────────────

  const apiRenderNow = (): void => {
    if (isDestroyed) return;
    cancelPending(); // 保留中の rAF/バックストップを解除し、二重描画を防ぐ (v1 踏襈)
    doRender();
  };

  const apiNextRender = (): Promise<void> => {
    if (!pendingPromise) {
      pendingPromise = new Promise<void>((resolve) => {
        pendingResolve = resolve;
      });
    }
    return pendingPromise;
  };

  // Phase 1 では「登録して notify 関数を渡すだけの骨」(タスク指示)。
  // 正式な部品契約 (portal ホスト・dispose の統合等) は Phase 2 で実装する (設計書 §3.4)。
  const apiUse = <T extends UsePart>(part: T): T => {
    if (isDestroyed) return part;
    registeredParts.add(part);
    if (typeof part.onUse === 'function') part.onUse({ notify: scheduleRender });
    return part;
  };

  const apiUnmount = (): void => {
    if (isDestroyed) return;
    isDestroyed = true;
    cancelPending();
    for (const part of registeredParts) {
      if (typeof part.onDispose === 'function') part.onDispose();
    }
    registeredParts.clear();
    refsMap.clear();
  };

  // ── インスタンスハンドル ────────────────────────────────────
  // state へのアクセスは reactiveState に委譲しつつ、render/renderNow/nextRender/use/
  // unmount/refs は per-instance の予約キーとして割り込む (v1 の instance_handle 継承)。
  const RESERVED_KEYS = new Set(['render', 'renderNow', 'nextRender', 'use', 'unmount', 'refs']);

  const appHandle = new Proxy(reactiveState, {
    get(target, prop, receiver) {
      if (prop === 'render') return currentRenderFn ?? undefined;
      if (prop === 'renderNow') return apiRenderNow;
      if (prop === 'nextRender') return apiNextRender;
      if (prop === 'use') return apiUse;
      if (prop === 'unmount') return apiUnmount;
      if (prop === 'refs') return refsMap;
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
      if (prop === 'render') {
        if (value === undefined || value === null || typeof value === 'function') {
          currentRenderFn = (value as ((s: S) => RicNode) | null | undefined) ?? null;
          // render の (再) 設定は同期描画する (FOUC 防止、v1 の shared_proxy.render 挙動踏襈)
          if (currentRenderFn) doRender();
          return true;
        }
        console.error('RicDOM: render は関数である必要があります。');
        return true;
      }
      if (RESERVED_KEYS.has(prop as string)) {
        console.error(`RicDOM: "${String(prop)}" は予約済みのプロパティ名です (上書きできません)。`);
        return true;
      }
      return Reflect.set(target, prop, value);
    },
    deleteProperty(target, prop) {
      if (RESERVED_KEYS.has(prop as string)) return true; // 予約キーの削除は無視する
      return Reflect.deleteProperty(target, prop);
    },
  }) as App<S>;

  // render_fn 省略時は初回描画をスキップする (v1 踏襈: handle.render = fn で後設定するまで待つ)
  if (currentRenderFn) doRender();

  return appHandle;
};
