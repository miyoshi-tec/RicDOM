// createDropdown (設計書 §3.4 部品契約 + §5/付録 E a11y)
// 実測位置 (below/above flip・横 clamp) は jsdom のレイアウト非対応のため
// tests/browser/uiDropdown.test.ts (実ブラウザ) で検証する。ここでは ARIA 属性・
// label/icon/chevron/ghost モード・use() 忘れ検知・排他制御 (host.app 単位) を確認する。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createDropdown } from '../../src/ui/dropdown.js';
import { createPopup } from '../../src/ui/popup.js';
import { flush, setupApp } from '../_helpers/dom.js';

describe('createDropdown: use() 忘れ検知 (設計書 A)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it('use() されていない dropdown を直接呼ぶと console.error を出し null を返す', () => {
    const dd = createDropdown();
    expect(dd({ label: 'x' })).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('createDropdown: トリガーの ARIA / モード', () => {
  it('label モード: aria-haspopup="dialog" + aria-expanded を持ち、閉時は minWidth 未計測', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: '選択肢' }) : null));
    dd = handle.use(createDropdown());
    await flush();

    const trigger = app.querySelector('button')!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.className).toContain('ric-dropdown__trigger--label');
    expect(trigger.textContent).toBe('選択肢');
  });

  it('icon モード: --label クラスを持たない', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ icon: '⚙' }) : null));
    dd = handle.use(createDropdown());
    await flush();
    const trigger = app.querySelector('button')!;
    expect(trigger.className).not.toContain('ric-dropdown__trigger--label');
    expect(trigger.textContent).toBe('⚙');
  });

  it('label/icon どちらも省略するとデフォルトアイコン (≡)', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({}) : null));
    dd = handle.use(createDropdown());
    await flush();
    expect(app.querySelector('button')!.textContent).toBe('≡');
  });

  it('ghost:true で --ghost クラスが付く', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ icon: '⚙', ghost: true }) : null));
    dd = handle.use(createDropdown());
    await flush();
    expect(app.querySelector('button')!.className).toContain('ric-dropdown__trigger--ghost');
  });

  it('chevron:true (label モード) は開閉で回転クラスが切り替わる svg を持つ', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: 'x', chevron: true, children: [] }) : null));
    dd = handle.use(createDropdown());
    await flush();

    // svg 要素の .className は SVGAnimatedString (文字列ではない) を返すため、
    // class の実値は getAttribute('class') で読む (dom.ts の setClassAttr 参照)。
    let chevron = app.querySelector('.ric-dropdown__chevron')!;
    expect(chevron.getAttribute('class')).not.toContain('--open');

    app.querySelector('button')!.click();
    await flush();
    await flush(); // rAF 実測後の 2 段階目
    chevron = app.querySelector('.ric-dropdown__chevron')!;
    expect(chevron.getAttribute('class')).toContain('ric-dropdown__chevron--open');
  });
});

describe('createDropdown: 開閉', () => {
  it('クリックで開き aria-expanded=true、本体が portal に現れる (role は持たない汎用 Popover)', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: 'x', children: [{ tag: 'span', children: ['中身'] }] }) : null));
    dd = handle.use(createDropdown());
    await flush();

    app.querySelector('button')!.click();
    await flush();
    await flush();

    expect(app.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    const body = app.querySelector('.ric-dropdown__body');
    expect(body).not.toBeNull();
    expect(body!.textContent).toBe('中身');
    expect(body!.getAttribute('data-ricdom-role')).toBe('dropdown'); // portal ルートの安定セレクタ
    expect(dd!.isOpen()).toBe(true);
  });

  it('dd.close() で閉じる', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: 'x', children: [] }) : null));
    dd = handle.use(createDropdown());
    await flush();

    app.querySelector('button')!.click();
    await flush();
    await flush();
    expect(dd!.isOpen()).toBe(true);

    dd!.close();
    (app.querySelector('.ric-dropdown__body') as unknown as { onanimationend: () => void }).onanimationend();
    await flush();
    expect(dd!.isOpen()).toBe(false);
    expect(app.querySelector('.ric-dropdown__body')).toBeNull();
  });

  it('Esc で閉じる', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: 'x', children: [] }) : null));
    dd = handle.use(createDropdown());
    await flush();

    app.querySelector('button')!.click();
    await flush();
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // doClose() は isClosing=true にするだけで isOpen は animationend (or backstop) まで
    // true のまま (createPopup/createDialog と同じ二段階クローズ、tests/ui/popup.test.ts 踏襲)。
    expect(dd!.isOpen()).toBe(true);
    (app.querySelector('.ric-dropdown__body') as unknown as { onanimationend: () => void }).onanimationend();
    await flush();
    expect(dd!.isOpen()).toBe(false);
    expect(app.querySelector('.ric-dropdown__body')).toBeNull();
  });

  it('overlay に data-ricdom-role="popup-overlay" が付く (createPopup と共有、2.0.0-alpha.2)', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: 'x', children: [] }) : null));
    dd = handle.use(createDropdown());
    await flush();
    app.querySelector('button')!.click();
    await flush();
    await flush();

    expect(app.querySelector('.ric-popup__overlay')!.getAttribute('data-ricdom-role')).toBe('popup-overlay');
  });
});

describe('createDropdown: 排他制御 (host.app 単位、popup 系で共有)', () => {
  it('同じ app 内で dropdown を開くと、開いていた popup が閉じる', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () => (dd !== undefined && menu !== undefined ? [dd({ label: 'DD', children: [] }), menu({ trigger: ['M'], children: [] })] : null));
    dd = handle.use(createDropdown());
    menu = handle.use(createPopup());
    await flush();

    const buttons = () => Array.from(app.querySelectorAll('button'));
    buttons()[1]!.click(); // popup を開く
    await flush();
    await flush();
    expect(menu!.isOpen()).toBe(true);

    buttons()[0]!.click(); // dropdown を開く → popup の close (closing 開始) がトリガーされる
    await flush();
    await flush();
    expect(dd!.isOpen()).toBe(true);
    // popup 側は closing 中 (isClosing=true) だが isOpen() は animationend/backstop まで
    // true を保つ実装 (createPopup 踏襲)。ここでは「closeOthers 経由で close() が
    // 呼ばれたこと」を、backstop 経由で実際に閉じ切ることまで確認して検証する。
    await new Promise((r) => setTimeout(r, 750));
    expect(menu!.isOpen()).toBe(false);
  });

  it('別 app の dropdown/popup は互いに影響しない', async () => {
    document.body.innerHTML = '<div id="appA"></div><div id="appB"></div>';
    let ddA: ReturnType<typeof createDropdown>;
    let ddB: ReturnType<typeof createDropdown>;
    const handleA = createApp('#appA', {}, () => (ddA ? ddA({ label: 'A', children: [] }) : null));
    const handleB = createApp('#appB', {}, () => (ddB ? ddB({ label: 'B', children: [] }) : null));
    ddA = handleA.use(createDropdown());
    ddB = handleB.use(createDropdown());
    await flush();

    document.querySelector('#appA button')!.dispatchEvent(new Event('click', { bubbles: true }));
    await flush();
    await flush();
    document.querySelector('#appB button')!.dispatchEvent(new Event('click', { bubbles: true }));
    await flush();
    await flush();

    expect(ddA!.isOpen()).toBe(true);
    expect(ddB!.isOpen()).toBe(true); // 別 app なので閉じない
  });
});

describe('createDropdown: dispose', () => {
  it('unmount 後は再度呼んでも描画されない', async () => {
    const app = setupApp();
    let dd: ReturnType<typeof createDropdown>;
    const handle = createApp('#app', {}, () => (dd ? dd({ label: 'x' }) : null));
    dd = handle.use(createDropdown());
    await flush();
    handle.unmount();

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(dd!({ label: 'x' })).toBeNull();
    errorSpy.mockRestore();
  });
});
