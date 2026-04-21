// RicUI — bind_textarea
// ui_textarea を state と双方向バインドする便利関数。
//
// 使い方:
//   bind_textarea(s, 'memo', { auto_resize: { min_rows: 2, max_rows: 8 } })
//
// ⚠️ IME 注意：controlled な textarea では IME 確定前に value が上書きされる
//   場合がある。日本語入力中心の場面では onchange 方式を検討すること。

'use strict';

const { ui_textarea } = require('./ui_textarea');

const bind_textarea = (s, key, options = {}) => ui_textarea({
  value: s[key] ?? '',
  oninput: (ev) => { s[key] = ev.target.value; },
  ...options,
});

module.exports = { bind_textarea };
