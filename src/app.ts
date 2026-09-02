// RicDOM 2 — createApp (v1 の create_RicDOM 後継)
//
// v1 との主な相違点、および Phase 1 → Phase 1b で確定した仕様 (設計書 §12 参照):
//   - `createApp(target, state, render)` の 3 引数。v1 の「state の中に render を同梱する」
//     形は TS で `S` の推論が自己参照になり render 内の `s` が `any` に落ちるため、
//     render を独立した第 3 引数にした。canon は 1 つ (state 同梱オーバーロードは持たない)。
//   - target が未解決のとき: v1 の 20 秒ポーリングは持たず、`DOMContentLoaded` を 1 回だけ
//     待って再解決する。それでも無ければ console.error + 型付き NOOP。
//   - 複数 createApp() 呼び出し間での state 共有 (v1 の WeakMap 経由の shared state) は
//     持たない。1 createApp = 1 独立 state。設計書にこの機能への言及が無いため実装しない。
//   - `render` は state の他プロパティとは別枠で管理する (v1 踏襲: 代入は同期描画、
//     Proxy の 1 段目/2 段目追跡ルールの対象外)。

import type { App, RenderFn, RicNode, UsePart } from './types.js';
import { buildDomNode, patchChildren } from './dom.js';
import { createRenderScheduler } from './scheduler.js';
import { createReactiveState } from './reactivity.js';

// =====================================================================
// NOOP App (設計書 §3.6、v1 の NOOP_PROXY を型付きで再定義)
// =====================================================================

// ターゲットを関数にすることで apply トラップが使える (NOOP_APP() のような誤用でも壊れない)。
// モジュールスコープの単一インスタンスとして保持する (get のたびに新規生成すると
// メモリリークするため、自分自身を返す設計。v1 踏襲)。
const noopFunction = (): unknown => NOOP_INSTANCE;
const NOOP_INSTANCE: object = new Proxy(noopFunction, {
  get: () => NOOP_INSTANCE,
  set: () => true,
  apply: () => NOOP_INSTANCE,
  deleteProperty: () => true,
});

/**
 * 無効な target・state・render に対して返す「型付き NOOP App」。
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
// 単一シグネチャ (canon は 1 つ、設計書 §12): render を第 3 引数として独立させることで
// `S` は `state` 引数から素直に推論され、`render` コールバック内の `s` パラメータも
// (v1 の「state に render を同梱する」形で起きていた自己参照問題無しに) 完全に型付く。

export const createApp = <S extends object>(target: string | Element, state: S, render: RenderFn<S>): App<S> =>
  createAppImpl(target, state, render);

const createAppImpl = <S extends object>(target: string | Element, state: S, render: RenderFn<S>): App<S> => {
  // ── 引数バリデーション (throw しない: console.error + NOOP App、設計書 §3.6) ──
  if (typeof target !== 'string' && !isDomElement(target)) {
    console.error(
      'RicDOM: createApp の第 1 引数は CSS セレクタ文字列または DOM 要素です。\n' +
        "✅ 例: createApp('#app', { count: 0 }, (s) => ({ tag: 'div', children: [s.count] }))",
    );
    return createNoopApp<S>();
  }

  if (state === null || typeof state !== 'object') {
    console.error('RicDOM: createApp の第 2 引数 state はオブジェクトである必要があります。');
    return createNoopApp<S>();
  }

  if (typeof render !== 'function') {
    console.error(
      'RicDOM: createApp の第 3 引数 render は関数である必要があります。\n' +
        "✅ 例: createApp('#app', { count: 0 }, (s) => ({ tag: 'div', children: [s.count] }))",
    );
    return createNoopApp<S>();
  }

  const targetEl = resolveTargetElement(target);
  if (targetEl) return createResolvedApp<S>(targetEl, state, render);

  // target が (型上は妥当だが) 今この瞬間には見つからない。
  // `<head>` 内 script などで body がまだパースされていない典型ケースだけを、
  // DOMContentLoaded を 1 回だけ待って救う (v1 の 20 秒ポーリングは持たない、設計書 §12)。
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    return createDeferredApp<S>(target, state, render);
  }

  console.error(`RicDOM: target "${String(target)}" が見つかりません。`);
  return createNoopApp<S>();
};

// =====================================================================
// target 未解決時の一時ハンドル (DOMContentLoaded を 1 回だけ待つ)
// =====================================================================
//
// DOMContentLoaded 発火まで実 DOM が無いため、state の読み書きだけを素の object に対して
// 許可する「間接 Proxy」を返す (get/set は常に最新の委譲先 (`inner`) に転送する)。
// DOMContentLoaded 発火時に target が見つかれば、その時点までに行われた state の変更を
// 引き継いだまま通常の App (createResolvedApp) に切り替わり、同期初回描画が走る。
// 見つからなければ console.error を出し、以降は型付き NOOP として振る舞う。
const createDeferredApp = <S extends object>(target: string | Element, bufferState: S, render: RenderFn<S>): App<S> => {
  let inner: App<S> | null = null;

  const finalize = (): void => {
    if (inner) return; // 二重発火の防御 (once: true だが念のため)
    const resolved = resolveTargetElement(target);
    if (resolved) {
      inner = createResolvedApp<S>(resolved, bufferState, render);
    } else {
      console.error(`RicDOM: target "${String(target)}" が見つかりません (DOMContentLoaded 後も解決できませんでした)。`);
      inner = createNoopApp<S>();
    }
  };

  document.addEventListener('DOMContentLoaded', finalize, { once: true });

  return new Proxy(bufferState as Record<PropertyKey, unknown>, {
    get(target_, prop, receiver) {
      if (inner) return Reflect.get(inner as object, prop);
      if (prop === 'render') return render;
      if (prop === 'renderNow' || prop === 'unmount') return () => {}; // まだ描画対象が無い
      if (prop === 'nextRender') return () => new Promise<void>(() => {}); // 解決するまで resolve しない
      if (prop === 'use') return (part: UsePart) => part; // Phase 1: 骨のみ (登録先が無い)
      if (prop === 'refs') return new Map<string, Element>();
      return Reflect.get(target_, prop, receiver);
    },
    set(target_, prop, value) {
      if (inner) return Reflect.set(inner as object, prop, value);
      return Reflect.set(target_, prop, value);
    },
    deleteProperty(target_, prop) {
      if (inner) return Reflect.deleteProperty(inner as object, prop);
      return Reflect.deleteProperty(target_, prop);
    },
  }) as App<S>;
};

// =====================================================================
// 解決済み target からの本実装
// =====================================================================

const createResolvedApp = <S extends object>(targetEl: Element, state: S, initialRender: RenderFn<S>): App<S> => {
  let isDestroyed = false;
  let prevTree: RicNode = null;
  let currentRenderFn: RenderFn<S> = initialRender;
  const refsMap = new Map<string, Element>();
  const registeredParts = new Set<UsePart>();

  // nextRender() 用の保留 Promise (呼ばれるまで作らない、v1 踏襲)
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

  // state 本体は浅い Proxy でラップする (設計書 §3.3)。render はここには含まれない
  // (render/renderNow/nextRender/use/unmount/refs は下の予約キー経由で appHandle が扱う)。
  const reactiveState = createReactiveState(state as unknown as Record<string, unknown>, scheduleRender);

  // ── API 実装 ──────────────────────────────────────────────

  const apiRenderNow = (): void => {
    if (isDestroyed) return;
    cancelPending(); // 保留中の rAF/バックストップを解除し、二重描画を防ぐ (v1 踏襲)
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

  // Phase 1 では「登録して notify 関数を渡すだけの骨」。
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
      if (prop === 'render') return currentRenderFn;
      if (prop === 'renderNow') return apiRenderNow;
      if (prop === 'nextRender') return apiNextRender;
      if (prop === 'use') return apiUse;
      if (prop === 'unmount') return apiUnmount;
      if (prop === 'refs') return refsMap;
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
      if (prop === 'render') {
        if (typeof value === 'function') {
          currentRenderFn = value as RenderFn<S>;
          // render の (再) 設定は同期描画する (FOUC 防止、v1 の shared_proxy.render 挙動踏襲)
          doRender();
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

  // 生成時に同期初回描画する (v1 踏襲)
  doRender();

  return appHandle;
};
