// RicDOM — handle.render_now() 公開 API (v0.3.25〜)
//
// _internal.force_render と等価だが、正規 API として handle.render_now() で呼べる。
// _internal.force_render は後方互換のため残置。

'use strict';

const { test, describe, beforeEach } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

const setup_jsdom = () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
  global.window      = dom.window;
  global.document    = dom.window.document;
  global.Node        = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = (cb) => setImmediate(cb);
};

const flush = (ms = 10) => new Promise((r) => setTimeout(r, ms));

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
