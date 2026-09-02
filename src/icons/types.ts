// ricdom/icons — 型定義 (Phase 3c)
//
// uiIcon (ricdom/ui) が受け取る descriptor と構造的に同じ形 `{ v?, s?, p }` (設計書
// 付録 B A17)。`ricdom/icons` は `ricdom/ui` へ実行時はもちろん型としても依存しない
// (data-only パッケージ、A17 の「データ層」)。TS の構造的型付けにより、この
// `IconDescriptor` はそのまま `uiIcon(descriptor, opts)` の第 1 引数に渡せる。

export interface IconDescriptor {
  /** viewBox (既定 '0 0 24 24') */
  v?: string;
  /** stroke-width。省略 → 2 (stroke) / 数値 → その太さ (stroke) / null → fill モード */
  s?: number | null;
  /** path の d 文字列、または複数 path の文字列配列 */
  p?: string | string[];
}
