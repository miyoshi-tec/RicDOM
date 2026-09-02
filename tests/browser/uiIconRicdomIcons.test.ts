// 実ブラウザ回帰テスト: uiIcon が ricdom/icons の descriptor をそのまま描画できること
// (Phase 3c、設計書付録 B A17)。`ricdom/icons` は `ricdom/ui` に実行時依存を持たない
// data-only パッケージなので (§13 と同じ「型のみ依存」の考え方)、descriptor を
// import してそのまま uiIcon の第 1 引数に渡せることを実 DOM で確認する。

import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { uiIcon } from '../../src/ui/icon.js';
import { check, circleDot, x as xIcon } from '../../src/icons/index.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('実ブラウザ: uiIcon が ricdom/icons の descriptor を描く', () => {
  it('stroke モードの descriptor (check) が正しい path/viewBox で <svg> になる', async () => {
    const app = setupApp();
    createApp('#app', {}, () => uiIcon(check, { size: 20, label: 'done' }));
    await flush();

    const svg = app.querySelector('svg') as unknown as SVGSVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    const path = svg.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M20 6 9 17l-5-5');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('done');
  });

  it('fill モードの descriptor (circleDot, s:null) は fill=currentColor / stroke 属性無し', async () => {
    const app = setupApp();
    createApp('#app', {}, () => uiIcon(circleDot, { size: 16 }));
    await flush();

    const svg = app.querySelector('svg') as unknown as SVGSVGElement;
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.hasAttribute('stroke')).toBe(false);
    expect(svg.getAttribute('aria-hidden')).toBe('true'); // label 省略 = 装飾アイコン
  });

  it('複数の descriptor (x) を同じ render 内で複数回描画しても独立して動く', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({
      tag: 'div',
      children: [uiIcon(xIcon, { size: 12 }), uiIcon(xIcon, { size: 24 })],
    }));
    await flush();

    const svgs = app.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
    expect((svgs[0] as unknown as SVGSVGElement).style.width).toBe('12px');
    expect((svgs[1] as unknown as SVGSVGElement).style.width).toBe('24px');
  });
});
