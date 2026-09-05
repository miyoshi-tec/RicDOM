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
| 状態を持つ部品の契約 | `s.x = create_ui_x()` で `__notify` を**暗黙注入** (state トップレベル必須、誤ると silent failure) | **`const x = app.use(createX())`** で明示登録。未登録で呼ぶと console.error + NOOP、`dispose()` あり。**注意: `createApp` は同期で初回描画するため、`use()` は `render` 関数の外 (`setup` オプション) で行う** — 詳細は下記「`setup` オプション」節 |
| 状態を持たない部品 | `ui_button(...)` 等 | `uiButton(...)` 等 (純粋関数、`use()` 不要) |
| portal (popup/dialog/toast/tooltip) | `create_ui_page` の render が drain (**page 必須**、css_for 島では不可) | **app 単位の portal ホスト** (page 部品なし)、`portalTo` で任意要素 |
| CSS 配布 | per-instance で使用クラスを収集注入 (通らない mount は**無装飾**)、`css_for` 3 点セット | **1 枚の `ricdom-ui.css`** (`<link>` or `injectStyles()`)、無装飾 silent failure は構造的に消滅 |
| テーマ | `create_ui_page({theme})` / `make_css_vars` / `create_theme` / `export_theme` | **`applyTheme(el, {theme, density, fontSize})`** (`data-ricdom-theme` 付与 + `color-scheme`) / `createTheme` / `exportTheme`。変数名 `--ric-*` は継続 |
| page 部品 | `create_ui_page` (テーマ + CSS 注入 + portal drain の要 + `.ric-page` への bg/fg/font-size 塗り + `padding: var(--ric-gap-md)` / `overflow: hidden` / `box-sizing: border-box`) | **廃止** (役割は `applyTheme` / CSS 1 枚 / portal ホストに分解)。`create_ui_page` が塗っていた **bg/fg/font-size のみ** `applyTheme` した要素自身に塗られる形でパリティ確保 (bg/fg は alpha.3〜、font-size は alpha.6〜)。**`padding`/`overflow`/`box-sizing` はパリティ対象外** — `applyTheme` を当てた要素がページ全体とは限らないため (詳細・補償 CSS は下記「移行の落とし穴」節) |
| a11y | 意図的に最小 (inline_menu に ARIA なし、dialog に focus trap なし) | **APG 準拠を初期設計に**: dialog = focus trap + `inert` + Esc 復帰、menu = 矢印キー、tabs = roving tabindex、splitter = 矢印キーリサイズ、toast = `aria-live` |
| popup | `create_ui_popup` (label / icon / menu モード混在、`open_at` v0.4.3) | **`createPopup` = menu 専用** (`openAt` 継承) + **`createDropdown`** (Popover、新設)。トリガーの見た目 (icon+ghost の丸ボタン等) は `trigger` に **object 形** `{ icon?, label?, ghost?, size?, class?, style? }` を渡すと再現できる (alpha.2、v1 parity)。従来の `RicNode`/`RicNode[]` 形と二択。**`createDropdown` は同じ見た目を top-level props (`label`/`icon`/`chevron`/`ghost`) で指定する** (`trigger` object 形は持たない、canon 1 つ) — 見た目の指定場所が部品によって違う点に注意 |
| tabs | controlled のみ (`bind_tabs`) | controlled / **uncontrolled**。全 item に `children` が無ければ tabpanel を描かない**パネル無しモード** (alpha.2、セグメントコントロール用途) |
| layout の `gap` | `ui_row({gap})` は正式 prop | **`uiRow`/`uiCol` の `gap` prop は復活** (alpha.2 — v2 は当初 rest 経由の属性化で黙って崩れていた、25 箇所以上で報告)。`uiGrid` の `gap` は元から存在 |
| `focus_when` | 条件の立ち上がりで ref 先へ focus (4 箇所で使用) | **`createFocusWhen`** (`ricdom/ui`、alpha.2)。`app.use()` 登録 + `fw(refName, condition)`。dialog の既定初期フォーカスでは代替できない「特定要素へ」「dialog 以外のタイミングでも」のケース向け |
| tweak パネル | `create_ui_tweak_panel` + `ui_tweak_row` + folder | **`createTweakPanel` 1 部品** (Tier1 `data` / Tier2 `keys` / Tier3 `rows`) |
| 排他制御 | モジュール level の registry (削除なし) | **app 単位** + `dispose` で解除 |
| アニメ完了待ち | `animationend` のみ | `animationend` / `transitionend` + **700ms バックストップ** (CSS 未ロードでも固まらない) |
| アイコン | docs/icons/icons.json + ピッカー + `ricdom-icon` CLI | **`ricdom/icons`** の named export (tree-shakable) + `svgToDescriptor` + CLI (パリティ)。descriptor 形式 `{ v?, s?, p }` は同じ |
| スクロールバー既定 | `.ric-page`/`.ric-page *` 配下 (v0.4.2〜、`scrollbar-color: var(--ric-scrollbar-thumb) transparent` 常時 + hover で濃く) | `[data-ricdom-theme]`/`[data-ricdom-theme] *` 配下、**既定値そのものは v0.4.2 以降の v1 と同一** (`scrollbar-color: var(--ric-scrollbar-thumb) transparent` 常時 + hover で濃く)。変わったのは**スコープのみ** (`.ric-page` → `[data-ricdom-theme]`)。ただし **v0.4.1 以前の v1 から移るアプリは既定値も変わって見える** (v0.3.x〜v0.4.1 は常時 transparent、hover のみアクセント色。v0.4.2 で現行の既定値に置き換わった)。内側にスクロール領域を持つアプリは、移行元の版を確認すること |

## 移行の目安 (Phase 5 で検証)

| 領域 | 作業 |
|---|---|
| 純粋ノード (`ctx`→`children`、snake→camel、style を object に) | **機械変換可能 (ただし取りこぼす 2 形がある。下記「機械変換の節」参照)** |
| `s.x = create_ui_x()` → `app.use(createX())` | 手動 (最大の変更点)。**`createApp` は同期初回描画のため `setup` オプション内で行う** (下記「`setup` オプション」節) |
| `create_ui_page` の除去 → `applyTheme(el)` + CSS `<link>` | 手動 (単純)。ただし bg/fg/font-size 以外の旧 `.ric-page` の効果 (padding/overflow/box-sizing) は補償 CSS が要る (下記) |
| portal 系 (popup/dialog/toast/tooltip) の props | 手動 (API 変更) |
| アイコン descriptor | そのまま |

## 移行の落とし穴 (第 3 号・第 4 号のフィードバックより — 表のとおりに書くと必ず 1 回踏む)

移行ガイドの対応表は「何が変わったか」を短く伝えるものだが、実際に手を動かすと表の 1 行だけでは
気づけない具体的な落とし穴がある。ここでは実際のパイロット移行 (第 3 号・第 4 号) が踏んだものを、
再現手順ごと記録する。

### `setup` オプション: `app.use()` を呼ぶタイミング

`createApp(target, state, render, options?)` は**生成時に同期で初回描画する** (`target` が即時
解決する場合、[SPEC.md §5](SPEC.md) FACT)。つまり `render` 関数は `createApp` が返るより前に
少なくとも 1 回実行される。ここで罠になるのが、v1 スタイルの「まず `createApp` を呼び、戻り値を
受けてから部品を `use()` する」書き方:

```js
// ❌ これは動かない — 初回 render (createApp 呼び出し中に同期実行) の時点で
//    まだ acc/dlg が use() されていないため、render 内の acc(...)/dlg(...) が
//    host 未接続の console.error + NOOP になる。
const app = createApp('#app', {}, (s) => [acc({ ... }), dlg({ ... })]);
const acc = app.use(createAccordion());
const dlg = app.use(createDialog());
```

正しくは、`use()` を **`setup` オプション**の中で行う。`setup(app)` は `render` の初回実行より
前に呼ばれるため、この時点で `use()` した変数は初回 render から使える:

```js
// ✅ setup 内で use() し、外側の let 変数で受ける (render のクロージャから触れるように)。
//    setup は最初の render より前に走るため、acc/dlg は初回 render の時点で既に use()
//    済み — v1 の「まだ未設定かもしれないので毎回ガードする」ような分岐は要らない
//    (SPEC.md §5 `options.setup` FACT)。
let acc, dlg;
const app = createApp(
  '#app',
  {},
  (s) => [acc({ ... }), dlg({ ... })],
  { setup: (a) => { acc = a.use(createAccordion()); dlg = a.use(createDialog()); } },
);
```

v1 では `s.acc = create_ui_accordion()` のように **state のどのキーに部品を置くか**を意識するだけ
で済んでいたが (`__notify` が暗黙注入される)、v2 では**「setup 内で `use()` してどの変数で受けるか」**
を意識する必要がある。1 対 1 で並べると:

| v1 | v2 |
|---|---|
| `s.acc = create_ui_accordion({ default_open: { a: true } })` | `setup: (a) => { acc = a.use(createAccordion({ defaultOpen: { a: true } })); }` |
| `s.dlg = create_ui_dialog()` | `setup: (a) => { dlg = a.use(createDialog()); }` |

（render 内で使う呼び出し自体は `s.acc({ items, ctx })` → `acc({ items, children })` のような
ノード変換のみで、部品オブジェクトそのものの呼び出し方は変わらない。)

### page 行の補足: `applyTheme` が塗るのは bg/fg/font-size のみ

`applyTheme` した要素に塗られるのは `background` / `color` / `font-size` の 3 つだけ。v1 の
`.ric-page` が同時に持っていた `padding: var(--ric-gap-md)` / `overflow: hidden` /
`box-sizing: border-box` は**塗らない** — `applyTheme` を呼ぶ要素は v2 では必ずしも「ページ全体」
とは限らない (テーマ付き island を任意の要素に当てられる設計、§4) ため、page 特有だったレイアウト
プロパティまでは引き継いでいない。旧 `.ric-page` と同じ見た目が必要なら、自分の CSS で補う:

```css
#root .page {
  min-height: 100%;
  box-sizing: border-box;
  padding: var(--ric-gap-md);
  font-size: var(--ric-font-size);
  color: var(--ric-color-fg);
  overflow: hidden;
}
```

(`#root .page` はセレクタ例。`applyTheme(el)` を呼んだ要素自身に相当するセレクタに置き換える。)

### 機械変換の節: `s/\bctx:/children:/` が取りこぼす 2 形

`ctx` → `children` の一括置換は、素朴な正規表現 `s/\bctx:/children:/` だとオブジェクトリテラルの
`ctx: [...]` は捕まえるが、次の 2 形を取りこぼす。**壊れ方が静かなのが厄介**: 例外は出ず、その節
の子要素が黙って消える (VDOM 上は `children` が無いノードとして通り、レンダリング結果は空になる)。

1. **ES2015 短縮記法**: `uiCol({ style, ctx })` — これは `{ style: style, ctx: ctx }` の意味であり、
   `ctx:` という文字列自体が存在しないため正規表現に引っかからない。
2. **後付け代入**: `node.ctx = [...]` — オブジェクトリテラル外での代入のため、同上。

また、変換をかける前に**「`ctx` というキーを使うが ricdom の木ではない vnode 層」が同じアプリ内に
併存していないか**を確認する。canvas 描画やゲームループ用の独自 vnode/シーングラフが、たまたま
`ctx` という名前のプロパティ (例: canvas 2D の `CanvasRenderingContext2D` を指す変数名としての
`ctx`) を持つケースがあり得る。この場合、**リポジトリ全体に変換をかけてはいけない** — 変換対象の
ファイルを (v1 の `ricdom` API を呼んでいるファイルだけに) 明示的に列挙してから機械変換をかける。

### 進め方の推奨: まず v1 依存を 1 ファイル (アダプタ) に寄せる

第 3 号・第 4 号の移行はいずれも、最初にアプリ全体を書き換えるのではなく、**v1 の API 呼び出しを
1 つのアダプタファイルに集約してから**移行作業に入った。アプリ本体は「アダプタが export する
薄い関数」だけを呼ぶ形にしておき、機械変換 (`ctx`→`children` 等) をアダプタ 1 ファイルだけに絞る
ことで、上記の「`ctx` だが ricdom ではない vnode 層」のような誤爆を防げる。両パイロットとも、この
手順でアダプタ外への機械変換の適用をゼロに抑えられた実績がある。
