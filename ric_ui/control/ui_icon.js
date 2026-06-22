// RicUI — ui_icon
// SVG アイコンを descriptor から生成する純関数ヘルパー (v0.3.28〜)。
//
// 設計の核: アイコンは「データ (JSON descriptor)」であり、RicDOM の VDOM に
// そのまま挿せる。素材はアイコンピッカーから「使う分だけ」コピーする想定で、
// RicUI 本体にはアイコンデータを一切含めない (バンドルを太らせない)。
//
// ⚠️ AI エージェントへ: descriptor の path を記憶から手書きしないこと。
//   sub-path 欠落等で「それっぽく見えるが壊れている」アイコンが静かに出荷される
//   (実例あり)。アイコンが欲しいときは必ず `npx ricdom-icon <name>` で取得すること
//   (同梱はオフライン、Lucide も自動で path 化される)。同梱一覧は
//   docs/icons/icons.json。どうしても手書きが避けられない状況なら、まずユーザー
//   (人間) に確認して許可を得てから行うこと。
//
// descriptor:
//   { v?, s?, p }
//     v = viewBox (既定 '0 0 24 24')
//     s = stroke-width。stroke がデフォルト:
//         省略 → stroke 2 / 数値 → その太さ / null → fill モード (塗りつぶし)。
//         Lucide 等の線画は s 省略 (=2)、塗りつぶしは s:null。
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

  // stroke がデフォルト (大多数のアイコンは線画)。fill モードは s:null を
  // 明示したときだけ (塗りつぶしアイコン、status dot 等)。
  //   s 省略   → stroke 2  (build_icons.js は既定 2 を省略保存するため、これが最頻)
  //   s:数値   → その太さの stroke
  //   s:null   → fill モード
  //   strokeWidth (opts) → stroke 幅を上書き (s より優先、stroke を強制)
  let sw;
  if (strokeWidth != null)  sw = strokeWidth;   // opts 上書き → stroke 強制
  else if (s === null)      sw = null;          // 明示 fill
  else if (s == null)       sw = 2;             // 省略 → 既定 stroke 2
  else                      sw = s;             // 明示 stroke 幅
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
    // サイズ・縦整列・flex 潰れ防止を inline style で持たせる。これにより
    // .ric-icon CSS (create_ui_page が注入) が無い環境 = 生 RicDOM で使っても、
    // サイズ / テキスト隣接時のベースライン整列 / flex 内で潰れない、が効く
    // (size を inline 化しているのと同じ流儀。複数 consumer が独立に再発見した papercut)。
    //   verticalAlign / flexShrink: 先頭に置き opt_style で上書き可能にする。
    //   width/height: 最後に置き size 引数を opt_style.width 等より優先させる。
    // '1em' を font-size に追従させるには width/height 属性より inline style の方が
    // ブラウザ間で確実。
    style: { verticalAlign: '-0.125em', flexShrink: 0, ...(opt_style || {}), width: size_val, height: size_val },
    // label の有無でアクセシビリティ属性を切り替える (アンケート全員要望)。
    ...(label != null
      ? { role: 'img', 'aria-label': label }
      : { 'aria-hidden': 'true' }),
    ctx: paths.map((d) => ({ tag: 'path', d })),
  };
};

module.exports = { ui_icon };
