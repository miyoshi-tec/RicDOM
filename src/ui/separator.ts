// ricdom/ui — uiSeparator (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/control/ui_separator.js) の camelCase 移植。水平区切り線 (装飾要素)。
// rest スプレッド契約 (v1 A15 継承): id/data-*/aria-*/style 等の任意属性を透過する。

import type { ClassValue, RicElementNode, RicNode } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export interface UiSeparatorProps {
  class?: ClassValue;
  [key: string]: unknown;
}

export const uiSeparator = ({ class: extraClass, ...rest }: UiSeparatorProps = {}): RicNode =>
  ({
    ...rest,
    tag: 'hr',
    class: mergeClass('ric-separator', extraClass),
    'data-ricdom-role': UI_ROLE.separator,
  }) as RicElementNode;
