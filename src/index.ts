// RicDOM 2 — 公開エントリポイント (コア)
//
// IIFE ビルド (dist/ricdom.iife.min.js) はここから globalName `ricdom` として
// まとめてグローバルに公開される (tsup.config.ts 参照)。

// `version` export (v1→v2 パリティ一括監査 #3、2.0.0-alpha.14): package.json の version を
// tsup の define (__RICDOM_VERSION__、tsup.config.ts / src/env.d.ts 参照) で焼き込む。
// ESM/CJS/IIFE のどのビルドでも同じ値になる (dev/prod で分岐する __RICDOM_DEV__ と違い、
// version は consumer 環境に関わらず常に固定値であるべきなので全ビルドで define する)。
// define を経由しない実行 (vitest 等、tsup を経由しない) では __RICDOM_VERSION__ が
// 未定義になるため、vitest.config.ts 側でも同じ値を define している (テストで
// package.json.version と一致することを検証できるように)。
export const version: string = typeof __RICDOM_VERSION__ === 'string' ? __RICDOM_VERSION__ : '0.0.0-dev';

export { createApp, createNoopApp } from './app.js';

export type { RicNode, RicElementNode, App, RenderFn, UsePart, Host, CreateAppOptions, ClassValue, StyleValue } from './types.js';

// 将来 `use()` の部品契約・portal ホストを拡張する際に、
// 差分パッチや正規化ユーティリティをそのまま再利用できるよう、内部モジュールも
// named export しておく (安定 API ではないため semver の対象外、将来変更しうる)。
export { buildDomNode, patchChildren } from './dom.js';
export { createRenderScheduler } from './scheduler.js';
export { createReactiveState } from './reactivity.js';
export { normalizeNode, normalizeStyle, normalizeClass, isJsonEqual } from './normalize.js';
