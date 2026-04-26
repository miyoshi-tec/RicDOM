// RicUI — style_utils
// style プロパティ（オブジェクト or 文字列）を cssText 文字列に統一するヘルパ。
//
// 用途:
//   - VDOM の style がオブジェクトの場合、camelCase キーを kebab-case に変換して
//     "color: red; padding: 4px" のような cssText に直す。
//   - すでに文字列ならそのまま返す。
//   - null / undefined / 配列など想定外は空文字を返す（壊れず通る）。
//
// 共通化前は ui_page / ui_panel / create_ui_scroll_pane / _wrap_portal の 4 箇所で
// 微妙に異なる実装が複製されていた。挙動は本ヘルパに統一。

'use strict';

const style_to_css_string = (s) => {
  if (typeof s === 'string') return s;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return '';
  return Object.entries(s)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}: ${v}`)
    .join('; ');
};

module.exports = { style_to_css_string };
