// RicUI — bind_color
// ui_color を state と双方向バインドする便利関数。
//
// 使い方：
//   bind_color(s, 'bg_color')    // state 値が hex なら hex picker
//   bind_color(s, 'overlay')     // state 値が rgba(...) なら自動で alpha つき picker
// alpha モードは state 値が rgba(...) 形式か否かで ui_color が自動判定するため、
// 呼び出し側で明示するオプションはない。

'use strict';

const { ui_color } = require('./ui_color');

const bind_color = (s, key, options = {}) => ui_color({
  value:    s[key] ?? '#000000',
  disabled: options.disabled ?? false,
  oninput:  ev => { s[key] = ev.target.value; },
});

module.exports = { bind_color };
