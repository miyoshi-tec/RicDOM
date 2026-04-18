// RicUI — ui_separator
// 水平区切り線（装飾要素）。
// rest: id / data-* / aria-* / style 等の任意属性を透過する
//       （ui_button / ui_input / ui_panel 等と同じ流儀）

'use strict';

const ui_separator = ({ ...rest } = {}) => ({
  ...rest,
  tag: 'hr',
  class: rest.class ? 'ric-separator ' + rest.class : 'ric-separator',
});

module.exports = { ui_separator };
