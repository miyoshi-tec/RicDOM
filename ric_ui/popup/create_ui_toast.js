// RicUI — create_ui_toast
// トースト通知（ポータルパターン）。
//
// 使い方:
//   const toast = s.toast ??= create_ui_toast();
//   // render 関数内で毎回呼ぶ（ポータル登録）:
//   toast();  // → null を返す（副作用のみ）
//   // 通知を表示する（どこからでも呼べる）:
//   toast.show('保存しました！', { type: 'success', duration: 3000 });
//   toast.show('エラー',         { type: 'error',   duration: 0    }); // 0 = 自動消去なし
//
// type: 'default' | 'success' | 'error' | 'warning' | 'info'
//
// 内部状態（短縮名 → 原名）:
//   _it — items    アクティブなトーストの配列
//   _ni — next_id  ID カウンタ

'use strict';

const _portal                   = require('./_page_portal_queue');
const { apply_theme_to_portal } = require('./_wrap_portal');

const create_ui_toast = () => {

  // トースト除去
  const _remove = (id) => {
    const idx = inst._it.findIndex(x => x.id === id);
    if (idx >= 0) inst._it.splice(idx, 1);
    inst.__notify?.();
  };

  // アニメーション付きクローズ
  const _do_close = (item) => {
    if (item._c) return;
    item._c = true;
    inst.__notify?.();
  };

  // inst({ theme, density, font_size }) → null（ポータル登録のみ）
  // render 関数内で毎回呼ぶ: toast(); return s.page({ ... });
  const inst = ({ theme, density, font_size } = {}) => {
    if (inst._it.length > 0) {
      const portal_items = [{
        tag:   'div',
        class: 'ric-toast__container',
        style: 'position:fixed;bottom:20px;right:20px;z-index:600'
             + ';display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none',
        ctx: inst._it.map(item => ({
          tag:   'div',
          class: 'ric-toast__item'
               + (item._e ? ' ric-toast__item--in' : '')
               + (item.type && item.type !== 'default' ? ' ric-toast__item--' + item.type : '')
               + (item._c ? ' ric-toast__item--out' : ''),
          style: 'pointer-events:auto',
          onanimationend: item._c ? () => _remove(item.id) : item._e ? () => { item._e = false; } : undefined,
          ctx: [
            { tag: 'span', class: 'ric-toast__msg',   ctx: [item.msg] },
            { tag: 'button', class: 'ric-toast__close',
              onclick: () => _do_close(item),
              ctx: ['✕'] },
          ],
        })),
      }];
      _portal.push(...apply_theme_to_portal(portal_items, { theme, density, font_size }));
    }
    return null;
  };

  inst._it = []; // items: { id, msg, type, _c(closing), _e(entering) }
  inst._ni = 0;  // next_id

  // toast.show(msg, options) — 通知を追加する
  inst.show = (msg, { type = 'default', duration = 3000 } = {}) => {
    const item = { id: inst._ni++, msg, type, _c: false, _e: true };
    inst._it.push(item);
    inst.__notify?.();
    if (duration > 0) {
      setTimeout(() => _do_close(item), duration);
    }
  };

  return inst;
};

module.exports = { create_ui_toast };
