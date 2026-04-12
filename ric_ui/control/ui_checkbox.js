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

const ui_checkbox = ({
  ctx      = [],
  checked  = false,
  onchange = null,
  disabled = false,
} = {}) => {
  const cls = disabled ? 'ric-checkbox ric-checkbox--disabled' : 'ric-checkbox';
  return {
    tag:   'label',
    class: cls,
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
