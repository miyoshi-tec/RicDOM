// 差分パッチの統合テスト (createApp 経由)。
// v1 (tests/v02_layout.test.js, v02_text.test.js, force_reapply_dom_keys.test.js) の
// コア相当を移植。属性/style/class/text/子の追加削除/SVG namespace を確認する。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('属性の差分', () => {
  it('boolean 属性 (disabled) の付与・解除', async () => {
    const app = setupApp();
    const handle = createApp('#app', { on: true }, (s) => ({ tag: 'button', disabled: s.on, children: ['x'] }));
    await flush();
    expect(app.querySelector('button')!.hasAttribute('disabled')).toBe(true);

    handle.on = false;
    await flush();
    expect(app.querySelector('button')!.hasAttribute('disabled')).toBe(false);
  });

  it('通常属性の追加・変更・削除', async () => {
    const app = setupApp();
    const handle = createApp('#app', { title: 'a' as string | undefined }, (s) => ({ tag: 'div', title: s.title }));
    await flush();
    expect(app.querySelector('div')!.getAttribute('title')).toBe('a');

    handle.title = 'b';
    await flush();
    expect(app.querySelector('div')!.getAttribute('title')).toBe('b');

    handle.title = undefined;
    await flush();
    expect(app.querySelector('div')!.hasAttribute('title')).toBe(false);
  });

  it('id の差分反映', async () => {
    const app = setupApp();
    const handle = createApp('#app', { id: 'a' }, (s) => ({ tag: 'div', id: s.id }));
    await flush();
    expect(app.querySelector('div')!.id).toBe('a');
    handle.id = 'b';
    await flush();
    expect(app.querySelector('div')!.id).toBe('b');
  });
});

describe('style の差分', () => {
  it('style の追加・変更・削除 (全キー再適用)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { color: 'red' }, (s) => ({ tag: 'div', style: { color: s.color, fontSize: '10px' } }));
    await flush();
    const div = app.querySelector('div')!;
    expect(div.style.color).toBe('red');
    expect(div.style.fontSize).toBe('10px');

    handle.color = 'blue';
    await flush();
    expect(div.style.color).toBe('blue');
  });

  it('CSS Custom Property (--*) を setProperty で書き込む', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', style: { '--ric-color-bg': '#fff' } }));
    await flush();
    const div = app.querySelector('div')!;
    expect(div.style.getPropertyValue('--ric-color-bg')).toBe('#fff');
  });

  it('前になくなった style プロパティを削除する', async () => {
    const app = setupApp();
    // 三項演算子の両枝を直接 style に埋め込むと、TS が条件式の型を { color?: undefined } | { color: string }
    // のように合成してしまい StyleValue と衝突する (render の s が正しく型付くようになった副作用で顕在化)。
    // 変数に分けて明示的に StyleValue 型を付けることで回避する。
    const handle = createApp('#app', { showColor: true }, (s) => {
      const style: Record<string, string | number> = s.showColor ? { color: 'red' } : {};
      return { tag: 'div', style };
    });
    await flush();
    const div = app.querySelector('div')!;
    expect(div.style.color).toBe('red');
    handle.showColor = false;
    await flush();
    expect(div.style.color).toBe('');
  });
});

describe('class の差分', () => {
  it('class の 3 形態が同じ結果になる', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', class: { active: true, hidden: false } }));
    await flush();
    expect(app.querySelector('div')!.className).toBe('active');
  });

  it('class の変更で className が更新される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { cls: 'a' }, (s) => ({ tag: 'div', class: s.cls }));
    await flush();
    expect(app.querySelector('div')!.className).toBe('a');
    handle.cls = 'b c';
    await flush();
    expect(app.querySelector('div')!.className).toBe('b c');
  });
});

describe('テキストの差分', () => {
  it('テキストノードの内容変更', async () => {
    const app = setupApp();
    const handle = createApp('#app', { n: 1 }, (s) => ({ tag: 'div', children: [String(s.n)] }));
    await flush();
    expect(app.querySelector('div')!.textContent).toBe('1');
    handle.n = 2;
    await flush();
    expect(app.querySelector('div')!.textContent).toBe('2');
  });
});

describe('子要素の追加・削除', () => {
  it('末尾への追加・削除が反映される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { items: ['a', 'b'] as string[] }, (s) => ({
      tag: 'ul',
      children: s.items.map((i: string) => ({ tag: 'li', children: [i] })),
    }));
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(2);

    handle.items = ['a', 'b', 'c'];
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(3);
    expect(app.querySelectorAll('li')[2]!.textContent).toBe('c');

    handle.items = ['a'];
    await flush();
    expect(app.querySelectorAll('li')).toHaveLength(1);
  });

  it('DOM ノードを再利用する (input のフォーカスが保たれる)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { label: 'x' }, (s) => ({
      tag: 'div',
      children: [{ tag: 'span', children: [s.label] }, { tag: 'input' }],
    }));
    await flush();
    const input = app.querySelector('input')!;
    input.focus();
    expect(document.activeElement).toBe(input);

    handle.label = 'y';
    await flush();
    expect(document.activeElement).toBe(input); // 同一 DOM ノードのまま
  });
});

describe('SVG namespace', () => {
  it('<svg> 配下の要素は SVG namespace で生成される', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({
      tag: 'svg',
      children: [{ tag: 'circle', cx: '5', cy: '5', r: '5' }],
    }));
    await flush();
    const svg = app.querySelector('svg')!;
    const circle = app.querySelector('circle')!;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('SVG 要素の class は setAttribute 経由で反映される', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'svg', children: [{ tag: 'g', class: 'icon' }] }));
    await flush();
    const g = app.querySelector('g')!;
    expect(g.getAttribute('class')).toBe('icon');
  });
});

describe('FORCE_REAPPLY (checked/scroll)', () => {
  it('checkbox の checked は VDOM 値で毎回上書きされる (ユーザー操作 drift の補正)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { on: true, other: 0 }, (s) => ({
      tag: 'div',
      children: [{ tag: 'input', type: 'checkbox', checked: s.on }, String(s.other)],
    }));
    await flush();
    const checkbox = app.querySelector('input')! as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    // ユーザーがクリックして checked=false に drift させる
    checkbox.checked = false;

    // state の checked 値自体は変わっていないが、無関係な other を変更して再描画をトリガー
    handle.other = 1;
    await flush();
    expect(checkbox.checked).toBe(true); // VDOM の値で再同期される
  });
});
