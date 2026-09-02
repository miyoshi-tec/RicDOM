// ricdom/ui — createScrollPane (設計書 §3.4 部品契約)
//
// v1 (ric_ui/composite/create_ui_scroll_pane.js) の移植。「最下部 (または最上部) 追従型の
// スクロール領域」— チャット UI・ログビューアで「内容が追加されたら自動で端までスクロール、
// ただしユーザーが途中を見ている間は動かさない」を宣言的に実現する (設計OS consumer が
// 高評価だった機能)。
//
// v1 との相違点:
//   - 状態を持つので `app.use(createScrollPane(options))` で明示登録する (設計書 §3.4)。
//     `scrollToBottom()`/`scrollToTop()` は host.notify() 経由で強制スクロールを予約する
//     (v1 の safe_notify 相当)。
//   - DOM 要素の特定は v1 の `data-ric-sp` + querySelector と同じ考え方だが、
//     `data-ricdom-role` (UI_ROLE.scrollPane、E2E/CSS の安定セレクタ) とは別に
//     `data-ricdom-scroll-pane-id` (複数インスタンス識別用、popup.ts の bodyMarker と
//     同じ二層構成) を持たせる。
//
// 使い方:
//   const pane = app.use(createScrollPane({ follow: 'bottom', threshold: 50 }));
//   render 内で毎回呼ぶ: pane({ children: [...messages] })
//   強制的に端まで (例: ユーザー送信時): pane.scrollToBottom() / pane.scrollToTop()

import type { ClassValue, RicNode, StyleValue } from '../types.js';
import { type AttachGuard, type Component, createAttachGuard } from './internal/component.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';

export type ScrollPaneFollow = 'bottom' | 'top' | 'none';

export interface CreateScrollPaneOptions {
  /** 追従方向 (既定 'bottom') */
  follow?: ScrollPaneFollow;
  /** 端からこの px 以内なら「追従対象」とみなす (既定 50) */
  threshold?: number;
}

export interface ScrollPaneProps {
  children?: RicNode | RicNode[];
  class?: ClassValue;
  style?: StyleValue;
  [key: string]: unknown;
}

export interface ScrollPaneInstance extends Component<ScrollPaneProps> {
  scrollToBottom(): void;
  scrollToTop(): void;
}

let nextScrollPaneId = 0;

/**
 * 端まで自動追従するスクロール領域を作る (チャット UI 等)。状態を持つため `app.use()` で登録する。
 *   const pane = app.use(createScrollPane({ follow: 'bottom' }));
 *   pane({ children: [...messages] })
 */
export const createScrollPane = (options: CreateScrollPaneOptions = {}): ScrollPaneInstance => {
  const { follow = 'bottom', threshold = 50 } = options;
  const id = ++nextScrollPaneId;
  const guard: AttachGuard = createAttachGuard('createScrollPane');

  let followNow = false; // render 前に計測した「追従すべきか」
  let forceTo: 'bottom' | 'top' | null = null;

  const findEl = (): HTMLElement | null => (typeof document === 'undefined' ? null : document.querySelector(`[data-ricdom-scroll-pane-id="${id}"]`));

  const shouldFollow = (el: HTMLElement): boolean => {
    if (follow === 'bottom') return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    if (follow === 'top') return el.scrollTop <= threshold;
    return false;
  };

  // rAF 後にスクロール位置を適用する (render で計測した状態を実 DOM に反映)
  const applyScroll = (): void => {
    const el = findEl();
    if (!el) return;
    if (forceTo === 'bottom') el.scrollTop = el.scrollHeight;
    else if (forceTo === 'top') el.scrollTop = 0;
    else if (followNow) {
      if (follow === 'bottom') el.scrollTop = el.scrollHeight;
      else if (follow === 'top') el.scrollTop = 0;
    }
    forceTo = null;
    followNow = false;
  };

  const inst = ((props: ScrollPaneProps = {}): RicNode => {
    const host = guard.ensure();
    if (!host) return null;

    const { children = [], class: extraClass, style, ...rest } = props;

    // render 前に「追従中か」を計測。DOM がまだ無い場合 (初回) は false。
    const el = findEl();
    if (el) followNow = shouldFollow(el);

    // 描画後に rAF でスクロール位置を適用する
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(applyScroll);

    return {
      ...rest,
      tag: 'div',
      class: mergeClass('ric-scroll-pane', extraClass),
      'data-ricdom-role': UI_ROLE.scrollPane,
      'data-ricdom-scroll-pane-id': String(id),
      style: { ...(style ?? {}), overflowY: 'auto' },
      children,
    } as unknown as RicNode;
  }) as ScrollPaneInstance;

  inst.attach = guard.attach;
  inst.dispose = (): void => guard.dispose();

  inst.scrollToBottom = (): void => {
    forceTo = 'bottom';
    guard.host?.notify();
  };
  inst.scrollToTop = (): void => {
    forceTo = 'top';
    guard.host?.notify();
  };

  return inst;
};
