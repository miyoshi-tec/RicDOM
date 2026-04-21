// RicUI — create_ui_scroll_pane
// 最下部（または最上部）追従型のスクロール領域。
// チャット UI・ログビューア・メッセージ一覧など
// 「内容が追加されたら自動で端までスクロール、ただしユーザーが途中を
// 見ている間は動かさない」を宣言的に実現する。
//
// 使い方:
//   s.pane = create_ui_scroll_pane({
//     follow:    'bottom',   // 'bottom' | 'top' | 'none'
//     threshold: 50,         // 端からこの px 以内なら「追従対象」とみなす
//   });
//
//   // render 内で毎回呼ぶ
//   s.pane({ ctx: [...messages] })
//
//   // 強制的に端まで（例: ユーザー送信時）
//   s.pane.scroll_to_bottom();
//   s.pane.scroll_to_top();
//
// 仕組み:
//   - render 呼び出し時に DOM の scroll 位置を読んで「端にいるか」を判定
//   - rAF で描画後に scrollTop を更新
//   - data-ric-sp 属性でインスタンスを特定（クラス名は短縮の対象になるため）

'use strict';

// 複数インスタンス識別用のモジュールレベルカウンタ
let _sp_count = 0;

// style オブジェクトを CSS 文字列に変換する小ヘルパ。
// render 関数の中で毎回定義すると呼び出し回数分だけクロージャが作られるため、
// モジュールレベルで 1 つだけ持つ。
const _style_to_str = (s) => typeof s === 'object' && !Array.isArray(s)
  ? Object.entries(s).map(([k, v]) =>
      `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}: ${v}`).join(';')
  : String(s || '');

const create_ui_scroll_pane = ({
  follow    = 'bottom',   // 'bottom' | 'top' | 'none'
  threshold = 50,
} = {}) => {

  const _id = ++_sp_count;

  const _find_el = () =>
    (typeof document !== 'undefined')
      ? document.querySelector(`[data-ric-sp="${_id}"]`)
      : null;

  // 現在の scroll 位置から「追従すべきか」を判定
  const _should_follow = (el) => {
    if (!el) return false;
    if (follow === 'bottom') {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      return dist <= threshold;
    }
    if (follow === 'top') {
      return el.scrollTop <= threshold;
    }
    return false;
  };

  // rAF 後にスクロール位置を適用する
  const _apply_scroll = () => {
    const el = _find_el();
    if (!el) return;
    // force が立っていれば方向を強制、そうでなければ follow_now に従う
    if (inst._force_to === 'bottom') {
      el.scrollTop = el.scrollHeight;
    } else if (inst._force_to === 'top') {
      el.scrollTop = 0;
    } else if (inst._follow_now) {
      if (follow === 'bottom') el.scrollTop = el.scrollHeight;
      else if (follow === 'top') el.scrollTop = 0;
    }
    inst._force_to   = null;
    inst._follow_now = false;
  };

  const inst = ({ ctx = [], ...rest } = {}) => {
    // render 前に「追従中か」を計測。DOM がまだ無い場合（初回）は false。
    const el = _find_el();
    if (el) inst._follow_now = _should_follow(el);

    // 描画後に rAF で scrollTop を適用
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(_apply_scroll);
    }

    // rest.style は string / object を想定。object のときは string 化して連結する
    // （SPEC の rest スプレッド契約に沿って計算値で最終上書きする）。
    const extra_style = rest.style ? _style_to_str(rest.style) + ';' : '';

    return {
      ...rest,
      tag:   'div',
      class: rest.class ? 'ric-scroll-pane ' + rest.class : 'ric-scroll-pane',
      'data-ric-sp': String(_id),
      style: extra_style + 'overflow-y:auto',
      ctx,
    };
  };

  inst._follow_now = false;  // 「render 前の計測結果: 追従すべきか」
  inst._force_to   = null;   // 'bottom' | 'top' | null (強制スクロール方向)

  // 公開 API
  inst.scroll_to_bottom = () => { inst._force_to = 'bottom'; inst.__notify?.(); };
  inst.scroll_to_top    = () => { inst._force_to = 'top';    inst.__notify?.(); };

  return inst;
};

module.exports = { create_ui_scroll_pane };
