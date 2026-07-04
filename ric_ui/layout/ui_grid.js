// RicUI — ui_grid
// CSS grid を簡潔に書くための layout コンポーネント (layout カテゴリ)。
// gap は CSS variable (--ric-gap-md) から自動で取得される。
// 色・背景は持たない。レイアウトだけを担当する。
//
// 引数:
//   columns : number | string
//             数値なら "1fr 1fr ... 1fr" (n 個) に展開
//             文字列なら grid-template-columns にそのまま渡す
//             例: 3                → '1fr 1fr 1fr'
//                 '120px 1fr'      → '120px 1fr'
//                 'auto-fit 200px' → 'repeat(auto-fit, minmax(200px, 1fr))' の省略形
//   rows    : number | string | undefined (任意)
//             columns と同じ規則。省略時は grid-auto-rows で自動
//   gap     : string | number | undefined (任意)
//             '8px' / 12 / '8px 16px' 等。省略時は theme の --ric-gap-md
//   style   : object — 上記以外の grid 関連 / 任意 CSS を追記
//   ctx     : 子要素配列
//   ...rest : id / data-* / onclick 等の任意属性を透過 (rest スプレッド契約)

'use strict';

// 数値 → '1fr 1fr ...' (n 個) に展開する
const _expand_tracks = (v) => {
  if (typeof v === 'number') return Array(v).fill('1fr').join(' ');
  if (typeof v === 'string') {
    // 省略記法: 'auto-fit 200px' / 'auto-fill 120px' → repeat(auto-fit, minmax(200px, 1fr))
    const m = v.match(/^(auto-fit|auto-fill)\s+(.+)$/);
    if (m) return `repeat(${m[1]}, minmax(${m[2]}, 1fr))`;
    return v;
  }
  return v;
};

// style 引数が plain object のときだけ columns/rows/gap をマージする。
// string / 配列が渡された場合は ui_col / ui_row と同じく透過 (RicDOM 側の
// normalize_style が cssText 直設定 / 配列マージで処理する) — ただし
// 透過時は columns/rows/gap の引数は無効 (style と columns を同時に渡したい
// ときは object 形式で書く前提)。v0.3.7 canon に従い object 形式を推奨。
// ※ ui_tweak.js の同名ヘルパーとは判定基準が異なる (ui_tweak は prototype
//    チェックあり = クラスインスタンスを json_preview 行きにするため / ui_grid は
//    緩い判定で足りる)。共通化しないこと。
const _is_plain_object = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const ui_grid = ({
  columns,
  rows,
  gap,
  ctx = [],
  style = {},
  ...rest
} = {}) => {
  const is_obj = _is_plain_object(style);
  const final_style = is_obj ? { ...style } : style;

  if (is_obj) {
    if (columns !== undefined) final_style.gridTemplateColumns = _expand_tracks(columns);
    if (rows    !== undefined) final_style.gridTemplateRows    = _expand_tracks(rows);
    if (gap     !== undefined) final_style.gap = typeof gap === 'number' ? gap + 'px' : gap;
  }

  // style を node に乗せるかの判定: object なら key があるか、string/array なら truthy か
  const has_style = is_obj ? Object.keys(final_style).length > 0 : !!final_style;

  return {
    ...rest,
    tag: 'div',
    class: rest.class ? 'ric-grid ' + rest.class : 'ric-grid',
    ...(has_style ? { style: final_style } : {}),
    ctx,
  };
};

module.exports = { ui_grid };
