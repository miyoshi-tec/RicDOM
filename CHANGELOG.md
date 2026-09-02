# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 3c: tweak panel + アイコン同梱データ/CLI (docs/DESIGN.ja.md §10/§15)

- **§15 追補**: `createAccordion` の閉じたパネルに `hidden` 属性を付与し a11y ツリーから
  除外 (`role="region"` は維持)。CSS の `.ric-accordion__body { display: grid; ... }`
  (author スタイル) が UA スタイルシートの `[hidden] { display: none }` に優先するため、
  grid-template-rows のクローズアニメーションは従来どおり視覚的に動く。
- **`createTweakPanel`** ← v1 `ui_tweak.js` (`create_ui_tweak_panel`/`ui_tweak_panel`/
  `ui_tweak_row`/`ui_tweak_folder`): dat.GUI 風のパラメータ調整パネル。Tier1 (`data` を
  渡すだけで型推論して行を自動生成: number/range/checkbox/text/select/radiobutton/
  color、ネストした plain object は folder)、Tier2 (`keys` で type/min/max/step/
  options/open を部分上書き)、Tier3 (`rows` に自前の `RicNode` を追加)、`width`。
  行部品は Phase 3a の `uiInput`/`uiRange`/`uiCheckbox`/`uiSelect`/`uiRadiobutton`/
  `uiColor` を再利用 (重複実装しない)。folder は v1 のネイティブ `<details>` を廃止し、
  `createAccordion` と同じ `<button aria-expanded aria-controls>` + `role="region"` +
  `hidden` パターンに変更 (開閉状態は部品が `path` — データのキー鎖を `.` 区切りに
  したもの — をキーに JS state として保持)。number 行の「編集中ガード」は v1 の
  onfocus マーカー方式を廃止し、コアの編集中ガード (`shouldSkipValueReapply`) に
  一般化されたことで部品側は素直に `value` を渡すだけになった (blur 時の min/max
  clamp + `set()` の書き戻しは部品固有の責務として残す)。radiobutton 行は a11y 上
  `<fieldset><legend>` で構成 (`<label>` は複数 labelable descendant を持てないため、
  v1 の `<label>` 相当は number/range/text/select/color 行にのみ適用)。radiobutton の
  name 衝突の既知制約 (`label` 文字列由来のため、同一 label の行が 2 つあると
  同一グループに merge される) は v1 から移植。
- **`ricdom/icons` サブパス (新規)**: v1 `docs/icons/icons.json` の同梱 36 descriptor
  (`{ v?, s?, p }`) を個別の named export に (`import { check, chevronDown } from
  'ricdom/icons'`、tree-shakable — 1 アイコン 1 リテラルなので使わないアイコンは
  バンドルされない)。名前は Lucide 由来のケバブケースを camelCase に変換
  (`chevron-down` → `chevronDown`、`trash-2` → `trash2`)。元のケバブケース名は
  `ICON_NAMES` (camelCase→kebab) と `ICONS_BY_NAME` (kebab→descriptor) で引ける。
  IIFE は作らない (ビルド不要ユーザーは CLI で descriptor を取得してコピーする、
  「使う分だけ」哲学の継続)。`svgToDescriptor(svg)` を同サブパスから export (v1
  `docs/icons/svg_to_descriptor.js` の TS 化、circle/rect/polygon/line/ellipse →
  path 変換込み)。
- **`ricdom-icon` CLI** (`package.json` の `bin`、`dist/cli/ricdom-icon.cjs`):
  v1 `scripts/icon.js` の機能パリティ。同梱名は即返し、無ければ Lucide を
  `https.get` で取得して `svgToDescriptor` で path 化。`--json` / `--search TERM` /
  `--names` / `-h`。stdout は純粋出力・ログは stderr、`const ICONS = {...}` ブロック
  出力 + Lucide (ISC) 帰属コメント。ロジック本体 (`src/cli/ricdomIconLib.ts`) と
  エントリポイント (`src/cli/ricdomIcon.ts`) を分離し、`resolveAll` にテスト用の
  `lucideFetcher` 差し替え口を追加 (ネットワーク不要で「不明な名前 → errors[]」の
  分岐を検証できる、v1 には無かったテスタビリティ改善)。
- **帰属**: `THIRD_PARTY_NOTICES.md` (v1 `docs/icons/ATTRIBUTION.md` を移植) をリポジトリ
  直下に新設し、`LICENSE` 末尾から参照。`contrast` descriptor の宣言箇所に Lucide 由来
  である旨のコメントを付与 (他 35 個は RicDOM オリジナル)。
- `uiIcon` の JSDoc を更新: descriptor の入手手段を「`ricdom/icons` から import」
  「`npx ricdom-icon <name>`」の 2 択に明記 (手書き禁止は継続)。
- `examples/tweak.html`: IIFE 2 本 + CSS `<link>` だけで `createTweakPanel` の
  Tier1/2/3 とパラメータの即時反映 (隣の図形が変化する) を確認できるデモ。
- テスト: unit +67 (`createAccordion` の hidden 属性、`createTweakPanel` の Tier1 型推論
  全種・Tier2 上書き・Tier3・folder 開閉 (path ベース)・blur clamp・radiobutton name
  制約・a11y 結合、`ricdom/icons` の 36 descriptor 検証・名前対応表、`svgToDescriptor`
  の全図形変換、CLI の `buildBlock`/`buildJson`/`resolveAll`/`loadBundled`)、browser +6
  (tweak の number 行で小数点を打っている最中に別 state の再描画が走っても入力が
  潰れないことの実証 — v1 v0.3.37 のバグが v2 のコア規則で構造的に消えていることの
  回帰テスト、tweak の folder 開閉での実 `hidden` 切り替えとフォーカス可能性、
  `uiIcon` が `ricdom/icons` の descriptor を実 DOM に描く)。

### Added — Phase 3b: 状態を持つ部品群の移植 (docs/DESIGN.ja.md §10)

- **`createSplitter`** ← v1 `create_ui_splitter`: left/right/top/bottom、ドラッグリサイズ、
  折り畳み (controlled/uncontrolled)、`onResizeEnd(size)` (v0.3.33 契約継承)。
  DOM 参照はコアの `ref`/`app.refs` を使う (v1 の `data-ric-role` + `querySelector` を
  再実装しない)。a11y 新規実装: 仕切り線に `role="separator"` + `aria-orientation` +
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax` (max 省略時は valuemax も省略)、
  `tabindex=0`、矢印キーでのリサイズ (APG window splitter)。
- **`createScrollPane`** ← v1 `create_ui_scroll_pane`: `follow:'bottom'/'top'/'none'` +
  `threshold` による追従スクロール、`scrollToBottom()`/`scrollToTop()`。
- **`createCollapseBox`** ← v1 `create_ui_collapse_box`: 複数 instance 対応 (`key` で
  区別、sparse list animation 用途)。完了検知は `transitionend` +
  `ANIMATION_FALLBACK_MS`(700ms) setTimeout backstop — height/width は個体ごとに
  実測値が異なる動的ターゲットなので、値が固定な CSS `@keyframes` ではなく
  `transition` が正しい選択 (v1 も元々 `transitionend`)。a11y: ヘッドレスな
  primitive (専用 trigger を持たない) なので `idFor(key)` で consumer 側の trigger が
  `aria-controls` を引けるようにした (`aria-expanded` は consumer の trigger に置く)。
- **`createAccordion`** ← v1 `create_ui_accordion`: ヘッダは
  `<button aria-expanded aria-controls>`、パネルは `role="region"` +
  `aria-labelledby` (a11y 新規実装)。Enter/Space は `<button>` のネイティブ挙動で無料。
  `title` に VDOM ノードを渡せる契約は v1 から継承。`multi:false` で排他モード。
- **`createTabs`** ← v1 `ui_tabs`/`bind_tabs`: v1 は状態を持たない純粋関数 (常に
  呼び出し側 state 駆動) だったが、v2 は controlled/uncontrolled 両対応にした
  (`active` 省略で内部状態管理、`bind_tabs` 相当の糖衣が不要になる)。a11y 新規実装:
  `role="tablist"/"tab"/"tabpanel"`、`aria-selected`、roving tabindex + 矢印キー/
  Home/End (automatic activation)。`onChange` はモードに関わらず選択のたびに呼ぶ。
- **`createDropdown`** (新規): v1 `create_ui_popup` の label/icon/chevron モード
  (旧 dropdown/menu 統合) を、Phase 2 で `createPopup` を menu 専用に絞った際の宿題
  だった別部品として分離 (設計書 §13 で予告済み)。本体は `role="listbox"` 系ではなく
  汎用 Popover (`aria-haspopup="dialog"` + `aria-expanded"`)。位置計算・排他制御は
  `createPopup` と共有 (`internal/popupPosition.ts`/`internal/exclusiveRegistry.ts`)。
- **`uiInlineMenu`** ← v1 `ui_inline_menu`: portal を持たない純粋関数 (状態なし、
  `app.use()` 不要)。Phase 3b の a11y 最小追加: `role="menu"`、新規の任意 prop
  `onClose` (指定時のみ Escape で呼ぶ、省略時は v1 と同じ挙動)。
- **排他制御の共通化**: `internal/exclusiveRegistry.ts` (host.app 単位、`use()` 登録時に
  app のレジストリへ追加・dispose で解除)。v1 の `_popup_registry` (モジュールレベル
  無制限成長、B13) を解消し、`createPopup`/`createDropdown` で共有する。
- **位置計算の共通化**: `internal/popupPosition.ts` (below/above flip・横 clamp・
  Pos→style 変換) を `createPopup`/`createDropdown`/`createTooltip` で共有。
- **§14 追補**: `uiButton`/`uiInput` に `data-ricdom-role` を付与し `UI_ROLE` 列挙に
  統合。`createDialog` の focus trap に可視要素フィルタ (`offsetParent!==null` または
  `getClientRects().length>0`) を追加し、`display:none` 等の focusable を Tab 循環から
  除外 (jsdom はレイアウトを持たないため `document.body` の `getClientRects()` で
  レイアウトエンジンの有無を検出し、無ければフィルタをスキップして既存挙動を保つ)。
- **CSS**: v1 css_templates.js から splitter/scroll-pane/collapse-box/accordion/tabs の
  規則を移植。`createDropdown` 用に新規 `.ric-dropdown__trigger*`/`.ric-dropdown__body`
  (v1 の `.ric-popup__trigger*` を改名・移植)。開閉アニメ・オーバーレイは `createPopup`
  用に定義済みの `@keyframes ric-popup-in/out`/`.ric-popup__overlay` を再利用。
  splitter divider・tabs tab/panel に `:focus-visible` の outline を追加 (a11y 新規)。
- `examples/composite.html`: IIFE 2 本 + CSS `<link>` だけで Phase 3b の全 7 部品を
  一覧・操作できるデモ (ビルド不要の証明)。
- テスト: unit +75 (use() 忘れ検知・ARIA 属性・controlled/uncontrolled・rest スプレッド・
  dispose を各部品ごとに網羅、`internal/exclusiveRegistry.ts`/`internal/popupPosition.ts`
  の単体テスト、`createDropdown`⇄`createPopup` の排他制御)、browser +14 (splitter の
  実ドラッグ・矢印キーリサイズ、tabs の矢印キー/Home/End での実フォーカス移動、
  collapseBox の開閉での実 height 変化、dropdown の below/above flip、dialog focus trap
  の可視要素フィルタ、scrollPane の follow:'bottom' 実追従)。

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
