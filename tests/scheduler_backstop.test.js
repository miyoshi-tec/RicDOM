'use strict';

// create_render_scheduler の setTimeout バックストップ回帰テスト（v0.3.36〜）
//
// 背景: 旧実装は render_scheduled フラグの解除が rAF コールバック内の 1 本道
// だった。rAF が発火しない環境（hidden タブ・kiosk の全画面遷移直後・Electron
// の backgroundThrottling 等）では、一度 schedule された時点でフラグが永久に
// 立ちっぱなしになり、以降の state 変更で再描画が二度と走らなくなる silent
// failure があった（Unizon kiosk consumer 報告）。
//
// このファイルは tests/_helpers/jsdom_env.js を使わない。jsdom_env の
// setup_jsdom() は常に requestAnimationFrame を setImmediate shim に固定して
// おり、「rAF が永久に発火しない環境」を作れないため、このファイル専用で
// rAF を直接制御する。

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

// jsdom + 指定した rAF 実装で global をセットアップする。
// raf_impl: requestAnimationFrame に割り当てる関数。
//   () => {}                  … 何もしない＝永久に発火しない rAF（本丸の再現条件）
//   (cb) => setImmediate(cb)  … 健常な rAF（setTimeout(cb,0) は Node v24 で稀に
//                                starve するため setImmediate を使う。jsdom_env.js と同じ理由）
const setup = (raf_impl) => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
  global.window      = dom.window;
  global.document    = dom.window.document;
  global.Node        = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = raf_impl;
  return dom;
};

const cleanup_globals = () => {
  delete global.window;
  delete global.document;
  delete global.Node;
  delete global.HTMLElement;
  delete global.requestAnimationFrame;
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('create_render_scheduler: setTimeout バックストップ (v0.3.36〜)', () => {

  afterEach(cleanup_globals);

  test('本丸: rAF が永久に発火しない環境でも、バックストップで再描画される', async () => {
    setup(() => {}); // rAF は何もしない＝永久に発火しない

    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', ctx: [String(s.n)] }),
    });

    // 初回描画は target 解決後に同期実行されるため、この時点で既に n=1 が出ている
    assert.equal(document.querySelector('#app div').textContent, '1');

    handle.n = 2; // schedule_render → rAF (発火しない) + setTimeout backstop(200ms)

    // rAF が発火しないので、rAF だけに頼っていれば DOM は更新されないはず。
    // バックストップ(200ms)より少し長く待って確認する。
    await wait(250);

    assert.equal(
      document.querySelector('#app div').textContent, '2',
      'rAF が飛んでも setTimeout バックストップが再描画するはず',
    );
  });

  test('永久停止しない: バックストップ経由の描画後も、次の state 変更で再度描画される', async () => {
    setup(() => {}); // rAF は永久に発火しない

    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', ctx: [String(s.n)] }),
    });

    handle.n = 2;
    await wait(250);
    assert.equal(document.querySelector('#app div').textContent, '2', '1 回目のバックストップ描画');

    // フラグが wedge していれば、ここから先は二度と再描画されないはず。
    handle.n = 3;
    await wait(250);
    assert.equal(
      document.querySelector('#app div').textContent, '3',
      '2 回目の state 変更でもバックストップが再度効くはず（フラグが永久停止していない）',
    );
  });

  test('二重描画しない: rAF が健常なら、バックストップは発火しない', async () => {
    setup((cb) => setImmediate(cb)); // 健常な rAF (jsdom_env.js と同じ shim)

    const { create_RicDOM } = require('../src/ricdom');
    let render_count = 0;
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => { render_count++; return { tag: 'div', ctx: [String(s.n)] }; },
    });

    const after_init = render_count; // 初回描画分（同期）

    handle.n = 2; // schedule_render → rAF (setImmediate、ほぼ即発火) + backstop(200ms)

    // rAF はほぼ即発火して backstop を clearTimeout するはず。
    // backstop の 200ms を越えて十分待ってから、増分がちょうど 1 であることを確認する。
    await wait(350);

    assert.equal(
      render_count, after_init + 1,
      'rAF が健常なら描画は 1 回だけ（バックストップは clearTimeout されて発火しない）',
    );
  });

  test('render_now との整合: 即時描画後にバックストップが発火しても二重描画にならない', async () => {
    setup(() => {}); // rAF は永久に発火しない

    const { create_RicDOM } = require('../src/ricdom');
    let render_count = 0;
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => { render_count++; return { tag: 'div', ctx: [String(s.n)] }; },
    });

    const after_init = render_count;

    handle.n = 2; // schedule_render → rAF (発火しない) + backstop(200ms) が保留状態になる
    handle.render_now(); // 保留中の rAF/backstop を cancel_pending() で解除し、即時描画

    assert.equal(render_count, after_init + 1, 'render_now で同期的に 1 回描画される');

    // 保留していたはずの backstop(200ms) が万一まだ生きていた場合、ここで二重描画が起きる。
    await wait(250);

    assert.equal(
      render_count, after_init + 1,
      'render_now 後にバックストップが発火しても二重描画にならない',
    );
  });

  test('next_render との整合: rAF が飛んでも、バックストップ経由の描画で resolve する', async () => {
    setup(() => {}); // rAF は永久に発火しない

    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', ctx: [String(s.n)] }),
    });

    handle.n = 2;
    await handle.next_render(); // バックストップ(200ms)経由で resolve するはず（タイムアウトしない）

    assert.equal(document.querySelector('#app div').textContent, '2');
  });
});
