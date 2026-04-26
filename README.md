# RicDOM

Electron・社内ツール・IoT デバイス UI 向け。JSON で書く 8KB の軽量 DOM ライブラリ。

| レイヤー | サイズ | 役割 |
|---------|------:|------|
| **RicDOM** | 8KB | コア — JSON → DOM 差分更新 + Proxy リアクティビティ |
| **RicUI** | 59KB | 部品集 — CSS 変数テーマ + ボタン・ポップアップ・スプリッター + 調整パネル |

Virtual DOM を持たず、JSON オブジェクトの差分から実 DOM を直接パッチします。
Electron やブラウザで、リアルタイムなダッシュボード・パラメータ調整 UI・データ可視化ツールを素早く構築できます。

### React / Vue と何が違うか

- **ビルド不要** — `<script>` タグ 1 つで動く。webpack / Vite / JSX 不要
- **学習コスト最小** — `create_RicDOM(target, { render(s){...} })` の 2 引数だけ
- **IME / フォーカスを壊さない** — Virtual DOM の再構築がないため、input 入力中に日本語変換が途切れない
- **対象** — Electron アプリ、社内ツール、プロトタイプ、パラメータ調整 UI。大規模 SPA には向かない

## 特徴

- **JSON 記述** — `{ tag: 'div', ctx: [...] }` の plain object で UI を定義
- **Virtual DOM なし** — JSON 差分 → 実 DOM を直接パッチ（input フォーカスや IME を壊さない）
- **Proxy 自動追跡** — state への代入で自動再描画（トップレベル＋一段目まで）
- **極小バンドル** — RicDOM コア 8KB / RicUI 59KB（minified、個別読み込み）
- **学習コスト最小** — `create_RicDOM(target, { render(s){...} })` の 2 引数だけ覚えればよい

## 設計思想 — 心・技・体

### 1. 指標より体験

RicDOM は「React より 3ms 速い」「bundle size 最小」を競いません。それは Goodhart の法則の罠に陥りやすく、数字を追い求めた結果、肝心の価値 — 書き味・軽やかさ・できることの広がり — を失うと考えているからです。

そのため価値軸を**心・技・体**で捉えます：

- **心（感動）** — `s.count = 5` で動く直感性、JSON が UI になる美しさ
- **技（できる）** — 実 DOM を直接操作、テーマ × 密度、Electron / ブラウザ両対応
- **体（快適・軽やか）** — IME を壊さない、ビルド不要、学習コスト低

ちなみにコア 8KB という数字も目的ではなく、「ビルド不要で `<script>` タグ 1 つで動く」を成立させるための**結果**です。機能追加のために 12KB になる方が価値があるなら、そうします。

### 2. やらないこと（反 road map）

以下は、ユーザーから要望が来ても原則 RicDOM には入れません：

- **Virtual DOM** — 「IME を壊さない」の根本が失われる
- **SSR / SEO 最適化** — 苦手領域を無理に取りに行くと設計が歪む
- **競合との機能比較ベンチマーク** — 数字競争の土俵に乗らない
- **破壊的な大規模 API 刷新** — v0.3.x の書き方が v1 でも動くことを守る

### 3. 新機能の判断基準

PR / 要望を評価するとき、こう問います：

> この機能を入れて、**心・技・体のどれかが育つか？**

育たない機能（数字は良くなるが体験は変わらない）は、入れません。
既存のテストを通すためだけの機能、競合との差別化のためだけの機能は、断ります。

## 対応環境

- **推奨**: Chrome / Edge 135+、Electron 35+
- **動作確認済み**: Firefox 128+、Safari 17.4+（`ui_select` のカスタム表示は Chrome 系のみ。他ブラウザではネイティブ `<select>` にフォールバック）
- **非対応**: IE（`Proxy` 必須のため）

## クイックスタート

### インストール

npm パッケージとしては公開していません。
このリポジトリの `docs/` にあるビルド済みファイル（`RicDOM.min.js` / `RicUI.min.js`）を
プロジェクトにコピーして `<script>` タグで読み込んでください。
まずは `RicDOM.min.js` だけで試し、必要になったら RicUI を追加するのがおすすめです。

```html
<script src="RicDOM.min.js"></script>
<script src="RicUI.min.js"></script>  <!-- コンポーネント集 + 調整パネル（任意） -->
```

| バンドル | サイズ | 内容 |
|---------|------:|------|
| `RicDOM.min.js` | 8KB | コア（必須） |
| `RicUI.min.js` | 59KB | UI コンポーネント集 + パラメータ調整パネル |

### Hello World（RicDOM のみ）

```html
<div id="app"></div>
<script>
const { create_RicDOM } = RicDOM;

create_RicDOM('#app', {
  name: '',
  render(s) {
    return {
      tag: 'div',
      ctx: [
        { tag: 'h3', ctx: ['はじめまして'] },
        { tag: 'input',
          type: 'text', placeholder: '名前…',
          value: s.name,
          oninput: (e) => { s.name = e.target.value; },
        },
        s.name
          ? { tag: 'p', ctx: [`こんにちは、${s.name}さん！`] }
          : { tag: 'p', style: 'color:#aaa', ctx: ['（名前を入力してください）'] },
      ],
    };
  },
});
</script>
```

### Hello World（RicUI 使用）

RicUI では `create_RicDOM('#app', state)` でハンドルを作り、`s.render` を後から設定します。
popup や dialog のファクトリを render の外で初期化できるため、コードの見通しが良くなります。

```javascript
const { create_RicDOM } = RicDOM;
const { create_ui_page, ui_panel, ui_text, bind_input } = RicUI;

const s = create_RicDOM('#app', { name: '' });

// UI
s.page = create_ui_page({ theme: 'light' });

// render
s.render = (s) => s.page({
  ctx: [
    ui_panel({ ctx: [
      ui_text({ variant: 'title', ctx: ['はじめまして'] }),
      bind_input(s, 'name', { placeholder: '名前…' }),
      s.name
        ? ui_text({ ctx: [`こんにちは、${s.name}さん！`] })
        : ui_text({ variant: 'muted', ctx: ['（名前を入力してください）'] }),
    ]}),
  ],
});
```

### Hello World（RicUI コンパクト記法）

state・ファクトリ・render を1つのオブジェクトにまとめると、より簡潔に書けます。
サンプルコードはすべてこの記法で書かれています。

```javascript
const { create_RicDOM } = RicDOM;
const { create_ui_page, ui_panel, ui_text, bind_input } = RicUI;

create_RicDOM('#app', {
  name: '',

  // UI
  page: create_ui_page({ theme: 'light' }),

  // render
  render: (s) => s.page({ ctx: [
    ui_panel({ ctx: [
      ui_text({ variant: 'title', ctx: ['はじめまして'] }),
      bind_input(s, 'name', { placeholder: '名前…' }),
      s.name
        ? ui_text({ ctx: [`こんにちは、${s.name}さん！`] })
        : ui_text({ variant: 'muted', ctx: ['（名前を入力してください）'] }),
    ]}),
  ]}),
});
```


## 基本コンセプト

### 基本パターン

```javascript
create_RicDOM(
  '#app',                    // ① マウント先（CSS セレクタ or HTMLElement）
  {                          // ② state + render を1つのオブジェクトで渡す
    count: 0,
    render(s) {
      return {
        tag: 'button',
        ctx: [`Count: ${s.count}`],
        onclick: () => { s.count++; },
      };
    },
  }
);
```

`render` は後から設定することもできます:

```javascript
const handle = create_RicDOM('#app', { count: 0 });
handle.render = (s) => ({
  tag: 'button',
  ctx: [`Count: ${s.count}`],
  onclick: () => { s.count++; },
});
```

- **state** に代入すると自動で再描画（`s.count++` → UI 更新）
- **描画関数** は毎回 JSON ツリーを返す。RicDOM が前回との差分を検出し、変更箇所だけ DOM を更新する
- **handle** から `refs`（DOM 参照の Map）にアクセス可能

### JSON ツリー構造

```javascript
{
  tag: 'div',                           // HTML タグ名
  class: 'my-class',                    // class 属性
  style: { color: 'red', gap: '8px' },  // インラインスタイル
  ctx: [ ... ],                         // 子要素（配列 or 単体）
  onclick: () => { ... },               // イベントハンドラ
  ref: 'myRef',                         // DOM 参照名（handle.refs で取得）
}
```

### state 更新のルール

```javascript
// ✅ トップレベル代入 → 再描画される
s.count = 10;
s.tasks = [...s.tasks, newTask];

// ✅ 一段目のプロパティ代入 → 再描画される
s.page.theme = 'dark';
s.dark.density = 'compact';

// ❌ 二段目以降のネスト変更 → 再描画されない
s.user.address.city = 'Tokyo';

// 🔒 s.ignore 以下は再描画をトリガーしない（内部キャッシュ用）
s.ignore.cache = someData;
```

## RicUI コンポーネント

RicUI は RicDOM の上に構築された CSS 変数ベースのコンポーネント集です。

### テーマ

5 種類の組み込みテーマ。

| テーマ | 説明 |
|--------|------|
| `light` | 明るい背景、青アクセント（デフォルト） |
| `dark` | 暗い背景、明るい青アクセント |
| `teal` | 明るい背景、ティール/緑アクセント |
| `cyber` | グラスモーフィズム、ネオンシアン |
| `aqua` | グラスモーフィズム、水滴/ブルー |

密度（`comfortable` / `compact` / `tight`）とフォントサイズ（`sm` / `md` / `lg`）も切替可能。

### create_ui_page — テーマの入口

`create_ui_page()` で page ファクトリを作り、`s` のトップレベルに格納する。
テーマ・密度・フォントサイズをプロパティとして持ち、代入で動的に変更できる。

```javascript
s.page = create_ui_page({ theme: 'teal', density: 'comfortable' });

// 設定変更 → 自動再描画
s.page.theme    = 'dark';
s.page.density  = 'compact';
s.page.font_size = 'lg';

// 描画
return s.page({ ctx: [...] });
```

### create_ui_panel — セクションの区切り

背景・ボーダー付きのコンテナ。page とは別のテーマを指定できる。
`disabled` で操作を無効化（`inert` 属性で Tab フォーカスも遮断）。

```javascript
s.dark = create_ui_panel({ theme: 'dark', density: 'compact' });

// 設定変更 → 自動再描画
s.dark.disabled = true;

// 描画
return s.dark({ ctx: [...] })
```

### Layout と Surface の使い分け

```
create_ui_page ─ テーマの入口。CSS 変数を注入する
│
├─ ui_col ─── 縦に並べる（透明、padding なし）
├─ ui_row ─── 横に並べる（透明、padding なし）
│
└─ create_ui_panel ─ 背景 + ボーダー。テーマ上書き・disabled 対応
```

| 関数 | 背景 | ボーダー | padding | 用途 |
|------|:----:|:-------:|:-------:|------|
| `create_ui_page` | 有 | — | 標準 | テーマの入口（最外層に1つ） |
| `ui_col` | — | — | — | 縦に並べる（純レイアウト） |
| `ui_row` | — | — | — | 横に並べる（純レイアウト） |
| `create_ui_panel` | 有 | 有 | 標準 | セクションの区切り |

### コンポーネント一覧

すべての `ui_xxx` コンポーネントは、表に記載の引数に加えて任意の DOM 属性
（`onclick` / `id` / `data-*` / `aria-*` / `style` / `class`）を**外側要素に透過**します。
`class` は基底クラスの後ろに自動連結されます（例: `ui_button({ class: 'my' }).class` → `"ric-button my"`）。
詳細は [SPEC.md の rest スプレッド契約](SPEC.md#任意属性の透過rest-スプレッド契約) を参照。

```javascript
ui_button({ ctx: ['Save'], onclick: save, id: 'save-btn', 'data-role': 'primary' }),
ui_panel({ id: 'main', onmouseenter: hover, ctx: [...] }),
```

#### Control

| 関数 | 説明 |
|------|------|
| `ui_button({ ctx, variant, onclick })` | ボタン（variant: `default` / `primary` / `ghost`） |
| `ui_input({ value, oninput, placeholder })` | テキスト入力 |
| `bind_input(s, key, options)` | state と双方向バインドされた input |
| `ui_textarea({ value, oninput, auto_resize })` | 複数行入力。`auto_resize: { min_rows, max_rows }` で高さ自動調整 |
| `bind_textarea(s, key, options)` | state と双方向バインドされた textarea |
| `ui_checkbox({ checked, onchange })` | チェックボックス |
| `bind_checkbox(s, key, options)` | state と双方向バインドされた checkbox |
| `ui_radiobutton({ name, value, options })` | ラジオボタングループ |
| `bind_radiobutton(s, key, options)` | state と双方向バインドされた radiobutton |
| `ui_select({ value, options, onchange })` | セレクトボックス |
| `bind_select(s, key, options)` | state と双方向バインドされた select |
| `ui_range({ value, min, max, step })` | スライダー（値表示付き） |
| `bind_range(s, key, options)` | state と双方向バインドされた range |
| `ui_color({ value, oninput })` | カラーピッカー（hex/rgba 自動判定） |
| `bind_color(s, key, options)` | state と双方向バインドされた color |
| `ui_separator()` | 水平区切り線 |
| `focus_when(el, cond)` | `cond` の立ち上がりエッジで `el.focus()`。`render(s)` の `s` には `refs` が無いため、`el` は `handle.refs.get('name')` を closure で渡す（TUTORIAL FAQ 参照） |

#### Text

| 関数 | 説明 |
|------|------|
| `ui_text({ ctx, variant })` | テキスト |
| `ui_code_pre({ ctx, obj, lang })` | コードブロック |
| `ui_md_pre({ ctx })` | Markdown → VDOM 変換 |

`ui_text` の variant：

| variant | 説明 | HTMLタグ |
|---------|------|---------|
| `default` | 本文テキスト | `<span>` |
| `muted` | 薄いテキスト | `<span>` |
| `title` | 見出し（太字・大） | `<h2>` |
| `label` | ラベル（小・セミボールド） | `<label>` |

#### Popup（ファクトリ関数）

`s` のトップレベルに格納する。内部状態（開閉・位置等）は自動管理される。

```javascript
s.dd  = create_ui_popup();
s.dlg = create_ui_dialog();
s.tip = create_ui_tooltip();

// ラベル付き（旧 dropdown）
s.dd({ label: '選択肢', ctx: [...] })

// アイコン（旧 menu）— label も icon も省略すると ≡
s.menu({ icon: '⚙', ctx: [...] })

// ghost: ホバーまで枠を隠す
s.cfg({ icon: '⋯', ghost: true, ctx: [...] })

// ダイアログ（trigger_variant / title / actions でカスタマイズ）
s.dlg({ trigger_ctx: ['開く'], title: '確認', ctx: [...],
        actions: [ui_button({ ctx: ['OK'], onclick: () => s.dlg.close() })] })

// ダイアログ（controlled — 外部 state で開閉を管理）
s.dlg({ open: s.page.show_dlg, on_close: () => { s.page.show_dlg = false; },
        title: '確認', ctx: [...] })
// → 戻り値 null（トリガーボタンなし）。ESC キーでも on_close が発火する。

// トースト通知（render 内で s.toast() を呼び、任意のタイミングで show）
s.toast = create_ui_toast();
s.toast.show('保存しました', { type: 'success', duration: 3000 });
```

| 関数 | 説明 | 公開メソッド |
|------|------|------|
| `create_ui_popup()` | 汎用ポップアップ（label / icon / ghost） | `inst.close()` |
| `create_ui_tooltip()` | ツールチップ | — |
| `create_ui_dialog()` | モーダルダイアログ | `inst.close()` / `inst.open()` |
| `create_ui_toast()` | トースト通知 | `inst.show(msg, opts)` |

全て引数なし。popup の排他制御（1つ開くと他を閉じる）は自動管理。
呼び出し時に `theme` / `density` / `font_size` を渡すとポータル要素のテーマを個別に上書きできる。

#### Composite

| 関数 | 説明 | 公開メソッド |
|------|------|------|
| `create_ui_accordion(options)` | アコーディオン（折りたたみ） | — |
| `ui_tabs({ items, active, onchange })` | タブナビゲーション | — |
| `bind_tabs(s, key, options)` | state とバインドされた tabs | — |
| `create_ui_splitter(options)` | ドラッグ可能なペイン分割 | `toggle()` / `collapsed()` / `get_size()` / `set_size(px)` |
| `create_ui_scroll_pane(options)` | 追従型スクロール領域（チャット UI 等） | `scroll_to_bottom()` / `scroll_to_top()` |

### 3 種類のコンポーネントパターン

| パターン | 内部状態 | 用途 |
|---------|:-------:|------|
| `ui_xxx()` | なし | 純粋な描画（ボタン、テキスト等） |
| `bind_xxx(s, key)` | なし | `ui_xxx` + state 双方向バインドのショートカット |
| `create_ui_xxx()` | **あり** | 開閉・テーマ・位置等の内部状態を持つ部品。dialog / splitter は controlled mode（外部 state 管理）にも対応 |

`create_ui_xxx()` の戻り値は `s` のトップレベルに格納する：

```javascript
// ✅ 正しい — s のトップレベルに格納
s.dd  = create_ui_popup();
s.acc = create_ui_accordion({ default_open: { q1: true } });
```

## パラメータ調整パネル（ui_tweak）

dat.GUI / Tweakpane ライクなパラメータ調整パネル。任意の JavaScript オブジェクトのプロパティをリアルタイムに操作できる。RicUI に統合されているため追加の読み込みは不要。

3 段階の使い方:

### Tier 1: data を渡すだけで全自動 GUI

```javascript
const { create_ui_tweak_panel } = RicUI;

const params = {
  speed: 50,
  color: '#e11d48',
  wireframe: false,
  settings: { volume: 80, mute: false },
};

// data だけ渡せば値の型から自動推論して GUI 化
s.tw = create_ui_tweak_panel({ data: params });
return s.page({ ctx: [ s.tw() ] });
```

| 値 | → 自動推論 |
|----|-----------|
| `boolean` | checkbox |
| `number` | number input |
| `'Hello'` | text input |
| `'#e11d48'` | color picker（hex 検出） |
| `'rgb(255,0,0)'` | color picker（rgb/rgba/hsl/hsla 検出） |
| `{ ... }` (plain object) | folder（再帰展開） |
| `[...]` / その他 | JSON preview |

### Tier 2: keys で部分的に上書き

```javascript
s.tw = create_ui_tweak_panel({
  title: 'Settings',
  data: params,
  keys: {
    speed: { type: 'range', min: 0, max: 100 },
    color: { type: 'color' },
    secret: false,  // この行は非表示
    settings: { open: true, keys: {
      volume: { type: 'range', min: 0, max: 100 },
    }},
  },
});
```

`keys` にはオブジェクトの代わりに関数を渡せます。毎描画で評価されるため、
パラメータの値に応じた動的な `disabled` / `options` 切り替え等が可能です。
ネストしたフォルダ内の `keys` も関数を許容します（全階層で動的評価）。

```javascript
keys: () => ({
  symmetric: {},
  cx: { type: 'range', ...(params.symmetric ? { disabled: true } : {}) },
}),
```

### Tier 3: 自由な vdom で組み立て

```javascript
const { ui_tweak_panel, ui_tweak_folder, ui_tweak_row, ui_button } = RicUI;

ui_tweak_panel({
  title: 'Custom Editor',
  ctx: [
    ui_tweak_folder({ label: 'Colors', open: true, ctx: [
      ui_tweak_row({ label: 'fg', get: () => t.fg, set: (v) => { t.fg = v; } }),
    ]}),
    ui_button({ ctx: ['Save'], onclick: save }),
  ],
})
```


## サンプル

`docs/samples/` にサンプルを同梱。

| ファイル | 内容 |
|---------|------|
| `00_hello.html` | RicDOM 生 vs RicUI の比較（最小例） |
| `01_forms.html` | フォーム入力パターン |
| `02_controls.html` | ラジオ・セレクト・ドロップダウン |
| `03_popup.html` | ポップアップ・ツールチップ |
| `04_accordion_dialog.html` | ダイアログ・トースト |
| `05_toast_accordion.html` | アコーディオン |
| `06_splitter.html` | ペイン分割（4方向） |
| `07_tweak_splitter.html` | 調整パネル + スプリッター |
| `08_tweak_menu.html` | 調整パネル + ポップアップメニュー |
| `09_json_editor.html` | JSON エディタ |
| `10_theme_studio.html` | テーマエディタ（CSS 変数見える化 + JSON 保存/読込） |
| `11_theme_override.html` | テーマ上書き・全コンポーネント比較 |
| `12_md_viewer.html` | Markdown ビューア（`ui_md_pre`） |
| `13_controlled_dialog_splitter.html` | controlled mode（外部 state で開閉管理）|
| `15_ai_chat.html` | AI チャット UI（自動スクロール + textarea + ストリーミング）|
| `16_svg_editor.html` | SVG ツリーエディタ（rect / circle / path のドラッグ編集）|

ローカルで確認するには、お好みの静的サーバーで `docs/` を配信してください。例:

```bash
npx http-server docs -p 8080
# または
python -m http.server 8080 --directory docs
```

## ビルド

```bash
npm install
npm run build        # 全バンドルをビルド
npm run build:core   # RicDOM.min.js のみ
npm run build:ui     # RicUI.min.js のみ（調整パネル含む）
npm test             # テスト実行
```

## 上級者向け（非推奨 API）

通常は不要ですが、`_internal` 経由で低レベル操作にアクセスできます。

### インスタンスの破棄

SPA で画面を動的に切り替える場合など、購読やスタイルタグを手動でクリーンアップしたいとき。
通常のページ遷移やタブを閉じる場合は GC が処理するため不要。

```javascript
const s = create_RicDOM('#app', {
  count: 0,
  render: s => ({ tag: 'div', ctx: [`${s.count}`] }),
});

// 内部の購読解除・style タグ削除を実行
s._internal.destroy();
```

### 強制再描画

ネストしたプロパティを直接変更した場合の回避策。
正しい方法はトップレベル再代入（`s.user = { ...s.user, name: 'Taro' }`）なので、
通常はこの API を使う必要はない。

```javascript
// 非推奨：ネスト変更 + 強制再描画
s.user.name = 'Taro';
s._internal.force_render();

// 推奨：トップレベル再代入（自動で再描画される）
s.user = { ...s.user, name: 'Taro' };
```

## ライセンス

非商用は MIT、商用は要相談です。詳細は [LICENSE](./LICENSE) を参照してください。

| 用途 | ライセンス |
|------|:----:|
| 個人の学習・研究・趣味プロジェクト | **MIT** |
| OSS 開発（非商用） | **MIT** |
| 社内ツール・業務効率化（収益を直接生まない） | **MIT** |
| 受託開発・SaaS・商用製品への組み込み | **要相談** |
| 広告収益のあるサイトやアプリ | **要相談** |

「要相談」は禁止ではありません。用途と規模を添えてご連絡ください。
連絡先: info@miyoshi-seisakusyo.jp
