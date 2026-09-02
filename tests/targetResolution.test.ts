// target 未解決時の挙動 (Phase 1b、設計書 §12)。
// v1 の 20 秒ポーリングは持たず、`DOMContentLoaded` を 1 回だけ待って再解決する。
// それでも見つからなければ console.error + 型付き NOOP になる。
// `<head>` 内 script のように、createApp() 呼び出し時点ではまだ target がパースされて
// いない典型ケースだけを救う、予測可能な挙動 (無限リトライはしない)。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { flush } from './_helpers/dom.js';

/** document.readyState を 'loading' に固定する (jsdom は読み取り専用アクセサなので defineProperty で上書きする) */
const setReadyState = (value: DocumentReadyState): void => {
  Object.defineProperty(document, 'readyState', { value, configurable: true });
};

describe('target 未解決時: DOMContentLoaded を 1 回だけ待つ', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  const originalReadyState = document.readyState;

  beforeEach(() => {
    document.body.innerHTML = '';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    setReadyState(originalReadyState);
  });

  it('document.readyState が loading の間に target が見つからない場合、即座には NOOP 扱いにしない (console.error を出さない)', () => {
    setReadyState('loading');
    createApp('#later', {}, () => ({ tag: 'div' }));
    // DOMContentLoaded を待っている間は「未解決かもしれない」だけなので、
    // v1 の 20 秒ポーリングのように即 console.error は出さない。
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('DOMContentLoaded 発火後に target が存在すれば、そこへ同期描画される', async () => {
    setReadyState('loading');
    const handle = createApp('#later', { n: 1 }, (s) => ({ tag: 'div', id: 'out', children: [String(s.n)] }));

    // <head> 内 script が実行された後、body のパースが進んで target が現れる想定
    const target = document.createElement('div');
    target.id = 'later';
    document.body.appendChild(target);

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    expect(target.querySelector('#out')!.textContent).toBe('1');
    expect(errorSpy).not.toHaveBeenCalled();

    // 解決後は通常の App として state 変更にも反応する
    handle.n = 2;
    await flush();
    expect(target.querySelector('#out')!.textContent).toBe('2');
  });

  it('DOMContentLoaded より前の state 変更も、解決後の初回描画に引き継がれる', async () => {
    setReadyState('loading');
    const handle = createApp('#later', { n: 1 }, (s) => ({ tag: 'div', id: 'out', children: [String(s.n)] }));

    handle.n = 5; // まだ target が無い間の変更

    const target = document.createElement('div');
    target.id = 'later';
    document.body.appendChild(target);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    expect(target.querySelector('#out')!.textContent).toBe('5');
  });

  it('DOMContentLoaded 発火後も target が見つからなければ console.error + NOOP になる', async () => {
    setReadyState('loading');
    const handle = createApp('#never', {}, () => ({ tag: 'div' }));

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flush();

    expect(errorSpy).toHaveBeenCalled();
    // NOOP: 任意のプロパティ読み書き・メソッド呼び出しが throw しない
    expect(() => {
      const _ = (handle as unknown as Record<string, unknown>).anything;
      (handle as unknown as Record<string, unknown>).anything = 1;
      handle.renderNow();
    }).not.toThrow();
  });

  it('document.readyState が既に loading でない場合は、待たずに即 console.error + NOOP', () => {
    setReadyState('complete');
    const app = createApp('#does-not-exist-either', {}, () => ({ tag: 'div' }));
    expect(errorSpy).toHaveBeenCalled();
    expect(app).toBeTruthy();
  });
});
