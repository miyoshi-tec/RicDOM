// uiIcon (設計書 §3.4、Phase 3a、descriptor → svg 変換)
//
// descriptor の path はテスト用に「手書き」しない (JSDoc の方針通り) — v1
// docs/icons/ 由来の検証済み descriptor (Lucide 'check') をそのまま使う。

import { describe, expect, it } from 'vitest';
import { expectTypeOf } from 'expect-type';
import { uiIcon } from '../../src/ui/icon.js';
import type { IconDescriptor as UiIconDescriptor } from '../../src/ui/icon.js';
import type { IconDescriptor } from '../../src/icons/types.js';

// v1 icons/src.json の 'check' (Lucide) と同じ path。手書きではなく既存の検証済みデータ。
const CHECK = { p: 'M20 6 9 17l-5-5' };

interface TestSvgNode {
  tag: string;
  viewBox: string;
  fill: string;
  stroke?: string;
  'stroke-width'?: number | null;
  'stroke-linecap'?: string;
  'stroke-linejoin'?: string;
  class: string;
  'data-ricdom-role'?: string;
  style: Record<string, unknown>;
  role?: string;
  'aria-label'?: string;
  'aria-hidden'?: string;
  children: { tag: string; d: string }[];
  [key: string]: unknown;
}

describe('uiIcon', () => {
  it('既定は viewBox "0 0 24 24"、stroke モード (stroke-width 2)、aria-hidden', () => {
    const node = uiIcon(CHECK) as unknown as TestSvgNode;
    expect(node.tag).toBe('svg');
    expect(node.viewBox).toBe('0 0 24 24');
    expect(node.fill).toBe('none');
    expect(node.stroke).toBe('currentColor');
    expect(node['stroke-width']).toBe(2);
    expect(node['aria-hidden']).toBe('true');
    expect(node.role).toBeUndefined();
    expect(node['data-ricdom-role']).toBe('icon');
  });

  it('descriptor.p の文字列を単一 path に変換する', () => {
    const node = uiIcon(CHECK) as unknown as TestSvgNode;
    expect(node.children).toEqual([{ tag: 'path', d: 'M20 6 9 17l-5-5' }]);
  });

  it('descriptor.p の配列は複数 path に変換される', () => {
    const node = uiIcon({ p: ['M1 1', 'M2 2'] }) as unknown as TestSvgNode;
    expect(node.children).toEqual([
      { tag: 'path', d: 'M1 1' },
      { tag: 'path', d: 'M2 2' },
    ]);
  });

  it('descriptor.s: null は fill モードになる (stroke 系属性が付かない)', () => {
    const node = uiIcon({ p: 'M0 0', s: null }) as unknown as TestSvgNode;
    expect(node.fill).toBe('currentColor');
    expect(node.stroke).toBeUndefined();
    expect(node['stroke-width']).toBeUndefined();
  });

  it('opts.strokeWidth は descriptor.s より優先され stroke モードを強制する', () => {
    const node = uiIcon({ p: 'M0 0', s: null }, { strokeWidth: 3 }) as unknown as TestSvgNode;
    expect(node.fill).toBe('none');
    expect(node['stroke-width']).toBe(3);
  });

  it('label を渡すと role="img" + aria-label になる (aria-hidden は付かない)', () => {
    const node = uiIcon(CHECK, { label: '完了' }) as unknown as TestSvgNode;
    expect(node.role).toBe('img');
    expect(node['aria-label']).toBe('完了');
    expect(node['aria-hidden']).toBeUndefined();
  });

  it('size: 数値は px 化され、既定は 1em として style.width/height に入る', () => {
    const defaultNode = uiIcon(CHECK) as unknown as TestSvgNode;
    expect(defaultNode.style.width).toBe('1em');
    expect(defaultNode.style.height).toBe('1em');
    const sized = uiIcon(CHECK, { size: 24 }) as unknown as TestSvgNode;
    expect(sized.style.width).toBe('24px');
    expect(sized.style.height).toBe('24px');
  });

  it('style は verticalAlign/flexShrink を既定で持ち、opts.style で上書きできる (width/height は size が優先)', () => {
    const node = uiIcon(CHECK, { size: 20, style: { verticalAlign: 'middle', color: 'red' } }) as unknown as TestSvgNode;
    expect(node.style.verticalAlign).toBe('middle');
    expect(node.style.color).toBe('red');
    expect(node.style.width).toBe('20px'); // size が opts.style.width より優先
    expect(node.style.flexShrink).toBe(0);
  });

  it('spin: true で ric-icon--spin クラスが付く', () => {
    const node = uiIcon(CHECK, { spin: true }) as unknown as TestSvgNode;
    expect(node.class).toBe('ric-icon ric-icon--spin');
  });

  it('opts.class で追加クラスを連結できる', () => {
    const node = uiIcon(CHECK, { class: 'extra' }) as unknown as TestSvgNode;
    expect(node.class).toBe('ric-icon extra');
  });

  it('rest (data-* 等) を透過する', () => {
    const node = uiIcon(CHECK, { 'data-testid': 'icon-check' }) as unknown as TestSvgNode;
    expect(node['data-testid']).toBe('icon-check');
  });

  it('型テスト: ricdom/ui の IconDescriptor は ricdom/icons の IconDescriptor と同一の型 (旧 UiIconDescriptor を統合、docs/API_AUDIT.ja.md 参照)', () => {
    expectTypeOf<UiIconDescriptor>().toEqualTypeOf<IconDescriptor>();
    expect(true).toBe(true);
  });
});
