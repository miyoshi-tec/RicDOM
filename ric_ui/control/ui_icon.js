// RicUI — ui_icon
// SVG アイコンを descriptor から生成する純関数ヘルパー (v0.3.28〜)。
//
// 設計の核: アイコンは「データ (JSON descriptor)」であり、RicDOM の VDOM に
// そのまま挿せる。素材はアイコンピッカーから「使う分だけ」コピーする想定で、
// RicUI 本体にはアイコンデータを一切含めない (バンドルを太らせない)。
//
// descriptor:
//   { v?, s?, p }
//     v = viewBox (既定 '0 0 24 24')
//     s = stroke-width。あれば stroke モード (fill:none, stroke:currentColor)。
//         無ければ fill モード (fill:currentColor)。
//         Lucide 等の線画は s:2、Heroicons solid 等の塗りは s 無し。
//     p = path の d 文字列、または複数 path の文字列配列
//
// opts:
//   size        数値 (px に変換) or CSS 文字列。既定 '1em' (= 親 font-size 追従)。
//   label       指定あり → role="img" + aria-label (意味を持つアイコン)。
//               省略     → aria-hidden="true" (装飾。隣にテキストがある場合の
//                          二重読み上げを防ぐ。consumer アンケートで全員が要望)。
//   spin        true で回転 (class ric-icon--spin + @keyframes ric-spin)。spinner 用。
//   strokeWidth descriptor.s を上書きする stroke 幅。指定すると stroke モードを強制。
//   class       追加クラス (透過)。
//   style       追加 style (透過、size より弱い)。
//   ...rest     その他の属性 (data-* 等) を透過。
//
// 色は currentColor 固定 = CSS の color プロパティでテーマに追従する。

'use strict';

const ui_icon = (descriptor = {}, opts = {}) => {
  const {
    size = '1em',
    label,
    spin = false,
    strokeWidth,
    class: cls,
    style: opt_style,
    ...rest
  } = opts;

  const { v = '0 0 24 24', s, p } = descriptor;
  const paths = Array.isArray(p) ? p : (p != null ? [p] : []);

  // stroke 幅は strokeWidth (opts) を優先、無ければ descriptor.s。
  // どちらかがあれば stroke モード、無ければ fill モード。
  const sw = strokeWidth != null ? strokeWidth : s;
  const is_stroke = sw != null;

  const size_val = typeof size === 'number' ? size + 'px' : size;

  const cls_str = ['ric-icon', spin ? 'ric-icon--spin' : '', cls]
    .filter(Boolean).join(' ');

  return {
    ...rest,
    tag: 'svg',
    viewBox: v,
    fill: is_stroke ? 'none' : 'currentColor',
    ...(is_stroke ? {
      stroke: 'currentColor',
      'stroke-width': sw,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    } : {}),
    class: cls_str,
    // サイズは style で指定する。'1em' を font-size に追従させるには、SVG の
    // width/height 属性より inline style の方がブラウザ間で確実なため。
    // size を最後に置くことで opt_style.width 等より優先させる。
    style: { ...(opt_style || {}), width: size_val, height: size_val },
    // label の有無でアクセシビリティ属性を切り替える (アンケート全員要望)。
    ...(label != null
      ? { role: 'img', 'aria-label': label }
      : { 'aria-hidden': 'true' }),
    ctx: paths.map((d) => ({ tag: 'path', d })),
  };
};

module.exports = { ui_icon };
