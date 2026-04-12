// RicUI — ui_radiobutton
// ラジオボタングループ（control カテゴリ）。
// ui_select と同じ options インターフェースを持つ。
//
// options: string[] または { value, label }[] を受け付ける。
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

const ui_radiobutton = ({
  name     = '',
  value    = '',
  options  = [],
  onchange = null,
  disabled = false,
} = {}) => {
  const str_val = String(value);

  // options を { value, label } 形式に正規化する
  const normalize = (opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt;

  const radio_nodes = options.map((opt) => {
    const { value: v, label: l } = normalize(opt);
    const str_v = String(v);
    const cls = disabled ? 'ric-radio ric-radio--disabled' : 'ric-radio';
    return {
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
        { tag: 'span', ctx: [String(l)] },
      ],
    };
  });

  return {
    tag:   'div',
    class: 'ric-radiogroup',
    ctx:   radio_nodes,
  };
};

module.exports = { ui_radiobutton };
