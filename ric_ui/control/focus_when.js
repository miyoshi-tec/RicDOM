// RicUI — focus_when
// 「条件の立ち上がりエッジ（false → true）でフォーカスを当てる」宣言的ヘルパー。
//
// 命令的に `el.focus()` を書くと、state → UI の流れに割り込む呼び出しが散在し、
// 呼び出しタイミング（rAF 必要性・disabled チェック・state リセット後の復帰など）
// がアプリ側のコードに漏れる。focus_when は render 中に毎回呼んでよく、
// 前回値との差分で副作用を最小化する。
//
// 使い方:
//   render(s) {
//     focus_when(s.refs.get('input'), !s.busy);
//     return { ... };
//   }
//
// 動作:
//   - el が null なら何もしない（ref が未解決）
//   - cond が前回 false → 今回 true の**立ち上がりエッジ**のときだけ
//     rAF 2 回後に el.focus() を呼ぶ（DOM 更新完了を待つ保険）
//   - disabled な要素はフォーカスしない
//
// WeakMap で前回値を記録するため、DOM 要素が破棄されると自動でエントリが消える
// （メモリリークしない）。

'use strict';

const _prev_cond = new WeakMap();

const focus_when = (el, cond) => {
  if (!el) return;                            // ref 未解決
  const was = _prev_cond.get(el) || false;
  const now = !!cond;
  _prev_cond.set(el, now);
  if (!now || was) return;                    // 立ち上がりエッジ以外はスキップ

  // 2 回 rAF: 1 回目で描画確定、2 回目で確実にレイアウトが終わった状態で focus。
  // requestAnimationFrame が無い環境（Node 単体）では何もしない。
  if (typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!el.disabled && typeof el.focus === 'function') el.focus();
    });
  });
};

module.exports = { focus_when };
