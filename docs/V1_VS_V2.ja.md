# RicDOM v1 と ricdom v2 の違い (2026-09-02 時点)

> v1 = [miyoshi-tec/RicDOM-v1](https://github.com/miyoshi-tec/RicDOM-v1) (v0.4.4、保守モード)、v2 = このリポジトリ (2.0.0-alpha)。移行ガイドの土台。

## 基盤・配布

| 観点 | v1 | v2 |
|---|---|---|
| 実装言語 | JavaScript (CommonJS) | **TypeScript** (利用者はビルド不要のまま) |
| 型定義 | なし | **同梱** (`tag` から属性型を導出、render 内の `s` も型付き) |
| 命名 | snake_case、`create_RicDOM`、子要素は `ctx` | **camelCase**、`createApp`、子要素は **`children`** |
| モジュール形式 | CommonJS + グローバル min.js | **ESM / CJS / IIFE** (`exports` マップ) |
| 配布 | docs/ の min.js を手でコピー、npm 未公開 | **npm + jsDelivr** (`<script>` 1 行 / `import` 1 行)、サブパス `ricdom` / `ricdom/ui` / `ricdom/ui.css` / `ricdom/icons` |
| LZ 自己展開版 | あり (CSP で unsafe-eval 必要) | 本体には含めない (v1 の独立ツールとして継続) |
| ライセンス | PolyForm Noncommercial + Internal Use (v0.4.0〜) | **MIT** |
| コアサイズ | 10.5KB min | 11.5KB min / **5.0KB gzip** (天井 5KiB、以後コアに機能を足さない) |
| docs | 日本語のみ (約 3,900 行) | **英語が正** (README EN/JA、SPEC、TUTORIAL) + CONTRIBUTING / CoC / SECURITY / CHANGELOG |
| テスト | node:test + jsdom (1,023 件) | **Vitest unit 467 + Playwright 実ブラウザ 50**、GitHub Actions CI |

## コア API

| 観点 | v1 | v2 |
|---|---|---|
| 生成 | `create_RicDOM(target, { …state, render })` | **`createApp(target, state, render, { portalTo? })`** (render を分離することで `S` が state から推論される) |
| target 未解決時 | 20 秒ポーリング | **`DOMContentLoaded` を 1 回待つ**、それでも無ければ console.error + NOOP |
| 複数インスタンスの state 共有 | あり (同じ state を渡すと共有) | **なし** (共有したければ同じオブジェクトを明示的に渡す) |
| リアクティビティ | 浅い Proxy (トップ + 1 段)、深い代入は無警告 | 浅い Proxy (同じ) + **dev ビルドで深い代入を console.warn** |
| 元 state の直接変更 | 反応しない | 反応しない (**FACT として docs に明記**) |
| diff 対象外の島 | `ctx` を省略した要素 | **`island: true`** の明示フラグ (`children` 省略は空要素) |
| `{}` ノード | 不可視 | **`tag` は型上必須** (実行時欠落は console.error + 不可視) |
| `style` | string / object / array | **object のみ** |
| 編集中ガード | ui_tweak の number 行だけ部品側で実装 | **コアの規則**: フォーカス中の input/textarea/select に `value` を再適用しない |
| select の value/option 順 | v0.3.38 でコア修正 | 同じ (継承) |
| スケジューラ | rAF + 200ms バックストップ (v0.3.36〜) | 同じ (継承) |
| `render_now` / `next_render` | あり | **`renderNow()` / `nextRender()`** (契約同じ) |
| エラー時 | `NOOP_PROXY` (型は `any` 相当) | **型付き NOOP App** (インターフェースを満たす no-op) |
| 安定セレクタ | `data-ric-role` | **`data-ricdom-role`** (全部品 + portal ルート、`UI_ROLE` 列挙) |

## 部品・スタイル

| 観点 | v1 | v2 |
|---|---|---|
| 状態を持つ部品の契約 | `s.x = create_ui_x()` で `__notify` を**暗黙注入** (state トップレベル必須、誤ると silent failure) | **`const x = app.use(createX())`** で明示登録。未登録で呼ぶと console.error + NOOP、`dispose()` あり |
| 状態を持たない部品 | `ui_button(...)` 等 | `uiButton(...)` 等 (純粋関数、`use()` 不要) |
| portal (popup/dialog/toast/tooltip) | `create_ui_page` の render が drain (**page 必須**、css_for 島では不可) | **app 単位の portal ホスト** (page 部品なし)、`portalTo` で任意要素 |
| CSS 配布 | per-instance で使用クラスを収集注入 (通らない mount は**無装飾**)、`css_for` 3 点セット | **1 枚の `ricdom-ui.css`** (`<link>` or `injectStyles()`)、無装飾 silent failure は構造的に消滅 |
| テーマ | `create_ui_page({theme})` / `make_css_vars` / `create_theme` / `export_theme` | **`applyTheme(el, {theme, density, fontSize})`** (`data-ricdom-theme` 付与 + `color-scheme`) / `createTheme` / `exportTheme`。変数名 `--ric-*` は継続 |
| page 部品 | `create_ui_page` (テーマ + CSS 注入 + portal drain の要 + `.ric-page` への bg/fg 塗り) | **廃止** (役割は `applyTheme` / CSS 1 枚 / portal ホストに分解)。`create_ui_page` が塗っていた bg/fg は `applyTheme` した要素自身に塗られる形でパリティ確保 (alpha.3〜、それまでは要素自身が透明・無色のままの欠落があった) |
| a11y | 意図的に最小 (inline_menu に ARIA なし、dialog に focus trap なし) | **APG 準拠を初期設計に**: dialog = focus trap + `inert` + Esc 復帰、menu = 矢印キー、tabs = roving tabindex、splitter = 矢印キーリサイズ、toast = `aria-live` |
| popup | `create_ui_popup` (label / icon / menu モード混在、`open_at` v0.4.3) | **`createPopup` = menu 専用** (`openAt` 継承) + **`createDropdown`** (Popover、新設)。トリガーの見た目 (icon+ghost の丸ボタン等) は `trigger` に **object 形** `{ icon?, label?, ghost?, size?, class?, style? }` を渡すと再現できる (alpha.2、v1 parity)。従来の `RicNode`/`RicNode[]` 形と二択。**`createDropdown` は同じ見た目を top-level props (`label`/`icon`/`chevron`/`ghost`) で指定する** (`trigger` object 形は持たない、canon 1 つ) — 見た目の指定場所が部品によって違う点に注意 |
| tabs | controlled のみ (`bind_tabs`) | controlled / **uncontrolled**。全 item に `children` が無ければ tabpanel を描かない**パネル無しモード** (alpha.2、セグメントコントロール用途) |
| layout の `gap` | `ui_row({gap})` は正式 prop | **`uiRow`/`uiCol` の `gap` prop は復活** (alpha.2 — v2 は当初 rest 経由の属性化で黙って崩れていた、25 箇所以上で報告)。`uiGrid` の `gap` は元から存在 |
| `focus_when` | 条件の立ち上がりで ref 先へ focus (4 箇所で使用) | **`createFocusWhen`** (`ricdom/ui`、alpha.2)。`app.use()` 登録 + `fw(refName, condition)`。dialog の既定初期フォーカスでは代替できない「特定要素へ」「dialog 以外のタイミングでも」のケース向け |
| tweak パネル | `create_ui_tweak_panel` + `ui_tweak_row` + folder | **`createTweakPanel` 1 部品** (Tier1 `data` / Tier2 `keys` / Tier3 `rows`) |
| 排他制御 | モジュール level の registry (削除なし) | **app 単位** + `dispose` で解除 |
| アニメ完了待ち | `animationend` のみ | `animationend` / `transitionend` + **700ms バックストップ** (CSS 未ロードでも固まらない) |
| アイコン | docs/icons/icons.json + ピッカー + `ricdom-icon` CLI | **`ricdom/icons`** の named export (tree-shakable) + `svgToDescriptor` + CLI (パリティ)。descriptor 形式 `{ v?, s?, p }` は同じ |
| スクロールバー既定 | `.ric-page` 配下 (v0.4.2〜) | `[data-ricdom-theme]` 配下 |

## 移行の目安 (Phase 5 で検証)

| 領域 | 作業 |
|---|---|
| 純粋ノード (`ctx`→`children`、snake→camel、style を object に) | **機械変換可能** |
| `s.x = create_ui_x()` → `app.use(createX())` | 手動 (最大の変更点) |
| `create_ui_page` の除去 → `applyTheme(el)` + CSS `<link>` | 手動 (単純) |
| portal 系 (popup/dialog/toast/tooltip) の props | 手動 (API 変更) |
| アイコン descriptor | そのまま |
