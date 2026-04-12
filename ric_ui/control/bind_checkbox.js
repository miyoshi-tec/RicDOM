// RicUI — bind_checkbox
// ui_checkbox を state と双方向バインドする便利関数。
//
// 使い方：
//   bind_checkbox(s, 'agree', { ctx: ['利用規約に同意する'] })
//   bind_checkbox(s, 'notify', { ctx: ['通知を受け取る'], disabled: true })

'use strict';

const { ui_checkbox } = require('./ui_checkbox');

const bind_checkbox = (s, key, options = {}) => ui_checkbox({
  checked:  !!s[key],
  ctx:      options.ctx ?? (options.label ? [options.label] : []),
  disabled: options.disabled ?? false,
  onchange: ev => { s[key] = ev.target.checked; },
});

module.exports = { bind_checkbox };
