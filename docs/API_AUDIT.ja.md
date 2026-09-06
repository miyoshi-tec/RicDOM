> 内部記録 (日本語): 公開前 API 整合レビューの監査報告。利用者向けドキュメントは README / docs/SPEC.md / docs/TUTORIAL.md を参照。

# API 整合レビュー (公開前監査)

- 対象: `ricdom` / `ricdom/ui` / `ricdom/icons` の公開 API 表面、および内部実装の整合性
- 実施日: 2026-09-02
- 前提: コア (`src/` 直下) への機能追加は禁止 (gzip ≤ 5,120B)、挙動変更は禁止 (リファクタとテスト追加のみ)。改名は「整合のための改名」に限定し、全て本書に一覧化する。

---

## 1. 公開 API 一覧

### 1.1 `ricdom` (コア、`src/index.ts`)

| 種別 | 名前 | 規約 | 判定 |
|---|---|---|---|
| 関数 | `createApp` | create+動詞 | OK |
| 関数 | `createNoopApp` | create+動詞 | OK |
| 型 | `RicNode` | PascalCase | OK |
| 型 | `RicElementNode` | PascalCase | OK |
| 型 | `App<S>` | PascalCase | OK |
| 型 | `RenderFn<S>` | PascalCase | OK |
| 型 | `UsePart` | PascalCase | OK |
| 型 | `Host` | PascalCase | OK |
| 型 | `CreateAppOptions` | PascalCase | OK |
| 型 | `ClassValue` | PascalCase | OK |
| 型 | `StyleValue` | PascalCase | OK |
| 関数 (非安定) | `buildDomNode` / `patchChildren` / `createRenderScheduler` / `createReactiveState` / `normalizeNode` / `normalizeStyle` / `normalizeClass` / `isJsonEqual` | build/create/normalize/is | OK |

`buildDomNode` 以下 8 件は `index.ts` のコメントで明示的に「安定 API ではない (semver 対象外)」と宣言されている内部モジュールの named export。命名規約上も逸脱はない (`isJsonEqual` は `is` 述語の慣用形)。

### 1.2 `ricdom/ui` (`src/ui/index.ts`)

全 export (関数 39 / 型 47) を確認。関数はすべて `create` (状態を持つ部品) または `ui`/`bind`/`apply`/`build`/`infer`/`inject` のいずれかの動詞で始まる。型は全て PascalCase、Props 型は全て `XxxProps` 命名 (例外なし)。

逸脱 1 件:
- **`inferTweakType`**: 動詞 `infer` は命名規約表 (create/ui/bind/apply/inject/build/export) に無い。ただし「値から UI コントロール種別を推論する」純粋な型推論ヘルパーであり、`create`(部品でない)/`build`(ノードを組まない)/`ui`(RicNode を返さない) のどれも実体と合わない。`infer` は TS エコシステムで意味が明確な標準的な語であるため、**改名は見送り** (無理に規約へ寄せると却って分かりにくくなる。再検討条件: 同種の「値 → 種別判定」ヘルパーが 2 個目出た時点で `infer*` を正式に規約へ追加するか検討)。

### 1.3 `ricdom/icons` (`src/icons/index.ts`)

- 型: `IconDescriptor` (PascalCase、OK)
- 関数: `svgToDescriptor` (OK)
- 定数: 同梱アイコン 36 個 (`arrowDown` 〜 `x`、camelCase — データ定数なので UPPER_SNAKE ではなく妥当。Lucide 由来のケバブ名を camelCase に変換した命名で一貫)
- 定数: `ICON_NAMES` / `ICONS_BY_NAME` (UPPER_SNAKE、OK)

### 1.4 補足: 公開 API 外 (`src/cli/`)

`ricdom-icon` CLI (`package.json` の `bin`) のロジック本体 `src/cli/ricdomIconLib.ts` は `package.json` の `exports` に含まれないため公開 API ではないが、`LUCIDE_SVG` (関数なのに UPPER_SNAKE) という命名規約からの逸脱が 1 件ある。CLI 内部実装でありテスト (`tests/cli/ricdomIcon.test.ts`) からの参照名でもあるため、**今回のスコープ外として改名を見送る** (見送り理由: 公開 API 表面のレビューが本タスクの主眼であり、CLI 内部の改名は影響範囲が別ファイル群に及ぶため独立の変更として扱うべき。再検討条件: CLI lib を公開 API 化する話が出た時点)。

---

## 2. 型の重複・不整合

### 2.1 `IconDescriptor` vs `UiIconDescriptor` — 是正済み

設計書 §16 で「一本化を Phase 3d の API 整合レビューで検討」と予告されていた件。`src/ui/icon.ts` が `ricdom/icons` (`src/icons/types.ts`) の `IconDescriptor` と構造的に同一の `UiIconDescriptor` を独自に再宣言していた。

**是正**: `src/ui/icon.ts` から `IconDescriptor` を type-only import し (`import type { IconDescriptor } from '../icons/types.js'`)、`uiIcon` の引数型・`ricdom/ui` の公開型を `IconDescriptor` に統一。`UiIconDescriptor` は廃止 (実行時依存はゼロのまま — import type なので esbuild が dead-code elimination で消す。ビルド後のバンドルサイズ・gzip は無変化を確認済み)。型テスト (`tests/ui/icon.test.ts`) で両者が同一型であることを回帰確認する。

### 2.2 Props 型の export 漏れ

`ricdom/ui` の全 39 部品について `XxxProps` 型が export されているか確認 → **漏れなし**。

### 2.3 `any` の残存

`grep -rn ': any\b|<any>|as any' src` の結果、実質 1 箇所のみ:

```ts
// src/types.ts
export interface Host {
  ...
  app: App<any>;
}
```

設計書 §13 に「`App<S>` の `S` は part 側からは未知なので `App<any>` で受ける (`UsePart`/`Component<P>` は特定の state 型に依存しない汎用部品契約であるため。ジェネリック化すると構造的部分型の分散で `attach` が合わなくなる)」と明記済みの意図的な設計判断。**排除不能と判断し、コード上のコメントも既に理由を説明済みのため変更なし**。

### 2.4 `Host` の二重 export

`ricdom` (コア) と `ricdom/ui` の両方が `Host` 型を export している。ただし `ricdom/ui` 側 (`src/ui/internal/component.ts` の `export type { Host };`) はコアの `Host` を type-only import してそのまま re-export しているだけで、別定義の重複ではない (設計書 §13「`ricdom/ui` はコアへの実行時依存ゼロ (型のみ)」の意図通り)。**問題なし、変更なし**。

---

## 3. dead code / 未使用 export / 重複ヘルパー

### 3.1 是正済み

- **`src/ui/dialog.ts`**: `inst` の props 分解に `trigger_variant` という v1 由来と思われる snake_case のキーが `DialogProps` に存在しないにもかかわらず分解され、`void trigger_variant;` で unused 警告だけ潰されていた (型注釈 `props as DialogProps & { trigger_variant?: never }` ごと死んでいる)。`DialogProps` に無いフィールドであり、コメントも用途の説明もなし。**削除**。
- **`src/ui/accordion.ts`**: chevron アイコンの生成で `uiIcon(CHEVRON_DOWN, { ..., 'data-ricdom-role': 'accordion-arrow' })` としていたが、`uiIcon` (`src/ui/icon.ts`) は戻り値オブジェクトの `'data-ricdom-role'` を `rest` 展開の**後**に `UI_ROLE.icon` で確定させる実装のため、呼び出し側から渡した `data-ricdom-role` は常に上書きされ効果がなかった (v1 由来の Phase 3b の実装時点から死んでいた模様)。呼び出し側の DOM 出力は元々 `data-ricdom-role="icon"` だったため、**渡していた dead prop を削除するだけで挙動は不変** (回帰テストで実際の値が `'icon'` のままであることを固定)。

### 3.2 重複ヘルパーの有無

`src/ui/internal/` (`component.ts` / `exclusiveRegistry.ts` / `popupPosition.ts` / `pureHelpers.ts` / `hljs.ts`) を確認 — 位置計算 (`popupPosition.ts`) は `popup.ts`/`dropdown.ts`/`tooltip.ts` の 3 部品が共有、排他制御 (`exclusiveRegistry.ts`) は `popup.ts`/`dropdown.ts` が共有、`UI_ROLE`/`mergeClass`/`isDevMode` (`pureHelpers.ts`) は全部品が共有、hljs 検出 (`hljs.ts`) は `mdPre.ts`/`codePre.ts` が共有。**重複実装は見つからなかった**。

### 3.3 未使用 export

`ricdom`/`ricdom/ui`/`ricdom/icons` の全 export についてリポジトリ内 (tests/examples 含む) の参照有無を確認 — テストまたは examples から最低 1 回は参照されている。**未使用 export なし**。

---

## 4. 嘘コメント・制作過程語

### 4.1 「統括」の残存 — 是正済み (1 件)

`src/reactivity.ts` の先頭コメントに「設計書 §3.3 の案 A (**統括推奨・山崎承認**)」という制作過程の言葉が残っていた。**削除** し「(確定)」に置換 (事実は変わらず、プロセスの言葉だけを除去)。

### 4.2 内容が古くなっていた JSDoc — 是正済み (1 件)

`src/types.ts` の `App<S>.use` の JSDoc が「部品を登録する (Phase 1 では骨のみ。Phase 2 で正式な部品契約になる)」のままだった。実装は既に Phase 2 で完成しており、この文言は**もう嘘** (現在は完全実装されている)。**現在の挙動を説明する内容に書き換え** (「部品を登録し、host (notify/portal/app) を渡す。戻り値は渡した part 自身」)。

### 4.3 Phase 番号の言及 (公開 API の JSDoc) — 是正済み (4 件)

利用側の IDE ホバーに表示される、公開シンボル直上の `/** ... */` JSDoc から Phase 番号を除去 (事実関係は変えず、`設計書 §12` 等の参照だけ残す):

- `src/types.ts`: `RicElementNode` の JSDoc (「Phase 1 実装での確定事項」→ 削除)
- `src/types.ts`: `UsePart` の JSDoc (「Phase 2 で正式化」→ 削除、4.2 で本文も刷新)
- `src/types.ts`: `RenderFn` の JSDoc (「Phase 1 実装での確定事項」→ 削除)
- `src/ui/theme.ts`: `applyTheme` の JSDoc (「Phase 3a、設計書 §13 で確定した方式」→ 「設計書 §13 で確定した方式」)

### 4.4 ファイルヘッダコメントの Phase 言及 — 判断: 見送り (§17 候補)

`// ファイル冒頭コメント` (JSDoc ではなく行コメント、IDE のシンボルホバーには出ない) は 40 ファイル超で「Phase 3a」「Phase 3b」等の実装フェーズを含む。これらは v1 との相違点・設計判断の根拠を記す実装史ノートであり、次に手を入れる人 (人間または AI) が「なぜこの形なのか」を追うための一次情報として現に機能している (RicDOM v1 でも `release_history.md` に相当する情報を残す運用が定着している)。

40 ファイル超を機械的に書き換えるのは差分が大きい割にリスク相応の価値が薄いと判断し、**このパスでは見送る**。ただし監査の趣旨 (「利用者向けコメントに Phase 番号を残さない」) 自体には同意するため、**§17 候補として提起**: 次の破壊的変更 (v3 相当) のタイミングで、ファイルヘッダの実装史コメントを「FACT のみ」に削ぎ落とし、Phase 経緯は CHANGELOG.md (既に Keep a Changelog 形式で Phase ごとに整理済み) に一元化する方針を検討する。

### 4.5 v1 の行番号参照

`grep` で `v1:123` 相当のパターンを検索したが**該当なし** (v1 への参照は全てファイル名/関数名ベースで、行番号参照は無かった)。

---

## 5. package.json

| 項目 | 監査前 | 是正 |
|---|---|---|
| `exports` の条件順 (`types` 先頭) | 4 サブパス全て `{ "types": ..., "default": ... }` の順で既に正しい | 変更なし |
| `sideEffects: false` | 設定済み | 変更なし |
| `files` | `["dist"]` | 変更なし (README/LICENSE は npm が自動包含) |
| `keywords` | 設定済み (dom/ui/reactive/proxy/typescript/no-build) | 変更なし |
| `homepage` | **なし** | `https://github.com/miyoshi-tec/ricdom#readme` を追加 |
| `bugs` | **なし** | `{ "url": "https://github.com/miyoshi-tec/ricdom/issues" }` を追加 |
| `engines` | **なし** | `{ "node": ">=18" }` を追加 (`tsup.config.ts` の CLI ビルドが `target: 'node18'` のため整合) |
| `repository` | 設定済み | 変更なし |
| `publishConfig` | なし (unscoped パッケージなので不要) | 変更なし (見送り: スコープ付けの予定が無い限り不要) |

---

## 6. テストの安定性 (各 3 回連続実行)

### unit (`npm test` = `vitest run --project unit`)

| 実行 | Test Files | Tests | 結果 |
|---|---|---|---|
| 1 回目 | 49 passed | 466 passed | 全 pass |
| 2 回目 | 49 passed | 466 passed | 全 pass |
| 3 回目 | 49 passed | 466 passed | 全 pass |

(是正後の再計測: 467 passed — `tests/ui/icon.test.ts` に型統一の回帰テストを 1 件追加したため)

### browser (`npm run test:browser` = `vitest run --project browser`、Playwright/chromium)

| 実行 | Test Files | Tests | 結果 |
|---|---|---|---|
| 1 回目 | 21 passed | 50 passed | 全 pass |
| 2 回目 | 21 passed | 50 passed | 全 pass |
| 3 回目 | 21 passed | 50 passed | 全 pass |

**flake は観測されなかった** (unit/browser とも 3 連続で結果・件数ともに完全一致)。設計書に記載の「jsdom テストの単発 flake 観測 (popup/inline_menu)」は v1 (RicDOM v1) 側の既知事項であり、v2 では該当する不安定さは確認できなかった。rAF 依存のテストは既に `nextRender`/実 `transitionend`/`setTimeout` バックストップベースで書かれており、追加の根本対処は不要と判断。

---

## 7. サイズ予算

| 成果物 | raw | gzip | 予算 | 判定 |
|---|---|---|---|---|
| `dist/ricdom.iife.min.js` (コア) | 12,901B | **5,030B** | ≤ 5,120B | OK (余裕 90B) |
| `dist/ricdom-ui.iife.min.js` (ui) | 78,056B | 22,106B | (予算なし、目安のみ) | 参考値 |
| `dist/ricdom-ui.css` | 31,724B | 5,277B | (予算なし) | 参考値 |
| `dist/icons.js` (icons、ESM) | 8,619B | 2,841B | (予算なし) | 参考値 |

コア gzip は本監査の是正作業 (すべて `src/ui/` 以下、`src/` コア直下は無変更) を経ても **5,030B のまま不変** — コアへの機能追加禁止の制約は遵守されている。

---

## 8. CI

`.github/workflows/ci.yml` の `actions/checkout@v4` → `@v5`、`actions/setup-node@v4` → `@v5` に更新 (Node 20 deprecation annotation の解消)。`node-version: 22` は既に deprecation の対象外のため変更なし。

---

## 9. 是正一覧 (対応表)

| # | 種別 | 対象 | Before | After | 理由 |
|---|---|---|---|---|---|
| 1 | 型の一本化 (改名) | `ricdom/ui` の公開型 | `UiIconDescriptor` (独自定義) | `IconDescriptor` (`ricdom/icons` から type-only import・re-export) | 設計書 §16 で予告済みの一本化。構造的に同一の重複型を解消 |
| 2 | 内部一貫性 (直書き→定数参照) | `src/ui/accordion.ts` | `'data-ricdom-role': 'accordion-title'` | `UI_ROLE.accordionTitle` | §14「`data-ricdom-role` は `UI_ROLE` 列挙で一元管理」からの逸脱を解消。出力値は不変 |
| 3 | 内部一貫性 (直書き→定数参照) | `src/ui/tabs.ts` | `'data-ricdom-role': 'tabs-bar'` | `UI_ROLE.tabsBar` | 同上。出力値は不変 |
| 4 | dead code 削除 | `src/ui/dialog.ts` | `trigger_variant` (未使用・型に存在しない v1 由来の分解キー) | 削除 | `DialogProps` に存在しないフィールド。実質何もしていなかった |
| 5 | dead code 削除 | `src/ui/accordion.ts` | `uiIcon(...,{'data-ricdom-role':'accordion-arrow'})` | `uiIcon(...)` (該当 prop を渡さない) | `uiIcon` 内部で常に上書きされ効果が無かった dead prop |
| 6 | コメント刷新 (嘘コメント) | `src/types.ts` (`App.use` JSDoc) | 「Phase 1 では骨のみ。Phase 2 で正式な部品契約になる」 | 「部品を登録し、host (notify/portal/app) を渡す。戻り値は渡した part 自身」 | 実装済みの機能を「骨のみ」と説明していた |
| 7 | コメント刷新 (制作過程語除去) | `src/reactivity.ts` | 「(統括推奨・山崎承認)」 | 「(確定)」 | 「統括」等の制作過程の言葉を利用者向けコメントから除去 |
| 8 | コメント刷新 (Phase 除去) | `src/types.ts` ×3 / `src/ui/theme.ts` ×1 | 公開シンボル JSDoc 内の「Phase N」 | 削除 (設計書 §番号のみ残す) | IDE ホバーに出る JSDoc から実装フェーズの言及を除去 |
| 9 | JSDoc 補完 | `ricdom/ui` の公開関数 28 個 (`uiCol`/`uiRow`/`uiGrid`/`uiPanel`/`uiText`/`uiSeparator`/`uiButton`/`uiInput`/`uiCheckbox`/`uiRadiobutton`/`uiSelect`/`uiRange`/`uiColor`/`uiTextarea`/`uiMdPre`/`uiCodePre`/`uiIcon`/`uiInlineMenu`/`createDialog`/`createPopup`/`createToast`/`createTooltip`/`createSplitter`/`createScrollPane`/`createCollapseBox`/`createAccordion`/`createTabs`/`createDropdown`/`createTweakPanel`) + `createApp` (コア) | ファイルヘッダのみ (シンボル直上に JSDoc なし) | シンボル直上に 1〜3 行の JSDoc + 使用例を追加 | 「公開関数は全て 1〜3 行の JSDoc + 使用例」の完了条件を満たす |
| 10 | package.json | `homepage`/`bugs`/`engines` | なし | 追加 | npm publish 前の一般的な必須〜推奨項目の補完 |
| 11 | CI | `actions/checkout`/`actions/setup-node` | `@v4` | `@v5` | Node 20 deprecation annotation の解消 |

---

## 10. 見送り (理由・再検討条件)

| # | 項目 | 見送り理由 | 再検討条件 |
|---|---|---|---|
| 1 | `inferTweakType` の改名 | 命名規約の動詞リストに `infer` は無いが、実体 (値からの型推論) に最も忠実で誤解が少ない。無理に `build`/`create` 等へ寄せると意味がぼやける | 同種の「値→種別判定」ヘルパーが 2 個目登場した時点で `infer*` を正式な規約語彙に追加するか検討 |
| 2 | `src/cli/ricdomIconLib.ts` の `LUCIDE_SVG`(関数なのに UPPER_SNAKE) 改名 | `package.json` の `exports` に含まれない非公開の CLI 内部実装であり、本監査の主眼 (公開 API 表面) の対象外。改名はテストファイルにも波及する | CLI lib を公開 API 化する話が出た時点、または CLI 単体の改修タイミング |
| 3 | ファイルヘッダコメントの Phase 番号一括除去 (40 ファイル超) | JSDoc と異なり IDE ホバーに出ない実装史ノートであり、除去の価値より 40+ ファイルの機械的な差分によるレビューコスト・リスクの方が大きいと判断 | 次の破壊的変更 (v3) のタイミングで、実装史を CHANGELOG.md へ一元化しヘッダを FACT のみへ刷新する方針を検討 (§17 候補) |
| 4 | `Host.app: App<any>` の型改善 | 設計書 §13 で「ジェネリック化すると構造的部分型の分散で `attach` が合わなくなる」ことが検証済みの意図的な設計。コード上のコメントも既に理由を説明済み | 具体的な型安全性の実害 (バグ) が報告された場合 |
| 5 | `publishConfig` の追加 | unscoped パッケージ (`ricdom`) であり、npm の既定公開設定で問題ない | スコープ付け (`@miyoshi-tec/ricdom` 等) を検討する場合 |

---

## 11. 設計書との差異・判断に迷った点 (§17 候補)

1. **ファイルヘッダの実装史コメントの扱い** (§4.4/見送り #3): 「利用者向けコメントに Phase 番号を残さない」という監査指示と、「実装の経緯を追える一次情報を残す」という実務上の価値が競合する。今回は JSDoc (IDE ホバーに出る = 真に利用者向け) とファイルヘッダ (メンテナ向けの実装ノート) を区別し、前者のみ是正した。この区別を設計書レベルで明文化するかどうかは山崎の判断を仰ぎたい。
2. **`data-ricdom-role` が付与されない部品**: `createDialog`/`createPopup`/`createToast`/`createTooltip`/`createDropdown` の portal 本体要素 (`.ric-dialog`/`.ric-popup__body`/`.ric-toast__container`/`.ric-tooltip__popup`/`.ric-dropdown__body`) には `data-ricdom-role` が付与されておらず、`UI_ROLE` 列挙にも対応するキーが無い (代わりに `data-ricdom-dialog-id`/`data-ricdom-popup-id` 等の個別マーカー属性と CSS クラスで識別している)。§14 の「`data-ricdom-role` は全部品に付与する」方針からは外れて見えるが、DOM 出力を追加すると挙動変更 (本監査のスコープ外) になるため**今回は変更していない**。次の破壊的変更で `UI_ROLE` を拡充し統一するかどうかは再検討事項として提起する。
3. **`inferTweakType` の動詞**: 上記 10-1 の通り、命名規約の動詞リストが完全網羅ではないことが今回の監査で判明した。規約表自体に「型推論ヘルパーは `infer*`」を追記するかは山崎の判断に委ねる。

---

## 12. コミット一覧

本監査に伴う是正は以下のコミットに分割した (日本語 + Conventional Commits、push 済みではなくローカルのみ):

1. `docs: API 整合レビュー報告を追加` — 本ファイル (§9-1)
2. `refactor: IconDescriptor と UiIconDescriptor を一本化` — §9-1 の型一本化 (改名)
3. `refactor: dead code 削除と data-ricdom-role の内部一貫性を是正` — §9-2〜5 (UI_ROLE 直書き解消 + dialog/accordion の dead code 削除。同一ファイル内の近接箇所のため 1 コミットにまとめた)
4. `docs: 嘘コメント・制作過程語を除去し公開関数に JSDoc を補完` — §9-6〜9
5. `chore: package.json に homepage/bugs/engines を追加` — §9-10
6. `ci: actions/checkout・setup-node を v5 に更新` — §9-11

---

## 13. 監査後の公開 API 変更 (追跡)

本監査 (2026-09-02) 以降にリリースされた公開 API の変更を追跡する。挙動修正のみ (公開シグネチャ
不変) のリリースはここには載せない — SPEC.md/CHANGELOG.md を参照。

### 2.0.0-alpha.7: `AccordionProps.open` / `AccordionProps.onToggle` 追加

パイロット第 4 号の要望 (「ボタン押下で節を外部から閉じたい」「共有 URL から開閉状態を復元したい」)
を受け、`createAccordion` に `createTabs` と同じ controlled/uncontrolled 契約を追加した。

| 種別 | 名前 | 規約 | 判定 |
|---|---|---|---|
| Props フィールド (追加) | `AccordionProps.open?: Record<string, boolean>` | 既存の `TabsProps.active` と同じ「controlled スイッチ」パターン | OK |
| Props フィールド (追加) | `AccordionProps.onToggle?: (id, nextOpen, nextMap) => void` | 既存の `TabsProps.onChange` と同じ「選択が起きた通知」パターン (引数の形は accordion 独自 — nextMap を含む) | OK |

命名規約からの逸脱なし (既存の `Props` 命名 = 追加フィールドであり新しい型ではない)。破壊的変更は
ゼロ (両フィールドとも省略可能、省略時は既存の uncontrolled 挙動のまま)。`setOpen()` のような
命令的メソッドは意図的に追加していない (「canon は 1 つ」ポリシー、理由は `src/ui/accordion.ts`
のファイルヘッダおよび SPEC.md §10.3.3a に記載)。

### 2.0.0-alpha.8: `UiButtonVariant` に `'link'` 追加、`UI_ROLE` に 5 件追加

パイロット第 5〜7 号 (RaccoonMemo / Rancha / Brownies Desktop、3 アプリ同時移行) の横断報告を受けた
変更。

| 種別 | 名前 | 規約 | 判定 |
|---|---|---|---|
| 型 (union 拡張) | `UiButtonVariant`: `'default' \| 'primary' \| 'ghost'` → `+ 'link'` | 既存 union の値追加 (新しい型ではない) | OK |
| 定数フィールド (追加) | `UI_ROLE.dialogTitle = 'dialog-title'` | 既存の `dialogHeader`/`dialogBody` 等と同じ `dialogXxx` 命名 | OK |
| 定数フィールド (追加) | `UI_ROLE.popupTrigger = 'popup-trigger'` | 既存の `dropdownTrigger` と同じ `xxxTrigger` 命名 | OK |
| 定数フィールド (追加) | `UI_ROLE.tooltipTrigger = 'tooltip-trigger'` | 同上 | OK |
| 定数フィールド (追加) | `UI_ROLE.toastMsg = 'toast-msg'` | 既存の `toastItem`/`toastClose` と同じ `toastXxx` 命名 | OK |
| 定数フィールド (追加) | `UI_ROLE.tweakTitle = 'tweak-title'` | 既存の `tweakPanel`/`tweakFolder` と同じ `tweakXxx` 命名 | OK |

命名規約からの逸脱なし。破壊的変更はゼロ (`variant: 'link'` は既存 union への値追加、`UI_ROLE` の
新規フィールドは既存フィールドの値・意味を変えない追加のみ)。`UiButtonVariant` は v1
(`ric_ui/control/ui_button.js`) に存在した正式 variant の復活であり新設ではない (設計書 §20
「v1 で正式 prop だったものは復活が原則」)。`UI_ROLE` の 5 件は `src/ui/dialog.ts`/`popup.ts`/
`toast.ts`/`tooltip.ts`/`tweakPanel.ts` の役割棚卸しで見つかった非対称の解消 (詳細は SPEC.md §11)。
