// RicUI — ui_input
// テキスト入力フィールド（control カテゴリ）。
// 既定では width: 100% で親コンテナの幅に合わせる。
// style / class 等の追加属性は rest スプレッドで透過する。

'use strict';

const ui_input = ({
  placeholder = '',
  value       = '',
  oninput     = null,
  type        = 'text',
  disabled    = false,
  maxlength   = null,
  ...rest
} = {}) => ({
  tag:   'input',
  class: rest.class ? 'ric-input ' + rest.class : 'ric-input',
  type,
  value,                                               // 常に含める（空文字でも el.value = '' が確実に走るよう）
  ...(placeholder          ? { placeholder }    : {}),
  ...(oninput              ? { oninput }         : {}),
  ...(disabled             ? { disabled: true }  : {}),
  ...(maxlength != null    ? { maxlength }       : {}),
  ...rest,
});

module.exports = { ui_input };
