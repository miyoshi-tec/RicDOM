// RicUI — ポータルキュー（スタック方式）
// 複数の ui_page が1ページに共存できるよう、スタック構造でキューを管理する。
//
// フロー（単一 ui_page の場合 = 従来互換）:
//   1. popup/dialog 等が push() → デフォルトバッファに積まれる
//   2. ui_page が drain() → デフォルトバッファを取り出す
//
// フロー（複数 ui_page の場合）:
//   1. begin() で新しいスタックフレームを作成
//   2. popup/dialog 等が push() → スタック top のフレームに積まれる
//   3. ui_page が drain() → スタック top を pop して返す
//
// JS はシングルスレッドで render は同期実行されるため競合しない。

'use strict';

// デフォルトバッファ（begin() が呼ばれていないときに使われる）
let _default_buf = [];

// スタック（begin/drain で管理される追加フレーム）
const _stack = [];

// 新しいスタックフレームを開始（複数 ui_page 対応時に使用）
const begin = () => { _stack.push([]); };

// ポータルを積む（スタック top があればそこに、なければデフォルトバッファに）
const push = (...items) => {
  const target = _stack.length > 0 ? _stack[_stack.length - 1] : _default_buf;
  target.push(...items);
};

// ポータルを取り出す（スタック top があれば pop、なければデフォルトバッファを drain）
const drain = () => {
  if (_stack.length > 0) return _stack.pop();
  const items = _default_buf;
  _default_buf = [];
  return items;
};

module.exports = { begin, push, drain };
