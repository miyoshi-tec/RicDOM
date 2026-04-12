// RicUI — ui_button
// クリック可能なボタン（control カテゴリ）。
//
// variant:
//   'default' → 標準ボタン（パネル背景色）
//   'primary' → アクセント色の目立つボタン
//   'ghost'   → 背景なし、ホバーで浮き出る（メニュー項目等に）
//
// CSS テンプレートがすべてのバリアントを網羅しているため、
// JS 側では class 文字列を付与するだけでよい。
// style / class 等の追加属性は rest スプレッドで透過する。

'use strict';

const ui_button = ({ ctx = [], variant = 'default', onclick = null, disabled = false, ...rest } = {}) => {
  // バリアントクラスを付与する（default の場合は付与しない）
  const cls = variant !== 'default'
    ? `ric-button ric-button--${variant}`
    : 'ric-button';

  return {
    tag: 'button',
    class: rest.class ? cls + ' ' + rest.class : cls,
    ...(onclick   ? { onclick }        : {}),
    ...(disabled  ? { disabled: true } : {}),
    ...rest,
    ctx,
  };
};

module.exports = { ui_button };
