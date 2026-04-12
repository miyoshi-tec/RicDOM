# RicDOM Technical Specification

AI（Claude Code 等）がコーディングする際の詳細仕様書。
人間向けの概要は README.md を参照。

---

## 1. アーキテクチャ概要

### 2層構造

| バンドル | 内容 |
|---------|------|
| `RicDOM.min.js` | コア（必須）— Proxy リアクティビティ + JSON→DOM 差分更新 |
| `RicUI.min.js` | UI コンポーネント集（30+ 部品、5 テーマ）+ パラメータ調整パネル |

バンドルサイズは README.md を参照。

### ファイル構成

```
src/
  ricdom.js              # RicDOM コア実装（938行）
  ricdom_globals.js      # ブラウザ window 公開エントリ
  ricui_globals.js       # RicUI window 公開エントリ

ric_ui/
  index.js               # RicUI 公開 API 入口
  context.js             # テーマ CSS 変数（5テーマ × density × font_size）
  css_registry.js        # CSS クラス収集・ビルドキャッシュ
  css_templates.js       # CSS テンプレート（コンポーネント別）
  layout/                # ui_page, ui_col, ui_row
  surface/               # ui_panel, create_ui_panel
  control/               # ui_button, ui_input, bind_input, ui_range, bind_range, ui_color, bind_color, ui_separator, etc.
  text/                  # ui_text, ui_code_pre
  popup/                 # create_ui_popup, create_ui_tooltip, create_ui_dialog, create_ui_toast
  composite/             # create_ui_accordion, create_ui_splitter, ui_tabs, bind_tabs, create_ui_tweak_panel, ui_tweak_panel, ui_tweak_folder, ui_tweak_row
```


---

## 2. RicDOM コア

### create_RicDOM

```javascript
create_RicDOM(target, state_with_render) → instance_handle
```

| 引数 | 型 | 説明 |
|------|---|------|
| `target` | string \| HTMLElement | マウント先（CSS セレクタ or DOM 要素） |
| `state_with_render` | object | 初期 state。`render: (s) => VDOM` を含めると描画関数として使われる |

`render` は後から `handle.render = fn` でも設定可能（`render` 未指定で作成した場合、最初の代入まで描画は保留される）。

旧 API `create_RicDOM(raw_state, target, render_fn)` も後方互換として受け付ける（第1引数が object の場合）。

**戻り値** `instance_handle`:
- state プロパティへのアクセス: `handle.count`, `handle.theme` 等
- `handle.refs`: `Map<string, Element>` — ref で登録した DOM 要素
- `handle._internal.destroy()`: 購読解除・style タグ削除
- `handle._internal.force_render()`: 同期再描画（非推奨）

**エラー時**: `NOOP_PROXY` を返す（全操作が無害に成功する Proxy）

### Proxy メカニズム

#### 共有 Proxy（state_proxy_map）
同一 `raw_state` に対して1つの共有 Proxy を作成。複数の `create_RicDOM` が同じ state を共有可能。

#### トップレベル set トラップ
```javascript
set(obj, key, value) {
  if (key === 'ignore') { obj[key] = value; return true; } // ignore は再描画しない
  obj[key] = value;
  // __notify コールバックを注入（create_ui_xxx のファクトリ用）
  if (value != null && (typeof value === 'object' || typeof value === 'function')) {
    value.__notify = () => subscribers.forEach(schedule => schedule());
  }
  subscribers.forEach(schedule => schedule()); // 全購読者に再描画通知
  return true;
}
```

#### 一段目 get トラップ（_wrap_child）
```javascript
get(obj, key) {
  const val = obj[key];
  // ignore / null / プリミティブ / 配列 → そのまま返す
  if (key === 'ignore' || val == null || ...) return val;
  // オブジェクト / 関数 → 子 Proxy でラップ（WeakMap キャッシュ）
  return _wrap_child(val);
}
```

子 Proxy の set トラップ:
- `prop === 'ignore'` → 再描画しない
- それ以外 → `subscribers.forEach(schedule => schedule())` で再描画

#### __notify 注入
`s.xxx = create_ui_xxx()` のように state にファクトリを格納すると、set トラップが `value.__notify` にコールバックを注入。ファクトリ内部のイベントハンドラから `inst.__notify?.()` で再描画をトリガーできる。

### state 更新ルール

```javascript
// ✅ トップレベル代入 → 再描画
s.count = 10;

// ✅ 一段目のプロパティ代入 → 再描画（一段目 Proxy）
s.page.theme = 'dark';
s.dark.density = 'compact';

// ❌ 二段目以降 → 再描画されない
s.user.address.city = 'Tokyo';

// 🔒 ignore → 再描画しない（内部キャッシュ用）
s.ignore.cache = someData;
```

### JSON ツリー構造

```javascript
{
  tag: 'div',                           // HTML タグ名
  class: 'my-class',                    // class 属性（文字列 or 配列）
  style: { color: 'red' },              // インラインスタイル（文字列 or オブジェクト or 配列）
  ctx: [ ... ],                         // 子要素（配列 or 単体）
  ref: 'myRef',                         // DOM 参照名（handle.refs で取得）
  onclick: () => { ... },               // イベントハンドラ
}
```

`:hover` / `:active` / `:focus` などの疑似クラスが必要な場合は、RicUI の
CSS テンプレート（`ric_ui/css_templates.js`）か、各要素の直近に置いた
`<style>` VDOM ノードで通常の CSS として書く。

**スタイル正規化**:
- 文字列 → `el.style.cssText` に直接設定
- オブジェクト → キーを camelCase に変換
- 配列 → 後勝ちマージ（文字列はスキップ）

### DOM 差分アルゴリズム

- **Serial Key マッチング**: 重複タグにインデックスを付与（`div@0`, `div@1`）
- **Position-based パッチング**: キー属性なし、位置ベースで比較
- **ノード再利用**: 同一 serial key → DOM ノードを再利用（input フォーカス・IME 状態を保持）
- **is_json_equal**: 高速な深い等値比較（関数は参照比較）

### レンダースケジューラ

- `requestAnimationFrame` ベースのバッチング
- 同一フレーム内の複数 state 変更 → 1回の再描画
- `render_scheduled` フラグで重複防止

### NOOP_PROXY

エラー時の安全なフォールバック。全ての get/set/apply/delete が自身を返す。
`app.panel.count++` のようなチェーンも安全に失敗する。

---

## 3. RicUI コンポーネント

### 3 パターン

| パターン | 内部状態 | 用途 |
|---------|:-------:|------|
| `ui_xxx({ props })` | なし | 純粋な描画（ボタン、テキスト等） |
| `bind_xxx(s, key, opts)` | なし | `ui_xxx` + state 双方向バインドのショートカット |
| `create_ui_xxx(opts?)` | **あり** | 開閉・テーマ・位置等の内部状態を持つ部品 |

`create_ui_xxx()` の戻り値は `s` のトップレベルに格納:
```javascript
s.page = create_ui_page({ theme: 'teal' });
s.dd   = create_ui_popup();
```

### テーマシステム

5 テーマ × 3 密度 × 3 フォントサイズ:

| テーマ | 特徴 |
|--------|------|
| `light` | 明るい背景、青アクセント |
| `dark` | 暗い背景、明るい青アクセント |
| `teal` | グラデーション背景、ティール/緑アクセント |
| `cyber` | グラスモーフィズム、ネオンシアン、角丸なし（radius: 0px） |
| `aqua` | グラスモーフィズム、水滴/ブルー、大角丸、スプリングアニメーション |

密度: `comfortable` / `compact` / `tight`
フォントサイズ: `sm` / `md` / `lg`

### CSS 変数

#### カラー変数（テーマ別）

| 変数 | light | dark | teal | cyber | aqua |
|------|-------|------|------|-------|---------|
| `--ric-color-fg` | #111827 | #e5e7eb | #0d2b24 | #e2e8f0 | #1a2c3c |
| `--ric-color-fg-muted` | #6b7280 | #9ca3af | #46605a | #7aa8c8 | #5c7a8a |
| `--ric-color-bg` | #f9fafb | #0f1115 | gradient | gradient | gradient |
| `--ric-color-control` | #ffffff | #1a1d24 | rgba白0.9 | rgba暗0.6 | rgba白0.5 |
| `--ric-color-border` | #e5e7eb | #2a2f3a | #c5ddd8 | rgba青0.65 | rgba青0.35 |
| `--ric-color-accent` | #2563eb | #60a5fa | #007f6d | #38bdf8 | #0284c7 |
| `--ric-color-accent-fg` | #ffffff | #0f1115 | #ffffff | #04070f | #ffffff |

teal/cyber/aqua は `--ric-color-bg` にグラデーションを使用。
input/select/button は `--ric-color-control` を使い単色（グラデーション回避）。

#### 密度変数

| 変数 | comfortable | compact | tight |
|------|------------|---------|-------|
| `--ric-gap` | 6px | 4px | 1px |
| `--ric-gap-md` | gap * 2（自動導出） | gap * 2（自動導出） | gap * 2（自動導出） |
| `--ric-pad-x` | 14px | 10px | 6px |
| `--ric-pad-y` | 8px | 4px | 1px |
| `--ric-control-h` | 36px | 28px | 22px |

`--ric-radius` は密度ではなくテーマごとに定義: light/dark/teal: 8px、cyber: 0px、aqua: 20px。

#### フォントサイズ変数

| 変数 | sm | md | lg |
|------|-----|-----|-----|
| `--ric-font-size` | 12px | 14px | 16px |

各コンポーネントは em 相対値で自動スケール（0.85em / 1em / 1.25em）。

### Layout

#### create_ui_page(initial?)

```javascript
s.page = create_ui_page({ theme: 'teal', density: 'comfortable', font_size: 'md' });
return s.page({ style: '...', ctx: [...] });

s.page.theme = 'dark';     // 動的変更 → 再描画
s.page.density = 'compact';
```

プロパティ: `theme`, `density`, `font_size`

内部動作:
- CSS 変数をインラインスタイルに注入
- ポータルキューを drain して ctx 末尾に展開
- 使用 CSS クラスを走査して動的 `<style>` タグ生成
- window の `'ric-theme-change'` イベントを listen して自身の設定を自動同期（nav_bar 等の外部から一斉にテーマを変更できる）

#### ui_col / ui_row

```javascript
ui_col({ ctx: [...], style: {} })  // flex-direction: column
ui_row({ ctx: [...], style: {} })  // flex-direction: row, align-items: center
```

### Surface

#### ui_panel / create_ui_panel

```javascript
// ステートレス（静的コンテナ）
ui_panel({ ctx: [...], layout: 'col', theme: 'dark', disabled: true })

// ファクトリ（動的設定変更）
s.dark = create_ui_panel({ theme: 'dark' });
s.dark.disabled = true;
s.dark({ ctx: [...] })
```

プロパティ: `theme`, `density`, `font_size`, `disabled`, `layout`
`disabled: true` → `inert` 属性 + `opacity: 0.45`（Tab フォーカス・クリック・選択を遮断）

### Control

| 関数 | 説明 |
|------|------|
| `ui_button({ ctx, variant, onclick, disabled })` | variant: `default` / `primary` / `ghost` |
| `ui_input({ value, oninput, placeholder, type, disabled })` | テキスト入力 |
| `bind_input(s, key, options)` | `s[key]` と双方向バインド |
| `ui_checkbox({ checked, onchange, ctx, disabled })` | checked は 0/1（数値） |
| `bind_checkbox(s, key, options)` | `s[key]` と双方向バインド |
| `ui_radiobutton({ name, value, options, onchange })` | options: string[] or {value,label}[] |
| `bind_radiobutton(s, key, options)` | `s[key]` と双方向バインド |
| `ui_range({ value, min, max, step, oninput, disabled })` | スライダー + 値表示 |
| `bind_range(s, key, options)` | `s[key]` と双方向バインド |
| `ui_color({ value, oninput, disabled })` | カラーピッカー（hex/rgba 自動判定） |
| `bind_color(s, key, options)` | `s[key]` と双方向バインド |
| `ui_separator()` | 水平区切り線 |
| `ui_select({ value, options, onchange, disabled, placeholder })` | `appearance: base-select`（Chrome 135+） |
| `bind_select(s, key, options)` | `s[key]` と双方向バインド |

### Text

```javascript
ui_text({ ctx: ['本文'], variant: 'default' })   // <span> font-md
ui_text({ variant: 'muted', ctx: ['補助'] })      // <span> font-sm, fg-muted
ui_text({ variant: 'title', ctx: ['見出し'] })     // <h2> font-lg, bold
ui_text({ variant: 'label', ctx: ['ラベル'] })     // <label> font-sm, semi-bold

ui_code_pre({ obj: data })                         // JSON.stringify + hljs ハイライト
ui_code_pre({ ctx: [code], lang: 'javascript' })   // コード表示
```

### Popup

全て引数なし。popup の排他制御（1つ開くと他が閉じる）はモジュールレベルで自動管理。

#### create_ui_popup()

```javascript
s.dd = create_ui_popup();

// ラベルモード（ボタン幅に合わせる）
s.dd({ label: '選択肢', ctx: [...] })

// アイコンモード（160px min-width、左右スマート配置）
s.menu({ icon: '≡', ctx: [...] })

// ghost（ホバーまで枠を隠す）
s.cfg({ icon: '⚙', ghost: true, ctx: [...] })
```

内部状態: `_o`(open), `_c`(closing), `_d`(dir), `_er`(expand_right), `_p`(pos)
メソッド: `inst.close()`

#### create_ui_tooltip()

```javascript
s.tip = create_ui_tooltip();
s.tip({ content: 'ヒント', ctx: [trigger], dir: 'auto' })
```

dir: `auto` | `top` | `bottom` | `right` | `left`（auto: top→bottom→right→left の優先順）

#### create_ui_dialog()

```javascript
s.dlg = create_ui_dialog();
s.dlg({ trigger_ctx: ['開く'], title: '確認', ctx: [...], actions: [...] })
```

#### create_ui_toast()

```javascript
s.toast = create_ui_toast();
// render 内で呼ぶ（ポータル登録）
s.toast();
// 任意のタイミングで表示
s.toast.show('保存しました', { type: 'success', duration: 3000 });
```

type: `default` | `success` | `error` | `warning` | `info`

### Composite

#### create_ui_accordion(opts?)

accordion は「どのセクションが開いているか」という状態を本質的に持つため、
ファクトリパターンのみを提供する（`ui_accordion` / `bind_accordion` は
存在しない — user が accordion の内部情報を外で管理するのは不自然なため）。

```javascript
s.acc = create_ui_accordion({ default_open: { q1: true } });
s.acc({ items: [{ id: 'q1', title: '質問1', ctx: [...] }], multi: true })
```

`multi: true`（デフォルト）で複数パネル同時展開、`false` で排他モード。

#### ui_tabs / bind_tabs

tabs の「どのタブがアクティブか」は radiobutton の value や select の value と
同じく user の関心事（タブ切替で content を描き分けるため）なので、state に
直接持つ。ファクトリ版（`create_ui_tabs`）は存在しない。

```javascript
// ステートレス版
ui_tabs({
  items:    [{ key: 'profile', label: 'プロフィール', ctx: [...] }],
  active:   s.tab,
  onchange: (key) => { s.tab = key; },
  variant:  'line',
})

// state バインド版（推奨）
create_RicDOM('#app', {
  tab: 'profile',
  render(s) {
    return bind_tabs(s, 'tab', { items: [...], variant: 'pill' });
  },
});
```

variant: `line`（アンダーライン、デフォルト）| `pill`（背景色）

#### create_ui_splitter(opts)

```javascript
s.split = create_ui_splitter({ side: 'left', size: 240, min: 60, max: 400 });
s.split({ side: { ctx: [...] }, main: { ctx: [...] } })
s.split.toggle()         // 折りたたみ切替
s.split.collapsed()      // 折りたたみ状態
s.split.get_size()       // 現在サイズ
s.split.set_size(300)    // サイズ変更
```

side: `left` | `right` | `top` | `bottom`

### ポータルパターン

popup / tooltip / dialog / toast はポータル経由で `ui_page` 直下に描画される。
`_page_portal_queue` はスタックベースで管理:
- `begin()` で新しいスタックフレームを作成
- `push()` でスタック top のフレームに VDOM を積む
- `drain()` でスタック top を pop して返す（なければデフォルトバッファを drain）

複数の `ui_page` インスタンスがある場合、各 `create_ui_page` が `begin()` → render → `drain()` のサイクルでポータルを分離する。
stacking context 問題（backdrop-filter / clip-path）を回避。

テーマ上書き: `_wrap_portal` が各ポータル要素の style に CSS 変数を注入。

### テーマユーティリティ

#### create_theme / create_density / create_font_size

```javascript
// ベーステーマに部分上書き
const my_theme = create_theme('teal', { '--ric-color-accent': '#e91e8c' });
// オブジェクト直接指定も可
const my_theme = create_theme({ '--ric-color-fg': '#fff', ... });

// 密度・フォントサイズも同様
const my_density = create_density('compact', { '--ric-control-h': '24px' });
const my_font = create_font_size('md', { '--ric-font-size': '16px' });
```

#### export_theme / export_settings

```javascript
// テーマ変数をオブジェクトで取り出す
const theme_vars = export_theme(document.querySelector('.ric-page'));

// theme / density / font_size を分離して取り出す
const { theme, density, font_size } = export_settings(document.querySelector('.ric-page'));
```

#### 自動導出ルール

- `fg-muted` と `border` は `fg` から `color-mix()` で自動導出（未指定時）
- `--ric-duration`（デフォルト 200ms）と `--ric-easing`（デフォルト ease）は `make_css_vars` で自動注入

---

## 4. パラメータ調整パネル（ui_tweak）

RicUI の composite カテゴリに統合されたパラメータ調整パネル。
3 段階 API:
- **Tier 1** — `create_ui_tweak_panel({ data })` に data を投げるだけで全自動 GUI
- **Tier 2** — `keys` で一部の行を上書き（type / label / min / max 等）
- **Tier 3** — `ui_tweak_panel({ ctx: [...] })` で ui_tweak_row / ui_tweak_folder を自由に組み立て

### create_ui_tweak_panel（Tier 1/2: factory）

```javascript
// Tier 1: data だけで全自動 GUI
s.tw = create_ui_tweak_panel({ data: params });

// Tier 2: keys で部分上書き
s.tw = create_ui_tweak_panel({
  title: 'Settings',
  data: params,
  keys: {
    speed: { type: 'range', min: 0, max: 100 },
    quality: { type: 'select', options: ['low', 'high'] },
    secret: false,   // 非表示
  },
  width: '100%',
});

// 描画
return s.page({ ctx: [ s.tw() ] });
```

factory を `s` に格納すると RicDOM が `inst.__notify` を自動注入する。
`_generate_rows` の各行の set コールバックが `notify()` を明示的に呼ぶため、
ネストしたプロパティ（`data.nested.key = v`）の変更も再描画につながる
（Proxy の自動検知ではなく、set コールバック経由）。

### ui_tweak_panel（Tier 3: stateless wrapper）

```javascript
ui_tweak_panel({
  title: 'Custom',
  width: '100%',
  ctx: [
    ui_tweak_folder({ label: 'Colors', open: true, ctx: [
      ui_tweak_row({ label: 'fg', get: () => t.fg, set: (v) => { t.fg = v; } }),
    ]}),
    ui_button({ ctx: ['Save'], onclick: save }),
  ],
})
```

### ui_tweak_row

```javascript
ui_tweak_row({
  label: 'speed',
  get: () => data.speed,
  set: (v) => { data.speed = v; },
  type: 'range',      // 省略時は infer_type で自動推論
  min: 0, max: 100,   // type 固有パラメータ
})
```

### ui_tweak_folder

ネイティブ `<details>` ベース。RicDOM の差分エンジンは vdom 属性が変わらない限り
DOM を再設定しないため、ユーザのクリックによる開閉はプログラム的に保持される。

```javascript
ui_tweak_folder({ label: 'Advanced', open: true, ctx: [...] })
```

### 型推論（infer_type）

| 値 | → type |
|----|--------|
| `boolean` | checkbox |
| `number` | number |
| `'#e11d48'`（hex） | color |
| `'rgb(255,0,0)'`（rgb/rgba/hsl/hsla） | color |
| `'Hello'`（その他文字列） | text |
| `[...]`（配列） | json_preview |
| `{ ... }`（plain object） | folder |

### keys 上書きルール

| keys[k] の値 | 挙動 |
|-------------|------|
| `false` | 行を非表示 |
| `{ tag: ... }` (vdom) | 行をその vdom で差し替え |
| `{ type, label, ... }` | ui_tweak_row のオプションを上書き |
| `{ open, keys, ctx }` (folder) | ネストオブジェクトの folder 設定。ctx 指定時はそれを使用 |

---

## 5. コーディング規約

- `var` 禁止、`const` 最大限、`let` 最小限
- `class` 構文不使用、ファクトリ関数パターンで統一
- CommonJS（`require` / `module.exports`）、ESM 不使用
- 命名はスネークケース（例外: `create_RicDOM`）
- エラーは `console.error()` + graceful return（throw しない）
- `NOOP_PROXY` 返却でエラー連鎖を防止
- コメントは日本語・多め
- テスト: `node:test` + jsdom

---

## 6. ビルド

```bash
npm run build        # 全バンドル
npm run build:core   # RicDOM.min.js
npm run build:ui     # RicUI.min.js（調整パネル含む）
npm test             # 295 テスト
```

esbuild でバンドル + minify。`--platform=browser`。
CSS はテンプレートリテラル内に定義（コメント除去済み）。
