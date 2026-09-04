// uiButton / uiInput (設計書 E: 検証用の純粋関数部品、v1 A15 の rest スプレッド契約継承)
//
// テスト内では戻り値を `RicElementNode` (全既知タグの判別可能ユニオン) と交差させると
// EventProps のマップ型が `this` を `never` に潰してしまう (実際に個別タグへ絞り込んだ
// 場合には起きない、テストの書き方に起因する型上の制約)。ここでは戻り値の形を
// 直接言い表すシンプルなローカル型にキャストして回避する。

import { describe, expect, it } from 'vitest';
import { uiButton } from '../../src/ui/button.js';
import { uiInput } from '../../src/ui/input.js';

interface TestButtonNode {
  tag: string;
  class: string;
  id?: string;
  disabled?: boolean;
  children: unknown;
  onclick?: (ev?: unknown) => void;
  [key: string]: unknown;
}

interface TestInputNode {
  tag: string;
  class: string;
  type: string;
  value: string;
  disabled?: boolean;
  oninput?: (ev: unknown) => void;
}

describe('uiButton', () => {
  it('既定は tag:button, class:ric-button', () => {
    const node = uiButton({ children: ['OK'] }) as unknown as TestButtonNode;
    expect(node.tag).toBe('button');
    expect(node.class).toBe('ric-button');
    expect(node.children).toEqual(['OK']);
  });

  it('variant がクラスに反映される', () => {
    const node = uiButton({ variant: 'primary', children: ['x'] }) as unknown as TestButtonNode;
    expect(node.class).toBe('ric-button ric-button--primary');
  });

  it('disabled: true で disabled 属性が付く', () => {
    const node = uiButton({ disabled: true, children: ['x'] }) as unknown as TestButtonNode;
    expect(node.disabled).toBe(true);
  });

  it('size: 既定 (md) は寸法クラスを付与しない', () => {
    const node = uiButton({ children: ['x'] }) as unknown as TestButtonNode;
    expect(node.class).toBe('ric-button');
  });

  it('size: sm/lg がクラスに反映される (variant と併用可)', () => {
    const sm = uiButton({ size: 'sm', children: ['x'] }) as unknown as TestButtonNode;
    expect(sm.class).toBe('ric-button ric-button--sm');
    const lg = uiButton({ variant: 'primary', size: 'lg', children: ['x'] }) as unknown as TestButtonNode;
    expect(lg.class).toBe('ric-button ric-button--primary ric-button--lg');
  });

  it('rest スプレッドで onclick/id/data-* 等の任意属性を透過する (基底クラスは保たれる)', () => {
    let clicked = false;
    const node = uiButton({
      children: ['x'],
      onclick: () => {
        clicked = true;
      },
      id: 'my-btn',
      'data-testid': 'save',
      class: 'extra',
    }) as unknown as TestButtonNode;
    expect(node.id).toBe('my-btn');
    expect(node['data-testid']).toBe('save');
    expect(node.class).toBe('ric-button extra'); // rest から class を渡しても基底クラスは失われない
    node.onclick?.();
    expect(clicked).toBe(true);
  });
});

describe('uiInput', () => {
  it('既定は tag:input, class:ric-input, type:text, value:""', () => {
    const node = uiInput() as unknown as TestInputNode;
    expect(node.tag).toBe('input');
    expect(node.class).toBe('ric-input');
    expect(node.type).toBe('text');
    expect(node.value).toBe('');
  });

  it('value は空文字でも常に含まれる (FORCE_REAPPLY 対象キーとして反映されるよう)', () => {
    const node = uiInput({ value: '' }) as unknown as TestInputNode;
    expect('value' in node).toBe(true);
    expect(node.value).toBe('');
  });

  it('rest スプレッドで oninput/id 等を透過しつつ、基底の class/type/value は内部で確定する', () => {
    let seen = '';
    const node = uiInput({
      value: 'hello',
      oninput: (ev: Event) => {
        seen = (ev.target as HTMLInputElement).value;
      },
      class: 'extra',
      type: 'password',
    }) as unknown as TestInputNode;
    expect(node.class).toBe('ric-input extra');
    expect(node.type).toBe('password');
    expect(node.value).toBe('hello');
    node.oninput?.({ target: { value: 'typed' } });
    expect(seen).toBe('typed');
  });

  it('disabled: true で disabled 属性が付く', () => {
    const node = uiInput({ disabled: true }) as unknown as TestInputNode;
    expect(node.disabled).toBe(true);
  });
});
