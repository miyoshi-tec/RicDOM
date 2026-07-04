// RicDOM — child proxy 経由で state に factory を追加したときの __notify 自動注入
// (v0.3.25〜、TrendGuard 報告)
//
// 旧版の bug:
//   s.popups[symbol] = create_ui_popup() のように、トップレベルではなく
//   child proxy の set trap 経由で factory を追加すると、__notify が刺さらず
//   popup.open() しても safe_notify が空打ちして再描画が走らなかった。
//
// 修正:
//   child proxy の set trap でも `_inject_notify(value)` を呼ぶように。

'use strict';

const { test, describe, beforeEach } = require('node:test');
const { strict: assert } = require('node:assert');

const { setup_jsdom, flush } = require('./_helpers/jsdom_env');

describe('child proxy 経由の代入で __notify が自動付与される (v0.3.25〜)', () => {

  beforeEach(setup_jsdom);

  test('s.dict[key] = factory() で factory.__notify が刺さる', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    // create_ui_* の代役: __notify 注入は「関数 or オブジェクト」なら何にでも
    // 行われるので、最小の関数で十分 (実 factory を import すると test が重くなる)
    const make_fake_factory = () => () => null;

    const handle = create_RicDOM('#app', {
      // child object (= depth-2 wrap される)
      popups: {},
      render: (s) => {
        void s.popups;
        return { tag: 'div', ctx: ['x'] };
      },
    });
    await flush();

    // child proxy 経由で factory を追加
    const factory = make_fake_factory();
    handle.popups.foo = factory;
    await flush();

    // factory に __notify が自動付与されているはず
    assert.equal(typeof factory.__notify, 'function',
      'child proxy 経由で代入された factory に __notify が刺さっている');

    // __notify を呼ぶと再描画がスケジュールされる (= subscribers.forEach が走る)
    // 確認: __notify を呼ぶ前後で render 関数が再度呼ばれること
    let render_count = 0;
    handle.render = (s) => {
      render_count++;
      void s.popups;
      return { tag: 'div', ctx: ['x'] };
    };
    await flush();
    const before = render_count;

    factory.__notify();
    await flush();

    assert.ok(render_count > before, '__notify() で再描画がトリガされる');
  });

  test('トップレベル代入 (= 既存挙動) でも __notify は刺さる', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      render: () => ({ tag: 'div', ctx: ['x'] }),
    });
    await flush();

    const factory = () => null;
    handle.foo = factory;
    await flush();

    assert.equal(typeof factory.__notify, 'function',
      'トップレベル代入でも __notify が刺さる (= 後方互換)');
  });

  test('child proxy 経由でも、プリミティブ / null には __notify は刺さらない (= 安全)', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      data: {},
      render: () => ({ tag: 'div', ctx: ['x'] }),
    });
    await flush();

    // プリミティブを代入しても何も起きない
    handle.data.count = 42;
    handle.data.label = 'hello';
    await flush();

    // データ自体は普通に読める
    assert.equal(handle.data.count, 42);
    assert.equal(handle.data.label, 'hello');
  });
});
