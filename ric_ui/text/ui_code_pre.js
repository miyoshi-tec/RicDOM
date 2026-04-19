// RicUI — ui_code_pre
// コード・JSON をダークテーマの <pre> で表示する部品。
//
// テーマに関わらず常にダーク表示とする（コードブロックの慣習）。
// window.hljs（highlight.js）が存在する場合は自動でシンタックスハイライトを適用する。
//
// 使い方：
//   // 文字列をそのまま表示（hljs があれば自動検出でハイライト）
//   ui_code_pre({ ctx: ['const x = 1;'] })
//
//   // 言語を明示する
//   ui_code_pre({ ctx: [code], lang: 'javascript' })
//
//   // オブジェクトは obj に渡すと JSON.stringify → JSON ハイライト
//   ui_code_pre({ obj: { count: s.count, name: s.name } })
//
//   // 高さ制限あり（超えるとスクロール）
//   ui_code_pre({ obj: s, max_height: '200px' })
//
// Props:
//   ctx        {string[]}       表示テキスト（RicDOM 標準の子ノード形式）
//   obj        {object}         JSON.stringify して表示するオブジェクト
//                               （渡すと ctx より優先される）
//   lang       {string}         hljs 言語ヒント（'auto' | 'javascript' | 'json' | ...）
//                               obj を渡した場合は自動で 'json' になる
//   max_height {string|null}    最大高さ（'200px' など）。省略で制限なし

'use strict';

// window.hljs でシンタックスハイライトを試みる。
// 成功時は hljs が生成した HTML 文字列を返す。失敗時は null。
const _try_highlight = (raw, lang) => {
  if (typeof window === 'undefined' || typeof window.hljs === 'undefined') return null;
  try {
    const result = lang === 'auto'
      ? window.hljs.highlightAuto(raw)
      : window.hljs.highlight(raw, { language: lang });
    return result.value;
  } catch (_) {
    // 未知の言語や hljs エラーはプレーンテキストにフォールバック
    return null;
  }
};

const ui_code_pre = ({
  ctx        = [],
  obj        = undefined,
  lang       = 'auto',
  max_height = null,
  ...rest
} = {}) => {
  // obj が渡された場合は JSON 文字列に変換する（言語は常に json）
  const raw           = obj !== undefined ? JSON.stringify(obj, null, 2) : ctx.join('');
  const effective_lang = obj !== undefined ? 'json' : lang;

  // hljs が利用可能ならハイライトした HTML を innerHTML で渡す
  const highlighted = _try_highlight(raw, effective_lang);
  const code_node   = highlighted !== null
    ? { tag: 'code', class: 'hljs', innerHTML: highlighted }
    : { tag: 'code', ctx: [raw] };

  // max_height はオブジェクト style として構築し、user 提供の rest.style と
  // マージする。style が文字列指定されるケースは稀なので配列にしない。
  const base_style = max_height
    ? { maxHeight: max_height, overflowY: 'auto' }
    : {};
  const merged_style = (typeof rest.style === 'object' && !Array.isArray(rest.style))
    ? { ...base_style, ...rest.style }
    : (rest.style ?? base_style);

  // rest スプレッド契約: ...rest を先頭に置き、算出値（tag/class/style/ctx）で
  // 上書きする。rest.class / rest.style は上の計算で既に統合済み。
  return {
    ...rest,
    tag:   'pre',
    class: rest.class ? 'ric-code-pre ' + rest.class : 'ric-code-pre',
    style: merged_style,
    ctx:   [code_node],
  };
};

module.exports = { ui_code_pre };
