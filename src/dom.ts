// RicDOM 2 — DOM 構築・差分更新 (patch)
//
// v1 (src/ricdom.js) の build_dom_node / patch_attributes / patch_children 系を
// TypeScript + camelCase + `children` 命名へ移植したもの。アルゴリズムは
// position-based + key-based reconciliation、FORCE_REAPPLY、SVG namespace 継承、
// select value 再適用など v1 と同じ (v1 踏襈)。
//
// v2 での変更点:
//   - 島は明示フラグ `island: true` (子孫を一切 build/patch しない、設計書 §3.1)
//   - 編集中ガード: document.activeElement な input/textarea/select には
//     `value` を FORCE_REAPPLY しない (設計書 §3.2、v1 は ui_tweak だけの局所対応だったが
//     v2 ではコアの規則に一般化)
//   - ref 属性名: data-ric-ref → data-ricdom-ref

import type { RicNode } from './types.js';
import {
  type NormalizedElement,
  type NormalizedNode,
  isJsonEqual,
  isInvisibleValue,
  normalizeChildren,
  normalizeNode,
} from './normalize.js';

// =====================================================================
// 定数
// =====================================================================

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// DOM プロパティとして直接代入すべきキー (setAttribute ではなく代入する)
const DOM_PROPERTY_KEYS = new Set([
  'value',
  'checked',
  'selected',
  'disabled',
  'innerHTML',
  'textContent',
  'innerText',
  'scrollTop',
  'scrollLeft',
]);

// VDOM 上で prev=next が equal でも毎 render で DOM に再代入するキー (ユーザー操作で
// DOM 側が独自に drift するため)。React/Preact 等の主要 VDOM ライブラリも controlled
// input は force-set する canon (v1 踏襈)。
const FORCE_REAPPLY_DOM_KEYS = new Set(['value', 'checked', 'selected', 'scrollTop', 'scrollLeft']);

const isEventHandlerKey = (key: string): boolean => /^on[a-z]/.test(key);

// =====================================================================
// 編集中ガード (設計書 §3.2、コアの規則に一般化)
// =====================================================================

// document.activeElement である input/textarea/select には value の FORCE_REAPPLY を
// 行わない (ユーザーの編集バッファを潰さない)。blur 後の render で同期される。
// 対象を 'value' キーだけに絞るのは、checked/selected/scroll はユーザーが「今まさに
// タイプ中」の入力ではなく、drift しても打鍵中の文字を消す実害が無いため。
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const shouldSkipValueReapply = (el: Element): boolean => {
  if (typeof document === 'undefined') return false;
  return el === document.activeElement && EDITABLE_TAGS.has(el.tagName);
};

// =====================================================================
// class / style の DOM 書き込み
// =====================================================================

// HTML 要素: el.className = val で OK。SVG 要素: el.className は
// SVGAnimatedString (object) で文字列代入が silent no-op になるため setAttribute
// を使う必要がある (v1 踏襈)。
const setClassAttr = (el: Element, value: string): void => {
  if (el.namespaceURI === SVG_NAMESPACE) {
    if (value) el.setAttribute('class', value);
    else el.removeAttribute('class');
  } else {
    (el as HTMLElement).className = value || '';
  }
};

// CSS Custom Property (`--*`) は setProperty/removeProperty を使う必要がある
// (bracket setter は `--*` に対して silent no-op になる仕様、v1 踏襈)。
const setStyleProp = (el: HTMLElement | SVGElement, key: string, val: string | number): void => {
  const style = el.style as CSSStyleDeclaration;
  if (key.startsWith('--')) {
    if (style.getPropertyValue(key) !== String(val)) style.setProperty(key, String(val));
  } else {
    const styleAny = style as unknown as Record<string, string>;
    if (styleAny[key] !== String(val)) styleAny[key] = String(val);
  }
};

const removeStyleProp = (el: HTMLElement | SVGElement, key: string): void => {
  const style = el.style as CSSStyleDeclaration;
  if (key.startsWith('--')) style.removeProperty(key);
  else (style as unknown as Record<string, string>)[key] = '';
};

// =====================================================================
// 属性適用 (build 用)
// =====================================================================

const applyAttributesToElement = (el: HTMLElement | SVGElement, normalized: NormalizedElement): void => {
  if (normalized.id) el.id = normalized.id;

  if (normalized.class.length > 0) setClassAttr(el, normalized.class.join(' '));

  for (const [key, val] of Object.entries(normalized.style)) {
    setStyleProp(el, key, val);
  }

  for (const [key, val] of Object.entries(normalized.attrs)) {
    if (isEventHandlerKey(key)) {
      if (typeof val === 'function') (el as unknown as Record<string, unknown>)[key] = val;
      else if (val === null) (el as unknown as Record<string, unknown>)[key] = null;
    } else if (DOM_PROPERTY_KEYS.has(key)) {
      (el as unknown as Record<string, unknown>)[key] = val;
    } else if (typeof val === 'boolean') {
      if (val) el.setAttribute(key, '');
      else el.removeAttribute(key);
    } else if (val !== null && val !== undefined) {
      el.setAttribute(key, String(val));
    }
  }
};

// =====================================================================
// DOM 構築
// =====================================================================

/** 正規化済み RicNode から DOM ノードを構築する (再帰)。inheritedNamespace: SVG コンテキスト継承用 */
export const buildDomNode = (raw: RicNode, inheritedNamespace: string | null = null): Node | null => {
  const normalized = normalizeNode(raw);

  if (normalized.kind === 'invisible') return null;
  if (normalized.kind === 'text') return document.createTextNode(normalized.text);

  const currentNamespace = normalized.tag === 'svg' ? SVG_NAMESPACE : inheritedNamespace;

  const el = currentNamespace
    ? (document.createElementNS(currentNamespace, normalized.tag) as unknown as HTMLElement | SVGElement)
    : (document.createElement(normalized.tag) as HTMLElement);

  applyAttributesToElement(el, normalized);

  // ref: DOM の id とは別に data-ricdom-ref で管理する (RicDOM 内部の refs Map 収集用)
  if (normalized.ref) {
    (el as HTMLElement).dataset.ricdomRef = normalized.ref;
  }

  // 島 (island: true) は子孫を一切 build しない (設計書 §3.1)。
  if (!normalized.island) {
    for (const child of normalizeChildren(normalized.children)) {
      const childEl = buildDomNode(child, currentNamespace);
      if (childEl) el.appendChild(childEl);
    }
  }

  // select の value は option が生えた後でないと選択に反映できない
  // (ブラウザは option 0 個の時点での value 代入を無視し、先頭 option を自動選択する)。
  // 子 append 後にもう一度 value を当て直して確定させる (v1 踏襈)。
  if (normalized.tag === 'select' && 'value' in normalized.attrs) {
    (el as HTMLSelectElement).value = normalized.attrs.value as string;
  }

  return el;
};

// =====================================================================
// 重複タグの検出とシリアルキー (position-based reconciliation 用)
// =====================================================================

const collectDuplicateTags = (prevChildren: RicNode[], nextChildren: RicNode[]): Set<string> => {
  const countTags = (children: RicNode[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const child of children) {
      if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
        const normalized = normalizeNode(child);
        if (normalized.kind === 'element') counts[normalized.tag] = (counts[normalized.tag] ?? 0) + 1;
      }
    }
    return counts;
  };
  const prevCounts = countTags(prevChildren);
  const nextCounts = countTags(nextChildren);
  const dupTags = new Set<string>();
  for (const [tag, n] of Object.entries(prevCounts)) if (n > 1) dupTags.add(tag);
  for (const [tag, n] of Object.entries(nextCounts)) if (n > 1) dupTags.add(tag);
  return dupTags;
};

const buildSerialKeyList = (children: RicNode[], dupTags: Set<string>): string[] => {
  const counters: Record<string, number> = {};
  return children.map((child) => {
    if (typeof child === 'string' || typeof child === 'number') return 'text';
    if (typeof child !== 'object' || child === null) return 'invisible';
    const normalized = normalizeNode(child);
    if (normalized.kind !== 'element') return 'text';
    const tag = normalized.tag;
    if (!dupTags.has(tag)) return tag;
    const n = counters[tag] ?? 0;
    counters[tag] = n + 1;
    return `${tag}@${n}`;
  });
};

// =====================================================================
// 属性差分 (patch 用)
// =====================================================================

const patchAttributes = (prevNormalized: NormalizedElement, nextNormalized: NormalizedElement, el: HTMLElement | SVGElement): void => {
  const nextId = nextNormalized.id ?? '';
  if ((prevNormalized.id ?? '') !== nextId) el.id = nextId;

  const prevRef = prevNormalized.ref ?? '';
  const nextRef = nextNormalized.ref ?? '';
  if (prevRef !== nextRef) {
    if (nextRef) (el as HTMLElement).dataset.ricdomRef = nextRef;
    else delete (el as HTMLElement).dataset.ricdomRef;
  }

  const prevClass = prevNormalized.class.join(' ');
  const nextClass = nextNormalized.class.join(' ');
  if (prevClass !== nextClass) setClassAttr(el, nextClass);

  const prevStyle = prevNormalized.style;
  const nextStyle = nextNormalized.style;
  for (const [key, val] of Object.entries(nextStyle)) setStyleProp(el, key, val);
  for (const key of Object.keys(prevStyle)) {
    if (!(key in nextStyle)) removeStyleProp(el, key);
  }

  const prevExtra = prevNormalized.attrs;
  const nextExtra = nextNormalized.attrs;

  for (const [key, val] of Object.entries(nextExtra)) {
    if (isEventHandlerKey(key)) {
      // イベントハンドラは差分チェックを通さず常に最新ハンドラで上書きする
      // (render 関数の中で毎回新しいクロージャを作るのが普通の使い方なので、
      // 参照は毎回新しい。同一参照でも最新クロージャに差し替わることを保証する)
      (el as unknown as Record<string, unknown>)[key] = typeof val === 'function' ? val : null;
    } else if (FORCE_REAPPLY_DOM_KEYS.has(key)) {
      if (key === 'value' && shouldSkipValueReapply(el)) continue; // 編集中ガード (設計書 §3.2)
      (el as unknown as Record<string, unknown>)[key] = val;
    } else if (!isJsonEqual(prevExtra[key], val)) {
      if (DOM_PROPERTY_KEYS.has(key)) {
        (el as unknown as Record<string, unknown>)[key] = val;
      } else if (typeof val === 'boolean') {
        if (val) el.setAttribute(key, '');
        else el.removeAttribute(key);
      } else if (val !== null && val !== undefined) {
        el.setAttribute(key, String(val));
      } else {
        el.removeAttribute(key);
      }
    }
  }

  for (const key of Object.keys(prevExtra)) {
    if (!(key in nextExtra)) {
      if (isEventHandlerKey(key)) (el as unknown as Record<string, unknown>)[key] = null;
      else el.removeAttribute(key);
    }
  }
};

// =====================================================================
// FORCE_REAPPLY 専用 walker (VDOM 構造短絡時)
// =====================================================================

// VDOM 自体は prev=next なので構造 patch は不要だが、ユーザー操作で DOM が drift した
// FORCE_REAPPLY_DOM_KEYS だけは VDOM の値で上書きし直す (v1 踏襈)。
// 島の子孫には絶対に踏み込まない (子孫を一切触らない契約、設計書 §3.1)。
const applyForceReapplyToSubtree = (normalizedChildren: RicNode[], parentEl: Element): void => {
  for (let i = 0; i < normalizedChildren.length; i++) {
    const child = normalizedChildren[i];
    if (typeof child !== 'object' || child === null || Array.isArray(child)) continue;
    const domEl = parentEl.childNodes[i];
    if (!domEl || domEl.nodeType !== Node.ELEMENT_NODE) continue;
    const elChild = domEl as HTMLElement | SVGElement;

    const childRecord = child as unknown as Record<string, unknown>;
    for (const key of FORCE_REAPPLY_DOM_KEYS) {
      if (key in childRecord) {
        if (key === 'value' && shouldSkipValueReapply(elChild)) continue;
        (elChild as unknown as Record<string, unknown>)[key] = childRecord[key];
      }
    }

    if (childRecord.island === true) continue; // 島の子孫は触らない

    if (childRecord.children != null) {
      const childrenArr = Array.isArray(childRecord.children) ? (childRecord.children as RicNode[]) : [childRecord.children as RicNode];
      applyForceReapplyToSubtree(normalizeChildren(childrenArr), elChild);
    }
  }
};

// =====================================================================
// key の有無判定
// =====================================================================

const childrenHaveAnyKey = (children: RicNode[]): boolean => {
  for (const c of children) {
    if (c && typeof c === 'object' && !Array.isArray(c) && (c as { key?: unknown }).key != null) return true;
  }
  return false;
};

// =====================================================================
// 子要素の差分反映 (dispatch)
// =====================================================================

/** 子要素リストの差分を DOM に反映する。raw な children を受け取る。 */
export const patchChildren = (prevRawChildren: RicNode[], nextRawChildren: RicNode[], parentEl: Element): void => {
  const prevChildren = normalizeChildren(prevRawChildren);
  const nextChildren = normalizeChildren(nextRawChildren);

  if (isJsonEqual(prevChildren, nextChildren)) {
    applyForceReapplyToSubtree(nextChildren, parentEl);
    return;
  }

  if (childrenHaveAnyKey(prevChildren) || childrenHaveAnyKey(nextChildren)) {
    patchChildrenByKey(prevChildren, nextChildren, parentEl);
    return;
  }

  const dupTags = collectDuplicateTags(prevChildren, nextChildren);
  const prevSerialKeys = buildSerialKeyList(prevChildren, dupTags);
  const nextSerialKeys = buildSerialKeyList(nextChildren, dupTags);

  patchChildrenByPosition(prevChildren, nextChildren, parentEl, prevSerialKeys, nextSerialKeys);
};

// =====================================================================
// key ベースの差分更新
// =====================================================================

interface PrevEntry {
  normalized: NormalizedNode;
  dom: ChildNode | undefined;
}

const patchChildrenByKey = (prevChildren: RicNode[], nextChildren: RicNode[], parentEl: Element): void => {
  const prevDoms = Array.from(parentEl.childNodes);
  const prevKeyedMap = new Map<string | number, PrevEntry>();
  const prevUnkeyed: PrevEntry[] = [];

  for (let i = 0; i < prevChildren.length; i++) {
    const normalized = normalizeNode(prevChildren[i] as RicNode);
    const dom = prevDoms[i];
    if (normalized.kind === 'element' && normalized.key !== null) {
      prevKeyedMap.set(normalized.key, { normalized, dom });
    } else {
      prevUnkeyed.push({ normalized, dom });
    }
  }

  let cursor: ChildNode | null = parentEl.firstChild;

  for (let i = 0; i < nextChildren.length; i++) {
    const nextRaw = nextChildren[i] as RicNode;
    const nextNormalized = normalizeNode(nextRaw);
    let targetDom: Node | null = null;
    let prevNormalized: NormalizedNode | null = null;

    if (nextNormalized.kind === 'element' && nextNormalized.key !== null) {
      const entry = prevKeyedMap.get(nextNormalized.key);
      if (entry) {
        targetDom = entry.dom ?? null;
        prevNormalized = entry.normalized;
        prevKeyedMap.delete(nextNormalized.key);
      }
    } else if (prevUnkeyed.length > 0) {
      const entry = prevUnkeyed[0]!;
      const sameType = entry.normalized.kind === nextNormalized.kind && (nextNormalized.kind === 'text' || (entry.normalized as NormalizedElement).tag === (nextNormalized as NormalizedElement).tag);
      if (sameType) {
        targetDom = entry.dom ?? null;
        prevNormalized = entry.normalized;
        prevUnkeyed.shift();
      }
    }

    if (!targetDom) {
      targetDom = buildDomNode(nextRaw, parentEl.namespaceURI);
      if (!targetDom) continue;
    }

    if (cursor === targetDom) {
      cursor = cursor.nextSibling;
    } else {
      parentEl.insertBefore(targetDom, cursor);
    }

    if (prevNormalized) {
      if (nextNormalized.kind === 'text') {
        if (targetDom.nodeType === Node.TEXT_NODE && targetDom.textContent !== nextNormalized.text) {
          targetDom.textContent = nextNormalized.text;
        }
      } else if (nextNormalized.kind === 'element' && prevNormalized.kind === 'element') {
        patchAttributes(prevNormalized, nextNormalized, targetDom as HTMLElement | SVGElement);
        if (!nextNormalized.island) {
          patchChildren(prevNormalized.children, nextNormalized.children, targetDom as Element);
        }
      }
    }
  }

  for (const entry of prevKeyedMap.values()) {
    if (entry.dom && entry.dom.parentNode === parentEl) parentEl.removeChild(entry.dom);
  }
  for (const entry of prevUnkeyed) {
    if (entry.dom && entry.dom.parentNode === parentEl) parentEl.removeChild(entry.dom);
  }
};

// =====================================================================
// 位置ベースの差分更新
// =====================================================================

const patchChildrenByPosition = (
  prevChildren: RicNode[],
  nextChildren: RicNode[],
  parentEl: Element,
  prevSerialKeys: string[],
  nextSerialKeys: string[],
): void => {
  const prevLen = prevChildren.length;
  const nextLen = nextChildren.length;
  const maxLen = Math.max(prevLen, nextLen);

  for (let i = 0; i < maxLen; i++) {
    const prevNode = prevChildren[i];
    const nextNode = nextChildren[i];
    const domEl = parentEl.childNodes[i];

    if (nextNode === undefined) {
      if (domEl) parentEl.removeChild(domEl);
    } else if (prevNode === undefined) {
      const newEl = buildDomNode(nextNode, parentEl.namespaceURI);
      if (newEl) parentEl.appendChild(newEl);
    } else {
      const prevNormalized = normalizeNode(prevNode);
      const nextNormalized = normalizeNode(nextNode);

      if (nextNormalized.kind === 'text') {
        if (prevNormalized.kind === 'text') {
          if (domEl && domEl.nodeType === Node.TEXT_NODE && domEl.textContent !== nextNormalized.text) {
            domEl.textContent = nextNormalized.text;
          }
        } else {
          const newEl = document.createTextNode(nextNormalized.text);
          if (domEl) parentEl.replaceChild(newEl, domEl);
          else parentEl.appendChild(newEl);
        }
        continue;
      }

      const prevKey = prevSerialKeys[i];
      const nextKey = nextSerialKeys[i];
      if (prevKey !== nextKey) {
        const newEl = buildDomNode(nextNode, parentEl.namespaceURI);
        if (newEl && domEl) parentEl.replaceChild(newEl, domEl);
        else if (newEl) parentEl.appendChild(newEl);
        continue;
      }

      if (domEl && nextNormalized.kind === 'element' && prevNormalized.kind === 'element') {
        patchAttributes(prevNormalized, nextNormalized, domEl as HTMLElement | SVGElement);
        if (!nextNormalized.island) {
          patchChildren(prevNormalized.children, nextNormalized.children, domEl as Element);
        }
      }
    }
  }

  while (parentEl.childNodes.length > nextLen) {
    parentEl.removeChild(parentEl.lastChild as ChildNode);
  }
};

export { isInvisibleValue };
