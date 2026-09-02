// ricdom/ui — popup 系の排他制御レジストリ
//
// v1 の `_popup_registry` (popup/_popup_utils.js) はモジュールレベルの配列で、
// `create_ui_popup()` を呼ぶたびに無条件で push されるだけで削除 API が無かった
// (設計書 B13、`use()` の dispose で解消する負債の 1 つ)。
//
// v2 は「1 つ開いたら同じ app 内の他を閉じる」という排他の意味自体は引き継ぎつつ、
// 対象を `host.app` 単位に絞る (設計書の指示: 「host.app 単位、use() 登録時に app の
// レジストリへ、dispose で解除」)。`host.app` は `App<any>` の Proxy インスタンスで
// createApp() ごとに一意なので、これを WeakMap のキーにする — app が GC されれば
// レジストリごと回収される (v1 の無制限成長問題が構造的に起きない)。
//
// createPopup (menu) と createDropdown (popover) の両方がここを共有する。
// 「popup 系」全体で 1 つ開いたら他を閉じる、という UX 上の意味も v1 を踏襲する
// (メニューとドロップダウンが同時に複数開いているのは基本的にユーザーの意図に反する)。

export interface Exclusive {
  close(): void;
}

const registries = new WeakMap<object, Set<Exclusive>>();

/** use() 登録時に呼ぶ。app のレジストリに self を追加する。 */
export const registerExclusive = (app: object, self: Exclusive): void => {
  let set = registries.get(app);
  if (!set) {
    set = new Set();
    registries.set(app, set);
  }
  set.add(self);
};

/** dispose 時に呼ぶ。app のレジストリから self を削除する。 */
export const unregisterExclusive = (app: object, self: Exclusive): void => {
  registries.get(app)?.delete(self);
};

/** self が開くタイミングで呼ぶ。同じ app に登録された他の Exclusive を全て閉じる。 */
export const closeOthers = (app: object, self: Exclusive): void => {
  const set = registries.get(app);
  if (!set) return;
  for (const other of set) {
    if (other !== self) other.close();
  }
};
