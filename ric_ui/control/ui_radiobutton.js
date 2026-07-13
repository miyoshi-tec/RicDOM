// RicUI — ui_radiobutton
// ラジオボタングループ（control カテゴリ）。
// ui_select と同じ options インターフェースを持つ。
//
// options: string[] または { value, label }[] を受け付ける。
//   label は文字列・数値のほか、VDOM ノード（ui_icon 等）や
//   それらの配列も渡せる（例: label: [ui_icon(ICONS.list), ' List']）。
//   追加キー（title / data-* / id / class 等）は各選択肢の <label> に
//   転送される（rest スプレッド契約。例: { value, label, title: '説明' } で
//   ホバー範囲がラジオ丸ごと label 行全体になる。UnizonTool 要望）。
// name:    同じグループの radio input に共通の name 属性（必須）。
//
// checked の実装方針：
//   boolean ではなく numeric（1 / 0）で渡して
//   el[key] = val のプロパティパスを通す（ui_checkbox と同じ方針）。
//
// 使い方：
//   ui_radiobutton({ name: 'role', value: s.role,
//     options: ['viewer', 'editor', 'admin'],
//     onchange: ev => { s.role = ev.target.value; } })

'use strict';

// rest: id / data-* / aria-* / style 等の任意属性を透過する
//       （ui_button / ui_input / ui_panel 等と同じ流儀）
// rest は外側のラッパー <div class="ric-radiogroup"> に付く。
// onchange は input 要素に掛ける必要があるため rest には入れない。
const ui_radiobutton = ({
  name     = '',
  value    = '',
  options  = [],
  onchange = null,
  disabled = false,
  ...rest
} = {}) => {
  const str_val = String(value);

  // options を { value, label } 形式に正規化する
  const normalize = (opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt;

  // label を span の ctx 配列に変換する。
  //   配列      → そのまま ctx（例: [ui_icon(...), ' List']）
  //   VDOM ノード → 単一要素 ctx（ui_icon 等のオブジェクト。null は除外）
  //   文字列/数値 → String 化（従来挙動。null/undefined も "null"/"undefined" になる）
  const label_ctx = (l) =>
    Array.isArray(l)                    ? l
    : (l != null && typeof l === 'object') ? [l]
    : [String(l)];

  const radio_nodes = options.map((opt) => {
    // opt_rest: 各選択肢の追加キー（title / data-* / id / class 等）。
    // tag / ctx は構造要素のため opt_rest では上書きされないよう分離する。
    const { value: v, label: l, ...opt_rest } = normalize(opt);
    const str_v = String(v);
    const cls_base = disabled ? 'ric-radio ric-radio--disabled' : 'ric-radio';
    // class だけは置換ではなく連結（ui_button 等と同じ流儀）
    const cls = opt_rest.class ? cls_base + ' ' + opt_rest.class : cls_base;
    return {
      ...opt_rest,
      tag:   'label',
      class: cls,
      ctx: [
        {
          tag:  'input',
          type: 'radio',
          name,
          value: str_v,
          // numeric で渡すことで el.checked = val のプロパティパスを通す
          checked: str_v === str_val ? 1 : 0,
          ...(onchange ? { onchange }       : {}),
          ...(disabled ? { disabled: true } : {}),
        },
        { tag: 'span', class: 'ric-radio__label', ctx: label_ctx(l) },
      ],
    };
  });

  return {
    ...rest,
    tag:   'div',
    class: rest.class ? 'ric-radiogroup ' + rest.class : 'ric-radiogroup',
    ctx:   radio_nodes,
  };
};

module.exports = { ui_radiobutton };
