// RicDOM — SVG → アイコン descriptor 変換器 (v0.3.28〜)
//
// 任意のアイコン SVG 文字列を ui_icon の descriptor { v?, s?, p } に変換する。
// アイコンピッカー (ブラウザ) と build_icons (Node) の両方から使える UMD モジュール。
//
// 対応要素: <path> <line> <polyline> <polygon> <rect> <circle> <ellipse>
//   path 以外はすべて path の d 文字列に厳密変換する (決定的・幾何計算のみ)。
//   これにより descriptor は常に path ベース ({ p }) で統一される。
//
// stroke / fill 判定 (ソースの <svg> ルート属性から):
//   fill="none" (Lucide/Feather/Tabler 等の線画)        → stroke モード (s = stroke-width or 2)
//   fill=色 かつ stroke 無し (Heroicons solid 等の塗り)  → fill モード   (s = null)
//   どちらとも取れない                                    → 既定 stroke 2
//
// 出力は正準形 (既定値を省く): v は '0 0 24 24' なら省略、s は 2 なら省略、
// fill モードは s:null を明示。

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.svg_to_descriptor = factory().svg_to_descriptor;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_VIEWBOX = '0 0 24 24';

  // 数値を短く整形 (小数 3 桁、末尾 0 / 不要な小数点を除去)
  const num = (v) => {
    const n = Math.round(parseFloat(v) * 1000) / 1000;
    return String(n);
  };

  // 要素の属性を { name: value } に
  const parse_attrs = (attr_str) => {
    const attrs = {};
    const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(attr_str))) attrs[m[1]] = m[2];
    return attrs;
  };

  // points="x1,y1 x2,y2 ..." or "x1 y1 x2 y2 ..." → [[x,y], ...]
  const parse_points = (pts) => {
    const nums = pts.trim().split(/[\s,]+/).map(num);
    const out = [];
    for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
    return out;
  };

  const poly_to_d = (pts, close) => {
    if (pts.length === 0) return '';
    let d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 1; i < pts.length; i++) d += 'L' + pts[i][0] + ' ' + pts[i][1];
    return close ? d + 'z' : d;
  };

  // <rect> → path (rx があれば角丸)
  const rect_to_d = (a) => {
    const x = parseFloat(a.x || 0), y = parseFloat(a.y || 0);
    const w = parseFloat(a.width || 0), h = parseFloat(a.height || 0);
    let rx = a.rx != null ? parseFloat(a.rx) : (a.ry != null ? parseFloat(a.ry) : 0);
    let ry = a.ry != null ? parseFloat(a.ry) : (a.rx != null ? parseFloat(a.rx) : 0);
    rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    if (rx <= 0 || ry <= 0) {
      return `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z`;
    }
    return `M${num(x + rx)} ${num(y)}`
         + `h${num(w - 2 * rx)}a${num(rx)} ${num(ry)} 0 0 1 ${num(rx)} ${num(ry)}`
         + `v${num(h - 2 * ry)}a${num(rx)} ${num(ry)} 0 0 1 ${num(-rx)} ${num(ry)}`
         + `h${num(-(w - 2 * rx))}a${num(rx)} ${num(ry)} 0 0 1 ${num(-rx)} ${num(-ry)}`
         + `v${num(-(h - 2 * ry))}a${num(rx)} ${num(ry)} 0 0 1 ${num(rx)} ${num(-ry)}z`;
  };

  // <circle> / <ellipse> → path (2 つの弧で 1 周)
  const ellipse_to_d = (cx, cy, rx, ry) =>
    `M${num(cx - rx)} ${num(cy)}`
    + `a${num(rx)} ${num(ry)} 0 1 0 ${num(2 * rx)} 0`
    + `a${num(rx)} ${num(ry)} 0 1 0 ${num(-2 * rx)} 0z`;

  const elem_to_d = (tag, a) => {
    switch (tag) {
      case 'path':     return a.d ? a.d.trim() : '';
      case 'line':     return `M${num(a.x1 || 0)} ${num(a.y1 || 0)}L${num(a.x2 || 0)} ${num(a.y2 || 0)}`;
      case 'polyline': return poly_to_d(parse_points(a.points || ''), false);
      case 'polygon':  return poly_to_d(parse_points(a.points || ''), true);
      case 'rect':     return rect_to_d(a);
      case 'circle':   return ellipse_to_d(parseFloat(a.cx || 0), parseFloat(a.cy || 0), parseFloat(a.r || 0), parseFloat(a.r || 0));
      case 'ellipse':  return ellipse_to_d(parseFloat(a.cx || 0), parseFloat(a.cy || 0), parseFloat(a.rx || 0), parseFloat(a.ry || 0));
      default:         return '';
    }
  };

  // メイン: SVG 文字列 → { v?, s?, p }
  const svg_to_descriptor = (svg) => {
    if (typeof svg !== 'string') throw new Error('svg_to_descriptor: 文字列を渡してください');

    // <svg ...> ルートタグの属性
    const root_m = svg.match(/<svg\b([^>]*)>/i);
    const root_attrs = root_m ? parse_attrs(root_m[1]) : {};

    // viewBox
    const v = (root_attrs.viewBox || DEFAULT_VIEWBOX).trim();

    // stroke / fill 判定
    const root_fill = (root_attrs.fill || '').trim().toLowerCase();
    const root_stroke = (root_attrs.stroke || '').trim().toLowerCase();
    let is_fill;
    if (root_fill === 'none') is_fill = false;                           // 明示 stroke
    else if (root_fill && root_fill !== 'none' && !root_stroke) is_fill = true; // 塗り
    else is_fill = false;                                                 // 既定 stroke
    const sw = root_attrs['stroke-width'] != null ? parseFloat(root_attrs['stroke-width']) : 2;

    // 子要素を出現順に抽出 → path d 配列へ
    const paths = [];
    const re = /<(path|line|polyline|polygon|rect|circle|ellipse)\b([^>]*?)\/?>/gi;
    let m;
    while ((m = re.exec(svg))) {
      const d = elem_to_d(m[1].toLowerCase(), parse_attrs(m[2]));
      if (d) paths.push(d);
    }
    if (paths.length === 0) throw new Error('svg_to_descriptor: 描画要素が見つかりません');

    // 正準化
    const out = {};
    if (v !== DEFAULT_VIEWBOX) out.v = v;
    if (is_fill) out.s = null;          // fill モードは明示
    else if (sw !== 2) out.s = sw;      // 既定 2 は省略
    out.p = paths.length === 1 ? paths[0] : paths;
    return out;
  };

  return { svg_to_descriptor };
});
