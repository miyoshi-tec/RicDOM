// ricdom/ui — createPopup (設計書 §3.4 部品契約 + §5/付録 E a11y)
//
// v1 (ric_ui/popup/create_ui_popup.js) を「menu に絞った」形で再設計し、a11y を新規実装する。
// v1 との相違点:
//   - v1 は label/icon/chevron の 3 モードを持つ汎用ドロップダウン (旧 dropdown/menu 統合) だったが、
//     設計書 E の記述 (aria-haspopup="menu" / role="menu" / menuitem 自動付与) に合わせて
//     「トリガー + role=menu の本体」に絞ったメニュー部品として実装し直した
//     (v1 の label モード相当が必要になったら Phase 3 で Popover 的な別部品として再検討、最終報告に記載)。
//   - 矢印キー (↑↓) での項目間移動・Home/End・Esc でトリガーへ復帰を新規実装 (a11y、v1 未対応)。
//   - 排他制御 (他の popup を閉じる) は v1 の `_popup_registry` (モジュールレベル無制限成長、
//     負債 B13) を廃止し、`use()` された全インスタンスを app 側の `registeredParts`
//     経由でたどれるようにはしない (Phase 2 は 1 app 内の複数 popup 排他までは実装しない —
//     必要になったら host 経由で app レベルのレジストリを持たせる形を Phase 3 で検討)。
//
// 使い方:
//   const menu = app.use(createPopup());
//   render 内: menu({ trigger: ['⋯'], children: [uiButton({ children: ['削除'], onclick: ... })] })
//   → 戻り値はトリガーボタンの RicNode。
//   任意の座標に開く: menu.openAt(event) / menu.openAt({ x, y })

import type { RicNode } from '../types.js';
import { ANIMATION_FALLBACK_MS, type AttachGuard, type Component, createAttachGuard } from './internal/component.js';

export interface PopupProps {
  /** トリガーボタンの中身 */
  trigger: RicNode | RicNode[];
  /** メニュー項目 (各要素に role="menuitem" が自動付与される) */
  children?: RicNode[];
}

export interface PopupPoint {
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
  target?: EventTarget | null;
}

export interface PopupInstance extends Component<PopupProps> {
  close(): void;
  isOpen(): boolean;
  /** 任意の座標に開く (trigger ボタンを使わないケース用、v1 v0.4.3 継承) */
  openAt(point: PopupPoint): void;
}

let nextPopupId = 0;

interface Pos {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

const posToStyle = (pos: Pos): Record<string, string> => {
  const style: Record<string, string> = {};
  if (pos.top !== undefined) style.top = `${pos.top}px`;
  if (pos.bottom !== undefined) style.bottom = `${pos.bottom}px`;
  if (pos.left !== undefined) style.left = `${pos.left}px`;
  if (pos.right !== undefined) style.right = `${pos.right}px`;
  return style;
};

const wrapMenuItem = (node: RicNode): RicNode => {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
  const el = node as unknown as Record<string, unknown>;
  const existingClass = typeof el.class === 'string' ? el.class : '';
  return {
    ...el,
    role: el.role ?? 'menuitem',
    tabIndex: -1,
    // getMenuItems() (矢印キー/Home/End のフォーカス移動) が問い合わせる安定セレクタ。
    // これが無いと handleKeydown が常に items.length===0 で無反応になる (実ブラウザ
    // テストで発見・修正)。
    'data-ricdom-role': 'popup-item',
    class: existingClass ? `ric-popup__item ${existingClass}` : 'ric-popup__item',
  } as unknown as RicNode;
};

export const createPopup = (): PopupInstance => {
  const id = ++nextPopupId;
  const bodyMarker = `ricdom-popup-${id}`;
  const guard: AttachGuard = createAttachGuard('createPopup');

  let isOpen = false;
  let isClosing = false;
  let isMeasuring = false;
  let dir: 'below' | 'above' = 'below';
  let pos: Pos = {};
  let escBound = false;
  let triggerChildrenLast: RicNode | RicNode[] = [];
  let menuChildrenLast: RicNode[] = [];
  let restoreFocusEl: HTMLElement | null = null;

  const getBodyEl = (): HTMLElement | null => (typeof document === 'undefined' ? null : document.querySelector(`[data-ricdom-popup-id="${bodyMarker}"]`));

  const getMenuItems = (): HTMLElement[] => {
    const body = getBodyEl();
    if (!body) return [];
    return Array.from(body.querySelectorAll<HTMLElement>('[data-ricdom-role="popup-item"]'));
  };

  // handleAnimEnd は冪等 (isClosing チェック) — 実 animationend と
  // ANIMATION_FALLBACK_MS のフォールバックタイマーの両方から安全に呼べる。
  // consumer が ricdom-ui.css を読み込み忘れている等でアニメーションが走らない場合、
  // animationend が永久に発火せず popup が閉じたまま DOM に残り続けるのを防ぐ。
  const handleAnimEnd = (): void => {
    if (!isClosing) return;
    isOpen = false;
    isClosing = false;
    guard.host?.notify();
  };

  const doClose = (): void => {
    if (isClosing || !isOpen) return;
    isClosing = true;
    guard.host?.notify();
    if (typeof setTimeout !== 'undefined') setTimeout(handleAnimEnd, ANIMATION_FALLBACK_MS);
  };

  const closeAndRestoreFocus = (): void => {
    doClose();
    if (restoreFocusEl && typeof restoreFocusEl.focus === 'function') restoreFocusEl.focus();
  };

  const handleKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      closeAndRestoreFocus();
      return;
    }
    const items = getMenuItems();
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]!.focus();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]!.focus();
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      items[0]!.focus();
    } else if (ev.key === 'End') {
      ev.preventDefault();
      items[items.length - 1]!.focus();
    }
  };

  const bindKeydownIfNeeded = (): void => {
    if (typeof document === 'undefined') return;
    if (isOpen && !escBound) {
      document.addEventListener('keydown', handleKeydown);
      escBound = true;
    }
    if (!isOpen && escBound) {
      document.removeEventListener('keydown', handleKeydown);
      escBound = false;
    }
  };

  // below/above の判定 (v1 の _make_popup_dir 継承): trigger の下に content_h px 収まるか
  const computeDir = (rect: DOMRect, contentH: number): 'below' | 'above' => {
    const spaceBelow = window.innerHeight - rect.bottom;
    return spaceBelow >= contentH || spaceBelow >= rect.top ? 'below' : 'above';
  };
  const computeDirAt = (y: number, contentH: number): 'below' | 'above' => {
    const spaceBelow = window.innerHeight - y;
    return spaceBelow >= contentH || spaceBelow >= y ? 'below' : 'above';
  };

  const computePos = (rect: DOMRect, chosenDir: 'below' | 'above'): Pos => ({
    top: chosenDir === 'below' ? rect.bottom + 4 : undefined,
    bottom: chosenDir === 'above' ? window.innerHeight - rect.top + 4 : undefined,
    left: rect.left,
  });

  const clampLeft = (left: number, width: number | undefined): number => {
    if (width === undefined) return left;
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    return Math.min(Math.max(left, margin), maxLeft);
  };

  const computePosAt = (x: number, y: number, chosenDir: 'below' | 'above', measuredWidth: number | undefined): Pos => ({
    top: chosenDir === 'below' ? y + 4 : undefined,
    bottom: chosenDir === 'above' ? window.innerHeight - y + 4 : undefined,
    left: clampLeft(x, measuredWidth),
  });

  const beginMeasuredOpen = (initialDir: 'below' | 'above', initialPos: Pos, remeasure: () => void): void => {
    dir = initialDir;
    pos = initialPos;
    const canMeasure = typeof requestAnimationFrame !== 'undefined' && typeof document !== 'undefined';
    isMeasuring = canMeasure;
    isClosing = false;
    isOpen = true;
    guard.host?.notify();
    if (canMeasure) requestAnimationFrame(remeasure);
  };

  const inst = ((props: PopupProps): RicNode => {
    const host = guard.ensure();
    if (!host) return null;

    triggerChildrenLast = props.trigger;
    menuChildrenLast = props.children ?? [];
    bindKeydownIfNeeded();

    return {
      tag: 'button',
      class: `ric-button${isOpen ? ' ric-popup__trigger--open' : ''}`,
      'aria-haspopup': 'menu',
      'aria-expanded': isOpen ? 'true' : 'false',
      onclick: (ev: MouseEvent) => {
        if (isClosing) return;
        if (isOpen) {
          closeAndRestoreFocus();
          return;
        }
        const triggerEl = ev.currentTarget as HTMLElement;
        restoreFocusEl = triggerEl;
        const rect = triggerEl.getBoundingClientRect();
        const initialDir = computeDir(rect, 160);
        beginMeasuredOpen(initialDir, computePos(rect, initialDir), () => {
          if (!isOpen || isClosing) {
            isMeasuring = false;
            return;
          }
          const body = getBodyEl();
          if (!body) {
            isMeasuring = false;
            guard.host?.notify();
            return;
          }
          const measuredH = body.offsetHeight;
          const newDir = computeDir(rect, measuredH);
          if (newDir !== dir) {
            dir = newDir;
            pos = computePos(rect, newDir);
          }
          isMeasuring = false;
          guard.host?.notify();
        });
      },
      children: triggerChildrenLast,
    } as unknown as RicNode;
  }) as PopupInstance;

  inst.renderPortal = (): RicNode => {
    if (!guard.host || !isOpen) return null;
    return [
      { tag: 'div', class: 'ric-popup__overlay', onclick: closeAndRestoreFocus },
      {
        tag: 'div',
        class: `ric-popup__body ric-popup__body--${dir}${isClosing ? ' ric-popup__body--out' : ''}`,
        role: 'menu',
        'data-ricdom-popup-id': bodyMarker,
        style: { ...posToStyle(pos), ...(isMeasuring ? { visibility: 'hidden' } : {}) },
        onanimationend: handleAnimEnd,
        children: menuChildrenLast.map(wrapMenuItem),
      },
    ] as unknown as RicNode;
  };

  inst.attach = guard.attach;
  inst.dispose = (): void => {
    if (escBound && typeof document !== 'undefined') {
      document.removeEventListener('keydown', handleKeydown);
      escBound = false;
    }
    guard.dispose();
  };

  inst.close = (): void => doClose();
  inst.isOpen = (): boolean => isOpen;

  inst.openAt = (point: PopupPoint): void => {
    if (isClosing) return;
    if (!point || typeof point !== 'object') {
      console.error('RicDOM UI: createPopup().openAt には { x, y } または { clientX, clientY } を持つオブジェクトを渡してください。');
      return;
    }
    const x = point.x ?? point.clientX;
    const y = point.y ?? point.clientY;
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y)) {
      console.error('RicDOM UI: createPopup().openAt: x/y (または clientX/clientY) が数値ではありません。');
      return;
    }
    restoreFocusEl = point.target instanceof HTMLElement ? point.target : (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null);
    const initialDir = computeDirAt(y, 160);
    beginMeasuredOpen(initialDir, computePosAt(x, y, initialDir, undefined), () => {
      if (!isOpen || isClosing) {
        isMeasuring = false;
        return;
      }
      const body = getBodyEl();
      if (!body) {
        isMeasuring = false;
        guard.host?.notify();
        return;
      }
      const measuredW = body.offsetWidth;
      const measuredH = body.offsetHeight;
      const newDir = computeDirAt(y, measuredH);
      dir = newDir;
      pos = computePosAt(x, y, newDir, measuredW);
      isMeasuring = false;
      guard.host?.notify();
    });
  };

  return inst;
};
