// ricdom/ui — bindInput / bindTextarea / bindCheckbox / bindSelect / bindRange
// (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/control/bind_*.js) の camelCase 移植。ui_xxx を state と双方向バインドする
// 便利関数 — 「state の一段目 Proxy にバインドする流儀」(コアの浅い Proxy、設計書 §3.3)。
// `s` はコアの createApp が返す/render に渡す state (Proxy) そのものを渡す想定。
//
// v1 との差異 (最終報告 §14 候補): v1 の bind_textarea だけ `...options` を value/oninput の
// **後**に展開しており、options で value/oninput を上書きできてしまう歪みがあった
// (bind_input/bind_checkbox/bind_range/bind_select は options の後に計算値を置いていた)。
// v2 では 5 関数とも「options を先に展開 → 計算済みの value/onchange/oninput を後に置いて
// 上書き不可にする」で統一する (rest スプレッド契約 A15 と同じ考え方を bind* にも適用)。
//
// v1 の bind_color / bind_radiobutton は本 Phase の対象外 (設計書指定の 5 関数のみ移植)。
// name 衝突の既知制約は uiRadiobutton 側の JSDoc に記載済み。

import type { RicNode } from '../types.js';
import { uiCheckbox, type UiCheckboxProps } from './checkbox.js';
import { uiInput, type UiInputProps } from './input.js';
import { uiRange, type UiRangeProps } from './range.js';
import { uiSelect, type UiSelectProps } from './select.js';
import { uiTextarea, type UiTextareaProps } from './textarea.js';

/**
 * S のプロパティのうち値型が T であるキーだけを許可する (bind* の key 引数の型安全用)。
 * `Exclude<S[K], undefined>` で剥がしてから判定することで、`{ name?: string }` のような
 * 省略可能プロパティ (state の初期値未設定を表す実用上ありふれた形) も対象に含める。
 */
type KeyOfType<S, T> = { [K in keyof S]-?: Exclude<S[K], undefined> extends T ? K : never }[keyof S];

const setKey = <S extends object, K extends keyof S>(s: S, key: K, value: S[K]): void => {
  s[key] = value;
};

/**
 * uiInput を state と双方向バインドする。
 *   bindInput(s, 'name', { placeholder: '名前を入力…' })
 *   bindInput(s, 'age',  { type: 'number' })
 */
export const bindInput = <S extends object, K extends KeyOfType<S, string>>(s: S, key: K, options: Omit<UiInputProps, 'value' | 'oninput'> = {}): RicNode =>
  uiInput({
    ...options,
    value: (s[key] as unknown as string) ?? '',
    oninput: (ev: Event) => setKey(s, key, (ev.target as HTMLInputElement).value as S[K]),
  });

/**
 * uiTextarea を state と双方向バインドする。
 *   bindTextarea(s, 'memo', { autoResize: { minRows: 2, maxRows: 8 } })
 *
 * ⚠️ IME 注意 (v1 継承): controlled な textarea では IME 確定前に value が上書きされる場合が
 *   ある。日本語入力中心の場面では onchange 方式を検討すること。
 */
export const bindTextarea = <S extends object, K extends KeyOfType<S, string>>(
  s: S,
  key: K,
  options: Omit<UiTextareaProps, 'value' | 'oninput'> = {},
): RicNode =>
  uiTextarea({
    ...options,
    value: (s[key] as unknown as string) ?? '',
    oninput: (ev: Event) => setKey(s, key, (ev.target as HTMLTextAreaElement).value as S[K]),
  });

/**
 * uiCheckbox を state と双方向バインドする。
 *   bindCheckbox(s, 'agree', { children: ['利用規約に同意する'] })
 */
export const bindCheckbox = <S extends object, K extends KeyOfType<S, boolean>>(
  s: S,
  key: K,
  options: Omit<UiCheckboxProps, 'checked' | 'onchange'> = {},
): RicNode =>
  uiCheckbox({
    ...options,
    checked: !!s[key],
    onchange: (ev: Event) => setKey(s, key, (ev.target as HTMLInputElement).checked as S[K]),
  });

/**
 * uiSelect を state と双方向バインドする。
 *   bindSelect(s, 'role', { options: ['viewer', 'editor', 'admin'] })
 */
export const bindSelect = <S extends object, K extends KeyOfType<S, string>>(s: S, key: K, options: Omit<UiSelectProps, 'value' | 'onchange'> = {}): RicNode =>
  uiSelect({
    ...options,
    value: (s[key] as unknown as string) ?? '',
    onchange: (ev: Event) => setKey(s, key, (ev.target as HTMLSelectElement).value as S[K]),
  });

/**
 * uiRange を state と双方向バインドする。
 *   bindRange(s, 'volume', { min: 0, max: 100, step: 1 })
 */
export const bindRange = <S extends object, K extends KeyOfType<S, number>>(s: S, key: K, options: Omit<UiRangeProps, 'value' | 'oninput'> = {}): RicNode =>
  uiRange({
    ...options,
    value: (s[key] as unknown as number) ?? options.min ?? 0,
    oninput: (ev: Event) => setKey(s, key, (parseFloat((ev.target as HTMLInputElement).value) || 0) as S[K]),
  });
