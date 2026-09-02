// RicDOM 2 — 型定義
//
// 設計書 (docs/DESIGN.ja.md) §3.1 の記述をそのまま実装するが、`Node` / `Element` という
// 型名は DOM 標準の `lib.dom.d.ts` が既にグローバルへ ambient 宣言しているため、
// そのまま同名でエクスポートすると利用側ファイルで DOM の `Node`/`Element` を
// import で shadow してしまう事故が起きる (このライブラリ自身が `Element` を
// 内部で multiple 回使うのもあり、テストコードで混乱しやすい)。
// そのため本実装では `RicNode` / `RicElementNode` という名前でエクスポートする
// (設計書との差異。詳細は最終報告に記載)。

// =====================================================================
// class / style
// =====================================================================

/** class の 3 形態 (v1 は文字列/配列のみ。v2 は React 由来の Record<string,boolean> も足す) */
export type ClassValue = string | string[] | Record<string, boolean>;

/** style は object 限定 (v1 の string/object/array 3 形態を 1 つに統一、設計書 §3.1) */
export type StyleValue = Record<string, string | number>;

// =====================================================================
// 属性型の導出 (タグ名 → 属性型)
// =====================================================================

// data-*/aria-* は全タグ共通で許可する (React 等の慣例に合わせる)。
// テンプレートリテラル型のキーなので、他の未知プロパティまでは許可しない
// (= href のような無関係な属性は依然として型エラーになる)。
type DataAriaAttrs = {
  [key: `data-${string}`]: string | number | boolean;
  [key: `aria-${string}`]: string | number | boolean;
};

// IDL プロパティのうち「プリミティブ値を持つもの」だけを属性候補として拾う。
// 関数 (メソッド) や複雑なオブジェクト (dataset, style, classList, files, ...) は
// 自動的に除外される。null 許容の IDL (href, textContent 等) も拾えるよう
// null/undefined を許容範囲に含める。
type PrimitiveIdlValue = string | number | boolean | null | undefined;

type AttrKeys<T> = {
  [K in keyof T]: T[K] extends PrimitiveIdlValue ? K : never;
}[keyof T];

// class / id / style / children は BaseNodeProps 側で個別に型定義するため、
// IDL 側の同名・類似プロパティ (className 等) は自動導出から除外する。
type ExcludedIdlKeys = 'className' | 'id';

/** タグ固有の属性型 (例: HTMLInputElement → value/checked/placeholder... ) */
type TagAttrs<T> = Partial<Pick<T, Exclude<AttrKeys<T>, ExcludedIdlKeys>>> & DataAriaAttrs;

// on* イベントハンドラ。HTMLElementEventMap の全イベント種に対して型付きハンドラを導出する。
// (要素種別ごとの厳密なイベント発火可否までは区別しない = 実用上十分な粒度)
type EventProps<E extends Element> = {
  [K in keyof HTMLElementEventMap as `on${K}`]?: (this: E, ev: HTMLElementEventMap[K]) => void;
};

interface BaseNodeProps {
  /** DOM の id 属性 */
  id?: string;
  /** class の 3 形態 (文字列 / 配列 / 真偽値マップ) */
  class?: ClassValue;
  /** inline style。object のみ (v1 の string/array 形態は廃止) */
  style?: StyleValue;
  /** 子要素 (v1 の `ctx` 後継、設計書 §3.1 で確定) */
  children?: RicNode | RicNode[];
  /**
   * 島フラグ。true の要素は子孫の diff/build を一切行わない
   * (v1 の「ctx 省略で島扱い」を廃止し、明示フラグに変更。設計書 §3.1 判断 e)。
   */
  island?: true;
  /** key-based reconciliation 用の論理 ID (設計書 §3.2 / v1 A5 継承) */
  key?: string | number;
  /** app.refs.get(name) で参照できる名前 (data-ricdom-ref 属性として管理) */
  ref?: string;
}

// HTMLElementTagNameMap と SVGElementTagNameMap は 'a'/'title'/'script'/'style' 等の
// タグ名が重複しており、両者を単純に `&` でマージすると href のようなプロパティの型が
// `string & SVGAnimatedString` のような充足不可能な交差型になってしまう。
// タグ名が重複する場合は HTML 側の定義を優先する (SVG 内 `<a>` 等の稀なケースより、
// 通常の HTML 要素として使われる頻度の方が圧倒的に高いため)。
type TagElementMap = Omit<SVGElementTagNameMap, keyof HTMLElementTagNameMap> & HTMLElementTagNameMap;
type KnownTag = keyof TagElementMap;

/** 既知タグ (HTMLElementTagNameMap / SVGElementTagNameMap) の判別可能ユニオン */
type KnownElementNode = {
  [K in KnownTag]: { tag: K } & BaseNodeProps & TagAttrs<TagElementMap[K]> & EventProps<TagElementMap[K]>;
}[KnownTag];

/**
 * 未知タグ (custom element 等)。汎用属性 (HTMLElement 共通のプリミティブ IDL + data-* / aria-*)
 * のみを許可する。ここを `Record<string, unknown>` のような無制限の index signature に
 * すると、TypeScript の union 型に対する excess-property-check が「他の分岐で弾かれても
 * この分岐でなら通ってしまう」ため、既知タグの厳密チェック (`{ tag:'input', href:'' }` を
 * 型エラーにする) が骨抜きになる。属性を絞ることでその抜け道を作らずに未知タグにも
 * 対応できる。
 */
type GenericElementNode = { tag: string } & BaseNodeProps & TagAttrs<HTMLElement> & EventProps<HTMLElement>;

/**
 * ノード木の要素表現 (設計書 §3.1 の `Element`)。
 * `tag` は型上必須 (Phase 1 実装での確定事項、設計書 §12)。`{}` のような tag 省略は
 * 型エラーになる (v1 は `raw_node.tag ?? 'div'` で暗黙に div 扱いだったが、v2 では
 * 「省略」という無記名の入力を許さず、明示を要求する)。実行時に tag が文字列でない
 * ノードが渡された場合 (JS 利用側が型チェックをすり抜けた場合) は console.error を出し
 * 不可視ノードとして扱う (throw しない方針の継承、normalize.ts 参照)。
 */
export type RicElementNode = KnownElementNode | GenericElementNode;

/**
 * ノード木の全体表現 (設計書 §3.1 の `Node`)。
 * 文字列/数値はテキスト、null/false/undefined は不可視 (v1 継承)。
 */
export type RicNode = string | number | null | false | undefined | RicElementNode | RicNode[];

// =====================================================================
// App / createApp
// =====================================================================

/**
 * 状態を持つ部品の最小契約 (Phase 1 では骨のみ)。
 * Phase 2 で `app.use(createDialog())` の正式な部品契約を実装する際、
 * ここに portal ホストや dispose 等が足される (設計書 §3.4)。
 */
export interface UsePart {
  /** app.use() に登録された瞬間に呼ばれる。再描画をトリガーする notify を受け取る。 */
  onUse?: (ctx: { notify: () => void }) => void;
  /** app.unmount() 等で登録解除される際に呼ばれる (Phase 2 で dispose 契約と統合予定) */
  onDispose?: () => void;
}

/**
 * render 関数の型。現在の state (S、v1 の shared_proxy 相当で renderNow/refs 等の
 * instance API は含まない) を受け取り木を返す。
 * `createApp(target, state, render)` の第 3 引数として渡す (Phase 1 実装での確定事項、
 * 設計書 §12)。render を state から分離することで `S` が `state` 引数から素直に推論され、
 * render コールバック内の `s` も (無理な自己参照無しに) 完全に型付く。
 */
export type RenderFn<S extends object> = (state: S) => RicNode;

/** createApp が返すインスタンスハンドル。state そのもの (Proxy) + 操作 API。 */
export type App<S extends object> = S & {
  /**
   * 現在の render 関数。`createApp` の第 3 引数として渡した関数がここに入る。
   * 後から `app.render = fn` で差し替えることもできる (v1 踏襲) — 差し替えは
   * 同期的に再描画をトリガーする。
   */
  render: RenderFn<S>;
  /** 保留中の描画があればキャンセルして同期的に即描画する (v1 の render_now 継承) */
  renderNow(): void;
  /**
   * 次に完了する render を待つ Promise。render 予約が無ければ resolve しない
   * (v1 の next_render 契約継承、設計書 §3.3)。
   */
  nextRender(): Promise<void>;
  /** 部品を登録する (Phase 1 では骨のみ。Phase 2 で正式な部品契約になる) */
  use<T extends UsePart>(part: T): T;
  /** インスタンスを破棄し、以降の再描画・タイマーを止める */
  unmount(): void;
  /** ref 名 → DOM 要素。render 後に再収集される */
  readonly refs: ReadonlyMap<string, Element>;
};
