// RicUI — ui_textarea
// 複数行テキスト入力フィールド（control カテゴリ）。
// ui_input の <textarea> 版で、`auto_resize` オプションで内容量に応じて
// 高さを自動調整できる。
//
// 使い方（固定高さ）:
//   ui_textarea({
//     value: s.input, oninput: (e) => { s.input = e.target.value; },
//     placeholder: 'メッセージ…', rows: 3,
//   })
//
// 使い方（自動リサイズ）:
//   ui_textarea({
//     value: s.input, oninput: (e) => { s.input = e.target.value; },
//     auto_resize: { min_rows: 1, max_rows: 5 },  // 超えたらスクロールバー
//   })
//
// rest スプレッド:
//   onchange / onkeydown / id / data-* / aria-* / style 等を透過する。
//   rest を先頭に展開してから計算済み tag / class / value / oninput で
//   上書きするため、基底クラス `ric-textarea` は保たれる。

'use strict';

// DOM 要素に対して自動リサイズを適用する。
// render の oninput ハンドラ内から呼ばれる。
// line-height / padding を computed style から取得して
// scrollHeight と min/max 行数でクランプする。
const _do_resize = (el, auto_resize) => {
  if (!el || !auto_resize) return;
  // SSR / Node 単体環境では getComputedStyle も el.style も使えないので即 return。
  if (typeof window === 'undefined') return;
  const { min_rows = 1, max_rows = null } = auto_resize;
  // 現在の高さをリセットして scrollHeight を正しく測る
  el.style.height = 'auto';
  const cs = window.getComputedStyle(el);
  const line_h = parseFloat(cs.lineHeight) || 22;
  const pad    = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const min_h  = min_rows * line_h + pad;
  const max_h  = max_rows != null ? (max_rows * line_h + pad) : Infinity;
  const new_h  = Math.min(Math.max(el.scrollHeight, min_h), max_h);
  el.style.height     = new_h + 'px';
  el.style.overflowY  = (el.scrollHeight > max_h) ? 'auto' : 'hidden';
};

const ui_textarea = ({
  value       = '',
  placeholder = '',
  oninput     = null,
  onkeydown   = null,
  disabled    = false,
  rows        = 1,
  maxlength   = null,
  auto_resize = null,    // null または { min_rows, max_rows }
  ...rest
} = {}) => {
  // auto_resize 指定時は oninput で高さを再計算してから本来のハンドラを呼ぶ。
  // oninput / auto_resize のどちらかが指定されていれば合成ハンドラを付ける。
  const handle_input = (oninput || auto_resize)
    ? (e) => {
        _do_resize(e.target, auto_resize);
        oninput?.(e);
      }
    : null;

  return {
    ...rest,
    tag:   'textarea',
    class: rest.class ? 'ric-textarea ' + rest.class : 'ric-textarea',
    rows:  auto_resize ? (auto_resize.min_rows ?? 1) : rows,
    value,
    ...(placeholder       ? { placeholder }    : {}),
    ...(handle_input      ? { oninput: handle_input } : {}),
    ...(onkeydown         ? { onkeydown }      : {}),
    ...(disabled          ? { disabled: true } : {}),
    ...(maxlength != null ? { maxlength }      : {}),
  };
};

module.exports = { ui_textarea };
