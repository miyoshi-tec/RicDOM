// portal 層 (設計書 §3.5) — mount 単位の portal ホスト。
//   - target 直下の末尾に `<div data-ricdom-role="portal">` を自動生成 (既定)
//   - `portalTo` で任意要素へ差し替え可能 (v1 の portal_to 要望を吸収)
//   - 複数 createApp = 複数 portal (独立)
//   - portal 内容は登録済み part の renderPortal() を毎 render 集めて差分パッチする
//     (v1 の _page_portal_queue の後継。page への依存が無い)

import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { flush, setupApp } from './_helpers/dom.js';
import type { UsePart } from '../src/types.js';

describe('portal: 既定 (自動生成)', () => {
  it('target 直下の末尾に data-ricdom-role="portal" が 1 つだけ生成される', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div', id: 'main' }));
    await flush();

    const portals = app.querySelectorAll(':scope > [data-ricdom-role="portal"]');
    expect(portals.length).toBe(1);
    // メインツリーの後ろ (target の末尾) に置かれる
    expect(app.lastElementChild).toBe(portals[0]);
    expect(app.querySelector('#main')).not.toBeNull();
  });

  it('メインツリーの再描画を挟んでも portal 要素は同一の DOM ノードのまま維持される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { n: 0 }, (s) => ({ tag: 'div', children: [String(s.n)] }));
    await flush();
    const portalBefore = app.querySelector('[data-ricdom-role="portal"]');

    handle.n = 1;
    handle.n = 2;
    await flush();
    const portalAfter = app.querySelector('[data-ricdom-role="portal"]');
    expect(portalAfter).toBe(portalBefore);
  });

  it('render のトップレベルが invisible (null) を返しても portal は保持される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { show: false }, (s) => (s.show ? { tag: 'div', id: 'x' } : null));
    await flush();
    expect(app.querySelector('[data-ricdom-role="portal"]')).not.toBeNull();
    expect(app.querySelector('#x')).toBeNull();

    handle.show = true;
    await flush();
    expect(app.querySelector('#x')).not.toBeNull();
    expect(app.querySelector('[data-ricdom-role="portal"]')).not.toBeNull();
  });

  it('メインツリーが invisible → visible に変わっても portal の DOM ノード・内容は保持される (回帰: portal に key が無いと index ズレで作り直されるバグ)', async () => {
    // 実装中に発見: normalizeChildren は invisible な子を除去するため、
    // [mainTree, PORTAL_SENTINEL] の「配列上のインデックス」は mainTree が
    // invisible な render とそうでない render とで 0 だったり 1 だったりズレる。
    // PORTAL_SENTINEL に key が無いと位置ベース reconciliation がこれを
    // 「型が変わった」と誤判定し、portal の実 DOM ノードを破棄して新しい
    // ノードを作ってしまう (キャッシュ済みの portal 要素参照が浮遊し、以後の
    // portal パッチが画面に繋がっていないノードに対して行われる)。
    const app = setupApp();
    const handle = createApp('#app', { show: false }, (s) => (s.show ? { tag: 'div', id: 'x' } : null));
    const part: UsePart = { renderPortal: () => ({ tag: 'span', id: 'out', children: ['portal-content'] }) };
    handle.use(part);
    await flush();

    const portalBefore = app.querySelector('[data-ricdom-role="portal"]');
    expect(portalBefore).not.toBeNull();
    expect(app.querySelector('#out')!.textContent).toBe('portal-content');

    handle.show = true; // メインツリーが invisible → visible に変わる
    await flush();

    const portalAfter = app.querySelector('[data-ricdom-role="portal"]');
    expect(portalAfter).toBe(portalBefore); // 同一 DOM ノードのまま
    expect(app.querySelector('#out')!.textContent).toBe('portal-content'); // 内容も生きている
    expect(app.querySelector('#x')).not.toBeNull(); // メインツリーも正しく描画されている
  });

  it('renderPortal() の戻り値が render サイクルごとに portal へ差分反映される', async () => {
    const app = setupApp();
    const handle = createApp('#app', { label: 'a' }, (s) => ({ tag: 'div', children: [s.label] }));
    const part: UsePart = { renderPortal: () => ({ tag: 'span', id: 'out', children: [(handle as unknown as { label: string }).label] }) };
    handle.use(part);
    await flush();
    expect(app.querySelector('#out')!.textContent).toBe('a');

    handle.label = 'b';
    await flush();
    expect(app.querySelector('#out')!.textContent).toBe('b');
  });
});

describe('portal: portalTo オプション (設計書 §3.5、v1 の portal_to 要望)', () => {
  it('portalTo で指定した要素に portal 内容が描画され、target 直下には portal 用の子要素が増えない', async () => {
    document.body.innerHTML = '<div id="app"></div><div id="external-portal"></div>';
    const app = document.getElementById('app')!;
    const external = document.getElementById('external-portal')!;

    const handle = createApp('#app', {}, () => ({ tag: 'div', id: 'main' }), { portalTo: external });
    handle.use({ renderPortal: () => ({ tag: 'span', id: 'out', children: ['x'] }) });
    await flush();

    expect(app.querySelector('[data-ricdom-role="portal"]')).toBeNull();
    expect(app.children.length).toBe(1); // メインツリーのみ (自前 portal を追加しない)
    expect(external.querySelector('#out')!.textContent).toBe('x');
  });
});

describe('portal: 複数 app = 複数 portal (独立)', () => {
  it('別々の createApp() 呼び出しは別々の portal 要素を持つ', async () => {
    document.body.innerHTML = '<div id="app1"></div><div id="app2"></div>';
    const handle1 = createApp('#app1', {}, () => ({ tag: 'div' }));
    const handle2 = createApp('#app2', {}, () => ({ tag: 'div' }));
    handle1.use({ renderPortal: () => ({ tag: 'span', id: 'p1', children: ['one'] }) });
    handle2.use({ renderPortal: () => ({ tag: 'span', id: 'p2', children: ['two'] }) });
    await flush();

    const app1 = document.getElementById('app1')!;
    const app2 = document.getElementById('app2')!;
    expect(app1.querySelector('#p1')).not.toBeNull();
    expect(app1.querySelector('#p2')).toBeNull();
    expect(app2.querySelector('#p2')).not.toBeNull();
    expect(app2.querySelector('#p1')).toBeNull();
  });
});

describe('use() 忘れ検知は part の責務 (host が無いことを part 自身が検知する、設計書 §3.4)', () => {
  it('use() されなかった part の renderPortal は app から一切呼ばれない', async () => {
    const app = setupApp();
    createApp('#app', {}, () => ({ tag: 'div' }));
    let called = false;
    // eslint 的には未使用だが「use() していないので当然呼ばれない」ことを確認する目的
    const part: UsePart = { renderPortal: () => { called = true; return null; } };
    void part;
    await flush();
    expect(called).toBe(false);
    expect(app.querySelector('[data-ricdom-role="portal"]')).not.toBeNull();
  });
});
