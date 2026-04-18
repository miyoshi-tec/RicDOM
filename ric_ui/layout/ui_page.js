// RicUI — create_ui_page
// Context root ＆ style タグ管理者。
//
// 内部状態（theme / density / font_size）を持つ呼び出し可能な関数を返す。
// プロパティ代入で動的に変更できる。
//
// 使い方:
//   s.page = create_ui_page({ theme: 'dark', density: 'compact' });
//   s.page({ ctx: [...] })          // 描画
//   s.page.theme = 'cyber';         // 設定変更 → 自動再描画
//   s.page.density = 'comfortable';
//
// 責務:
//   1. CSS variables を確定して ric-page div の style に注入する
//   2. ポータルキュー（ポップアップ VDOM）を ctx 末尾に自動展開する
//   3. 完成済み ctx ツリーを走査して使用 ric-* クラスを収集する
//   4. 必要な CSS だけを <style> タグとして先頭に出力する
//
// ポータルパターン:
//   create_ui_popup / create_ui_tooltip / create_ui_dialog / create_ui_toast が
//   開いているとき、オーバーレイ＋ポップアップを _page_portal_queue に積む。
//   描画時に drain() で全件取り出して ctx 末尾に展開する。
//   これにより .ric-panel の backdrop-filter が position:fixed の CB になる
//   問題（stacking context 汚染）を回避できる。

'use strict';

const { make_css_vars }              = require('../context');
const { collect_classes, build_css } = require('../css_registry');
const _portal                         = require('../popup/_page_portal_queue');

// style がオブジェクトなら CSS 文字列に変換する小ヘルパー
const _style_to_str = (s) => typeof s === 'object' && !Array.isArray(s)
  ? Object.entries(s).map(([k, v]) => `${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}: ${v}`).join(';')
  : String(s || '');

const create_ui_page = (initial = {}) => {
  // rest: onclick / id / data-* / aria-* 等の任意属性を透過する
  //       （ui_button / ui_input / ui_panel 等と同じ流儀）
  const inst = ({ ctx = [], style: extra_style = '', ...rest } = {}) => {

    // ポータルキューを取り出す（drain: create_ui_page 経由では begin() 済み）
    const portals = _portal.drain();

    // ポータルを ctx 末尾に展開する
    // .ric-page の直接の子になるため backdrop-filter の影響を受けない
    const full_ctx = portals.length ? [...ctx, ...portals] : ctx;

    // 子ツリーから使用 ric-* クラスを収集する（ポータル含む）
    // ric-page 自身は走査対象の外にあるため手動で追加する
    const used = collect_classes(full_ctx);
    used.add('ric-page');

    // 使用クラスに対応する CSS だけを連結（キャッシュあり）
    const css = build_css(used);

    // CSS variables をベースに、ユーザー指定 style をマージ
    // extra_style は文字列・オブジェクト・配列のいずれも受け付ける
    const base_style = make_css_vars({
      theme:     inst.theme,
      density:   inst.density,
      font_size: inst.font_size,
    });
    const page_style = extra_style ? base_style + ';' + _style_to_str(extra_style) : base_style;

    // rest を先に展開してから、計算済みの tag/class/style/ctx で上書きする。
    // これにより onclick / id / data-* 等が DOM に透過される。
    return {
      ...rest,
      tag: 'div',
      class: rest.class ? 'ric-page ' + rest.class : 'ric-page',
      // CSS variables + ユーザー style をルート div に注入する
      // 子孫は CSS 変数を通じてテーマ・密度を受け取る
      style: page_style,
      ctx: [
        // <style> を先頭に置くことで子要素より先に CSS が適用される
        { tag: 'style', ctx: [css] },
        ...full_ctx,
      ],
    };
  };

  inst.theme     = initial.theme     ?? 'light';
  inst.density   = initial.density   ?? 'comfortable';
  inst.font_size = initial.font_size ?? 'md';

  // グローバル設定同期:
  // window に 'ric-theme-change' イベントが dispatch されたら、
  // 自分の theme/density/font_size を更新して再描画をトリガーする。
  // これにより nav_bar 等の外部コンポーネントが設定を変更した時、
  // すべての create_ui_page インスタンスが自動で追従する。
  // __notify は create_RicDOM の set trap が注入する（s.page = inst 時）。
  if (typeof window !== 'undefined') {
    window.addEventListener('ric-theme-change', (e) => {
      const { key, value } = e.detail ?? {};
      if (key === 'theme' || key === 'density' || key === 'font_size') {
        inst[key] = value;
        inst.__notify?.();
      }
    });
  }

  return inst;
};

module.exports = { create_ui_page };
