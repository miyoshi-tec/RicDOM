// RicDOM — create_RicDOM の入力バリデーション (state=null ガードの順序修正、R16)
//
// 従来は raw_state.render へのアクセスが raw_state===null ガードより前にあり、
// create_RicDOM('#app', null) がハウス契約「throw しない (console.error +
// NOOP_PROXY 返却)」に反して TypeError を throw していた。
// null/非オブジェクト チェックを render_fn アクセスより前に移動して修正した
// (チェック内容自体は不変、順序の入れ替えのみ)。

'use strict';

const { test, describe, beforeEach } = require('node:test');
const { strict: assert } = require('node:assert');

const { setup_jsdom, flush } = require('./_helpers/jsdom_env');

describe('create_RicDOM: state バリデーション (R16)', () => {

  beforeEach(setup_jsdom);

  test('state=null は throw せず console.error + NOOP_PROXY を返す', () => {
    const { create_RicDOM } = require('../src/ricdom');
    const original_error = console.error;
    const errors = [];
    console.error = (...args) => errors.push(args.join(' '));
    try {
      let handle;
      assert.doesNotThrow(() => {
        handle = create_RicDOM('#app', null);
      });
      assert.ok(errors.length > 0, 'console.error が呼ばれるはず');
      assert.ok(handle, 'NOOP_PROXY (truthy な値) が返るはず');
      // NOOP_PROXY への任意アクセスも throw しない (プロパティアクセス・関数呼び出し共に安全)
      assert.doesNotThrow(() => { const _ = handle.foo; });
      assert.doesNotThrow(() => { handle(); });
    } finally {
      console.error = original_error;
    }
  });

  test('正常 state は従来どおり動く (回帰確認)', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const handle = create_RicDOM('#app', {
      n: 1,
      render: (s) => ({ tag: 'div', id: 'out', ctx: [String(s.n)] }),
    });
    await flush();
    const el = document.getElementById('out');
    assert.ok(el, '正常 state では DOM が描画されるはず');
    assert.equal(el.textContent, '1');
  });
});
