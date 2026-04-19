// RicUI — ポップアップ共通ユーティリティ
// create_ui_popup / create_ui_tooltip が共有する位置計算・スタイル生成・
// 排他制御ヘルパー群。（旧称 create_ui_dropdown / create_ui_menu は
// create_ui_popup に統合済み）

'use strict';

// ── 方向判定 ──────────────────────────────────────────────────────
// trigger の下に content_h px 収まるか判定して 'below' | 'above' を返す。
// 収まらない場合でも上のスペースより下のスペースが大きければ 'below'。
const make_popup_dir = (trigger_el, content_h) => {
  const rect        = trigger_el.getBoundingClientRect();
  const space_below = window.innerHeight - rect.bottom;
  return (space_below >= content_h || space_below >= rect.top)
    ? 'below' : 'above';
};

// ── position:fixed スタイル文字列 ─────────────────────────────────
// ポータル配置のため z-index:401 固定。
// オーバーレイも z:401 だが、DOM 順でポップアップが後方に置かれるため
// 自然に前面になる。
const _pos_style = (pos) => {
  const p = ['position:fixed', 'z-index:401'];
  if (pos.top    !== undefined) p.push('top:'    + pos.top    + 'px');
  if (pos.bottom !== undefined) p.push('bottom:' + pos.bottom + 'px');
  if (pos.left   !== undefined) p.push('left:'   + pos.left   + 'px');
  if (pos.right  !== undefined) p.push('right:'  + pos.right  + 'px');
  if (pos.width    !== undefined) p.push('width:'     + pos.width    + 'px');
  if (pos.minWidth !== undefined) p.push('min-width:' + pos.minWidth + 'px');
  return p.join(';');
};

// ── Containing Block 取得（ポータル版）────────────────────────────
// ポップアップは .ric-page の直接の子として配置されるため、
// .ric-page 内の backdrop-filter（cyber/aqua テーマ）の影響を受けない。
// .ric-page の外側（親方向）を検索することで正しい CB を取得する。
// ※ scrollbar を除いた clientWidth/clientHeight を使う（window.innerWidth は不可）
const _get_portal_cb = (trigger_el) => {
  const page = trigger_el.closest('.ric-page');
  let ancestor = page ? page.parentElement : trigger_el.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    const cs = getComputedStyle(ancestor);
    if (cs.backdropFilter !== 'none' || cs.transform !== 'none' || cs.filter !== 'none') {
      return ancestor.getBoundingClientRect();
    }
    ancestor = ancestor.parentElement;
  }
  return {
    top:    0,
    left:   0,
    right:  document.documentElement.clientWidth,
    bottom: document.documentElement.clientHeight,
  };
};

// ── 展開方向の基準コンテナ取得 ────────────────────────────────────
// expand_right 判定には、ビューポート全体ではなく
// 視覚的なパネルを基準にしたい（CB とは別に必要）。
// ビューポート幅の 85% 未満の最初の祖先 BBox を返す。
const _get_expand_ref = (el) => {
  const vw = document.documentElement.clientWidth;
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    const r = ancestor.getBoundingClientRect();
    // 意味のある幅（80px 以上）かつビューポートより十分狭ければ論理コンテナとみなす
    if (r.width >= 80 && r.width < vw * 0.85) return r;
    ancestor = ancestor.parentElement;
  }
  return { left: 0, right: vw };
};

// ── 排他制御 ──────────────────────────────────────────────────────
// モジュールレベルで全ポップアップを管理。
// 1つ開いたら他を全て閉じる（画面全体で排他）。
const _popup_registry = [];

const _register_popup = (inst) => {
  _popup_registry.push(inst);
};

const _close_others = (self) => {
  _popup_registry.forEach(p => { if (p !== self) p.close(); });
};

module.exports = { make_popup_dir, _pos_style, _get_portal_cb, _get_expand_ref, _register_popup, _close_others };
