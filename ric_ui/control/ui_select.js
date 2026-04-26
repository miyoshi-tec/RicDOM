// RicUI — ui_select
// プルダウン選択（control カテゴリ）。
//
// CSS `appearance: base-select` により、ドロップダウンの見た目を
// テーマ色で統一する（Chrome 135+）。ネイティブ <select> なので
// キーボード操作・アクセシビリティ・モバイル対応はブラウザが提供する。
//
// options: string[] または { value, label }[] を受け付ける。
// placeholder: 先頭に「未選択」オプション（選択不可）を追加する。
//
// selected の実装方針：
//   select.value を初回ビルド時に設定しても option がまだ存在しないため、
//   選択中の option に selected: 1 を付与する方式を採用する。
//   boolean ではなく numeric で渡して el[key] = val パスを通す。

'use strict';

const ui_select = ({
  value       = '',
  options     = [],
  onchange    = null,
  disabled    = false,
  placeholder = '',
  ...rest
} = {}) => {
  const str_val = String(value);

  // options を { value, label } 形式に正規化する
  const normalize = (opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt;

  const option_nodes = [
    // placeholder がある場合は先頭に「未選択」オプションを追加（選択不可）
    placeholder
      ? { tag: 'option', value: '', disabled: true,
          selected: str_val === '' ? 1 : 0, ctx: [placeholder] }
      : null,
    ...options.map((opt) => {
      const { value: v, label: l } = normalize(opt);
      const str_v = String(v);
      return {
        tag: 'option',
        value: str_v,
        selected: str_v === str_val ? 1 : 0,
        ctx: [String(l)],
      };
    }),
  ].filter(Boolean);

  // rest スプレッド契約: ...rest を先頭に置き、算出値（tag/class/onchange/
  // disabled/ctx）で上書きする。rest.class は基底クラスに連結する。
  return {
    ...rest,
    tag:   'select',
    class: rest.class ? 'ric-select ' + rest.class : 'ric-select',
    ...(onchange ? { onchange }       : {}),
    ...(disabled ? { disabled: true } : {}),
    ctx: option_nodes,
  };
};

module.exports = { ui_select };
