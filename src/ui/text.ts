// ricdom/ui — uiText (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/text/ui_text.js) の camelCase 移植。variant で見た目を切り替える
// テキスト表示部品 (旧 ui_title/ui_label を統合)。
//
// variant:
//   'default' → 本文テキスト
//   'muted'   → 薄いテキスト (fg-muted 色)
//   'title'   → 見出し (太字、tag は h2)
//   'label'   → ラベル (セミボールド、fg-muted 色、tag は label)

import type { ClassValue, RicElementNode, RicNode, StyleValue } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export type UiTextVariant = 'default' | 'muted' | 'title' | 'label';

const TAG_MAP: Partial<Record<UiTextVariant, string>> = { title: 'h2', label: 'label' };

export interface UiTextProps {
  children?: RicNode | RicNode[];
  variant?: UiTextVariant;
  style?: StyleValue;
  class?: ClassValue;
  [key: string]: unknown;
}

/**
 * variant で見た目を切り替えるテキスト表示部品。状態を持たない純粋関数。
 *   uiText({ children: ['見出し'], variant: 'title' })
 */
export const uiText = ({ children = [], variant = 'default', style, class: extraClass, ...rest }: UiTextProps = {}): RicNode => {
  const tag = TAG_MAP[variant] ?? 'span';
  const baseClass = variant !== 'default' ? `ric-text ric-text--${variant}` : 'ric-text';

  return {
    ...rest,
    tag,
    class: mergeClass(baseClass, extraClass),
    'data-ricdom-role': UI_ROLE.text,
    ...(style ? { style } : {}),
    children,
  } as RicElementNode;
};
