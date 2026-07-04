// RicDOM — handle.render_now() 公開 API (v0.3.25〜)
//
// _internal.force_render と等価だが、正規 API として handle.render_now() で呼べる。
// _internal.force_render は後方互換のため残置。

'use strict';

const { test, describe, beforeEach } = require('node:test');
const { strict: assert } = require('node:assert');

const { setup_jsdom, flush } = require('./_helpers/jsdom_env');

describe('handle.render_now() (v0.3.25〜)', () => {

  beforeEach(setup_jsdom);

  test('handle.render_now() は同期的に再描画する', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    let render_count = 0;
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => { render_count++; return { tag: 'div', ctx: [String(s.n)] }; },
    });
    await flush();
    const after_init = render_count;

    handle.render_now();
    // 同期的に do_render が走る (rAF 経由ではない)
    assert.equal(render_count, after_init + 1, 'render_now で 1 回再描画');
  });

  test('_internal.force_render は後方互換で同じ挙動', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    let render_count = 0;
    const handle = create_RicDOM('#app', {
      render: () => { render_count++; return { tag: 'div', ctx: ['x'] }; },
    });
    await flush();
    const after_init = render_count;

    handle._internal.force_render();
    assert.equal(render_count, after_init + 1,
      '_internal.force_render は後方互換のため残置');
  });

  test('handle.render_now と handle._internal.force_render は同じ関数を指す', () => {
    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      render: () => ({ tag: 'div', ctx: ['x'] }),
    });
    assert.equal(handle.render_now, handle._internal.force_render);
  });
});

// =====================================================================
// handle.next_render() — 非強制・観測専用 Promise (v0.3.32〜、UnizonTool 要望)
// =====================================================================
describe('handle.next_render() (v0.3.32〜)', () => {

  beforeEach(setup_jsdom);

  test('state 変化後 await すると resolve し、DOM は新しい値になっている', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', ctx: [String(s.n)] }),
    });
    await flush(); // 初回描画

    handle.n = 2; // 自然スケジュール (rAF バッチ) を起こす
    await handle.next_render();

    assert.equal(document.querySelector('#app div').textContent, '2');
  });

  test('next_render() 自身は render を起こさない（呼ぶだけでは resolve しない）', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      render: () => ({ tag: 'div', ctx: ['x'] }),
    });
    await flush(); // 初回描画

    // state 変化なしで next_render() だけ呼ぶ → 短いタイムアウトに負ける（resolve されない）
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 30));
    const result = await Promise.race([handle.next_render(), timeout]);

    assert.equal(result, 'timeout', 'render が起きていないので next_render は resolve しないはず');
  });

  test('複数箇所から同時に await しても同じ render で全員 resolve する', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', ctx: [String(s.n)] }),
    });
    await flush(); // 初回描画

    const p1 = handle.next_render();
    const p2 = handle.next_render();
    assert.equal(p1, p2, '同じ Promise を共有する');

    handle.n = 2;
    await Promise.all([p1, p2]); // 両方 resolve すること（タイムアウトしない）
  });

  test('render_now() による強制描画でも resolve する', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', ctx: [String(s.n)] }),
    });
    await flush(); // 初回描画

    const p = handle.next_render();
    handle.render_now(); // 自然スケジュールを経由しない強制描画
    await p; // タイムアウトせず resolve すること
  });

  test('resolve 後の再呼び出しは次の render を待つ新しい Promise になる', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', ctx: [String(s.n)] }),
    });
    await flush(); // 初回描画

    const p1 = handle.next_render();
    handle.n = 2;
    await p1;

    const p2 = handle.next_render();
    assert.notEqual(p1, p2, '前回 resolve 済みの Promise とは別物になる');

    // p2 はまだ resolve していないはず（新しい state 変化を起こしていない）
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 30));
    const result = await Promise.race([p2, timeout]);
    assert.equal(result, 'timeout');

    handle.n = 3;
    await p2; // 次の render で resolve する
    assert.equal(document.querySelector('#app div').textContent, '3');
  });
});
