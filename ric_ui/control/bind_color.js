// RicUI — bind_color
// ui_color を state と双方向バインドする便利関数。
//
// 使い方：
//   bind_color(s, 'bg_color')                    // hex モード
//   bind_color(s, 'overlay', { alpha: true })     // 値が rgba なら自動でアルファ表示

'use strict';

const { ui_color } = require('./ui_color');

const bind_color = (s, key, options = {}) => ui_color({
  value:    s[key] ?? '#000000',
  disabled: options.disabled ?? false,
  oninput:  ev => { s[key] = ev.target.value; },
});

module.exports = { bind_color };
