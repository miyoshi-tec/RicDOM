// ricdom/ui — uiSelect (設計書 §3.4 純粋関数部品)
//
// v1 (ric_ui/control/ui_select.js) の camelCase 移植。CSS `appearance: base-select` により
// ドロップダウンの見た目をテーマ色で統一する (Chrome 135+)。ネイティブ <select> なので
// キーボード操作・アクセシビリティ・モバイル対応はブラウザが提供する。
//
// options: string[] または { value, label }[] を受け付ける。placeholder: 先頭に「未選択」
// オプション (選択不可) を追加する。
//
// v1 は selected を `selected: 1/0` の numeric 変換で個別 option に付与していた
// (select.value を初回ビルド時に設定しても option がまだ存在しないため)。v2 のコアは
// `<select>` の value を「option が生えた後に再適用する」構築順対策を既に持っている
// (src/dom.ts、`tag === 'select' && 'value' in attrs` の特別扱い) ため、部品側は素直に
// value を渡すだけでよい (設計書「options、value/option 構築順はコアが解決済み」)。

import type { ClassValue, RicElementNode, RicNode } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export interface UiSelectOption {
  value: string;
  label?: string | number;
}

export interface UiSelectProps {
  value?: string;
  options?: (string | UiSelectOption)[];
  placeholder?: string;
  disabled?: boolean;
  class?: ClassValue;
  onchange?: (ev: Event) => void;
  [key: string]: unknown;
}

const normalizeOption = (opt: string | UiSelectOption): UiSelectOption => (typeof opt === 'string' ? { value: opt, label: opt } : opt);

/**
 * ネイティブ `<select>`。状態を持たない純粋関数 (双方向バインドは `bindSelect` 参照)。
 *   uiSelect({ value: s.role, options: ['viewer', 'editor', 'admin'] })
 */
export const uiSelect = ({ value = '', options = [], placeholder, disabled = false, class: extraClass, onchange, ...rest }: UiSelectProps = {}): RicNode => {
  const optionNodes: RicNode[] = [
    ...(placeholder ? [{ tag: 'option', value: '', disabled: true, children: [placeholder] } as RicElementNode] : []),
    ...options.map((opt) => {
      const { value: v, label: l } = normalizeOption(opt);
      return { tag: 'option', value: String(v), children: [String(l)] } as RicElementNode;
    }),
  ];

  return {
    ...rest,
    tag: 'select',
    class: mergeClass('ric-select', extraClass),
    'data-ricdom-role': UI_ROLE.select,
    value,
    ...(onchange ? { onchange } : {}),
    ...(disabled ? { disabled: true } : {}),
    children: optionNodes,
  } as RicElementNode;
};
