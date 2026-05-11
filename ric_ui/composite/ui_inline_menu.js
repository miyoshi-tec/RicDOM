// RicUI — ui_inline_menu
// trigger 要素の near に absolute 配置する軽量ポップオーバー。
//
// 位置づけ:
//   - create_ui_popup は portal + overlay + 1-trigger-instance で、行ごとに
//     存在しうる「…」メニューには重すぎる（N 行 → N instance）。
//   - ui_inline_menu は portal を持たず、親要素の position:relative に対して
//     position:absolute だけで配置する純粋関数。インスタンスを取らない。
//   - open 状態は呼び出し側の state が管理する（s.menu_for のようなパターン）。
//
// 親側の要件:
//   - 親 (ui_inline_menu を含む要素) は position:relative を付ける必要がある。
//     anchor の bl/br/tl/tr はこの親の四隅に対する位置として解釈される。
//
// 含まない機能 (意図的):
//   - 外クリックで閉じる挙動は library に持たせない。
//     ui_inline_menu の onclick が e.stopPropagation() するため、document
//     レベルの click listener が「menu 外をクリック」を検知できる。
//     helper として ric_ui/dom_helpers.js の watch_outside_click を使うか、
//     呼び出し側で document.addEventListener('click', ...) を 1 つ書く。
//   - キーボード操作 / focus trap / ARIA は意図的に含めない。menu/menuitem 相当
//     のセマンティクスが必要なら create_ui_popup や独自実装を使うこと。
//
// 引数:
//   open    : bool（必須）。false のとき null を返す（render 結果ごと消える）
//   anchor  : 'br' | 'bl' | 'tr' | 'tl' = 'br'。親要素のどの角に寄せるか
//   ctx     : 中身のデスクリプタ群
//   style   : string | object（追加スタイル）
//   class   : string（追加クラス）

'use strict';

// anchor → 絶対位置スタイル文字列のマップ
// 「br = bottom-right」のように親の右下に張り付く位置（つまり親の右端の
// すぐ下に展開する）として読む
const _ANCHOR = {
  br: 'top:100%;right:0;margin-top:4px',
  bl: 'top:100%;left:0;margin-top:4px',
  tr: 'bottom:100%;right:0;margin-bottom:4px',
  tl: 'bottom:100%;left:0;margin-bottom:4px',
};

const _style_to_string = (style) => {
  if (!style) return '';
  if (typeof style === 'string') return style;
  // object → 'k:v;k:v' 形式に整形（既存 RicUI と同様の単純変換）
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
};

const ui_inline_menu = ({
  open = false,
  anchor = 'br',
  ctx = [],
  style = '',
  class: extra_class = '',
} = {}) => {
  if (!open) return null;

  const pos = _ANCHOR[anchor] || _ANCHOR.br;
  const extra = _style_to_string(style);
  // 単一の文字列スタイルに統一する（diff path のシンプル経路を通す）
  const style_str = `position:absolute;z-index:10;${pos}${extra ? ';' + extra : ''}`;

  return {
    tag: 'div',
    class: 'ric-inline-menu' + (extra_class ? ' ' + extra_class : ''),
    style: style_str,
    // menu 内クリックは document に bubble させない。
    // document 側の outside-click handler が menu 自身のクリックで
    // 閉じてしまわないように。
    onclick: (e) => e.stopPropagation(),
    ctx,
  };
};

module.exports = { ui_inline_menu };
