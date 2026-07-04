// RicUI v0.2 — ui_radiobutton / bind_radiobutton テスト
//
// テスト方針:
//   1. 構造テスト  ── ラジオグループの vdom ノード
//   2. DOM テスト  ── bind_radiobutton の初期選択と onchange

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_radiobutton }   = require('../ric_ui/control/ui_radiobutton');
const { bind_radiobutton } = require('../ric_ui/control/bind_radiobutton');

const { setup_jsdom, flush: flush_raf } = require('./_helpers/jsdom_env');
const { run_rest_spread_contract } = require('./_helpers/rest_spread_contract');

// =====================================================================
// 1. 構造テスト：ui_radiobutton
// =====================================================================

describe('ui_radiobutton: 基本構造', () => {

  test('tag は div、class は ric-radiogroup', () => {
    const node = ui_radiobutton();
    assert.equal(node.tag,   'div');
    assert.equal(node.class, 'ric-radiogroup');
  });

  test('options なしのとき ctx が空配列', () => {
    assert.deepEqual(ui_radiobutton().ctx, []);
  });

  test('options の数だけ label ノードが生成される', () => {
    const node = ui_radiobutton({ options: ['a', 'b', 'c'] });
    assert.equal(node.ctx.length, 3);
  });

  test('各子ノードは tag=label', () => {
    const node = ui_radiobutton({ options: ['x', 'y'] });
    for (const child of node.ctx) {
      assert.equal(child.tag, 'label');
    }
  });
});

describe('ui_radiobutton: options の正規化', () => {

  test('string[] を渡すと各ラジオに value と span ラベルが設定される', () => {
    const node = ui_radiobutton({ options: ['viewer'] });
    const label = node.ctx[0];
    const input = label.ctx[0];
    const span  = label.ctx[1];

    assert.equal(input.value,     'viewer');
    assert.deepEqual(span.ctx, ['viewer']);
  });

  test('{value, label}[] を渡すと正規化される', () => {
    const node = ui_radiobutton({
      options: [{ value: 'ja', label: '日本語' }],
    });
    const label = node.ctx[0];
    const input = label.ctx[0];
    const span  = label.ctx[1];

    assert.equal(input.value,    'ja');
    assert.deepEqual(span.ctx, ['日本語']);
  });

  test('数値ラベルは String 化される（従来挙動の維持）', () => {
    const node = ui_radiobutton({ options: [{ value: 1, label: 1 }] });
    const span = node.ctx[0].ctx[1];
    assert.deepEqual(span.ctx, ['1']);
  });

  test('label に VDOM ノード（オブジェクト）を渡すと span にそのまま入る', () => {
    const icon = { tag: 'svg', class: 'ric-icon' };
    const node = ui_radiobutton({ options: [{ value: 'list', label: icon }] });
    const span = node.ctx[0].ctx[1];
    assert.equal(span.ctx.length, 1);
    assert.equal(span.ctx[0], icon);          // ラップ・String 化されず素通し
  });

  test('label に配列（アイコン + 文字列）を渡すと span の ctx になる', () => {
    const icon = { tag: 'svg', class: 'ric-icon' };
    const node = ui_radiobutton({ options: [{ value: 'list', label: [icon, ' List'] }] });
    const span = node.ctx[0].ctx[1];
    assert.deepEqual(span.ctx, [icon, ' List']);
    assert.equal(node.ctx[0].ctx[0].value, 'list');  // value は影響を受けない
  });
});

describe('ui_radiobutton: checked', () => {

  test('value に一致するラジオの checked が 1（numeric）', () => {
    const node = ui_radiobutton({ value: 'b', options: ['a', 'b', 'c'] });
    const inputs = node.ctx.map(l => l.ctx[0]);
    assert.equal(inputs[0].checked, 0);
    assert.equal(inputs[1].checked, 1);
    assert.equal(inputs[2].checked, 0);
  });

  test('value に一致するものがなければすべて checked=0', () => {
    const node = ui_radiobutton({ value: 'x', options: ['a', 'b'] });
    const inputs = node.ctx.map(l => l.ctx[0]);
    assert.equal(inputs[0].checked, 0);
    assert.equal(inputs[1].checked, 0);
  });
});

describe('ui_radiobutton: name 属性', () => {

  test('name が各 input に設定される', () => {
    const node = ui_radiobutton({ name: 'role', options: ['a', 'b'] });
    const inputs = node.ctx.map(l => l.ctx[0]);
    for (const input of inputs) {
      assert.equal(input.name, 'role');
    }
  });

  test('name を省略すると空文字（デフォルト）', () => {
    const node = ui_radiobutton({ options: ['a'] });
    assert.equal(node.ctx[0].ctx[0].name, '');
  });
});

describe('ui_radiobutton: disabled', () => {

  test('disabled=true のとき class に ric-radio--disabled が付く', () => {
    const node = ui_radiobutton({ options: ['a'], disabled: true });
    assert.ok(node.ctx[0].class.includes('ric-radio--disabled'));
  });

  test('disabled=true のとき input に disabled: true が含まれる', () => {
    const node  = ui_radiobutton({ options: ['a'], disabled: true });
    const input = node.ctx[0].ctx[0];
    assert.equal(input.disabled, true);
  });

  test('disabled=false のとき ric-radio--disabled が付かない', () => {
    const node = ui_radiobutton({ options: ['a'], disabled: false });
    assert.ok(!node.ctx[0].class.includes('disabled'));
  });
});

// =====================================================================
// 2. DOM テスト：bind_radiobutton
// =====================================================================

describe('bind_radiobutton: 初期描画', () => {

  test('name のデフォルトは key', () => {
    const node = bind_radiobutton({ role: 'viewer' }, 'role', {
      options: ['viewer', 'editor'],
    });
    const inputs = node.ctx.map(l => l.ctx[0]);
    for (const input of inputs) {
      assert.equal(input.name, 'role');
    }
  });

  test('options.name で name を上書きできる', () => {
    const node = bind_radiobutton({ role: 'viewer' }, 'role', {
      name:    'role_alt',
      options: ['viewer', 'editor'],
    });
    const inputs = node.ctx.map(l => l.ctx[0]);
    for (const input of inputs) {
      assert.equal(input.name, 'role_alt');
    }
  });

  test('初期値に一致するラジオが checked になる', () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    create_RicDOM(target, { role: 'editor',
      render: s => bind_radiobutton(s, 'role', { options: ['viewer', 'editor', 'admin'] }),
    });

    const inputs = target.querySelectorAll('input[type="radio"]');
    const checked = [...inputs].filter(i => i.checked).map(i => i.value);
    assert.deepEqual(checked, ['editor']);
  });
});

describe('bind_radiobutton: 双方向バインド', () => {

  test('ラジオを選択すると s[key] が更新される', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(target, { role: 'viewer',
      render: s => bind_radiobutton(s, 'role', { options: ['viewer', 'editor', 'admin'] }),
    });

    const inputs = target.querySelectorAll('input[type="radio"]');
    const admin  = [...inputs].find(i => i.value === 'admin');
    admin.checked = true;
    admin.dispatchEvent(new dom.window.Event('change'));
    await flush_raf();

    assert.equal(panel.role, 'admin');
  });

  test('panel 経由で state を変えると checked が再描画される', async () => {
    const dom    = setup_jsdom();
    const { create_RicDOM } = require('../src/ricdom');
    const target = dom.window.document.querySelector('#app');

    const panel = create_RicDOM(target, { role: 'viewer',
      render: s => bind_radiobutton(s, 'role', { options: ['viewer', 'editor'] }),
    });

    panel.role = 'editor';
    await flush_raf();

    const inputs  = target.querySelectorAll('input[type="radio"]');
    const checked = [...inputs].filter(i => i.checked).map(i => i.value);
    assert.deepEqual(checked, ['editor']);
  });
});

// =====================================================================
// rest スプレッド（ui_button / ui_input / ui_panel と同じ流儀）
// =====================================================================

// 汎用契約 (id/data-*/aria-*/onclick 透過、class 連結、tag 上書き不可) は
// tests/_helpers/rest_spread_contract.js の run_rest_spread_contract で検証。
run_rest_spread_contract({ name: 'ui_radiobutton', factory: ui_radiobutton, expected_tag: 'div', base_class: 'ric-radiogroup' });

describe('ui_radiobutton: rest スプレッド (固有・隔離契約)', () => {
  // 隔離契約: onchange は各 radio input に掛かり、wrapper div には漏れない
  test('onchange は radio input に掛かり wrapper div に混入しない', () => {
    const fn = () => {};
    const node = ui_radiobutton({ name: 'g', options: ['a', 'b'], onchange: fn });
    // ctx[0] は label、ctx[0].ctx[0] が input
    assert.equal(node.ctx[0].ctx[0].tag, 'input');
    assert.equal(node.ctx[0].ctx[0].onchange, fn);
    assert.equal(node.ctx[1].ctx[0].onchange, fn);
    assert.ok(!Object.prototype.hasOwnProperty.call(node, 'onchange'));
  });
});

// =====================================================================
// 3. options の per-option 追加キー（rest スプレッド契約、v0.3.32〜）
// =====================================================================
describe('ui_radiobutton: options の per-option 追加キー', () => {

  test('title が opt に付くと label ノードに転送される', () => {
    const node = ui_radiobutton({
      options: [{ value: 'a', label: 'A', title: '説明文' }],
    });
    const label = node.ctx[0];
    assert.equal(label.title, '説明文');
  });

  test('data-* も label ノードに転送される', () => {
    const node = ui_radiobutton({
      options: [{ value: 'a', label: 'A', 'data-testid': 'opt-a' }],
    });
    assert.equal(node.ctx[0]['data-testid'], 'opt-a');
  });

  test('opt.class は基底 ric-radio と連結される（置換ではない）', () => {
    const node = ui_radiobutton({
      options: [{ value: 'a', label: 'A', class: 'my-radio' }],
    });
    assert.equal(node.ctx[0].class, 'ric-radio my-radio');
  });

  test('disabled と opt.class の連結でも基底クラスが両方保たれる', () => {
    const node = ui_radiobutton({
      disabled: true,
      options: [{ value: 'a', label: 'A', class: 'my-radio' }],
    });
    assert.equal(node.ctx[0].class, 'ric-radio ric-radio--disabled my-radio');
  });

  test('value/label のみの既存形は label ノードに余計なキーが増えない', () => {
    const node = ui_radiobutton({ options: [{ value: 'a', label: 'A' }] });
    const label = node.ctx[0];
    assert.deepEqual(Object.keys(label).sort(), ['class', 'ctx', 'tag']);
  });

  test('string[] 形式でも label ノードに余計なキーが増えない', () => {
    const node = ui_radiobutton({ options: ['a'] });
    const label = node.ctx[0];
    assert.deepEqual(Object.keys(label).sort(), ['class', 'ctx', 'tag']);
  });

  test('転送先は label であり input には付かない', () => {
    const node = ui_radiobutton({
      options: [{ value: 'a', label: 'A', title: '説明文' }],
    });
    const label = node.ctx[0];
    const input = label.ctx[0];
    assert.equal(label.title, '説明文');
    assert.equal(input.title, undefined);
  });

  test('opt_rest で tag / ctx を上書きできない', () => {
    const node = ui_radiobutton({
      options: [{ value: 'a', label: 'A', tag: 'span', ctx: ['dummy'] }],
    });
    const label = node.ctx[0];
    assert.equal(label.tag, 'label');
    assert.equal(label.ctx[0].tag, 'input');
    assert.equal(label.ctx[1].tag, 'span');
  });
});
