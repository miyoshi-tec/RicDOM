// ricdom/ui — popup 系の位置計算ヘルパー (Phase 3b、設計書「共通」節)
//
// Phase 2 の createPopup が自前に持っていた位置計算 (v1 の `_popup_utils.js` 相当:
// `_make_popup_dir` / `_pos_style` の後継) を、popup.ts / dropdown.ts / tooltip.ts の
// 3 部品で共有できるようここに切り出す (「重複を作らない」指示への対応)。
//
// v1 の `_get_portal_cb` (containing block 探索、`.ric-page` の backdrop-filter を
// 避けるための祖先探索) は移植しない — v2 には `.ric-page` 概念が無く、Phase 2 の
// createPopup も既に「viewport 基準 (window.innerWidth/innerHeight)」に簡略化して
// portal を実装していた (v1 との既知の差異、CB 相当の概念が無いため)。dropdown も
// 同じ簡略化を踏襲する (最終報告に記載)。
//
// v1 の `_get_expand_ref` (アイコンモードの「左右どちらに展開するか」を論理コンテナの
// 中心で判定する) も同様の理由で移植しない。dropdown は代わりに `clampLeft` で
// viewport 内に収める (below/above の flip と同じ「実測してからはみ出しを解消する」
// 考え方、位置決めの厳密さより「壊れない」ことを優先する v1 の設計思想を継承)。

export interface Pos {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth?: number;
}

/** Pos (px 数値) を inline style 用の文字列 object に変換する。 */
export const posToStyle = (pos: Pos): Record<string, string> => {
  const style: Record<string, string> = {};
  if (pos.top !== undefined) style.top = `${pos.top}px`;
  if (pos.bottom !== undefined) style.bottom = `${pos.bottom}px`;
  if (pos.left !== undefined) style.left = `${pos.left}px`;
  if (pos.right !== undefined) style.right = `${pos.right}px`;
  if (pos.minWidth !== undefined) style.minWidth = `${pos.minWidth}px`;
  return style;
};

/**
 * below/above の判定 (v1 `_make_popup_dir` 継承)。
 * trigger の下に contentH px 収まるか。収まらなくても上より下のスペースが広ければ below のまま。
 */
export const computeFlipDir = (rect: DOMRect, contentH: number): 'below' | 'above' => {
  const spaceBelow = window.innerHeight - rect.bottom;
  return spaceBelow >= contentH || spaceBelow >= rect.top ? 'below' : 'above';
};

/** computeFlipDir の座標版 (v1 `_make_popup_dir_at` 継承)。trigger の rect が無い openAt 用。 */
export const computeFlipDirAt = (y: number, contentH: number): 'below' | 'above' => {
  const spaceBelow = window.innerHeight - y;
  return spaceBelow >= contentH || spaceBelow >= y ? 'below' : 'above';
};

/** 横位置を viewport 内 ([margin, innerWidth - width - margin]) に収める。 */
export const clampLeft = (left: number, width: number | undefined, margin = 8): number => {
  if (width === undefined) return left;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  return Math.min(Math.max(left, margin), maxLeft);
};
