# RicDOM チュートリアル

Electron・社内ツール・パラメータ調整 UI 向けの軽量 DOM ライブラリ「RicDOM」を
ゼロから使えるようになるチュートリアルです。

**所要時間**: 15 分
**前提知識**: HTML と JavaScript の基礎（DOM 操作の経験があるとスムーズ）
**必要なもの**: テキストエディタ + ブラウザ

---

## 1. 準備 — ファイルを置いて動かす

RicDOM はビルドツール不要。HTML ファイルと `.min.js` だけで動きます。

```
my-project/
  index.html
  RicDOM.min.js   ← docs/ からコピー
  RicUI.min.js    ← docs/ からコピー（任意）
```

`index.html` を作成します:

```html
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>RicDOM Tutorial</title></head>
<body>
<div id="app"></div>
<script src="RicDOM.min.js"></script>
<script>
const { create_RicDOM } = RicDOM;

create_RicDOM('#app', {
  render(s) {
    return { tag: 'h2', ctx: ['Hello, RicDOM!'] };
  },
});
</script>
</body>
</html>
```

ブラウザで開いて「Hello, RicDOM!」と表示されれば成功です。

> **ポイント**: `create_RicDOM` の引数は 2 つだけ。
> ① マウント先（CSS セレクタ）、② state + render のオブジェクト。
> これが RicDOM の全てです。

---

## 2. JSON で UI を書く

RicDOM では HTML タグを JSON オブジェクトで表現します。

```javascript
// HTML: <div class="card"><h3>タイトル</h3><p>本文</p></div>
// ↓ RicDOM の書き方:
{
  tag: 'div',
  class: 'card',
  ctx: [
    { tag: 'h3', ctx: ['タイトル'] },
    { tag: 'p',  ctx: ['本文'] },
  ],
}
```

| プロパティ | 意味 | 例 |
|-----------|------|-----|
| `tag` | HTML タグ名 | `'div'`, `'button'`, `'input'` |
| `ctx` | 子要素（配列） | `['テキスト']`, `[{ tag: 'span', ... }]` |
| `class` | CSS クラス | `'card'`, `['card', 'active']` |
| `style` | インラインスタイル | `{ color: 'red', gap: '8px' }` |
| `onclick` 等 | イベントハンドラ | `(e) => { ... }` |

`ctx` は "contents" の略で、そのタグの中身です。
文字列を入れればテキスト、オブジェクトを入れれば子要素になります。

---

## 3. state を変えると画面が変わる

RicDOM の核心は「**state に代入するだけで自動再描画**」です。

```html
<div id="app"></div>
<script src="RicDOM.min.js"></script>
<script>
const { create_RicDOM } = RicDOM;

create_RicDOM('#app', {
  count: 0,                          // ← これが state
  render(s) {
    return {
      tag: 'div', ctx: [
        { tag: 'h3', ctx: [`カウント: ${s.count}`] },
        { tag: 'button', ctx: ['＋1'],
          onclick: () => { s.count++; },        // ← 代入で再描画
        },
        { tag: 'button', ctx: ['リセット'],
          onclick: () => { s.count = 0; },
        },
      ],
    };
  },
});
</script>
```

`s.count++` と書くだけで、RicDOM が自動的に画面を更新します。
`render(s)` が返す JSON と前回の JSON を比較して、変わった箇所だけ DOM をパッチします。

> **重要ルール**:
> - `s.count = 10` — トップレベル代入 → **再描画される**
> - `s.page.theme = 'dark'` — 一段目のプロパティ代入 → **再描画される**
> - `s.user.address.city = 'Tokyo'` — 二段目以降 → **再描画されない**
>
> 深いネストを更新したいときは `s.user = { ...s.user, address: { ...s.user.address, city: 'Tokyo' } }` のようにトップレベルで再代入してください。

---

## 4. テキスト入力を繋げる

input 要素も JSON で書けます。`value` と `oninput` を繋げれば双方向バインドです。

```javascript
create_RicDOM('#app', {
  name: '',
  render(s) {
    return {
      tag: 'div', ctx: [
        { tag: 'input',
          type: 'text',
          placeholder: '名前を入力…',
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
```

> **IME が途切れない**: RicDOM は Virtual DOM を使わないため、
> 日本語入力中に変換が途切れることがありません。これが React 等との大きな違いです。

ここまでが RicDOM コアの基本です。
次のステップからは RicUI を使って、見た目と開発効率を一気に上げます。

---

## 5. RicUI で見た目を整える

`RicUI.min.js` を追加で読み込むと、テーマ付きの UI コンポーネントが使えます。

```html
<div id="app"></div>
<script src="RicDOM.min.js"></script>
<script src="RicUI.min.js"></script>
<script>
const { create_RicDOM } = RicDOM;
const { create_ui_page, ui_panel, ui_text, bind_input } = RicUI;

create_RicDOM('#app', {
  name: '',
  page: create_ui_page({ theme: 'light' }),

  render(s) {
    return s.page({ ctx: [
      ui_panel({ ctx: [
        ui_text({ variant: 'title', ctx: ['はじめまして'] }),
        bind_input(s, 'name', { placeholder: '名前…' }),
        s.name
          ? ui_text({ ctx: [`こんにちは、${s.name}さん！`] })
          : ui_text({ variant: 'muted', ctx: ['（名前を入力してください）'] }),
      ]}),
    ]});
  },
});
</script>
```

ステップ 4 と同じ機能ですが、見た目がまったく違うはずです。

**何が起きているか:**

1. `create_ui_page({ theme: 'light' })` — テーマを持つ page ファクトリを作る
2. `s.page = ...` — state のトップレベルに格納する（これが重要）
3. `s.page({ ctx: [...] })` — render 内で呼ぶと、テーマ CSS + 子要素の vdom が返る
4. `bind_input(s, 'name', ...)` — `s.name` と input を自動で双方向バインド

> **テーマを変えてみよう**: `'light'` を `'dark'`、`'teal'`、`'cyber'`、`'aqua'` に変えて
> ブラウザをリロードしてみてください。コード変更なしで見た目が切り替わります。

### なぜ `s.page({ ctx: [...] })` と書くのか

初見だと `s.page({ ctx: [...] })` という書き方に驚くかもしれません。React の
`<Page>...</Page>` や Vue の `<template>` とは違う見た目ですが、理由はシンプルです。

- RicDOM は **ビルドツール不要** が最優先。JSX やテンプレートはトランスパイラが必要
- `s.page` は **ただの関数** — 呼ぶと JSON（VDOM ノード）を返す
- `{ tag: 'div', class: 'ric-page', ctx: [...] }` のような JSON を手書きする代わりに、
  関数が内部状態（テーマ・密度等）を含めて組み立ててくれる

つまり `s.page({ ctx: [...] })` は「page 関数に子要素を渡して、完成した JSON を受け取る」
だけです。JSX の `<Page>` に相当するものが、ビルドなしで動く関数呼び出しになっている
と考えてください。

```javascript
// これと同じことを手書きすると…
return {
  tag: 'div', class: 'ric-page',
  style: '--ric-color-bg:#f9fafb; --ric-color-fg:#111318; ...',
  ctx: [
    { tag: 'style', ctx: ['.ric-page { ... } .ric-button { ... }'] },
    // ...子要素
  ],
};

// s.page() が全部やってくれる
return s.page({ ctx: [/* 子要素だけ書けばいい */] });
```

他の `create_ui_xxx()` 系（`create_ui_popup` / `create_ui_dialog` / `create_ui_splitter` 等）
もすべて同じパターンです。`s` のトップレベルに格納し、render 内で関数として呼びます。

### テーマの動的切替

テーマはプログラムからも変更できます:

```javascript
// ボタンクリックでテーマを切替
ui_button({ ctx: ['ダークモード'], onclick: () => { s.page.theme = 'dark'; } }),
```

`s.page.theme = 'dark'` と代入するだけで、画面全体が即座に再描画されます。

### DOM 属性を自由に付与する

`ui_xxx` コンポーネントには、表に載っている引数のほかに任意の DOM 属性を
そのまま渡せます。`id` / `data-*` / `aria-*` / `onclick` / `class` などが
外側要素に透過されます。

```javascript
ui_button({
  ctx: ['保存'],
  onclick: save,
  id: 'save-btn',            // ← id が button 要素に付く
  'data-action': 'save',     // ← data-* 属性も透過
  'aria-label': 'Save file', // ← アクセシビリティ属性
  class: 'emphasized',       // ← 基底クラス ric-button の後ろに連結
}),

ui_panel({
  id: 'main',
  onmouseenter: () => { console.log('hover'); },
  ctx: [ /* ... */ ],
}),
```

`class` を指定しても `ric-button` 等の基底クラスは消えず、後ろに連結される
ので、テーマスタイルを壊さずにクラスを追加できます。

また、`ui_checkbox` / `ui_range` / `ui_color` のように内部に `<input>` を
持つコンポーネントでは、`onchange` や `value` は内部 input にだけ掛かり、
外側の要素には漏れません。そのため、これらのコンポーネントに `id` や
`onclick` を付けても、イベントハンドラが混線する心配はありません。

---

## 6. JSON を投げるだけで調整パネルを作る

RicDOM の最大の売り: **JavaScript オブジェクトを渡すだけで GUI が自動生成**されます。

```html
<div id="app"></div>
<script src="RicDOM.min.js"></script>
<script src="RicUI.min.js"></script>
<script>
const { create_RicDOM } = RicDOM;
const { create_ui_page, create_ui_tweak_panel, ui_code_pre } = RicUI;

// ← このオブジェクトを GUI 化する
const params = {
  speed: 5,
  color: '#e11d48',
  wireframe: false,
};

create_RicDOM('#app', {
  params,
  page: create_ui_page({ theme: 'light' }),
  tw: create_ui_tweak_panel({ data: params }),

  render(s) {
    return s.page({ ctx: [
      s.tw(),                          // ← 調整パネル（自動生成）
      ui_code_pre({ obj: s.params }),  // ← リアルタイムで値を確認
    ]});
  },
});
</script>
```

`create_ui_tweak_panel({ data: params })` に渡すだけで:
- `speed` (number) → 数値入力
- `color` ('#e11d48') → カラーピッカー
- `wireframe` (boolean) → チェックボックス

が自動で生成されます。値を変えると `params` が直接書き換わり、画面も更新されます。

### もう少し細かく指定する（keys による上書き）

自動推論だけでは足りない場合、`keys` で一部だけ上書きできます:

```javascript
s.tw = create_ui_tweak_panel({
  data: params,
  keys: {
    speed: { type: 'range', min: 1, max: 10, step: 0.5 },  // スライダーに変更
  },
});
```

ネストしたオブジェクトは自動で折り畳みフォルダになります:

```javascript
const params = {
  character: { name: 'Hero', hp: 100 },
  physics:   { speed: 5, gravity: 9.8 },
};
// → character フォルダと physics フォルダが自動生成される
s.tw = create_ui_tweak_panel({ data: params });
```

> **サンプル**: より完全な例は `docs/samples/07_tweak_splitter.html` を参照してください。

---

## 7. ポップアップとダイアログ

ここからは RicUI の「ファクトリ関数」パターンを学びます。
popup や dialog のように**開閉状態を持つ部品**は `create_ui_xxx()` で作り、
**state のトップレベルに格納**します。

```javascript
const { create_RicDOM } = RicDOM;
const { create_ui_page, create_ui_popup, create_ui_dialog,
        ui_panel, ui_text, ui_button } = RicUI;

create_RicDOM('#app', {
  page: create_ui_page({ theme: 'light' }),
  menu: create_ui_popup(),         // ← ポップアップ
  dlg:  create_ui_dialog(),        // ← ダイアログ

  render(s) {
    return s.page({ ctx: [
      ui_panel({ ctx: [
        ui_text({ variant: 'title', ctx: ['Popup & Dialog'] }),

        // ── ポップアップメニュー ──
        s.menu({ ctx: [
          ui_button({ ctx: ['項目 A'], variant: 'ghost' }),
          ui_button({ ctx: ['項目 B'], variant: 'ghost' }),
        ]}),

        // ── ダイアログ ──
        s.dlg({
          trigger_ctx: ['確認ダイアログを開く'],
          title: '確認',
          ctx: [ui_text({ ctx: ['この操作を実行しますか？'] })],
          actions: [
            ui_button({ ctx: ['OK'], variant: 'primary', onclick: s.dlg.close }),
            ui_button({ ctx: ['キャンセル'], onclick: s.dlg.close }),
          ],
        }),
      ]}),
    ]});
  },
});
```

**パターンのまとめ**:

```
create_ui_xxx()  →  s に格納  →  render 内で s.xxx({ ... }) として呼ぶ
```

| 関数 | 作るもの |
|------|---------|
| `create_ui_popup()` | ドロップダウン / メニュー |
| `create_ui_dialog()` | モーダルダイアログ |
| `create_ui_tooltip()` | ツールチップ |
| `create_ui_toast()` | トースト通知 |

排他制御（popup を 1 つ開くと他が閉じる）は自動管理されます。

---

## 8. フォーム部品を使う

RicUI にはフォーム部品とその `bind_xxx` ショートカットが揃っています。

```javascript
const { create_RicDOM } = RicDOM;
const { create_ui_page, ui_panel, ui_col, ui_text,
        bind_input, bind_checkbox, bind_select, bind_range,
        ui_button, ui_code_pre } = RicUI;

create_RicDOM('#app', {
  name: '', agree: false, lang: 'ja', volume: 50,
  page: create_ui_page({ theme: 'light' }),

  render(s) {
    return s.page({ ctx: [
      ui_panel({ ctx: [
        ui_col({ ctx: [
          ui_text({ variant: 'label', ctx: ['名前'] }),
          bind_input(s, 'name', { placeholder: '入力…' }),

          bind_checkbox(s, 'agree', { ctx: ['利用規約に同意する'] }),

          ui_text({ variant: 'label', ctx: ['言語'] }),
          bind_select(s, 'lang', {
            options: [
              { value: 'ja', label: '日本語' },
              { value: 'en', label: 'English' },
            ],
          }),

          ui_text({ variant: 'label', ctx: ['音量'] }),
          bind_range(s, 'volume', { min: 0, max: 100 }),

          // state の中身をリアルタイム表示
          ui_code_pre({ obj: { name: s.name, agree: s.agree, lang: s.lang, volume: s.volume } }),
        ]}),
      ]}),
    ]});
  },
});
```

`bind_xxx(s, 'key', options)` は `s.key` と自動で双方向バインドします。
イベントハンドラを自分で書く必要はありません。

---

## 9. 次のステップ

おつかれさまでした。ここまでで RicDOM の主要な機能を一通り体験しました。

### おすすめの次のステップ

1. **サンプルを動かす** — `docs/samples/` を順に見てみてください:
   - `00_hello.html` — RicDOM 生 vs RicUI の比較
   - `03_popup.html` — ポップアップ・ツールチップの実例
   - `07_tweak_splitter.html` — 調整パネル + ペイン分割
   - `10_theme_studio.html` — テーマエディタ（全部品のプレビュー付き）

2. **README を読む** — API 一覧とパターンの全体像

3. **SPEC.md を読む** — CSS 変数・テーマ・Proxy メカニズムの詳細

### 3 つのパターンを覚える

| パターン | 例 | 使い分け |
|---------|-----|---------|
| `ui_xxx()` | `ui_button`, `ui_text` | 状態を持たない純粋な描画 |
| `bind_xxx(s, key)` | `bind_input`, `bind_checkbox` | state との双方向バインド |
| `create_ui_xxx()` | `create_ui_popup`, `create_ui_page` | 内部状態を持つ部品。**s のトップレベルに格納** |

### FAQ

**Q: React / Vue と何が違う？**
RicDOM は Virtual DOM を使わず、JSON 差分から実 DOM を直接パッチします。
ビルドツール不要で、`<script>` タグ 1 つで動きます。
大規模 SPA には向きませんが、Electron アプリ・社内ツール・パラメータ調整 UI では
学習コストの低さと IME 対応の確実さが利点です。

**Q: どういうときに向いている？**
- Electron アプリの設定画面・ダッシュボード
- 社内ツール・業務用 UI
- プロトタイプ・データ可視化
- ゲームやシミュレーションのパラメータ調整 UI

**Q: 商用利用は？**
非商用（個人利用・学習・研究・OSS 開発）は自由です。
商用利用は要相談。詳細は [LICENSE](./LICENSE) を参照してください。
