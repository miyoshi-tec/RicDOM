// ricdom/ui — createTweakPanel (設計書 §3.4 部品契約 + 付録 E a11y)
//
// v1 (ric_ui/composite/ui_tweak.js: create_ui_tweak_panel / ui_tweak_panel / ui_tweak_row /
// ui_tweak_folder) の移植。dat.GUI / Tweakpane ライクなパラメータ調整パネル。
//
// v1 との相違点:
//   - 状態を持つので `app.use(createTweakPanel())` で明示登録する (設計書 §3.4)。v1 は
//     `create_ui_tweak_panel` (自動生成、tier1/2) と `ui_tweak_panel` (stateless、tier3) の
//     2 factory に分かれていたが、v2 は 1 部品の props (`data`+`keys` / `rows` / `title` /
//     `width`) に統合した — 呼び出し側が毎 render 呼ぶ契約は同じなので tier3 の
//     「静的配列だと get が再評価されない」問題 (v1 の ctx 関数渡し要件) がそもそも起きない。
//   - folder は v1 のネイティブ `<details>` を廃止し、createAccordion と同じ
//     `<button aria-expanded aria-controls>` + `role="region"` パターンに変更 (a11y、
//     設計書付録 E)。開閉状態は v1 の DOM 自前管理 (`<details open>`) と違い、この部品が
//     `path` (データのキー鎖を `.` 区切りにしたもの) をキーに JS state として保持する。
//     閉じたパネルは createAccordion の §15 追補と同じく `hidden` 属性で a11y ツリーから
//     除外する (role="region" は維持)。
//   - number 行の「編集中ガード」: v1 は `onfocus` でマーカーを付け、render 時に
//     `document.activeElement` と突き合わせて vdom から `value` キーを落としていた
//     (ローカルな局所対応)。v2 はコアの編集中ガード (`src/dom.ts` の
//     `shouldSkipValueReapply`: `document.activeElement` である input/textarea/select には
//     `value` の FORCE_REAPPLY を行わない) がこれを肩代わりするため、部品側は focus
//     マーカーを一切持たない — 素直に `value` を渡すだけで、小数点を打っている最中に
//     他の state 変更で再 render が走っても入力バッファは潰れない (設計書 §3.2 の
//     「コアの規則への一般化」の実証、ブラウザテストで回帰させる)。
//     blur 時の min/max clamp + `set()` 呼び出しは (表示の整形や確定値の書き戻しという)
//     部品固有の責務なので、v1 同様この部品側に残す。
//   - radiobutton 行の name: ブラウザは同じ `name` の radio input を 1 グループとして扱う
//     ため、v1 は `'rtw_' + label` を name にしていた (同一 label の行が 2 つあると
//     意図せず同じグループに merge される、既知の制約)。v2 も同じ理由でラベル文字列由来の
//     name を使う (`ricdom-tweak-radio-${label}`) — 既知の制約もそのまま移植する
//     (回避したい場合は override.label でラベルを変える)。
//
// 3 段階の使い方 (v1 継承):
//   ① data だけ渡す      … 全自動 GUI 化 (値の型から UI コントロールを推論、inferTweakType)
//   ② keys で部分上書き  … 一部の行だけ type/min/max/step/options/open を指定
//   ③ rows に自由 RicNode … 自前で組んだ行 (uiInput 等) をそのまま末尾に追加
//
// 使い方:
//   const tweak = app.use(createTweakPanel());
//   render 内で毎回呼ぶ:
//   tweak({
//     title: 'パラメータ',
//     data: s.params,                       // { size: 10, color: '#ff0000', nested: {...} }
//     keys: { size: { min: 1, max: 100 }, mode: { type: 'select', options: ['a', 'b'] } },
//     rows: [uiButton({ children: ['reset'], onclick: () => {...} })],
//     width: 240,
//   })

import type { ClassValue, RicElementNode, RicNode, StyleValue } from '../types.js';
import { type AttachGuard, type Component, createAttachGuard } from './internal/component.js';
import { UI_ROLE, mergeClass } from './internal/pureHelpers.js';
import { uiIcon } from './icon.js';
import { uiInput } from './input.js';
import { uiRange } from './range.js';
import { uiCheckbox } from './checkbox.js';
import { uiSelect, type UiSelectOption } from './select.js';
import { uiRadiobutton, type UiRadiobuttonOption } from './radiobutton.js';
import { uiColor } from './color.js';

// 開閉インジケータ (chevron-down)。閉=下向き、開=CSS で 180° 回転して上向き
// (createAccordion.ts と同じ descriptor、v1 継承)。
const CHEVRON_DOWN = { p: 'm6 9 6 6 6-6' };

// ─────────────────────────────────────────────────────────────
// 型推論 (v1 infer_type の camelCase 移植)
// ─────────────────────────────────────────────────────────────

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGBA_COLOR_RE = /^rgba?\s*\(/;

/** 行の type 明示指定が無いとき、値から UI コントロール種別を推論する (v1 の infer_type)。 */
export type TweakInferredType = 'checkbox' | 'number' | 'color' | 'text' | 'folder' | 'json';

export const inferTweakType = (value: unknown): TweakInferredType => {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') {
    if (HEX_COLOR_RE.test(value)) return 'color';
    if (RGBA_COLOR_RE.test(value)) return 'color';
    return 'text';
  }
  if (isPlainObject(value)) return 'folder';
  return 'json';
};

// ─────────────────────────────────────────────────────────────
// 型・props
// ─────────────────────────────────────────────────────────────

/** 行の種別 (`keys[k].type` で明示指定できる範囲。'range'/'select'/'radiobutton' は
 *  値の型だけからは推論できないため、明示指定でのみ到達する — v1 と同じ設計)。 */
export type TweakRowType = 'number' | 'range' | 'checkbox' | 'text' | 'select' | 'radiobutton' | 'color';

/** `keys` で 1 プロパティ (行 or folder) を部分上書きする指定。leaf 行用のフィールドと
 *  folder 用のフィールド (`open`/`keys`/`rows`) を同じ形に持たせ、データの形 (plain object か否か)
 *  でどちらとして解釈するかが決まる (v1 と同じ設計)。 */
export interface TweakKeyOverride {
  /** 表示ラベル (省略時はプロパティ名) */
  label?: string;
  /** leaf 行の種別を明示指定 (省略時は inferTweakType) */
  type?: TweakRowType;
  min?: number;
  max?: number;
  step?: number;
  /** select / radiobutton 行の選択肢 */
  options?: (string | UiSelectOption)[];
  disabled?: boolean;
  /** text 行の placeholder */
  placeholder?: string;
  /** text 行の maxlength */
  maxlength?: number;
  /** folder の初期展開状態 (省略時 false)。2 回目以降の render では無視される
   *  (state は inst 内部の openMap が正、v1 の `<details open>` は初回のみ有効な属性
   *  だったのと同じ「初期値」としての位置づけ) */
  open?: boolean;
  /** folder の子プロパティに対する再帰的な上書き */
  keys?: TweakKeys;
  /**
   * folder 本体の末尾に並べる自由 RicNode (Tier3 `rows` の folder 版)。パネル全体の
   * `rows` は末尾追記専用だが、これはこの folder の中の特定位置 (末尾) に置ける
   * (パイロット移行の報告 #1 で判明した不足)。
   */
  rows?: RicNode[];
  /**
   * この行の読み取りを `data[k]` の代わりに委ねる (歯車DXF の「中心距離 = module から
   * 逆算」のような、data に無い計算値の行を作るための指定)。`get` だけ指定して行を
   * 宣言でき、そのとき `data` 側に同名キーが存在する必要は無い (data 由来の行の後ろに
   * 追加される。宣言順は `keys` のキー順)。get が例外を投げても render は落とさない
   * (console.error + undefined 扱い、uiMdPre の transformText と同じ方針)。
   */
  get?: () => unknown;
  /**
   * この行の書き込みを `data[k] = v` の代わりに委ねる。`get`/`set` のどちらか一方だけの
   * 指定も可能 (get のみ = 読み取り専用の計算値行、set のみ = 表示は `undefined` 扱いだが
   * 書き込みだけ横取りする、通常は get と対で使う)。書き込み後は `ctx.notify()` が呼ばれる。
   * set が例外を投げても render は落とさない (console.error のみ)。
   */
  set?: (v: unknown) => void;
}

/** `false` を指定すると、そのプロパティの行 (or folder) を非表示にする (v1 継承)。 */
export type TweakKeys = Record<string, TweakKeyOverride | false>;

export interface TweakPanelProps {
  title?: RicNode;
  /** tier1/2: このオブジェクトの各プロパティから行を自動生成する */
  data?: Record<string, unknown>;
  /** tier2: `data` の一部プロパティを部分上書きする */
  keys?: TweakKeys;
  /** tier3: 自前で組んだ行 (RicNode) を自動生成行の後ろに並べる */
  rows?: RicNode[];
  width?: number | string;
  style?: StyleValue;
  class?: ClassValue;
}

export interface TweakPanelInstance extends Component<TweakPanelProps> {
  /** 指定 path ('a.b' のようなキー鎖) の folder が現在展開中か */
  isOpen(path: string): boolean;
}

// ─────────────────────────────────────────────────────────────
// 内部: 1 行の描画
// ─────────────────────────────────────────────────────────────

interface RowArgs {
  label: string;
  value: unknown;
  set?: (v: unknown) => void;
  override?: TweakKeyOverride;
  /** dot 連結のキー鎖 (`data-ricdom-tweak-key` に出す安定フック、パイロット移行の報告 #2) */
  path: string;
}

// leaf row の安定フック (設計書「tweak の leaf row に安定フック」)。number/range/checkbox/
// text/select/radiobutton/color/計算値、全ての行コンテナに付与する。checkbox 行だけは
// uiCheckbox 自体が <label> を内蔵するため row 側にラベル span が無い (JSDoc/SPEC 明記)。
//
// **role 棚卸しでの見送り (#2、2.0.0-alpha.8)**: `.ric-tweak-row__label` / `.ric-tweak-folder__label` /
// `.ric-tweak-row__json` / 出所不明にならない `<legend>` は role を追加しなかった。
// dialog/toast/tweak パネルのタイトルと違い、これらは「行/folder ごとに繰り返される
// 装飾的サブパーツ」で、親の行/folder 自体が既に一意なフック (`[data-ricdom-tweak-key="..."]`
// または `data-ricdom-role="tweak-folder"`) を持つため、`[data-ricdom-tweak-key="x"]
// .ric-tweak-row__label` のようにクラスセレクタと組み合わせれば十分掴める。全 leaf row に
// role を増やすと粒度が細かすぎて一貫性の割に得るものが小さいと判断した。
const rowHookAttrs = (path: string): Record<string, string> => ({
  'data-ricdom-role': UI_ROLE.tweakRow,
  'data-ricdom-tweak-key': path,
});

const buildLabelRow = (labelText: string, control: RicNode, path: string): RicElementNode =>
  ({
    tag: 'label',
    class: 'ric-tweak-row',
    ...rowHookAttrs(path),
    children: [{ tag: 'span', class: 'ric-tweak-row__label', children: [labelText] }, control],
  }) as unknown as RicElementNode;

const buildRow = ({ label, value, set, override, path }: RowArgs): RicNode => {
  const type: TweakInferredType | TweakRowType = override?.type ?? inferTweakType(value);
  const disabled = override?.disabled ?? false;
  const hasSet = typeof set === 'function';

  if (type === 'checkbox') {
    // checkbox は uiCheckbox 自体が <label> を内蔵するため、row 側では別途ラベルを出さない
    // (v1 継承。FACT: この行だけ .ric-tweak-row__label span が存在しない)。
    return {
      tag: 'div',
      class: 'ric-tweak-row ric-tweak-row--checkbox',
      ...rowHookAttrs(path),
      children: [
        uiCheckbox({
          checked: !!value,
          children: [label],
          disabled,
          ...(hasSet ? { onchange: (ev: Event) => set!((ev.target as HTMLInputElement).checked) } : {}),
        }),
      ],
    } as RicElementNode;
  }

  if (type === 'number') {
    const min = override?.min;
    const max = override?.max;
    const step = override?.step;
    const numValue = typeof value === 'number' ? value : Number(value);
    const baseline = Number.isFinite(numValue) ? numValue : 0;
    return buildLabelRow(
      label,
      uiInput({
        type: 'number',
        value: Number.isFinite(numValue) ? String(numValue) : '',
        disabled,
        ...(min != null ? { min: String(min) } : {}),
        ...(max != null ? { max: String(max) } : {}),
        ...(step != null ? { step: String(step) } : {}),
        // blur 時: badInput 等の編集中残骸を直近の確定値へフォールバックし、min/max があれば
        // clamp して確定値を書き戻す (controlled 表示への復帰。部品固有の責務、v1 継承)。
        onblur: (ev: Event) => {
          const target = ev.target as HTMLInputElement;
          const parsed = parseFloat(target.value);
          let finalV = Number.isNaN(parsed) ? baseline : parsed;
          if (min != null && finalV < min) finalV = min;
          if (max != null && finalV > max) finalV = max;
          target.value = String(finalV);
          if (hasSet && finalV !== baseline) set!(finalV);
        },
        ...(hasSet
          ? {
              oninput: (ev: Event) => {
                const v = parseFloat((ev.target as HTMLInputElement).value);
                if (!Number.isNaN(v)) set!(v);
              },
            }
          : {}),
      }),
      path,
    );
  }

  if (type === 'range') {
    const min = override?.min ?? 0;
    const max = override?.max ?? 100;
    const step = override?.step ?? 1;
    const numValue = typeof value === 'number' && Number.isFinite(value) ? value : min;
    return buildLabelRow(
      label,
      uiRange({
        value: numValue,
        min,
        max,
        step,
        disabled,
        ...(hasSet ? { oninput: (ev: Event) => set!(parseFloat((ev.target as HTMLInputElement).value)) } : {}),
      }),
      path,
    );
  }

  if (type === 'select') {
    return buildLabelRow(
      label,
      uiSelect({
        value: String(value ?? ''),
        options: override?.options ?? [],
        disabled,
        style: { flex: 1 },
        ...(hasSet ? { onchange: (ev: Event) => set!((ev.target as HTMLSelectElement).value) } : {}),
      }),
      path,
    );
  }

  if (type === 'radiobutton') {
    // ⚠ name は label 由来 (v1 ric_ui/control/ui_radiobutton.js / ui_tweak.js の JSDoc を
    //   移植): 同一ページに同じ label の radiobutton 行を 2 つ置くと、ブラウザの仕様上
    //   同一 radio グループとして merge される (RicDOM 固有のバグではなく回避不能な
    //   ブラウザ制約。回避したい場合は override.label でラベルを変える)。
    return {
      tag: 'fieldset',
      class: 'ric-tweak-row ric-tweak-row--radiobutton',
      ...rowHookAttrs(path),
      children: [
        { tag: 'legend', class: 'ric-tweak-row__label', children: [label] },
        uiRadiobutton({
          name: `ricdom-tweak-radio-${label}`,
          value: String(value ?? ''),
          // select と radiobutton で options の label 型 (string|number vs RicNode) が
          // 異なるため、tweak 側は共通の緩い型 (UiSelectOption) で受けて radiobutton には
          // ここで橋渡しする (実運用では文字列ラベルの options を渡すのが大半)。
          options: (override?.options ?? []) as unknown as UiRadiobuttonOption[],
          disabled,
          ...(hasSet
            ? {
                onchange: (ev: Event) => {
                  const v = (ev.target as HTMLInputElement).value;
                  set!(v === 'true' ? true : v === 'false' ? false : v);
                },
              }
            : {}),
        }),
      ],
    } as unknown as RicElementNode;
  }

  if (type === 'color') {
    return buildLabelRow(
      label,
      uiColor({
        value: String(value ?? '#000000'),
        disabled,
        ...(hasSet ? { oninput: (ev: Event) => set!((ev.target as HTMLInputElement).value) } : {}),
      }),
      path,
    );
  }

  if (type === 'text') {
    return buildLabelRow(
      label,
      uiInput({
        type: 'text',
        value: String(value ?? ''),
        placeholder: override?.placeholder ?? '',
        disabled,
        ...(override?.maxlength != null ? { maxlength: override.maxlength } : {}),
        ...(hasSet ? { oninput: (ev: Event) => set!((ev.target as HTMLInputElement).value) } : {}),
      }),
      path,
    );
  }

  // ── json (フォールバック、v1 の json_preview。data に無い計算値の get が非プリミティブを
  //   返した場合もここに落ちる) ──
  let display: string;
  try {
    display = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    display = String(value);
  }
  return {
    tag: 'div',
    class: 'ric-tweak-row',
    ...rowHookAttrs(path),
    children: [
      { tag: 'span', class: 'ric-tweak-row__label', children: [label] },
      { tag: 'pre', class: 'ric-tweak-row__json', children: [display] },
    ],
  } as RicElementNode;
};

// ─────────────────────────────────────────────────────────────
// 内部: folder (再帰) + 自動行生成
// ─────────────────────────────────────────────────────────────

const encodePathSegment = (s: string): string => encodeURIComponent(s);

interface FolderCtx {
  fid: number;
  openMap: Record<string, boolean>;
  notify: () => void;
}

const buildFolder = (path: string, label: string, obj: Record<string, unknown>, override: TweakKeyOverride | undefined, ctx: FolderCtx): RicNode => {
  if (!(path in ctx.openMap)) ctx.openMap[path] = override?.open ?? false;
  const isOpen = !!ctx.openMap[path];

  const headerId = `ricdom-tweak-${ctx.fid}-${encodePathSegment(path)}-header`;
  const bodyId = `ricdom-tweak-${ctx.fid}-${encodePathSegment(path)}-body`;

  // folder 本体の子行 + この folder 専用の Tier3 rows (末尾追記、パイロット移行の報告 #1)。
  const childRows = [...buildRows(obj, override?.keys ?? {}, path, ctx), ...(override?.rows ?? [])];

  return {
    tag: 'div',
    class: 'ric-tweak-folder',
    'data-ricdom-role': UI_ROLE.tweakFolder,
    children: [
      {
        tag: 'button',
        type: 'button',
        class: `ric-tweak-folder__header${isOpen ? ' ric-tweak-folder__header--open' : ''}`,
        'data-ricdom-role': UI_ROLE.tweakFolderHeader,
        id: headerId,
        'aria-expanded': isOpen ? 'true' : 'false',
        'aria-controls': bodyId,
        onclick: () => {
          ctx.openMap[path] = !isOpen;
          ctx.notify();
        },
        children: [
          { tag: 'span', class: 'ric-tweak-folder__label', children: [label] },
          uiIcon(CHEVRON_DOWN, { size: '1em', class: 'ric-tweak-folder__arrow' }),
        ],
      },
      {
        tag: 'div',
        class: `ric-tweak-folder__body${isOpen ? ' ric-tweak-folder__body--open' : ''}`,
        'data-ricdom-role': UI_ROLE.tweakFolderBody,
        id: bodyId,
        role: 'region',
        'aria-labelledby': headerId,
        // 閉じた folder は hidden 属性で a11y ツリーから除外する (createAccordion の
        // §15 追補と同じ考え方)。role="region" 自体は維持される。
        hidden: !isOpen,
        children: [{ tag: 'div', class: 'ric-tweak-folder__body-inner', children: childRows }],
      },
    ],
  } as unknown as RicElementNode;
};

// get/set 行 (data に無い計算値、パイロット移行の報告 #1) は consumer 提供のコールバックを
// render 中に同期実行するため、uiMdPre の transformText/transformImageSrc と同じ方針で
// 例外を握りつぶす (throw しない・グルーコードを連鎖破壊しない、v1 A9 継承)。
const safeGetOverrideValue = (label: string, get: () => unknown): unknown => {
  try {
    return get();
  } catch (e) {
    console.error(`RicDOM UI: createTweakPanel の keys.get ('${label}') が例外を投げました。`, e);
    return undefined;
  }
};

const safeSetOverrideValue = (label: string, set: (v: unknown) => void, val: unknown): void => {
  try {
    set(val);
  } catch (e) {
    console.error(`RicDOM UI: createTweakPanel の keys.set ('${label}') が例外を投げました。`, e);
  }
};

// 1 プロパティ分の行を組み立てる。`override.get`/`set` が指定されていれば data[k] を
// 一切読み書きせず (folder としての解釈もしない = 常に leaf 行)、それ以外は従来どおり
// data[k] を読み書きする (パイロット移行の報告 #1)。
const buildDataDrivenRow = (k: string, data: Record<string, unknown>, ov: TweakKeyOverride | undefined, pathPrefix: string, ctx: FolderCtx): RicNode => {
  const path = pathPrefix ? `${pathPrefix}.${k}` : k;
  const label = (ov && ov.label) || k;
  const hasGetOverride = typeof ov?.get === 'function';
  const hasSetOverride = typeof ov?.set === 'function';

  if (hasGetOverride || hasSetOverride) {
    const value = hasGetOverride ? safeGetOverrideValue(label, ov!.get!) : undefined;
    return buildRow({
      label,
      value,
      set: hasSetOverride ? (val: unknown) => { safeSetOverrideValue(label, ov!.set!, val); ctx.notify(); } : undefined,
      override: ov,
      path,
    });
  }

  const v = data[k];
  if (isPlainObject(v)) return buildFolder(path, label, v, ov, ctx);
  return buildRow({
    label,
    value: v,
    set: (val: unknown) => {
      data[k] = val;
      ctx.notify();
    },
    override: ov,
    path,
  });
};

const buildRows = (data: Record<string, unknown>, keys: TweakKeys, pathPrefix: string, ctx: FolderCtx): RicNode[] => {
  const rows: RicNode[] = [];
  const dataKeys = new Set(Object.keys(data));

  for (const k of Object.keys(data)) {
    const ov = keys[k];
    if (ov === false) continue;
    rows.push(buildDataDrivenRow(k, data, ov, pathPrefix, ctx));
  }

  // keys だけで宣言された計算値行 (data に同名キーが無く、get が指定されているものだけ)。
  // 宣言順は keys の Object.keys 順、data 由来の行の後ろに置く (パイロット移行の報告 #1)。
  for (const k of Object.keys(keys)) {
    if (dataKeys.has(k)) continue;
    const ov = keys[k];
    if (!ov || typeof ov.get !== 'function') continue;
    rows.push(buildDataDrivenRow(k, data, ov, pathPrefix, ctx));
  }

  return rows;
};

// ─────────────────────────────────────────────────────────────
// createTweakPanel
// ─────────────────────────────────────────────────────────────

let nextFactoryId = 0;

/**
 * dat.GUI 風のパラメータ調整パネルを作る。状態を持つため `app.use(createTweakPanel())` で登録する。
 *   const tweak = app.use(createTweakPanel());
 *   tweak({ title: 'パラメータ', data: s.params })
 */
export const createTweakPanel = (): TweakPanelInstance => {
  const fid = ++nextFactoryId;
  const guard: AttachGuard = createAttachGuard('createTweakPanel');
  const openMap: Record<string, boolean> = {};

  const inst = ((props: TweakPanelProps = {}): RicNode => {
    const host = guard.ensure();
    if (!host) return null;

    const { title, data, keys = {}, rows = [], width, style, class: extraClass } = props;
    const notify = (): void => guard.host?.notify();
    const ctx: FolderCtx = { fid, openMap, notify };

    // data 省略でも keys だけで get 行を宣言できる (パイロット移行の報告 #1)。
    const autoRows = data || Object.keys(keys).length > 0 ? buildRows(data ?? {}, keys, '', ctx) : [];

    const mergedStyle: StyleValue = {
      ...(width != null ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
      ...(style ?? {}),
    };

    return {
      tag: 'div',
      class: mergeClass('ric-tweak', extraClass),
      'data-ricdom-role': UI_ROLE.tweakPanel,
      // range のドラッグ中にネイティブ DnD が始まるのを抑止 (v1 継承)
      ondragstart: (ev: DragEvent) => {
        ev.preventDefault();
      },
      ...(Object.keys(mergedStyle).length ? { style: mergedStyle } : {}),
      children: [
        ...(title != null ? [{ tag: 'div', class: 'ric-tweak__title', 'data-ricdom-role': UI_ROLE.tweakTitle, children: [title] } as RicElementNode] : []),
        ...autoRows,
        ...rows,
      ],
    } as unknown as RicElementNode;
  }) as TweakPanelInstance;

  inst.attach = guard.attach;
  inst.dispose = (): void => {
    for (const k of Object.keys(openMap)) delete openMap[k];
    guard.dispose();
  };
  inst.isOpen = (path: string): boolean => !!openMap[path];

  return inst;
};
