// RicUI — create_ui_accordion
// 開閉パネルリスト（アコーディオン）。内部状態付き版。
//
// 使い方:
//   const acc = s.acc = create_ui_accordion({ default_open: { a: true } });
//   acc({
//     items: [
//       { id: 'a', title: 'タイトル', ctx: [ui_text({ ctx: ['本文'] })] },
//       ...
//     ],
//     multi: true,  // true = 複数パネルを同時展開可（デフォルト）
//                   // false = 常に 1 パネルのみ展開（排他）
//   })
//
// アニメーション: grid-template-rows: 0fr → 1fr のトリックで
// auto 高さに対してアニメーションする（scrollHeight 計測不要）。
//
// 内部状態:
//   _om  — open_map   { [id]: boolean }  各パネルの開閉状態

'use strict';

const create_ui_accordion = ({ default_open = {} } = {}) => {
  const inst = ({ items = [], multi = true } = {}) => ({
    tag: 'div', class: 'ric-accordion',
    ctx: items.map(({ id, title, ctx: item_ctx }) => {
      const is_open = !!inst._om[id];
      return {
        tag: 'div', class: 'ric-accordion__item',
        ctx: [
          { tag: 'button',
            class: 'ric-accordion__header' + (is_open ? ' ric-accordion__header--open' : ''),
            onclick: () => {
              if (!multi) {
                // 排他モード：他をすべて閉じる
                Object.keys(inst._om).forEach(k => { inst._om[k] = false; });
              }
              inst._om[id] = !is_open;
              inst.__notify?.();
            },
            ctx: [
              { tag: 'span', class: 'ric-accordion__title', ctx: [title] },
              { tag: 'span', class: 'ric-accordion__arrow', ctx: ['❯'] },
            ],
          },
          { tag: 'div',
            class: 'ric-accordion__body' + (is_open ? ' ric-accordion__body--open' : ''),
            ctx: [
              { tag: 'div', class: 'ric-accordion__body-inner',
                ctx: Array.isArray(item_ctx) ? item_ctx : [item_ctx] },
            ],
          },
        ],
      };
    }),
  });

  inst._om = { ...default_open }; // open_map: 初期展開状態

  return inst;
};

module.exports = { create_ui_accordion };
