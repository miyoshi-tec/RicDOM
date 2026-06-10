// RicDOM — FORCE_REAPPLY_DOM_KEYS (v0.3.24〜)
//
// 検証範囲:
//   ユーザー操作で DOM 側が drift しうる prop は、VDOM の prev=next equality に
//   関係なく毎 render で DOM に再代入されること。
//
// 報告元: TrendGuard (v0.3.23 まで bug)
//   controlled な <input type=checkbox> で、ユーザーが click して checked=false に
//   した後、state.checked が true のまま再 render しても DOM が true に戻らない。
//
// 対象 prop: value / checked / selected / scrollTop / scrollLeft

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
  return dom;
};

const flush = (ms = 10) => new Promise((r) => setTimeout(r, ms));

describe('FORCE_REAPPLY_DOM_KEYS: ユーザー操作で drift した DOM を state で上書き直す', () => {

  beforeEach(setup_jsdom);

  test('checkbox: user が DOM 直接 uncheck しても、再 render で state の checked が DOM に戻る', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      checked: true,
      tick: 0,
      render: (s) => ({ tag: 'input', type: 'checkbox', id: 'cb', checked: s.checked }),
    });

    await flush();
    const cb = document.getElementById('cb');
    assert.equal(cb.checked, true, '初期描画で checked=true');

    // user clicks → DOM が独自に false に drift
    cb.checked = false;
    assert.equal(cb.checked, false, 'user 操作後の DOM は false');

    // state.checked は true のまま、別 prop だけ変えて再 render
    handle.tick++;
    await flush();

    // 期待: DOM が state に同期して true に戻っている
    // bug 時は false のまま (= 「prev VDOM checked=true == next VDOM checked=true なので skip」)
    assert.equal(cb.checked, true,
      '再 render で state.checked=true が DOM に再適用される (drift 解消)');
  });

  test('text input: user が DOM 直接編集しても、再 render で state.value が DOM に戻る', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      value: 'hello',
      tick: 0,
      render: (s) => ({ tag: 'input', type: 'text', id: 'inp', value: s.value }),
    });

    await flush();
    const inp = document.getElementById('inp');
    assert.equal(inp.value, 'hello', '初期描画で value=hello');

    // user types → DOM が独自に変化
    inp.value = 'user typed';
    assert.equal(inp.value, 'user typed');

    // state.value は 'hello' のまま再 render
    handle.tick++;
    await flush();

    assert.equal(inp.value, 'hello',
      '再 render で state.value が DOM に再適用される');
  });

  test('select option selected: user が選択変更しても、再 render で state.selected が DOM に戻る', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      sel: 'b',
      tick: 0,
      render: (s) => ({
        tag: 'select', id: 'sel', value: s.sel, ctx: [
          { tag: 'option', value: 'a', selected: s.sel === 'a', ctx: ['A'] },
          { tag: 'option', value: 'b', selected: s.sel === 'b', ctx: ['B'] },
          { tag: 'option', value: 'c', selected: s.sel === 'c', ctx: ['C'] },
        ],
      }),
    });

    await flush();
    const sel = document.getElementById('sel');
    assert.equal(sel.value, 'b', '初期描画で b 選択');

    // user 操作で c に変わったとする
    sel.value = 'c';
    assert.equal(sel.value, 'c');

    // state.sel は 'b' のまま再 render
    handle.tick++;
    await flush();

    assert.equal(sel.value, 'b',
      '再 render で state.sel=b が DOM に戻る (select の value も FORCE_REAPPLY)');
  });

  test('scrollTop: user スクロール後でも、再 render で state.scrollTop が DOM に戻る', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      top: 100,
      tick: 0,
      render: (s) => ({
        tag: 'div', id: 'sc', scrollTop: s.top,
        style: { height: '200px', overflow: 'auto' },
        ctx: [{ tag: 'div', style: { height: '2000px' }, ctx: ['scrollable'] }],
      }),
    });

    await flush();
    const sc = document.getElementById('sc');

    // jsdom は layout 計算しないので scrollTop の保存だけテスト (取得は別物)
    // user が直接 scrollTop を変えたと仮定
    sc.scrollTop = 50;
    // state.top は 100 のまま再 render
    handle.tick++;
    await flush();

    // scrollTop が再代入されたことを確認 (jsdom では実値は layout 依存だが、
    // setter は呼ばれている。代理として「prev_extra と equality でも代入が走る」
    // ことを ensure するため、value 系と同じ FORCE 経路を通る)
    // ここでは scrollTop が再 set されていれば 100 (jsdom が layout 計算しないので
    // 値は保存される)
    assert.equal(sc.scrollTop, 100,
      '再 render で state.top=100 が DOM に再適用される');
  });

  test('disabled: FORCE_REAPPLY 対象外の prop も再 render を跨いで壊れない', async () => {
    // disabled は FORCE_REAPPLY_DOM_KEYS に入っていない (user 操作で drift しないため
    // equality check で skip される)。setter 回数を spy すると jsdom の prototype 改変が
    // 他テストへ漏れるため、ここでは「何度再 render しても値が維持される」ことだけ確認する。
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      tick: 0,
      render: (s) => {
        void s.tick;
        return { tag: 'button', id: 'b', disabled: true, ctx: ['x'] };
      },
    });

    await flush();
    const b = document.getElementById('b');
    assert.equal(b.disabled, true);

    for (let i = 0; i < 5; i++) {
      handle.tick++;
      await flush();
    }
    assert.equal(b.disabled, true, 'disabled は equality check で skip されても問題なし');
  });
});
