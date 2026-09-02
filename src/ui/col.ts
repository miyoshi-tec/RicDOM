// ricdom/ui — uiCol (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/layout/ui_col.js) の camelCase 移植。縦方向フレックスコンテナ。
// gap は CSS 変数 (--ric-gap-md) から自動で取得される。色・背景は持たない
// (v2 に page 部品が無いため、テーマ変数は applyTheme(el) が当てた祖先要素から継承する)。

import type { ClassValue, RicElementNode, RicNode, StyleValue } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export interface UiColProps {
  children?: RicNode | RicNode[];
  style?: StyleValue;
  class?: ClassValue;
  [key: string]: unknown;
}

export const uiCol = ({ children = [], style, class: extraClass, ...rest }: UiColProps = {}): RicNode =>
  ({
    ...rest,
    tag: 'div',
    class: mergeClass('ric-col', extraClass),
    'data-ricdom-role': UI_ROLE.col,
    ...(style ? { style } : {}),
    children,
  }) as RicElementNode;
