// RicUI — CSS Registry
// 完成済み RicDOM デスクリプタツリーから ric-* クラスを収集し、
// 必要な CSS テンプレートだけを連結して返す。
//
// 設計方針:
//   - 子コンポーネントはすでに完成済みデスクリプタを返している
//   - create_ui_page の inst が呼ばれた時点で ctx の中はすべて評価済み
//   - collect_classes がツリーを再帰走査して ric-* クラスを収集する
//   - バリアントクラス（ric-button--primary など）はベースクラス
//     テンプレートが内包しているため、収集対象に含めるが
//     テンプレートが存在しない場合は単に空文字を返すだけ

'use strict';

const { CSS_TEMPLATES } = require('./css_templates');

// ──────────────────────────────────────────────
// collect_classes: デスクリプタツリーから ric-* クラスを収集
// ──────────────────────────────────────────────

const collect_classes = (node, used = new Set()) => {
  // テキストノード・null・undefined はスキップ
  if (!node || typeof node !== 'object') return used;

  // 配列の場合は各要素を再帰処理
  if (Array.isArray(node)) {
    node.forEach(n => collect_classes(n, used));
    return used;
  }

  // class 属性から CSS テンプレート対象クラスを抽出
  // ric-* プレフィックスまたは CSS_TEMPLATES にキーが存在するクラスを収集
  // （ビルド時の CSS クラス名短縮で ric-xxx__yyy → r0 等に変わるため）
  if (typeof node.class === 'string') {
    node.class.split(' ')
      .filter(c => c.startsWith('ric-') || CSS_TEMPLATES[c])
      .forEach(c => used.add(c));
  }

  // ctx（子ノード配列）を再帰走査
  if (Array.isArray(node.ctx)) {
    node.ctx.forEach(n => collect_classes(n, used));
  }

  return used;
};

// ──────────────────────────────────────────────
// build_css: 使用クラスセットから CSS 文字列を生成
// キャッシュを持ち、セット内容が変わらなければ再生成しない
// ──────────────────────────────────────────────

let _cache_key = '';
let _cache_val = '';

const build_css = (used) => {
  // 使用クラスをソートして文字列化をキャッシュキーに使う
  const key = [...used].sort().join(',');
  if (key === _cache_key) return _cache_val;

  // テンプレートが存在するクラスの CSS だけ連結する
  _cache_key = key;
  _cache_val = [...used]
    .map(cls => (CSS_TEMPLATES[cls] ? CSS_TEMPLATES[cls]() : ''))
    .filter(Boolean)
    .join('\n');

  return _cache_val;
};

// ──────────────────────────────────────────────
// css_for: 「使う分だけ」CSS を取り出す公式ルート（v0.3.34〜）
//
// create_ui_page で包めない/包みたくない mount（例: 別 iframe、外部ウィジェット
// ホスト、ページ全体を RicUI 管理下に置きたくない既存アプリへの部分導入）向けに、
// page が内部でやっている「使用クラス → CSS 連結」を公開する。
// page 注入と**同一の build_css / CSS_TEMPLATES** を通るので、規則は常に一致する。
//
// 使い方（page なしで styled にマウントする 3 点セット）:
//   { tag: 'div', class: 'ric-page', style: make_css_vars({ theme: 'dark' }), ctx: [
//     { tag: 'style', ctx: [css_for('ric-button')] },
//     ui_button({ ctx: ['OK'] }),
//   ]}
//   ※ CSS_TEMPLATES の規則は `.ric-page ` スコープ（css_templates.js の `_P`）なので、
//     wrapper 側にも `class: 'ric-page'` が必要（テーマ変数は make_css_vars が
//     ルート要素の style に注入する。:root は使わないので他の .ric-page と衝突しない）。
//
//   css_for('ric-button', 'ric-input')  // 複数テンプレートを連結
//   css_for()                            // 引数省略 → 全テンプレート（公式に許可）
//
// 未知のキー（タイポ等）は console.warn の上でスキップする（例外は投げない —
// RicDOM 全体の「エラーは console.error + フォールバック、throw しない」方針に倣う）。
// ──────────────────────────────────────────────

const css_for = (...names) => {
  const all_keys = Object.keys(CSS_TEMPLATES);

  // 引数なし → 全テンプレート
  if (names.length === 0) {
    return build_css(new Set(all_keys));
  }

  const used = new Set();
  names.forEach((name) => {
    if (CSS_TEMPLATES[name]) {
      used.add(name);
    } else {
      console.warn(`[RicUI] css_for: 未知のクラス "${name}" (テンプレート一覧: ${all_keys.join(', ')})`);
    }
  });
  return build_css(used);
};

module.exports = { collect_classes, build_css, css_for };
