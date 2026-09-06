// ricdom/ui — 状態を持たない部品 (control/layout/text) 共通ヘルパー
//
// v1 (ric_ui/control/*.js, ric_ui/layout/*.js) では各ファイルが同じ 4 行の
// class 連結ロジックをコピペしていた。v2 でも当初は uiButton/uiInput が
// 同じコピペを踏襲していたが、button.ts/input.ts もここに合流させた
// (§14 の追補: 「uiButton/uiInput に data-ricdom-role を付与し、UI_ROLE 列挙に統合」)。

import type { ClassValue } from '../../types.js';

/** 基底 class (例: 'ric-input') に呼び出し側の class (string/配列/真偽値マップ) を連結する。 */
export const mergeClass = (base: string, extra: ClassValue | undefined): string => {
  if (!extra) return base;
  if (typeof extra === 'string') return `${base} ${extra}`;
  if (Array.isArray(extra)) return [base, ...extra].join(' ');
  const truthy = Object.keys(extra).filter((k) => extra[k]);
  return [base, ...truthy].join(' ');
};

/**
 * 部品種別ごとの `data-ricdom-role` 値 (E2E/CSS の安定セレクタ、設計書付録 A14 継承)。
 * `src/app.ts`/`src/ui/injectStyles.ts` が内部マーカーとして使っている
 * 'portal'/'styles' と値がぶつからないよう、部品名前空間として列挙する。
 *
 * 状態を持たない部品に加え、uiButton/uiInput と、状態を持つ部品 (splitter/scrollPane/
 * collapseBox/accordion/tabs/dropdown/popup) の内部マーカーもここに統合し、
 * 「全部品で一貫」させている (§14 追補。popup.ts の 'popup-item' 直書きもここに移動)。
 */
export const UI_ROLE = {
  button: 'button',
  input: 'input',
  textarea: 'textarea',
  checkbox: 'checkbox',
  radiogroup: 'radiogroup',
  select: 'select',
  range: 'range',
  color: 'color',
  separator: 'separator',
  text: 'text',
  icon: 'icon',
  col: 'col',
  row: 'row',
  grid: 'grid',
  panel: 'panel',
  mdPre: 'md-pre',
  codePre: 'code-pre',
  // ── 状態を持つ部品 ──
  dialog: 'dialog',
  /** dialog の背景オーバーレイ (2.0.0-alpha.2 追補、§14 の全部品方針をサブパーツへ拡張) */
  dialogOverlay: 'dialog-overlay',
  dialogHeader: 'dialog-header',
  /** dialog のタイトル文字列 (`.ric-dialog__title`、パイロット第 5〜7 号 = Brownies Desktop
   *  からの報告 #2、2.0.0-alpha.8)。dialogHeader は「タイトル+閉じるボタンを束ねる行」の
   *  コンテナで、タイトル文字列そのものを CSS/E2E から掴む手段が無かった (title/close を
   *  分離して掴みたいケースを塞いでいた) ため新設。 */
  dialogTitle: 'dialog-title',
  /** dialog の本文コンテナ (`.ric-dialog__body`)。dialog 自身 (portal ルート) は `dialog` のまま */
  dialogBody: 'dialog-body',
  dialogFooter: 'dialog-footer',
  dialogClose: 'dialog-close',
  popup: 'popup',
  popupItem: 'popup-item',
  /** popup を開くトリガーボタン (2.0.0-alpha.8、#2 の役割棚卸しで発見: dropdown には
   *  dropdownTrigger があるのに popup のトリガー (`aria-haspopup="menu"` の button) には
   *  role が無かった非対称を解消)。 */
  popupTrigger: 'popup-trigger',
  /** popup/dropdown で共有する背景オーバーレイ (`.ric-popup__overlay`、両部品が同じ要素を使う) */
  popupOverlay: 'popup-overlay',
  toast: 'toast',
  toastItem: 'toast-item',
  /** toast 1 件のメッセージ文字列 (`.ric-toast__msg`、2.0.0-alpha.8、#2 の役割棚卸しで追加。
   *  toastItem (行全体) と toastClose (閉じるボタン) はあったが、本文だけを掴む手段が無かった)。 */
  toastMsg: 'toast-msg',
  toastClose: 'toast-close',
  tooltip: 'tooltip',
  /** tooltip のホバー/フォーカス対象トリガー (`.ric-tooltip`、2.0.0-alpha.8、#2 の役割棚卸しで
   *  追加。dropdownTrigger/popupTrigger と同じ理由 — トリガー自身と portal 側の本体
   *  (tooltip role) を CSS/E2E から別々に掴めるようにする)。 */
  tooltipTrigger: 'tooltip-trigger',
  scrollPane: 'scroll-pane',
  splitter: 'splitter',
  splitterSide: 'splitter-side',
  splitterMain: 'splitter-main',
  splitterDivider: 'splitter-divider',
  splitterToggle: 'splitter-toggle',
  collapseBox: 'collapse-box',
  accordion: 'accordion',
  accordionItem: 'accordion-item',
  accordionHeader: 'accordion-header',
  accordionBody: 'accordion-body',
  accordionTitle: 'accordion-title',
  tabs: 'tabs',
  tabsBar: 'tabs-bar',
  tabsTab: 'tabs-tab',
  tabsPanel: 'tabs-panel',
  dropdown: 'dropdown',
  dropdownTrigger: 'dropdown-trigger',
  inlineMenu: 'inline-menu',
  // ── パラメータ調整パネル ──
  tweakPanel: 'tweak-panel',
  /** パネル全体のタイトル (`.ric-tweak__title`、2.0.0-alpha.8、#2 の役割棚卸しで追加。
   *  行ごとの label (`.ric-tweak-row__label` 等) は data-ricdom-tweak-key 付きの行が既に
   *  一意に掴めるため見送ったが、パネル全体のタイトルは唯一無二の見出しなので dialogTitle/
   *  tweakFolderHeader と同じ扱いにする)。 */
  tweakTitle: 'tweak-title',
  tweakFolder: 'tweak-folder',
  tweakFolderHeader: 'tweak-folder-header',
  tweakFolderBody: 'tweak-folder-body',
  /** tweak の leaf row (number/range/checkbox/text/select/radiobutton/color/計算値) の
   *  コンテナ。`data-ricdom-tweak-key` (dot 連結のキー鎖) と対で付与する (§14 追補)。 */
  tweakRow: 'tweak-row',
} as const;

export type UiRole = (typeof UI_ROLE)[keyof typeof UI_ROLE];

// dev/prod 切り替え (src/reactivity.ts の isDevMode と同じ考え方: モジュール読み込み時に
// キャッシュせず都度読む。IIFE 配布版は tsup の define で 'production' を焼き込むため
// dead-code elimination で消える)。ricdom/ui はコアに実行時依存が無い (設計書 §13) ので、
// コア側の isDevMode を import せずここに複製する。
export const isDevMode = (): boolean => {
  try {
    return typeof process === 'undefined' || typeof process.env === 'undefined' || process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
};
