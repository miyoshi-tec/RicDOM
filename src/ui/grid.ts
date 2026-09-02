// ricdom/ui — uiGrid (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/layout/ui_grid.js) の camelCase 移植。CSS grid を簡潔に書くための layout 部品。
// gap は CSS 変数 (--ric-gap-md) から自動で取得される。色・背景は持たない。
//
// columns/rows: number | string
//   数値なら "1fr 1fr ... 1fr" (n 個) に展開
//   文字列なら grid-template-columns/rows にそのまま渡す (例: '120px 1fr')
//   'auto-fit 200px' / 'auto-fill 120px' は repeat(auto-fit, minmax(200px, 1fr)) の省略記法
// gap: string | number。省略時は theme の --ric-gap-md
//
// v1 は style に string/配列を渡すケース (RicDOM 側の normalize_style が cssText 直設定/
// 配列マージで処理する) も考慮していたが、v2 の style は object 限定 (設計書 §3.1) なので
// その分岐は不要 — 常に object としてマージできる (v1 からの簡略化)。

import type { ClassValue, RicElementNode, RicNode, StyleValue } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export interface UiGridProps {
  columns?: number | string;
  rows?: number | string;
  gap?: number | string;
  children?: RicNode | RicNode[];
  style?: StyleValue;
  class?: ClassValue;
  [key: string]: unknown;
}

// 数値 → '1fr 1fr ...' (n 個) に展開する
const expandTracks = (v: number | string): string => {
  if (typeof v === 'number') return Array(v).fill('1fr').join(' ');
  const m = v.match(/^(auto-fit|auto-fill)\s+(.+)$/);
  if (m) return `repeat(${m[1]}, minmax(${m[2]}, 1fr))`;
  return v;
};

export const uiGrid = ({ columns, rows, gap, children = [], style = {}, class: extraClass, ...rest }: UiGridProps = {}): RicNode => {
  const finalStyle: StyleValue = { ...style };
  if (columns !== undefined) finalStyle.gridTemplateColumns = expandTracks(columns);
  if (rows !== undefined) finalStyle.gridTemplateRows = expandTracks(rows);
  if (gap !== undefined) finalStyle.gap = typeof gap === 'number' ? `${gap}px` : gap;

  return {
    ...rest,
    tag: 'div',
    class: mergeClass('ric-grid', extraClass),
    'data-ricdom-role': UI_ROLE.grid,
    ...(Object.keys(finalStyle).length ? { style: finalStyle } : {}),
    children,
  } as RicElementNode;
};
