// RicUI — create_ui_dialog
// モーダルダイアログ（ポータルパターン）。
//
// 使い方（uncontrolled — トリガーボタン付き）:
//   s.dlg = create_ui_dialog();
//   dlg({ trigger_ctx: ['開く'], title: '...', ctx: [...], actions: [...] })
//
// 使い方（controlled — 外部 state 管理）:
//   s.dlg = create_ui_dialog();
//   dlg({ open: s.page.show, on_close: () => { s.page.show = false; },
//         title: '...', ctx: [...] })
//   // → 戻り値は null（トリガーボタンなし）
//
// trigger_ctx と open の併用は禁止（hybrid 禁止）。
//
// 1インスタンス = 1ダイアログ。
// 開いているときバックドロップ＋ダイアログ本体を _page_portal_queue に積む。
// ui_page がレンダー時に取り出して .ric-page 末尾に展開する（ポータルパターン）。
//
// 内部状態（短縮名 → 原名）:
//   _o  — open        開閉状態（uncontrolled 用）
//   _c  — closing     閉じるアニメーション中フラグ
//   _po — prev_open   前回 render の open 値（controlled 遷移検出用）
//   _eb — esc_bound   ESC ハンドラの bind 状態
//   _cd — controlled  直近の render が controlled かどうか
//   _oc — on_close    直近の on_close コールバック参照

'use strict';

const _portal                   = require('./_page_portal_queue');
const { apply_theme_to_portal } = require('./_wrap_portal');

const create_ui_dialog = () => {

  // アニメーション終了時の後片付け
  const _on_anim_end = () => {
    if (!inst._c) return;
    if (!inst._cd) inst._o = false;   // uncontrolled のみ内部 open をリセット
    inst._c = false;
    inst.__notify?.(); // 再描画してポータルから除去
  };

  // アニメーション付きクローズ（uncontrolled 専用）
  const _do_close = () => {
    if (inst._c) return; // 二重呼び出し防止
    inst._c = true;
    inst.__notify?.(); // 再描画して --out クラスを付与
  };

  // 閉じ要求（overlay / ✕ / ESC から呼ばれる共通エントリポイント）
  const _request_close = () => {
    if (inst._c) return;                     // 閉じアニメーション中
    if (inst._cd) {
      inst._oc?.();                          // controlled: 親に通知（状態は変更しない）
    } else {
      _do_close();                           // uncontrolled: 既存動作
    }
  };

  // ESC キーハンドラ（ファクトリ作成時に 1 回だけ定義）
  const _esc_handler = (e) => {
    if (e.key === 'Escape') _request_close();
  };

  // inst(props) → VDOM（uncontrolled: trigger ボタン / controlled: null）
  // 開いているときはバックドロップ＋ダイアログ本体をキューに積む。
  const inst = (props = {}) => {
    const {
      trigger_ctx, title = '', ctx = [], actions = [],
      trigger_variant = 'primary', open, on_close,
      theme, density, font_size,
    } = props;

    const controlled = open !== undefined;

    // hybrid 禁止: trigger_ctx と open の併用
    if (controlled && 'trigger_ctx' in props) {
      console.error('[create_ui_dialog] open と trigger_ctx は併用できません。controlled mode では trigger_ctx は無視されます。');
    }

    // 最新の controlled 情報をキャッシュ（イベントハンドラが参照）
    inst._cd = controlled;
    inst._oc = on_close;

    // ── controlled: open 遷移検出 ──
    if (controlled) {
      if (open && !inst._po)              inst._c = false;       // 開く（残留 _c をクリア）
      if (!open && inst._po && !inst._c)  inst._c = true;       // 閉じ → アニメーション開始
      inst._po = open;
    }

    // ── 表示判定 ──
    const should_show = controlled ? (open || inst._c) : inst._o;

    // ── ESC キー bind / unbind ──
    if (typeof document !== 'undefined') {
      if (should_show && !inst._eb) {
        document.addEventListener('keydown', _esc_handler);
        inst._eb = true;
      }
      if (!should_show && inst._eb) {
        document.removeEventListener('keydown', _esc_handler);
        inst._eb = false;
      }
    }

    // ── ポータル ──
    if (should_show) {
      const portal_items = [
        // 半透明バックドロップ（外クリックで閉じる）
        { tag: 'div',
          class: 'ric-dialog__overlay' + (inst._c ? ' ric-dialog__overlay--out' : ''),
          style: 'position:fixed;inset:0;z-index:500',
          onclick: _request_close },
        // ダイアログ本体（DOM 順でバックドロップの後 → 自然に前面）
        { tag: 'div',
          class: 'ric-dialog' + (inst._c ? ' ric-dialog--out' : ''),
          style: 'position:fixed;z-index:501;top:50%;left:50%;transform:translate(-50%,-50%)',
          onanimationend: _on_anim_end,
          ctx: [
            { tag: 'div', class: 'ric-dialog__header', ctx: [
              { tag: 'span', class: 'ric-dialog__title', ctx: [title] },
              { tag: 'button', class: 'ric-dialog__close',
                onclick: _request_close,
                ctx: ['✕'] },
            ]},
            ctx.length    ? { tag: 'div', class: 'ric-dialog__body',   ctx }     : null,
            actions.length ? { tag: 'div', class: 'ric-dialog__footer', ctx: actions } : null,
          ].filter(Boolean),
        },
      ];
      _portal.push(...apply_theme_to_portal(portal_items, { theme, density, font_size }));
    }

    // ── 戻り値 ──
    if (controlled) return null;

    // uncontrolled: trigger ボタンを返す（ダイアログ本体はポータル経由で表示）
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
      ctx: trigger_ctx ?? ['開く'],
    };
  };

  inst._o  = false;     // open（uncontrolled 用）
  inst._c  = false;     // closing（アニメーション中フラグ）
  inst._po = undefined; // prev_open（controlled 遷移検出用）
  inst._eb = false;     // esc_bound
  inst._cd = false;     // controlled フラグ（直近 render）
  inst._oc = null;      // on_close コールバック（直近 render）

  // 外部から閉じるための API（両モード対応）
  inst.close = _request_close;

  // 外部から開くための API（uncontrolled のみ。controlled では no-op）
  inst.open = () => {
    if (inst._cd) return;
    if (inst._o || inst._c) return;
    inst._o = true;
    inst.__notify?.();
  };

  return inst;
};

module.exports = { create_ui_dialog };
