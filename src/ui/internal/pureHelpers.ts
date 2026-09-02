// ricdom/ui — 状態を持たない部品 (control/layout/text) 共通ヘルパー (Phase 3a)
//
// v1 (ric_ui/control/*.js, ric_ui/layout/*.js) では各ファイルが同じ 4 行の
// class 連結ロジックをコピペしていた。v2 でも uiButton/uiInput (Phase 2) は
// 同じコピペを踏襲しているが、Phase 3a で対象部品が一気に増えるため、ここで
// 1 箇所にまとめる (button.ts/input.ts の重複は Phase 2 の既存コードなので
// 本 Phase では触らない。最終報告に「§14 候補」として記載)。

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
 * `src/app.ts`/`src/ui/injectStyles.ts`/`src/ui/popup.ts` 等が内部マーカーとして既に
 * 使っている 'portal'/'popup-item'/'styles' と値がぶつからないよう、状態を持たない
 * 部品専用の名前空間として列挙する。
 */
export const UI_ROLE = {
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
} as const;

export type UiRole = (typeof UI_ROLE)[keyof typeof UI_ROLE];
