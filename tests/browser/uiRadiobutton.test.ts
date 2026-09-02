// 実ブラウザ回帰テスト: uiRadiobutton のラベル整列 (設計書 F)。
// アイコン (uiIcon、svg) とテキストが混在するラベルでも、input と .ric-radio__label の
// 縦中心が一致すること (getBoundingClientRect の中心一致) を実レイアウトで確認する
// (v1 由来の .ric-radio__label { display:inline-flex; align-items:center } の効果検証。
// jsdom はレイアウトを計算しないため実ブラウザでのみ検証できる)。

import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { uiIcon } from '../../src/ui/icon.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { uiRadiobutton } from '../../src/ui/radiobutton.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

// v1 icons/src.json の 'check' (Lucide) と同じ path (手書きしない、既存の検証済みデータ)。
const CHECK = { p: 'M20 6 9 17l-5-5' };

describe('実ブラウザ: uiRadiobutton のラベル整列', () => {
  it('アイコン混在ラベルでも input と .ric-radio__label の縦中心が一致する (縦ズレしない)', async () => {
    const app = setupApp();
    createApp('#app', {}, () =>
      uiRadiobutton({
        name: 'mode',
        value: 'a',
        options: [{ value: 'a', label: [uiIcon(CHECK, { size: 20 }), ' 完了'] }, { value: 'b', label: 'テキストのみ' }],
      }),
    );
    await flush();

    const input = app.querySelector('input[type="radio"]') as HTMLElement;
    const label = app.querySelector('.ric-radio__label') as HTMLElement;
    expect(input).not.toBeNull();
    expect(label).not.toBeNull();

    const inputRect = input.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const inputCenterY = inputRect.top + inputRect.height / 2;
    const labelCenterY = labelRect.top + labelRect.height / 2;

    // 1px 未満の丸め誤差は許容する
    expect(Math.abs(inputCenterY - labelCenterY)).toBeLessThan(1);
  });
});
