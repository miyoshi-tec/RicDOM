// 実ブラウザ回帰テスト: createPopup の矢印キー移動と openAt 位置 (設計書 F、付録 E)。

import { describe, expect, it } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { createApp } from '../../src/app.js';
import { createPopup } from '../../src/ui/popup.js';
import { injectStyles } from '../../src/ui/injectStyles.js';
import { flush, setupApp } from '../_helpers/dom.js';

// CSS を読み込んでおく (`.ric-popup__body { position: fixed }` が無いと、
// 位置計算で入れる top/left の inline style が効かない — position:static のままだと
// top/left は無視される、という CSS の基礎仕様どおりの挙動)。
injectStyles(document);

describe('実ブラウザ: createPopup', () => {
  it('矢印キー (↓↑) でメニュー項目間をループ移動する', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [
              { tag: 'button', class: 'ric-button', children: ['A'] },
              { tag: 'button', class: 'ric-button', children: ['B'] },
              { tag: 'button', class: 'ric-button', children: ['C'] },
            ],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100)); // rAF 実測フェーズを待つ

    const items = app.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLElement>;
    items[0]!.focus();
    expect(document.activeElement).toBe(items[0]);

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[2]);
    await userEvent.keyboard('{ArrowDown}'); // 末尾から先頭へループ
    expect(document.activeElement).toBe(items[0]);
    await userEvent.keyboard('{ArrowUp}'); // 先頭から末尾へループ
    expect(document.activeElement).toBe(items[2]);
  });

  it('Home/End で先頭/末尾の項目へ移動する', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [
              { tag: 'button', class: 'ric-button', children: ['A'] },
              { tag: 'button', class: 'ric-button', children: ['B'] },
              { tag: 'button', class: 'ric-button', children: ['C'] },
            ],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100));

    const items = app.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLElement>;
    items[1]!.focus();
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(items[2]);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(items[0]);
  });

  it('Esc でトリガーへフォーカスが復帰する', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () => (menu ? menu({ trigger: ['⋯'], children: [{ tag: 'button', class: 'ric-button', children: ['A'] }] }) : null));
    menu = handle.use(createPopup());
    await flush();

    const trigger = app.querySelector('button')!;
    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 100));
    expect(app.querySelector('[role="menu"]')).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(trigger);
  });

  it('viewport 右端近くのトリガーから開いても、本体は画面外にはみ出ない (2.0.0-alpha.2、実機バグ修正)', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [
              { tag: 'button', class: 'ric-button', children: ['項目 A'] },
              { tag: 'button', class: 'ric-button', children: ['項目 B'] },
              { tag: 'button', class: 'ric-button', children: ['非常に長いメニュー項目のラベル文字列'] },
            ],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    // トリガーを viewport 右端 40px の位置に固定 (report の再現条件)。
    const trigger = app.querySelector('button')! as HTMLElement;
    trigger.style.position = 'fixed';
    trigger.style.top = '50px';
    trigger.style.left = `${window.innerWidth - 40}px`;

    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 100)); // rAF 実測フェーズを待つ

    const body = app.querySelector('[role="menu"]') as HTMLElement;
    expect(body).not.toBeNull();
    const rect = body.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
    expect(rect.left).toBeGreaterThanOrEqual(0);
  });

  it('アイコン+テキストの menu 項目は中心 y が一致する (2.0.0-alpha.2、.ric-popup__item の align-items 修正)', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [
              {
                tag: 'button',
                class: 'ric-button',
                children: [{ tag: 'span', id: 'icon-el', style: { display: 'inline-block', width: '20px', height: '20px', background: 'red' } }, { tag: 'span', id: 'text-el', children: ['項目'] }],
              },
            ],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100));

    const icon = app.querySelector('#icon-el')!.getBoundingClientRect();
    const text = app.querySelector('#text-el')!.getBoundingClientRect();
    const iconCenterY = icon.top + icon.height / 2;
    const textCenterY = text.top + text.height / 2;
    expect(Math.abs(iconCenterY - textCenterY)).toBeLessThan(2); // 誤差 2px 未満で一致
  });

  it('openAt({x,y}) で座標付近に開く', async () => {
    const app = setupApp();
    const handle = createApp('#app', {}, () => ({ tag: 'div' }));
    const menu = handle.use(createPopup());
    menu.openAt({ x: 100, y: 100 });
    await flush();
    await new Promise((r) => setTimeout(r, 100)); // rAF 実測フェーズ

    const body = app.querySelector('[role="menu"]') as HTMLElement;
    expect(body).not.toBeNull();
    const rect = body.getBoundingClientRect();
    // below 方向で開くケース (十分な下スペースがある座標): top はクリック位置の少し下
    expect(rect.top).toBeGreaterThanOrEqual(100);
    expect(rect.top).toBeLessThan(150);
    expect(rect.left).toBeGreaterThanOrEqual(8); // 画面外にはみ出ないよう clamp されている
  });
});

describe('実ブラウザ: createPopup のメニューが項目選択で閉じる (2.0.0-alpha.3、#10)', () => {
  it('button 項目の click で閉じ、トリガーへフォーカスが復帰する (既定 closeOnSelect: true)', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu ? menu({ trigger: ['⋯'], children: [{ tag: 'button', class: 'ric-button', children: ['削除'] }] }) : null,
    );
    menu = handle.use(createPopup());
    await flush();

    const trigger = app.querySelector('button')!;
    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 100));
    expect(app.querySelector('[role="menu"]')).not.toBeNull();

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    await userEvent.click(item);
    await new Promise((r) => setTimeout(r, 300)); // exit アニメーション終了 (700ms backstop 前) を待つ

    expect(app.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('button 項目への Enter (native click) でも閉じる', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu ? menu({ trigger: ['⋯'], children: [{ tag: 'button', class: 'ric-button', children: ['A'] }] }) : null,
    );
    menu = handle.use(createPopup());
    await flush();

    const trigger = app.querySelector('button')!;
    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 100));

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    item.focus();
    await userEvent.keyboard('{Enter}'); // <button> はネイティブに Enter → click を発火する
    await new Promise((r) => setTimeout(r, 300));

    expect(app.querySelector('[role="menu"]')).toBeNull();
  });

  it('button 項目への Space (native click) でも閉じる', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu ? menu({ trigger: ['⋯'], children: [{ tag: 'button', class: 'ric-button', children: ['A'] }] }) : null,
    );
    menu = handle.use(createPopup());
    await flush();

    const trigger = app.querySelector('button')!;
    await userEvent.click(trigger);
    await new Promise((r) => setTimeout(r, 100));

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    item.focus();
    await userEvent.keyboard(' ');
    await new Promise((r) => setTimeout(r, 300));

    expect(app.querySelector('[role="menu"]')).toBeNull();
  });

  it('closeOnSelect: false では項目を選択しても閉じない (チェック型メニュー用)', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu ? menu({ trigger: ['⋯'], closeOnSelect: false, children: [{ tag: 'button', class: 'ric-button', children: ['チェック'] }] }) : null,
    );
    menu = handle.use(createPopup());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100));

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    await userEvent.click(item);
    await new Promise((r) => setTimeout(r, 100));

    expect(app.querySelector('[role="menu"]')).not.toBeNull(); // 閉じていない
  });

  it('disabled な項目をクリックしても閉じない', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    let clicked = false;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [{ tag: 'button', class: 'ric-button', disabled: true, onclick: () => { clicked = true; }, children: ['無効'] }],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100));

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    expect(item.hasAttribute('disabled')).toBe(true);
    item.click(); // ネイティブ disabled な <button> は実ブラウザでは click 自体を発火しない
    await new Promise((r) => setTimeout(r, 100));

    expect(clicked).toBe(false); // 発火していないことの確認 (ブラウザの標準挙動)
    expect(app.querySelector('[role="menu"]')).not.toBeNull(); // 閉じていない
  });

  it('aria-disabled="true" な項目 (soft disabled) はクリックが発火しても閉じない', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    let clicked = false;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [
              { tag: 'button', class: 'ric-button', 'aria-disabled': 'true', onclick: () => { clicked = true; }, children: ['ソフト無効'] },
            ],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100));

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    // userEvent.click (Playwright 経由) は aria-disabled="true" を「操作不能」とみなして
    // actionability チェックでタイムアウトする (native disabled と違い、ブラウザの
    // click() メソッド自体は aria-disabled を尊重しないため実際には発火できる操作) —
    // ここで見たいのは「aria-disabled でも onclick は発火するが popup は閉じない」という
    // 部品の契約そのものなので、native の click() で直接発火させる。
    item.click();
    await new Promise((r) => setTimeout(r, 100));

    expect(clicked).toBe(true); // aria-disabled は見た目だけなので onclick 自体は発火する
    expect(app.querySelector('[role="menu"]')).not.toBeNull(); // それでも閉じない
  });

  it('項目の onclick が stopPropagation() していても閉じる', async () => {
    const app = setupApp();
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu
        ? menu({
            trigger: ['⋯'],
            children: [{ tag: 'button', class: 'ric-button', onclick: (ev: MouseEvent) => ev.stopPropagation(), children: ['A'] }],
          })
        : null,
    );
    menu = handle.use(createPopup());
    await flush();

    await userEvent.click(app.querySelector('button')!);
    await new Promise((r) => setTimeout(r, 100));

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    await userEvent.click(item);
    await new Promise((r) => setTimeout(r, 300));

    // popup 側は「document 全体の click 監視」ではなく項目の onclick 呼び出しそのものを
    // 包んでいるため (wrapMenuItem)、consumer の stopPropagation() の影響を受けない。
    expect(app.querySelector('[role="menu"]')).toBeNull();
  });

  it('openAt() 経路で開いたメニューでも、項目選択で閉じる', async () => {
    const app = setupApp();
    // openAt はトリガーボタンを経由しないが、renderPortal が参照する menuChildrenLast/
    // closeOnSelectLast は通常の menu({...}) 呼び出し (render 内で毎回呼ぶ) で確定する —
    // 右クリックのコンテキストメニュー等、見えないトリガーで menu({...}) を呼びつつ
    // openAt() で座標指定して開く使い方を模す。
    let menu: ReturnType<typeof createPopup>;
    const handle = createApp('#app', {}, () =>
      menu ? menu({ trigger: ['⋯'], children: [{ tag: 'button', class: 'ric-button', children: ['A'] }] }) : null,
    );
    menu = handle.use(createPopup());
    await flush();

    menu.openAt({ x: 100, y: 100 });
    await flush();
    await new Promise((r) => setTimeout(r, 100)); // rAF 実測フェーズ
    expect(app.querySelector('[role="menu"]')).not.toBeNull();

    const item = app.querySelector('[role="menuitem"]') as HTMLElement;
    await userEvent.click(item);
    await new Promise((r) => setTimeout(r, 300)); // exit アニメーション終了を待つ

    expect(app.querySelector('[role="menu"]')).toBeNull();
  });
});
