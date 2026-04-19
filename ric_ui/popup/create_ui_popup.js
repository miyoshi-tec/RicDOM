// RicUI — create_ui_popup
// 汎用ポップアップ（ポータルパターン）。
// 旧 create_ui_dropdown / create_ui_menu を統合。
//
// 使い方:
//   s.dd   ??= create_ui_popup();
//   s.menu ??= create_ui_popup();
//   s.cfg  ??= create_ui_popup();
//
//   // ラベル付き（旧 dropdown）— ポップアップはボタン幅に合う
//   s.dd({ label: '選択肢', ctx: [...] })
//
//   // アイコン（旧 menu）— 正方形ボタン、ポップアップは min-width: 160px
//   s.menu({ icon: '≡', ctx: [...] })
//
//   // ghost: ホバーまで枠を隠す
//   s.cfg({ icon: '⚙', ghost: true, ctx: [...] })
//
// 1インスタンス = 1トリガー。
// 開いているときオーバーレイ＋ポップアップを _page_portal_queue に積む。
// ui_page がレンダー時に取り出して .ric-page 末尾に展開する（ポータルパターン）。
//
// 内部状態（短縮名 → 原名）:
//   _o  — open          開閉状態
//   _c  — closing       閉じるアニメーション中
//   _d  — dir           ポップアップ展開方向 ('below'|'above')
//   _p  — pos           位置情報オブジェクト
//   _er — expand_right  左右配置フラグ

'use strict';

const _portal = require('./_page_portal_queue');
const {
  make_popup_dir, _pos_style, _get_portal_cb, _get_expand_ref, _register_popup, _close_others,
} = require('./_popup_utils');

const create_ui_popup = () => {

  // アニメーション終了時の後片付け
  const _on_anim_end = () => {
    if (!inst._c) return;
    inst._o = false;
    inst._c = false;
    inst.__notify?.();
  };

  // アニメーション付きクローズ
  const _do_close = () => {
    if (inst._c) return;
    inst._c = true;
    inst.__notify?.();
  };

  const { apply_theme_to_portal } = require('./_wrap_portal');

  // inst(props) → VDOM
  const inst = ({ label, icon, ghost = false, ctx = [], theme, density, font_size } = {}) => {
    // label / icon どちらもなければデフォルトアイコン
    const is_label = !!label && !icon;
    const trigger_text = icon ?? (label ? undefined : '≡');

    if (inst._o) {
      const portal_items = [
        // 透明オーバーレイ：外クリックで閉じる
        { tag: 'div', style: 'position:fixed;inset:0;z-index:401',
          onclick: _do_close },
        // ポップアップ本体
        { tag: 'div',
          class: 'ric-popup__body ric-popup__body--' + inst._d
               + (inst._c ? ' ric-popup__body--out' : ''),
          style: _pos_style(inst._p),
          onclick: _do_close,
          onanimationend: _on_anim_end,
          ctx: ctx,
        },
      ];
      _portal.push(...apply_theme_to_portal(portal_items, { theme, density, font_size }));
    }

    // トリガーボタンの class を組み立て
    const trigger_cls = 'ric-popup__trigger'
      + (is_label ? ' ric-popup__trigger--label' : '')
      + (ghost    ? ' ric-popup__trigger--ghost'  : '')
      + (inst._o  ? ' ric-popup__trigger--open' : '');

    return {
      tag: 'div', class: 'ric-popup',
      ctx: [
        { tag: 'button', class: trigger_cls,
          onclick: (e) => {
            if (inst._c) return;
            if (inst._o) {
              _do_close();
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              const cb   = _get_portal_cb(e.currentTarget);
              inst._d    = make_popup_dir(e.currentTarget, ctx.length * 38 + 8);
              _close_others(inst);

              if (is_label) {
                // ラベルモード：ボタン幅を最小幅として、コンテンツに合わせて広がる
                inst._p = {
                  top:    inst._d === 'below' ? rect.bottom - cb.top + 2  : undefined,
                  bottom: inst._d === 'above' ? cb.bottom - rect.top + 2  : undefined,
                  left:   rect.left - cb.left,
                  minWidth: rect.width,
                };
              } else {
                // アイコンモード：左右スマート配置
                const ref = _get_expand_ref(e.currentTarget);
                inst._er = rect.left < (ref.left + ref.right) / 2;
                inst._p = {
                  top:    inst._d === 'below' ? rect.bottom - cb.top + 4  : undefined,
                  bottom: inst._d === 'above' ? cb.bottom - rect.top + 4  : undefined,
                  left:   inst._er ? rect.left - cb.left : undefined,
                  right:  inst._er ? undefined : cb.right - rect.right,
                };
              }

              inst._o = true;
              inst.__notify?.();
            }
          },
          ctx: is_label
            ? [{ tag: 'span', ctx: [label] }]
            : [trigger_text],
        },
      ],
    };
  };

  // 内部状態
  inst._o  = false;   // open
  inst._c  = false;   // closing
  inst._d  = 'below'; // dir
  inst._er = true;    // expand_right
  inst._p  = {};      // pos

  // 外部・排他制御から閉じるための API（即座・アニメなし）
  inst.close = () => {
    inst._o = false;
    inst._c = false;
  };

  // 排他制御リストに登録（モジュールレベル）
  _register_popup(inst);
  return inst;
};

module.exports = { create_ui_popup };
