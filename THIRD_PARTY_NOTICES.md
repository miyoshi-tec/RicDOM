# RicDOM 2 — 同梱アイコンの出典とライセンス

`src/icons/index.ts` (`ricdom/icons` サブパス) に含まれるアイコンの大半は、**RicDOM の
オリジナル**として手書きした単純な幾何アイコンです (24×24、stroke-width 2、round cap、
[Lucide](https://lucide.dev/) 互換のスタイル)。RicDOM 本体と同じ MIT ライセンスで
利用できます。

例外は下記「Lucide」節に明記した個別アイコンで、Lucide 由来です (`ricdom-icon` CLI
(またはその前身である v1 の `scripts/icon.js`) で取得・path 化したもので、手書きでは
ありません)。

このファイルは v1 (RicDOM/RicUI、`miyoshi-tec/RicDOM`) の `docs/icons/ATTRIBUTION.md`
を移植したものです。

## 使い方

`ricdom/icons` から named import して `uiIcon` (`ricdom/ui`) に渡します:

```javascript
import { check, x } from 'ricdom/icons';
import { uiIcon } from 'ricdom/ui';

uiIcon(check, { size: 20, label: '完了' });
```

同梱に無いアイコンは `npx ricdom-icon <name>` で取得します (同梱優先、無ければ
[Lucide](https://lucide.dev/) から fetch して `svgToDescriptor` で path 化します)。

descriptor 形式: `{ v?, s?, p }`
- `v` = viewBox (省略時 `0 0 24 24`)
- `s` = stroke-width (省略時 2、`null` で塗りつぶしモード)
- `p` = path の `d` 文字列、または複数 path の配列

## Lucide

同梱アイコンのうち `contrast` (テーマ切替 UI 用、v1 v0.4.1〜からの継承) は
[Lucide](https://lucide.dev/) から `ricdom-icon contrast --json` 相当のコマンドで
取得・path 化したものです。

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022
as part of Feather (MIT). All other copyright (c) for Lucide are held
by Lucide Contributors 2022. Licensed under the ISC License.
https://github.com/lucide-icons/lucide/blob/main/LICENSE

`npx ricdom-icon <name>` で同梱に無いアイコンを Lucide から取得した場合も、同じ ISC
帰属が適用されます (CLI が生成する `const ICONS = {...}` ブロックの冒頭に、Lucide 由来の
名前が 1 つ以上含まれるときだけ、この帰属コメントが自動的に付きます)。

## 別のアイコンセットを追加する場合

[Lucide](https://lucide.dev/) (ISC)、[Tabler](https://tabler.io/icons) (MIT)、
[Feather](https://feathericons.com/) (MIT) などの permissive ライセンスの
アイコンを取り込むこともできます。その場合:

1. 各セットの**ライセンス表記をこのファイルに残す**こと (ISC / MIT とも著作権表示の
   保持が条件)。
2. descriptor 形式 (`{ v, s, p }`) に変換して `src/icons/index.ts` に追記する
   (`svgToDescriptor` (`ricdom/icons` から export) が `<rect>` / `<circle>` / `<line>` /
   `<polyline>` / `<polygon>` / `<ellipse>` を含む SVG も path に変換できる)。
