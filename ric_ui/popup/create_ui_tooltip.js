// RicUI — create_ui_tooltip
// ホバーで表示するツールチップ（ポータルパターン）。
//
// 使い方:
//   const tip = s.tip ??= create_ui_tooltip();
//   tip({ content: 'ヒントテキスト', ctx: [ui_button(...)] })
//
// 1インスタンス = 1トリガー。複数のトリガーには複数のインスタンスを生成する。
// dir: 'auto'（デフォルト）| 'top' | 'bottom' | 'right' | 'left'
//   auto の場合は top → bottom → right → left の優先順でスペースを判定する。
//
// 内部状態（短縮名 → 原名）:
//   _o — open  表示状態
//   _p — pos   位置情報オブジェクト
//   _d — dir   展開方向

'use strict';

const _portal = require('./_page_portal_queue');
const { _pos_style, _get_portal_cb } = require('./_popup_utils');

const create_ui_tooltip = () => {
  const { apply_theme_to_portal } = require('./_wrap_portal');

  const inst = ({ content, ctx, dir = 'auto', theme, density, font_size }) => {
    if (inst._o) {
      const portal_items = [{
        tag:   'div',
        class: 'ric-tooltip__popup ric-tooltip__popup--' + inst._d,
        style: _pos_style(inst._p),
        ctx:   [typeof content === 'string' ? { tag: 'span', ctx: [content] } : content],
      }];
      _portal.push(...apply_theme_to_portal(portal_items, { theme, density, font_size }));
    }
    return {
      tag: 'span', class: 'ric-tooltip',
      onmouseenter: (e) => {
        const rect  = e.currentTarget.getBoundingClientRect();
        const cb    = _get_portal_cb(e.currentTarget);
        const POP_H = 34, POP_W = 120, GAP = 8;
        const chosen = dir !== 'auto' ? dir
          : (rect.top    - cb.top)      >= POP_H + GAP ? 'top'
          : (cb.bottom   - rect.bottom) >= POP_H + GAP ? 'bottom'
          : (cb.right    - rect.right)  >= POP_W + GAP ? 'right'
          : 'left';
        inst._d = chosen;
        const cx = rect.left - cb.left + rect.width  / 2;
        const cy = rect.top  - cb.top  + rect.height / 2;
        if      (chosen === 'top')    inst._p = { bottom: cb.bottom - rect.top    + GAP, left: cx };
        else if (chosen === 'bottom') inst._p = { top:    rect.bottom - cb.top    + GAP, left: cx };
        else if (chosen === 'right')  inst._p = { left:   rect.right - cb.left    + GAP, top:  cy };
        else                          inst._p = { right:  cb.right   - rect.left  + GAP, top:  cy };
        inst._o = true;
        inst.__notify?.();
      },
      onmouseleave: () => { inst._o = false; inst.__notify?.(); },
      ctx,
    };
  };

  inst._o = false; // open
  inst._p = {};    // pos
  inst._d = 'top'; // dir

  return inst;
};

module.exports = { create_ui_tooltip };
