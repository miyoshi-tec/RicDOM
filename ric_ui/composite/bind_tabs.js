// RicUI — bind_tabs
// ui_tabs を state と双方向バインドする便利関数。
//
// 使い方:
//   // state 初期値でデフォルトタブを決める
//   create_RicDOM('#app', {
//     tab: 'profile',
//     render(s) {
//       return bind_tabs(s, 'tab', {
//         items: [
//           { key: 'profile', label: 'プロフィール', ctx: [...] },
//           { key: 'notify',  label: '通知設定',    ctx: [...] },
//         ],
//       });
//     },
//   });

'use strict';

const { ui_tabs } = require('./ui_tabs');

const bind_tabs = (s, key, options = {}) => ui_tabs({
  items:    options.items   ?? [],
  active:   s[key],
  onchange: (new_key) => { s[key] = new_key; },
  variant:  options.variant ?? 'line',
});

module.exports = { bind_tabs };
