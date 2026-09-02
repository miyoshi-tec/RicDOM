// bindInput / bindTextarea / bindCheckbox / bindSelect / bindRange (設計書 §3.4)
// state の一段目 Proxy へ双方向バインドする「流儀」の検証: 生成された RicNode の
// value/checked が s[key] を反映し、ハンドラを呼ぶと s[key] が更新されることを確認する。

import { describe, expect, it } from 'vitest';
import { bindCheckbox, bindInput, bindRange, bindSelect, bindTextarea } from '../../src/ui/bind.js';

interface TestNodeWithInput {
  value?: string;
  checked?: boolean;
  oninput?: (ev: unknown) => void;
  onchange?: (ev: unknown) => void;
  [key: string]: unknown;
}

describe('bindInput', () => {
  it('value に s[key] が反映される', () => {
    const s = { name: 'yamada' };
    const node = bindInput(s, 'name') as unknown as TestNodeWithInput;
    expect(node.value).toBe('yamada');
  });

  it('oninput で s[key] が更新される (双方向)', () => {
    const s = { name: 'yamada' };
    const node = bindInput(s, 'name') as unknown as TestNodeWithInput;
    node.oninput?.({ target: { value: 'tanaka' } });
    expect(s.name).toBe('tanaka');
  });

  it('options (placeholder 等) を透過しつつ value/oninput は上書きできない', () => {
    const s = { name: 'x' };
    const node = bindInput(s, 'name', { placeholder: 'p', value: 'HACK' as never }) as unknown as TestNodeWithInput;
    expect(node.placeholder).toBe('p');
    expect(node.value).toBe('x'); // options.value を渡しても計算済みの value が勝つ
  });

  it('s[key] が undefined のときは空文字にフォールバックする', () => {
    const s: { name?: string } = {};
    const node = bindInput(s, 'name') as unknown as TestNodeWithInput;
    expect(node.value).toBe('');
  });
});

describe('bindTextarea', () => {
  it('value に s[key] が反映され、oninput で更新される', () => {
    const s = { memo: 'hello' };
    const node = bindTextarea(s, 'memo') as unknown as TestNodeWithInput;
    expect(node.value).toBe('hello');
    node.oninput?.({ target: { value: 'world' } });
    expect(s.memo).toBe('world');
  });

  it('autoResize 等の options を透過する', () => {
    const s = { memo: '' };
    const node = bindTextarea(s, 'memo', { autoResize: { minRows: 2 } }) as unknown as { rows: number };
    expect(node.rows).toBe(2);
  });
});

describe('bindCheckbox', () => {
  it('checked に !!s[key] が反映される', () => {
    const s = { agree: true };
    const node = bindCheckbox(s, 'agree') as unknown as { children: [TestNodeWithInput] };
    expect(node.children[0].checked).toBe(true);
  });

  it('onchange で s[key] が更新される', () => {
    const s = { agree: false };
    const node = bindCheckbox(s, 'agree') as unknown as { children: [TestNodeWithInput] };
    node.children[0].onchange?.({ target: { checked: true } });
    expect(s.agree).toBe(true);
  });

  it('children (ラベル) を options 経由で渡せる', () => {
    const s = { agree: false };
    const node = bindCheckbox(s, 'agree', { children: ['同意する'] }) as unknown as { children: unknown[] };
    expect(node.children.length).toBe(2);
  });
});

describe('bindSelect', () => {
  it('value に s[key] が反映され、onchange で更新される', () => {
    const s = { role: 'viewer' };
    const node = bindSelect(s, 'role', { options: ['viewer', 'editor'] }) as unknown as TestNodeWithInput;
    expect(node.value).toBe('viewer');
    node.onchange?.({ target: { value: 'editor' } });
    expect(s.role).toBe('editor');
  });
});

describe('bindRange', () => {
  it('value に s[key] が反映され、oninput で数値として更新される (parseFloat)', () => {
    const s = { volume: 30 };
    const node = bindRange(s, 'volume', { min: 0, max: 100 }) as unknown as { children: [TestNodeWithInput] };
    expect(node.children[0].value).toBe('30');
    node.children[0].oninput?.({ target: { value: '75' } });
    expect(s.volume).toBe(75);
  });

  it('s[key] が undefined のときは options.min にフォールバックする', () => {
    const s: { volume?: number } = {};
    const node = bindRange(s, 'volume', { min: 10 }) as unknown as { children: [TestNodeWithInput] };
    expect(node.children[0].value).toBe('10');
  });
});
