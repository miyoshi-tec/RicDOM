// ricdom/ui — CSS テンプレート (設計書 §4)
//
// v1 (ric_ui/css_templates.js) からボタン/入力/dialog/popup/toast/tooltip の規則だけを
// Phase 2 の検証スコープとして移植する (残りは Phase 3、設計書 D)。v1 との相違点:
//   - `.ric-page ` プレフィックスを廃止。v2 には `create_ui_page` に相当する「テーマ適用
//     スコープ用コンポーネント」が無く、`applyTheme(el, ...)` は任意の要素に直接 CSS 変数を
//     当てるだけなので (§4)、CSS 側は単純なクラスセレクタで書ける (変数は通常の CSS
//     継承で子孫に届く)。
//   - v1 の「ページ全体スクロールバー既定スタイル」(`.ric-page, .ric-page *` への一括適用)
//     は、v2 に相当するページコンポーネントが無いため Phase 2 では移植しない。
//     `--ric-scrollbar-thumb(-hover)` トークン自体は applyTheme が計算するので、
//     必要な consumer は自分の CSS で `scrollbar-color: var(--ric-scrollbar-thumb) transparent`
//     を使える。ページ全体への既定適用は Phase 3 の layout 部品と合わせて再検討する
//     (最終報告 §13 候補)。
//   - v1 の create_ui_popup は label/icon/chevron の 3 モードを持つ汎用ドロップダウンだったが、
//     v2 の createPopup は「トリガー + role=menu の本体」に絞ったメニュー部品として設計
//     し直した (設計書 E の記述 — aria-haspopup="menu" / role="menu" / menuitem 自動付与)。
//     CSS もそれに合わせて簡略化する。

const fg = 'var(--ric-color-fg)';
const fm = 'var(--ric-color-fg-muted)';
const bd = 'var(--ric-color-border)';
const ct = 'var(--ric-color-control)';
const ac = 'var(--ric-color-accent)';
const af = 'var(--ric-color-accent-fg, #fff)';
const r = 'var(--ric-radius)';
const g = 'var(--ric-gap)';
const px = 'var(--ric-pad-x)';
const py = 'var(--ric-pad-y)';
const ch = 'var(--ric-control-h)';
const dur = 'var(--ric-duration)';
const eas = 'var(--ric-easing)';
const sh = 'var(--ric-shadow)';
const tb = 'var(--ric-tooltip-bg)';
const tf = 'var(--ric-tooltip-fg)';

const b1 = `1px solid ${bd}`;
const da = `${dur} ${eas}`;

const BUTTON_CSS = `
.ric-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  height: ${ch};
  padding: 0 ${px};
  border: ${b1};
  border-radius: ${r};
  background: ${ct};
  color: ${fg};
  font-size: 1em;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  appearance: none;
  white-space: nowrap;
  transition: background 0.1s, border-color 0.1s, filter 0.1s, translate 0.07s;
}
.ric-button:hover:not(:disabled) {
  background: ${bd};
  border-color: ${fm};
}
.ric-button:active:not(:disabled) {
  translate: 0 1px;
  filter: brightness(0.85);
}
.ric-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ric-button--primary {
  background: ${ac};
  border-color: ${ac};
  color: ${af};
}
.ric-button--primary:hover:not(:disabled) {
  background: ${ac};
  border-color: ${ac};
  filter: brightness(1.15);
}
.ric-button--primary:active:not(:disabled) {
  translate: 0 1px;
  filter: brightness(0.9);
}
.ric-button--ghost {
  border-color: transparent;
  background: transparent;
}
.ric-button--ghost:hover:not(:disabled) {
  border-color: ${fm};
  background: ${bd};
}`;

const INPUT_CSS = `
.ric-input {
  display: block;
  width: 100%;
  height: ${ch};
  padding: 0 ${px};
  border: ${b1};
  border-radius: ${r};
  background: ${ct};
  color: ${fg};
  font-size: 1em;
  outline: none;
  appearance: none;
  transition: background 0.1s, border-color 0.15s, box-shadow 0.15s, translate 0.07s, filter 0.1s;
}
.ric-input:hover:not(:disabled) {
  background: ${bd};
  border-color: ${fm};
}
.ric-input:focus {
  background: ${ct};
  border-color: ${ac};
  box-shadow: 0 0 0 3px color-mix(in srgb, ${ac} 20%, transparent);
  translate: 0;
  filter: none;
}
.ric-input:active:not(:disabled) {
  filter: brightness(0.88);
}
.ric-input::placeholder {
  color: ${fm};
}`;

const DIALOG_CSS = `
@keyframes ric-dlg-in  { from { opacity:0; transform:translate(-50%,-50%) scale(.8); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
@keyframes ric-dlg-out { from { opacity:1; transform:translate(-50%,-50%) scale(1); } to { opacity:0; transform:translate(-50%,-50%) scale(.8); } }
@keyframes ric-ovl-in  { from { opacity:0; } to { opacity:1; } }
@keyframes ric-ovl-out { from { opacity:1; } to { opacity:0; } }

.ric-dialog__overlay { position: fixed; inset: 0; background: color-mix(in srgb, ${tb} 10%, transparent); animation: ric-ovl-in ${da}; }
.ric-dialog__overlay--out { animation: ric-ovl-out ${da} forwards; pointer-events: none; }
.ric-dialog {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  background: var(--ric-popup-bg, var(--ric-color-bg));
  border: ${b1};
  border-radius: ${r};
  box-shadow: ${sh};
  width: min(360px, 90vw);
  overflow: hidden;
  animation: ric-dlg-in ${da};
}
.ric-dialog--out { animation: ric-dlg-out ${da} forwards; pointer-events: none; }
.ric-dialog__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: ${py} ${px};
  border-bottom: ${b1};
}
.ric-dialog__title { font-weight: 700; font-size: 1em; color: ${fg}; }
.ric-dialog__close {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border: none; background: transparent; cursor: pointer;
  color: ${fm}; font-size: 14px;
  border-radius: ${r};
  transition: background 0.1s, color 0.1s;
}
.ric-dialog__close:hover { background: ${bd}; color: ${fg}; }
.ric-dialog__body { padding: ${px}; font-size: 1em; color: ${fg}; }
.ric-dialog__footer {
  display: flex; justify-content: flex-end; gap: ${g};
  padding: ${g} ${px} ${py};
  border-top: ${b1};
}`;

const POPUP_CSS = `
@keyframes ric-popup-in  { from { opacity:0; transform:scaleY(0.6); } to { opacity:1; transform:scaleY(1); } }
@keyframes ric-popup-out { from { opacity:1; transform:scaleY(1); }   to { opacity:0; transform:scaleY(0.6); } }

.ric-popup__overlay { position: fixed; inset: 0; }

.ric-popup__body {
  position: fixed;
  min-width: 160px;
  background: ${ct};
  border: ${b1};
  border-radius: ${r};
  box-shadow: ${sh};
  overflow: hidden;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ric-popup__body--below { transform-origin: top; animation: ric-popup-in ${da}; }
.ric-popup__body--above { transform-origin: bottom; animation: ric-popup-in ${da}; }
.ric-popup__body--out { pointer-events: none; }
.ric-popup__body--out.ric-popup__body--below,
.ric-popup__body--out.ric-popup__body--above { animation: ric-popup-out ${da} forwards; }

.ric-popup__item {
  display: flex !important;
  width: 100%;
  justify-content: flex-start;
  text-align: left;
  border-radius: calc(${r} - 2px);
  border: 1px solid transparent;
}
.ric-popup__item:hover,
.ric-popup__item:focus-visible { border-color: ${bd}; background: ${bd}; outline: none; }
.ric-popup__sep { height: 1px; background: ${bd}; margin: 4px 0; }`;

const TOAST_CSS = `
@keyframes ric-toast-in  { from { opacity:0; transform:translateX(calc(100% + 20px)); } to { opacity:1; transform:translateX(0); } }
@keyframes ric-toast-out { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(calc(100% + 20px)); } }

.ric-toast__container {
  position: fixed;
  bottom: 20px; right: 20px;
  z-index: 600;
  display: flex; flex-direction: column;
  gap: 8px; align-items: flex-end;
  pointer-events: none;
}
.ric-toast__item {
  display: flex; align-items: center; gap: ${g};
  min-width: 220px; max-width: 360px;
  padding: ${py} ${px};
  background: var(--ric-popup-bg, var(--ric-color-bg));
  border: ${b1};
  border-radius: ${r};
  box-shadow: ${sh};
  pointer-events: auto;
}
.ric-toast__item--in  { animation: ric-toast-in  ${da} both; }
.ric-toast__item--success { border-left: 3px solid #22c55e; }
.ric-toast__item--error   { border-left: 3px solid #ef4444; }
.ric-toast__item--warning { border-left: 3px solid #f59e0b; }
.ric-toast__item--info    { border-left: 3px solid ${ac}; }
.ric-toast__item--out { animation: ric-toast-out ${da} forwards; pointer-events: none; }
.ric-toast__msg { flex: 1; font-size: 1em; color: ${fg}; line-height: 1.4; }
.ric-toast__close {
  flex-shrink: 0; width: 20px; height: 20px;
  border: none; background: transparent; cursor: pointer;
  color: ${fm}; font-size: 11px;
  border-radius: ${r};
  display: flex; align-items: center; justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.ric-toast__close:hover { background: ${bd}; color: ${fg}; }`;

const TOOLTIP_CSS = `
@keyframes ric-tip-h { from { opacity:0; transform:translateX(-50%) scale(0.85); } to { opacity:1; transform:translateX(-50%) scale(1); } }
@keyframes ric-tip-v { from { opacity:0; transform:translateY(-50%) scale(0.85); } to { opacity:1; transform:translateY(-50%) scale(1); } }

.ric-tooltip__popup {
  position: fixed;
  background: ${tb};
  color: ${tf};
  font-size: 0.85em;
  padding: 4px 10px;
  border-radius: ${r};
  white-space: nowrap;
  pointer-events: none;
  max-width: 200px;
  z-index: 401;
}
.ric-tooltip__popup--top    { transform: translateX(-50%); transform-origin: center bottom; animation: ric-tip-h ${da}; }
.ric-tooltip__popup--bottom { transform: translateX(-50%); transform-origin: center top; animation: ric-tip-h ${da}; }
.ric-tooltip__popup--right  { transform: translateY(-50%); transform-origin: left center; animation: ric-tip-v ${da}; }
.ric-tooltip__popup--left   { transform: translateY(-50%); transform-origin: right center; animation: ric-tip-v ${da}; }`;

/**
 * ricdom/ui の CSS 1 枚分の文字列を組み立てる (設計書 §4)。
 * `injectStyles()` (実行時注入) と `dist/ricdom-ui.css` 生成スクリプト
 * (`scripts/build-css.mjs`) の両方から、同じ関数を単一ソースとして使う。
 */
export const buildStylesheet = (): string => [BUTTON_CSS, INPUT_CSS, DIALOG_CSS, POPUP_CSS, TOAST_CSS, TOOLTIP_CSS].join('\n');
