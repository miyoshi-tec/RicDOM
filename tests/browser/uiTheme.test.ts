// 実ブラウザ回帰テスト: applyTheme のテーマ切替で color-scheme の computed 値が変わる
// (設計書 F、v1 v0.4.2 のネイティブ部品追従バグの回帰確認)。jsdom は `color-scheme` の
// computed style を実装しないため、実ブラウザでのみ検証できる。

import { describe, expect, it } from 'vitest';
import { applyTheme } from '../../src/ui/theme.js';
import { createApp } from '../../src/app.js';
import { uiButton } from '../../src/ui/button.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

// #11 の検証には ricdom-ui.css ( `[data-ricdom-theme] { background; color; }` ) が
// 実際に読み込まれている必要がある — CSS 変数の適用だけを見る既存のテスト (applyTheme が
// el.style に直接書く値) と違い、こちらは属性セレクタ経由の規則が computed style に
// 反映されるかを見るため。
injectStyles(document);

describe('実ブラウザ: applyTheme の color-scheme が computed style に反映される', () => {
  it('light → dark のテーマ切替で computed color-scheme が変わる', () => {
    const app = setupApp();
    applyTheme(app, { theme: 'light' });
    expect(getComputedStyle(app).colorScheme).toBe('light');

    applyTheme(app, { theme: 'dark' });
    expect(getComputedStyle(app).colorScheme).toBe('dark');
  });

  it('別々の要素が別々のテーマ (color-scheme) を同時に持てる (:root 不使用、設計書 §4)', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    const elA = document.getElementById('a')!;
    const elB = document.getElementById('b')!;
    applyTheme(elA, { theme: 'light' });
    applyTheme(elB, { theme: 'dark' });

    expect(getComputedStyle(elA).colorScheme).toBe('light');
    expect(getComputedStyle(elB).colorScheme).toBe('dark');
  });

  it('CSS 変数の computed 値もテーマ切替に追従する', () => {
    const app = setupApp();
    applyTheme(app, { theme: 'light' });
    expect(getComputedStyle(app).getPropertyValue('--ric-color-fg').trim()).toBe('#111827');

    applyTheme(app, { theme: 'dark' });
    expect(getComputedStyle(app).getPropertyValue('--ric-color-fg').trim()).toBe('#e5e7eb');
  });
});

// #11: applyTheme した要素に background-color/color が塗られない (v1 create_ui_page パリティ
// の欠落)。ricdom-ui.css の `[data-ricdom-theme] { background: var(--ric-color-bg); color:
// var(--ric-color-fg); }` (cssTemplates.ts THEME_PAINT_CSS) の実 computed style を見る —
// jsdom は attribute セレクタの CSS 適用は解釈できるが、ここでは意図的に他のテーマテストと
// 揃えて実ブラウザで検証する (injectStyles を読み込んだ状態での回帰確認)。
const hexToRgb = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('実ブラウザ: applyTheme した要素に background/color が塗られる (#11)', () => {
  it('theme: "light"/"dark" (テーマ名指定) で computed background-color/color がテーマの bg/fg と一致する', () => {
    const app = setupApp();
    applyTheme(app, { theme: 'light' });
    const light = getComputedStyle(app);
    expect(light.backgroundColor).toBe(hexToRgb('#f9fafb')); // COLOR_VARS_LIGHT の --ric-color-bg
    expect(light.color).toBe(hexToRgb('#111827')); // COLOR_VARS_LIGHT の --ric-color-fg

    applyTheme(app, { theme: 'dark' });
    const dark = getComputedStyle(app);
    expect(dark.backgroundColor).toBe(hexToRgb('#111318')); // COLOR_VARS_DARK の --ric-color-bg
    expect(dark.color).toBe(hexToRgb('#e5e7eb')); // COLOR_VARS_DARK の --ric-color-fg
  });

  it('theme: ThemeVars (自前テーマオブジェクト) でも background/color が塗られる — 属性値は空文字だが [data-ricdom-theme] は空値にもマッチする', () => {
    const app = setupApp();
    applyTheme(app, { theme: { '--ric-color-bg': '#ff0000', '--ric-color-fg': '#00ff00' } });

    // ThemeVars 指定でも data-ricdom-theme の属性値自体は applyTheme が常に '' を書く仕様
    // (theme.ts)。属性セレクタ `[data-ricdom-theme]` は「属性の有無」で一致するので、
    // 値が空文字でも規則が適用されることを確認する。
    expect(app.getAttribute('data-ricdom-theme')).toBe('');

    const computed = getComputedStyle(app);
    expect(computed.backgroundColor).toBe(hexToRgb('#ff0000'));
    expect(computed.color).toBe(hexToRgb('#00ff00'));
  });

  it('自分の CSS で上書きできる (クラスセレクタ + !important、詳細度に関わらず勝てる)', () => {
    const app = setupApp();
    applyTheme(app, { theme: 'dark' });

    const override = document.createElement('style');
    override.textContent = '.no-paint { background-color: red !important; }';
    document.head.appendChild(override);
    app.classList.add('no-paint');

    expect(getComputedStyle(app).backgroundColor).toBe('rgb(255, 0, 0)');
    document.head.removeChild(override);
  });

  // Brownies Desktop からの報告 #1 (2.0.0-alpha.8): 修正前は THEME_PAINT_CSS が
  // `[data-ricdom-theme] { background: ... }` (詳細度 (0,1,0)) で、consumer が
  // ごく普通に書く要素セレクタ `body { background: ... }` (詳細度 (0,0,1)) では
  // !important なしで勝てなかった ((0,1,0) > (0,0,1) のため consumer の指定が
  // 無視され、テーマの色が残ったまま = 赤のはずが実際は theme の bg 色になっていた)。
  // `:where([data-ricdom-theme])` に変えて詳細度を 0 にしたことで、consumer の
  // 要素セレクタ 1 つだけで確実に上書きできることを実測する。
  it('consumer の要素セレクタ (詳細度 (0,0,1)) だけで既定塗りに勝てる (#1、修正前は負けていた)', () => {
    document.body.innerHTML = '';
    applyTheme(document.body, { theme: 'dark' });

    const override = document.createElement('style');
    // !important を使わない、ごく普通の要素セレクタ。
    override.textContent = 'body { background: rgb(30, 30, 30); }';
    document.head.appendChild(override);

    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(30, 30, 30)');
    document.head.removeChild(override);
    document.body.removeAttribute('data-ricdom-theme');
    document.body.removeAttribute('style');
  });

  it('ネストした島 (子孫で再度 applyTheme された要素) は自分の bg を塗る (v1 と同じ意図どおりの挙動)', () => {
    const app = setupApp();
    applyTheme(app, { theme: 'light' });
    app.innerHTML = '<div id="nested"></div>';
    const nested = document.getElementById('nested')!;
    applyTheme(nested, { theme: 'dark' });

    expect(getComputedStyle(app).backgroundColor).toBe(hexToRgb('#f9fafb'));
    expect(getComputedStyle(nested).backgroundColor).toBe(hexToRgb('#111318'));
  });
});

// #2 (パイロット第 3 号 = 展示ビューアからの報告、2.0.0-alpha.6): applyTheme(el, { fontSize })
// は `--ric-font-size` 変数をセットするだけで、要素自身の font-size は塗っていなかった
// (変数を消費するのは .ric-panel/.ric-md-pre くらいで、それ以外の直下テキストはブラウザ
// 既定の 16px のまま)。v1 の `.ric-page` は font-size も塗っていた (md=14px) ため、
// bg/fg パリティ (#11) と同じ理由で THEME_PAINT_CSS に font-size を追加した。
// 修正前は el 自身の computed font-size が (fontSize オプションの値に関わらず) 常に
// ブラウザ既定の 16px になっていた。
describe('実ブラウザ: applyTheme した要素に font-size が塗られる (#2)', () => {
  it('fontSize: "sm"/"md"/"lg" で computed font-size が 12px/14px/16px になる', () => {
    const app = setupApp();
    applyTheme(app, { fontSize: 'sm' });
    expect(getComputedStyle(app).fontSize).toBe('12px');

    applyTheme(app, { fontSize: 'md' });
    expect(getComputedStyle(app).fontSize).toBe('14px');

    applyTheme(app, { fontSize: 'lg' });
    expect(getComputedStyle(app).fontSize).toBe('16px');
  });

  it('fontSize 省略時は既定の md (14px) になる', () => {
    const app = setupApp();
    applyTheme(app, { theme: 'light' });
    expect(getComputedStyle(app).fontSize).toBe('14px');
  });

  it('fontSize: ThemeVars (自前 --ric-font-size 直指定) でもその値が塗られる', () => {
    const app = setupApp();
    applyTheme(app, { fontSize: { '--ric-font-size': '20px' } });
    expect(getComputedStyle(app).fontSize).toBe('20px');
  });

  it('直下の uiButton (font-size: 1em) が applyTheme の 14px を継承する', async () => {
    const app = setupApp();
    applyTheme(app, { fontSize: 'md' });
    createApp(app, {}, () => uiButton({ children: ['保存'] }));
    await flush();

    const button = app.querySelector('.ric-button') as HTMLElement;
    expect(getComputedStyle(button).fontSize).toBe('14px');
  });
});
