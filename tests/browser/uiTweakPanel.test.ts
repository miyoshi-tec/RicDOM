// 実ブラウザ回帰テスト: createTweakPanel (Phase 3c、設計書 §7)
//
// v1 の v0.3.37 バグ (number 行で小数点を打っている最中に別 state の再 render が走ると
// 入力が潰れる) が、v2 のコア規則 (編集中ガード、src/dom.ts の shouldSkipValueReapply) に
// 一般化されたことで **構造的に消えている** ことを実証する。tweakPanel.ts の number 行は
// v1 と違い onfocus マーカー等の局所対応を一切持たない (ヘッダコメント参照) — この
// テストはその設計判断そのものの回帰テストになる。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { createTweakPanel } from '../../src/ui/tweakPanel.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

injectStyles(document);

describe('実ブラウザ: createTweakPanel の number 行', () => {
  it('小数点を打っている最中 (userEvent.type) に無関係な state の再 render が走っても入力が潰れない', async () => {
    const app = setupApp();
    let tweak: ReturnType<typeof createTweakPanel>;
    const data = { size: 1 };
    let other = 0;
    const handle = createApp('#app', {}, () => (tweak ? [tweak({ data }), String(other)] : null));
    tweak = handle.use(createTweakPanel());
    await flush();

    const input = app.querySelector('input[type="number"]') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.clear(input);
    // "0.3" を実際のキー入力で打つ (v1 のバグ報告と同じ操作: 打鍵の途中で "0." のような
    // badInput 状態を経由する)。
    await userEvent.type(input, '0.3');

    const typedValue = input.value;
    expect(typedValue).toBe('0.3');

    // 無関係な state 変更で再描画をトリガーする (data.size 自体は変えていない)。
    other = 1;
    handle.renderNow();
    await flush();

    // 編集中ガードが効き、打鍵直後の内容がそのまま保たれる (v1 なら "0.3" → "30" のように
    // 壊れていた実害)。
    expect(input.value).toBe(typedValue);
    expect(document.activeElement).toBe(input);
  });

  it('blur すると min/max の clamp を経て確定値が data に書き戻される', async () => {
    const app = setupApp();
    let tweak: ReturnType<typeof createTweakPanel>;
    const data = { size: 1 };
    const handle = createApp('#app', {}, () => (tweak ? tweak({ data, keys: { size: { min: 0, max: 10 } } }) : null));
    tweak = handle.use(createTweakPanel());
    await flush();

    const input = app.querySelector('input[type="number"]') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.type(input, '99'); // "1" の末尾に追記 → "199" (min/max: 0-10 を超える)
    expect(input.value).toBe('199');
    input.blur();
    await flush();

    expect(data.size).toBe(10); // clamp された確定値
    expect(input.value).toBe('10');
  });
});

describe('実ブラウザ: createTweakPanel の folder 開閉', () => {
  it('ヘッダをクリックすると実際に hidden が切り替わり、中の行が見える/見えなくなる', async () => {
    const app = setupApp();
    let tweak: ReturnType<typeof createTweakPanel>;
    const data = { nested: { inner: 1 } };
    const handle = createApp('#app', {}, () => (tweak ? tweak({ data }) : null));
    tweak = handle.use(createTweakPanel());
    await flush();

    const header = app.querySelector('.ric-tweak-folder__header') as HTMLButtonElement;
    const body = () => app.querySelector('.ric-tweak-folder__body') as HTMLElement;

    expect(body().hidden).toBe(true);

    await userEvent.click(header);
    await flush();
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(body().hidden).toBe(false);
    // 折りたたみが開いた状態では実際に中の number input が操作可能 (見えている)
    const innerInput = app.querySelector('.ric-tweak-folder input[type="number"]') as HTMLInputElement;
    expect(innerInput).not.toBeNull();
    await userEvent.click(innerInput);
    expect(document.activeElement).toBe(innerInput);

    await userEvent.click(header);
    await flush();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
  });
});
