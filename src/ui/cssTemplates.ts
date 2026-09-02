// ricdom/ui — CSS テンプレート (設計書 §4)
//
// v1 (ric_ui/css_templates.js) から各部品の規則を移植する。Phase 2 でボタン/入力/dialog/
// popup/toast/tooltip、Phase 3a で状態を持たない部品 (control/layout/text) 一式 + ページ全体
// スクロールバー既定スタイルを追加した。v1 との相違点:
//   - `.ric-page ` プレフィックスを廃止。v2 には `create_ui_page` に相当する「テーマ適用
//     スコープ用コンポーネント」が無く、`applyTheme(el, ...)` は任意の要素に直接 CSS 変数を
//     当てるだけなので (§4)、CSS 側は単純なクラスセレクタで書ける (変数は通常の CSS
//     継承で子孫に届く)。
//   - v1 の「ページ全体スクロールバー既定スタイル」(`.ric-page, .ric-page *` への一括適用) は、
//     v2 に page 部品が無いため `[data-ricdom-theme]` (applyTheme が付与するマーカー属性) を
//     スコープに使う方式に置き換えた (Phase 3a、設計書 §13 で確定。SCROLLBAR_CSS 参照)。
//   - v1 の create_ui_popup は label/icon/chevron の 3 モードを持つ汎用ドロップダウンだったが、
//     v2 の createPopup は「トリガー + role=menu の本体」に絞ったメニュー部品として設計
//     し直した (設計書 E の記述 — aria-haspopup="menu" / role="menu" / menuitem 自動付与)。
//     CSS もそれに合わせて簡略化する。
//   - v1 の ui_panel はテーマ上書き props (`{theme, density, font_size}`) を持ったが、v2 の
//     uiPanel は持たない (設計書 §13)。disabled の見た目 (opacity) も JS 側の inline style
//     計算をやめ、`.ric-panel[inert]` の CSS セレクタで表現する (PANEL_CSS 参照)。

const fg = 'var(--ric-color-fg)';
const fm = 'var(--ric-color-fg-muted)';
const bg = 'var(--ric-color-bg)';
const bd = 'var(--ric-color-border)';
const ct = 'var(--ric-color-control)';
const ac = 'var(--ric-color-accent)';
const af = 'var(--ric-color-accent-fg, #fff)';
const r = 'var(--ric-radius)';
const g = 'var(--ric-gap)';
const px = 'var(--ric-pad-x)';
const py = 'var(--ric-pad-y)';
const ch = 'var(--ric-control-h)';
// フォールバック値付き: applyTheme が呼ばれる前 (または呼ばれない) でもアニメーションの
// `animation`/`transition` 宣言自体は有効な値を持つようにする。--ric-duration/--ric-easing
// が未定義のまま var() をフォールバック無しで使うと、ダイアログ/popup の open/close は
// 「animationend の発火」に状態遷移の完了 (フォーカス移動・DOM 除去) を委ねているため、
// アニメーション自体が発火しない = 状態遷移が永久に完了しない、という機能的なバグになる
// (実ブラウザテストで発見・修正。ANIMATION_FALLBACK_MS の setTimeout backstop はこれの
// 保険であって、フォールバック無しの var() を許容する理由にはしない)。
const dur = 'var(--ric-duration, 200ms)';
const eas = 'var(--ric-easing, ease)';
const sh = 'var(--ric-shadow)';
const tb = 'var(--ric-tooltip-bg)';
const tf = 'var(--ric-tooltip-fg)';
const cb = 'var(--ric-code-bg)'; // コードブロック背景 (v1 v0.4.1〜、tooltip とは独立)
const cf = 'var(--ric-code-fg)'; // コードブロック文字色
const gm = 'var(--ric-gap-md)';
const sbt = 'var(--ric-scrollbar-thumb)'; // スクロールバーつまみ色 (v1 v0.4.2〜)
const sbth = 'var(--ric-scrollbar-thumb-hover)'; // スクロールバーつまみ hover 色
// --ric-popup-blur / --ric-panel-shadow は cyber/aqua テーマだけが明示する値 (theme.ts)。
// 他テーマでは未定義のままだと var() がフォールバック無しで空になり宣言ごと無効になるため、
// フォールバック値を明示する (v1 は毎テーマに既定値があったため意識しなくてよかった差分)。
const bl = 'var(--ric-popup-blur, none)';
const ps = 'var(--ric-panel-shadow, var(--ric-shadow))';
const fs = 'var(--ric-font-size, 14px)';

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

// ── Phase 3a: 状態を持たない部品とレイアウト (設計書 §4/§13) ─────────────

// ページ全体のスクロールバー既定スタイル (v1 の `.ric-page, .ric-page *` 相当)。
// v2 に page 部品が無いため、applyTheme(el) が付与する `data-ricdom-theme` 属性を
// スコープ用マーカーとして使う (設計書 §13 で確定した方式)。属性を持つ要素自身と、
// その子孫すべてに適用する (子孫の中でネストして再度 applyTheme された要素があっても、
// セレクタが重複適用されるだけで害はない)。
const SCROLLBAR_CSS = `
[data-ricdom-theme], [data-ricdom-theme] * {
  scrollbar-width: thin;
  scrollbar-color: ${sbt} transparent;
}
[data-ricdom-theme]::-webkit-scrollbar, [data-ricdom-theme] *::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
[data-ricdom-theme]::-webkit-scrollbar-track, [data-ricdom-theme] *::-webkit-scrollbar-track,
[data-ricdom-theme]::-webkit-scrollbar-corner, [data-ricdom-theme] *::-webkit-scrollbar-corner {
  background: transparent;
}
[data-ricdom-theme]::-webkit-scrollbar-thumb, [data-ricdom-theme] *::-webkit-scrollbar-thumb {
  background: ${sbt};
  border-radius: 4px;
}
[data-ricdom-theme]::-webkit-scrollbar-thumb:hover, [data-ricdom-theme] *::-webkit-scrollbar-thumb:hover {
  background: ${sbth};
}`;

const TEXTAREA_CSS = `
.ric-textarea {
  display: block;
  width: 100%;
  padding: ${py} ${px};
  border: ${b1};
  border-radius: ${r};
  background: ${ct};
  color: ${fg};
  font-family: inherit;
  font-size: 1em;
  line-height: 1.5;
  outline: none;
  resize: vertical;
  transition: background 0.1s, border-color 0.15s, box-shadow 0.15s;
}
.ric-textarea:hover:not(:disabled) {
  background: ${bd};
  border-color: ${fm};
}
.ric-textarea:focus {
  background: ${ct};
  border-color: ${ac};
  box-shadow: 0 0 0 3px color-mix(in srgb, ${ac} 20%, transparent);
}
.ric-textarea::placeholder {
  color: ${fm};
}`;

const CHECKBOX_CSS = `
.ric-checkbox {
  display: inline-flex;
  align-items: center;
  gap: ${g};
  padding: ${py} ${px};
  border: 1px solid transparent;
  border-radius: ${r};
  cursor: pointer;
  user-select: none;
  font-size: 1em;
  color: ${fg};
  transition: background 0.1s, border-color 0.1s, translate 0.07s;
}
.ric-checkbox:hover {
  background: ${bd};
  border-color: ${fm};
}
.ric-checkbox:active {
  translate: 0 1px;
  filter: brightness(0.88);
}
.ric-checkbox input[type="checkbox"] {
  width: 15px;
  height: 15px;
  margin: 0;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: ${ac};
}
.ric-checkbox--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ric-checkbox--disabled:hover {
  background: transparent;
  border-color: transparent;
}
.ric-checkbox--disabled:active {
  translate: 0;
  filter: none;
}
.ric-checkbox--disabled input[type="checkbox"] {
  cursor: not-allowed;
}`;

const SELECT_CSS = `
.ric-select,
.ric-select::picker(select) {
  appearance: base-select;
}
.ric-select {
  display: flex;
  align-items: center;
  width: 100%;
  height: ${ch};
  padding: 0 ${px};
  border: ${b1};
  border-radius: ${r};
  background: ${ct};
  color: ${fg};
  font-size: 1em;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: background 0.1s, border-color 0.15s, box-shadow 0.15s, filter 0.1s;
}
.ric-select:hover:not(:disabled) {
  background: ${bd};
  border-color: ${fm};
}
.ric-select:focus {
  background: ${ct};
  border-color: ${ac};
  box-shadow: 0 0 0 3px color-mix(in srgb, ${ac} 20%, transparent);
}
.ric-select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ric-select::picker-icon {
  content: '❯';
  color: ${fm};
  font-size: 0.6em;
  rotate: 90deg;
  overflow: visible;
  margin-right: 2px;
  transition: rotate calc(${dur} * 2) ${eas};
}
.ric-select:open::picker-icon {
  rotate: 270deg;
}
.ric-select::picker(select) {
  background: ${ct};
  border: ${b1};
  border-radius: ${r};
  box-shadow: ${sh};
  padding: ${g};
  opacity: 0;
  transition: opacity calc(${dur} * 2) ${eas}, overlay calc(${dur} * 2) allow-discrete, display calc(${dur} * 2) allow-discrete;
}
.ric-select:open::picker(select) {
  opacity: 1;
  @starting-style {
    opacity: 0;
  }
}
.ric-select option {
  padding: ${py} ${px};
  border-radius: calc(${r} - 2px);
  color: ${fg};
  transition: background 0.1s;
}
.ric-select option:hover {
  background: ${bd};
}
.ric-select option:checked {
  background: ${ac};
  color: ${af};
}`;

const RADIOGROUP_CSS = `
.ric-radiogroup {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: ${g};
}
.ric-radio {
  display: inline-flex;
  align-items: center;
  gap: ${g};
  padding: ${py} ${px};
  border: 1px solid transparent;
  border-radius: ${r};
  cursor: pointer;
  user-select: none;
  font-size: 1em;
  color: ${fg};
  transition: background 0.1s, border-color 0.1s, filter 0.1s;
}
.ric-radio:hover {
  background: ${bd};
  border-color: ${fm};
}
.ric-radio:active {
  filter: brightness(0.88);
}
.ric-radio input[type="radio"] {
  width: 15px;
  height: 15px;
  margin: 0;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: ${ac};
}
.ric-radio__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}
.ric-radio--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ric-radio--disabled:hover {
  background: transparent;
  border-color: transparent;
}
.ric-radio--disabled:active {
  filter: none;
}
.ric-radio--disabled input[type="radio"] {
  cursor: not-allowed;
}`;

const RANGE_CSS = `
.ric-range {
  display: flex;
  align-items: center;
  gap: ${g};
  width: 100%;
  min-width: 0;
}
.ric-range input[type="range"] {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  accent-color: ${ac};
  height: ${ch};
}
.ric-range__value {
  font-size: 0.85em;
  color: ${fm};
  min-width: 32px;
  text-align: right;
  font-family: monospace;
  flex-shrink: 0;
}`;

const COLOR_CSS = `
.ric-color {
  display: flex;
  align-items: center;
  gap: ${g};
  width: 100%;
  min-width: 0;
}
.ric-color--rgba {
  flex-direction: column;
  align-items: stretch;
}
.ric-color__picker {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 2px;
  border: ${b1};
  border-radius: ${r};
  cursor: pointer;
  background: none;
  box-sizing: border-box;
}
.ric-color--rgba .ric-color__picker {
  width: 100%;
  flex: 0 0 auto;
}
.ric-color__alpha-row {
  display: flex;
  align-items: center;
  gap: ${g};
  min-width: 0;
}
.ric-color__alpha {
  flex: 1;
  min-width: 0;
  height: 20px;
  cursor: pointer;
  accent-color: ${ac};
}
.ric-color__value {
  font-size: 0.85em;
  color: ${fm};
  font-family: monospace;
  min-width: 54px;
  text-align: right;
  flex-shrink: 0;
}`;

const SEPARATOR_CSS = `
.ric-separator {
  border: none;
  border-top: ${b1};
  margin: ${g} 0;
}`;

const TEXT_CSS = `
.ric-text {
  font-size: 1em;
  line-height: 1.5;
}
.ric-text--muted {
  color: ${fm};
  font-size: 0.85em;
}
.ric-text--title {
  font-size: 1.25em;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
}
.ric-text--label {
  font-size: 0.85em;
  font-weight: 600;
  color: ${fm};
}`;

// アイコン: サイズ・色は uiIcon が inline (style width/height + currentColor) で持つので、
// ここでは整列と回転だけを担う。
//   vertical-align: -0.125em … テキスト隣接時のベースライン微調整
//   flex-shrink: 0           … ボタン/flex 内でアイコンが潰れないように
//   @keyframes ric-spin      … spin:true (spinner) 用
const ICON_CSS = `
.ric-icon {
  display: inline-block;
  vertical-align: -0.125em;
  flex-shrink: 0;
}
@keyframes ric-spin { to { transform: rotate(360deg); } }
.ric-icon--spin {
  animation: ric-spin 1.4s linear infinite;
}`;

const COL_CSS = `
.ric-col {
  display: flex;
  flex-direction: column;
  gap: ${gm};
}`;

const ROW_CSS = `
.ric-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${gm};
}`;

const GRID_CSS = `
.ric-grid {
  display: grid;
  gap: ${gm};
}`;

// v1 は make_css_vars 由来のテーマ上書き props を持ったが、v2 の uiPanel はそれを持たない
// (設計書 §13)。disabled の見た目 (opacity) は JS 側で inline style を計算せず、
// `inert` 属性が付いた panel に対する CSS セレクタで表現する。
const PANEL_CSS = `
.ric-panel {
  display: flex;
  flex-direction: column;
  gap: ${gm};
  color: ${fg};
  font-size: var(--ric-font-size, inherit);
  background: ${bg};
  border: ${b1};
  border-radius: ${r};
  padding: ${gm};
  backdrop-filter: ${bl};
  -webkit-backdrop-filter: ${bl};
  box-shadow: ${ps};
}
.ric-panel--row {
  flex-direction: row;
  align-items: center;
}
.ric-panel[inert] {
  opacity: 0.45;
}`;

const MD_PRE_CSS = `
.ric-md-pre {
  line-height: 1.7;
  color: ${fg};
  font-size: ${fs};
}
.ric-md-pre__h1 {
  font-size: 1.6em; font-weight: 700;
  margin: 0.8em 0 0.4em; padding-bottom: 0.2em;
  border-bottom: ${b1};
}
.ric-md-pre__h2 {
  font-size: 1.3em; font-weight: 700;
  margin: 0.7em 0 0.3em; padding-bottom: 0.15em;
  border-bottom: ${b1};
}
.ric-md-pre__h3 {
  font-size: 1.1em; font-weight: 700;
  margin: 0.6em 0 0.2em;
}
.ric-md-pre__p {
  margin: 0.5em 0;
}
.ric-md-pre__list {
  margin: 0.5em 0; padding-left: 1.5em;
}
.ric-md-pre__list li {
  margin: 0.2em 0;
}
.ric-md-pre__ol {
  margin: 0.5em 0; padding-left: 1.5em;
}
.ric-md-pre__ol li {
  margin: 0.2em 0;
}
.ric-md-pre__img {
  max-width: 100%;
  height: auto;
  border-radius: ${r};
}
.ric-md-pre__quote {
  margin: 0.5em 0; padding: 0.3em 0.8em;
  border-left: 3px solid ${ac};
  color: ${fm};
}
.ric-md-pre__fence {
  margin: 0.5em 0; padding: ${gm};
  background: ${cb}; color: ${cf};
  border: 1px solid color-mix(in srgb, ${fg} 6%, transparent);
  border-radius: ${r};
  overflow-x: auto;
  font-family: Consolas, "Cascadia Code", "Source Code Pro", Monaco, monospace;
  font-size: 0.85em; line-height: 1.6;
  white-space: pre;
}
.ric-md-pre__fence > code {
  display: block;
}
.ric-md-pre__fence > code.hljs {
  background: transparent; padding: 0; overflow: visible;
}
.ric-md-pre__code {
  padding: 0.15em 0.4em;
  background: color-mix(in srgb, ${fg} 8%, transparent);
  border-radius: 3px;
  font-family: Consolas, "Cascadia Code", "Source Code Pro", Monaco, monospace;
  font-size: 0.9em;
}
.ric-md-pre__link {
  color: ${ac}; text-decoration: none;
}
.ric-md-pre__link:hover {
  text-decoration: underline;
}
.ric-md-pre__hr {
  border: none; border-top: ${b1};
  margin: 1em 0;
}
.ric-md-pre__table {
  margin: 0.5em 0; border-collapse: collapse; width: auto;
  font-size: 0.95em;
}
.ric-md-pre__th {
  padding: 0.35em 0.8em; font-weight: 700;
  border-bottom: 2px solid ${bd};
  text-align: left; white-space: nowrap;
}
.ric-md-pre__td {
  padding: 0.3em 0.8em;
  border-bottom: ${b1};
}`;

const CODE_PRE_CSS = `
.ric-code-pre {
  margin: 0;
  padding: ${gm};
  background: ${cb};
  color: ${cf};
  border: 1px solid color-mix(in srgb, ${fg} 6%, transparent);
  border-radius: var(--ric-radius, 8px);
  overflow-x: auto;
  font-family: Consolas, "Cascadia Code", "Source Code Pro", Monaco, monospace;
  font-size: 0.85em;
  line-height: 1.6;
  white-space: pre;
}
.ric-code-pre:hover {
  scrollbar-color: color-mix(in srgb, ${cf} 40%, transparent) transparent;
}
.ric-code-pre > code {
  display: block;
}
.ric-code-pre > code.hljs {
  background: transparent;
  padding: 0;
  overflow: visible;
}`;

/**
 * ricdom/ui の CSS 1 枚分の文字列を組み立てる (設計書 §4)。
 * `injectStyles()` (実行時注入) と `dist/ricdom-ui.css` 生成スクリプト
 * (`scripts/build-css.mjs`) の両方から、同じ関数を単一ソースとして使う。
 */
export const buildStylesheet = (): string =>
  [
    BUTTON_CSS,
    INPUT_CSS,
    DIALOG_CSS,
    POPUP_CSS,
    TOAST_CSS,
    TOOLTIP_CSS,
    SCROLLBAR_CSS,
    TEXTAREA_CSS,
    CHECKBOX_CSS,
    SELECT_CSS,
    RADIOGROUP_CSS,
    RANGE_CSS,
    COLOR_CSS,
    SEPARATOR_CSS,
    TEXT_CSS,
    ICON_CSS,
    COL_CSS,
    ROW_CSS,
    GRID_CSS,
    PANEL_CSS,
    MD_PRE_CSS,
    CODE_PRE_CSS,
  ].join('\n');
