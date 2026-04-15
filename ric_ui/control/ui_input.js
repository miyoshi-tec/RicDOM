// RicUI — ui_input
// テキスト入力フィールド（control カテゴリ）。
// 既定では width: 100% で親コンテナの幅に合わせる。
//
// rest スプレッド:
//   onchange / id / data-* / aria-* / style 等の任意属性を透過する。
//   rest を先頭に展開してから計算済み tag / class / type / value で上書きするため、
//   rest から tag や class を渡しても基底クラスは保たれる。
//   （rest を最後に置くと class: 'ric-input foo' が rest.class='foo' で上書きされる）

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
  ...rest,
  tag:   'input',
  class: rest.class ? 'ric-input ' + rest.class : 'ric-input',
  type,
  value,                                               // 常に含める（空文字でも el.value = '' が確実に走るよう）
  ...(placeholder          ? { placeholder }    : {}),
  ...(oninput              ? { oninput }         : {}),
  ...(disabled             ? { disabled: true }  : {}),
  ...(maxlength != null    ? { maxlength }       : {}),
});

module.exports = { ui_input };
