// RicUI — ui_row
// 横方向フレックスコンテナ（layout カテゴリ）。
// gap は CSS variable（--ric-gap-md）から自動で取得される。
// 色・背景は持たない。レイアウトだけを担当する。

'use strict';

// style 引数: 必要に応じて align-items のオーバーライドなど任意の CSS を追加できる
const ui_row = ({ ctx = [], style = {} } = {}) => ({
  tag: 'div',
  class: 'ric-row',
  ...(Object.keys(style).length ? { style } : {}),
  ctx,
});

module.exports = { ui_row };
