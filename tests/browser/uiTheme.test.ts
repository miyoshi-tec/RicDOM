// 実ブラウザ回帰テスト: applyTheme のテーマ切替で color-scheme の computed 値が変わる
// (設計書 F、v1 v0.4.2 のネイティブ部品追従バグの回帰確認)。jsdom は `color-scheme` の
// computed style を実装しないため、実ブラウザでのみ検証できる。

import { describe, expect, it } from 'vitest';
import { applyTheme } from '../../src/ui/theme.js';
import { setupApp } from '../_helpers/dom.js';

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
