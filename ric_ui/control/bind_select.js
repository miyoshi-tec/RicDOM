// RicUI — bind_select
// ui_select を state と双方向バインドする便利関数。
//
// 使い方：
//   bind_select(s, 'role', { options: ['viewer', 'editor', 'admin'] })
//   bind_select(s, 'lang', {
//     options:     [{ value: 'ja', label: '日本語' }, { value: 'en', label: 'English' }],
//     placeholder: '言語を選択…',
//   })

'use strict';

const { ui_select } = require('./ui_select');

const bind_select = (s, key, options = {}) => ui_select({
  value:       String(s[key] ?? ''),
  options:     options.options     ?? [],
  placeholder: options.placeholder ?? '',
  disabled:    options.disabled    ?? false,
  onchange: ev => { s[key] = ev.target.value; },
});

module.exports = { bind_select };
