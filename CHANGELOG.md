# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 3a: 状態を持たない部品とレイアウトの移植 (docs/DESIGN.ja.md §10)

- **control (純粋関数、`app.use()` 不要)**: `uiTextarea` (`autoResize` オプション、IME 注意の
  JSDoc)、`uiCheckbox`、`uiRadiobutton` (per-option 属性転送 + `ric-radio__label` flex 中央寄せ +
  name 衝突の既知制約コメント)、`uiSelect`、`uiRange`、`uiColor` (hex/rgba 自動判定)、
  `uiSeparator`、`uiText` (variant: default/muted/title/label)、`uiIcon` (descriptor
  `{ v?, s?, p }`、`vertical-align:-0.125em` inline 化、size/spin/label)。v1 (ric_ui/control/*)
  の camelCase 移植。checked/selected の numeric (`?1:0`) 変換 (v1 B15) は不要 — v2 コアが
  `checked`/`selected` を常にプロパティ代入するため boolean をそのまま渡せる。`<select>` の
  value/option 構築順対策もコア側で解決済みなので部品側の細工は不要。
- **`bindInput` / `bindTextarea` / `bindCheckbox` / `bindSelect` / `bindRange`**: v1 の
  `bind_*` を camelCase 移植 (state の一段目 Proxy へ双方向バインドする流儀)。v1
  `bind_textarea` だけ options を value/oninput の後に展開しており上書きできてしまう歪みが
  あったが、v2 は 5 関数とも「options → 計算済みの value/onchange/oninput の順」に統一。
- **layout**: `uiCol` / `uiRow` / `uiGrid` / `uiPanel`。v1 の `create_ui_page` に相当する
  「テーマ適用スコープ用コンポーネント」は v2 に存在しないため移植しない (portal と CSS
  配布が page に依存しないため、設計書 §13)。`uiPanel` は v1 が持っていたテーマ上書き props
  (`{theme, density, font_size}`) と状態を持つ `create_ui_panel` ファクトリを持たない
  (Phase 3a は純粋関数のみが対象、設計書 §13)。
- **text**: `uiMdPre` (見出し/リスト (ul/ol + start)/引用/テーブル (アライメント対応)/
  フェンス (``` と ~~~)/hr/インライン (code/link/画像/bold/italic)、`transformText` /
  `transformImageSrc` フック、危険スキーム href ブロック (javascript:/data:/vbscript:)、
  hljs があればハイライト)、`uiCodePre` (obj → JSON ハイライト、maxHeight)。
- **CSS**: v1 css_templates.js から Phase 3a 対象部品の規則を `ricdom-ui.css` に統合。
  **ページ全体のスクロールバー既定スタイル**を移植: `applyTheme(el)` が `data-ricdom-theme`
  属性を付与するようにし、`[data-ricdom-theme]` 配下 (自身 + 子孫) に
  `::-webkit-scrollbar` 系 + `scrollbar-color` を当てる (v1 の `.ric-page, .ric-page *` 相当、
  v2 に page 部品が無いため属性マーカー方式に置き換え、設計書 §13)。`uiPanel` の disabled
  見た目 (opacity) も JS 側の inline style 計算をやめ `.ric-panel[inert]` の CSS セレクタに
  変更。
- 全部品に `data-ricdom-role` を付与 (E2E/CSS の安定セレクタ、`src/ui/internal/pureHelpers.ts`
  の `UI_ROLE` で列挙型管理)。
- `examples/controls.html`: IIFE 2 本 + `<link rel="stylesheet">` だけで全 control/layout/text
  部品を一覧表示するデモ (ビルド不要の証明)。
- テスト: unit +151 (各部品の DOM 構造/rest スプレッド契約/隔離契約/`uiMdPre` の記法網羅/
  `applyTheme` の `data-ricdom-theme` 付与とスクロールバー規則の存在 等)、browser +8
  (`uiTextarea` の autoResize が実 layout で高さを変える、`uiRadiobutton` のラベル整列
  (アイコン混在で縦ズレしない)、`[data-ricdom-theme]` 配下の scrollbar-color 適用、
  `uiMdPre` の `javascript:` リンクが href を持たない)。

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
