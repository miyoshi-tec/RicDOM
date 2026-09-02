# RicDOM 2 (仮称) 設計書 — ドラフト v0.2

- 作成: 2026-09-02、統括 (Claude) ドラフト、山崎レビュー待ち
- 位置づけ: RicDOM/RicUI v1 (v0.4.3) を**プロトタイプ FIX**とし、思想と実戦知見を引き継いだ後継を新規構築する
- 決定済み: **TypeScript 実装 / 公開 API は camelCase / ライセンスは全体 MIT / 設計書先行**
- 未決: §11 (名称・リポジトリ・設計選択 5 点)
- v0.1 → v0.2: 競合調査 (付録 A/E) と v1 棚卸し (付録 B/C/D) を反映。本文 §2 / §3.1 / §3.2 / §3.6 / §6 / §9 を更新

---

## 0. 一言で

> オブジェクトで UI ツリーを書き、Proxy state を代入するだけで実 DOM が差分更新される、ビルド不要・型付き・アクセシブルな軽量 UI ライブラリ。Electron・社内ツール・計測/制御系 UI のために。

**差別化 (付録 A)**: 「手書き plain object の UI 木 × Proxy 再描画 × ビルド不要」を全部揃えた競合は 2026-09 時点で不在。VanJS は関数呼び出し、Mithril は `m()` の戻り値、Alpine/petite-vue は HTML 属性、Solid は JSX 必須。README 冒頭はこの 1 行と比較表で位置を示す。

## 1. なぜ作り直すか (v1 監査の要約)

v1 は 5 か月・46 リリース・社内 11 アプリの実戦で API が磨かれたが、以下は**継ぎ足しでは直せない**構造の問題 (詳細は付録 C):

| # | v1 の構造的弱点 | 症状 (実害) |
|---|---|---|
| 1 | `__notify` の暗黙注入 (state トップレベル配置で set trap が注入) | 置き場所を誤ると silent failure。**controlled dialog など親 state 駆動の部品は警告すら出ない**。ほぼ全 consumer が 1 回は踏んだ |
| 2 | portal が `create_ui_page` の render に結合 | page 無しで dialog が消えない・css_for 島で portal 不可・「意図しない別 page に出る」は検知不能 |
| 3 | per-instance の使用クラス収集による CSS 注入 | page を通らない mount が**無装飾のまま DOM テストは通る**。5 consumer が同じ穴 |
| 4 | 浅い Proxy (1〜2 段) で未追跡代入が無警告 | `s.a.b.c = 1` が描画されない。canon は正しいが検知が無い |
| 5 | 公式 API の穴 → consumer が DOM 直書き → 次 render で上書き | Trend Guard の popup 横伸び |
| 6 | a11y が設計目標外 | menu の ARIA/キーボードを意図的に不搭載、dialog に focus trap なし |
| 7 | テストが jsdom のみ | 直近の重大バグ 3 件は全てブラウザ固有 |
| 8 | 発見性・信頼シグナル | snake_case・`ctx`・CJS・日本語のみ・npm 未公開・型なし (★1) |

**引き継ぐ思想**: plain object → 実 DOM 差分 (VDOM なし)、Proxy 代入で自動再描画、IME/フォーカスを壊さない、**利用者はビルド不要**、canon は 1 つ、docs は FACT、speculative fix しない、consumer 駆動、diff 対象外の島、CSS 変数テーマの島ごと適用、アイコンは「データ + 変換器 + CLI」、throw しない (グルーコードを連鎖破壊しない)、「consumer の DOM 直書き = 公式 API の穴のシグナル」。

## 2. ゴール / 非ゴール

**ゴール**
- G1 `<script>` 1 本 (jsDelivr IIFE) または `import` 1 本 (ESM) で 10 秒で動く。**TypeScript は制作側の道具であり、利用者にビルドを強いない** (付録 C の B16 への回答: ビルド不要哲学は「利用側」の性質として再定義する)
- G2 型でオブジェクトツリーの補完・検査が効く (タグ名 → 属性型、アイコン名 → Union 型)
- G3 部品の置き場所・page の有無・CSS の到達を**間違えようがない**構造 (silent failure の構造的排除)
- G4 主要部品が WAI-ARIA APG 準拠のキーボード操作を最初から持つ
- G5 実ブラウザテストが CI で回る
- G6 英語が正のドキュメント、日本語は翻訳。競合比較表を README 冒頭に
- G7 v1 の 11 アプリが段階移行できる (純粋ノードは自動変換、部品/portal は移行ガイド)

**非ゴール**: 大規模 SPA のルーティング/状態管理化、SSR/hydration、v1 との字面互換。

## 3. コア設計

### 3.1 ノード表現
- `{ tag, class, style, children, ref, key, ...attrs }`。**`ctx` → `children`** (付録 E: React/Preact/Solid/Mithril の多数派、確定)
- 文字列/number はテキスト、`null`/`false`/`undefined` は不可視 (v1 継承)
- 型: `type Node = string | number | null | false | undefined | Element | Node[]`。`Element` はタグ名で属性型を導く discriminated union。`style` は object のみ (v1 の string/object/array 3 形態を 1 つに)
- **島 (diff 対象外)**: v1 は「`ctx` キーを省略した要素の子孫は触らない」。v2 では **明示フラグ `{ tag: 'div', island: true }`** を推奨 — TS では `children` の省略忘れが silent な島になり、v1 と逆向きの罠になるため。`children` を持たない通常要素は「空として管理」。**(§11 判断事項 e)**

### 3.2 差分パッチ
- 継承: position-based + key-based reconciliation (A5)、`FORCE_REAPPLY` (value/checked/selected/scroll、A3)、select の value 再適用 (A4)、SVG namespace 継承、`data-*-role` 安定セレクタ (A14)
- **一般化**: v1 が ui_tweak にだけ入れた「編集中ガード」(A7) を**コアの規則**にする — `document.activeElement` である input/textarea/select には `value` の FORCE_REAPPLY を行わない (ユーザーの編集バッファを潰さない)。blur 後の render で同期。v1 の実害 (小数点ドロップ) の根本解消
- style の全キー再適用 (VDOM が正) は維持。dev モードで管理下属性への直書きを検知 (§3.6)

### 3.3 リアクティビティ
- 案 A: **浅い Proxy (v1 と同じ) + 深い代入を dev で検知して警告** (2 段目以降を read-only Proxy で包み set を捕まえる)
- 案 B: 深い Proxy (全追跡)。直感的だが Proxy 化コストと巨大データの逃げ道 (`ignore`) が要る
- **統括推奨: A**。shallow copy 差し替え canon (A10) は性能と予測可能性で正しかった。欠けていたのは検知だけ **(§11 b)**
- `renderNow()` / `nextRender()` の対 (A2)、rAF + setTimeout バックストップ (A6)、2 rAF ルールの FACT (A1) は継承

### 3.4 部品契約 — v1 最大の負債 (B1) の解消
- v1: `s.foo = createX()` で set trap が `__notify` を注入 (置き場所依存、型で検出不能、親 state 駆動部品は無警告)
- v2: **状態を持つ部品は `app.use(createDialog())` で明示登録** (notify と portal ホストを受け取る)。**状態を持たない部品は純粋関数** (v1 の `ui_inline_menu` 方式を button/input/icon… 全部に)。登録忘れは render 中に未登録インスタンスが呼ばれた瞬間に検知できる (暗黙注入が無い = 検知の穴が構造的に無い)
- `use()` は dispose を返し、v1 の `_popup_registry` 無制限成長 (B13) も解消 (登録解除 or WeakRef)
- controlled / uncontrolled 二重モード (A20)、`onClose(reason)` (A18)、rest スプレッド契約 + 内部 input 隔離 (A15) は継承。boolean/number の内部変換漏れ (B15) は型で吸収 **(§11 c)**

### 3.5 portal 層 (B2/B3)
- **mount 単位の portal ホスト**: `createApp(target)` がマウント直下に portal 要素を 1 つ持ち、`use()` 登録済みの popup/dialog/toast/tooltip はそこへ描画。page 部品への依存を廃止。テーマは §4 の CSS 変数継承で portal にも届く
- 複数 mount = 複数 portal (v1 の「最深 page 直下」不変条件 A13 を「自分の app の portal」に置き換え)。`portalTo(el)` で任意要素も指定可 (v1 の portal_to / page 非依存 dialog 要望 2 系統を吸収)
- v1 の SPEC と実装の乖離 (B3、スタック記述 vs 単純配列) は「型定義と実ブラウザテストを spec の単一ソース」にして再発防止

### 3.6 dev モードの安全網 + 「throw しない」の型付き再定義
- dev ビルド: 深い代入の警告 (§3.3) / `use()` 忘れ / 管理下 DOM への直書き検知 (MutationObserver、任意) / a11y 属性欠落の警告
- **NOOP の再定義 (B14)**: v1 の `NOOP_PROXY` は TS では `any` になり型が嘘をつく。v2 は**インターフェースごとの型付き NOOP オブジェクト** (例: 無効な target で `createApp` は console.error し、`App` 型を満たす no-op 実装を返す)。「グルーコードを連鎖破壊しない」哲学 (A9) を型安全のまま継承

## 4. スタイル配布 — 無装飾 silent failure (B4) の構造的排除
- UI 部品の CSS は **1 枚のスタイルシート**として配布 (`<link>` or JS から 1 回注入)。per-instance 収集を廃止 = 「知らないと踏む」問題自体が消える
- テーマは **CSS 変数を要素に当てる** (`applyTheme(el, 'dark')` = make_css_vars 後継、`color-scheme` 込み、A12 の 3 点セットは 1 関数に)。`:root` 強制なし、島ごと共存維持
- サイズ想定: 全規則常時ロードで 60〜70KB (gzip ~12KB)。「使う分だけ」は gzip に任せる **(§11 d)**
- `:active` は translate (A16) 等の CSS 契約は継承

## 5. アクセシビリティ (B7、初期設計に含める)
付録 E の APG 要点をそのまま契約に: dialog (role/aria-modal/focus trap/Esc 復帰/inert)、menu (haspopup/expanded/矢印/Home・End/Esc)、tabs (tablist/roving tabindex)、toast (role=status / alert、フォーカスを奪わない)、tooltip (describedby)。

## 6. 配布・ツールチェーン (B9/B12)
- TypeScript → **tsup** で ESM + CJS + IIFE (グローバル) + 単一 `.d.ts`。`exports` 条件分岐 (付録 E)
- npm 公開 + **jsDelivr** で `<script src>` 1 行、esm.sh で `import` 1 行。README 冒頭に両方
- LZ 自己展開版は v1 の独立 product として継続、v2 本体には含めない (CSP 誤解の回避)
- アイコン: v1 の descriptor 形式 `{ v?, s?, p }` (A17、型化しやすい) と CLI を継承。アイコン名を Union 型にして「手書き禁止」をコンパイル時に強制

## 7. テスト戦略 (B8)
- 単体: Vitest (jsdom) + 型テスト (expect-type)
- 実ブラウザ: **Vitest browser mode (Playwright provider)** を CI で。v1 でブラウザ固有だった 3 件 (rAF 停止環境 / select value / 編集中の number 入力) を**最初の回帰テスト**として移植
- consumer の adversarial lab 文化を CONTRIBUTING に明記

## 8. ドキュメント (B11)
- 英語 README (30 秒で価値 + 比較表 + CDN 1 行 + 3 行の例)、日本語は翻訳
- SPEC は FACT のみ、TUTORIAL は 10 章以内、CHANGELOG (Keep a Changelog)、SemVer、tag は 1.0.0 から途切れさせない

## 9. 移行 (v1 の 11 アプリ、付録 D)
- **自動変換できる**: 純粋ノード (`ctx`→`children`、snake_case → camelCase の対応表、style 3 形態 → object)
- **手動書き換え**: 状態を持つ部品 (`s.x = create_ui_x()` → `app.use(createX())`)、portal 系 (API 自体が変わる)
- **説明が要る**: ビルド不要を採用理由にしている consumer (Potopeta の single-file、展示ビューアの vendoring) へ「利用側は IIFE 1 本で従来どおり」を明示
- パイロット: 最小の consumer 1 つで移行し摩擦を測る (候補: 歯車DXF or Trend Guard)

## 10. フェーズ
| Phase | 内容 | 完了条件 |
|---|---|---|
| 0 | 本設計書の確定 + 名称/リポジトリ | 山崎承認 |
| 1 | コア (木→DOM、差分、Proxy、スケジューラ、島、編集中ガード、型) | 単体 + ブラウザで v1 回帰 3 件 pass、`<script>` 1 本デモ |
| 2 | 部品契約 (`use`) + portal ホスト + テーマ + CSS 1 枚配布 | dialog/popup/toast が page 無しで動く、a11y キーボード操作 |
| 3 | UI 部品の移植 (v1 RicUI から、a11y を足しながら) | v1 部品の 8 割 |
| 4 | docs (EN/JA)・npm・CDN・CI・CHANGELOG | 外部の人が README だけで動かせる |
| 5 | パイロット移行 1 アプリ → 自動変換ツール → 他 consumer | 1 アプリ本番 |

## 11. 判断事項

**決定済み (2026-09-02、山崎承認)**
- b. リアクティビティ: **浅い Proxy + dev で深い代入を警告** (§3.3 案 A)
- c. 部品契約: **`app.use(createX())` 明示登録 + 状態なし部品は純粋関数** (§3.4)
- d. CSS 配布: **1 枚のスタイルシート** (§4)
- e. 島の表現: **明示フラグ `island: true`** (§3.1)

- a. 名称・リポジトリ: **ブランド継続 `ricdom` (npm 無スコープ、2026-09-02 時点で未登録を確認)、新規リポジトリ `miyoshi-tec/ricdom`**。v1 は `miyoshi-tec/RicDOM` として凍結 (保守モード)。バージョンは **2.0.0** から (v1 = 0.x/0.4.x なので 1.0 を飛ばして「後継」を明示)

**Phase 0 完了 (2026-09-02)。以降は Phase 1 (コア) へ。**

## 12. Phase 1 実装での確定事項 (2026-09-02、実装からのフィードバック)

- 型名は **`RicNode` / `RicElementNode`** (設計書の `Node` / `Element` は DOM のグローバル型と衝突するため改名)
- **`createApp(target, state, render)` の 3 引数**に変更。v1 の「state の中に render を置く」形は TS で `S` の推論が自己参照になり render 内の `s` が `any` に落ちるため。render を分離すると `S` が state から素直に推論され、render 内も完全に型付く。v1 からの移行は機械的 (`render` プロパティを第 3 引数へ)
- target が未解決のとき: v1 の 20 秒ポーリングは持たず、**`DOMContentLoaded` を 1 回だけ待って再解決** (それでも無ければ console.error + 型付き NOOP)。`<head>` 内 script の典型ケースだけを救う、予測可能な挙動
- 複数 `createApp` 間の state 共有 (v1 の WeakMap 共有) は**持たない**。必要なら state オブジェクトを外で作って各 app に渡す (明示的)
- HTML/SVG で同名タグ (`a` / `title` / `script` / `style`) は HTML 側の属性型を採用 (SVG 側は `svg` 配下でも HTML 型で受ける。実害が出たら再検討)
- `tag` は型上**必須** (`{}` は型エラー)。実行時に tag 欠落なら console.error + 不可視扱い (v1 踏襲)
- gzip 目標: IIFE **4.6KB** (Phase 1 実測、≤5KB 達成)

## 13. Phase 2 実装での確定事項 (2026-09-02)

- **部品契約**: `UsePart` = `attach(host)` / `dispose()` / `renderPortal()`。`Host = { notify(), portal, app }` は `app.use()` 経由でのみ渡される。`Host.app` の型は `App<any>` (ジェネリック化すると構造的部分型の分散で `attach` が合わなくなるため。部品側が state の型に依存しない設計なので実害なし)
- **portal**: `createApp(target, state, render, { portalTo? })`。portal 要素は差分の位置ズレを防ぐため **安定 key 付きの sentinel** として管理 (Phase 2 で実際に踏んだバグ: render 結果の可視/不可視切替で index がずれ portal が再生成されていた)
- **dialog の `inert`**: portal の兄弟要素に対して掛ける (単一 app の一般ケース)。ページ内の無関係な他 app までは inert にしない。document 全体を inert にするオプションは要望が出たら (再検討条件)
- **`createPopup` は menu 専用** (ARIA の `role="menu"` 前提)。v1 の label/icon/chevron ドロップダウンモードは **Phase 3 で `createDropdown` (Popover 系) として別部品に** — canon 1 つを守るため 1 部品に 2 つの意味論を持たせない
- **ページ全体のスクロールバー既定スタイルは Phase 3 で**: v2 に page 部品が無いため、`applyTheme(el)` が付与するマーカー属性 (`data-ricdom-theme`) 配下にスクロールバー規則を当てる方式で移植する (トークンは Phase 2 で用意済み)
- **部品ごとのテーマ上書き props (v1 の `{theme, density, fontSize}`) は持たない**。portal は target 配下なので `applyTheme` の CSS 変数継承で足りる。再検討条件: 「同一 app 内で portal だけ別テーマ」の具体要望
- **`ricdom/ui` はコアへの実行時依存ゼロ** (型のみ)。部品は `host` 経由でしか app に触らないため、IIFE 2 本は論理的な組でありバンドラ的な依存ではない。意図どおりとして確定
- **アニメ完了待ちは `animationend` + 700ms setTimeout バックストップ** (CSS 未ロード / `--ric-duration` 未設定でも状態遷移が固まらない。コアの rAF+バックストップと同じ思想)。CSS 変数は `var(--x, fallback)` で既定値を持つ
- focus trap の可視要素フィルタ (`offsetParent` 判定) は Phase 2 では省略 → **Phase 3 で実ブラウザテスト付きで追加**
- **コア gzip 5,037B (5KiB 天井)。Phase 3 以降、コアには機能を足さない** (部品側・ui 側で解決する)

## 14. Phase 3a 実装での確定事項 (2026-09-02)

- **`data-ricdom-role` は全部品に付与する** (Phase 2 の `uiButton` / `uiInput` は Phase 3b で追補)。値は `UI_ROLE` 列挙で一元管理
- bind 系は `bindInput` / `bindTextarea` / `bindCheckbox` / `bindSelect` / `bindRange` の 5 つ。`bindColor` / `bindRadiobutton` は要望が出たら (再検討条件)
- **v1 の潜在バグを移植時に発見**: `bind_textarea` だけ `...options` を value/oninput の後に展開しており、options が計算済み値を上書きできた。v2 は 5 つとも「options → 計算済み」の順で統一 (rest スプレッド契約 A15 と同じ)。v1 側は保守モードのため記録のみ
- `uiIcon` の「descriptor 手書き禁止」は **Phase 3c (アイコン同梱データ + `ricdom-icon` CLI 移植) で完成**。それまでテスト/デモは v1 の検証済み descriptor を再利用
- CSS: cyber/aqua のみ定義する `--ric-popup-blur` / `--ric-panel-shadow` は `var(--x, fallback)` で他テーマにも既定値を持たせる (宣言全体が invalid になるのを防ぐ)
## 15. Phase 3b 実装での確定事項 (2026-09-02)

- `createCollapseBox` の完了検知は **`transitionend` + 700ms バックストップ** (高さは per-instance の動的値で `@keyframes` では表現できないため。§13 の「animationend」は「CSS のアニメ完了イベント + バックストップ」の総称として読む)。ヘッドレス部品なので `aria-expanded` は呼び出し側のトリガーが持ち、`idFor(key)` で `aria-controls` を結ぶ
- `createSplitter`: render props は `side` / `main` にノードを直接渡す (v1 の `{ctx}` ラッパーは廃止)。**矢印キーでのリサイズ (10px、`onResizeEnd` は押下ごと)** は v2 新規。`max` が null なら `aria-valuemax` を省略
- `createTabs`: **automatic activation** (矢印キー移動で即切替、APG の両方式のうち一般的な方)。v1 の `bind_tabs` は uncontrolled モードが代替するため復活させない
- `createDropdown`: トリガーは `aria-haspopup="dialog"` (汎用 Popover の APG 上の最近傍値)。v1 の `_get_expand_ref` (論理コンテナ基準の展開方向ヒューリスティック) は移植せず、viewport 基準の flip + clamp で統一 (Phase 2 と同じ簡素化)。再検討条件: 「広い行の右端トリガーで左に展開してほしい」類の実害報告
- 排他制御は **app 単位の 1 レジストリを popup と dropdown で共有** (v1 の単一 registry を app スコープにしたもの、dispose で解除)
- **accordion の閉じたパネルは `hidden` 属性を付けて a11y ツリーから除外する** (`role="region"` を全パネルに付ける実装のままだと閉じたパネルがランドマークノイズになる → Phase 3c で追補)
- CSS 微差 (dropdown trigger の `width:auto`、splitter ボタン hover の共通トークン化) は v2 の判断を正とする
- **FACT (docs へ)**: `createApp(target, state, render)` に渡した **元の `state` オブジェクトを直接変更しても再描画されない**。反応するのは戻り値の `app` と render の引数 `s` (= Proxy) だけ。Phase 3a のデモで実際に踏んだ罠 (v1 でも同じ)。TUTORIAL の最初の章と型ドキュメントに明記し、dev モードで検知できる方法があれば Phase 4 で検討 (元オブジェクトの参照を差し替えられないため現時点では docs で対処)

---

## 付録

### A. 競合比較 (2026-09 調査)

| ライブラリ | UI ツリー記法 | リアクティビティ | gzip | ビルド不要 | TS 型 | 導線 |
|---|---|---|---|---|---|---|
| VanJS | 関数呼び出し `tags.div(...)` | 独自 state (`.val`) | ~1KB | 可 | あり | npm/CDN |
| Alpine.js | HTML 属性 (`x-data`) | Proxy | 7〜15KB | 可 | 限定的 | CDN 中心 |
| petite-vue | HTML 属性 (`v-` / `@` / `:`) | Vue3 型 Proxy | ~6KB | 可 | あり | CDN |
| htmx | HTML 属性 (`hx-*`) | なし (サーバー主導) | ~14KB | 可 | 補助的 | CDN/npm |
| Lit | タグ付きテンプレート + Web Components | `@property` 宣言 | 5〜6KB | 概ね可 | 一級 | npm/CDN |
| Preact + htm | タグ付きテンプレート | VDOM 差分 (+Signals) | ~4KB | 可 | あり | npm/CDN |
| Solid.js | JSX | signal (VDOM なし) | ~7.6KB | **不可** | 一級 | npm |
| Mithril | `m(sel, attrs, children)` → vnode | VDOM 差分、手動 redraw | ~8.8KB | 可 | 同梱 | npm/CDN |
| **RicDOM 2** | **plain object 手書き** | **Proxy (浅い + dev 警告)** | 目標 ≤ 5KB (コア) | 可 | 一級 | npm/jsDelivr |

近縁: JsonML (静的表現のみ)、Mithril vnode (`m()` の戻り値)、json-render 系 (React 前提の Schema 生成)。「手書き JSON 木 + Proxy + ビルド不要」の組み合わせは不在。

### B. v1 から引き継ぐ契約・FACT (棚卸し §A、20 件)

| # | 契約 | 由来 | v2 での扱い |
|---|---|---|---|
| A1 | 2 rAF ルール (DOM commit ≠ layout/paint) | ブラウザ仕様 | FACT として継承 |
| A2 | `render_now` / `next_render` の対 | Potopeta の flaky E2E 決定論化 | `renderNow` / `nextRender` |
| A3 | FORCE_REAPPLY (value/checked/selected/scroll) | TrendGuard、controlled drift | 継承 + §3.2 の編集中ガードで補完 |
| A4 | select の value/option 構築順対策 | 設計OS 第 2 信 | 継承 (DOM 制約) |
| A5 | key ベース reconciliation | TrendGuard | 継承、key 型を絞る |
| A6 | rAF + setTimeout バックストップ | Unizon kiosk (重大) | 継承 (Electron/kiosk 必須) |
| A7 | controlled input の編集中ガード | 歯車DXF | **コア規則に一般化** (§3.2) |
| A8 | 内部イベント → 再描画の仕組みの必要性 | 全部品 | 必要性は継承、方式は `use()` に (§3.4) |
| A9 | throw しない・NOOP | AI 協働前提 | **型付き NOOP** に再定義 (§3.6) |
| A10 | 浅い Proxy + shallow copy canon | 10KB コア | 継承 + dev 検知 (§3.3) |
| A11 | diff 対象外の島 | canvas 保護の転用 | **明示フラグ化を推奨** (§3.1) |
| A12 | css_for 3 点セット | 展示ビューア | `applyTheme` 1 関数 + CSS 1 枚に統合 (§4) |
| A13 | portal は最深 page 直下 | stacking context 回避 | 「自分の app の portal」に置換 (§3.5) |
| A14 | `data-*-role` 安定セレクタ | E2E/CSS カスタマイズ | 継承、列挙型化 |
| A15 | rest スプレッド契約 + 内部 input 隔離 | ui_button/ui_input 回帰 | 継承、型で「計算済み上書き不可」 |
| A16 | `:active` は translate | Rancha の transform 衝突 | 継承 |
| A17 | アイコン手書き禁止 + CLI | LCP 中心円欠落 | 継承、名前を Union 型に |
| A18 | `on_close(reason)` | 誤クローズ防止 | 継承、portal 系全体へ展開 |
| A19 | 「DOM 直書き = API の穴のシグナル」 | Trend Guard | 設計プロセスの原則として継承 |
| A20 | controlled / uncontrolled 二重モード | 11 consumer が使用 | 継承 |

### C. v1 設計負債と解消方針 (棚卸し §B、16 件 + 見送り再評価)

| # | 負債 | 根因 | v2 解消 |
|---|---|---|---|
| B1 | `__notify` 暗黙注入・state 配置制約 | set trap の副作用で実現、型で検出不能 | `app.use()` 明示登録 (§3.4) |
| B2 | portal と page の結合 | 単一グローバルバッファを page が drain | mount 単位 portal ホスト + `portalTo` (§3.5) |
| B3 | portal の SPEC と実装の乖離 | docs ドリフト | 型 + ブラウザテストを spec の単一ソース |
| B4 | per-instance CSS 収集の無装飾 silent failure | 収集漏れ = 即無装飾、テストは通る | CSS 1 枚配布 (§4) |
| B5 | 浅い Proxy の未追跡代入が無警告 | 検知機構なし | dev 警告 (§3.3) |
| B6 | DOM 直書きの上書き | 公式 API の穴 | 島の明示フラグ + `use()` で意図的 imperative 領域を型で区別 |
| B7 | a11y 不在 | 設計目標外 | §5 |
| B8 | jsdom のみ | 実ブラウザ CI なし | §7 |
| B9 | CJS のみ | — | ESM/CJS/IIFE (§6) |
| B10 | 命名 (snake_case / `ctx` / 例外 PascalCase) | — | camelCase / `children` (決定) |
| B11 | 日本語のみ | — | 英語正 (§8) |
| B12 | 型定義なし | JSDoc は日本語散文 | TS でゼロから (決定) |
| B13 | `_popup_registry` 無制限成長 | 削除 API なし | `use()` の dispose / WeakRef |
| B14 | NOOP_PROXY の型付け不能 | `any` 化 | 型付き NOOP (§3.6) |
| B15 | checked/selected の boolean/number 内部漏れ | 実装詳細が暗黙知 | 型で吸収 |
| B16 | 「ビルド不要 10KB」と TS 化の緊張 | 哲学の定義が制作側/利用側で未分離 | **利用側ビルド不要**として再定義 (G1) |

見送り案件の再評価: `portal_to` → §3.5 で最初から採用 / ESM → 自動解消 / watch・effect → 「宣言的 render + 明示的副作用」原則は維持、型安全な effect は Phase 3 以降で再検討 / audit_unstyled → CSS 1 枚配布で問題自体が消滅 / camelCase → 決定 / 同梱アイコン方針 → 維持 + Union 型 / 自前スクロールバー → 優先度低、標準スクロールバー API として再設計余地。

### D. 移行で壊れる点 (棚卸し §C)

| 領域 | 壊れ方 | 対応 |
|---|---|---|
| JSON 木の形 | `ctx`→`children`、style 3 形態 → object、snake_case → camelCase | **自動変換ツール** (機械的) |
| 部品の置き場所 | `s.x = create_ui_x()` → `app.use(createX())` | 手動 (最大の破壊点、移行ガイド) |
| テーマ API | `--ric-*` flat object の形、export_theme 系 | 対応表 + 手動 |
| アイコン descriptor | `{ v?, s?, p }` | **そのまま** (低コスト) |
| CLI | `ricdom-icon` / `ricdom-lz` | インターフェース維持、配置変更のみ確認 |
| portal 系 | popup/dialog/toast/tooltip の API 変更 | 手動 |
| ビルド有無 | Potopeta / 展示ビューアは「ビルド不要」が採用理由 | 「利用側は IIFE 1 本で不変」を個別説明 |

全 11 consumer が同一組織内のため、外部向け後方互換保証の優先度は低い。「純粋ノードの自動変換 + 個別移行ガイド」が現実的な着地。

### E. 配布・CI・a11y の標準形 (2026-09 調査)

**パッケージ**: `"type": "module"` + `exports` 条件分岐 (`import` → `.mjs` + `.d.mts`、`require` → `.cjs` + `.d.cts`)。ビルドは **tsup** (esbuild ベース、ESM/CJS/IIFE + 単一 d.ts を一括生成)。Electron 旧版 consumer のため当面は ESM/CJS 両方。

**CDN**: **jsDelivr** を正。README 冒頭に `<script src="https://cdn.jsdelivr.net/npm/<pkg>@1/dist/<pkg>.iife.min.js">` と `import … from 'https://esm.sh/<pkg>@1'` を並記。

**信頼シグナル**: Actions バッジ / CHANGELOG (Keep a Changelog) / Conventional Commits / CONTRIBUTING / CODE_OF_CONDUCT / SECURITY.md。

**実ブラウザテスト**: **Vitest browser mode (Playwright provider)**。Actions 最小構成: `setup-node` → `npm ci` → `npx playwright install --with-deps` → `vitest run --browser`。

**a11y 最低線 (WAI-ARIA APG)**: dialog (`role="dialog"` + `aria-modal` + labelledby/describedby、focus trap、Esc 復帰、背景 `inert`) / menu (`aria-haspopup` + `aria-expanded`、`role="menu"`/`menuitem`、矢印・Home/End・Esc、Tab 停止点 1 つ) / tabs (`tablist`/`tab`/`tabpanel`、roving tabindex) / toast (`role="status"` polite、緊急は `alert`、フォーカスを奪わない)。

**命名**: create / mount / render / bind / use。子要素キーは `children` (確定)。
