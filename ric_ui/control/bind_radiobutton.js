// RicUI — bind_radiobutton
// ui_radiobutton を state と双方向バインドする便利関数。
// name のデフォルトは key だが、同一ページに同じ key の
// グループを複数置く場合は options.name で別名を指定する。
// （ブラウザは name が同じ radio を1グループとして扱うため、
//   複数グループが同一 key にバインドするときは名前を変えないと
//   同時にチェックが付かなくなる）
//
// 使い方：
//   bind_radiobutton(s, 'role', { options: ['viewer', 'editor', 'admin'] })
//   bind_radiobutton(s, 'role', { name: 'role_ja',
//     options: [{ value: 'viewer', label: '閲覧者' }, ...] })

'use strict';

const { ui_radiobutton } = require('./ui_radiobutton');

const bind_radiobutton = (s, key, options = {}) => ui_radiobutton({
  name:     options.name    ?? key,
  value:    String(s[key] ?? ''),
  options:  options.options  ?? [],
  disabled: options.disabled ?? false,
  onchange: ev => { s[key] = ev.target.value; },
});

module.exports = { bind_radiobutton };
