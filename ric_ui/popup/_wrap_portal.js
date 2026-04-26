// _wrap_portal.js
// ポータル要素にテーマ上書き CSS 変数を注入するヘルパー
//
// popup の呼び出し時に theme / density / font_size が渡された場合、
// 各ポータル要素の style にテーマ CSS 変数を先頭追加する。
// 渡されなかった場合はそのまま返す。

'use strict';

const { make_css_vars }       = require('../context');
const { style_to_css_string } = require('../style_utils');

// items: ポータルに push する VDOM 要素の配列
// opts:  { theme, density, font_size }
// 戻り値: CSS 変数が注入された VDOM 要素の配列
const apply_theme_to_portal = (items, opts = {}) => {
  const has_override = opts.theme !== undefined
                    || opts.density !== undefined
                    || opts.font_size !== undefined;
  if (!has_override) return items;

  const vars = make_css_vars({
    theme:     opts.theme,
    density:   opts.density,
    font_size: opts.font_size,
  });

  // 各要素の style 先頭に CSS 変数を追加
  return items.map(item => {
    if (!item) return item;
    const existing = item.style ? style_to_css_string(item.style) : '';
    const sep = existing ? '; ' : '';
    return { ...item, style: vars + sep + existing };
  });
};

module.exports = { apply_theme_to_portal };
