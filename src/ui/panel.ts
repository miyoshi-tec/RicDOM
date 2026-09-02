// ricdom/ui — uiPanel (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/surface/ui_panel.js) の camelCase 移植。面・背景・枠を担当するコンテナ。
// 文字色・フォントは親から CSS 継承。面だけを担当する。
//
// layout: 'col' (既定) | 'row' — 子を縦並び/横並びにする。gap は --ric-gap-md を使用。
//
// v1 との差異 (設計書 §13 で確定済み、最終報告にも記載):
//   - 部品ごとのテーマ上書き props (v1 の `{theme, density, font_size}`) は持たない。
//     portal は app の target 配下なので applyTheme の CSS 変数継承で足りる (再検討条件:
//     「同一 app 内で portal だけ別テーマ」の具体要望が出た場合)。
//   - v1 の `create_ui_panel` (内部状態を持つファクトリ、s のトップレベルに置いて使う版) は
//     移植しない — Phase 3a の対象部品は「すべて純粋関数」なので状態を持つ変種は対象外。
//   - disabled の見た目 (opacity 0.45) は v1 が make_css_vars 文字列 + style_to_css_string で
//     inline style として計算していたが、v2 の style は object 限定かつ CSS 1 枚配布の方針
//     (設計書 §4) と揃えるため、CSS 側の `.ric-panel[inert]` セレクタで表現する
//     (JS 側は inert 属性を付けるだけ)。

import type { ClassValue, RicElementNode, RicNode, StyleValue } from '../types.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export type UiPanelLayout = 'col' | 'row';

export interface UiPanelProps {
  children?: RicNode | RicNode[];
  layout?: UiPanelLayout;
  disabled?: boolean;
  style?: StyleValue;
  class?: ClassValue;
  [key: string]: unknown;
}

/**
 * 面・背景・枠を担当するコンテナ。状態を持たない純粋関数。
 *   uiPanel({ children: [...], layout: 'row' })
 */
export const uiPanel = ({ children = [], layout = 'col', disabled = false, style, class: extraClass, ...rest }: UiPanelProps = {}): RicNode => {
  const baseClass = layout === 'row' ? 'ric-panel ric-panel--row' : 'ric-panel';
  return {
    ...rest,
    tag: 'section',
    class: mergeClass(baseClass, extraClass),
    'data-ricdom-role': UI_ROLE.panel,
    ...(style ? { style } : {}),
    // inert: クリック・Tab フォーカス・テキスト選択を子孫すべてで無効化 (v1 踏襲)
    ...(disabled ? { inert: true } : {}),
    children,
  } as RicElementNode;
};
