// RicUI — ui_checkbox
// チェックボックス + ラベルをまとめた control 部品。
//
// checked:
//   boolean を渡すと RicDOM が setAttribute('checked','') を使うため、
//   numeric（1 / 0）で渡して el[key] = val のプロパティパスを通す。
//
// 使い方：
//   ui_checkbox({ ctx: ['同意する'], checked: s.agree,
//                 onchange: ev => { s.agree = ev.target.checked; } })

'use strict';

// rest: onclick / id / data-* / aria-* 等の任意属性を透過する
//       （ui_button / ui_input / ui_panel 等と同じ流儀）
// 注意: checked / onchange は input 要素に掛ける必要があるため rest には入れない。
//       rest は外側の <label> に付く（wrapper の click ハンドラ等を想定）。
const ui_checkbox = ({
  ctx      = [],
  checked  = false,
  onchange = null,
  disabled = false,
  ...rest
} = {}) => {
  const cls_base = disabled ? 'ric-checkbox ric-checkbox--disabled' : 'ric-checkbox';
  return {
    ...rest,
    tag:   'label',
    class: rest.class ? cls_base + ' ' + rest.class : cls_base,
    ctx: [
      {
        tag:  'input',
        type: 'checkbox',
        // numeric で渡すことで el.checked = val のプロパティパスを通す
        checked:  checked ? 1 : 0,
        ...(onchange ? { onchange }       : {}),
        ...(disabled ? { disabled: true } : {}),
      },
      // ラベルテキストがある場合は span で包む
      ...(ctx.length ? [{ tag: 'span', ctx }] : []),
    ],
  };
};

module.exports = { ui_checkbox };
