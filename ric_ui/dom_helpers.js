// RicUI — DOM ヘルパー
// VDOM / state 機構に乗らない、純粋な DOM 操作系のユーティリティ。
//
// 設計方針: ここに置く関数は最小限に保つ。VDOM で表現できることは VDOM 側で
// 解決する。どうしても document / window 直接アクセスが必要なものだけ集める。

'use strict';

// ── watch_outside_click(callback) ─────────────────────────────────
//
// document に click listener を 1 つだけ取り付け、bubble してきたクリックで
// callback を呼ぶ。戻り値は unsubscribe 関数（テスト / unmount で使う）。
//
// 主用途: ui_inline_menu や create_ui_popup と組で「外クリックで閉じる」を
// 実装する。ui_inline_menu の onclick は e.stopPropagation() するので、ここで
// 渡した callback は **menu の外をクリックしたとき** だけ走る。
//
// 例:
//   const unsub = watch_outside_click(() => { handle.menu_for = null; });
//   // テスト / unmount 時に
//   unsub();
//
// 複数 menu / dropdown が共存するアプリでも listener は 1 個で十分。
// state を集約して 1 callback で全部閉じれば、各 menu ごとに listener を
// 張る必要はない（行数分の DOM listener を避けるため意図的な設計）。
//
// 注意:
//   - document が存在する環境（ブラウザ / jsdom）が前提
//   - capture phase は使わない（trigger 自体のクリックは中で
//     state を更新するため、document に届く前に setter が走って OK）

const watch_outside_click = (callback) => {
  const handler = (e) => callback(e);
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
};

module.exports = { watch_outside_click };
