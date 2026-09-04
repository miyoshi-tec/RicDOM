// ricdom/ui — createTabs (設計書 §3.4 部品契約 + 付録 E a11y)
//
// v1 (ric_ui/composite/ui_tabs.js + bind_tabs.js) の移植。
//
// v1 との相違点:
//   - v1 の ui_tabs は状態を持たない純粋関数 (どのタブがアクティブかは常に呼び出し側の
//     state、`bind_tabs` はその双方向バインド糖衣) だった。v2 の createTabs は
//     **controlled/uncontrolled 両対応**にする —
//     `active` props を渡せば controlled (v1 の ui_tabs 相当)、省略すれば
//     uncontrolled (内部状態で管理、`bind_tabs` 相当の糖衣が要らなくなる)。
//     状態を持ちうるため `app.use(createTabs())` で明示登録する (設計書 §3.4)。
//   - a11y を新規実装 (v1 未対応): `role="tablist"/"tab"/"tabpanel"`、`aria-selected`、
//     **roving tabindex** (アクティブなタブだけ `tabindex=0`、他は `-1`) +
//     矢印キー/Home/End でのタブ移動 (付録 E、automatic activation — フォーカス移動が
//     即アクティブ切り替えを兼ねる。v1 のクリック切り替えと同じ単純さを保つ選択、
//     最終報告に記載)。
//   - `onChange` はモードに関わらずタブ選択のたびに呼ぶ (splitter の `onResizeEnd` と
//     同じ考え方 — 「選択が起きた」という事実の通知と、controlled/uncontrolled の
//     区別は独立の関心事にする)。uncontrolled では内部状態も同時に更新するので、
//     `onChange` の実装を省略しても見た目は正しく切り替わる。
//
// 使い方:
//   const tabs = app.use(createTabs());
//   uncontrolled: tabs({ items: [{ key:'a', label:'A', children:[...] }, ...] })
//   controlled:   tabs({ items, active: s.tab, onChange: (k) => { s.tab = k; } })

import type { RicNode } from '../types.js';
import { type AttachGuard, type Component, createAttachGuard } from './internal/component.js';
import { UI_ROLE } from './internal/pureHelpers.js';

export interface TabItem {
  key: string;
  label: RicNode | RicNode[];
  children?: RicNode | RicNode[];
}

export type TabsVariant = 'line' | 'pill';

export interface TabsProps {
  items: TabItem[];
  /** controlled mode のアクティブキー。指定すると controlled になる。 */
  active?: string;
  /** タブ選択のたびに呼ばれる (controlled/uncontrolled 共通) */
  onChange?: (key: string) => void;
  variant?: TabsVariant;
  /** uncontrolled mode の初期アクティブキー (省略時は items[0].key) */
  defaultActive?: string;
}

export interface TabsInstance extends Component<TabsProps> {
  /** 現在のアクティブキー (uncontrolled 時は内部状態、controlled 時は直近の active props) */
  active(): string | null;
}

let nextTabsId = 0;

/**
 * タブ切り替え (controlled/uncontrolled 両対応) を作る。状態を持つため `app.use()` で登録する。
 *   const tabs = app.use(createTabs());
 *   tabs({ items: [{ key: 'a', label: 'A', children: [...] }] })
 */
export const createTabs = (): TabsInstance => {
  const id = ++nextTabsId;
  const guard: AttachGuard = createAttachGuard('createTabs');

  let activeInternal: string | null = null; // uncontrolled 用
  let lastActive: string | null = null; // active() 用 (どちらのモードでも直近値を保持)
  const tablistMarker = `ricdom-tabs-${id}`;
  const tabId = (key: string): string => `ricdom-tabs-${id}-${encodeURIComponent(key)}-tab`;
  const panelId = `ricdom-tabs-${id}-panel`;

  const getTabButtons = (): HTMLElement[] => {
    if (typeof document === 'undefined') return [];
    const bar = document.querySelector(`[data-ricdom-tabs-id="${tablistMarker}"]`);
    return bar ? Array.from(bar.querySelectorAll<HTMLElement>(`[data-ricdom-role="${UI_ROLE.tabsTab}"]`)) : [];
  };

  const inst = ((props: TabsProps): RicNode => {
    const host = guard.ensure();
    if (!host) return null;

    const { items = [], active, onChange, variant = 'line', defaultActive } = props;
    const controlled = active !== undefined;
    // パネル無しモード (2.0.0-alpha.2、v1 parity — セグメントコントロール用途)。
    // 全 item に children が無ければ tabpanel 自体を描かず、aria-controls も省略する。
    // 1 つでも children があれば (undefined でない item が 1 つでもあれば) 従来どおり。
    const hasAnyPanel = items.some((it) => it.children !== undefined);

    const select = (key: string): void => {
      onChange?.(key);
      if (!controlled) {
        activeInternal = key;
        guard.host?.notify();
      }
    };

    // active 未指定/範囲外のときは先頭を fallback (state が空でも壊れないため、v1 継承)
    const resolveActiveKey = (): string | null => {
      const candidate = controlled ? active : (activeInternal ?? defaultActive);
      if (candidate != null && items.some((it) => it.key === candidate)) return candidate;
      return items[0]?.key ?? null;
    };
    const activeKey = resolveActiveKey();
    if (!controlled && activeInternal === null && activeKey !== null) activeInternal = activeKey; // 初回だけ内部状態を確定させる
    lastActive = activeKey;

    const moveFocus = (fromKey: string, delta: number): void => {
      const idx = items.findIndex((it) => it.key === fromKey);
      if (idx < 0) return;
      const nextIdx = (idx + delta + items.length) % items.length;
      const nextKey = items[nextIdx]!.key;
      select(nextKey);
      // フォーカスも一緒に移動する (roving tabindex、次の描画後の DOM を探す)
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          getTabButtons().find((el) => el.id === tabId(nextKey))?.focus();
        });
      }
    };

    const handleKeydown = (ev: KeyboardEvent, key: string): void => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        moveFocus(key, 1);
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        moveFocus(key, -1);
      } else if (ev.key === 'Home') {
        ev.preventDefault();
        if (items[0]) select(items[0].key);
        if (items[0] && typeof requestAnimationFrame !== 'undefined') {
          const firstKey = items[0].key;
          requestAnimationFrame(() => getTabButtons().find((el) => el.id === tabId(firstKey))?.focus());
        }
      } else if (ev.key === 'End') {
        ev.preventDefault();
        const last = items[items.length - 1];
        if (last) select(last.key);
        if (last && typeof requestAnimationFrame !== 'undefined') {
          const lastKey = last.key;
          requestAnimationFrame(() => getTabButtons().find((el) => el.id === tabId(lastKey))?.focus());
        }
      }
    };

    const tabBar = {
      tag: 'div',
      class: 'ric-tabs__bar',
      'data-ricdom-role': UI_ROLE.tabsBar,
      'data-ricdom-tabs-id': tablistMarker,
      role: 'tablist',
      children: items.map((item) => {
        const isActive = item.key === activeKey;
        return {
          tag: 'button',
          class: `ric-tabs__tab${isActive ? ' ric-tabs__tab--active' : ''}`,
          'data-ricdom-role': UI_ROLE.tabsTab,
          id: tabId(item.key),
          role: 'tab',
          'aria-selected': isActive ? 'true' : 'false',
          'aria-controls': hasAnyPanel ? panelId : undefined,
          tabIndex: isActive ? 0 : -1,
          onclick: () => {
            if (item.key !== activeKey) select(item.key);
          },
          onkeydown: (ev: KeyboardEvent) => handleKeydown(ev, item.key),
          children: [item.label],
        };
      }),
    };

    const activeItem = items.find((it) => it.key === activeKey);
    const panel = hasAnyPanel
      ? {
          tag: 'div',
          class: 'ric-tabs__panel',
          'data-ricdom-role': UI_ROLE.tabsPanel,
          id: panelId,
          role: 'tabpanel',
          'aria-labelledby': activeKey ? tabId(activeKey) : undefined,
          tabIndex: 0,
          children: activeItem ? (activeItem.children ?? []) : [],
        }
      : null;

    return {
      tag: 'div',
      class: `ric-tabs${variant !== 'line' ? ` ric-tabs--${variant}` : ''}`,
      'data-ricdom-role': UI_ROLE.tabs,
      children: [tabBar, panel],
    } as unknown as RicNode;
  }) as TabsInstance;

  inst.attach = guard.attach;
  inst.dispose = (): void => guard.dispose();
  inst.active = (): string | null => lastActive;

  return inst;
};
