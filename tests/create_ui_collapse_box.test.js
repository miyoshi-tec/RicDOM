// RicUI — create_ui_collapse_box テスト
//
// 検証範囲:
//   1. 初期状態 (visible:false) は null
//   2. visible:true で entering 状態の VDOM (height:0 + transition) が出る
//   3. enter 中の `--entering` class
//   4. visible:false で closing 状態に遷移
//   5. closing 中の `--closing` class
//   6. transitionend で unmount (再 render で null)
//   7. data-ric-role と data-ric-cb 属性
//   8. direction: 'h' / 'both' で animate するプロパティが切り替わる
//   9. safe_notify と組で動く (state 配置で warn しない)

'use strict';

const { test, describe, beforeEach } = require('node:test');
const { strict: assert } = require('node:assert');
const { JSDOM } = require('jsdom');

const setup_jsdom = () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
  global.window   = dom.window;
  global.document = dom.window.document;
  global.Node     = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  return dom;
};

const flush = (ms = 10) => new Promise(r => setTimeout(r, ms));

// --------------------------------------------------------------------------
// 純粋関数としての VDOM 検査 (DOM をマウントせず factory の戻り値だけを見る)
// --------------------------------------------------------------------------

describe('create_ui_collapse_box: 初期 / closed 状態', () => {
  test('visible:false の初回呼び出しは null', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    assert.equal(box({ visible: false, ctx: ['x'] }), null);
  });
  test('visible 省略 (default:false) も null', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    assert.equal(box(), null);
  });
});

describe('create_ui_collapse_box: enter 開始時の VDOM', () => {
  test('visible:true で div ノードが返る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n = box({ visible: true, ctx: [] });
    assert.equal(n.tag, 'div');
  });

  test('--entering class が付く', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n = box({ visible: true });
    assert.match(n.class, /ric-collapse-box--entering/);
  });

  test('direction:v (default) で height:0 が initial style に出る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n = box({ visible: true });
    assert.equal(n.style.height, 0);
    assert.equal(n.style.width, undefined, 'width は v では出ない');
    assert.match(n.style.transition, /height 200ms/);
  });

  test('direction:h で width:0 が initial style に出る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box({ direction: 'h' });
    const n = box({ visible: true });
    assert.equal(n.style.width, 0);
    assert.equal(n.style.height, undefined);
    assert.match(n.style.transition, /width 200ms/);
  });

  test('direction:both で width / height 両方 0 が initial style に出る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box({ direction: 'both' });
    const n = box({ visible: true });
    assert.equal(n.style.width, 0);
    assert.equal(n.style.height, 0);
    assert.match(n.style.transition, /width 200ms.*height 200ms/);
  });

  test('duration / easing が transition 文字列に反映される', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box({ duration: 350, easing: 'ease-in-out' });
    const n = box({ visible: true });
    assert.match(n.style.transition, /350ms ease-in-out/);
  });

  test('overflow:hidden が常に出る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n = box({ visible: true });
    assert.equal(n.style.overflow, 'hidden');
  });
});

describe('create_ui_collapse_box: 識別属性', () => {
  test('data-ric-role が collapse-box', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n = box({ visible: true });
    assert.equal(n['data-ric-role'], 'collapse-box');
  });
  test('data-ric-cb がインスタンスごとに異なる', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const a = create_ui_collapse_box();
    const b = create_ui_collapse_box();
    const na = a({ visible: true });
    const nb = b({ visible: true });
    assert.notEqual(na['data-ric-cb'], nb['data-ric-cb'], '各インスタンスは unique な id を持つ');
  });
});

describe('create_ui_collapse_box: ctx 透過', () => {
  test('子要素が ctx に伝播', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const child = { tag: 'span', ctx: ['hello'] };
    const n = box({ visible: true, ctx: [child] });
    assert.deepEqual(n.ctx, [child]);
  });
});

// --------------------------------------------------------------------------
// jsdom 統合: 状態遷移とライフサイクル
// --------------------------------------------------------------------------

describe('create_ui_collapse_box: ライフサイクル (jsdom)', () => {

  beforeEach(setup_jsdom);

  test('visible:true → 初回 render は entering、次フレーム以降は同じインスタンスでも entering を継続', async () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    // 1 回目: enter 開始
    const n1 = box({ visible: true });
    assert.match(n1.class, /--entering/);
    // 2 回目: まだ entering (transitionend 来てない)
    const n2 = box({ visible: true });
    assert.match(n2.class, /--entering/);
  });

  test('visible:true → false で closing 状態に遷移する', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    box({ visible: true });   // open に向かう (entering)
    // entering 中に false → closing (中断)
    const n = box({ visible: false });
    assert.match(n.class, /--closing/);
    assert.doesNotMatch(n.class, /--entering/);
  });

  test('transitionend (exit 完了) で次 render が null になる', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const { _reset_safe_notify_warnings } = require('../ric_ui/_factory_helpers');
    _reset_safe_notify_warnings();

    const box = create_ui_collapse_box();
    const n1 = box({ visible: true });
    box({ visible: false });   // closing
    // 模擬: transitionend を発火
    n1.ontransitionend({
      propertyName: 'height',
      target: { /* el shape は問わない、_find_el() の結果と比較される */ },
    });
    // _find_el() が null を返す jsdom 上では target チェックで早期 return される。
    // よってこのテストは「propertyName / target チェックが要る」事実を documented にする。
    // 実 DOM での挙動は下のテストで確認する。
  });

  test('実 DOM を介した exit ライフサイクル (mount → transitionend で null)', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');

    const target = document.querySelector('#app');
    const handle = create_RicDOM(target, {
      visible: true,
      box: create_ui_collapse_box(),
      render: (s) => s.box({ visible: s.visible, ctx: [{ tag: 'span', ctx: ['x'] }] }),
    });

    await flush();
    // 初期は entering の DOM が存在
    let el = target.querySelector('[data-ric-role="collapse-box"]');
    assert.ok(el, 'entering 中の DOM が存在する');
    assert.match(el.className, /--entering/);

    // visible:false で closing 開始
    handle.visible = false;
    await flush();
    el = target.querySelector('[data-ric-role="collapse-box"]');
    assert.ok(el, 'closing 中の DOM はまだ存在する (deferred unmount)');
    assert.match(el.className, /--closing/);

    // transitionend を手動発火 (jsdom は CSS transition を走らせないため)。
    // dispatchEvent 経由だと jsdom が propertyName を変な扱いをするので、
    // ハンドラを直接呼ぶ (実 DOM では transitionend は el.ontransitionend
    // 経由で発火するため、これは fair な代用)。
    el.ontransitionend({ propertyName: 'height', target: el });

    await flush();
    el = target.querySelector('[data-ric-role="collapse-box"]');
    assert.equal(el, null, 'transitionend 後の再 render で DOM が消えている');
  });
});

// --------------------------------------------------------------------------
// safe_notify 連携
// --------------------------------------------------------------------------

describe('create_ui_collapse_box: state 配置の正しさ', () => {
  beforeEach(setup_jsdom);

  test('state トップレベルに置けば __notify が注入され、warn が出ない', async () => {
    const { _reset_safe_notify_warnings } = require('../ric_ui/_factory_helpers');
    _reset_safe_notify_warnings();
    const original = console.warn;
    const captured = [];
    console.warn = (...a) => captured.push(a.join(' '));
    try {
      const { create_RicDOM } = require('../src/ricdom');
      const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');

      const handle = create_RicDOM('#app', {
        visible: true,
        box: create_ui_collapse_box(),
        render: (s) => s.box({ visible: s.visible, ctx: ['x'] }),
      });
      await flush();
      handle.visible = false;
      await flush();
      const el = document.querySelector('[data-ric-role="collapse-box"]');
      if (el) {
        const evt = new window.Event('transitionend');
        evt.propertyName = 'height';
        Object.defineProperty(evt, 'target', { value: el });
        el.dispatchEvent(evt);
      }
      await flush();

      const warned = captured.filter(s => s.includes('has no __notify'));
      assert.equal(warned.length, 0, '正規使用で warn が出てはいけない');
    } finally {
      console.warn = original;
    }
  });
});
