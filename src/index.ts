// RicDOM 2 — 公開エントリポイント (Phase 1: コア)
//
// IIFE ビルド (dist/ricdom.iife.min.js) はここから globalName `ricdom` として
// まとめてグローバルに公開される (tsup.config.ts 参照)。

export { createApp, createNoopApp } from './app.js';

export type { RicNode, RicElementNode, App, AppState, UsePart, ClassValue, StyleValue } from './types.js';

// Phase 2 以降で `use()` の正式な部品契約・portal ホストを実装する際に、
// 差分パッチや正規化ユーティリティをそのまま再利用できるよう、内部モジュールも
// named export しておく (安定 API ではないため semver の対象外、将来変更しうる)。
export { buildDomNode, patchChildren } from './dom.js';
export { createRenderScheduler } from './scheduler.js';
export { createReactiveState } from './reactivity.js';
export { normalizeNode, normalizeStyle, normalizeClass, isJsonEqual } from './normalize.js';
