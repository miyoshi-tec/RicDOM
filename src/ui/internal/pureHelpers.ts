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
  popup: 'popup',
  popupItem: 'popup-item',
  toast: 'toast',
  tooltip: 'tooltip',
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
  tweakFolder: 'tweak-folder',
  tweakFolderHeader: 'tweak-folder-header',
  tweakFolderBody: 'tweak-folder-body',
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
