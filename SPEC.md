# RicDOM Technical Specification

AI（Claude Code 等）がコーディングする際の詳細仕様書。
人間向けの概要は README.md を参照。

---

## 1. アーキテクチャ概要

### 2層構造

| バンドル | 内容 |
|---------|------|
| `RicDOM.min.js` | コア（必須）— Proxy リアクティビティ + JSON→DOM 差分更新 |
| `RicUI.min.js` | UI コンポーネント集（5 テーマ）+ パラメータ調整パネル |

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
  text/                  # ui_text, ui_code_pre, ui_md_pre
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

`render` は後から `handle.render = fn` でも設定可能（`render` 未指定で作成した場合、最初の代入まで描画は保留される）。`handle.render = fn` の代入は **per-instance**：複数の instance が同じ `raw_state` を共有していても、各 instance は独立した render を持てる。

#### 複数 instance で state を共有する

複数の instance が同じ state を共有したい場合は、同じ state オブジェクトを渡す。各 instance は独自の render を持てる:

```javascript
const state = { counter: 0 };
const a = create_RicDOM('#mount-a', state);
const b = create_RicDOM('#mount-b', state);
a.render = (s) => ({ tag: 'span', ctx: [`A:${s.counter}`] });
b.render = (s) => ({ tag: 'span', ctx: [`B:${s.counter}`] });
state.counter = 7;   // 両 instance が再描画される
```

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

※ `render` キーの代入は上記に加えて `_render_fn` の書き換えも行う。ただし shared_proxy の `_render_fn` は最初の `create_RicDOM` 呼び出しのクロージャ変数なので、`handle.render = fn` は **`instance_handle` 側の set トラップ** で per-instance に処理される（各 instance 独自の `_render_fn` を書き換える）。複数 instance で異なる render を持ちたい場合は `handle.render = fn` を使う。

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

### 任意属性の透過（rest スプレッド契約）

すべての `ui_xxx` コンポーネント（layout / surface / control / text）は、
明示引数にない props を **rest スプレッド**で受け取り、**外側要素**（wrapper）
にそのまま透過する。これにより `onclick` / `id` / `data-*` / `aria-*` /
`style` / `class` 等の任意の DOM 属性を自由に付与できる。

```javascript
ui_button({ ctx: ['Save'], onclick: save, id: 'btn-save', 'data-role': 'primary' })
ui_panel({ ctx: [...], id: 'main', onmouseenter: hover })
ui_input({ id: 'name', onchange: handle, 'aria-label': 'Full name' })
```

**class の連結**: `class` を渡しても基底クラス（`ric-button` 等）は保たれ、
その後ろにユーザ指定 class が連結される。

```javascript
ui_button({ class: 'my-btn' }).class      // → "ric-button my-btn"
ui_panel({ class: 'card', layout: 'row' }) // → "ric-panel ric-panel--row card"
```

**計算済みフィールドは上書き不可**: `tag` / `class` / `ctx` などコンポーネントの
責務で決まるフィールドは rest から上書きできない（計算済みの値が必ず勝つ）。

**隔離契約（内部 input を持つコンポーネント）**: `ui_checkbox` / `ui_radiobutton` /
`ui_range` / `ui_color` は内部に `<input>` を持つが、そこに掛けるべき
`checked` / `value` / `onchange` / `oninput` は**内部 input に限定**され、
外側 wrapper 要素には漏れない。これはテストで保証される契約である。

```javascript
const n = ui_checkbox({ onchange: fn });
n.onchange           // → undefined（label wrapper には付かない）
n.ctx[0].onchange    // → fn（内部 input にのみ付く）
```

**実装ルール**（コンポーネント作者向け）: 戻り値の object リテラルでは
`...rest` を**先頭**に置き、計算済みフィールドを後から列挙する。これにより
rest 経由で tag や class を渡されても計算済みの値で上書きされる。

```javascript
return {
  ...rest,                                                     // 先頭
  tag: 'button',
  class: rest.class ? cls_base + ' ' + rest.class : cls_base,
  ...(onclick ? { onclick } : {}),
  ctx,
};
```

`...rest` を末尾に置くと `class` キーが rest の値で上書きされ、基底クラスが
消える（リグレッションあり、`ui_button` / `ui_input` v0.3.1 まで存在）。

### Control

| 関数 | 説明 |
|------|------|
| `ui_button({ ctx, variant, onclick, disabled })` | variant: `default` / `primary` / `ghost` |
| `ui_input({ value, oninput, placeholder, type, disabled })` | テキスト入力 |
| `bind_input(s, key, options)` | `s[key]` と双方向バインド |
| `ui_textarea({ value, oninput, rows, auto_resize })` | 複数行入力。`auto_resize: { min_rows, max_rows }` で高さ自動調整 |
| `bind_textarea(s, key, options)` | `s[key]` と双方向バインド |
| `focus_when(el, cond)` | 条件の立ち上がりエッジで `el.focus()`。`el` は `handle.refs.get('name')` 等（`render(s)` の `s` は state Proxy で `refs` を持たないため、`create_RicDOM` の戻り値 `handle` を closure 経由で参照する） |
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

ui_md_pre({ ctx: ['# 見出し\n\nテキスト'] })       // Markdown → VDOM 変換
```

#### ui_md_pre

Markdown テキストを VDOM ノードに変換する簡易パーサー。外部ライブラリ不要。

| Props | 型 | 説明 |
|-------|------|------|
| `ctx` | `string[]` | Markdown テキスト（複数渡すと連結） |

対応構文：`# 〜 ######`（h1〜h6）見出し、`**太字**`、`*斜体*`、`` `code` ``、` ``` ` コードブロック（hljs 対応）、`- リスト`、`> 引用`、`[text](url)` リンク、`| a | b |` テーブル（アライメント対応）、`---` 水平線

### Popup

全て引数なし。popup の排他制御（1つ開くと他が閉じる）はモジュールレベルで自動管理。

**ポータルテーマ上書き**: 全 Popup 系コンポーネント（popup / tooltip / dialog / toast）は
呼び出し時に `theme` / `density` / `font_size` を指定でき、ポータル要素のテーマを
`create_ui_page` とは独立に上書きできる。省略時は page のテーマを継承する。

```javascript
s.dlg({ ..., theme: 'dark', density: 'compact' })  // ダイアログだけ dark テーマ
```

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
メソッド: `inst.close()` — 即座に閉じる（アニメーションなし。排他制御から呼ばれる）

#### create_ui_tooltip()

```javascript
s.tip = create_ui_tooltip();
s.tip({ content: 'ヒント', ctx: [trigger], dir: 'auto' })
```

dir: `auto` | `top` | `bottom` | `right` | `left`（auto: top→bottom→right→left の優先順）

#### create_ui_dialog()

**uncontrolled（トリガーボタン付き）**:

```javascript
s.dlg = create_ui_dialog();
s.dlg({
  trigger_ctx: ['開く'],         // トリガーボタンのラベル
  trigger_variant: 'primary',    // ボタンの variant（default / primary / ghost）
  title: '確認',                 // ヘッダーのタイトル
  ctx: [ui_text({ ctx: ['本当に削除しますか？'] })],  // ダイアログ本体
  actions: [                     // フッターのアクションボタン列
    ui_button({ ctx: ['キャンセル'], onclick: () => s.dlg.close() }),
    ui_button({ ctx: ['削除'], variant: 'primary', onclick: delete_item }),
  ],
})
```

**controlled（外部 state 管理）**:

```javascript
s.dlg = create_ui_dialog();
s.dlg({
  open:     s.page.show_dlg,                       // 開閉状態（外部管理）
  on_close: () => { s.page.show_dlg = false; },    // 閉じ要求時のコールバック
  title: '確認',
  ctx: [...],
  actions: [
    ui_button({ ctx: ['OK'], onclick: () => { s.page.show_dlg = false; } }),
  ],
})
// → 戻り値は null（トリガーボタンなし、ポータルのみ）
```

- `trigger_ctx` と `open` の併用は禁止（`console.error`）。
- `on_close` は overlay クリック・✕ ボタン・ESC キーで発火する。
  親が `open` を `false` にすると閉じアニメーションが再生され、完了後にポータルから除去される。
- ESC キーは uncontrolled / controlled 両モードで有効。

メソッド:
- `inst.close()` — アニメーション付きで閉じる。controlled 時は `on_close` を呼ぶ。
- `inst.open()` — プログラムから開く（uncontrolled のみ。controlled では no-op）。

#### create_ui_toast()

```javascript
s.toast = create_ui_toast();
// render 内で呼ぶ（ポータル登録）
s.toast();
// 任意のタイミングで表示
s.toast.show('保存しました', { type: 'success', duration: 3000 });
s.toast.show('エラー',       { type: 'error',   duration: 0 });  // 0 = 自動消去なし
```

type: `default` | `success` | `error` | `warning` | `info`
メソッド: `inst.show(msg, { type, duration })` — トースト通知を表示する

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
s.split = create_ui_splitter({
  side:        'left',   // 'left' | 'right' | 'top' | 'bottom'
  size:        240,      // サイドパネルの初期サイズ (px)
  min:         60,       // 最小サイズ (px)
  max:         400,      // 最大サイズ (px, null = 制限なし)
  collapsible: true,     // 折り畳みボタンを表示する（デフォルト: true）
});

// render 内で呼ぶ（uncontrolled）
s.split({ side: { ctx: [...] }, main: { ctx: [...] } })

// render 内で呼ぶ（controlled — 折り畳み状態を外部管理）
s.split({
  collapsed:          s.page.sidebar_collapsed,
  on_collapse_change: (v) => { s.page.sidebar_collapsed = v; },
  side: { ctx: [...] },
  main: { ctx: [...] },
})

// 公開 API
s.split.toggle()         // 折りたたみ切替（アニメーション付き）
s.split.collapsed()      // → true/false 折りたたみ状態の取得
s.split.get_size()       // → number 現在のサイドパネルサイズ (px)
s.split.set_size(300)    // サイズ変更（DOM も即時反映）
```

controlled mode では `collapsed` の値変化でトランジションアニメーションが自動再生される。
`on_collapse_change(新しい値)` は折り畳みボタンのクリック時に発火する。
`toggle()` は controlled 時に `on_collapse_change(!current)` を呼ぶ。

#### create_ui_scroll_pane(opts?)

「最下部（または最上部）追従型のスクロール領域」を実現するファクトリ。チャット UI・ログビューア・メッセージ一覧で、内容が追加されたら自動で端までスクロール、ただしユーザーが途中を見ている間は動かさない、という挙動を宣言的に実現する。

```javascript
s.pane = create_ui_scroll_pane({
  follow:    'bottom',   // 'bottom' | 'top' | 'none'
  threshold: 50,         // 端からこの px 以内なら「追従対象」とみなす
});

// render 内
s.pane({ ctx: [...messages] })

// 強制スクロール
s.pane.scroll_to_bottom();
s.pane.scroll_to_top();
```

render 直前に現在の scrollTop を読んで「端にいるか」を判定し、描画完了（`requestAnimationFrame`）後に端まで scrollTop を更新する。インスタンスは `data-ric-sp` 属性で特定するため、minify 時のクラス短縮の影響を受けない。

### Controlled / Uncontrolled パターン

`create_ui_dialog` と `create_ui_splitter` は **controlled / uncontrolled** の
2 モードを持つ。制御用 prop（`open` / `collapsed`）が `undefined` なら uncontrolled
（内部状態で自動管理）、明示的に渡されたら controlled（外部 state が優先）。

| コンポーネント | 制御 prop | コールバック | uncontrolled 時の動作 |
|---|---|---|---|
| `create_ui_dialog` | `open` | `on_close` | trigger ボタンで開閉 |
| `create_ui_splitter` | `collapsed` | `on_collapse_change` | 折り畳みボタンで開閉 |

設計原則:
- コールバックは「要求の通知」のみ。内部状態は変更しない（親の判断を待つ）。
- アニメーションは prop の変化を検出して自動再生される。
- `inst.close()` / `inst.toggle()` は両モードで動作する
  （controlled 時はコールバックを呼ぶ）。

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

### CSS 変数リファレンス

RicUI が提供する CSS 変数。自作コンポーネントやカスタムスタイルで直接参照でき、テーマ切替時もそのまま追従する。

#### 色

| 変数名 | 用途 |
|---|---|
| `--ric-color-fg` | 前景（本文テキスト） |
| `--ric-color-fg-muted` | 薄い前景（キャプション・プレースホルダ） |
| `--ric-color-bg` | 背景 |
| `--ric-color-border` | 枠線 |
| `--ric-color-control` | 入力欄の背景（input / select / textarea 等） |
| `--ric-color-accent` | アクセント（focus リング・primary ボタン等） |
| `--ric-color-accent-fg` | アクセント背景上の前景（デフォルト `#fff`） |

#### サイズ / 密度

| 変数名 | 用途 |
|---|---|
| `--ric-radius` | 角丸半径 |
| `--ric-gap` | コンポーネント間の標準 gap |
| `--ric-gap-md` | やや大きい gap（page レベルなど） |
| `--ric-pad-x` | 水平方向のパディング |
| `--ric-pad-y` | 垂直方向のパディング |
| `--ric-control-h` | 入力系コントロールの高さ |
| `--ric-font-size` | 基準フォントサイズ（デフォルト 14px） |

#### シャドウ / ブラー

| 変数名 | 用途 |
|---|---|
| `--ric-shadow` | ポップアップ / ダイアログの影 |
| `--ric-panel-shadow` | パネルの控えめな影 |
| `--ric-popup-blur` | ポップアップの backdrop-filter |

#### アニメーション

| 変数名 | 用途 |
|---|---|
| `--ric-duration` | 標準トランジション時間（200ms） |
| `--ric-easing` | 標準イージング（ease） |

#### ツールチップ専用

| 変数名 | 用途 |
|---|---|
| `--ric-tooltip-bg` | ツールチップ背景 |
| `--ric-tooltip-fg` | ツールチップ前景 |

自作コンポーネントは `background: var(--ric-color-bg)` のように直接参照すれば、テーマ切替（`s.page.theme = 'dark'` 等）で自動追従する。`create_theme` / `export_theme` で任意キーを上書きできる。

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
| `'rgb(255,0,0)'` / `'rgba(...)'` | color |
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

#### keys を関数で渡す（動的 keys）

`keys` にオブジェクトの代わりに **関数** を渡すと、毎 render で評価される。
パラメータの値に応じて他の行を `disabled` にする、`options` を切り替える等に使う。

```javascript
s.tw = create_ui_tweak_panel({
  data: params,
  keys: () => ({
    symmetric: {},
    cx_left:  { type: 'range', ...(params.symmetric ? { disabled: true } : {}) },
    cy_left:  { type: 'range', ...(params.symmetric ? { disabled: true } : {}) },
  }),
});
```

関数は `inst()` が呼ばれるたびに実行される。戻り値は通常の keys オブジェクトと
同じ形式（`false` / vdom / options object / folder config）。

ネストしたフォルダ内の `keys` も関数を許容する（全階層で動的評価）:

```javascript
s.tw = create_ui_tweak_panel({
  data: params,
  keys: {
    shape: {
      open: true,
      keys: () => ({
        symmetric: {},
        cx_left:  { type: 'range', ...(params.shape.symmetric ? { disabled: true } : {}) },
        cx_right: { type: 'range', ...(params.shape.symmetric ? { disabled: true } : {}) },
      }),
    },
  },
});
```

---

## 5. Performance & Scale

RicDOM は「state 全体の再評価 + VDOM 差分 patch」モデルで、8KB のコアに収めるため局所 reactive（partial re-render）は持たない。本節では規模が大きくなった時の対処パターンと、現状で測定されている性能レンジを記録する。

### 計測の推奨パターン

```javascript
render(s) {
  const t0 = performance.now();
  // ...前処理...
  const t_prep = performance.now();
  const vdom = /* VDOM 構築 */;
  const t_build = performance.now();
  // ...後処理...
  const t_done = performance.now();

  const log = (window.__render_log ||= []);
  log.push({
    total: (t_done  - t0).toFixed(2),
    prep:  (t_prep  - t0).toFixed(2),
    build: (t_build - t_prep).toFixed(2),
    post:  (t_done  - t_build).toFixed(2),
  });
  if (log.length > 1000) log.shift();
  return vdom;
}

// devtools console で統計を確認
window.render_stats = () => {
  const log = window.__render_log || [];
  if (!log.length) return 'no samples';
  const pct = (xs, p) => {
    const s = xs.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
  };
  return Object.keys(log[0]).map(f => {
    const xs = log.map(r => Number(r[f])).filter(Number.isFinite);
    return {
      field: f, n: xs.length,
      mean: (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2),
      p50:  pct(xs, 0.5).toFixed(2),
      p95:  pct(xs, 0.95).toFixed(2),
      max:  Math.max(...xs).toFixed(2),
    };
  });
};
```

目安: 60fps 予算 16.7ms の **10% 以内（1.7ms）** を維持できていれば体感遅延はほぼ生じない。

### 実アプリの計測例

外部ユーザー（production engineering tool、帰属詳細は非公開）による計測:

**アプリ構成**: SVG ステージ 100+ ノード（path/circle/text）、時系列グラフ 3 本（各 40+ ノード）、tweak_panel 4 フォルダ 18 行、splitter × 2（controlled mode）、toast

**スライダを 100 回連続 mutation した時の内訳（ms、36 サンプル）**:

| phase | mean | p50 | p95 | max |
|---|---|---|---|---|
| total | 1.23 | 1.20 | 1.80 | 2.30 |
| fetch dispatch | 0.23 | 0.20 | 0.30 | 0.40 |
| SVG build_vdom | 0.19 | 0.20 | 0.40 | 0.40 |
| graphs build_vdom × 3 | 0.66 | 0.60 | 0.90 | 1.40 |
| layout tree | 0.14 | 0.10 | 0.40 | 0.40 |

60fps 予算対比: 平均 7.4%、ピーク 14%。スクラブ中の体感遅延なし。

### 規模が拡大した時の対処パターン

#### パターン 1: 重い計算結果を `s.ignore` にキャッシュ

`s.ignore` 以下は Proxy の再描画トリガーから除外される。重い derive 結果を保持しつつ、state 汚染を避けられる。

```javascript
render(s) {
  // shape key が変わったときだけ再計算
  const key = `${s.shape.n}-${s.shape.cd}`;
  if (s.ignore.shape_key !== key) {
    s.ignore.shape_key = key;
    s.ignore.geometry = expensive_compute(s.shape);
  }
  return build_vdom(s.ignore.geometry);
}
```

#### パターン 2: ユーザーランド memoize（参考実装）

```javascript
// 30 行の最小メモ化ヘルパ（ユーザーランドで書ける）
const create_memo = (build, key_of) => {
  let cache = { key: Symbol(), vdom: null };
  return (input) => {
    const key = key_of(input);
    if (cache.key === key) return cache.vdom;
    cache = { key, vdom: build(input) };
    return cache.vdom;
  };
};

// 使い方
const build_stage = create_memo(
  (shape) => build_stage_vdom(shape),
  (shape) => `${shape.n}-${shape.cd}-${shape.cx}-${shape.cy}`,
);
render(s) {
  return { tag: 'div', ctx: [build_stage(s.shape), /* ... */] };
}
```

公式 API として `create_ui_memo` を用意するかは需要を見て検討（現時点では未定）。

#### パターン 3: コード分割のための独立 `create_RicDOM`（共有 state）

コードを複数ファイルに分けたいとき、mount point を ref で確保してそこに別 instance を生成する:

```javascript
const state = { title: 'Hello', /* ... */ };
state.render = (s) => ({
  tag: 'div', ctx: [
    { tag: 'header', ctx: [`${s.title}`] },
    { tag: 'div',    ref: 'main_mount' },   // ctx 省略 → child が保持される
  ],
});
const parent = create_RicDOM('#app', state);
// 別ファイルから、同じ state を共有する child を生成
const child = create_RicDOM(parent.refs.get('main_mount'), state);
child.render = render_main;
```

**重要**: 共有 state の mutation は **全 instance が再描画される**（subscriber set が共有されるため）。コード分離の目的には使えるが、**局所 re-render にはならない**。

#### パターン 4: 真の局所 re-render（独立 state、手動同期）

各 instance が独立 state を持てば、mutation はその instance だけで閉じる:

```javascript
const a = create_RicDOM('#mount-a', { counter: 0, render: render_a });
const b = create_RicDOM('#mount-b', { counter: 0, render: render_b });

a.counter = 1;   // a だけ再描画
b.counter = 1;   // b だけ再描画
```

親子間でデータを同期したい場合は親の render で子のハンドルに書き込む:

```javascript
const child = create_RicDOM('#child', { shared: null, render: render_child });
create_RicDOM('#parent', {
  value: 0,
  render(s) {
    child.shared = s.value;   // 親の state 変更 → 子の state 変更 → 子が再描画
    return { /* 親の VDOM */ };
  }
});
```

### 局所 reactive 用の公式 API（`create_ui_panel` 等）について

現時点では **用意していない**。理由:

- 上記のパターンで大半のユースケースをカバーできる
- コアを 8KB に保つため、optimization API はユーザーランド / RicUI 側で書く方針
- 計測データが示す通り、実アプリで render 評価自体がボトルネックになるケースは稀（1.23ms / SVG 100+ ノード規模）

需要が積み上がってきたら改めて設計する。

---

## 6. コーディング規約

- `var` 禁止、`const` 最大限、`let` 最小限
- `class` 構文不使用、ファクトリ関数パターンで統一
- CommonJS（`require` / `module.exports`）、ESM 不使用
- 命名はスネークケース（例外: `create_RicDOM`）
- エラーは `console.error()` + graceful return（throw しない）
- `NOOP_PROXY` 返却でエラー連鎖を防止
- コメントは日本語・多め
- テスト: `node:test` + jsdom

---

## 7. ビルド

```bash
npm run build        # 全バンドル
npm run build:core   # RicDOM.min.js
npm run build:ui     # RicUI.min.js（調整パネル含む）
npm test             # 575 テスト
```

esbuild でバンドル + minify。`--platform=browser`。
CSS はテンプレートリテラル内に定義（コメント除去済み）。
