// RicUI — ui_button
// クリック可能なボタン（control カテゴリ）。
//
// variant:
//   'default' → 標準ボタン（パネル背景色）
//   'primary' → アクセント色の目立つボタン
//   'ghost'   → 枠と背景を透明にし、hover で浮き出る（メニュー項目等に）
//   'link'    → 背景・枠・高さ制限を全部外したテキスト風ボタン
//               (breadcrumb / inline link 用途。density の高さ制約も無視する)
//
// size:
//   undefined → density に従う（既定。--ric-control-h を使う）
//   'sm' | 'md' | 'lg' → 固定の寸法（22px / 28px / 36px）で density を上書き
//   density:'tight' を全体に効かせつつ「この行だけ更に小さく」のようなとき
//   に使う。指定しなければ既存挙動と同じ。
//
// CSS テンプレートがすべてのバリアント・サイズを網羅しているため、
// JS 側では class 文字列を付与するだけでよい。
//
// rest スプレッド:
//   onclick / id / data-* / aria-* / style 等の任意属性を透過する。
//   rest を先頭に展開してから計算済み tag / class / ctx / onclick / disabled で
//   上書きするため、rest から tag や class を渡しても基底クラスは保たれる。
//   （rest を最後に置くと class: 'ric-button foo' が rest.class='foo' で上書きされる）

'use strict';

const ui_button = ({
  ctx = [],
  variant = 'default',
  size,                 // 既定 undefined = density に従う
  onclick = null,
  disabled = false,
  ...rest
} = {}) => {
  // ベース + variant + size を一括で組み立てる
  let cls_base = 'ric-button';
  if (variant !== 'default') cls_base += ' ric-button--' + variant;
  if (size)                  cls_base += ' ric-button--' + size;

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
