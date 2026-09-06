// 実ブラウザ回帰テスト: warnIfStylesMissing の CSS 読込検知 (パイロット第 9 号 = Potopeta
// からの報告、2.0.0-alpha.10)。Potopeta (RicUI デザイナ) は v1 の LZ 自己展開ツールで
// 生成した自己完結 HTML バンドルとして配布しており、`ricdom-ui.css` の生 CSS を
// `<style>` に直接埋め込む (`<link>` を使わない、injectStyles() も呼ばない)。従来の
// 検知は injectStyles 自身のマーカー (`style[data-ricdom-role="styles"]`) と
// `link[href$="ricdom-ui.css"]` の 2 経路しか見ておらず、このケースを「未読み込み」と
// 誤検知していた (false positive)。
//
// 修正後は `document.styleSheets` を走査し `.ric-button` セレクタを持つ CSSStyleRule の
// 実在を見る (injectStyles.ts の hasRicdomStylesheetLoaded 参照)。jsdom の unit テスト
// (tests/ui/injectStyles.test.ts) でも同種の検証は可能だが、CSSOM の挙動 (styleSheets/
// cssRules の実装差) は実ブラウザで確定させるのが本筋のため、ここに実ブラウザ版を置く。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildStylesheet } from '../../src/ui/cssTemplates.js';
import { injectStyles, warnIfStylesMissing, _resetStyleWarningForTest } from '../../src/ui/injectStyles.js';

describe('実ブラウザ: warnIfStylesMissing の CSS 読込検知 (2.0.0-alpha.10)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    _resetStyleWarningForTest();
  });

  it('生 CSS を <style> にインライン埋め込み (injectStyles も <link> も使わない) → warn しない (#Potopeta、修正前は false positive で warn していた)', () => {
    const inline = document.createElement('style');
    inline.textContent = buildStylesheet(); // consumer 自身が生 CSS を直接埋め込むケースを再現 (data-ricdom-role マーカーは付けない)
    document.head.appendChild(inline);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('何も読み込んでいない → warn 1 回', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('<link rel="stylesheet"> で読み込み済み → warn しない (従来経路、回帰確認)', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://example.com/dist/ricdom-ui.css';
    document.head.appendChild(link);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('injectStyles() 済み → warn しない (従来経路、回帰確認)', () => {
    injectStyles(document);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ricdom と無関係な <style> (.ric-button を含まない) は既読み込み扱いにしない → warn 1 回', () => {
    const unrelated = document.createElement('style');
    unrelated.textContent = '.my-app-button { color: red; }';
    document.head.appendChild(unrelated);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnIfStylesMissing(document);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
