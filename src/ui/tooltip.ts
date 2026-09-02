// ricdom/ui — createTooltip (設計書 §3.4 部品契約 + §5/付録 E a11y)
//
// v1 (ric_ui/popup/create_ui_tooltip.js) の移植 + a11y 新規実装 (aria-describedby / Esc)。
// v1 との相違点は portal の描画先が host.portal になったこと (§3.5) のみ、
// 位置計算 (top→bottom→right→left の優先順位) は v1 のロジックをそのまま使う。
//
// 使い方:
//   const tip = app.use(createTooltip());
//   render 内: tip({ content: 'ヒントテキスト', children: [uiButton({ children: ['?'] })] })

import type { RicNode } from '../types.js';
import { type AttachGuard, type Component, createAttachGuard } from './internal/component.js';

export type TooltipDir = 'auto' | 'top' | 'bottom' | 'right' | 'left';

export interface TooltipProps {
  content: RicNode;
  children: RicNode | RicNode[];
  dir?: TooltipDir;
}

interface Pos {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

let nextTooltipId = 0;

export type TooltipInstance = Component<TooltipProps>;

export const createTooltip = (): TooltipInstance => {
  const id = ++nextTooltipId;
  const tooltipId = `ricdom-tooltip-${id}`;
  const guard: AttachGuard = createAttachGuard('createTooltip');

  let isOpen = false;
  let pos: Pos = {};
  let dir: 'top' | 'bottom' | 'right' | 'left' = 'top';
  let contentLast: RicNode = null;

  const show = (triggerEl: Element, preferredDir: TooltipDir): void => {
    const rect = triggerEl.getBoundingClientRect();
    const POP_H = 34;
    const POP_W = 120;
    const GAP = 8;
    const chosen: 'top' | 'bottom' | 'right' | 'left' =
      preferredDir !== 'auto'
        ? preferredDir
        : rect.top >= POP_H + GAP
          ? 'top'
          : window.innerHeight - rect.bottom >= POP_H + GAP
            ? 'bottom'
            : window.innerWidth - rect.right >= POP_W + GAP
              ? 'right'
              : 'left';
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    dir = chosen;
    pos =
      chosen === 'top'
        ? { bottom: window.innerHeight - rect.top + GAP, left: cx }
        : chosen === 'bottom'
          ? { top: rect.bottom + GAP, left: cx }
          : chosen === 'right'
            ? { left: rect.right + GAP, top: cy }
            : { right: window.innerWidth - rect.left + GAP, top: cy };
    isOpen = true;
    guard.host?.notify();
  };

  const hide = (): void => {
    if (!isOpen) return;
    isOpen = false;
    guard.host?.notify();
  };

  const inst = ((props: TooltipProps): RicNode => {
    const host = guard.ensure();
    if (!host) return null;

    contentLast = props.content;
    const dirOpt = props.dir ?? 'auto';

    return {
      tag: 'span',
      class: 'ric-tooltip',
      'aria-describedby': tooltipId,
      onmouseenter: (ev: MouseEvent) => show(ev.currentTarget as Element, dirOpt),
      onmouseleave: hide,
      onfocus: (ev: FocusEvent) => show(ev.currentTarget as Element, dirOpt),
      onblur: hide,
      onkeydown: (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') hide();
      },
      children: props.children,
    } as unknown as RicNode;
  }) as TooltipInstance;

  inst.renderPortal = (): RicNode => {
    if (!guard.host || !isOpen) return null;
    const posStyle: Record<string, string> = {};
    if (pos.top !== undefined) posStyle.top = `${pos.top}px`;
    if (pos.bottom !== undefined) posStyle.bottom = `${pos.bottom}px`;
    if (pos.left !== undefined) posStyle.left = `${pos.left}px`;
    if (pos.right !== undefined) posStyle.right = `${pos.right}px`;
    return {
      tag: 'div',
      class: `ric-tooltip__popup ric-tooltip__popup--${dir}`,
      id: tooltipId,
      role: 'tooltip',
      style: posStyle,
      children: [typeof contentLast === 'string' ? { tag: 'span', children: [contentLast] } : contentLast],
    } as unknown as RicNode;
  };

  inst.attach = guard.attach;
  inst.dispose = (): void => guard.dispose();

  return inst;
};
