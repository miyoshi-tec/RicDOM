// RicUI — create_ui_splitter
// 左/右/上/下の4パターンで使えるリサイズ可能スプリッター。
//
// 使い方:
//   const split = s.split ??= create_ui_splitter({
//     side:        'left',  // 'left' | 'right' | 'top' | 'bottom'
//     size:        240,     // サイドパネルの初期サイズ (px)
//     min:         60,      // 最小サイズ (px)
//     max:         null,    // 最大サイズ (px, null=制限なし)
//     collapsible: true,    // 折り畳みボタンを表示するか
//   });
//
//   // render 内で毎回呼ぶ:
//   split({
//     side: { ctx: [...] },   // サイドパネル（固定サイズ側）
//     main: { ctx: [...] },   // メインパネル（残り全部）
//   })
//
// 内部状態（短縮名 → 原名）:
//   _sz — size       現在のサイドパネルサイズ (px)
//   _cl — collapsed  折り畳み状態
//   _tg — toggling   トグルアニメーション中フラグ
//   _se — side_el    サイドパネル DOM 要素
//   _de — div_el     仕切り線 DOM 要素

'use strict';

// インスタンスごとにユニークな ref 名を生成するためのモジュールレベルカウンタ
let _sp_count = 0;

const create_ui_splitter = ({
  side        = 'left',  // 'left' | 'right' | 'top' | 'bottom'
  size        = 240,
  min         = 60,
  max         = null,
  collapsible = true,
} = {}) => {

  const _id       = ++_sp_count;
  const _ref_side = 'sp_side_' + _id; // サイドパネルの ref 名
  const _ref_div  = 'sp_div_'  + _id; // 仕切り線の ref 名

  // 水平分割 (left/right) か垂直分割 (top/bottom) か
  const _is_h = (side === 'left' || side === 'right');

  // ドラッグ開始時に divider の DOM 要素からサイドパネルを取得する。
  // left/top: [side, divider, main] → previous
  // right/bottom: [main, divider, side] → next
  const _is_side_before = (side === 'left' || side === 'top');
  const _fetch_els_from = (divider_el) => {
    inst._de = divider_el;
    inst._se = _is_side_before
      ? divider_el.previousElementSibling
      : divider_el.nextElementSibling;
  };

  // ── ドラッグ ──────────────────────────────────────────────────────

  const _on_mouse_down = (e) => {
    // 折り畳みボタンのクリックはドラッグ開始させない（ボタン側の onclick に任せる）
    if (e.target.closest && e.target.closest('.ric-splitter__collapse-btn')) return;
    // 折り畳み中はドラッグ無効（展開は onclick で行う）
    if (inst._cl) return;

    e.preventDefault();
    _fetch_els_from(e.currentTarget);

    const start_coord = _is_h ? e.clientX : e.clientY;
    const start_size  = inst._sz;
    // サイドパネルが左/上にある場合は正方向ドラッグで拡大、右/下は逆
    const sign = (side === 'left' || side === 'top') ? 1 : -1;

    // ドラッグ中: トランジション無効化・仕切り線ハイライト
    if (inst._se) inst._se.style.transition = 'none';
    if (inst._de) inst._de.classList.add('ric-splitter__divider--dragging');

    const on_move = (e) => {
      const delta    = (_is_h ? e.clientX : e.clientY) - start_coord;
      let   new_size = start_size + sign * delta;
      new_size = Math.max(min, new_size);
      if (max !== null) new_size = Math.min(max, new_size);
      inst._sz = new_size;
      // DOM を直接更新（再レンダーしない → 60fps で滑らか）
      if (inst._se) inst._se.style.flexBasis = inst._sz + 'px';
    };

    const on_up = () => {
      // トランジション復元・ハイライト解除
      if (inst._se) inst._se.style.transition = '';
      if (inst._de) inst._de.classList.remove('ric-splitter__divider--dragging');
      document.removeEventListener('mousemove', on_move);
      document.removeEventListener('mouseup',   on_up);
      // _sz はクロージャに確定済み。次の自然な再レンダー時に inline style に反映される。
    };

    document.addEventListener('mousemove', on_move);
    document.addEventListener('mouseup',   on_up);
  };

  // ── 折り畳みトグル ────────────────────────────────────────────────

  const _toggle = () => {
    inst._cl = !inst._cl;
    // トグル時のみ flex-basis transition を有効化する。
    // CSS クラスには transition を持たせず、この inline style フラグで制御する。
    // タブ切り替えなど「意図しない flex-basis 変化」でアニメーションが走るのを防ぐため。
    inst._tg = true;
    inst.__notify?.();
    // transitionend イベントで _tg フラグをリセット
  };

  // 折り畳み状態に応じた矢印文字（「どちらに閉じるか」を示す向き）
  const _arrow = () => {
    if (side === 'left')   return inst._cl ? '›' : '‹';
    if (side === 'right')  return inst._cl ? '‹' : '›';
    if (side === 'top')    return inst._cl ? '▼' : '▲';
    /* bottom */           return inst._cl ? '▲' : '▼';
  };

  // ── レンダー ──────────────────────────────────────────────────────

  const inst = ({ main: main_arg = {}, side: side_arg = {} } = {}) => {

    // サイドパネル（固定サイズ側）
    // flex-basis で幅/高さを制御。collapsed 時は 0 に。
    // transition は CSS クラスではなく inline style で管理する（タブ切り替えなど
    // 意図しない flex-basis 変化でアニメーションが走るのを防ぐため）。
    const side_panel = {
      tag:   'div',
      ref:   _ref_side,
      class: 'ric-splitter__side'
           + (inst._cl ? ' ric-splitter__side--collapsed' : ''),
      style: 'flex-shrink:0;flex-basis:' + (inst._cl ? 0 : inst._sz) + 'px'
           + ';overflow:' + (inst._cl || inst._tg ? 'hidden' : 'auto')
           + (inst._tg ? ';transition:flex-basis var(--ric-duration, 200ms) var(--ric-easing, ease)' : ''),
      ontransitionend: inst._tg ? () => { inst._tg = false; } : undefined,
      ctx:   side_arg.ctx || [],
    };

    // 仕切り線（ドラッグハンドル + 折り畳みボタン）
    // onclick: 折り畳み中のみ展開（ドラッグ操作と競合しないよう mousedown とは分離）
    const divider = {
      tag:         'div',
      ref:         _ref_div,
      class:       'ric-splitter__divider',
      onmousedown: _on_mouse_down,
      // 折り畳み中のみ有効。折り畳みボタン由来のバブルはスキップ（二重トグル防止）
      onclick:     inst._cl
                     ? (e) => { if (!e.target.closest('.ric-splitter__collapse-btn')) _toggle(); }
                     : null,
      ctx: collapsible ? [{
        tag:     'button',
        class:   'ric-splitter__collapse-btn',
        onclick: _toggle,
        ctx:     [_arrow()],
      }] : [],
    };

    // メインパネル（残り全部を使う）
    const main_panel = {
      tag:   'div',
      class: 'ric-splitter__main',
      style: 'flex:1;overflow:auto;min-width:0;min-height:0',
      ctx:   main_arg.ctx || [],
    };

    // left/top: サイドパネルが先（左/上）、right/bottom: メインが先
    const children = (side === 'left' || side === 'top')
      ? [side_panel, divider, main_panel]
      : [main_panel, divider, side_panel];

    return {
      tag:   'div',
      class: 'ric-splitter ric-splitter--' + (_is_h ? 'horizontal' : 'vertical')
           + (inst._cl ? ' ric-splitter--collapsed' : ''),
      style: 'display:flex;flex-direction:' + (_is_h ? 'row' : 'column')
           + ';width:100%;height:100%;overflow:hidden',
      ctx:   children,
    };
  };

  inst._sz = size;   // size: 現在のサイドパネルサイズ (px)
  inst._cl = false;  // collapsed: 折り畳み状態
  inst._se = null;   // side_el: サイドパネル DOM 要素（初回取得後キャッシュ）
  inst._de = null;   // div_el: 仕切り線 DOM 要素
  inst._tg = false;  // toggling: トグルアニメーション中フラグ

  // ── 公開 API ─────────────────────────────────────────────────────

  // 外部から折り畳み状態を操作する
  inst.toggle    = _toggle;
  inst.collapsed = () => inst._cl;

  // サイズを取得 / 設定する（設定時は DOM も即時反映）
  inst.get_size = () => inst._sz;
  inst.set_size = (px) => {
    inst._sz = Math.max(min, max !== null ? Math.min(max, px) : px);
    _fetch_els();
    if (inst._se && !inst._cl) inst._se.style.flexBasis = inst._sz + 'px';
  };

  return inst;
};

module.exports = { create_ui_splitter };
