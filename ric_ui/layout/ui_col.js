// RicUI — ui_col
// 縦方向フレックスコンテナ（layout カテゴリ）。
// gap は CSS variable（--ric-gap-md）から自動で取得される。
// 色・背景は持たない。レイアウトだけを担当する。

'use strict';

// style 引数: 必要に応じて gap のオーバーライドなど任意の CSS を追加できる
// rest: onclick / id / data-* / aria-* 等の任意属性を透過する
//       （ui_button / ui_input / ui_panel 等と同じ流儀）
const ui_col = ({ ctx = [], style = {}, ...rest } = {}) => ({
  ...rest,
  tag: 'div',
  class: rest.class ? 'ric-col ' + rest.class : 'ric-col',
  ...(Object.keys(style).length ? { style } : {}),
  ctx,
});

module.exports = { ui_col };
