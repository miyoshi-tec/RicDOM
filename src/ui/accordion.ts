// ricdom/ui — createAccordion (設計書 §3.4 部品契約 + 付録 E a11y、Phase 3b)
//
// v1 (ric_ui/composite/create_ui_accordion.js) の移植。開閉パネルリスト、内部状態付き。
//
// v1 との相違点:
//   - 状態を持つので `app.use(createAccordion(options))` で明示登録する (設計書 §3.4)。
//   - a11y を新規実装 (v1 未対応): ヘッダは `<button aria-expanded aria-controls>`、
//     パネルは `role="region"` + `aria-labelledby`。Enter/Space は `<button>` タグの
//     ネイティブ挙動でそのまま満たされる (v1 も元々 `<button>` を使っていたため無料)。
//   - `title` に文字列だけでなく VDOM ノード (アイコン混在等) を渡せる契約は v1 から継承。
//
// アニメーション: `grid-template-rows: 0fr → 1fr` のトリックで auto 高さに対して
// アニメーションする (scrollHeight 計測不要、v1 継承)。
//
// 使い方:
//   const acc = app.use(createAccordion({ defaultOpen: { a: true } }));
//   render 内で毎回呼ぶ:
//   acc({
//     items: [
//       { id: 'a', title: 'タイトル', children: [uiText({ children: ['本文'] })] },
//       { id: 'b', title: [uiIcon(ICON), ' write_file'], children: [...] },
//     ],
//     multi: true, // true (既定) = 複数パネル同時展開可 / false = 常に 1 パネルのみ (排他)
//   })

import type { RicNode } from '../types.js';
import { type AttachGuard, type Component, createAttachGuard } from './internal/component.js';
import { UI_ROLE } from './internal/pureHelpers.js';
import { uiIcon } from './icon.js';

// 開閉インジケータ (chevron-down)。閉=下向き、開=CSS で 180° 回転して上向き (v1 継承)。
const CHEVRON_DOWN = { p: 'm6 9 6 6 6-6' };

export interface AccordionItem {
  id: string;
  /** VDOM ノード可 (アイコン混在等、v1 継承の契約) */
  title: RicNode | RicNode[];
  children?: RicNode | RicNode[];
}

export interface CreateAccordionOptions {
  /** 初期展開状態 ({ [id]: boolean }) */
  defaultOpen?: Record<string, boolean>;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** true (既定) = 複数パネル同時展開可 / false = 常に 1 パネルのみ展開 (排他) */
  multi?: boolean;
}

export interface AccordionInstance extends Component<AccordionProps> {
  /** 指定 id のパネルが現在展開中か */
  isOpen(id: string): boolean;
}

let nextAccordionId = 0;

export const createAccordion = (options: CreateAccordionOptions = {}): AccordionInstance => {
  const { defaultOpen = {} } = options;
  const fid = ++nextAccordionId;
  const guard: AttachGuard = createAttachGuard('createAccordion');

  const openMap: Record<string, boolean> = { ...defaultOpen };

  const headerId = (id: string): string => `ricdom-accordion-${fid}-${encodeURIComponent(id)}-header`;
  const panelId = (id: string): string => `ricdom-accordion-${fid}-${encodeURIComponent(id)}-panel`;

  const inst = ((props: AccordionProps): RicNode => {
    const host = guard.ensure();
    if (!host) return null;

    const { items = [], multi = true } = props;

    return {
      tag: 'div',
      class: 'ric-accordion',
      'data-ricdom-role': UI_ROLE.accordion,
      children: items.map(({ id, title, children: itemChildren }) => {
        const isItemOpen = !!openMap[id];
        return {
          tag: 'div',
          class: 'ric-accordion__item',
          'data-ricdom-role': UI_ROLE.accordionItem,
          children: [
            {
              tag: 'button',
              class: `ric-accordion__header${isItemOpen ? ' ric-accordion__header--open' : ''}`,
              'data-ricdom-role': UI_ROLE.accordionHeader,
              id: headerId(id),
              'aria-expanded': isItemOpen ? 'true' : 'false',
              'aria-controls': panelId(id),
              onclick: () => {
                if (!multi) {
                  // 排他モード: 他をすべて閉じる
                  for (const k of Object.keys(openMap)) openMap[k] = false;
                }
                openMap[id] = !isItemOpen;
                guard.host?.notify();
              },
              children: [
                { tag: 'span', class: 'ric-accordion__title', 'data-ricdom-role': 'accordion-title', children: [title] },
                // 開閉インジケータ: uiIcon の chevron。header--open のとき CSS で 180° 回転。
                uiIcon(CHEVRON_DOWN, { size: '1em', class: 'ric-accordion__arrow', 'data-ricdom-role': 'accordion-arrow' }),
              ],
            },
            {
              tag: 'div',
              class: `ric-accordion__body${isItemOpen ? ' ric-accordion__body--open' : ''}`,
              'data-ricdom-role': UI_ROLE.accordionBody,
              id: panelId(id),
              role: 'region',
              'aria-labelledby': headerId(id),
              children: [{ tag: 'div', class: 'ric-accordion__body-inner', children: Array.isArray(itemChildren) ? itemChildren : [itemChildren ?? null] }],
            },
          ],
        };
      }),
    } as unknown as RicNode;
  }) as AccordionInstance;

  inst.attach = guard.attach;
  inst.dispose = (): void => guard.dispose();
  inst.isOpen = (id: string): boolean => !!openMap[id];

  return inst;
};
