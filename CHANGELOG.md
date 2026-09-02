# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 2: 部品契約 + portal + テーマ + CSS 配布 (docs/DESIGN.ja.md §10)

- **`app.use(part)` の正式な部品契約 (§3.4)**: `UsePart` に `attach(host)` / `dispose()` /
  `renderPortal()` を実装。`host` は `{ notify, portal, app }`。`use()` を経由せず
  render 内で直接呼ばれた部品は host を受け取れないため、部品側が「初回だけ
  `console.error` して何も描画しない」ことで検知する (v1 の `__notify` 暗黙注入と違い、
  置き場所を間違えようがない構造)。
- **portal 層 (§3.5)**: `createApp` が target 直下の末尾に `<div data-ricdom-role="portal">`
  を自動生成し、render サイクルごとに登録済み part の `renderPortal()` を集めて
  差分パッチする (v1 の `_page_portal_queue` の後継、page への依存なし)。第 4 引数
  `createApp(target, state, render, { portalTo })` で描画先を任意要素に差し替え可能
  (v1 の `portal_to` 要望を吸収)。複数 `createApp` は複数の独立した portal を持つ。
- **`ricdom/ui` サブパス (§4/§6)**: `applyTheme` / `createTheme` / `exportTheme`
  (v1 の `make_css_vars`/`create_theme`/`export_theme` を camelCase 移植、`:root` 不使用)。
  `buildStylesheet()` / `injectStyles()` による CSS 1 枚配布 (per-instance の使用クラス
  収集を廃止)。`Component<P>` 型 (呼び出し `(props)=>RicNode` + `attach(host)` + `dispose()`)。
- **`createDialog`**: `role="dialog"` + `aria-modal` + `aria-labelledby`/`describedby`、
  開いたら最初の focusable にフォーカス、Tab/Shift+Tab の focus trap、Esc で閉じて
  起動元へフォーカス復帰、背景 (portal の兄弟要素) を `inert`、`onClose(reason)`
  ('overlay'/'close-button'/'escape'/'api')、controlled/uncontrolled、`width` オプション。
- **`createPopup`**: トリガーに `aria-haspopup="menu"` + `aria-expanded`、本体
  `role="menu"`、子に `role="menuitem"` を自動付与、矢印キー/Home/End での項目間移動、
  Esc でトリガーへ復帰、外クリックで閉じる、`openAt({x,y}|MouseEvent)`、上下 flip +
  横 clamp の 2 段階実測 (v1 継承)。v1 の label/icon/chevron モードは持たず menu に絞る。
- **`createToast`**: `role="status"` (`aria-live="polite"`)、`type:"error"` は
  `role="alert"`、`show(msg, { type, duration })`、`duration:0` で自動消去なし、
  フォーカスを奪わない。
- **`createTooltip`**: `aria-describedby` でトリガーと結び、hover/focus で表示、Esc で消える。
- **`uiButton` / `uiInput`**: 状態を持たない純粋関数部品 (props → RicNode)。rest スプレッド
  契約 (v1 A15 継承)。
- ビルド: `dist/ui.js`/`dist/ui.cjs` (`ricdom/ui` サブパス) + `dist/ricdom-ui.iife.min.js`
  (グローバル `ricdomUI`) + `dist/ricdom-ui.css` (`scripts/build-css.mjs` が生成)。
  `examples/ui.html`: IIFE 2 本 + `<link rel="stylesheet">` だけで動くデモ。
- dialog/popup/toast の open/close 状態遷移の完了を実 CSS `animationend` に委ねている
  箇所すべてに `setTimeout` backstop (700ms) を併設 (コアの rAF+setTimeout バックストップ
  二重化と同じ考え方、v1 FACT A6)。CSS 未読み込み等でアニメーションが一切走らない場合でも
  「閉じられない」が起きない構造にする (実ブラウザテストで発見・修正)。

### Fixed

- portal の島ノードに `key` を持たせ、render のトップレベルが invisible (`null`/`false`)
  を返す render とそうでない render が交互に起きたときの index ズレによる portal DOM
  ノードの誤った再生成を防ぐ (`ricdom/ui` の dialog 実装中に発見)。

### Added — Phase 1b (docs/DESIGN.ja.md §12)

- `createApp(target, state, render)` を 3 引数に変更。v1 の「state に render を同梱する」
  形のオーバーロードは削除 (canon は 1 つ)。render を独立させたことで `S` が `state` から
  素直に推論され、render コールバック内の `s` も完全に型付く。`app.render = fn` による
  後付け設定は維持 (v1 踏襲)。
- target が未解決のとき: v1 の 20 秒ポーリングは廃止し、`DOMContentLoaded` を 1 回だけ待って
  再解決する。それでも見つからなければ `console.error` + 型付き NOOP。
- `tag` を型上必須に変更 (`{}` は型エラー)。v1 は tag 省略時に暗黙で `div` 扱いだったが、
  実行時に tag が欠落したノードが渡された場合は `console.error` + 不可視ノード扱いにする。
- 実ブラウザテスト (`@vitest/browser` + Playwright/chromium) を追加。rAF 停止環境でのバック
  ストップ描画・`<select>` の value/option 構築順・編集中ガード (実 DOM の badInput 込み)・
  IIFE ビルド smoke の 4 件を最初の回帰テストとして `tests/browser/` に実装。
- GitHub Actions CI (`CI`): typecheck → jsdom テスト → Playwright インストール →
  ブラウザテスト → build を push/PR ごとに実行。

### Added — Phase 1: コア (docs/DESIGN.ja.md §10)

- `createApp(target, state, render)`: v1 `create_RicDOM` の後継。target 解決済みなら
  同期初回描画、無効な target/state/render は `console.error` + 型付き NOOP App を
  返す (throw しない)。
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
