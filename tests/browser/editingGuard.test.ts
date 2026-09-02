// 実ブラウザ回帰テスト (c): 編集中ガード (設計書 §3.2) を実 DOM の number input で確認する。
// jsdom 版 (tests/editingGuard.test.ts) はテキスト入力の value drift しか再現できないが、
// <input type="number"> は実ブラウザ特有の「badInput」状態を持つ (例えば "0." のように
// 構文的に未完成な入力は、画面上には打鍵した文字がそのまま残るが `.value` は空文字列を
// 返し、`validity.badInput` が true になる)。userEvent.type で実際のキー入力を模し、
// 無関係な state 変更による再描画がこの badInput 状態を破壊しないことを確認する
// (v1 でブラウザ固有だった回帰の 1 つ、設計書 §7)。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('実ブラウザ: 編集中ガード (number input の badInput を含む)', () => {
  it('打鍵中 (badInput を含む) の number input には value を書き戻さない', async () => {
    const app = setupApp();
    const handle = createApp('#app', { value: '1', other: 0 }, (s) => ({
      tag: 'div',
      children: [{ tag: 'input', type: 'number', value: s.value }, String(s.other)],
    }));
    await flush();
    const input = app.querySelector('input') as HTMLInputElement;

    // 実際のキー入力で「0.」まで打つ。小数点の後ろに数字が無い構文は
    // valid floating-point number ではないため、ブラウザは badInput 状態にする
    // (画面上の文字は残すが .value は '' になる、というのが number input の仕様)。
    await userEvent.click(input);
    await userEvent.type(input, '0.');

    const typedValue = input.value;
    const typedBadInput = input.validity.badInput;

    // 無関係な state 変更で再描画をトリガーする (state.value 自体は変えていない)
    handle.other = 1;
    await flush();

    // 編集中ガードが効き、打鍵直後の状態 (badInput 込み) がそのまま保たれる
    expect(input.value).toBe(typedValue);
    expect(input.validity.badInput).toBe(typedBadInput);
    expect(document.activeElement).toBe(input);
  });

  it('blur 後の render では value が同期される (badInput も解消される)', async () => {
    const app = setupApp();
    const handle = createApp('#app', { value: '1' }, (s) => ({ tag: 'input', type: 'number', value: s.value }));
    await flush();
    const input = app.querySelector('input') as HTMLInputElement;

    await userEvent.click(input);
    await userEvent.type(input, '0.');
    input.blur();

    handle.value = '9'; // blur 後の state 変更は同期される
    await flush();

    expect(input.value).toBe('9');
    expect(input.validity.badInput).toBe(false);
  });
});
