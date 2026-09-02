// ricdom/ui — uiIcon (設計書 §3.4 純粋関数部品、Phase 3a)
//
// v1 (ric_ui/control/ui_icon.js) の camelCase 移植。SVG アイコンを descriptor から生成する。
//
// 設計の核: アイコンは「データ (JSON descriptor)」であり、RicDOM の木にそのまま挿せる。
// 素材はアイコンピッカー/CLI から「使う分だけ」コピーする想定で、ricdom/ui 本体には
// アイコンデータを一切含めない (バンドルを太らせない、v1 踏襲)。
//
// ⚠️ AI エージェントへ: descriptor の path (`p`) を記憶から手書きしないこと。sub-path 欠落等で
//   「それっぽく見えるが壊れている」アイコンが静かに出荷される (v1 での実例あり)。アイコンが
//   欲しいときは既存の同梱データ (v1 docs/icons/、CLI の ricdom-icon 相当) から取得すること。
//   v2 では Phase 3a 時点で同梱アイコンデータ/CLI をまだ移植していない (最終報告に記載) —
//   手書きが避けられない状況では、まずユーザー (人間) に確認して許可を得てから行うこと。
//
// descriptor:
//   { v?, s?, p }
//     v = viewBox (既定 '0 0 24 24')
//     s = stroke-width。stroke がデフォルト:
//         省略 → stroke 2 / 数値 → その太さ / null → fill モード (塗りつぶし)。
//     p = path の d 文字列、または複数 path の文字列配列
//
// opts:
//   size        数値 (px に変換) or CSS 文字列。既定 '1em' (= 親 font-size 追従)。
//   label       指定あり → role="img" + aria-label (意味を持つアイコン)。
//               省略     → aria-hidden="true" (装飾。隣にテキストがある場合の二重読み上げ防止)。
//   spin        true で回転 (class ric-icon--spin + @keyframes ric-spin)。spinner 用。
//   strokeWidth descriptor.s を上書きする stroke 幅。指定すると stroke モードを強制。
//
// 色は currentColor 固定 = CSS の color プロパティでテーマに追従する。

import type { RicElementNode, RicNode, StyleValue } from '../types.js';
import { UI_ROLE } from './internal/pureHelpers.js';

export interface UiIconDescriptor {
  /** viewBox (既定 '0 0 24 24') */
  v?: string;
  /** stroke-width。省略 → 2 (stroke) / 数値 → その太さ (stroke) / null → fill モード */
  s?: number | null;
  /** path の d 文字列、または複数 path の文字列配列 */
  p?: string | string[];
}

export interface UiIconOptions {
  size?: number | string;
  label?: string;
  spin?: boolean;
  strokeWidth?: number | null;
  class?: string;
  style?: StyleValue;
  [key: string]: unknown;
}

export const uiIcon = (descriptor: UiIconDescriptor = {}, opts: UiIconOptions = {}): RicNode => {
  const { size = '1em', label, spin = false, strokeWidth, class: cls, style: optStyle, ...rest } = opts;
  const { v = '0 0 24 24', s, p } = descriptor;
  const paths = Array.isArray(p) ? p : p != null ? [p] : [];

  // stroke がデフォルト (大多数のアイコンは線画)。fill モードは s:null を明示したときだけ。
  //   strokeWidth (opts) → stroke 幅を上書き (s より優先、stroke を強制)
  //   s === null         → 明示 fill
  //   s == null          → 省略 → 既定 stroke 2
  //   それ以外           → 明示 stroke 幅
  const sw = strokeWidth != null ? strokeWidth : s === null ? null : s == null ? 2 : s;
  const isStroke = sw != null;

  const sizeVal = typeof size === 'number' ? `${size}px` : size;
  const clsStr = ['ric-icon', spin ? 'ric-icon--spin' : '', cls].filter(Boolean).join(' ');

  return {
    ...rest,
    tag: 'svg',
    viewBox: v,
    fill: isStroke ? 'none' : 'currentColor',
    ...(isStroke
      ? {
          stroke: 'currentColor',
          'stroke-width': sw,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }
      : {}),
    class: clsStr,
    'data-ricdom-role': UI_ROLE.icon,
    // サイズ・縦整列・flex 潰れ防止を inline style で持たせる。これにより .ric-icon CSS
    // (ricdom-ui.css) が読み込まれていない環境でも、サイズ/テキスト隣接時のベースライン
    // 整列/flex 内で潰れない、が効く (v1 踏襲。verticalAlign: -0.125em は標準的な微調整値)。
    style: { verticalAlign: '-0.125em', flexShrink: 0, ...(optStyle ?? {}), width: sizeVal, height: sizeVal },
    ...(label != null ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }),
    children: paths.map((d) => ({ tag: 'path', d }) as unknown as RicElementNode),
    // svg の viewBox / stroke-width 等は IDL プロパティではなく素の属性であり、
    // TagAttrs (IDL プロパティのプリミティブ値から自動導出、src/types.ts) の対象外
    // (v1 には無かった v2 固有の制約。dialog.ts/popup.ts 等の他 portal 部品も同じ理由で
    // `as unknown as RicNode` を使っている、v2 の既存パターンを踏襲)。
  } as unknown as RicElementNode;
};
