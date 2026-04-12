// RicUI — bind_input
// ui_input を state と双方向バインドする便利関数。
//
// 使い方：
//   bind_input(s, 'name', { placeholder: '名前を入力…' })
//   bind_input(s, 'age',  { type: 'number' })
//
// ⚠️ IME 注意：controlled input のため IME 確定前に value が上書きされる場合がある。
//   日本語入力が主用途の場合は oninput ではなく onchange を検討すること。

'use strict';

const { ui_input } = require('./ui_input');

const bind_input = (s, key, options = {}) => ui_input({
  value:       s[key] ?? '',
  placeholder: options.placeholder ?? '',
  type:        options.type        ?? 'text',
  disabled:    options.disabled    ?? false,
  oninput: ev => { s[key] = ev.target.value; },
});

module.exports = { bind_input };
