// 編集中ガード (設計書 §3.2)。
// document.activeElement である input/textarea/select には value を FORCE_REAPPLY しない。
// blur 後の render では通常どおり同期される。v1 は ui_tweak だけの局所対応だったが、
// v2 ではコアの規則に一般化された (このテストが「最初の回帰テスト」に相当、設計書 §7)。

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';

describe('編集中ガード', () => {
  it('フォーカス中の input には value を書き戻さない', async () => {
    const app = setupApp();
    const handle = createApp('#app', { value: 'server-value', other: 0 }, (s) => ({
      tag: 'div',
      children: [{ tag: 'input', value: s.value }, String(s.other)],
    }));
    await flush();
    const input = app.querySelector('input') as HTMLInputElement;
    input.focus();
    // ユーザーが打鍵中 (state とは異なる編集バッファ)
    input.value = 'user-typing';

    // 無関係な state 変更で再描画をトリガー (state.value 自体は変えていない想定に近いが、
    // FORCE_REAPPLY は prev=next でも毎回効くのが本来の挙動なので、それでもガードが効くことを見る)
    handle.other = 1;
    await flush();

    expect(input.value).toBe('user-typing'); // 打鍵中の値が潰されない
  });

  it('blur 後の render では value が同期される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { value: 'server-value' }, (s) => ({ tag: 'input', value: s.value }));
    await flush();
    const input = app.querySelector('input') as HTMLInputElement;
    input.focus();
    input.value = 'user-typing';
    input.blur();

    handle.value = 'server-value'; // 同じ値でも FORCE_REAPPLY は毎回効く
    await flush();

    expect(input.value).toBe('server-value');
  });

  it('フォーカスされていない input には通常どおり value が反映される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { value: 'a' }, (s) => ({ tag: 'input', value: s.value }));
    await flush();
    const input = app.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);

    handle.value = 'b';
    await flush();
    expect(input.value).toBe('b');
  });

  it('checked/scrollTop 等 value 以外の FORCE_REAPPLY キーはガードの対象外', async () => {
    const app = setupApp();
    const handle = createApp('#app', { on: true, other: 0 }, (s) => ({
      tag: 'div',
      children: [{ tag: 'input', type: 'checkbox', checked: s.on }, String(s.other)],
    }));
    await flush();
    const checkbox = app.querySelector('input') as HTMLInputElement;
    checkbox.focus();
    checkbox.checked = false; // ユーザー操作で drift

    handle.other = 1; // 無関係な state 変更で再描画
    await flush();

    // checked は編集中ガードの対象外なので VDOM の値 (true) で上書きされる
    expect(checkbox.checked).toBe(true);
  });
});
