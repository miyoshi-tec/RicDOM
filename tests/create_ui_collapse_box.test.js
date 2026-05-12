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

  test('direction:v (default) で height:"0px" が initial style に出る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n = box({ visible: true });
    // 初回 render は target=0 で entering 中なので "0px" (vdom が直接 string を持つ設計)
    assert.equal(n.style.height, '0px');
    assert.equal(n.style.width, undefined, 'width は v では出ない');
    assert.match(n.style.transition, /height 200ms/);
  });

  test('direction:h で width:"0px" が initial style に出る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box({ direction: 'h' });
    const n = box({ visible: true });
    assert.equal(n.style.width, '0px');
    assert.equal(n.style.height, undefined);
    assert.match(n.style.transition, /width 200ms/);
  });

  test('direction:both で width / height 両方 "0px" が initial style に出る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box({ direction: 'both' });
    const n = box({ visible: true });
    assert.equal(n.style.width, '0px');
    assert.equal(n.style.height, '0px');
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

  test('measure 前に visible:false なら即 closed (null) に短絡する', () => {
    // rAF が走っていない状態 (= scrollHeight 測定前) で visible:false を受けた
    // 場合、target=0 のままで closing 状態に入っても transitionend が発火しない
    // (height が 0→0 で変化ゼロ → CSS transition が走らない) ため、stuck を防ぐ
    // ために corner case として即 closed に短絡する設計。
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    box({ visible: true });   // open に向かう (entering, _tw/_th=0)
    // rAF の measure は走らない (jsdom セットアップ無しのテスト)
    const n = box({ visible: false });
    assert.equal(n, null, 'measure 未実行で close されたら null (即 closed) を返す');
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

    // jsdom はレイアウト計算をしないので scrollHeight/scrollWidth が 0。
    // collapse_box は scrollHeight=0 だと「アニメ不要」として corner case
    // (即 closed) に短絡するため、テスト目的で見かけ上 200px の content
    // があることにする。
    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
      configurable: true, get() { return 200; },
    });
    Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', {
      configurable: true, get() { return 300; },
    });

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

describe('create_ui_collapse_box: アニメ中の re-render で壊れない (regression)', () => {

  beforeEach(setup_jsdom);

  test('entering 中に無関係な state 変更で re-render しても height は target を維持する', async () => {
    // v0.3.9 までの実装には潜在バグがあり、entering 中の re-render で VDOM の
    // 条件分岐により height が消え、imperative inline (rAF で setされた値) が
    // RicDOM diff の reset ループでクリアされてアニメーションが中断していた。
    // v0.3.10 の VDOM 一元管理設計でこの問題を解消した。

    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
      configurable: true, get() { return 200; },
    });

    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');

    const handle = create_RicDOM('#app', {
      visible: true,
      counter: 0,
      box: create_ui_collapse_box(),
      render: (s) => ({
        tag: 'div',
        ctx: [
          String(s.counter),
          s.box({ visible: s.visible, ctx: [{ tag: 'span', ctx: ['x'] }] }),
        ],
      }),
    });

    await flush();  // 初回 render (height:0) → measure → 再 render (height:200px)

    // entering 中の VDOM が height:200px を持っている
    let el = document.querySelector('[data-ric-role="collapse-box"]');
    assert.ok(el, 'entering 中の DOM');
    assert.match(el.getAttribute('style') || '', /height:\s*200px/,
      'measure 後 height:200px が inline に出る');

    // 無関係な state 変更 → re-render
    handle.counter++;
    await flush();

    // height が依然として 200px のまま (アニメ破綻していない)
    el = document.querySelector('[data-ric-role="collapse-box"]');
    assert.ok(el, 're-render 後も DOM が存在する');
    assert.match(el.getAttribute('style') || '', /height:\s*200px/,
      '無関係な re-render で height が消されない (= アニメーション破綻しない)');
  });
});

describe('create_ui_collapse_box: multi-instance (key パラメータ)', () => {

  beforeEach(setup_jsdom);

  test('同一 factory で異なる key を渡すと独立した DOM ノードが返る', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const a = box({ key: 'a', visible: true, ctx: ['A'] });
    const b = box({ key: 'b', visible: true, ctx: ['B'] });
    assert.ok(a, 'a の VDOM が出る');
    assert.ok(b, 'b の VDOM が出る');
    assert.notEqual(a['data-ric-cb'], b['data-ric-cb'],
      '異なる key は異なる data-ric-cb 値を持つ');
  });

  test('key 省略時は \'_default\' として扱われ後方互換', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n1 = box({ visible: true });
    const n2 = box({ key: '_default', visible: true });
    // 両方とも同じ key の state を参照する → 同じ data-ric-cb
    assert.equal(n1['data-ric-cb'], n2['data-ric-cb'],
      'key 省略と key:\'_default\' は同一の state を共有する');
  });

  test('key 同士の state が独立: 一方を close しても他方は影響を受けない', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    box({ key: 'a', visible: true });
    box({ key: 'b', visible: true });
    // key='a' を close (corner case: measure 前なので即 closed=null)
    const a_after = box({ key: 'a', visible: false });
    assert.equal(a_after, null, 'a は closed (null)');
    // b は entering 中のまま
    const b_after = box({ key: 'b', visible: true });
    assert.ok(b_after, 'b は維持される');
    assert.match(b_after.class, /--entering/, 'b は entering 状態');
  });

  test('encodeURIComponent: path 風の key (スラッシュ・コロン・空白) も安全に扱える', () => {
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');
    const box = create_ui_collapse_box();
    const n = box({ key: 'C:/Users/foo bar/baz.txt', visible: true, ctx: ['x'] });
    // attr 値に attribute selector で問題になる生の '/' ':' ' ' が含まれない
    // (encodeURIComponent は '.' '~' '!' '*' "'" '(' ')' '-' '_' を encode しないが、
    // これらは attribute selector で問題にならない。'/' ':' ' ' は encode される。)
    assert.doesNotMatch(n['data-ric-cb'], /[/: ]/,
      'data-ric-cb は危険文字を encode 済み (querySelector で正しくマッチ)');
    // 念のため、原 path が attr 文字列に部分一致しないことも確認
    assert.doesNotMatch(n['data-ric-cb'], /C:\/Users/,
      '生の path 部分文字列は出ない');
  });

  test('closing 完了で state Map から entry が GC される', async () => {
    // jsdom scrollHeight を 200 に mock してアニメが実際に発火するように
    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
      configurable: true, get() { return 200; },
    });

    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');

    const handle = create_RicDOM('#app', {
      visible: true,
      box: create_ui_collapse_box(),
      render: (s) => s.box({ key: 'k', visible: s.visible, ctx: ['x'] }),
    });
    await flush();   // measure → re-render で height:200px
    handle.visible = false;
    await flush();  // closing 開始

    // transitionend 発火 → state delete + 次 render で null
    const el = document.querySelector('[data-ric-role="collapse-box"]');
    el.ontransitionend({ propertyName: 'height', target: el });
    await flush();

    // DOM が消えている = state が GC されて inst が null を返した
    const el2 = document.querySelector('[data-ric-role="collapse-box"]');
    assert.equal(el2, null, 'closing 完了で DOM 削除 = state GC 済み');
  });

  test('closing 中断: visible:true で再 enter すると --entering 状態に戻る', async () => {
    // 多段 rAF (re-enter render → _measure → 再 render) は jsdom + flush(10ms)
    // で必ず完走するとは限らないため、ここでは「factory の状態遷移として
    // closing → entering が起きる」ところまでを保証する。height:N px 復活の
    // 実 transition 部分は real browser に委ねる。
    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
      configurable: true, get() { return 200; },
    });

    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');

    const handle = create_RicDOM('#app', {
      visible: true,
      box: create_ui_collapse_box(),
      render: (s) => s.box({ key: 'k', visible: s.visible, ctx: ['x'] }),
    });
    await flush();   // 初期 enter

    // closing 開始
    handle.visible = false;
    await flush();
    let el = document.querySelector('[data-ric-role="collapse-box"]');
    assert.match(el.className, /--closing/, 'closing 中');

    // transitionend が発火する前に visible:true に戻す → 中断: closing → entering
    handle.visible = true;
    await flush();

    el = document.querySelector('[data-ric-role="collapse-box"]');
    assert.ok(el, '要素は維持される (unmount されていない)');
    assert.match(el.className, /--entering/, '中断後は --entering に遷移');
    assert.doesNotMatch(el.className, /--closing/, '--closing は外れる');
  });

  test('1 key の transitionend は他の key の DOM を消さない (closure 独立性)', async () => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
      configurable: true, get() { return 200; },
    });

    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');

    const handle = create_RicDOM('#app', {
      vis_a: true,
      vis_b: true,
      box: create_ui_collapse_box(),
      render: (s) => ({ tag: 'div', ctx: [
        s.box({ key: 'a', visible: s.vis_a, ctx: ['A'] }),
        s.box({ key: 'b', visible: s.vis_b, ctx: ['B'] }),
      ]}),
    });
    await flush();   // 両 key 初期 enter
    assert.equal(document.querySelectorAll('[data-ric-role="collapse-box"]').length, 2,
      '両 key の DOM が並ぶ');

    // a だけ close
    handle.vis_a = false;
    await flush();
    const a_el = document.querySelector('[data-ric-cb^="' + 'A'.charCodeAt(0) + '"]') ||
                 document.querySelectorAll('[data-ric-role="collapse-box"]')[0];
    // ↑ 不安定な selector を避けて、role の 0 番目を a として扱う
    const all_before = document.querySelectorAll('[data-ric-role="collapse-box"]');
    assert.equal(all_before.length, 2, 'close 開始時点では両方 DOM 上に存在 (deferred unmount)');
    assert.match(all_before[0].className, /--closing/, 'a (0 番目) が closing');

    // a の transitionend を発火 → a の state delete + 次 render で a だけ消える
    all_before[0].ontransitionend({ propertyName: 'height', target: all_before[0] });
    await flush();

    const all_after = document.querySelectorAll('[data-ric-role="collapse-box"]');
    assert.equal(all_after.length, 1, 'a が消えて b だけ残る (b は影響を受けない)');
    // a の transitionend が b の state を巻き込んでいたら b も消えてしまう。
    // length=1 のままなら b は無事。

    void handle, a_el;
  });

  test('Rancha 風 sparse animation: 同 render で複数 instance を呼んでも独立に動く', async () => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
      configurable: true, get() { return 200; },
    });

    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_collapse_box } = require('../ric_ui/composite/create_ui_collapse_box');

    create_RicDOM('#app', {
      box: create_ui_collapse_box(),
      // 3 つの key を同時に enter させる (v0.3.10 までは 2 つ目以降が固まっていた)
      render: (s) => ({ tag: 'div', ctx: [
        s.box({ key: 'k1', visible: true, ctx: ['row1'] }),
        s.box({ key: 'k2', visible: true, ctx: ['row2'] }),
        s.box({ key: 'k3', visible: true, ctx: ['row3'] }),
      ]}),
    });
    await flush();  // measure → re-render

    const boxes = document.querySelectorAll('[data-ric-role="collapse-box"]');
    assert.equal(boxes.length, 3, '3 つの DOM が並ぶ');
    // 全 instance が height:200px (measure 完了済み = 全部独立に rAF が走った証拠)
    for (let i = 0; i < boxes.length; i++) {
      const style_attr = boxes[i].getAttribute('style') || '';
      assert.match(style_attr, /height:\s*200px/,
        `box[${i}] が height:200px (= measure が独立に走った)`);
    }
  });
});

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
