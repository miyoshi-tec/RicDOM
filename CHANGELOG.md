# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 1: コア (docs/DESIGN.ja.md §10)

- `createApp(target, state)`: v1 `create_RicDOM` の後継。target 解決済みなら同期初回描画、
  無効な target/state は `console.error` + 型付き NOOP App を返す (throw しない)。
- ノード表現: `{ tag, class, style, children, ref, key, island, ...attrs }`。`ctx` → `children`
  に改称。タグ名から属性型を導く TypeScript 型 (`RicElementNode`)。
- 差分パッチ: position-based + key-based reconciliation、`FORCE_REAPPLY`
  (value/checked/selected/scrollTop/scrollLeft)、select の value/option 構築順対策、
  SVG namespace 継承、`data-ricdom-ref` 安定セレクタ。
- 編集中ガード (コアの規則に一般化): `document.activeElement` である
  input/textarea/select には `value` を FORCE_REAPPLY しない。
- 島: 明示フラグ `island: true` の要素は子孫を一切 build/patch しない。
- リアクティビティ: 浅い Proxy (トップレベル + 1 段目)。`ignore` 配下は追跡しない。
  dev ビルドでは 2 段目以降への代入を検知して `console.warn` する
  (production では無効。`process.env.NODE_ENV` で分岐)。
- スケジューラ: `requestAnimationFrame` + `setTimeout(200ms)` バックストップの二重化。
- `app.renderNow()` (強制・同期) / `app.nextRender()` (観測・Promise、render 予約が無ければ
  resolve しない) の対。
- `app.refs`: `ref: 'name'` → `app.refs.get('name')`。
- `app.use(part)`: 部品登録の骨組み (Phase 2 で正式な部品契約になる)。
- `app.unmount()`: インスタンス破棄、以降の再描画・タイマーを停止。
- ビルド: tsup で ESM (`dist/index.js`) / CJS (`dist/index.cjs`) / IIFE
  (`dist/ricdom.iife.min.js`、グローバル `ricdom`) + 型宣言を生成。利用側はビルド不要。
- テスト: Vitest (jsdom) + 型テスト (expect-type / `@ts-expect-error`)。

### Changed

- ライセンスを MIT に設定 (v1 の非商用条項付き独自ライセンスから継承しない、新規プロジェクト
  として仕切り直し)。
