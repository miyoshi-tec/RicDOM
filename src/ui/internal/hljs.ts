// ricdom/ui — hljs (highlight.js) 検出・警告の共有ヘルパー
//
// uiMdPre (フェンスコードブロック) と uiCodePre は両方とも window.hljs があれば
// シンタックスハイライトを試み、無ければプレーンテキストにフォールバックする。
// v1 (ric_ui/_factory_helpers.js の warn_hljs_missing) と同じく、「なぜハイライトされないか
// 分かりにくい」を防ぐため初回 1 度だけ console.warn する — 2 部品から呼ばれても計 1 回。
//
// `declare global` での Window 拡張は同一シェイプでないと TS の interface merging が
// エラーになるため、1 箇所にまとめて mdPre.ts / codePre.ts の両方から import する。

export interface HljsLike {
  highlight: (code: string, opts: { language: string }) => { value: string };
  highlightAuto: (code: string) => { value: string };
}

declare global {
  interface Window {
    hljs?: HljsLike;
  }
}

let hljsWarned = false;
export const warnHljsMissing = (): void => {
  if (hljsWarned) return;
  hljsWarned = true;
  console.warn(
    'RicDOM UI: uiMdPre/uiCodePre は window.hljs (highlight.js) があればシンタックスハイライトします。\n' +
      '✅ hljs を <script> で読み込むか、ハイライト不要なら無視して構いません (プレーンテキストで表示されます)。',
  );
};

/** テスト用: hljs 未読込 warn の「1 回だけ」状態をリセットする */
export const _resetHljsWarningForTest = (): void => {
  hljsWarned = false;
};
