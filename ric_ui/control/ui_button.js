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
//
// rest スプレッド:
//   onclick / id / data-* / aria-* / style 等の任意属性を透過する。
//   rest を先頭に展開してから計算済み tag / class / ctx / onclick / disabled で
//   上書きするため、rest から tag や class を渡しても基底クラスは保たれる。
//   （rest を最後に置くと class: 'ric-button foo' が rest.class='foo' で上書きされる）

'use strict';

const ui_button = ({ ctx = [], variant = 'default', onclick = null, disabled = false, ...rest } = {}) => {
  // バリアントクラスを付与する（default の場合は付与しない）
  const cls_base = variant !== 'default'
    ? `ric-button ric-button--${variant}`
    : 'ric-button';

  return {
    ...rest,
    tag: 'button',
    class: rest.class ? cls_base + ' ' + rest.class : cls_base,
    ...(onclick   ? { onclick }        : {}),
    ...(disabled  ? { disabled: true } : {}),
    ctx,
  };
};

module.exports = { ui_button };
