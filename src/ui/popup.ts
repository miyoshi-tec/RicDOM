// ricdom/ui — createPopup (設計書 §3.4 部品契約 + §5/付録 E a11y)
//
// v1 (ric_ui/popup/create_ui_popup.js) を「menu に絞った」形で再設計し、a11y を新規実装する。
// v1 との相違点:
//   - v1 は label/icon/chevron の 3 モードを持つ汎用ドロップダウン (旧 dropdown/menu 統合) だったが、
//     設計書 E の記述 (aria-haspopup="menu" / role="menu" / menuitem 自動付与) に合わせて
//     「トリガー + role=menu の本体」に絞ったメニュー部品として実装し直した
//     (v1 の label/icon モード相当は `createDropdown` として別部品に分離、
//     設計書 §13 で確定済みの方針)。
//   - 矢印キー (↑↓) での項目間移動・Home/End・Esc でトリガーへ復帰を新規実装 (a11y、v1 未対応)。
//   - 排他制御 (他の popup を閉じる) は
//     `internal/exclusiveRegistry.ts` (host.app 単位、v1 の無制限成長するモジュール
//     レベル `_popup_registry` の後継、B13 解消) を使って実装した。createDropdown と
//     同じレジストリを共有する (「popup 系」全体で 1 つ開いたら他を閉じる、v1 踏襲)。
//   - 位置計算 (below/above flip・横 clamp) は `internal/popupPosition.ts` に切り出し、
//     createDropdown / createTooltip と共有する (重複を作らない)。
//
// 使い方:
//   const menu = app.use(createPopup());
//   render 内: menu({ trigger: ['⋯'], children: [uiButton({ children: ['削除'], onclick: ... })] })
//   → 戻り値はトリガーボタンの RicNode。
//   任意の座標に開く: menu.openAt(event) / menu.openAt({ x, y })

import type { ClassValue, RicNode, StyleValue } from '../types.js';
import { ANIMATION_FALLBACK_MS, type AttachGuard, type Component, createAttachGuard, type Host } from './internal/component.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';
import { clampLeft, computeAnchoredLeft, computeFlipDir, computeFlipDirAt, type Pos, posToStyle } from './internal/popupPosition.js';
import { closeOthers, registerExclusive, unregisterExclusive } from './internal/exclusiveRegistry.js';

/**
 * トリガーの見た目を `uiButton` 相当 (icon + ghost の丸ボタン等) にしたいケース向けの
 * オブジェクト形 (2.0.0-alpha.2、v1 parity — v1 の icon/ghost トリガーが再現できず
 * consumer が構造セレクタで CSS 上書きしていた報告への対応)。`trigger` に直接
 * `RicNode`/`RicNode[]` (中身をそのままボタンに詰める、既存の形) を渡すのと二者択一。
 */
export interface PopupTriggerObject {
  icon?: RicNode;
  label?: RicNode | RicNode[];
  ghost?: boolean;
  size?: 'sm' | 'md' | 'lg';
  class?: ClassValue;
  style?: StyleValue;
}

export interface PopupProps {
  /** トリガーボタンの中身。`RicNode`/`RicNode[]` (中身をそのまま詰める) か、
   *  見た目を指定する `PopupTriggerObject` のどちらか。 */
  trigger: RicNode | RicNode[] | PopupTriggerObject;
  /** メニュー項目 (各要素に role="menuitem" が自動付与される) */
  children?: RicNode[];
}

// trigger が PopupTriggerObject かどうかの判定。RicElementNode は型上 `tag` が必須
// (設計書 §3.1) なので、「object かつ配列でない かつ tag を持たない」で確実に区別できる。
const isTriggerObject = (t: PopupProps['trigger']): t is PopupTriggerObject =>
  t !== null && typeof t === 'object' && !Array.isArray(t) && !('tag' in (t as Record<string, unknown>));

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

const wrapMenuItem = (node: RicNode): RicNode => {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
  const el = node as unknown as Record<string, unknown>;
  // v1 由来の `typeof el.class === 'string' ? el.class : ''` は配列/真偽値マップ形の
  // class を黙って捨てていた (2.0.0-alpha.2、パイロット第 2 号の報告)。他部品と同じ
  // mergeClass (internal/pureHelpers.ts) を使い、3 形態すべてを連結する。
  return {
    ...el,
    role: el.role ?? 'menuitem',
    tabIndex: -1,
    // getMenuItems() (矢印キー/Home/End のフォーカス移動) が問い合わせる安定セレクタ。
    // これが無いと handleKeydown が常に items.length===0 で無反応になる (実ブラウザ
    // テストで発見・修正)。
    'data-ricdom-role': UI_ROLE.popupItem,
    class: mergeClass('ric-popup__item', el.class as ClassValue | undefined),
  } as unknown as RicNode;
};

/**
 * `role="menu"` のドロップダウンメニューを作る。状態を持つため `app.use(createPopup())` で登録する。
 *   const menu = app.use(createPopup());
 *   menu({ trigger: ['⋯'], children: [uiButton({ children: ['削除'], onclick: ... })] })
 */
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
    return Array.from(body.querySelectorAll<HTMLElement>(`[data-ricdom-role="${UI_ROLE.popupItem}"]`));
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

  // 排他制御 (host.app 単位、internal/exclusiveRegistry.ts、設計書「共通」節)。
  // createDropdown と同じレジストリを共有し、「popup 系」全体で 1 つ開いたら他を閉じる。
  const exclusiveSelf = { close: doClose };

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

  const computePos = (rect: DOMRect, chosenDir: 'below' | 'above', measuredWidth?: number): Pos => ({
    top: chosenDir === 'below' ? rect.bottom + 4 : undefined,
    bottom: chosenDir === 'above' ? window.innerHeight - rect.top + 4 : undefined,
    left: computeAnchoredLeft(rect, measuredWidth),
  });

  const computePosAt = (x: number, y: number, chosenDir: 'below' | 'above', measuredWidth: number | undefined): Pos => ({
    top: chosenDir === 'below' ? y + 4 : undefined,
    bottom: chosenDir === 'above' ? window.innerHeight - y + 4 : undefined,
    left: clampLeft(x, measuredWidth),
  });

  const beginMeasuredOpen = (initialDir: 'below' | 'above', initialPos: Pos, remeasure: () => void): void => {
    if (guard.host) closeOthers(guard.host.app, exclusiveSelf);
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

    menuChildrenLast = props.children ?? [];
    bindKeydownIfNeeded();

    // object 形トリガー (2.0.0-alpha.2、PopupTriggerObject) は icon/label を
    // uiButton 相当の見た目 (.ric-button + --ghost + --sm/--lg) に組み立てる。
    // 従来の RicNode/RicNode[] 形はそのまま children に詰める (後方互換)。
    const triggerObj = isTriggerObject(props.trigger) ? props.trigger : null;
    triggerChildrenLast = triggerObj
      ? [...(triggerObj.icon !== undefined ? [triggerObj.icon] : []), ...(triggerObj.label !== undefined ? (Array.isArray(triggerObj.label) ? triggerObj.label : [triggerObj.label]) : [])]
      : (props.trigger as RicNode | RicNode[]);
    const triggerBaseClass = triggerObj
      ? mergeClass(['ric-button', triggerObj.ghost ? 'ric-button--ghost' : '', triggerObj.size && triggerObj.size !== 'md' ? `ric-button--${triggerObj.size}` : ''].filter(Boolean).join(' '), triggerObj.class)
      : 'ric-button';

    return {
      tag: 'button',
      class: `${triggerBaseClass}${isOpen ? ' ric-popup__trigger--open' : ''}`,
      ...(triggerObj?.style ? { style: triggerObj.style } : {}),
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
        const initialDir = computeFlipDir(rect, 160);
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
          const measuredW = body.offsetWidth;
          const measuredH = body.offsetHeight;
          const newDir = computeFlipDir(rect, measuredH);
          dir = newDir;
          pos = computePos(rect, newDir, measuredW);
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
      { tag: 'div', class: 'ric-popup__overlay', 'data-ricdom-role': UI_ROLE.popupOverlay, onclick: closeAndRestoreFocus },
      {
        tag: 'div',
        class: `ric-popup__body ric-popup__body--${dir}${isClosing ? ' ric-popup__body--out' : ''}`,
        role: 'menu',
        'data-ricdom-role': UI_ROLE.popup,
        'data-ricdom-popup-id': bodyMarker,
        style: { ...posToStyle(pos), ...(isMeasuring ? { visibility: 'hidden' } : {}) },
        onanimationend: handleAnimEnd,
        children: menuChildrenLast.map(wrapMenuItem),
      },
    ] as unknown as RicNode;
  };

  inst.attach = (host: Host) => {
    guard.attach(host);
    registerExclusive(host.app, exclusiveSelf);
  };
  inst.dispose = (): void => {
    if (escBound && typeof document !== 'undefined') {
      document.removeEventListener('keydown', handleKeydown);
      escBound = false;
    }
    if (guard.host) unregisterExclusive(guard.host.app, exclusiveSelf);
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
    const initialDir = computeFlipDirAt(y, 160);
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
      const newDir = computeFlipDirAt(y, measuredH);
      dir = newDir;
      pos = computePosAt(x, y, newDir, measuredW);
      isMeasuring = false;
      guard.host?.notify();
    });
  };

  return inst;
};
