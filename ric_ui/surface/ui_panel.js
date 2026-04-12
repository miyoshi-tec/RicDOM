// RicUI — ui_panel
// 面・背景・枠を担当するコンテナ（surface カテゴリ）。
// 文字色・フォントは親から CSS 継承。面だけを担当する。
//
// layout: 'col'（デフォルト）| 'row'
//   子を縦並び / 横並びにする。gap は --ric-gap-md を使用。

'use strict';

const { make_css_vars } = require('../context');

// style オブジェクトを cssText 文字列に変換するヘルパー
// camelCase キーを kebab-case に変換する
const _style_to_string = (obj) => {
  if (typeof obj === 'string') return obj;
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`)
    .join('; ');
};

const ui_panel = ({ ctx = [], layout = 'col', style = {},
                    theme, density, font_size, disabled = false } = {}) => {
  const cls = layout === 'row' ? 'ric-panel ric-panel--row' : 'ric-panel';

  // テーマ上書き: CSS 変数文字列をインラインスタイルに注入
  // RicDOM の normalize_style は配列内の文字列をスキップするため、
  // 文字列同士を連結して cssText として渡す
  const has_override = theme !== undefined || density !== undefined || font_size !== undefined;
  const has_style    = typeof style === 'string' ? style.length > 0 : Object.keys(style).length > 0;

  // disabled: 半透明 + inert 属性で子孫すべてのクリック・フォーカス・選択を無効化
  const disabled_css = disabled ? 'opacity: 0.45' : '';

  // スタイルを組み立て（テーマ上書き + ユーザー style + disabled）
  const parts = [
    has_override ? make_css_vars({ theme, density, font_size }) : '',
    has_style    ? _style_to_string(style) : '',
    disabled_css,
  ].filter(Boolean);

  const final_style = parts.length ? parts.join('; ') : null;

  return {
    tag: 'section',
    class: cls,
    ...(final_style ? { style: final_style } : {}),
    // inert: クリック・Tab フォーカス・テキスト選択を子孫すべてで無効化
    ...(disabled ? { inert: '' } : {}),
    ctx,
  };
};

// ────────────────────────────────────────────────────────────
// create_ui_panel
// 内部状態（theme / density / font_size / disabled / layout）を持つ
// 呼び出し可能な関数を返す。
//
// s のトップレベルに代入して使う。RicDOM の一段目 Proxy が
// プロパティ変更を検知して自動再描画する。
//
// 使い方:
//   s.dark ??= create_ui_panel({ theme: 'dark', density: 'compact' });
//   s.dark({ ctx: [...] })          // 描画
//   s.dark.density = 'comfortable'; // 設定変更 → 自動再描画
//   s.dark.disabled = true;
//
// 設定の読み取り:
//   s.dark.theme     // 'dark'
//   s.dark.disabled  // true
// ────────────────────────────────────────────────────────────
const create_ui_panel = (initial = {}) => {
  // 呼び出し可能な関数にプロパティを載せる
  // RicDOM の子 Proxy がプロパティ変更を検知するため、
  // 内部 Proxy は不要
  const inst = (props = {}) => ui_panel({
    theme:     inst.theme,
    density:   inst.density,
    font_size: inst.font_size,
    disabled:  inst.disabled,
    layout:    inst.layout,
    ...props,
  });

  // 設定プロパティ（直接読み書き可能）
  inst.theme     = initial.theme     ?? undefined;
  inst.density   = initial.density   ?? undefined;
  inst.font_size = initial.font_size ?? undefined;
  inst.disabled  = initial.disabled  ?? false;
  inst.layout    = initial.layout    ?? 'col';

  return inst;
};

module.exports = { ui_panel, create_ui_panel };
