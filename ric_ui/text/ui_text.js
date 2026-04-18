// RicUI — ui_text
// テキスト表示（text カテゴリ）。
// variant で見た目を切り替える。旧 ui_title / ui_label を統合。
//
// variant:
//   'default' → 本文テキスト（font-md）
//   'muted'   → 薄いテキスト（font-sm、fg-muted 色）
//   'title'   → 見出し（font-lg、太字）
//   'label'   → ラベル（font-sm、セミボールド、fg-muted 色）

'use strict';

// variant → HTML タグのマッピング
const _TAG_MAP = { title: 'h2', label: 'label' };

// rest: onclick / id / data-* / aria-* 等の任意属性を透過する
//       （ui_button / ui_input / ui_panel 等と同じ流儀）
const ui_text = ({ ctx = [], variant = 'default', style = {}, ...rest } = {}) => {
  const tag = _TAG_MAP[variant] ?? 'span';
  const cls_base = variant !== 'default'
    ? `ric-text ric-text--${variant}`
    : 'ric-text';

  return {
    ...rest,
    tag,
    class: rest.class ? cls_base + ' ' + rest.class : cls_base,
    ...(Object.keys(style).length ? { style } : {}),
    ctx,
  };
};

module.exports = { ui_text };
