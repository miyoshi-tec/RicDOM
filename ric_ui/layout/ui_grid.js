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

const ui_grid = ({
  columns,
  rows,
  gap,
  ctx = [],
  style = {},
  ...rest
} = {}) => {
  const final_style = { ...style };
  if (columns !== undefined) final_style.gridTemplateColumns = _expand_tracks(columns);
  if (rows    !== undefined) final_style.gridTemplateRows    = _expand_tracks(rows);
  if (gap     !== undefined) final_style.gap = typeof gap === 'number' ? gap + 'px' : gap;

  return {
    ...rest,
    tag: 'div',
    class: rest.class ? 'ric-grid ' + rest.class : 'ric-grid',
    ...(Object.keys(final_style).length ? { style: final_style } : {}),
    ctx,
  };
};

module.exports = { ui_grid };
