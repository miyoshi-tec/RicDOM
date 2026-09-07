> 内部記録 (日本語): 統括の監査記録。公開リポジトリに残す。利用者向けドキュメントは README / docs/SPEC.md / docs/TUTORIAL.md / docs/V1_VS_V2.ja.md を参照。

# v1 → v2 パリティ一括監査

## 目的

パイロット 10 アプリの移行 (§29 まで) を通じて、同型の取りこぼし (z-index 欠落 / position 欠落 / 塗り欠落 / prop 消失 / variant 消失) が繰り返し見つかってきた。これらは個別アプリの移行報告のたびに後追いで発覚しており、パイロットが終わった今、**v1 `ric_ui/` + `src/ricdom.js` の inline style・暗黙挙動・正式 prop / export を v2 と機械的に突合する一括監査**を 2026-09-07 に実施した。読み取り専用の 3 系統に分けて並行実施した。

- **監査 A**: control / layout / surface(panel) / text 部品 (`ric_ui/control/*`, `ric_ui/layout/{ui_col,ui_row,ui_grid}`, `ric_ui/surface/ui_panel`, `ric_ui/text/*` など)
- **監査 B**: popup / composite 系 (`ric_ui/popup/*`, `ric_ui/composite/*`)
- **監査 C**: テーマ / コア / export / トークン / パレット (`ric_ui/context.js`, `ric_ui/css_registry.js`, `ric_ui/layout/ui_page.js`, `ric_ui/index.js`, `src/ricdom.js`)

いずれもソースの読み取りとドキュメント (SPEC.md / V1_VS_V2.ja.md / DESIGN.ja.md) との突合のみを行い、編集・コミットは行っていない (監査時点)。本書はその 3 本の報告を統括が振り分け・集約したものである。

## 凡例

判定 = 同等 / 同等(実装場所が違う) / 意図的な変更・docs あり / 意図的な変更・docs なし / **欠落 (パリティの穴)** / 要確認

## 総括

- 判定一覧 (次節) は 18 行 (うち #18 は #11 と同根のため件数には含めない、実質 17 件)。統括の振り分け内訳:
  - **欠落 → 復活 / 明記が必要**: 5 件 (#1 `bindRadiobutton`/`bindColor`、#2 `export_settings` 相当、#3 `version` export、#4 `trigger_variant`、#10 `watch_outside_click`)
  - **意図的な変更・docs なし → V1_VS_V2 等に明記で解消**: 3 件 (#9 dropdown label 幅、#11 `create_ui_panel` 廃止、#13 `class` の Record 形追加)
  - **要確認 (小粒・実害未確認)**: 9 件 (#5〜#8, #12, #14〜#17)
- **既知パターンの再発はほぼ無し**: z-index 欠落・position 欠落・塗り欠落・variant 消失といった過去パイロットで頻発したパターンは、alpha.1〜13 で先回り修正済みのものを除き**新規にはほぼ見つからなかった** (詳細は §5)。唯一の例外が #9 (`.ric-dropdown__trigger--label` の `width` 消失、CSS 移植時の値取りこぼし)。
- **パレット 5 種・トークン 24 種は完全一致** (監査 C §5/§6、値・命名とも 1 文字違わず一致を確認済み)。
- **コアの契約 (diff/reconciliation/スケジューラ/FORCE_REAPPLY/key 重複/イベント/SVG 名前空間等) は SPEC.md に FACT 化済みで挙動も一致** (監査 C §3)。

---

## 1. 判定一覧 (統括の振り分け)

| # | 項目 | 出所 | 判定 | 統括の振り分け | 備考 / 再検討の条件 |
|---|---|---|---|---|---|
| 1 | `bindRadiobutton` / `bindColor` が実装ごと不在 | C §4.2 | 欠落 | **alpha.14 で対応**: `bindRadiobutton`/`bindColor` を `src/ui/bind.ts` に追加 | v1 正式 API。`bind.ts` に定義が無い |
| 2 | `export_settings` 相当 (theme / density / fontSize の一括読み戻し) が無い | C §1.3 | 欠落 | **alpha.14 で対応**: `exportSettings(el)` を `src/ui/theme.ts` に追加 | density / fontSize を読み戻す公開 API が無い |
| 3 | `version` export が core / ui に無い | C §4.1 / §4.2 | 欠落 | **alpha.14 で対応**: `ricdom`/`ricdom/ui` に `version` export を追加 (tsup の `define` で package.json の値を焼き込み) | consumer の VERSION.txt / sync に使う |
| 4 | `createDialog` に `trigger_variant` 相当が無い | B 上位 2 | 要確認 → 欠落 | **alpha.14 で対応**: `DialogProps.triggerVariant?: UiButtonVariant` を追加 | v1 正式オプション。popup は alpha.2 で trigger object 形を得た |
| 5 | `focus_when` の `!el.disabled` ガードが `createFocusWhen` に無い | A 上位 3 | 要確認 | **alpha.14 で対応**: `focusWhen.ts` の focus 直前に disabled ガードを追加 | 小さな parity |
| 6 | `uiInput.maxlength` が型に無い (rest 透過はする) | A 上位 5 | 要確認 | **alpha.14 で対応**: `UiInputProps.maxlength?: number` を追加 | LCP の `style` と同型 |
| 7 | hljs 未読込 warn の console ガード省略 | A 上位 5 | 要確認 | **alpha.14 で対応**: `internal/hljs.ts` に console 未対応環境向けの防御を復元 | |
| 8 | `toast.ts` ヘッダコメント「v1 から role/aria-live あり」は誤り | B 上位 5 | 要確認 (docs) | **alpha.14 で対応**: ヘッダコメントを「v1 には無く v2 で新設」に修正 | v1 には無かった |
| 9 | `.ric-dropdown__trigger--label` の `width` が v1 `100%` → v2 `auto` | B 上位 1 | 意図的・docs なし | **現状維持 + V1_VS_V2 に明記** | 3 パイロット (TG / 線茶 / Potopeta) が `auto` で見た目確認済み。条件: 親幅いっぱいに依存したレイアウトの実害報告 |
| 10 | `watch_outside_click` 公開ヘルパーの消失 | A 上位 1 / C §4.2 | 欠落 | **廃止を明記 (V1_VS_V2) + 代替 1 行** | v1 でも 5 行 (document の click 監視 + 解除)。条件: 2 consumer から要望 |
| 11 | `create_ui_panel` (状態を持つ panel ファクトリ) の廃止 | A 上位 2 / C §4.2 | 意図的・docs なし | **V1_VS_V2 に明記**: `uiPanel` + 要素への `applyTheme` (島) で表現 | |
| 12 | `ric-theme-change` window イベント同期の代替なし | C §2 #31 | 要確認 | **SPEC に FACT**: 複数 root の同期は consumer が各 root に `applyTheme` | v1 内部機構、公開 API ではない |
| 13 | `class` の `Record<string, boolean>` 形は v2 で追加 (上位互換) | C §3 #44 | 意図的・docs なし | **V1_VS_V2 に行追加** | |
| 14 | `_get_portal_cb` / `_get_expand_ref` (containing block 探索) の廃止が docs に無い | B 上位 3 | 要確認 | **SPEC に FACT** (viewport 基準、backdrop-filter 祖先内の理論的ずれ) | 条件: cyber/aqua の `.ric-panel` 内で実害報告 |
| 15 | tweak folder が `<details>` → 独自 `hidden` (ページ内検索の自動展開を失う可能性) | B 上位 4 | 要確認 | **見送り + 記録** | 条件: find-in-page の要望 → `hidden="until-found"` を検討 |
| 16 | `on*` に `null` / `undefined` を渡したときの v1/v2 差 | C §3 #51 | 要確認 | **実装を確認して SPEC に FACT** (alpha.14 候補) | |
| 17 | `bind_tabs` 廃止の明記なし | C §4.2 | 要確認 | **V1_VS_V2 に明記** | `createTabs` が controlled/uncontrolled を内包 |
| 18 | `safe_notify` 相当 (panel 純粋関数化の帰結) | A 上位 4 | 意図的・docs なし | 11 と同根、11 の記述に含める | |

### 各行の file:line (A/B/C の報告から補完)

| # | 報告内の項目番号 | v1 file:line | v2 file:line |
|---|---|---|---|
| 1 | C §4.2 (`bind_radiobutton`/`bind_color` 行)、A `uiRadiobutton`/`uiColor` 表末行 | `ric_ui/control/bind_radiobutton.js` (全体)、`ric_ui/control/bind_color.js` (全体) | `src/ui/bind.ts` (grep 確認: `bindRadiobutton`/`bindColor` の定義行なし。`bindInput`/`bindTextarea`/`bindCheckbox`/`bindSelect`/`bindRange` の5関数のみ) |
| 2 | C §1.3 #16 | `ric_ui/context.js:355-368`、`ric_ui/index.js:93` (export) | 該当なし (`src/ui/theme.ts:9-12` にコメントのみ、`exportTheme` はあるが density/fontSize 非対応) |
| 3 | C §4.1 / §4.2 (`version` 行、行番号記載なし) | `src/ricdom.js` の `version` export (行番号は C の報告に記載なし)、`ric_ui/index.js` の `version` export (同) | `src/index.ts` (該当なし、package.json 参照が必要)、`src/ui/index.ts` (該当なし) |
| 4 | B §1 表 / 上位2 | `ric_ui/popup/create_ui_dialog.js:107,204` | `src/ui/dialog.ts:328-347` (該当箇所なし、`buildTrigger` は class 固定) |
| 5 | A `focus_when` 表 / 上位3 | `ric_ui/control/focus_when.js:45` (`if (!el.disabled && ...) el.focus();`) | `src/ui/focusWhen.ts:55-60` (`focusRef`、disabled ガード無し) |
| 6 | A `uiInput` 表 / 上位5 | `ric_ui/control/ui_input.js:19,30` | `src/ui/input.ts` (`UiInputProps` に `maxlength` の型定義なし、rest スプレッドで透過のみ) |
| 7 | A 補助ヘルパー表 / 上位5 | `ric_ui/_factory_helpers.js:61-63` (`typeof console==='undefined'` ガード) | `src/ui/internal/hljs.ts:23-30` (ガード無し、直接 `console.warn`) |
| 8 | B §3 表 / 上位5 | `ric_ui/popup/create_ui_toast.js` (全文 grep 済み、role/aria-live 属性なし) | `src/ui/toast.ts:1-6` (ヘッダコメントが「v1 から実装済み」と誤記) |
| 9 | B §2 表 / 上位1 | `ric_ui/css_templates.js:742-746` (`.ric-popup__trigger--label { width:100%; }`) | `src/ui/cssTemplates.ts:1114-1118` (`.ric-dropdown__trigger--label { width: auto; }`) |
| 10 | A 補助ヘルパー表 / 上位1、C §4.2 | `ric_ui/dom_helpers.js:32-36`、`ric_ui/index.js:78,147` (公開 export) | 該当なし (`src/ui/index.ts` に export なし、`src/ui/inlineMenu.ts` にコメント1件のみ「将来の watchOutsideClick 相当ヘルパー」) |
| 11 | A `ui_panel` 表 / 上位2、C §4.2 | `ric_ui/surface/ui_panel.js:54-95` (`create_ui_panel`) | `src/ui/panel.ts:12-13` (コード内コメントのみ、上位ドキュメントに記載なし) |
| 12 | C §2 #31 | `ric_ui/layout/ui_page.js:107-115` | 該当なし (grep: `ric-theme-change`/`themechange` → 0 件) |
| 13 | C §3 #44 | `src/ricdom.js:100-108` (`normalize_class`、string/array のみ) | `docs/SPEC.md` §1 型表 (Record<string,boolean> 対応を明記。実装ファイルの行番号は C の報告に記載なし) |
| 14 | B §2 表 / 上位3 | `ric_ui/popup/_popup_utils.js:51-67` (`_get_portal_cb`)、`:73-83` (`_get_expand_ref`) | `src/ui/internal/popupPosition.ts:1-16,59-81` |
| 15 | B §12 表 / 上位4 | `ric_ui/composite/ui_tweak.js:237-247` (`<details>`) | `src/ui/tweakPanel.ts:398-434` (`<button aria-expanded>` + `<div role=region hidden>`) |
| 16 | C §3 #51 | `src/ricdom.js:275-281,472-478,500-505` | `src/dom.ts` (実装レベルの追加確認が必要と C が明記。行番号未特定、`docs/SPEC.md` §2.1 本文には個別挙動の記載なし) |
| 17 | C §4.2 (`bind_tabs` 行)、A `bind_*` 総括表 | `ric_ui/composite/bind_tabs.js` (全体) | `src/ui/tabs.ts` (controlled/uncontrolled を内包する設計に統合) |
| 18 | A 補助ヘルパー表 / 上位4 | `ric_ui/_factory_helpers.js:27-43` (`safe_notify`) | 該当箇所なし (担当コンポーネント範囲内で不要化。#11 と同根) |

---

## 2. 各領域の詳細

### 2.1 監査 A: control / layout / surface(panel) / text 部品

対象: `ric_ui/control/*.js`, `ric_ui/layout/{ui_col,ui_row,ui_grid}.js`, `ric_ui/surface/ui_panel.js`, `ric_ui/text/*.js`, `ric_ui/_factory_helpers.js`, `ric_ui/style_utils.js`, `ric_ui/dom_helpers.js`, `ric_ui/css_templates.js` (該当クラスのみ) / v2: `src/ui/{button,checkbox,color,icon,input,radiobutton,range,select,separator,textarea,bind,focusWhen,col,row,grid,panel,text,codePre,mdPre}.ts`, `src/ui/cssTemplates.ts`, `src/ui/internal/{pureHelpers,hljs}.ts`

#### uiButton

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| props: variant (default/primary/ghost/link) | ui_button.js:4-9,30 | button.ts:19,42 | 同等 (→§3 既対応) | link は alpha.8 で復活済み |
| props: size (sm/md/lg、既定 undefined=density追従) | ui_button.js:31,39 | button.ts:29,42-45 | 同等(実装場所が違う) | v2 既定は `'md'` 明示 |
| props: disabled | ui_button.js:33,46 | button.ts:30,51 | 同等 | |
| props: onclick | ui_button.js:32,45 | button.ts:34 | 同等 | |
| props: style (rest 経由) | ui_button.js:34(rest) | button.ts:33 (型明記) | 同等 (→§3 既対応) | alpha.9 で型復活 |
| rest スプレッド契約 | ui_button.js:41-48 | button.ts:46-53 | 同等 | |
| data-ric-role 相当 | (v1 にこの概念なし) | button.ts:50 `data-ricdom-role: 'button'` | 意図的な変更・docs あり | SPEC §11 registry |
| CSS: `.ric-button` 基本 | css_templates.js:270-302 | cssTemplates.ts:61-91 | 同等 | 値完全一致 |
| CSS: `--primary`/`--ghost` | css_templates.js:303-324 | cssTemplates.ts:92-113 | 同等 | |
| CSS: `--link` | css_templates.js:325-344 | cssTemplates.ts:120-139 | 同等 (→§3 既対応) | alpha.8 |
| CSS: `--sm`/`--lg`/`--md` | css_templates.js:345-359 | cssTemplates.ts:140-149 (`--md`は無し、意図的) | 同等(実装場所が違う) | button.ts:26-28 に理由明記 |
| CSS: `:disabled` opacity/cursor | css_templates.js:299-302 | cssTemplates.ts:88-91 | 同等 | |

#### uiCheckbox

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| checked (既定 false) | ui_checkbox.js:20,35 | checkbox.ts:21,35,47 | 同等 | |
| 暗黙挙動: checked numeric(1/0)強制 | ui_checkbox.js:6,34-35 | checkbox.ts:11-14(コメント),47 | 同等(実装場所が違う) | v2コア `DOM_PROPERTY_KEYS` (src/dom.ts:33-35,135,262) で解消 |
| disabled | ui_checkbox.js:22,37 | checkbox.ts:22,35,49 | 同等 | |
| rest は外側 `<label>` へ | ui_checkbox.js:14-17,26-38 | checkbox.ts:6-9,38-53 | 同等 | |
| ラベル空なら span 省略 | ui_checkbox.js:40 | checkbox.ts:52 | 同等 | |
| CSS 完全一致 | css_templates.js:440-484 | cssTemplates.ts:469-513 | 同等 | |

#### uiColor

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| hex/rgba 自動判定 | ui_color.js:15-22 | color.ts:29-42 | 同等 | |
| rgba モード合成イベント | ui_color.js:52-59 | color.ts:70-79 | 同等 | |
| alpha slider | ui_color.js:62-66 | color.ts:81-88 | 同等 | |
| レイアウト分岐 | ui_color.js:75-106 | color.ts:99-136 | 同等 | |
| rest は外側 `.ric-color` へ | ui_color.js:31-34,78,93 | color.ts:12-13,101-113 | 同等 | |
| disabled | ui_color.js:38,71,100 | color.ts:20,95,128 | 同等 | |
| CSS 完全一致 | css_templates.js:644-691 | cssTemplates.ts:669-716 | 同等 | |
| bindColor | bind_color.js 全体 | (v2 に無し) | **欠落 (表1-#1)** | DESIGN.ja.md:163 のみ言及 |

#### uiIcon

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| size (既定'1em') | ui_icon.js:24,40 | icon.ts:26,59 | 同等 | |
| label→role=img+aria-label | ui_icon.js:26-27,91-94 | icon.ts:28,93 | 同等 | |
| spin | ui_icon.js:28,42,67 | icon.ts:29,47,72 | 同等 | |
| strokeWidth優先 | ui_icon.js:29,58-63 | icon.ts:30,68 | 同等 | |
| stroke/fill判定 | ui_icon.js:52-63 | icon.ts:63-69 | 同等 | |
| inline style順序 | ui_icon.js:82-90 | icon.ts:89-92 | 同等 | |
| アイコンデータ非同梱方針 | ui_icon.js:2-13 | icon.ts:1-16 | 同等 | v2は36個同梱を追加 (拡張) |
| CSS完全一致 | css_templates.js:259-268 | cssTemplates.ts:751-760 | 同等 | |
| svg属性のIDL制約 | (該当制約なし) | icon.ts:95-98 | 意図的な変更・docs あり | v2型システム固有 |

#### uiInput

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| placeholder/value/type/disabled | ui_input.js:14-18,26-30 | input.ts:12-16,33-36 | 同等 | |
| maxlength | ui_input.js:19,30 | (型定義に無し、rest透過のみ) | 要確認 (表1-#6) | uiTextarea は型明記、非対称 |
| value 常時反映 | ui_input.js:26 | input.ts:34 | 同等 | FORCE_REAPPLY_DOM_KEYS で担保 |
| rest スプレッド契約 | ui_input.js:20-24 | input.ts:4-6,27-37 | 同等 | |
| CSS完全一致 | css_templates.js:361-392 | cssTemplates.ts:151-182 | 同等 | |
| bindInput | bind_input.js | bind.ts:40-45 | 同等 | IME注意コメント継承 |

#### uiRadiobutton

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| options 正規化 | ui_radiobutton.js:38-40 | radiobutton.ts:44 | 同等 | |
| label 変換規則 | ui_radiobutton.js:42-49 | radiobutton.ts:50-54 | 同等 | |
| per-option 追加属性転送 | ui_radiobutton.js:9-10,52-58 | radiobutton.ts:9,64-70 | 同等 | |
| checked numeric強制 | ui_radiobutton.js:13-15,70 | radiobutton.ts:11-13,77 | 同等(実装場所が違う) | |
| name衝突の既知制約 | bind_radiobutton.js:3-7 | radiobutton.ts:15-19 | 同等(実装場所が違う) | |
| rest は外側 `.ric-radiogroup` へ | ui_radiobutton.js:26,80-84 | radiobutton.ts:36-40,86-92 | 同等 | |
| CSS完全一致 | css_templates.js:561-614 | cssTemplates.ts:590-643 | 同等 | |
| bindRadiobutton | bind_radiobutton.js 全体 | (v2 に無し) | **欠落 (表1-#1)** | |

#### uiRange

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| value/min/max/step/disabled | ui_range.js:11-18 | range.ts:12-18,30 | 同等 | |
| onwheel ロジック | ui_range.js:42-49 | range.ts:56-64 | 同等 | 式まで完全一致 |
| rest 隔離 | ui_range.js:7-10,31-53 | range.ts:6-8,41-68 | 同等 | |
| CSS完全一致 | css_templates.js:618-640 | cssTemplates.ts:645-667 | 同等 | |
| bindRange | bind_range.js | bind.ts:95-100 | 同等 | |

#### uiSelect

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| options正規化、placeholder | ui_select.js:29-37 | select.ts:36,43-44 | 同等 | |
| selected:1/0 個別付与 | ui_select.js:11-14,32-47 | select.ts:10-14,43-48 | 同等(実装場所が違う) | コアの再適用機構 (src/dom.ts:175-178) |
| appearance: base-select | ui_select.js:4-6 | select.ts:3-5 | 同等 | |
| rest スプレッド契約 | ui_select.js:50-51,52-60 | select.ts:42,51-61 | 同等 | |
| CSS完全一致 (`::picker`含む) | css_templates.js:486-559 | cssTemplates.ts:515-588 | 同等 | |
| bindSelect | bind_select.js | bind.ts:84-89 | 同等(実装場所が違う) | v2は型制約でstringify省略、実害なし |

#### uiSeparator / uiTextarea

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| `<hr class="ric-separator">` + rest | ui_separator.js:8-12 | separator.ts:20-26 | 同等 | |
| CSS完全一致 | css_templates.js:695-700 | cssTemplates.ts:718-723 | 同等 | |
| value/placeholder/rows/maxlength/disabled | ui_textarea.js:46-54 | textarea.ts:25-39,62-73 | 同等 | |
| autoResize (minRows/maxRows) | ui_textarea.js:54,29-44 | textarea.ts:18-23,43-56 | 同等 | アルゴリズム完全一致 |
| oninput合成 | ui_textarea.js:57-64 | textarea.ts:76-79 | 同等 | |
| value常時反映 / onkeydown透過 | ui_textarea.js:71,50,74 | textarea.ts:87,37,90 | 同等 | |
| CSS完全一致 | css_templates.js:411-438 | cssTemplates.ts:440-467 | 同等 | |
| bindTextarea | bind_textarea.js | bind.ts:54-63 | 同等(改善) | v1の展開順序バグ(bind_textarea.js:14-18)がv2で修正 |

#### focus_when → createFocusWhen

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| 立ち上がりエッジでのみ発火 | focus_when.js:33-38 | focusWhen.ts:69-83 | 同等 | |
| 実装方式 (WeakMap+2重rAF → app.use()+nextRender) | focus_when.js:23-48 | focusWhen.ts:1-93 | 意図的な変更・docs あり | SPEC.md:1081-1107 §10.3.2 |
| 呼び出し前提 (module定数 → app.use()必須) | focus_when.js | focusWhen.ts:29-31,49-93 | 意図的な変更・docs あり | SPEC §6 一般則 |
| **`el.disabled` ガード** | focus_when.js:45 | focusWhen.ts:55-60 (ガード無し) | 要確認 (表1-#5) | |
| ref未発見時のdev warn | (無し) | focusWhen.ts:63-66 | 意図的な変更・docs あり(改善) | SPEC.md:772 |

#### bind_* (7本) 総括

| 項目 | v1 | v2 | 判定 |
|---|---|---|---|
| bind_checkbox | bind_checkbox.js | bind.ts:69-78 | 同等 |
| bind_input | bind_input.js | bind.ts:40-45 | 同等 |
| bind_range | bind_range.js | bind.ts:95-100 | 同等 |
| bind_select | bind_select.js | bind.ts:84-89 | 同等(実装場所が違う) |
| bind_textarea | bind_textarea.js | bind.ts:54-63 | 同等(改善) |
| bind_color | bind_color.js | (無し) | **欠落 (表1-#1)** |
| bind_radiobutton | bind_radiobutton.js | (無し) | **欠落 (表1-#1)** |

#### ui_col / ui_row / ui_grid

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| gap prop | (ui_col.js コメントのみ、実装は無し) | col.ts:10-13,23-24 | 同等 (→§3 既対応) | alpha.2 で復活 |
| style引数 / rest透過 | ui_col.js:8,9-17 | col.ts:14,16,23-33 | 同等 | |
| CSS完全一致 | css_templates.js:84-97 | cssTemplates.ts:762-775 | 同等 | |
| 色・背景を持たない方針 | ui_col.js:5 | col.ts:6 | 同等 | |
| columns/rows展開・省略記法 | ui_grid.js:24-33 | grid.ts:30-35 | 同等 | |
| gap: number→px化 | ui_grid.js:60 | grid.ts:45 | 同等 | |
| style がstring/配列の分岐 (v1のみ) | ui_grid.js:35-45,54-64 | (object限定のため分岐なし) | 意図的な変更・docs あり | grid.ts:12-15、v2 StyleValue型 (src/types.ts:19) |
| CSS完全一致 | css_templates.js:99-103 | cssTemplates.ts:777-781 | 同等 | |

#### ui_panel / create_ui_panel

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| layout ('col'/'row') | ui_panel.js:13,17 | panel.ts:22,26,38 | 同等 | |
| disabled→inert | ui_panel.js:15,26,49 | panel.ts:27,46 | 同等 | |
| disabled見た目 (opacity 0.45) | ui_panel.js:27,33 (JS計算) | cssTemplates.ts:805-807 (CSS化) | 同等(実装場所が違う) | SPEC.md:907 |
| theme/density/font_size のper-instance上書き | ui_panel.js:15,23,31 | (UiPanelPropsに無し) | 意図的な変更・docs あり | DESIGN.ja.md:154 |
| **create_ui_panel (状態を持つファクトリ)** | ui_panel.js:54-95 | (対応物なし) | 意図的な変更・docs なし (表1-#11) | panel.ts:12-13 のコード内コメントのみ |
| rest スプレッド契約 | ui_panel.js:38-51 | panel.ts:37-49 | 同等 | |
| CSS完全一致 | css_templates.js:231-249 | cssTemplates.ts:786-804 | 同等 | |

#### ui_text / ui_code_pre / ui_md_pre

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| variant: default/muted/title/label | ui_text.js:14,18-19 | text.ts:15,17,32 | 同等 | |
| rest透過 / CSS完全一致 | ui_text.js:16-17,24-30 / css_templates.js:704-723 | text.ts:19-24,31-42 / cssTemplates.ts:725-744 | 同等 | |
| obj→JSON.stringify+lang強制 | ui_code_pre.js:52,60-61 | codePre.ts:50,52-53 | 同等 | |
| hljs検出・初回1回warn | ui_code_pre.js:35-50 | codePre.ts:32-44 | 同等(実装場所が違う) | warn共有先が hljs.ts へ移動 |
| max_height→maxHeight | ui_code_pre.js:56,71-76 | codePre.ts:25,58-59 | 同等 | |
| styleマージ規則 (文字列稀ケース) | ui_code_pre.js:74-76 | codePre.ts:58-59 (常にobject) | 意図的な変更・docs あり | StyleValue object限定の帰結 |
| CSS完全一致 | css_templates.js:1177-1201 | cssTemplates.ts:901-925 | 同等 | |
| **hljs未読込warnのconsoleガード** | _factory_helpers.js:61-63 | hljs.ts:23-30 (ガード無し) | 要確認 (表1-#7) | |
| 見出し/太字/斜体/インラインコード | ui_md_pre.js:136-168,237-249 | mdPre.ts:108-145,210-218 | 同等 | |
| コードブロック(```/~~~)、リスト、引用、テーブル | ui_md_pre.js:181-346 | mdPre.ts:148-308 | 同等 | |
| transform_text/transform_image_src | ui_md_pre.js:35-102 | mdPre.ts:28-87 | 同等 | |
| 危険href判定 | ui_md_pre.js:104-124 | mdPre.ts:93-105 | 同等 | |
| 画像記法・無限ループ防止 | ui_md_pre.js:145-149,375-383 | mdPre.ts:121-125,334-338 | 同等 | |
| CSS完全一致 | css_templates.js:1085-1175 | cssTemplates.ts:809-899 | 同等 | |

#### 補助ヘルパー

| 項目 | v1 (file:line) | v2 (file:line/class) | 判定 | 備考 |
|---|---|---|---|---|
| warn_hljs_missing | _factory_helpers.js:59-69 | internal/hljs.ts:22-30 | 同等(実装場所が違う) | |
| **safe_notify** | _factory_helpers.js:27-43 | (担当範囲内で不要化) | 意図的な変更・docs なし (表1-#18、#11と同根) | create_ui_panel廃止の帰結 |
| style_to_css_string | style_utils.js 全体 | (StyleValueがobject限定のため不要) | 意図的な変更・docs あり | |
| **watch_outside_click (公開ヘルパー)** | dom_helpers.js:32-36、`ric_ui/index.js:78,147`でexport | (`src/ui/index.ts`に export無し) | **欠落 (表1-#10)** | v2はpopup/dropdown内部にのみ同種実装、公開版なし |

---

### 2.2 監査 B: popup / composite 系

対象 v1: `ric_ui/popup/*.js`, `ric_ui/composite/*.js`, `ric_ui/css_templates.js` 該当部分 / v2: `src/ui/{dialog,popup,dropdown,toast,tooltip,accordion,collapseBox,scrollPane,splitter,inlineMenu,tabs,tweakPanel}.ts`, `src/ui/internal/{popupPosition,exclusiveRegistry,component,pureHelpers}.ts`

#### create_ui_dialog → createDialog

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| trigger_ctx・title・ctx/children・actions・trigger_variant | popup/create_ui_dialog.js:104-109 | dialog.ts:37-49,286 | 同等 | 名称のみcamelCase化 |
| open/onClose (controlled) + reason 4種 | popup/create_ui_dialog.js:39-44,87-95 | dialog.ts:35,47,244-252 | 同等 | |
| width (number→px / min(…,90vw)) | popup/create_ui_dialog.js:24-27,165-171 | dialog.ts:48,371 | 同等 | |
| open()/close()/is_open() | popup/create_ui_dialog.js:225-240 | dialog.ts:70-75,403-413 | 同等 | v2は`returnFocus`追加(新機能) |
| overlay/dialog本体 inline style→CSS化 | popup/create_ui_dialog.js:148-171 | cssTemplates.ts:184-215 (`.ric-dialog__overlay`他) | 同等(実装場所が違う、→§3既対応) | z-index復元はalpha.9 |
| ESC bind/unbind | popup/create_ui_dialog.js:97-100,132-142 | dialog.ts:254-280,313-322 | 同等 | v2はフォーカストラップ統合(a11y新規) |
| 排他制御 | (両者とも対象外) | (同左) | 同等 | |
| onclick overlay→reason'overlay' | popup/create_ui_dialog.js:152-154 | dialog.ts:359 | 同等 | |
| onanimationend後片付け | popup/create_ui_dialog.js:63-68,172 | dialog.ts:227-235,372-375 | 同等 | v2は700msフォールバック追加(新規頑健化) |
| data-ric-role系 | popup/create_ui_dialog.js:150,158,174-182 | dialog.ts:358,369,380-387 | 同等 | |
| role/aria-modal/focus trap/inert背景/フォーカス復帰 | (v1に無し) | dialog.ts全体 | 意図的な変更・docs あり | SPEC §10.3, §10.3.1/1c |
| **trigger_variant** | popup/create_ui_dialog.js:107,204 | dialog.ts: 該当なし(:328-347) | **要確認 (表1-#4)** | |

#### create_ui_popup → createPopup + createDropdown (分割)

分割自体は `docs/V1_VS_V2.ja.md:50` に明記。

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| label/chevron/icon/ghostモード | popup/create_ui_popup.js:157-160,198-217 | dropdown.ts:39-55,159-177 | 同等(実装場所が違う) | createDropdownへ移設 |
| menu項目 (role=menuitem自動付与) | (v1は素のctx配列) | popup.ts:97-129 | 意図的な変更・docs あり | a11y新規 |
| open_at(point) | popup/create_ui_popup.js:293-351 | popup.ts:79,395-428 | 同等 | |
| 実測2段階パイプライン | popup/create_ui_popup.js:41-49,235-263 | popup.ts:277-287,330-349 | 同等 | |
| position:fixed/zIndex:401→CSS化 | popup/_popup_utils.js:35-44 | cssTemplates.ts:256,259-260 | 同等(実装場所が違う、→§3既対応) | alpha.9 |
| minWidth (labelモードのみ) | popup/create_ui_popup.js:117-122 | dropdown.ts:152-157 | 同等(実装場所が違う) | |
| **_get_portal_cb (containing block探索)** | popup/_popup_utils.js:51-67 | (無し。viewport基準に簡略化) | 意図的な変更・docs あり(ソースのみ) (表1-#14) | popupPosition.ts:1-16。SPEC/V1_VS_V2に記載なし |
| **_get_expand_ref (展開方向判定)** | popup/_popup_utils.js:73-83 | (無し。computeAnchoredLeft/clampLeftに置換) | 意図的な変更・docs あり(ソースのみ) (表1-#14) | popupPosition.ts:59-81。SPEC §10.3の水平配置ルールで実質ドキュメント化されているとみなせる |
| 排他制御 | popup/_popup_utils.js:85-96 (無制限成長) | internal/exclusiveRegistry.ts (WeakMap管理) | 同等(設計改善) | |
| ESC bind/unbind | popup/create_ui_popup.js:105-109,162-172 | popup.ts:195-228 | 同等 | v2は矢印キー/Home/End追加(a11y新規) |
| 外側クリックで閉じる | popup/create_ui_popup.js:174-181 (overlay吸収) | popup.ts:230-258 (light dismiss) | 意図的な変更・docs あり | SPEC §10.3.1e、alpha.12 |
| trigger見た目 | popup/create_ui_popup.js:198-217, css_templates.js:732-757 | popup.ts (PopupTriggerObject) / dropdown.ts | 同等 | SPEC §10.3.1a |
| **`.ric-popup__trigger--label { width:100%; }`** | css_templates.js:742-746 | `.ric-dropdown__trigger--label { width: auto; }` (cssTemplates.ts:1114-1118) | **意図的な変更・docs なし (表1-#9)** | 既知パターン該当 (CSS移植時の値取りこぼし) |
| `.ric-popup__body .ric-button` align-items | css_templates.js:772-777 | cssTemplates.ts:278-289 | 同等 (→§3既対応) | CHANGELOG.md:997-1001 |
| theme/density/font_sizeのポータル単位上書き | popup/_wrap_portal.js 全体 | (無し) | 意図的な変更・docs あり | DESIGN.ja.md:154 |

#### create_ui_toast → createToast

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| show(msg,{type,duration}) | popup/create_ui_toast.js:86-93 | toast.ts:19-23,96-102 | 同等 | |
| container/item inline style→CSS化 | popup/create_ui_toast.js:48-66 | cssTemplates.ts:296-303,312 | 同等(実装場所が違う) | z-index 600 維持 |
| onanimationend | popup/create_ui_toast.js:67 | toast.ts:81 | 同等 | v2は700msフォールバック追加 |
| type別クラス・border-left色 | popup/create_ui_toast.js:63, css_templates.js:881-884 | toast.ts:77, cssTemplates.ts:315-318 | 同等 | |
| **role="status"/"alert"+aria-live** | (v1に無し、全文grep確認済み) | toast.ts:78-79 | 意図的な変更・docs あり (**要確認・低優先**、表1-#8: ヘッダコメントの事実誤認) | toast.ts:1-6のコメントが「v1から継承」と誤記 |
| duration:0=自動消去なし | popup/create_ui_toast.js:90 | toast.ts:97,101 | 同等 | |

#### create_ui_tooltip → createTooltip

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| dir判定、数値 (POP_H=34/POP_W=120/GAP=8) | popup/create_ui_tooltip.js:9-10,46-50 | tooltip.ts:18,50-59 | 同等 | |
| position:fixed/zIndex:401/max-width→CSS化 | popup/_popup_utils.js:35-44, css_templates.js:790 | cssTemplates.ts:335-346 | 同等(実装場所が違う) | |
| onmouseenter/onmouseleave | popup/create_ui_tooltip.js:39-61 | tooltip.ts:96-102 | 同等 | v2はonfocus/onblur/Escape追加 |
| aria-describedby | (v1に無し) | tooltip.ts:95,112 | 意図的な変更・docs あり | |
| pointer-events:none | css_templates.js:790 | cssTemplates.ts:343 | 同等 | |

#### 内部基盤 (_popup_utils.js / _wrap_portal.js / _page_portal_queue.js)

| 項目 | v1 (file:line) | v2 (file:line/module) | 判定 | 備考 |
|---|---|---|---|---|
| below/above判定 | _popup_utils.js:11-29 | popupPosition.ts:41-50 | 同等 | |
| _pos_style→posToStyle | _popup_utils.js:35-44 | popupPosition.ts:27-35 | 同等(実装場所が違う) | |
| 排他登録 (無制限成長→WeakMap) | _popup_utils.js:88-96 | exclusiveRegistry.ts | 同等(設計改善) | |
| ポータル未drain検知watchdog | _page_portal_queue.js:34-55 | (構造的に不要) | 同等(構造的に解消) | app.ts:248-254、pull方式drain |
| apply_theme_to_portal | _wrap_portal.js 全体 | (無し) | 意図的な変更・docs あり | DESIGN.ja.md:154 |

#### create_ui_accordion → createAccordion

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| items/default_open/排他モード | composite/create_ui_accordion.js:32-68 | accordion.ts:60-90,112-184 | 同等 | |
| grid-template-rows アニメーション、chevron | css_templates.js:924-933, composite/create_ui_accordion.js:29,54-55 | cssTemplates.ts:1031-1043, accordion.ts:57-58,161 | 同等(実装場所が違う) | |
| controlledモード | (v1は常にuncontrolled) | accordion.ts:76-83,116-154 | 同等 (→§3既対応) | alpha.7 |
| aria-expanded等/header=`<button>` | (一部v1に無し) | accordion.ts:132,136-137,169-178 | 意図的な変更・docs あり | SPEC §10.3.3表 |

#### create_ui_collapse_box → createCollapseBox

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| direction/duration/easing、key管理(Map/GC) | composite/create_ui_collapse_box.js:49-74,95-158 | collapseBox.ts:38-44,74-124,170-174 | 同等 | |
| 2段階クロージング、ontransitionend | composite/create_ui_collapse_box.js:110-187 | collapseBox.ts:117-196 | 同等 | v2は700msフォールバック追加 |
| is_animating(key)、data-ric-visible | composite/create_ui_collapse_box.js:199-212 | collapseBox.ts:57,218,231-234 | 同等 | |
| aria-expanded用id | (v1に無し) | collapseBox.ts:51,59,95,212 | 意図的な変更・docs あり | SPEC §10.3.3表 |

#### create_ui_scroll_pane → createScrollPane

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| follow/threshold、_should_follow判定式 | composite/create_ui_scroll_pane.js:34-57 | scrollPane.ts:26-33,54-56,73-77 | 同等 | |
| rAFのみ→rAF+200msバックストップ | composite/create_ui_scroll_pane.js:82-84 | scrollPane.ts:62-69,93-112 | 意図的な変更・docs あり (改善) | LCP #5報告対応 |
| scroll_to_bottom/top、data-ric-sp改名 | composite/create_ui_scroll_pane.js:94,104-105 | scrollPane.ts:43-44,132,156-163 | 同等 | |
| rest spread (class結合) | composite/create_ui_scroll_pane.js:86-93 (string限定) | scrollPane.ts:130 (mergeClass共通) | 同等(改善) | |

#### create_ui_splitter → createSplitter

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| side/size/min/max/collapsible/on_resize_end | composite/create_ui_splitter.js:46-53 | splitter.ts:32-45,80-81 | 同等 | |
| `{ctx}`ラッパー廃止 | composite/create_ui_splitter.js:141-142 | splitter.ts:47-56 | 意図的な変更・docs あり | splitter.ts:12-15 |
| ドラッグ処理、on_resize_end契約 | composite/create_ui_splitter.js:71-112,107 | splitter.ts:118-154,150 | 同等 | |
| collapsed/on_collapse_change、公開API | composite/create_ui_splitter.js:117-119,142-153,235-244 | splitter.ts:53-55,106-109,178-185,60-67,266-274 | 同等 | |
| 矢印キーリサイズ、a11y属性一式 | (v1に無し) | splitter.ts:156-171,209-220,235 | 意図的な変更・docs あり | SPEC §10.3.3表 |

#### ui_inline_menu → uiInlineMenu

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| open/anchor/ctx/style/class、anchor→styleマップ | composite/ui_inline_menu.js:36-41,109-116 | inlineMenu.ts:40-49,52-57,115 | 同等 | |
| position:absolute,zIndex:10 (両者inline) | composite/ui_inline_menu.js:123-128 | inlineMenu.ts:123-128 | 同等 | |
| onclick stopPropagation | composite/ui_inline_menu.js:137 | inlineMenu.ts:138 | 同等 | |
| position未指定dev warning | composite/ui_inline_menu.js:44-87 | inlineMenu.ts:59-109 | 同等 | v2はdev/prod切替追加 |
| 外クリックで閉じない(意図的、両者一致) | composite/ui_inline_menu.js:15-20 | inlineMenu.ts:14-17 | 同等 | |
| role="menu"、onClose(Escape) | (v1に無し) | inlineMenu.ts:23-27,134,139-146 | 意図的な変更・docs あり | |

#### ui_tabs + bind_tabs → createTabs

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| items/active/onchange/variant | composite/ui_tabs.js:31-36 | tabs.ts:31-48,78-82 | 同等 | |
| active未指定/範囲外→先頭fallback | composite/ui_tabs.js:38-40 | tabs.ts:97-102 | 同等 | |
| 同キークリックはonchange発火しない | composite/ui_tabs.js:52 | tabs.ts:163-165 | 同等 | |
| **ステートレス純粋関数+bind_tabs** | composite/ui_tabs.js:1-7, bind_tabs.js全体 | tabs.ts (controlled/uncontrolled内包) | 意図的な変更・docs あり (**要確認: 表1-#17**、bind_tabs廃止の明示なし) | tabs.ts:6-11、SPEC §10.3.3表 |
| role/aria-selected/roving tabindex/矢印キー | (v1に無し) | tabs.ts:121-144,151-169,173-184 | 意図的な変更・docs あり | SPEC §10.3.3表 |
| パネル無しモード | (v1は常にpanel描画) | tabs.ts:87,173-184 | 同等 (→§3既対応) | alpha.2 |
| variant: line/pill | composite/ui_tabs.js:35,68 | tabs.ts:37,188 | 同等 | |

#### ui_tweak → createTweakPanel

| 項目 | v1 (file:line) | v2 (file:line) | 判定 | 備考 |
|---|---|---|---|---|
| infer_type、各行type別実装 | composite/ui_tweak.js:47-64,69-232 | tweakPanel.ts:69-88,203-374 | 同等 | number行フォーカス中抑止はコア(`shouldSkipValueReapply`)へ移行 |
| radiobutton name既知制約 | composite/ui_tweak.js:189-190 | tweakPanel.ts:299-302 | 同等 | |
| **ui_tweak_folder: `<details>`→独自hidden** | composite/ui_tweak.js:237-247 | tweakPanel.ts:398-434 | 意図的な変更・docs あり (**要確認: 表1-#15**、ページ内検索の自動展開喪失リスク) | tweakPanel.ts:12-17、SPEC §10.3.3表 |
| 2 factory分離→1本化 | composite/ui_tweak.js:262,310,331-337,344-361 | tweakPanel.ts (data+keys+rowsに統合) | 意図的な変更・docs あり | tweakPanel.ts:6-11 |
| keys[k].get/set、keys[k].rows、data-ricdom-tweak-key | (v1に無し) | tweakPanel.ts:123-143,190-193,396,436-488 | 意図的な変更・docs あり (新機能) | SPEC §10.6 |

#### css_templates.js 横断チェック

| 項目 | v1 | v2 | 判定 | 備考 |
|---|---|---|---|---|
| z-index序列 (toast600>dialog501>popup/dropdown/tooltip401) | 各所 | cssTemplates.ts:184-194 (集約コメント化) | 同等 | |
| `.ric-popup__body`等のスコープprefix省略 | css_templates.js:759 | (`.ric-page`概念自体が無いため不要) | 同等(構造的に解消) | V1_VS_V2.ja.md:48 |
| `.ric-dropdown__body` position:fixed一時欠落 | (v1に対応物なし) | cssTemplates.ts:1127-1142 (alpha.3で修正) | 同等 (→§3既対応) | v2内部バグの自己修正 |
| ric-tweak-folder CSS (details→button構造) | css_templates.js:194-227 | cssTemplates.ts:1244-1273 | 同等(実装場所が違う) | |

---

### 2.3 監査 C: テーマ / コア / export / トークン / パレット

対象: `ric_ui/context.js`, `ric_ui/css_registry.js`, `ric_ui/layout/ui_page.js`, `ric_ui/index.js`, `ric_ui/css_templates.js`, `src/ricdom.js` / v2: `src/ui/theme.ts`, `src/ui/cssTemplates.ts`, `src/ui/index.ts`, `src/{app,dom,normalize,reactivity,scheduler,types,index}.ts`

#### make_css_vars → applyTheme

| # | 項目 | v1 | v2 | 判定 |
|---|---|---|---|---|
| 1 | 関数シグネチャ (cssText文字列 → el.style直書き) | `make_css_vars({theme,density,font_size})` (context.js:213) | `applyTheme(el,{theme,density,fontSize})` (theme.ts:222) | 同等(実装場所が違う) |
| 2 | theme名前解決 | `_resolve_color_vars` (context.js:181) | `resolveColorVars` (theme.ts:169) | 同等 |
| 3 | density名前解決 | `_resolve_size_vars` (context.js:190) | `resolveSizeVars` (theme.ts:175) | 同等 |
| 4 | font_size名前解決 | `_resolve_font_vars` (context.js:197) | `resolveFontVars` (theme.ts:181) | 同等 |
| 5 | 無効名前フォールバック | 無警告 (context.js:183-201) | dev warn追加 (theme.ts:158-167) | 同等 (→§3既対応、alpha.7) |
| 6-9 | fg-muted/border/scrollbar/gap-md/duration/easing自動導出 | context.js:220-240 | theme.ts:197-203 | 同等 (値・式一致) |
| 10 | 適用先 (page style連結 → el.style直接+data属性) | (呼び出し元が連結) | theme.ts:222-234 | 意図的な変更・docs あり (SPEC §8) |
| 11 | `:root`不使用 (複数テーマ島共存) | context.jsコメント | theme.ts:207-220、`data-ricdom-theme`が目印 | 同等 |

#### create_theme / create_density / create_font_size

| # | 項目 | v1 (context.js) | v2 (theme.ts) | 判定 |
|---|---|---|---|---|
| 12 | create_theme(base,overrides) | :258-260 | createTheme :241-244 | 同等 |
| 13 | create_density(base,overrides) | :273-275 | createDensity :259-262 | 同等 (→§3既対応、alpha.10) |
| 14 | create_font_size(base,overrides) | :288-290 | createFontSize :271-274 | 同等 (→§3既対応、alpha.10) |

#### export_theme / export_settings

| # | 項目 | v1 | v2 | 判定 |
|---|---|---|---|---|
| 15 | export_theme(page_el) | context.js:329-339 (手動cssText parse) | exportTheme(el) (theme.ts:291-304、CSSStyleDeclaration API) | 同等(実装場所が違う) |
| 16 | **export_settings(page_el): theme/density/font_sizeを3グループで一括保存/復元** | context.js:355-368、`ric_ui/index.js:93`で公開export | **該当なし** (grep: `export_settings`/`exportSettings` → src/ 0件) | **欠落 (表1-#2)**。theme.ts:9-12に「最小移植スコープに含めない」というソースコメントのみ、SPEC.md/V1_VS_V2.ja.mdには記載なし。density/fontSizeを読み戻す公開APIがv2に存在しない |

#### css_for → CSS配布モデル

| # | 項目 | v1 | v2 | 判定 |
|---|---|---|---|---|
| 17 | css_for(...names)、使用クラスのみ取り出し | css_registry.js:95-112、公開export | 廃止。1枚の`ricdom-ui.css`をbuildStylesheet/injectStylesで配布 (`src/ui/index.ts:11-12`) | 意図的な変更・docs あり (V1_VS_V2.ja.md「CSS配布」行) |
| 18 | 未知クラス名warn | css_registry.js:108 | (css_for廃止のため無意味) | 意図的な変更・docs あり |
| 19 | collect_classesによるツリー走査 | css_registry.js:21-46 | (全部入りCSSのため不要) | 意図的な変更・docs あり |
| 20 | portal未drain検知warn (css_for島の注意) | ui_page.js:19-24 | renderPortal()がpull方式で毎render収集、構造的に発生しない | 意図的な変更・docs あり (SPEC §7) |

#### ric_ui/layout/ui_page.js (create_ui_page) の役割分解

| # | v1 create_ui_pageの責務 | v2の対応 | 判定 |
|---|---|---|---|
| 21 | CSS variablesを`.ric-page`のstyleに注入 | applyTheme(el,opts) (theme.ts:222) | 同等(実装場所が違う) |
| 22 | ポータルキューをctx末尾にdrain | app単位のportalホスト、renderPortal()をpull (SPEC §7) | 意図的な変更・docs あり (V1_VS_V2.ja.md「portal」行) |
| 23 | 使用クラス収集→必要なCSSだけ`<style>`先頭注入 | 1枚のricdom-ui.cssを先読み | 意図的な変更・docs あり |
| 24-25 | `.ric-page`のbg/fg/font-size塗り | `:where([data-ricdom-theme])`ルール (cssTemplates.ts:403-408) | 同等 (→§3既対応、alpha.3/alpha.6) |
| 26-28 | `.ric-page`のpadding/overflow:hidden/box-sizing塗り | 塗らない | 意図的な変更・docs あり (V1_VS_V2.ja.md「page部品」行+補償CSS例) |
| 29 | ページ全体スクロールバー既定 | `:where([data-ricdom-theme])`スコープ | 同等 (→§3既対応、alpha.8) |
| 30 | state配置ミスのsilent failure検知 (console.warn) | use()未登録を検知しconsole.error+NOOP (SPEC §6) | 意図的な変更・docs あり |
| 31 | **`ric-theme-change` windowイベントで外部コンポーネント同期** | ui_page.js:107-115 | **該当なし** (grep: `ric-theme-change`/`themechange`→0件) | **要確認 (表1-#12)**。v1でも公開APIではなく内部専用機構。実害はv1 consumers側の裏取りが必要 |

#### コア (src/ricdom.js → src/{app,dom,normalize,reactivity,scheduler,types}.ts)

| # | 項目 | v1 (src/ricdom.js) | v2 | 判定 |
|---|---|---|---|---|
| 32 | create_RicDOM(target,state)の引数・戻り値 | :907-953 | createApp(target,state,render,options?) — renderが分離した第3引数 (SPEC §5) | 意図的な変更・docs あり |
| 33 | 生成時に同期初回描画 | :1180-1219 | SPEC §5「Target resolution」に同一FACT | 同等 |
| 34 | target未解決時のポーリング (0.5秒×40=20秒) | :1188-1216 | DOMContentLoadedを1回待つのみ、それでも無理なら即エラー+NOOP (SPEC §5) | 意図的な変更・docs あり |
| 35 | 複数インスタンスのstate共有 (WeakMap) | :872-873,983-1098 | 該当なし (同じオブジェクトを明示的に渡す設計) | 意図的な変更・docs あり |
| 36 | Proxy深さ・`__notify`暗黙注入 | :995-1054 | 同じ浅いProxy構造だが`__notify`廃止、`app.use()`+`Host.notify()`に置換 (SPEC §3,§6) | 意図的な変更・docs あり |
| 37 | `ignore`キー | :1048,1075,1089 | SPEC §3で同一契約 | 同等 |
| 38 | render_now()/next_render() | :1253-1269 | renderNow()/nextRender() (SPEC §4) | 同等(実装場所が違う、camelCase化のみ) |
| 39 | rAF+200msバックストップの二重化 | :824-864 | SPEC §4に同一設計 | 同等 |
| 40 | FORCE_REAPPLY_DOM_KEYS (5キー) | :232-235 | SPEC §2.4で同一5キー | 同等 |
| 41 | 編集中ガード (v1は部品側個別実装のみ) | 部品側のみ | コアの規則に昇格 (`document.activeElement`判定、SPEC §2.4) | 意図的な変更・docs あり (v1になかった一般化) |
| 42 | selectのvalue/option順序 | :339-352 | SPEC §2.6に同一FACT | 同等 |
| 43 | styleの受け付け形 (string/object/array) | :42-68 | **object限定** (SPEC §1) | 意図的な変更・docs あり (SPEC §1、V1_VS_V2.ja.md「style」行) |
| 44 | **classの受け付け形 (string/array → +Record<string,boolean>)** | :100-108 | string/array/Record<string,boolean> (SPEC §1、上位互換の追加) | **意図的な変更・docs なし (表1-#13)**。SPEC §1の型表には載っているが、V1_VS_V2.ja.mdに「style」行はあっても「class」行が無い |
| 45 | data-ric-role/data-ric-ref/ref | :322-327,414-425 (refのみ、role自体はコアに無し) | data-ricdom-ref、data-ricdom-roleはUI_ROLE列挙で一元管理 (V1_VS_V2.ja.md「安定セレクタ」行、SPEC §11) | 同等 (改名のみ、docsあり) |
| 46 | keyの重複時挙動 | :618-684 (無警告) | 同一アルゴリズム+dev build警告 (SPEC §2.2) | 同等 (→§3既対応、alpha.4) |
| 47 | ctx省略=島(暗黙) | (islandという概念自体が無い) | `island: true`明示フラグ (SPEC §2.5) | 意図的な変更・docs あり |
| 48 | `{}`ノードの扱い | is_invisible_valueで不可視判定 (:76-81) | `tag`必須の型エラー、実行時はconsole.error+不可視 (SPEC §1) | 意図的な変更・docs あり |
| 49 | boolean属性/プロパティ振り分け | DOM_PROPERTY_KEYS固定集合 (:216-296) | 同一集合・同一ロジック (dom.ts:105-116、SPEC §2.1) | 同等 |
| 50 | SVG名前空間継承 | :175,310-317 | SPEC §2.7に同一FACT | 同等 |
| 51 | **イベントハンドラのnull/undefined扱い** | function→代入、null→明示的null代入、undefinedは無視 (:275-281,472-478,500-505) | `on*`はDOM propertyとして代入(SPEC §2.1)、null/undefinedの個別挙動差はSPEC本文に明記なし | **要確認 (表1-#16)**。dom.ts実装レベルの追加確認が必要 |
| 52 | エラー時NOOP_PROXY (throwしない方針) | :18-23 | createNoopApp / NOOP app (SPEC §5) | 同等(実装場所が違う、型付きNOOPへ強化) |
| 53 | portal (page経由drain→page不要) | ui_page.js `_portal.drain()` | app自体がportal elementを自動生成 (portalToで上書き可、SPEC §7) | 意図的な変更・docs あり |
| 54 | `__notify`の公開/私的プロパティ | 非enumerableで暗黙注入 (:995-1002) | 廃止、Host.notify()はuse()経由のみ (SPEC §6) | 意図的な変更・docs あり |
| 55 | shared_proxy/instance_handleの二重Proxy構造 | :1281-1308 | 複数インスタンスstate共有が無い設計のため不要 (#35と同根) | 意図的な変更・docs あり |

#### 公開export突合表: コア (v1 src/ricdom.js → v2 src/index.ts)

| v1 export | v2対応 | 判定 |
|---|---|---|
| create_RicDOM | createApp | 改名 (意図的、docsあり) |
| NOOP_PROXY | createNoopApp (+NOOP appとして機能内在) | 同等(実装場所が違う) |
| **version** | version相当 (要確認、src/index.tsに無ければpackage.json参照) | **要確認 (表1-#3)** |
| window.create_RicDOM / window.NOOP_PROXY | `globalThis.ricdom=ricdom` (IIFE footer、alpha.10) | 同等(改名込み) |
| (非公開)`convert_style_key_to_camel`等の`__test_exports` | build系関数を「非安定API」として公開 (API_AUDIT.ja.md §1.1) | 意図的な変更・docs あり |

#### 公開export突合表: RicUI (v1 ric_ui/index.js 全34項目 → v2 src/ui/index.ts)

| v1 export | v2対応 | 判定 |
|---|---|---|
| **version** | (ricdom/ui独自のversion exportがindex.tsに見当たらず) | **要確認 (表1-#3)** |
| create_theme/create_density/create_font_size | createTheme/createDensity/createFontSize | 同等 (density/font_sizeは→§3既対応、alpha.10) |
| export_theme | exportTheme | 同等 |
| **export_settings** | **該当なし** | **欠落 (表1-#2)** |
| make_css_vars | (applyThemeに統合、文字列を返す単体版は無し) | 意図的な変更・docs あり |
| create_ui_page | 廃止 | 意図的な変更・docs あり |
| ui_col/ui_row/ui_grid | uiCol/uiRow/uiGrid | 同等 |
| css_for | 廃止 (buildStylesheet/injectStylesに置換) | 意図的な変更・docs あり |
| ui_panel | uiPanel | 同等 |
| **create_ui_panel** | **該当なし** (uiPanelのみ) | 意図的な変更・docs なし (表1-#11) |
| ui_button/ui_input/ui_textarea/ui_checkbox/ui_radiobutton/ui_range/ui_color/ui_separator/ui_icon/ui_select/ui_text/ui_code_pre/ui_md_pre | 各camelCase版 | 同等 |
| bind_input/bind_textarea/bind_checkbox/bind_range/bind_select | bindInput/bindTextarea/bindCheckbox/bindRange/bindSelect | 同等 |
| **bind_radiobutton** | **該当なし** (bind.ts実装自体に無し、grep確認済み) | **欠落 (表1-#1)** — exportし忘れではなく実装自体が無い |
| **bind_color** | **該当なし** (同上) | **欠落 (表1-#1)** |
| focus_when | createFocusWhen (状態を持つ部品化) | 意図的な変更・docs あり |
| create_ui_popup | createPopup(menu専用)+createDropdown(新設) | 意図的な変更・docs あり |
| create_ui_tooltip/create_ui_dialog/create_ui_toast/create_ui_accordion/create_ui_splitter/create_ui_scroll_pane/create_ui_collapse_box | 各camelCase版 | 同等 |
| ui_tabs (純関数) | createTabs (状態を持つ部品に変更) | 意図的な変更・docs あり |
| **bind_tabs** | **該当なし** (createTabsがcontrolled/uncontrolled内包のため不要) | 意図的な変更・docs あり (**要確認: 表1-#17**、明示的な廃止宣言はなく読み取り推測) |
| ui_inline_menu | uiInlineMenu | 同等 |
| create_ui_tweak_panel | createTweakPanel | 同等 |
| ui_tweak_panel/ui_tweak_folder/ui_tweak_row | 該当なし (createTweakPanel 1本化) | 意図的な変更・docs あり |
| tweak_infer_type | inferTweakType | 同等 |
| **watch_outside_click** | **該当なし** (grep: `watchOutsideClick`→inlineMenu.tsのコメント1件のみ、実装なし) | **欠落 (表1-#10)** |

#### `--ric-*` トークン突合表

全24トークン (`--ric-color-fg`, `-fg-muted`, `-bg`, `-control`, `-border`, `-accent`, `-accent-fg`, `--ric-radius`, `--ric-gap`, `--ric-gap-md`, `--ric-pad-x`, `--ric-pad-y`, `--ric-control-h`, `--ric-duration`, `--ric-easing`, `--ric-shadow`, `--ric-tooltip-bg/-fg`, `--ric-code-bg/-fg`, `--ric-popup-bg`, `--ric-popup-blur`, `--ric-panel-shadow`, `--ric-font-size`, `--ric-scrollbar-thumb(-hover)`, `color-scheme`) について、v1 (`ric_ui/context.js`+`css_templates.js`) と v2 (`theme.ts`+`cssTemplates.ts`) を突合。

**結論: トークン名の変更・消滅は無し。全24トークンが名前・既定値とも完全一致** (bezier文字列・radial-gradient多重定義含む)。`--ric-radius`がテーマ専用でdensityに含まれない設計も両者一致。

#### テーマパレット突合 (5テーマ × 主要変数)

`COLOR_VARS_LIGHT/DARK/TEAL/CYBER/AQUA` (v1 context.js) と同名定数 (v2 theme.ts) を全キー・全値で逐語比較。

**結論: light/dark/teal/cyber/aqua の全5テーマ、全キー、値が1文字違わず完全一致** (グラデーション文字列、aquaの独自easing bezier文字列、cyberのradial-gradient多重定義まで含めて差分ゼロ)。

---

## 3. 既に alpha.1〜13 で対応済み (再発なし)

以下は本監査でも「同等」の裏取りは行ったが、実体は過去のパイロット報告で既に修正済みの既知パターンであり、新規の指摘ではない。

- uiButton の `variant: link` 復活・CSS `--link` 復活 — alpha.8 (button.ts, cssTemplates.ts:120-139)
- uiButton `style` props の型復活 — alpha.9
- `ui_col`/`ui_row` の `gap` prop 復活 — alpha.2 (col.ts:10-13,23-24)
- `createDensity`/`createFontSize` の復活 (Potopeta 第9号報告) — alpha.10 (theme.ts:259-274、API_AUDIT.ja.md §13)
- 無効なテーマ/density/font_size名を渡した時の dev warn 追加 — alpha.7 (theme.ts:158-167)
- `.ric-page` 相当 (`:where([data-ricdom-theme])`) の bg/fg 塗り — alpha.3 (cssTemplates.ts:403-408)
- 同上、font-size 塗り追加 — alpha.6
- ページ全体スクロールバー既定スタイル — alpha.8 (cssTemplates.ts:419-438)
- 兄弟内の重複 key 検出時の dev warn 追加 (アルゴリズム自体はv1由来、v1 v0.4.5相当を継承) — alpha.4 (SPEC §2.2)
- dialog overlay(z-index 500)/本体(501)、popup/dropdown/tooltip(401)、toast(600) の z-index 復元 (LCP #1報告) — alpha.9 (cssTemplates.ts:184-215)
- `.ric-dropdown__body` の position:fixed 新設時一時欠落の自己修正 — alpha.3 (v1に対応物なし、v2内部バグ)
- `.ric-popup__body .ric-button` の align-items 欠落修正 — CHANGELOG.md:997-1001
- accordion の controlled/uncontrolled 対応 (外部開閉) — alpha.7
- tabs のパネル無しモード (children未指定itemでpanel自体を省略) — alpha.2
- popup/dropdown の外側クリックが light dismiss に変更 — alpha.12 (SPEC §10.3.1e)
- `open_at(point)` (座標指定オープン) — v1 v0.4.3 で新設、v2にそのまま継承
- `createFocusWhen` の `app.use()` 契約、dialog の `returnFocus`・初期フォーカス順 — alpha.8/alpha.9

---

## 4. 末尾

この監査で見つからなかった同型の穴 (z-index / position / 塗り / prop 消失 / variant 消失) は、alpha.2〜12 のパイロット報告で既に塞がれていた。今回新規に見つかった実質的な穴は上記表の 17 項目 (欠落 5 / 意図的・docsなし 3 / 要確認 9) に留まり、うち consumer 影響が大きいのは `bindRadiobutton`/`bindColor` の不在、`export_settings` 相当の欠如、`watch_outside_click` の消失の 3 件である。

**次回、同種の一括監査を行う条件**: 次の破壊的変更 (v3 相当) を検討するとき、または v1 に新しい正式 API が追加されたとき。
