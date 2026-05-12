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
//   s.box({ visible: s.expanded, ctx: [...] })   // controlled mode 一本
//
// 動作原理 — VDOM が style の唯一の真実源:
//   - 入る:   visible:true で _tw/_th=0 → VDOM が height:0 を emit → mount。
//             rAF で scrollWidth/Height を測定 → _tw/_th 更新 → safe_notify で
//             再描画 → VDOM が height:Npx を emit → RicDOM diff が 0→N で
//             inline 適用 → browser が transition で補間。
//   - 出る:   visible:false で _tw/_th=0 → VDOM が height:0 を emit →
//             RicDOM diff が prev(natural)→0 で apply → browser が transition。
//   - 中断:   _tw/_th の値を変えるだけで、CSS transition は「現在の補間値から
//             新ターゲットへ」を自動で行うため、snapshot ロジックは要らない。
//
// アニメ中は JS / RicDOM は走らない (transition は browser の compositor で
// 補間)。状態変更タイミング (mount / measure / transitionend) でだけ RicDOM
// が再描画される (= 1 つの開閉サイクルで合計 4 回程度)。

'use strict';

const { safe_notify } = require('../_factory_helpers');

// 複数インスタンス識別用のモジュールレベルカウンタ。
let _next_id = 0;

const create_ui_collapse_box = ({
  direction = 'v',
  duration  = 200,
  easing    = 'ease',
} = {}) => {

  const _id   = ++_next_id;
  const _do_h = direction !== 'h';   // direction 'v' or 'both' で height を制御
  const _do_w = direction !== 'v';   // direction 'h' or 'both' で width を制御
  const _trans = [
    _do_w && `width ${duration}ms ${easing}`,
    _do_h && `height ${duration}ms ${easing}`,
  ].filter(Boolean).join(', ');

  const _find_el = () =>
    (typeof document !== 'undefined')
      ? document.querySelector(`[data-ric-cb="${_id}"]`)
      : null;

  // entering 中の rAF コールバック: natural サイズを測って _tw/_th を更新し、
  // 再描画 (VDOM が新ターゲットを emit → CSS transition が発動) を予約する。
  const _measure = () => {
    const el = _find_el();
    if (!el || !inst._e) return;        // visible 反転で entering が消えていたら no-op
    if (_do_w) inst._tw = el.scrollWidth;
    if (_do_h) inst._th = el.scrollHeight;
    safe_notify(inst, 'create_ui_collapse_box');
  };

  // transitionend ハンドラ: closing 完了で unmount、entering 完了で _e=false
  // (次 render で VDOM から height/width が消え、RicDOM diff が inline を
  // clear して natural reflow に戻る)。
  const _on_end = (e) => {
    if (e.propertyName !== 'width' && e.propertyName !== 'height') return;
    const el = _find_el();
    if (!el || e.target !== el) return;
    if (inst._c) {
      inst._o = inst._c = false;
      safe_notify(inst, 'create_ui_collapse_box');
    } else if (inst._e) {
      inst._e = false;
      safe_notify(inst, 'create_ui_collapse_box');
    }
  };

  const inst = ({ visible = false, ctx = [] } = {}) => {

    // ── 状態遷移 ────────────────────────────────────────
    if (visible && !inst._o) {
      // 通常 enter (mount)
      inst._o = true; inst._e = true;
      inst._tw = inst._th = 0;
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(_measure);
    } else if (visible && inst._c) {
      // 中断: closing → entering (再 measure。transition は VDOM diff が発動)
      inst._c = false; inst._e = true;
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(_measure);
    } else if (!visible && inst._o && !inst._c) {
      // 通常 close (entering 中断含む)
      inst._e = false;
      if (inst._th === 0 && inst._tw === 0) {
        // measure が走る前に閉じた corner case (連打など): アニメ不要、即 closed
        inst._o = false;
      } else {
        inst._c = true;
        inst._tw = inst._th = 0;
      }
    }

    // ── render ────────────────────────────────────────
    if (!inst._o && !inst._c) return null;

    // VDOM が style の真値を持つ。imperative な inline 操作は一切しない。
    // entering/closing 中だけ height/width を明示し、open 完了後は除外して
    // natural reflow に戻す。
    const style = { overflow: 'hidden', transition: _trans };
    if (inst._e || inst._c) {
      if (_do_h) style.height = inst._th + 'px';
      if (_do_w) style.width  = inst._tw + 'px';
    }

    return {
      tag: 'div',
      class: 'ric-collapse-box'
           + (inst._e ? ' ric-collapse-box--entering' : '')
           + (inst._c ? ' ric-collapse-box--closing'  : ''),
      'data-ric-cb':   String(_id),
      'data-ric-role': 'collapse-box',
      style,
      ontransitionend: _on_end,
      ctx,
    };
  };

  inst._o = inst._e = inst._c = false;   // open / entering / closing
  inst._tw = inst._th = 0;               // target width / height (px、entering/closing 中の target)
  return inst;
};

module.exports = { create_ui_collapse_box };
