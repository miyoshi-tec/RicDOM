// <select> の value/option 構築順レース (v1 tests/select_value_race.test.js 相当)。
// value 代入は option が生えた後でないと反映されない DOM 仕様への対策を確認する。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('select value/option 構築順レース', () => {
  it('初回描画: value + options が同時出現しても指定 option が選択される', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({
      tag: 'select',
      value: 'b',
      children: [
        { tag: 'option', value: 'a', children: ['A'] },
        { tag: 'option', value: 'b', children: ['B'] },
      ],
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('b');
  });

  it('patch 中に select が新規生成される場合も正しい value になる', async () => {
    const app = setupApp();
    const handle = createApp('#app', { showSelect: false }, (s) =>
      s.showSelect
        ? {
            tag: 'select',
            value: 'c',
            children: [
              { tag: 'option', value: 'x', children: ['X'] },
              { tag: 'option', value: 'c', children: ['C'] },
            ],
          }
        : { tag: 'div', children: ['no select yet'] },
    );
    await flush();
    expect(app.querySelector('select')).toBeNull();

    handle.showSelect = true;
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel).not.toBeNull();
    expect(sel.value).toBe('c');
  });

  it('regression: 既存 select への value 差分パッチは従来どおり動く', async () => {
    const app = setupApp();
    const handle = createApp('#app', { sel: 'a' }, (s) => ({
      tag: 'select',
      value: s.sel,
      children: [
        { tag: 'option', value: 'a', children: ['A'] },
        { tag: 'option', value: 'b', children: ['B'] },
        { tag: 'option', value: 'c', children: ['C'] },
      ],
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('a');

    handle.sel = 'c';
    await flush();
    expect(sel.value).toBe('c');
  });

  it('regression: value 未指定の select は従来どおり先頭 option が選ばれる', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({
      tag: 'select',
      children: [
        { tag: 'option', value: 'a', children: ['A'] },
        { tag: 'option', value: 'b', children: ['B'] },
      ],
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('a');
  });

  // Raccoon Memo (パイロット第 5 号, alpha.14 報告): options が後から増える描画で
  // value が反映されない。build 経路 (buildDomNode) は子 append 後に value を
  // 当て直す (177 行目) が、patch 経路は patchAttributes → patchChildren の順で
  // 呼んでいたため、value が新しい option を指す render では option がまだ生えて
  // おらず代入が無視され (selectedIndex が -1 になる)、その後 children を追加しても
  // value を当て直していなかった (両経路の非対称)。jsdom は selectedIndex が -1 の
  // まま option が増えると「選択が無いので先頭 option を自動選択」する仕様なので、
  // 症状としては新しい option ではなく先頭の 'default' に戻って見える。
  it('patch 経路: options が後から増えて value が新しい option を指す場合も反映される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { opts: ['default'], value: undefined as string | undefined }, (s) => ({
      tag: 'select',
      ...(s.value !== undefined ? { value: s.value } : {}),
      children: s.opts.map((v: string) => ({ tag: 'option', value: v, children: [v] })),
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    // 初回は value 未指定なので先頭 option が選ばれる
    expect(sel.value).toBe('default');

    // value が新しい option (External1) を指すのと同時に options が増える render
    handle.value = 'External1';
    handle.opts = ['default', 'External1', 'External2'];
    handle.renderNow();
    expect(sel.value).toBe('External1');
  });

  it('patch 経路: options が増えても、select が activeElement の間は編集中ガードが優先される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { opts: ['default'], value: undefined as string | undefined }, (s) => ({
      tag: 'select',
      ...(s.value !== undefined ? { value: s.value } : {}),
      children: s.opts.map((v: string) => ({ tag: 'option', value: v, children: [v] })),
    }));
    await flush();
    const sel = app.querySelector('select') as HTMLSelectElement;
    expect(sel.value).toBe('default');

    sel.focus();
    expect(document.activeElement).toBe(sel);

    handle.value = 'External1';
    handle.opts = ['default', 'External1', 'External2'];
    handle.renderNow();
    // フォーカス中は VDOM の value で上書きしない (ブラウザ側の値のまま = default)
    expect(sel.value).toBe('default');

    sel.blur();
    handle.renderNow();
    expect(sel.value).toBe('External1');
  });
});
