'use strict';

// ui_tweak black-box テスト
// create_ui_tweak_panel / ui_tweak_panel / ui_tweak_folder / ui_tweak_row の
// 公開 API のみを対象とする。返される RicDOM VDOM ツリーを直接検査する。

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  create_ui_tweak_panel,
  ui_tweak_panel,
  ui_tweak_folder,
  ui_tweak_row,
  tweak_infer_type: infer_type,
} = require('../ric_ui');

// ─────────────────────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────────────────────
const collect_nodes = (node, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const c of node) collect_nodes(c, out);
    return out;
  }
  out.push(node);
  if (Array.isArray(node.ctx)) {
    for (const child of node.ctx) collect_nodes(child, out);
  }
  return out;
};
const find_by_tag   = (root, tag) => collect_nodes(root).filter(n => n.tag === tag);
const find_by_class = (root, cls) => collect_nodes(root).filter(n => typeof n.class === 'string' && n.class.split(' ').includes(cls));
const find_class_contains = (root, cls) => collect_nodes(root).filter(n => typeof n.class === 'string' && n.class.includes(cls));

// ─────────────────────────────────────────────────────────────
// infer_type
// ─────────────────────────────────────────────────────────────
describe('infer_type', () => {
  it('boolean → checkbox', () => assert.strictEqual(infer_type(true), 'checkbox'));
  it('number → number',    () => assert.strictEqual(infer_type(42), 'number'));
  it('string → text',      () => assert.strictEqual(infer_type('hi'), 'text'));
  it('#hex → color',       () => assert.strictEqual(infer_type('#ff0000'), 'color'));
  it('rgba(...) → color',  () => assert.strictEqual(infer_type('rgba(0,0,0,0.5)'), 'color'));
  it('plain object → folder', () => assert.strictEqual(infer_type({ a: 1 }), 'folder'));
  it('array → json_preview', () => assert.strictEqual(infer_type([1, 2]), 'json_preview'));
});

// ─────────────────────────────────────────────────────────────
// ui_tweak_row
// ─────────────────────────────────────────────────────────────
describe('ui_tweak_row', () => {
  it('label が ric-tweak-row__label に出る', () => {
    const row = ui_tweak_row({ label: '速度', get: () => 5, type: 'number' });
    const labels = find_by_class(row, 'ric-tweak-row__label');
    assert.strictEqual(labels[0].ctx[0], '速度');
  });

  it('type 省略 → infer_type', () => {
    const row = ui_tweak_row({ label: 'x', get: () => 'hi' });
    const text = find_by_tag(row, 'input').find(n => n.type === 'text');
    assert.ok(text);
  });

  it('text input の oninput で set が呼ばれる', () => {
    let v = 'a';
    const row = ui_tweak_row({ label: 'n', get: () => v, set: (x) => { v = x; }, type: 'text' });
    find_by_tag(row, 'input').find(n => n.type === 'text').oninput({ target: { value: 'b' } });
    assert.strictEqual(v, 'b');
  });

  it('number input: NaN は無視される', () => {
    let v = 5;
    const row = ui_tweak_row({ label: 'n', get: () => v, set: (x) => { v = x; }, type: 'number' });
    find_by_tag(row, 'input').find(n => n.type === 'number').oninput({ target: { value: 'abc' } });
    assert.strictEqual(v, 5);
  });

  it('range input: parseFloat した値が入る', () => {
    let v = 50;
    const row = ui_tweak_row({ label: 'r', get: () => v, set: (x) => { v = x; }, type: 'range', min: 0, max: 100 });
    find_by_tag(row, 'input').find(n => n.type === 'range').oninput({ target: { value: '75' } });
    assert.strictEqual(v, 75);
  });

  it('checkbox: onchange で boolean 反映、ラベルは行直下', () => {
    let v = false;
    const row = ui_tweak_row({ label: 'on', get: () => v, set: (x) => { v = x; }, type: 'checkbox' });
    const cb = find_by_tag(row, 'input').find(n => n.type === 'checkbox');
    cb.onchange({ target: { checked: true } });
    assert.strictEqual(v, true);
  });

  it('select: options が option 要素として展開', () => {
    const row = ui_tweak_row({
      label: 'theme', get: () => 'dark', set: () => {},
      type: 'select', options: ['light', 'dark', 'system'],
    });
    assert.strictEqual(find_by_tag(row, 'option').length, 3);
  });

  it('radiobutton: "true"/"false" 文字列を bool に復元', () => {
    let v = false;
    const row = ui_tweak_row({
      label: 'inv', get: () => v, set: (x) => { v = x; }, type: 'radiobutton',
      options: [{ value: true, label: 'on' }, { value: false, label: 'off' }],
    });
    const radios = find_by_tag(row, 'input').filter(n => n.type === 'radio');
    radios[0].onchange({ target: { value: 'true' } });
    assert.strictEqual(v, true);
    radios[0].onchange({ target: { value: 'false' } });
    assert.strictEqual(v, false);
  });

  it('color: 値が color input に入る', () => {
    const row = ui_tweak_row({ label: 'c', get: () => '#ff0000', set: () => {} });
    const c = find_by_tag(row, 'input').find(n => n.type === 'color');
    assert.strictEqual(c.value, '#ff0000');
  });

  it('set 省略 → oninput が undefined（read-only）', () => {
    const row = ui_tweak_row({ label: 'ro', get: () => 'x', type: 'text' });
    const t = find_by_tag(row, 'input').find(n => n.type === 'text');
    assert.strictEqual(t.oninput, undefined);
  });

  it('json_preview: <pre> 要素', () => {
    const row = ui_tweak_row({ label: 'arr', get: () => [1, 2, 3] });
    assert.ok(find_by_tag(row, 'pre').length > 0);
  });
});

// ─────────────────────────────────────────────────────────────
// ui_tweak_folder
// ─────────────────────────────────────────────────────────────
describe('ui_tweak_folder', () => {
  it('<details> 要素を返す', () => {
    const f = ui_tweak_folder({ label: 'F', ctx: [] });
    assert.strictEqual(f.tag, 'details');
  });

  it('summary に label が入る', () => {
    const f = ui_tweak_folder({ label: 'Colors', ctx: [] });
    const sums = find_by_tag(f, 'summary');
    assert.strictEqual(sums[0].ctx[0], 'Colors');
  });

  it('open:true → open 属性が立つ', () => {
    const f = ui_tweak_folder({ label: 'F', open: true, ctx: [] });
    assert.strictEqual(f.open, true);
  });

  it('open:false → open 属性なし', () => {
    const f = ui_tweak_folder({ label: 'F', open: false, ctx: [] });
    assert.strictEqual(f.open, undefined);
  });

  it('ctx の中身が __body に並ぶ', () => {
    const f = ui_tweak_folder({ label: 'F', ctx: [
      ui_tweak_row({ label: 'a', get: () => 1, type: 'number' }),
      ui_tweak_row({ label: 'b', get: () => 2, type: 'number' }),
    ]});
    const numbers = find_by_tag(f, 'input').filter(n => n.type === 'number');
    assert.strictEqual(numbers.length, 2);
  });
});

// ─────────────────────────────────────────────────────────────
// ui_tweak_panel (stateless)
// ─────────────────────────────────────────────────────────────
describe('ui_tweak_panel (stateless)', () => {
  it('ric-tweak class を持つ div を返す', () => {
    const p = ui_tweak_panel({ ctx: [] });
    assert.strictEqual(p.tag, 'div');
    assert.ok(p.class.split(' ').includes('ric-tweak'));
  });

  it('title → ric-tweak__title に出る', () => {
    const p = ui_tweak_panel({ title: 'Settings', ctx: [] });
    const titles = find_by_class(p, 'ric-tweak__title');
    assert.strictEqual(titles[0].ctx[0], 'Settings');
  });

  it('title なし → title 要素なし', () => {
    const p = ui_tweak_panel({ ctx: [] });
    assert.strictEqual(find_by_class(p, 'ric-tweak__title').length, 0);
  });

  it('width:400 → style.width = "400px"', () => {
    const p = ui_tweak_panel({ width: 400, ctx: [] });
    assert.strictEqual(p.style.width, '400px');
  });

  it('width:"100%" → style.width = "100%"', () => {
    const p = ui_tweak_panel({ width: '100%', ctx: [] });
    assert.strictEqual(p.style.width, '100%');
  });

  it('class オプション → ルートに追加', () => {
    const p = ui_tweak_panel({ class: 'mine', ctx: [] });
    assert.ok(p.class.split(' ').includes('mine'));
  });

  it('ctx の中身が並ぶ', () => {
    const p = ui_tweak_panel({ ctx: [
      ui_tweak_row({ label: 'a', get: () => 1, type: 'number' }),
    ]});
    assert.strictEqual(find_by_tag(p, 'input').filter(n => n.type === 'number').length, 1);
  });
});

// ─────────────────────────────────────────────────────────────
// create_ui_tweak_panel (factory + auto generation)
// ─────────────────────────────────────────────────────────────
describe('create_ui_tweak_panel (factory)', () => {
  it('inst() → div with ric-tweak class', () => {
    const inst = create_ui_tweak_panel({});
    const root = inst();
    assert.strictEqual(root.tag, 'div');
    assert.ok(root.class.split(' ').includes('ric-tweak'));
  });

  it('data 自動生成: 各キーに row が出る', () => {
    const data = { a: 1, b: 'x', c: true };
    const root = create_ui_tweak_panel({ data })();
    const rows = find_class_contains(root, 'ric-tweak-row');
    assert.ok(rows.length >= 3);
  });

  it('data 自動生成: 型が値から推論される', () => {
    const root = create_ui_tweak_panel({ data: { n: 42, s: 'hi', b: true, c: '#fff' } })();
    const inputs = find_by_tag(root, 'input');
    assert.ok(inputs.some(i => i.type === 'number'));
    assert.ok(inputs.some(i => i.type === 'text'));
    assert.ok(inputs.some(i => i.type === 'checkbox'));
    assert.ok(inputs.some(i => i.type === 'color'));
  });

  it('keys override: type 上書き', () => {
    const root = create_ui_tweak_panel({
      data: { vol: 50 },
      keys: { vol: { type: 'range', min: 0, max: 100 } },
    })();
    assert.ok(find_by_tag(root, 'input').some(i => i.type === 'range'));
  });

  it('keys override: label 上書き', () => {
    const root = create_ui_tweak_panel({
      data: { speed: 3 },
      keys: { speed: { label: '速度' } },
    })();
    const labels = find_by_class(root, 'ric-tweak-row__label');
    assert.ok(labels.some(l => l.ctx[0] === '速度'));
  });

  it('keys override: false で行非表示', () => {
    const root = create_ui_tweak_panel({
      data: { secret: 'hush', visible: 'ok' },
      keys: { secret: false },
    })();
    const texts = find_by_tag(root, 'input').filter(i => i.type === 'text');
    assert.strictEqual(texts.length, 1);
    assert.strictEqual(texts[0].value, 'ok');
  });

  it('keys override: vdom で行を完全差し替え', () => {
    const custom = { tag: 'div', class: 'custom-row', ctx: ['x'] };
    const root = create_ui_tweak_panel({
      data: { foo: 1 },
      keys: { foo: custom },
    })();
    assert.ok(find_by_class(root, 'custom-row').length > 0);
  });

  it('nested object → ui_tweak_folder で展開', () => {
    const root = create_ui_tweak_panel({
      data: { settings: { volume: 50, theme: 'dark' } },
    })();
    const details = find_by_tag(root, 'details');
    assert.strictEqual(details.length, 1);
    const inputs = find_by_tag(root, 'input');
    assert.ok(inputs.some(i => i.type === 'number'));
    assert.ok(inputs.some(i => i.type === 'text'));
  });

  it('nested folder: keys.<name>.open で開閉指定', () => {
    const root = create_ui_tweak_panel({
      data: { settings: { x: 1 } },
      keys: { settings: { open: true } },
    })();
    const details = find_by_tag(root, 'details');
    assert.strictEqual(details[0].open, true);
  });

  it('nested folder: keys.<name>.keys で子の上書き', () => {
    const root = create_ui_tweak_panel({
      data: { settings: { vol: 50 } },
      keys: { settings: { keys: { vol: { type: 'range', min: 0, max: 10 } } } },
    })();
    assert.ok(find_by_tag(root, 'input').some(i => i.type === 'range'));
  });

  it('text input の oninput で data が更新される', () => {
    const data = { name: 'Alice' };
    const root = create_ui_tweak_panel({ data })();
    const t = find_by_tag(root, 'input').find(n => n.type === 'text');
    t.oninput({ target: { value: 'Bob' } });
    assert.strictEqual(data.name, 'Bob');
  });

  it('set 後に inst.__notify が呼ばれる', () => {
    let notified = 0;
    const inst = create_ui_tweak_panel({ data: { n: 1 } });
    inst.__notify = () => { notified++; };
    const root = inst();
    find_by_tag(root, 'input').find(n => n.type === 'number').oninput({ target: { value: '2' } });
    assert.strictEqual(notified, 1);
  });

  it('ctx 追加: data 自動行の後ろに置かれる', () => {
    const root = create_ui_tweak_panel({
      data: { n: 1 },
      ctx: [{ tag: 'div', class: 'extra', ctx: ['hi'] }],
    })();
    assert.ok(find_by_class(root, 'extra').length > 0);
  });

  // ── keys 関数（動的 keys）─────────────────────────────────

  it('keys 関数: 毎 render で評価され disabled が動的に切り替わる', () => {
    const data = { symmetric: true, cx: 10 };
    const inst = create_ui_tweak_panel({
      data,
      keys: () => ({
        symmetric: {},
        cx: { type: 'range', min: 0, max: 100, ...(data.symmetric ? { disabled: true } : {}) },
      }),
    });

    // symmetric=true → cx は disabled
    const root1 = inst();
    const range1 = find_by_tag(root1, 'input').find(n => n.type === 'range');
    assert.strictEqual(range1.disabled, true);

    // symmetric=false → cx は enabled
    data.symmetric = false;
    const root2 = inst();
    const range2 = find_by_tag(root2, 'input').find(n => n.type === 'range');
    assert.strictEqual(range2.disabled, undefined);
  });

  it('keys 関数: オブジェクト指定と同じ出力が得られる', () => {
    const data = { speed: 50 };
    const static_keys = { speed: { type: 'range', min: 0, max: 100 } };
    const root_static = create_ui_tweak_panel({ data, keys: static_keys })();
    const root_fn     = create_ui_tweak_panel({ data, keys: () => static_keys })();

    // 同じ構造の range input が生成される
    const range_s = find_by_tag(root_static, 'input').find(n => n.type === 'range');
    const range_f = find_by_tag(root_fn, 'input').find(n => n.type === 'range');
    assert.strictEqual(range_s.min, range_f.min);
    assert.strictEqual(range_s.max, range_f.max);
    assert.strictEqual(range_s.value, range_f.value);
  });

  it('keys 関数: false で行非表示も動的に切り替えられる', () => {
    const data = { mode: 'simple', advanced_val: 99 };
    const inst = create_ui_tweak_panel({
      data,
      keys: () => ({
        mode: { type: 'select', options: ['simple', 'advanced'] },
        advanced_val: data.mode === 'simple' ? false : {},
      }),
    });

    // mode=simple → advanced_val は非表示（mode の行だけ）
    const root1 = inst();
    const rows1 = find_by_class(root1, 'ric-tweak-row');
    assert.strictEqual(rows1.length, 1);

    // mode=advanced → advanced_val が表示される
    data.mode = 'advanced';
    const root2 = inst();
    const rows2 = find_by_class(root2, 'ric-tweak-row');
    assert.strictEqual(rows2.length, 2);
  });

  // ── ネストした keys 関数（全階層動的評価）──────────────────
  it('ネストした keys 関数: フォルダ内でも毎 render で評価される', () => {
    const data = { shape: { symmetric: true, cx_left: 10, cx_right: 20 } };
    const inst = create_ui_tweak_panel({
      data,
      keys: {
        shape: {
          open: true,
          keys: () => ({
            symmetric: {},
            cx_left:  { type: 'number', ...(data.shape.symmetric ? { disabled: true } : {}) },
            cx_right: { type: 'number', ...(data.shape.symmetric ? { disabled: true } : {}) },
          }),
        },
      },
    });

    // symmetric=true → cx_left / cx_right は disabled
    const root1 = inst();
    const inputs1 = find_by_tag(root1, 'input').filter(n => n.type === 'number');
    assert.strictEqual(inputs1.length, 2);
    assert.strictEqual(inputs1[0].disabled, true);
    assert.strictEqual(inputs1[1].disabled, true);

    // symmetric=false → disabled なし
    data.shape.symmetric = false;
    const root2 = inst();
    const inputs2 = find_by_tag(root2, 'input').filter(n => n.type === 'number');
    assert.strictEqual(inputs2.length, 2);
    assert.strictEqual(inputs2[0].disabled, undefined);
    assert.strictEqual(inputs2[1].disabled, undefined);
  });

  it('ネストした keys 関数: false でネスト行も非表示になる', () => {
    const data = { shape: { mode: 'simple', advanced_val: 99 } };
    const inst = create_ui_tweak_panel({
      data,
      keys: {
        shape: {
          open: true,
          keys: () => ({
            mode: { type: 'select', options: ['simple', 'advanced'] },
            advanced_val: data.shape.mode === 'simple' ? false : {},
          }),
        },
      },
    });

    // mode=simple → advanced_val は非表示
    const root1 = inst();
    const rows1 = find_by_class(root1, 'ric-tweak-row');
    assert.strictEqual(rows1.length, 1);

    // mode=advanced → advanced_val が表示
    data.shape.mode = 'advanced';
    const root2 = inst();
    const rows2 = find_by_class(root2, 'ric-tweak-row');
    assert.strictEqual(rows2.length, 2);
  });

  it('ネストした keys 関数: 深い階層（3 段）でも動的評価される', () => {
    const data = { view: { display: { show: true, opacity: 0.5 } } };
    const inst = create_ui_tweak_panel({
      data,
      keys: () => ({
        view: {
          open: true,
          keys: () => ({
            display: {
              open: true,
              keys: () => ({
                show: {},
                opacity: { type: 'number', ...(data.view.display.show ? {} : { disabled: true }) },
              }),
            },
          }),
        },
      }),
    });

    const root1 = inst();
    const inputs1 = find_by_tag(root1, 'input').filter(n => n.type === 'number');
    assert.strictEqual(inputs1[0].disabled, undefined);

    data.view.display.show = false;
    const root2 = inst();
    const inputs2 = find_by_tag(root2, 'input').filter(n => n.type === 'number');
    assert.strictEqual(inputs2[0].disabled, true);
  });
});
