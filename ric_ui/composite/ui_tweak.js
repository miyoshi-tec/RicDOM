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

// ─────────────────────────────────────────────────────────────
// 型推論
// ─────────────────────────────────────────────────────────────
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
    return wrap(ui_input({
      type: 'number',
      value: value ?? '',
      disabled,
      ...(min  != null ? { min  } : {}),
      ...(max  != null ? { max  } : {}),
      ...(step != null ? { step } : {}),
      ...(has_set ? { oninput: (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) set(v);
      }} : {}),
    }));
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
      ...(Array.isArray(ctx) ? ctx : ctx != null ? [ctx] : []),
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
    const notify = () => inst.__notify?.();
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
