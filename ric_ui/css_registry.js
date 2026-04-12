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

module.exports = { collect_classes, build_css };
