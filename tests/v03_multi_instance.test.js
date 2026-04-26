// multi-instance テスト
// 複数 create_RicDOM が shared state を通じて同期し、各 instance が
// 独立した render を持てることを確認する。
//
// Contributed by an external user running a production engineering tool.

'use strict';

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

const setup_jsdom = () => {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="a"></div><div id="b"></div>' +
    '</body></html>');
  global.window   = dom.window;
  global.document = dom.window.document;
  global.Node     = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  return dom;
};
const flush = () => new Promise(r => setTimeout(r, 10));

// =====================================================================
// 共有 state + 独立 render（2 引数 form + handle.render）
// =====================================================================

test('複数 instance が同じ state を共有、各自の render で描画', async () => {
  setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { counter: 0 };
  let a_count = 0, b_count = 0;

  const a = create_RicDOM('#a', state);
  const b = create_RicDOM('#b', state);
  a.render = (s) => { a_count++; return { tag: 'span', ctx: [`A:${s.counter}`] }; };
  b.render = (s) => { b_count++; return { tag: 'span', ctx: [`B:${s.counter}`] }; };

  await flush();
  assert.equal(a_count, 1);
  assert.equal(b_count, 1);
  assert.equal(document.querySelector('#a').textContent, 'A:0');
  assert.equal(document.querySelector('#b').textContent, 'B:0');
});

test('shared state mutation: すべての instance が再描画される', async () => {
  setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { counter: 0 };
  let a_count = 0, b_count = 0;

  const a = create_RicDOM('#a', state);
  const b = create_RicDOM('#b', state);
  a.render = (s) => { a_count++; return { tag: 'span', ctx: [`A:${s.counter}`] }; };
  b.render = (s) => { b_count++; return { tag: 'span', ctx: [`B:${s.counter}`] }; };
  await flush();

  a.counter = 7;
  await flush();
  assert.equal(a_count, 2);
  assert.equal(b_count, 2);
  assert.equal(document.querySelector('#a').textContent, 'A:7');
  assert.equal(document.querySelector('#b').textContent, 'B:7');
});

// =====================================================================
// handle.render の per-instance 挙動（修正前は fail）
// =====================================================================

test('handle.render = fn は per-instance で動作する（修正前は fail）', async () => {
  setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { value: 'init' };
  const a = create_RicDOM('#a', state);
  const b = create_RicDOM('#b', state);

  a.render = (s) => ({ tag: 'span', ctx: [`A=${s.value}`] });
  b.render = (s) => ({ tag: 'span', ctx: [`B=${s.value}`] });
  await flush();

  // 修正前: b.render が a の _render_fn を上書き、#a に B=init、#b 空
  // 修正後: 各 instance が独立した render を持つ
  assert.equal(document.querySelector('#a').textContent, 'A=init',
    'a must render with A=…');
  assert.equal(document.querySelector('#b').textContent, 'B=init',
    'b must render with B=…');
});

test('handle.render の per-instance 挙動: state 変更で各自の render が再実行', async () => {
  setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { value: 'x' };
  const a = create_RicDOM('#a', state);
  const b = create_RicDOM('#b', state);
  a.render = (s) => ({ tag: 'span', ctx: [`A=${s.value}`] });
  b.render = (s) => ({ tag: 'span', ctx: [`B=${s.value}`] });
  await flush();

  a.value = 'y';
  await flush();
  assert.equal(document.querySelector('#a').textContent, 'A=y');
  assert.equal(document.querySelector('#b').textContent, 'B=y');
});

// =====================================================================
// Parent-child mount: 親の re-render が child の DOM を壊さない
// =====================================================================

test('親 render の ref mount は child の DOM を保持する', async () => {
  setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { parent_val: 'p0', child_val: 'c0' };

  const parent = create_RicDOM('#a', {
    ...state,   // shared ではない独立 state（ここだけ親用）
    render: (s) => ({
      tag: 'div', ctx: [
        { tag: 'span', ctx: [`parent=${s.parent_val}`] },
        { tag: 'div',  ref: 'child_mount' },   // ctx 省略 → child が保持される
        { tag: 'span', ctx: ['footer'] },
      ]
    }),
  });

  await flush();
  const mount = parent.refs.get('child_mount');
  assert.ok(mount, 'child_mount ref must resolve');

  // child は shared state を使いたいので、親の raw_state と共有する
  // ただし親の state ... spread ではコピーされるだけ。shared するには同じ raw_state を渡す必要。
  // 簡便のため、ここでは別 state で動作確認（親 re-render で child が消えないことが主題）
  const child = create_RicDOM(mount, { child_val: 'c0',
    render: (s) => ({ tag: 'span', ctx: [`child=${s.child_val}`] }),
  });

  await flush();
  const html_initial = document.querySelector('#a').innerHTML;
  assert.match(html_initial, /parent=p0/);
  assert.match(html_initial, /child=c0/);

  parent.parent_val = 'p1';
  await flush();
  const html_after = document.querySelector('#a').innerHTML;
  assert.match(html_after, /parent=p1/);
  assert.match(html_after, /child=c0/,
    'child DOM must be preserved across parent re-renders');
});
