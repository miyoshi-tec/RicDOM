// RicUI — create_ui_collapse_box
// 子要素を「アニメーションしながら現れる / 消える」コンテナの汎用 primitive。
// **複数 instance 対応** (v0.3.11〜): 1 factory を `key` で区別される多数の独立
// アニメーションに使える (Rancha の file row add/remove のような sparse list
// animation 用途)。
//
// 使い方:
//   s.box = create_ui_collapse_box({ direction, duration, easing });
//
//   // 単独 (key 省略 → 内部的に '_default')
//   s.box({ visible: s.expanded, ctx: [...] })
//
//   // 複数 (sparse animation: sort 順を維持したまま個別 row をアニメ)
//   ctx: sorted.map((f) => animating.has(f.path)
//     ? s.box({ key: f.path, visible: animating.get(f.path), ctx: [row] })
//     : row,
//   )
//
// 各 key は **独立した state machine** (_o / _e / _c / _tw / _th) を持つ。
// closing 完了時 / corner case の即 closed 時に Map から entry を削除して
// メモリリークを防ぐ (長時間動作する list アプリで Map が膨らまない)。
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
// 補間)。

'use strict';

const { safe_notify } = require('../_factory_helpers');

// 複数 factory 識別用のモジュールレベルカウンタ。
let _next_fid = 0;

const create_ui_collapse_box = ({
  direction = 'v',
  duration  = 200,
  easing    = 'ease',
} = {}) => {

  const _fid  = ++_next_fid;
  const _do_h = direction !== 'h';   // direction 'v' or 'both' で height を制御
  const _do_w = direction !== 'v';   // direction 'h' or 'both' で width を制御
  const _trans = [
    _do_w && `width ${duration}ms ${easing}`,
    _do_h && `height ${duration}ms ${easing}`,
  ].filter(Boolean).join(', ');

  // ── per-key state (multi-instance) ──────────────────
  // key → { _o, _e, _c, _tw, _th }
  // closing 完了 / corner case 即 closed で entry を delete (GC)。
  const _states = new Map();
  const _new_state = () => ({ _o: false, _e: false, _c: false, _tw: 0, _th: 0 });

  // DOM 識別: factory_id + URL-safe key で composite に。
  // encodeURIComponent は '/', ':', ' ', '"' 等を encode (attribute selector の
  // [data-ric-cb="..."] で問題になる文字をすべて escape する)。'.' や '-' '_'
  // 等は encode されないが、これらは HTML attribute 値 / querySelector で
  // 問題にならないため OK。
  const _attr_value = (key) => _fid + '-' + encodeURIComponent(key);

  const _find_el = (key) =>
    (typeof document !== 'undefined')
      ? document.querySelector(`[data-ric-cb="${_attr_value(key)}"]`)
      : null;

  // entering 中の rAF コールバック: natural サイズを測って _tw/_th を更新し、
  // 再描画 (VDOM が新ターゲットを emit → CSS transition が発動) を予約する。
  // state が delete 済み (visible 反転で entering が消えた) の場合は
  // _states.get(key) が undefined を返すので no-op。stale state を再生成しない。
  const _measure = (key) => {
    const st = _states.get(key);
    if (!st || !st._e) return;
    const el = _find_el(key);
    if (!el) return;
    if (_do_w) st._tw = el.scrollWidth;
    if (_do_h) st._th = el.scrollHeight;
    safe_notify(inst, 'create_ui_collapse_box');
  };

  const inst = ({ key = '_default', visible = false, ctx = [] } = {}) => {

    // ── 状態取得 (必要なときだけ作る; visible:false かつ未存在なら作らない) ──
    let st = _states.get(key);

    // ── 状態遷移 ────────────────────────────────────────
    // state は「生きている (entering/open/closing)」ときだけ Map に存在する。
    // closing 完了 / corner case 即 closed で必ず delete されるので、
    // 「st が存在 && _o=false」のケースは構造上発生しない。
    if (visible && !st) {
      // 通常 enter (mount)
      st = _new_state();
      st._o = true; st._e = true;
      _states.set(key, st);
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => _measure(key));
    } else if (visible && st && st._c) {
      // 中断: closing → entering (再 measure。transition は VDOM diff が発動)
      st._c = false; st._e = true;
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => _measure(key));
    } else if (!visible && st && !st._c) {
      // 通常 close (entering 中断含む)。st が存在するなら必ず _o=true (上記 invariant)。
      st._e = false;
      if (st._th === 0 && st._tw === 0) {
        // measure 前に閉じた corner case (連打など): アニメ不要、即 closed
        st._o = false;
      } else {
        st._c = true;
        st._tw = st._th = 0;
      }
    }
    // visible && st && (entering or open or closing→entering 既処理): 何もしない (steady state)
    // !visible && !st: state 未存在 = 既に closed、何もしない

    // ── render ────────────────────────────────────────
    // 描画不要 (= 完全に closed) なら state を GC して null を返す
    if (!st || (!st._o && !st._c)) {
      if (st) _states.delete(key);
      return null;
    }

    // VDOM が style の真値を持つ。imperative な inline 操作は一切しない。
    // entering/closing 中だけ height/width を明示し、open 完了後は除外して
    // natural reflow に戻す。
    const style = { overflow: 'hidden', transition: _trans };
    if (st._e || st._c) {
      if (_do_h) style.height = st._th + 'px';
      if (_do_w) style.width  = st._tw + 'px';
    }

    // transitionend は closure で key (と st) を捕捉。各 instance の DOM が
    // 自分の key に応じた handler を持つ。
    const _on_end = (e) => {
      if (e.propertyName !== 'width' && e.propertyName !== 'height') return;
      const el = _find_el(key);
      if (!el || e.target !== el) return;
      // state が外から delete されている corner case を保護 (closure は古い
      // st を持っていても Map は最新)
      const cur = _states.get(key);
      if (!cur || cur !== st) return;
      if (st._c) {
        st._o = st._c = false;
        _states.delete(key);   // closing 完了 → GC
        safe_notify(inst, 'create_ui_collapse_box');
      } else if (st._e) {
        st._e = false;
        safe_notify(inst, 'create_ui_collapse_box');
      }
    };

    return {
      tag: 'div',
      class: 'ric-collapse-box'
           + (st._e ? ' ric-collapse-box--entering' : '')
           + (st._c ? ' ric-collapse-box--closing'  : ''),
      'data-ric-cb':   _attr_value(key),
      'data-ric-role': 'collapse-box',
      style,
      ontransitionend: _on_end,
      ctx,
    };
  };

  return inst;
};

module.exports = { create_ui_collapse_box };
