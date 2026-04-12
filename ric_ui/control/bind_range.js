// RicUI — bind_range
// ui_range を state と双方向バインドする便利関数。
//
// 使い方：
//   bind_range(s, 'volume', { min: 0, max: 100, step: 1 })

'use strict';

const { ui_range } = require('./ui_range');

const bind_range = (s, key, options = {}) => ui_range({
  value:    s[key] ?? options.min ?? 0,
  min:      options.min      ?? 0,
  max:      options.max      ?? 100,
  step:     options.step     ?? 1,
  disabled: options.disabled ?? false,
  oninput:  ev => { s[key] = parseFloat(ev.target.value); },
});

module.exports = { bind_range };
