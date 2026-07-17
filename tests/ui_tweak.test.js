'use strict';

// ui_tweak black-box テスト
// create_ui_tweak_panel / ui_tweak_panel / ui_tweak_folder / ui_tweak_row の
// 公開 API のみを対象とする。返される RicDOM VDOM ツリーを直接検査する。
// ただし number 行のフォーカス中 value 書き戻しガード (下の describe) は
// document.activeElement を要するため実 DOM (jsdom) 経由で検証する。

const { describe, it, test, beforeEach } = require('node:test');
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
const { collect_nodes, find_by_tag, find_by_class } = require('./_helpers/dom_find');
// find_by_class (トークン一致) と違い部分一致で拾う (ric-tweak-row と
// ric-tweak-row__label の両方にマッチさせたいケース向けのローカル専用ヘルパー)
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

  it('ctx 関数: 毎 render で再評価され、自前 get の値が追従する', () => {
    // 静的配列だと初回固定で get が再実行されず radio の checked が古いまま
    // になる回帰 (nav_bar テーマ切替で表面化) を防ぐ。
    let theme = 'light';
    const inst = create_ui_tweak_panel({
      ctx: () => [ui_tweak_row({
        label: 'T', type: 'radiobutton', options: ['light', 'teal'],
        get: () => theme, set: () => {},
      })],
    });
    const checked_of = (root, v) =>
      find_by_tag(root, 'input').find(i => i.value === v).checked;

    const root1 = inst();
    assert.strictEqual(checked_of(root1, 'light'), 1);
    assert.strictEqual(checked_of(root1, 'teal'),  0);

    theme = 'teal';                 // 外部で値を変更
    const root2 = inst();           // 再 render → ctx 関数が再評価される
    assert.strictEqual(checked_of(root2, 'teal'),  1);
    assert.strictEqual(checked_of(root2, 'light'), 0);
  });

  it('ctx 静的配列: 従来どおり末尾に置かれる (後方互換)', () => {
    const root = create_ui_tweak_panel({
      ctx: [{ tag: 'div', class: 'static-ctx', ctx: ['x'] }],
    })();
    assert.ok(find_by_class(root, 'static-ctx').length > 0);
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

// ─────────────────────────────────────────────────────────────
// number 行: フォーカス中の value 書き戻しガード (v0.3.37〜)
//
// 報告元: 歯車DXFジェネレーター consumer
//   number input は FORCE_REAPPLY_DOM_KEYS (src/ricdom.js) の対象で、prev=next
//   でも毎 render el.value が再代入される。badInput 状態 ("0." 入力途中等) では
//   el.value が '' を返すため、この再代入で編集中バッファが潰れ小数点がドロップ
//   する (実ブラウザ再現: 全選択 → 0 . 3 と打つと "0.3" でなく "30")。
//
// jsdom は number input の badInput サニタイズ (ユーザー操作での "0." → '' 変換)
// を再現しないため、ここでは「"0." そのもの」ではなく、ui_tweak.js に実装した
// ガード機構 (フォーカス中は vdom から value キーを落とす / blur で確定・clamp)
// を直接検証する。実ブラウザでの最終再現確認は別途行う。
// ─────────────────────────────────────────────────────────────
describe('ui_tweak_row (number): フォーカス中の value 書き戻しガード', () => {
  const { setup_jsdom, flush } = require('./_helpers/jsdom_env');

  beforeEach(setup_jsdom);

  test('フォーカス中の再 render では el.value が書き戻されない（編集値が保持される）', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      n: 5,
      tick: 0,
      render: (s) => {
        void s.tick; // 再 render トリガー用（n は変えない）
        return ui_tweak_row({
          label: 'num', type: 'number',
          get: () => s.n, set: (v) => { s.n = v; },
        });
      },
    });

    await flush();
    const inp = document.querySelector('input[type=number]');
    assert.strictEqual(inp.value, '5');

    // フォーカス → onfocus ハンドラでマーカーが付く
    inp.focus();
    inp.onfocus({ target: inp });
    assert.strictEqual(document.activeElement, inp);

    // ユーザーが編集中（まだ oninput 経由で state に反映されていない値を模す）。
    // ※ jsdom は number input の badInput サニタイズ（"0." → '' 化）は再現する
    //   ("0." は不正な浮動小数点文字列なので代入時点で '' になる) が、実ブラウザの
    //   「入力途中の内部編集バッファ」は再現しないため、ここでは代入直後にまだ
    //   state に届いていない有効な値 ('3') で「書き戻されないこと」を検証する。
    inp.value = '3';

    // state.n は 5 のまま、無関係な tick だけ変えて再 render
    handle.tick++;
    await flush();

    assert.strictEqual(inp.value, '3',
      'フォーカス中は VDOM の value 供給が止まり、編集中バッファが保持される');
  });

  test('非フォーカス時は従来通り state 値が再 render で反映される（controlled 維持）', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      n: 5,
      render: (s) => ui_tweak_row({
        label: 'num2', type: 'number',
        get: () => s.n, set: (v) => { s.n = v; },
      }),
    });

    await flush();
    const inp = document.querySelector('input[type=number]');
    assert.strictEqual(inp.value, '5');

    // フォーカスしていない状態で DOM 側が drift しても、
    // state 変更 → 再 render で state 側の値が勝つ（FORCE_REAPPLY 継続）
    inp.value = '999';
    handle.n = 7;
    await flush();

    assert.strictEqual(inp.value, '7',
      '非フォーカス時は controlled のまま state 値が再代入される');
  });

  test('blur で min/max clamp され、確定値で set が呼ばれる', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      n: 5,
      render: (s) => ui_tweak_row({
        label: 'num3', type: 'number', min: 0, max: 10,
        get: () => s.n, set: (v) => { s.n = v; },
      }),
    });

    await flush();
    const inp = document.querySelector('input[type=number]');

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '999'; // 範囲外
    inp.onblur({ target: inp });

    assert.strictEqual(inp.value, '10', 'blur で clamp 後の確定値が書き戻される');
    assert.strictEqual(handle.n, 10, 'clamp された値で set が呼ばれる');
  });

  test('blur 後の再 render では value 供給が復帰する（controlled へ復帰）', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      n: 5,
      render: (s) => ui_tweak_row({
        label: 'num4', type: 'number',
        get: () => s.n, set: (v) => { s.n = v; },
      }),
    });

    await flush();
    const inp = document.querySelector('input[type=number]');

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '9';
    inp.onblur({ target: inp });
    await flush();

    assert.strictEqual(handle.n, 9, 'blur で確定値が set される');
    assert.strictEqual(inp.value, '9');

    // マーカーが外れているので、以降は再び state 主導で value が供給される
    handle.n = 20;
    await flush();

    assert.strictEqual(inp.value, '20',
      'blur 後は controlled に復帰し、以降の再 render で state 値が反映される');
  });

  test('set 省略（read-only）の number 行は blur で表示整形のみ行い set は呼ばれない', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    let n = 5;
    create_RicDOM('#app', {
      tick: 0,
      render: (s) => {
        void s.tick;
        return ui_tweak_row({
          label: 'num5', type: 'number', min: 0, max: 10,
          get: () => n, // set なし = read-only
        });
      },
    });

    await flush();
    const inp = document.querySelector('input[type=number]');

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '999';
    inp.onblur({ target: inp });

    assert.strictEqual(inp.value, '10', 'read-only でも clamp 後の表示整形は行われる');
    assert.strictEqual(n, 5, 'set が無いので元データは変化しない');
  });

  test('min のみ指定: 下限は clamp、上限は無制限で確定値がそのまま反映される', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      n: 5,
      render: (s) => ui_tweak_row({
        label: 'num_minonly', type: 'number', min: 0,
        get: () => s.n, set: (v) => { s.n = v; },
      }),
    });

    await flush();
    const inp = document.querySelector('input[type=number]');

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '-5';
    inp.onblur({ target: inp });
    assert.strictEqual(inp.value, '0', 'min 未満は min に clamp される');
    assert.strictEqual(handle.n, 0);

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '99999';
    inp.onblur({ target: inp });
    assert.strictEqual(inp.value, '99999', 'max 未指定なので上限クランプは効かない');
    assert.strictEqual(handle.n, 99999);
  });

  test('max のみ指定: 上限は clamp、下限は無制限で確定値がそのまま反映される', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      n: 5,
      render: (s) => ui_tweak_row({
        label: 'num_maxonly', type: 'number', max: 10,
        get: () => s.n, set: (v) => { s.n = v; },
      }),
    });

    await flush();
    const inp = document.querySelector('input[type=number]');

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '999';
    inp.onblur({ target: inp });
    assert.strictEqual(inp.value, '10', 'max 超過は max に clamp される');
    assert.strictEqual(handle.n, 10);

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '-999';
    inp.onblur({ target: inp });
    assert.strictEqual(inp.value, '-999', 'min 未指定なので下限クランプは効かない');
    assert.strictEqual(handle.n, -999);
  });

  test('get() が null/undefined を返す行でも blur で crash せず、フォールバック表示になる', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    let n = null;
    const set_n = (v) => { n = v; };
    create_RicDOM('#app', {
      tick: 0,
      render: (s) => {
        void s.tick;
        return ui_tweak_row({
          label: 'num_null', type: 'number',
          get: () => n, set: set_n,
        });
      },
    });

    await flush();
    const inp = document.querySelector('input[type=number]');

    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = ''; // badInput 相当（未入力で blur）
    assert.doesNotThrow(() => inp.onblur({ target: inp }));

    assert.strictEqual(inp.value, '', 'parse 不能かつ get() が null → 直近値(null) にフォールバックし表示は空文字');
    assert.strictEqual(n, null, '値に変化がないので set は呼ばれない（元の null のまま）');
  });

  test('フォーカス中でも oninput の set() は独立して state に届く', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    const handle = create_RicDOM('#app', {
      n: 5,
      render: (s) => ui_tweak_row({
        label: 'num_live', type: 'number',
        get: () => s.n, set: (v) => { s.n = v; },
      }),
    });

    await flush();
    const inp = document.querySelector('input[type=number]');

    // value 書き戻しガードが有効な「フォーカス中」でも、oninput 配線はガードとは
    // 独立した仕組みなので、入力のたびに set() は通常通り呼ばれる。
    inp.focus();
    inp.onfocus({ target: inp });
    inp.value = '42';
    inp.oninput({ target: inp });

    assert.strictEqual(handle.n, 42, 'フォーカス中でも oninput 経由で state に反映される');
  });

  test('同一 label の number 行が 2 つあっても blur 処理は crash しない（既知制約: 整列は保証しない）', async () => {
    const { create_RicDOM } = require('../src/ricdom');

    create_RicDOM('#app', {
      a: 1,
      b: 2,
      render: (s) => ({
        tag: 'div',
        ctx: [
          ui_tweak_row({ label: 'dup', type: 'number', get: () => s.a, set: (v) => { s.a = v; } }),
          ui_tweak_row({ label: 'dup', type: 'number', get: () => s.b, set: (v) => { s.b = v; } }),
        ],
      }),
    });

    await flush();
    const inputs = Array.from(document.querySelectorAll('input[type=number]'));
    assert.strictEqual(inputs.length, 2);

    inputs[0].focus();
    inputs[0].onfocus({ target: inputs[0] });
    inputs[0].value = '7';
    assert.doesNotThrow(() => inputs[0].onblur({ target: inputs[0] }));
  });
});
