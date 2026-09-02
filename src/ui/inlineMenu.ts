// ricdom/ui — uiInlineMenu (設計書 §3.4: 状態を持たない純粋関数部品、Phase 3b)
//
// v1 (ric_ui/composite/ui_inline_menu.js) の camelCase 移植。trigger 要素の近くに
// absolute 配置する軽量ポップオーバー。
//
// 位置づけ (v1 継承):
//   - createPopup/createDropdown は portal + overlay + 1-trigger-instance で、
//     行ごとに存在しうる「…」メニューには重すぎる (N 行 → N instance)。
//   - uiInlineMenu は portal を持たず、親要素の position:relative に対して
//     position:absolute だけで配置する純粋関数。インスタンスを取らないので
//     `app.use()` は不要 (設計書 §3.4: 状態を持たない部品は純粋関数)。
//   - open 状態は呼び出し側の state が管理する (v1 継承)。
//
// 含まない機能 (意図的、v1 継承):
//   - 外クリックで閉じる挙動は持たない。onclick が stopPropagation するため、
//     document レベルの click listener が「menu 外をクリック」を検知できる
//     (呼び出し側で 1 つ書く、または将来の watchOutsideClick 相当ヘルパー)。
//   - 矢印キーでの項目間移動・focus trap は持たない。本格的な menu が要るなら
//     createPopup (role="menu" + 矢印キー/Home/End) を使うこと。
//
// v1 との相違点 (Phase 3b の a11y 最小追加、設計書「意図的に最小」の指示):
//   - `role="menu"` を追加。
//   - Esc キーで閉じたいケース向けに、新規の任意 prop `onClose` を追加した。
//     uiInlineMenu 自身は state を持たないため自分では閉じられない (v1 と同じ制約) —
//     `onClose` を渡した場合のみ Escape 押下時にそれを呼ぶ (呼び出し側が
//     `s.menuFor = null` 等で閉じる)。省略時は v1 と同じ「何もしない」挙動を保つ
//     (後方互換、最終報告に記載)。
//
// 親側の要件 (v1 継承):
//   - 親 (uiInlineMenu を含む要素) は position:relative を付ける必要がある。
//     anchor の bl/br/tl/tr はこの親の四隅に対する位置として解釈される。
//   - dev モードで、親要素が positioned でない場合に console.warn する
//     (rAF で描画後に検査、spam しないよう WeakSet で警告済み親を記録)。

import type { ClassValue, RicNode, StyleValue } from '../types.js';
import { UI_ROLE, isDevMode, mergeClass } from './internal/pureHelpers.js';

export type UiInlineMenuAnchor = 'br' | 'bl' | 'tr' | 'tl';

export interface UiInlineMenuProps {
  /** false のとき null を返す (render 結果ごと消える、v1 継承) */
  open: boolean;
  anchor?: UiInlineMenuAnchor;
  children?: RicNode | RicNode[];
  style?: StyleValue;
  class?: ClassValue;
  /** Escape 押下時に呼ばれる (新規、ヘッダコメント参照。省略可) */
  onClose?: () => void;
}

// anchor → 絶対位置スタイル。「br = bottom-right」のように親の右下に張り付く位置として読む (v1 継承)。
const ANCHOR_STYLE: Record<UiInlineMenuAnchor, Record<string, string | number>> = {
  br: { top: '100%', right: 0, marginTop: '4px' },
  bl: { top: '100%', left: 0, marginTop: '4px' },
  tr: { bottom: '100%', right: 0, marginBottom: '4px' },
  tl: { bottom: '100%', left: 0, marginBottom: '4px' },
};

// 親要素が positioned (relative/absolute/fixed/sticky) であることを dev mode で警告する
// (v1 v0.3.16〜継承)。anchor の `top:100% + right:0` 等は nearest positioned ancestor を
// 基準に計算されるため、親が static だと menu は body/別の祖先を基準に出現する
// silent failure になる。rAF を 1 つ schedule して描画コミット後に document を走査する。
const warnedParents: WeakSet<Element> | null = typeof WeakSet === 'function' ? new WeakSet() : null;
let parentCheckScheduled = false;

const scheduleParentPositionCheck = (): void => {
  if (parentCheckScheduled) return;
  if (!warnedParents) return;
  if (typeof document === 'undefined') return;
  if (typeof requestAnimationFrame !== 'function') return;
  if (typeof getComputedStyle !== 'function') return;

  parentCheckScheduled = true;
  requestAnimationFrame(() => {
    parentCheckScheduled = false;
    const menus = document.querySelectorAll('.ric-inline-menu');
    for (const el of menus) {
      const parent = el.parentElement;
      if (!parent || warnedParents.has(parent)) continue;
      const pos = getComputedStyle(parent).position;
      // jsdom は CSS 未指定の要素に対し '' を返すケースがある。ブラウザは 'static' を
      // 返す。両方を「unpositioned」として扱う。
      if (pos && pos !== 'static') continue;
      warnedParents.add(parent);
      console.warn(
        `RicDOM UI: uiInlineMenu の親要素に position 指定がありません (computed: ${pos || 'static'})。` +
          'menu は nearest positioned ancestor (or <body>) を基準に出現します。\n' +
          '✅ 親要素に `position: relative` (or absolute/fixed/sticky) を付けてください。',
        parent,
      );
    }
  });
};

export const uiInlineMenu = ({ open = false, anchor = 'br', children = [], style, class: extraClass, onClose }: UiInlineMenuProps): RicNode => {
  if (!open) return null;

  if (isDevMode()) scheduleParentPositionCheck();

  const mergedStyle: Record<string, string | number> = {
    position: 'absolute',
    zIndex: 10,
    ...ANCHOR_STYLE[anchor] ?? ANCHOR_STYLE.br,
    ...(style ?? {}),
  };

  return {
    tag: 'div',
    class: mergeClass('ric-inline-menu', extraClass),
    'data-ricdom-role': UI_ROLE.inlineMenu,
    role: 'menu',
    style: mergedStyle,
    // menu 内クリックは document に bubble させない (外クリック検知の自前実装と
    // 衝突しないように、v1 継承)。
    onclick: (ev: MouseEvent) => ev.stopPropagation(),
    onkeydown: onClose
      ? (ev: KeyboardEvent) => {
          if (ev.key === 'Escape') {
            ev.stopPropagation();
            onClose();
          }
        }
      : undefined,
    children,
  } as unknown as RicNode;
};
