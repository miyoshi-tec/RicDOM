// DOM スナップショットテスト
// jsdom で create_RicDOM を動かし、生成された innerHTML を確認する

'use strict';

process.env.NODE_ENV = 'test';

const { test, before } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

// jsdom 環境をセットアップする（ricdom.js は window / document を前提とする）
const setup_jsdom = () => {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>');
  global.window   = dom.window;
  global.document = dom.window.document;
  global.Node     = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0); // rAF をポーリングで代替
  return dom;
};

// rAF（setTimeout(0)）が実行されるまで待つ
const flush_raf = () => new Promise(resolve => setTimeout(resolve, 10));

// =====================================================================
// 初回描画（フルビルド）
// =====================================================================

test('シンプルな div が正しく描画される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { count: 0 };
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [ `カウント: ${s.count}` ],
  })});

  // 初回は同期描画
  assert.ok(target.innerHTML.includes('カウント: 0'), `innerHTML="${target.innerHTML}"`);
});

test('span に class と style が適用される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = {};
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: _s => ({
    tag: 'span', class: 'my-label',
    ctx: [ 'テスト' ],
    style: { color: 'red' },
  })});

  const el = target.querySelector('.my-label');
  assert.ok(el, 'my-label クラスの要素が存在する');
  assert.equal(el.tagName.toLowerCase(), 'span');
  assert.equal(el.style.color, 'red');
  assert.equal(el.textContent, 'テスト');
});

test('button に id と複数クラスが適用される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = {};
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: _s => ({
    tag: 'button', id: 'ok-btn', class: 'ric-button ric-button--primary',
    ctx: [ 'OK' ],
  })});

  const el = target.querySelector('#ok-btn');
  assert.ok(el, 'id=ok-btn の要素が存在する');
  assert.ok(el.classList.contains('ric-button'),           'ric-button クラスが付いている');
  assert.ok(el.classList.contains('ric-button--primary'),  'ric-button--primary クラスが付いている');
});

// =====================================================================
// 差分更新（reconciliation）
// =====================================================================

test('state 変更後にテキストが更新される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { count: 0 };
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [ `カウント: ${s.count}` ],
  })});

  // 初回描画確認
  assert.ok(target.textContent.includes('カウント: 0'));

  // state を更新して rAF を待つ
  panel.count = 5;
  await flush_raf();

  assert.ok(target.textContent.includes('カウント: 5'), `textContent="${target.textContent}"`);
});

test('input に value と type が設定される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { text: 'hello' };
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: s => ({
    tag: 'input',
    type:  'text',
    value: s.text,
  })});

  const input_el = target.querySelector('input');
  assert.ok(input_el, 'input 要素が存在する');
  assert.equal(input_el.value, 'hello');
  assert.equal(input_el.type, 'text');
});

test('null 要素は描画されない', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { show: false };
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [
      '常に表示',
      s.show ? { tag: 'span', ctx: ['オプション'] } : null,
    ],
  })});

  assert.ok(!target.querySelector('span'), 'show=false では span が存在しない');
  assert.ok(target.textContent.includes('常に表示'));
});

test('state 変更で要素が出現する', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { show: false };
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [
      { tag: 'div', ctx: ['ラベル'] },
      s.show ? { tag: 'span', ctx: ['出現'] } : null,
    ],
  })});

  assert.ok(!target.querySelector('span'), '初期は span なし');

  panel.show = true;
  await flush_raf();

  assert.ok(target.querySelector('span'), 'show=true 後は span が存在する');
  assert.equal(target.querySelector('span').textContent, '出現');
});

// =====================================================================
// input フォーカス問題（シリアルキー修正の回帰テスト）
// =====================================================================

test('同層に div が複数ある状態遷移で input が再生成されない', async () => {
  // 修正前は innerHTML = '' で input が破棄されていたバグの回帰テスト
  // シリアルキー方式（div@0 / div@1）でノードを再利用するようにした修正の検証
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state2 = { name: '' };
  const target2 = dom.window.document.querySelector('#app');

  const panel2 = create_RicDOM(target2, { ...state2, render: s => ({
    tag: 'div', ctx: [
      { tag: 'div', ctx: ['お名前'] },
      { tag: 'input', type: 'text', value: s.name },
      s.name ? { tag: 'div', ctx: [`こんにちは、${s.name}さん`] } : null,
    ],
  })});

  // 初回：input が存在する
  const input_first = target2.querySelector('input');
  assert.ok(input_first, '初期状態で input が存在する');

  // state.name を変更（挨拶 div が追加される → 同層に div が2個）
  panel2.name = 'やまざき';
  await flush_raf();

  const input_after = target2.querySelector('input');
  assert.ok(input_after, '再描画後も input が存在する');

  // input が同一 DOM ノードかどうか（再生成されていないか）
  // 修正前は innerHTML='' → input が破棄されて別ノードになっていた
  assert.strictEqual(input_first, input_after,
    'シリアルキー修正後は input ノードを再利用するため同一参照になる');

  // 挨拶テキストが表示されている
  assert.ok(target2.textContent.includes('こんにちは、やまざきさん'));
});

// =====================================================================
// ref システム
// =====================================================================

test('ref を付けた要素が panel.refs.get() で取得できる', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = {};
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: _s => ({
    tag: 'div', ctx: [
      { tag: 'input', type: 'text', ref: 'name-input' },
      { tag: 'div', ctx: ['ラベル'] },
    ],
  })});

  const ref_el = panel.refs.get('name-input');
  assert.ok(ref_el, 'refs.get("name-input") が DOM ノードを返す');
  assert.equal(ref_el.tagName.toLowerCase(), 'input');
  // ref は id 属性としては出力されない
  assert.equal(ref_el.id, '');
  // data-ric-ref 属性が設定されている
  assert.equal(ref_el.dataset.ricRef, 'name-input');
});

test('ref は DOM に id 属性として出力されない', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = {};
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: _s => ({
    tag: 'div',
    ctx: [ '内容' ],
    ref: 'my-div',
  })});

  // id 属性は付かない（ref と id は別物）
  const by_id = dom.window.document.getElementById('my-div');
  assert.equal(by_id, null, 'ref 名では getElementById で取得できない');

  // data-ric-ref は付いている
  const by_ref = target.querySelector('[data-ric-ref="my-div"]');
  assert.ok(by_ref, '[data-ric-ref="my-div"] 要素が存在する');
});

test('ref が動的に変化しても refs.get() が追従する', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { mode: 'a' };
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [
      // mode に応じて別々の要素に ref を付ける
      s.mode === 'a'
        ? { tag: 'span', ctx: ['A'], ref: 'active-el' }
        : { tag: 'button', ctx: ['B'], ref: 'active-el' },
    ],
  })});

  const ref_a = panel.refs.get('active-el');
  assert.equal(ref_a.tagName.toLowerCase(), 'span', '初期は span が active-el');

  // mode を変える（ref は同じ名前だが別ノードに付く）
  panel.mode = 'b';
  await flush_raf();

  const ref_b = panel.refs.get('active-el');
  assert.equal(ref_b.tagName.toLowerCase(), 'button', '変更後は button が active-el');
  assert.notStrictEqual(ref_a, ref_b, '異なるノードに切り替わっている');
});

// =====================================================================
// 非表示値
// =====================================================================

test('false / undefined は描画されない', async () => {
  const dom = setup_jsdom();
  global.document = dom.window.document;
  global.window   = dom.window;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  const { create_RicDOM } = require('../src/ricdom');

  const state = {};
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: _s => ({
    tag: 'div', ctx: [
      'テキスト',
      false,
      undefined,
    ],
  })});

  assert.equal(target.textContent, 'テキスト');
});

// =====================================================================
// 複数 ref の共存
// =====================================================================

test('複数の ref が同一パネルに共存できる', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = {};
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: _s => ({
    tag: 'div', ctx: [
      { tag: 'input',    type: 'text', ref: 'title-input' },
      { tag: 'textarea', ref: 'body-input' },
      { tag: 'button',   ctx: ['送信'], ref: 'submit-btn' },
    ],
  })});

  const title_el = panel.refs.get('title-input');
  const body_el  = panel.refs.get('body-input');
  const btn_el   = panel.refs.get('submit-btn');

  assert.ok(title_el, 'title-input ref が存在する');
  assert.ok(body_el,  'body-input ref が存在する');
  assert.ok(btn_el,   'submit-btn ref が存在する');
  assert.equal(title_el.tagName.toLowerCase(), 'input',    'title-input は input 要素');
  assert.equal(body_el.tagName.toLowerCase(),  'textarea', 'body-input は textarea 要素');
  assert.equal(btn_el.tagName.toLowerCase(),   'button',   'submit-btn は button 要素');
  // 3つのノードがすべて別々の DOM ノードを指している
  assert.notStrictEqual(title_el, body_el);
  assert.notStrictEqual(body_el,  btn_el);
});

// =====================================================================
// destroy()
// =====================================================================

test('destroy() 後は state を変更しても再描画されない', async () => {
  // destroy() が subscribers.delete(schedule_render) を正しく呼んでいることの確認
  // 購読が解除されていれば rAF が積まれず DOM は更新されない
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { count: 0 };
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [ `${s.count}` ],
  })});

  assert.ok(target.textContent.includes('0'), '初期描画: 0');

  panel._internal.destroy();

  // destroy 後に state を変更する（raw_state は変わるが re-render はスキップされる）
  panel.count = 99;
  await flush_raf();

  assert.ok(target.textContent.includes('0'),  '再描画されずに 0 のまま');
  assert.ok(!target.textContent.includes('99'), '99 は表示されない');
});

test('destroy() 後は refs が空になる', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = {};
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: _s => ({
    tag: 'div', ctx: [ { tag: 'input', ref: 'my-input' } ],
  })});

  assert.ok(panel.refs.get('my-input'), 'destroy 前は ref が取得できる');

  panel._internal.destroy();

  // destroy() 内で refs_map.clear() が呼ばれるため undefined になる
  assert.equal(panel.refs.get('my-input'), undefined, 'destroy 後は refs が空');
});

test('destroy() 後に force_render() を呼んでも no-op', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { count: 0 };
  const target = dom.window.document.querySelector('#app');

  const panel = create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [ `${s.count}` ],
  })});

  // 一度描画させる
  panel.count = 5;
  await flush_raf();
  assert.ok(target.textContent.includes('5'), '変更後 5');

  panel._internal.destroy();

  // force_render() を呼んでもエラーなし・DOM 変化なし
  panel._internal.force_render();
  assert.ok(target.textContent.includes('5'), 'destroy 後の force_render は no-op');
});

// =====================================================================
// shared state（複数インスタンスで state を共有）
// =====================================================================

test('shared state：片方のハンドルを変更すると両方のインスタンスが再描画される', async () => {
  // コア機能：同じ raw state を渡した2インスタンスは常に同期して再描画される
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const shared = { count: 0 };
  // 独立した2つのターゲットを用意する
  const target_a = dom.window.document.createElement('div');
  const target_b = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(target_a);
  dom.window.document.body.appendChild(target_b);

  shared.render = s => ({ tag: 'div', ctx: [`A:${s.count}`] });
  const panel_a = create_RicDOM(target_a, shared);
  shared.render = s => ({ tag: 'div', ctx: [`B:${s.count}`] });
  /* panel_b = */ create_RicDOM(target_b, shared);

  assert.ok(target_a.textContent.includes('A:0'), `初期 A: "${target_a.textContent}"`);
  assert.ok(target_b.textContent.includes('B:0'), `初期 B: "${target_b.textContent}"`);

  // panel_a のハンドルから count を変更する → 両方が再描画されるはず
  panel_a.count = 5;
  await flush_raf();

  assert.ok(target_a.textContent.includes('A:5'), `変更後 A: "${target_a.textContent}"`);
  assert.ok(target_b.textContent.includes('B:5'), `変更後 B: "${target_b.textContent}"`);
});

test('shared state：一方を destroy() しても他方は引き続き動作する', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const shared = { count: 0 };
  const target_a = dom.window.document.createElement('div');
  const target_b = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(target_a);
  dom.window.document.body.appendChild(target_b);

  shared.render = s => ({ tag: 'div', ctx: [`A:${s.count}`] });
  const panel_a = create_RicDOM(target_a, shared);
  shared.render = s => ({ tag: 'div', ctx: [`B:${s.count}`] });
  const panel_b = create_RicDOM(target_b, shared);

  // panel_a だけ先に破棄する
  panel_a._internal.destroy();

  // panel_b から count を変更する
  panel_b.count = 7;
  await flush_raf();

  // destroy 済みの panel_a は再描画されない
  assert.ok(target_a.textContent.includes('A:0'), `destroy 済みの A は更新されない: "${target_a.textContent}"`);
  // panel_b は引き続き動作する
  assert.ok(target_b.textContent.includes('B:7'), `B は更新される: "${target_b.textContent}"`);
});

test('numeric text 0 -> 1 is reflected on first click', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const state = { count: 0 };
  const target = dom.window.document.querySelector('#app');

  create_RicDOM(target, { ...state, render: s => ({
    tag: 'div', ctx: [
      { tag: 'h2', ctx: ['Counter'] },
      { tag: 'div', ctx: s.count },
      { tag: 'button', ctx: ['+1'], onclick: () => { s.count += 1; } },
    ],
  })});

  const button = target.querySelector('button');
  assert.ok(button, 'button exists');
  assert.ok(target.textContent.includes('0'), `initial textContent="${target.textContent}"`);

  button.onclick();
  await flush_raf();

  assert.ok(target.textContent.includes('1'), `after first click textContent="${target.textContent}"`);
});

// =====================================================================
// s.render による描画関数の後設定
// =====================================================================

test('render_fn 省略で create_RicDOM が正常に返る（NOOP_PROXY にならない）', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { count: 0 });

  // NOOP_PROXY ではなく Proxy が返る（count にアクセスできる）
  assert.equal(s.count, 0, 'state にアクセスできる');

  // 初回描画はスキップされる（render_fn が空関数のため）
  assert.equal(target.innerHTML, '', '初回描画はスキップ');
});

test('s.render = fn で描画が実行される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { name: 'world' });

  assert.equal(target.innerHTML, '', '描画前は空');

  // render 関数を後から設定
  s.render = (s) => ({ tag: 'div', ctx: [`Hello, ${s.name}!`] });
  await flush_raf();

  assert.ok(target.textContent.includes('Hello, world!'), `描画された: "${target.textContent}"`);
});

test('s.render 設定後に state 変更で再描画される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { count: 0, ignore: {} });

  s.render = (s) => ({ tag: 'div', ctx: [`count: ${s.count}`] });
  await flush_raf();

  assert.ok(target.textContent.includes('count: 0'), '初回描画');

  s.count = 42;
  await flush_raf();

  assert.ok(target.textContent.includes('count: 42'), `再描画: "${target.textContent}"`);
});

test('新APIの2引数パターン（render内蔵）が動作する', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { msg: 'hello', render: (s) => ({
    tag: 'div', ctx: [s.msg],
  })});

  // 初回は同期描画
  assert.ok(target.textContent.includes('hello'), '初回同期描画');

  s.msg = 'updated';
  await flush_raf();

  assert.ok(target.textContent.includes('updated'), `再描画: "${target.textContent}"`);
});

// =====================================================================
// SVG namespace
// =====================================================================

const SVG_NS = 'http://www.w3.org/2000/svg';

test('SVG: 初回マウントで svg/子孫が SVG namespace で作られる', () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  create_RicDOM(target, { render: () => ({
    tag: 'svg', viewBox: '0 0 100 100',
    ctx: [{ tag: 'circle', cx: 50, cy: 50, r: 40, fill: 'red' }],
  })});

  const svg = target.querySelector('svg');
  const circle = target.querySelector('circle');
  assert.equal(svg.namespaceURI, SVG_NS, 'svg は SVG namespace');
  assert.equal(circle.namespaceURI, SVG_NS, 'circle も SVG namespace を継承');
});

test('SVG: 差分更新で新規追加される子要素も SVG namespace で作られる', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { count: 0, render: (s) => ({
    tag: 'svg', viewBox: '0 0 100 100',
    ctx: s.count === 0
      ? []
      : [{ tag: 'circle', cx: 50, cy: 50, r: 40, fill: 'red' }],
  })});

  // 初回: 子なし
  assert.equal(target.querySelector('circle'), null);

  // 差分更新で circle を追加
  s.count = 1;
  await flush_raf();

  const circle = target.querySelector('circle');
  assert.ok(circle, 'circle が追加される');
  assert.equal(circle.namespaceURI, SVG_NS,
    '差分追加された circle も SVG namespace で生成される');
});

test('SVG: serial key が変わった子要素の置換でも SVG namespace が維持される', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { shape: 'circle', render: (s) => ({
    tag: 'svg', viewBox: '0 0 100 100',
    ctx: [
      s.shape === 'circle'
        ? { tag: 'circle', cx: 50, cy: 50, r: 40, fill: 'red' }
        : { tag: 'rect',   x: 10, y: 10, width: 80, height: 80, fill: 'blue' },
    ],
  })});

  // 初回: circle
  assert.equal(target.querySelector('circle').namespaceURI, SVG_NS);

  // 置換: rect (serial key が違うので replaceChild 経由)
  s.shape = 'rect';
  await flush_raf();

  const rect = target.querySelector('rect');
  assert.ok(rect, 'rect に置換される');
  assert.equal(rect.namespaceURI, SVG_NS,
    '置換された rect も SVG namespace を引き継ぐ');
});

test('SVG: 動的に要素数が変わっても全要素が SVG namespace で作られる', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { n: 1, render: (s) => ({
    tag: 'svg', viewBox: '0 0 100 100',
    ctx: Array.from({ length: s.n }, (_, i) =>
      ({ tag: 'circle', cx: 10 + i * 10, cy: 50, r: 4, fill: 'red' })
    ),
  })});

  // n=3 に増やす
  s.n = 3;
  await flush_raf();

  const circles = target.querySelectorAll('circle');
  assert.equal(circles.length, 3);
  for (const c of circles) {
    assert.equal(c.namespaceURI, SVG_NS);
  }
});

test('SVG: HTML 要素の差分更新は従来通り HTML namespace', async () => {
  const dom = setup_jsdom();
  const { create_RicDOM } = require('../src/ricdom');
  const XHTML_NS = 'http://www.w3.org/1999/xhtml';

  const target = dom.window.document.querySelector('#app');
  const s = create_RicDOM(target, { count: 0, render: (s) => ({
    tag: 'div',
    ctx: s.count === 0 ? [] : [{ tag: 'span', ctx: ['hello'] }],
  })});

  s.count = 1;
  await flush_raf();

  const span = target.querySelector('span');
  assert.ok(span);
  // parent.namespaceURI が XHTML でも、HTML 要素として正しく動作する
  assert.equal(span.namespaceURI, XHTML_NS, 'span は HTML namespace のまま');
});
