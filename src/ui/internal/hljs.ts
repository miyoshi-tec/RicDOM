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
  // console 自体が無い環境 (一部の組み込み/SSR 実行系) で落ちないようにする防御
  // (v1 ric_ui/_factory_helpers.js:59-69 の warn_hljs_missing 継承、v1→v2 パリティ
  // 一括監査 #7)。ここで return した場合は hljsWarned を立てない — console が
  // 後から使えるようになった時点で改めて 1 回 warn できるようにするため。
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
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
