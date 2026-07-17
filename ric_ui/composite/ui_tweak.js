// RicUI — ui_tweak (panel / folder / row)
//
// dat.GUI / Tweakpane ライクなパラメータ調整パネル。
// JSON オブジェクトを渡すだけで GUI が自動生成され、
// 必要に応じて部分上書きや完全自前の UI に段階的に移行できる。
//
// 3 段階の使い方:
//   ① data だけ渡す      … 全自動 GUI 化（値の型から UI コントロールを推論）
//   ② keys で部分上書き  … 一部の行だけ範囲・ラベル・型を指定 / 行を vdom に差し替え
//   ③ ctx に自由 vdom    … ui_tweak_row / ui_tweak_folder を直接組み立てる
//
// 公開 API:
//   create_ui_tweak_panel({ title?, data?, keys?, ctx?, width?, style?, class? })
//     → inst() を返す factory（① ②向け）。s のトップレベルに格納すると
//       RicDOM が inst.__notify を自動注入し、data のプロパティ書き換えで再描画される。
//     keys はオブジェクトまたは関数。関数なら毎 render で評価され、
//     パラメータの値に応じた動的 disabled / options 切り替え等が可能。
//     ネストしたフォルダ内の keys も同様に関数を許容する（全階層で動的評価）。
//     ctx は配列または「() => 配列」。自前 get/set の ui_tweak_row を ctx で
//     組む場合は **関数で渡す**こと。静的配列だと初回評価のまま固定され、
//     get が再実行されず値が外部変更に追従しない（radio の checked 等が古いまま）。
//   ui_tweak_panel({ title?, ctx, width?, style?, class? })
//     → stateless wrapper（③向け）。render() 内で毎回呼び出す。
//   ui_tweak_folder({ label, open?, ctx })
//     → ネイティブ <details> ベースの折り畳み。JS state 不要。
//   ui_tweak_row({ label, get, set, type?, ... })
//     → 1 行の binding control。type 省略時は infer_type で自動推論。
//   infer_type(value)
//     → 値から UI コントロール種別を推論するヘルパー。

'use strict';

const { ui_input       } = require('../control/ui_input');
const { ui_checkbox    } = require('../control/ui_checkbox');
const { ui_range       } = require('../control/ui_range');
const { ui_select      } = require('../control/ui_select');
const { ui_radiobutton } = require('../control/ui_radiobutton');
const { ui_color       } = require('../control/ui_color');
const { safe_notify    } = require('../_factory_helpers');

// ─────────────────────────────────────────────────────────────
// 型推論
// ─────────────────────────────────────────────────────────────
// ※ ui_grid.js の同名ヘルパーとは判定基準が異なる (ui_tweak は prototype
//    チェックあり = クラスインスタンスを json_preview 行きにするため / ui_grid は
//    緩い判定で足りる)。共通化しないこと。
const _is_plain_object = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;

const infer_type = (value) => {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number')  return 'number';
  if (typeof value === 'string') {
    // hex と rgb/rgba のみ color 判定する。ui_color は hex と rgb/rgba のみ
    // パース対応のため、hsl(...) を color 判定すると黒 picker にフォールバックして
    // 元値を失う。将来 ui_color が hsl に対応したら ここにも追加する。
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value))  return 'color';
    if (/^rgba?\s*\(/.test(value))                    return 'color';
    return 'text';
  }
  if (_is_plain_object(value)) return 'folder';
  return 'json_preview';
};

// ─────────────────────────────────────────────────────────────
// ui_tweak_row — 1 行の binding control
// ─────────────────────────────────────────────────────────────
const ui_tweak_row = ({
  label   = '',
  get,
  set,
  type,
  options,
  min, max, step,
  placeholder,
  maxlength,
  disabled = false,
} = {}) => {
  if (typeof get !== 'function') {
    console.error('[ui_tweak_row] get is required:', { label });
    return null;
  }
  const value = get();
  const t = type ?? infer_type(value);
  const has_set = typeof set === 'function';

  const label_node = { tag: 'span', class: 'ric-tweak-row__label', ctx: [label] };
  const wrap = (control) => ({
    tag: 'div', class: 'ric-tweak-row',
    ctx: [label_node, control],
  });

  // checkbox はラベルを内蔵するため row にラベルを出さない
  if (t === 'checkbox') {
    return {
      tag: 'div', class: 'ric-tweak-row ric-tweak-row--checkbox',
      ctx: [
        ui_checkbox({
          checked: value ? 1 : 0,
          ctx: [label],
          disabled,
          ...(has_set ? { onchange: (e) => set(e.target.checked) } : {}),
        }),
      ],
    };
  }

  if (t === 'number') {
    // ── フォーカス中の value 書き戻し抑止 ──────────────────────
    // number input は controlled (value は RicDOM コアの FORCE_REAPPLY_DOM_KEYS)
    // なので、prev=next の VDOM でも毎 render el.value が再代入される。
    // ブラウザの number input が badInput 状態 (例: "0." の入力途中) のとき
    // el.value は '' を返すため、この再代入が編集中バッファを潰し、確定させたい
    // 桁が丸ごと消える（例: "0.3" と打っているつもりが "30" になる）。
    // 対策: フォーカス中はこの行の vdom から value キー自体を落とす
    // （undefined を渡すと el.value = 'undefined' になるので厳禁、キーを省く）。
    // VDOM から key が消えると patch は el.removeAttribute('value') するだけで
    // （src/ricdom.js の patch_attributes、prev_extra にあり next_extra に無い
    // キーの削除パス）、.value プロパティ = 編集中バッファには触れない。
    // 「自分の行がフォーカス中か」は label 由来のキーを onfocus で input 要素に
    // マーカーとして付け、render 時に document.activeElement と突き合わせて判定する
    // （同一 label の行が 2 つあると衝突するのは ui_tweak_row の radiobutton name
    //  と同じ既知の制約 — 回避したい場合は label を変える）。
    const edit_key = 'tweak_num__' + label;
    const is_editing = typeof document !== 'undefined'
      && document.activeElement != null
      && document.activeElement.__ric_tweak_editing === edit_key;

    // ui_input() は呼び出しごとに新規 plain object を返す（内部で共有・キャッシュ
    // されていない）ため、戻り値を直接 delete で mutate しても他行・他 render の
    // vdom に影響しない。
    const input_vdom = ui_input({
      type: 'number',
      value: value ?? '',
      disabled,
      ...(min  != null ? { min  } : {}),
      ...(max  != null ? { max  } : {}),
      ...(step != null ? { step } : {}),
      onfocus: (e) => { e.target.__ric_tweak_editing = edit_key; },
      onblur: (e) => {
        delete e.target.__ric_tweak_editing;
        // 編集中の残骸（badInput で読めない状態）は直近の確定値へフォールバックし、
        // min/max があれば clamp して確定値を書き戻す（controlled 表示へ復帰）。
        const parsed = parseFloat(e.target.value);
        let final_v = isNaN(parsed) ? value : parsed;
        if (min != null && final_v < min) final_v = min;
        if (max != null && final_v > max) final_v = max;
        e.target.value = String(final_v ?? '');
        // clamp 等で確定値が get() 時点の値と変わっていれば反映する
        // （read-only 行 = has_set なしのときは表示整形のみで済ませる）。
        if (has_set && final_v !== value) set(final_v);
      },
      ...(has_set ? { oninput: (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) set(v);
      }} : {}),
    });

    // フォーカス中は value キーを落として controlled 書き戻しを止める
    if (is_editing) delete input_vdom.value;

    return wrap(input_vdom);
  }

  if (t === 'range') {
    return wrap(ui_range({
      value: value ?? (min ?? 0),
      min: min ?? 0,
      max: max ?? 100,
      step: step ?? 1,
      disabled,
      ...(has_set ? { oninput: (e) => set(parseFloat(e.target.value)) } : {}),
    }));
  }

  if (t === 'select') {
    return wrap(ui_select({
      value,
      options: options ?? [],
      disabled,
      style: { flex: 1 },
      ...(has_set ? { onchange: (e) => set(e.target.value) } : {}),
    }));
  }

  if (t === 'radiobutton') {
    return wrap(ui_radiobutton({
      // ⚠ name は label 由来。同一ページに同じ label の radiobutton 行を
      // 2 つ置くと同一 radio グループに merge される (回避はラベルを変える)。
      name: 'rtw_' + label,
      value,
      options: options ?? [],
      disabled,
      ...(has_set ? { onchange: (e) => {
        const v = e.target.value;
        set(v === 'true' ? true : v === 'false' ? false : v);
      }} : {}),
    }));
  }

  if (t === 'color') {
    return wrap(ui_color({
      value: String(value ?? '#000000'),
      disabled,
      ...(has_set ? { oninput: (e) => set(e.target.value) } : {}),
    }));
  }

  if (t === 'text') {
    return wrap(ui_input({
      type: 'text',
      value: String(value ?? ''),
      placeholder: placeholder ?? '',
      disabled,
      ...(maxlength != null ? { maxlength } : {}),
      ...(has_set ? { oninput: (e) => set(e.target.value) } : {}),
    }));
  }

  // ── json_preview（フォールバック）──
  let display;
  try { display = JSON.stringify(value, null, 2); }
  catch { display = String(value); }
  return {
    tag: 'div', class: 'ric-tweak-row',
    ctx: [
      label_node,
      { tag: 'pre', class: 'ric-tweak-row__json', ctx: [display ?? ''] },
    ],
  };
};

// ─────────────────────────────────────────────────────────────
// ui_tweak_folder — <details> ベースのネイティブ折り畳み
// ─────────────────────────────────────────────────────────────
const ui_tweak_folder = ({ label = '', open = false, ctx = [] } = {}) => ({
  tag: 'details',
  class: 'ric-tweak-folder',
  // boolean attribute. RicDOM は値が変わらない限り再設定しないので、
  // 初期描画後はユーザのクリックで自由に開閉できる。
  ...(open ? { open: true } : {}),
  ctx: [
    { tag: 'summary', class: 'ric-tweak-folder__summary', ctx: [label] },
    { tag: 'div', class: 'ric-tweak-folder__body', ctx: Array.isArray(ctx) ? ctx : [ctx] },
  ],
});

// ─────────────────────────────────────────────────────────────
// 自動行生成（create_ui_tweak_panel の内部ヘルパー）
//   data の各キーを ui_tweak_row / ui_tweak_folder に展開する。
//   keys[k] === false                      → 非表示
//   keys[k] が { tag, ... } の vdom 風     → そのまま差し替え
//   keys[k] が options object              → ui_tweak_row のオプション上書き
//                                            （folder なら open / keys / ctx も解釈）
// ─────────────────────────────────────────────────────────────
const _looks_like_vdom = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.tag === 'string';

// keys は object または () => object を許容する。
// ネスト階層でも再帰的に関数を解決するため、各レベルで評価する。
const _resolve_keys = (k) => (typeof k === 'function' ? k() : k) ?? {};

const _generate_rows = (data, keys, notify) => {
  const rows = [];
  for (const k of Object.keys(data)) {
    const ov = keys[k];
    if (ov === false) continue;
    if (_looks_like_vdom(ov)) { rows.push(ov); continue; }

    const v = data[k];
    if (_is_plain_object(v)) {
      // ── nested folder ──
      const folder_label = ov?.label ?? k;
      const folder_open  = ov?.open ?? false;
      // ctx 明示があればそれを使う、なければ keys ネスト付きで再帰生成。
      // ネストした keys も関数を許容する（全階層で動的評価）。
      const folder_ctx = ov?.ctx ?? _generate_rows(v, _resolve_keys(ov?.keys), notify);
      rows.push(ui_tweak_folder({ label: folder_label, open: folder_open, ctx: folder_ctx }));
    } else {
      // 子プロパティ書き換えは RicDOM のトップレベル Proxy では検知できないので、
      // notify() で明示的に再描画をトリガーする。
      const row_opts = {
        label: ov?.label ?? k,
        get: () => data[k],
        set: (val) => { data[k] = val; notify?.(); },
        ...(ov && typeof ov === 'object' ? ov : {}),
      };
      rows.push(ui_tweak_row(row_opts));
    }
  }
  return rows;
};

// ─────────────────────────────────────────────────────────────
// 共通: panel 用 vdom ビルダー
// ─────────────────────────────────────────────────────────────
const _build_panel_vdom = ({ title, rows, ctx, width, style, cls }) => {
  const class_str = 'ric-tweak' + (cls ? ' ' + cls : '');
  const merged_style = {
    ...(width != null
        ? { width: typeof width === 'number' ? `${width}px` : width }
        : {}),
    ...(style ?? {}),
  };
  // ctx は配列のほか「() => 配列」も許容する（keys と同じ流儀）。
  // create_ui_tweak_panel に関数を渡すと毎 render で再評価されるため、
  // 自前 get/set の ui_tweak_row を ctx で組む場合でも値が最新に追従する
  // （関数でなく静的配列を渡すと初回評価のまま固定 = get が再実行されない）。
  const resolved_ctx = typeof ctx === 'function' ? ctx() : ctx;
  return {
    tag: 'div', class: class_str,
    // range のドラッグ中にネイティブ DnD が始まるのを抑止
    ondragstart: (e) => { e.preventDefault(); },
    ...(Object.keys(merged_style).length ? { style: merged_style } : {}),
    ctx: [
      title
        ? { tag: 'div', class: 'ric-tweak__title', ctx: [title] }
        : null,
      ...rows,
      ...(Array.isArray(resolved_ctx) ? resolved_ctx : resolved_ctx != null ? [resolved_ctx] : []),
    ].filter(Boolean),
  };
};

// ─────────────────────────────────────────────────────────────
// ui_tweak_panel — stateless wrapper（tier 3: 手書き ctx）
//   ctx に ui_tweak_folder / ui_tweak_row / ui_button 等を直接並べる。
//   再描画は呼び出し側の state 管理に委ねる。
// ─────────────────────────────────────────────────────────────
const ui_tweak_panel = ({
  title,
  ctx = [],
  width,
  style,
  class: cls,
} = {}) => _build_panel_vdom({ title, rows: [], ctx, width, style, cls });

// ─────────────────────────────────────────────────────────────
// create_ui_tweak_panel — トップレベルパネル factory（tier 1/2: data 自動）
//   inst.__notify は RicDOM が set trap で注入する。
//   data があれば自動行生成、ctx があれば末尾に追加（手動 vdom）。
// ─────────────────────────────────────────────────────────────
const create_ui_tweak_panel = ({
  title,
  data,
  keys = {},
  ctx  = [],
  width,
  style,
  class: cls,
} = {}) => {
  const inst = () => {
    const notify = () => safe_notify(inst, 'create_ui_tweak_panel');
    // keys が関数なら毎 render で評価する（動的 disabled / min / max 等に対応）。
    // ネストした keys も _generate_rows 内で再帰的に解決される。
    const auto_rows = data ? _generate_rows(data, _resolve_keys(keys), notify) : [];
    return _build_panel_vdom({ title, rows: auto_rows, ctx, width, style, cls });
  };
  return inst;
};

module.exports = {
  create_ui_tweak_panel,
  ui_tweak_panel,
  ui_tweak_folder,
  ui_tweak_row,
  infer_type,
};
