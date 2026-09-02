// ricdom/ui — uiRow (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/layout/ui_row.js) の camelCase 移植。横方向フレックスコンテナ。
// gap は CSS 変数 (--ric-gap-md) から自動で取得される。色・背景は持たない。

import type { ClassValue, RicElementNode, RicNode, StyleValue } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export interface UiRowProps {
  children?: RicNode | RicNode[];
  style?: StyleValue;
  class?: ClassValue;
  [key: string]: unknown;
}

/**
 * 横方向フレックスコンテナ。状態を持たない純粋関数。
 *   uiRow({ children: [uiButton({ children: ['OK'] }), uiButton({ children: ['Cancel'] })] })
 */
export const uiRow = ({ children = [], style, class: extraClass, ...rest }: UiRowProps = {}): RicNode =>
  ({
    ...rest,
    tag: 'div',
    class: mergeClass('ric-row', extraClass),
    'data-ricdom-role': UI_ROLE.row,
    ...(style ? { style } : {}),
    children,
  }) as RicElementNode;
