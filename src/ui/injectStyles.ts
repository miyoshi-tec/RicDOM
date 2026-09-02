// ricdom/ui — CSS 1 枚配布 (設計書 §4)
//
// per-instance の使用クラス収集 (v1 の css_registry/css_for) を廃止し、CSS は
// 1 枚のスタイルシートとして配布する。`<link rel="stylesheet" href=".../ricdom-ui.css">`
// で読み込むほか、ビルド不要で `<script>` だけ読んだ consumer 向けに
// `injectStyles()` で同じ内容を実行時注入できる (document ごとに 1 回、idempotent)。
// `ricdomUI` IIFE を読むだけでは自動注入しない (明示、設計書 §4)。

import { buildStylesheet } from './cssTemplates.js';

const STYLE_MARKER_ATTR = 'data-ricdom-role';
const STYLE_MARKER_VALUE = 'styles';

/**
 * ricdom/ui の CSS 1 枚 (`buildStylesheet()`) を `doc` の `<head>` に注入する。
 * 同じ doc に対して 2 回目以降は no-op (`<style data-ricdom-role="styles">` の
 * 存在を見て判定する、idempotent)。既定は `document`。
 */
export const injectStyles = (doc: Document = document): void => {
  if (!doc || typeof doc.createElement !== 'function') {
    console.error('RicDOM UI: injectStyles には有効な Document を渡してください。');
    return;
  }
  if (doc.querySelector(`style[${STYLE_MARKER_ATTR}="${STYLE_MARKER_VALUE}"]`)) return; // 既に注入済み

  const styleEl = doc.createElement('style');
  styleEl.setAttribute(STYLE_MARKER_ATTR, STYLE_MARKER_VALUE);
  styleEl.textContent = buildStylesheet();
  (doc.head ?? doc.documentElement).appendChild(styleEl);
};

/** 部品の初回 use() 時、スタイルが未注入なら案内を出す (設計書 §4、throw しない・1 回だけ) */
let warnedMissingStyles = false;
export const warnIfStylesMissing = (doc: Document = document): void => {
  if (warnedMissingStyles) return;
  if (!doc || typeof doc.querySelector !== 'function') return;
  if (doc.querySelector(`style[${STYLE_MARKER_ATTR}="${STYLE_MARKER_VALUE}"]`)) return;
  if (doc.querySelector('link[href$="ricdom-ui.css"]')) return; // <link> 読み込み済みの可能性が高い
  warnedMissingStyles = true;
  console.warn(
    'RicDOM UI: ricdom-ui.css がまだ読み込まれていないようです。\n' +
      '✅ <link rel="stylesheet" href=".../dist/ricdom-ui.css"> を読み込むか、' +
      "コード側で import { injectStyles } from 'ricdom/ui'; injectStyles(); を呼んでください。",
  );
};

/** テスト用: warnIfStylesMissing の「1 回だけ」状態をリセットする */
export const _resetStyleWarningForTest = (): void => {
  warnedMissingStyles = false;
};
