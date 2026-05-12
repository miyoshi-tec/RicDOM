// RicUI — create_ui_collapse_box
// 子要素を「アニメーションしながら現れる / 消える」コンテナの汎用 primitive。
//
// 使い方:
//   s.box = create_ui_collapse_box({
//     direction: 'v',       // 'v' (default) | 'h' | 'both'
//     duration:  200,       // ms (default)
//     easing:    'ease',    // CSS easing 文字列 (default 'ease')
//   });
//
//   // render 内で呼ぶ
//   s.box({ visible: s.expanded, ctx: [...] })
//
// controlled mode 一本: visible を渡さないと開かない (uncontrolled trigger は
// 別 component の責務として持たない)。dialog / splitter の controlled パターンと
// 同じ哲学。
//
// 動作原理 — JS のループ無し、CSS transition + transitionend で完結:
//   - 開始時: 1 回だけ inline style に target サイズを書く
//   - アニメ中: ブラウザの compositor が補間 (JS / RicDOM は走らない)
//   - 終了時: transitionend が 1 回発火 → cleanup
//
// 状態機械 (4 状態):
//   closed   ─ visible:true ──→  entering ─ transitionend ─→  open
//      ↑                                                       │
//      │                                       visible:false   │
//      └── transitionend ── closing ←────────────────────────  ┘
//
//   中断 (アニメ中に visible が反転) は entering ⇄ closing 直接遷移。
//   現在の補間値を getBoundingClientRect で snapshot して新 transition の
//   start にする。
//
// 内部状態 (短縮名 → 原名):
//   _o  — open       DOM が存在する (entering / open / closing いずれか)
//   _e  — entering   enter アニメ進行中
//   _c  — closing    exit アニメ進行中

'use strict';

const { safe_notify } = require('../_factory_helpers');

// 複数インスタンス識別用のモジュールレベルカウンタ。
// 各 instance に unique な data-ric-cb 属性を付け、querySelector で DOM
// 参照する (RicDOM の ref: はファクトリから handle.refs にアクセスできない
// ため、scroll_pane と同じ data 属性 lookup を採用)。
let _next_id = 0;

const create_ui_collapse_box = ({
  direction = 'v',
  duration  = 200,
  easing    = 'ease',
} = {}) => {

  const _id   = ++_next_id;
  const _attr = 'data-ric-cb';

  const _find_el = () =>
    (typeof document !== 'undefined')
      ? document.querySelector(`[${_attr}="${_id}"]`)
      : null;

  // 「width/height の transition」だけを定義 (direction に応じて)
  const _transition_str =
      direction === 'both' ? `width ${duration}ms ${easing}, height ${duration}ms ${easing}`
    : direction === 'h'    ? `width ${duration}ms ${easing}`
    :                        `height ${duration}ms ${easing}`;

  // inline style の width / height を指定する (direction で対象軸だけ)
  const _set_size = (el, w, h) => {
    if (direction === 'v' || direction === 'both') el.style.height = h === null ? '' : (h + 'px');
    if (direction === 'h' || direction === 'both') el.style.width  = w === null ? '' : (w + 'px');
  };

  // natural サイズを測る (overflow:hidden + height:0 でも scrollHeight は
  // 子要素の自然サイズを返すので、temporarily 解除する必要はない)
  const _measure_natural = (el) => ({ w: el.scrollWidth, h: el.scrollHeight });

  // 現在の補間値を測る (中断時の snapshot 用)
  const _measure_current = (el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  };

  // transitionend → cleanup
  const _on_transition_end = (e) => {
    // 親要素の transition は無視 (collapse-box 自身の width/height のみ反応)
    if (e.propertyName !== 'width' && e.propertyName !== 'height') return;
    const el = _find_el();
    if (!el || e.target !== el) return;

    if (inst._c) {
      // exit 完了 → unmount
      inst._o = false;
      inst._c = false;
      safe_notify(inst, 'create_ui_collapse_box');
      return;
    }
    if (inst._e) {
      // enter 完了 → inline style を全部外して natural reflow に戻す
      inst._e = false;
      el.style.width      = '';
      el.style.height     = '';
      el.style.overflow   = '';
      el.style.transition = '';
    }
  };

  // 「mount 直後 (entering) に target サイズを書いて transition を発火させる」
  // ハンドラ。rAF 2 回分待ってから走らせる:
  //   - 1 frame 目: render() が emit した height:0 で DOM がコミット
  //   - 2 frame 目: scrollHeight 読み (force reflow) → height:natural を set
  //                 → browser が transition を発火
  const _kick_enter = () => {
    const el = _find_el();
    if (!el || !inst._e) return;
    const nat = _measure_natural(el);
    _set_size(el, nat.w, nat.h);
  };

  // 「visible:false 受信時に現在サイズを snapshot して 0 へ向ける」ハンドラ。
  // rAF を 1 つ挟むことで、snapshot 値が DOM にコミットされてから 0 へ
  // 遷移する → browser が transition を発火する。
  const _kick_exit = () => {
    const el = _find_el();
    if (!el || !inst._c) return;
    _set_size(el, 0, 0);
  };

  const inst = ({ visible = false, ctx = [] } = {}) => {

    // ── 状態遷移 ────────────────────────────────────────
    if (visible) {
      if (inst._c) {
        // 中断: closing → entering。current サイズを snapshot して natural へ。
        const el = _find_el();
        if (el) {
          const cur = _measure_current(el);
          _set_size(el, cur.w, cur.h);
          // transition は既に live、次フレームで natural サイズへ
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(_kick_enter);
          }
        }
        inst._c = false;
        inst._e = true;
      } else if (!inst._o) {
        // 通常 enter 開始
        inst._o = true;
        inst._e = true;
      }
      // _e が立っていて _o も既に true なら、render は entering 状態を続ける
    } else {
      if (inst._e) {
        // 中断: entering → closing。current サイズを snapshot して 0 へ。
        const el = _find_el();
        if (el) {
          const cur = _measure_current(el);
          _set_size(el, cur.w, cur.h);
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(_kick_exit);
          }
        }
        inst._e = false;
        inst._c = true;
      } else if (inst._o && !inst._c) {
        // 通常 close 開始: 現在 (natural) サイズを焼き付けてから 0 へ
        const el = _find_el();
        if (el) {
          const cur = _measure_current(el);
          _set_size(el, cur.w, cur.h);
          el.style.overflow   = 'hidden';
          el.style.transition = _transition_str;
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(_kick_exit);
          }
        }
        inst._c = true;
      }
    }

    // ── render ────────────────────────────────────────
    // どの状態にも該当しない (= 完全に閉じている) なら描画しない
    if (!inst._o && !inst._c) return null;

    // entering の最初の commit では height:0 (or width:0) を直接 inline で
    // 出す。これが render の DOM コミット → rAF 後の _kick_enter で natural
    // へ遷移、というシーケンスの起点。
    const initial_style = {
      overflow:   'hidden',
      transition: _transition_str,
    };
    if (inst._e && !inst._c) {
      // ただし「中断: closing → entering」のときは _kick_enter が既に
      // snapshot 値を inline に焼き付けているので、ここで 0 を書くと
      // 値が衝突する。_find_el() を見て既に inline style があれば書かない。
      const el = _find_el();
      if (!el) {
        // まだマウントされていない (= 初回 enter)
        if (direction === 'v' || direction === 'both') initial_style.height = 0;
        if (direction === 'h' || direction === 'both') initial_style.width  = 0;
      }
    }

    // 初回 entering の場合、rAF 2 回分待って _kick_enter を呼ぶ
    if (inst._e && typeof requestAnimationFrame !== 'undefined') {
      const el = _find_el();
      if (!el) {
        requestAnimationFrame(() => requestAnimationFrame(_kick_enter));
      }
    }

    return {
      tag:   'div',
      class: 'ric-collapse-box'
           + (inst._e ? ' ric-collapse-box--entering' : '')
           + (inst._c ? ' ric-collapse-box--closing'  : ''),
      [_attr]:         String(_id),
      'data-ric-role': 'collapse-box',
      style:           initial_style,
      ontransitionend: _on_transition_end,
      ctx,
    };
  };

  inst._o = false;  // open: DOM が存在する
  inst._e = false;  // entering: enter アニメ進行中
  inst._c = false;  // closing: exit アニメ進行中

  return inst;
};

module.exports = { create_ui_collapse_box };
