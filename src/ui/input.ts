// ricdom/ui — uiInput (設計書 E: 検証用の純粋関数部品)
//
// v1 (ric_ui/control/ui_input.js) の camelCase 移植。既定で width:100% (CSS 側)。
// rest スプレッド契約 + 内部 input 隔離 (v1 A15 継承、設計書 E): 計算済み tag/class/type/value
// を rest の後に置き、rest からの上書きを防ぐ。value は常に含める (空文字でも
// `el.value = ''` が確実に走るよう、FORCE_REAPPLY 対象キーであることを尊重する)。

import type { ClassValue, RicElementNode, RicNode } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export interface UiInputProps {
  placeholder?: string;
  value?: string;
  type?: string;
  disabled?: boolean;
  class?: ClassValue;
  oninput?: (ev: Event) => void;
  [key: string]: unknown;
}

export const uiInput = ({ placeholder, value = '', type = 'text', disabled = false, class: extraClass, ...rest }: UiInputProps = {}): RicNode =>
  ({
    ...rest,
    tag: 'input',
    class: mergeClass('ric-input', extraClass),
    'data-ricdom-role': UI_ROLE.input,
    type,
    value, // 常に含める (空文字でも FORCE_REAPPLY で反映されるよう)
    ...(placeholder ? { placeholder } : {}),
    ...(disabled ? { disabled: true } : {}),
  }) as RicElementNode;
