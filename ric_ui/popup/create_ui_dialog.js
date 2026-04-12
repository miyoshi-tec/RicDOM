// RicUI — create_ui_dialog
// モーダルダイアログ（ポータルパターン）。
//
// 使い方:
//   const dlg = s.dlg ??= create_ui_dialog();
//   dlg({ trigger_ctx: ['開く'], title: '...', ctx: [...], actions: [...] })
//
// 1インスタンス = 1ダイアログ。
// 開いているときバックドロップ＋ダイアログ本体を _page_portal_queue に積む。
// ui_page がレンダー時に取り出して .ric-page 末尾に展開する（ポータルパターン）。
//
// 内部状態（短縮名 → 原名）:
//   _o — open     開閉状態
//   _c — closing  閉じるアニメーション中フラグ

'use strict';

const _portal = require('./_page_portal_queue');

const create_ui_dialog = () => {

  // アニメーション終了時の後片付け
  const _on_anim_end = () => {
    if (!inst._c) return;
    inst._o = false;
    inst._c = false;
    inst.__notify?.(); // 再描画してポータルから除去
  };

  // アニメーション付きクローズ
  const _do_close = () => {
    if (inst._c) return; // 二重呼び出し防止
    inst._c = true;
    inst.__notify?.(); // 再描画して --out クラスを付与
  };

  const { apply_theme_to_portal } = require('./_wrap_portal');

  // inst(props) → trigger ボタン VDOM
  // 開いているときはバックドロップ＋ダイアログ本体をキューに積む。
  const inst = ({ trigger_ctx = ['開く'], title = '', ctx = [], actions = [], trigger_variant = 'primary',
                  theme, density, font_size } = {}) => {
    if (inst._o) {
      const portal_items = [
        // 半透明バックドロップ（外クリックで閉じる）
        { tag: 'div',
          class: 'ric-dialog__overlay' + (inst._c ? ' ric-dialog__overlay--out' : ''),
          style: 'position:fixed;inset:0;z-index:500',
          onclick: _do_close },
        // ダイアログ本体（DOM 順でバックドロップの後 → 自然に前面）
        { tag: 'div',
          class: 'ric-dialog' + (inst._c ? ' ric-dialog--out' : ''),
          style: 'position:fixed;z-index:501;top:50%;left:50%;transform:translate(-50%,-50%)',
          onanimationend: _on_anim_end,
          ctx: [
            { tag: 'div', class: 'ric-dialog__header', ctx: [
              { tag: 'span', class: 'ric-dialog__title', ctx: [title] },
              { tag: 'button', class: 'ric-dialog__close',
                onclick: _do_close,
                ctx: ['✕'] },
            ]},
            ctx.length    ? { tag: 'div', class: 'ric-dialog__body',   ctx }     : null,
            actions.length ? { tag: 'div', class: 'ric-dialog__footer', ctx: actions } : null,
          ].filter(Boolean),
        },
      ];
      _portal.push(...apply_theme_to_portal(portal_items, { theme, density, font_size }));
    }

    // trigger ボタンを返す（ダイアログ本体はポータル経由で表示）
    return {
      tag: 'button',
      class: trigger_variant !== 'default' ? `ric-button ric-button--${trigger_variant}` : 'ric-button',
      onclick: () => {
        if (inst._o) {
          _do_close(); // 開いているときはアニメーション付きで閉じる
        } else {
          inst._c = false;
          inst._o = true;
          inst.__notify?.();
        }
      },
      ctx: trigger_ctx,
    };
  };

  inst._o = false; // open
  inst._c = false; // closing

  // 外部から閉じるための API（アニメーション付き）
  inst.close = _do_close;

  return inst;
};

module.exports = { create_ui_dialog };
