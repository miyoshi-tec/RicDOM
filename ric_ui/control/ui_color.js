// RicUI — ui_color
// カラーピッカー（control カテゴリ）。
// hex (#rrggbb) と rgba(r,g,b,a) の両方をサポート。
//
// レイアウト:
//   hex モード  : [picker ─ value] 横 1 行
//   rgba モード : [picker  ] 上段
//                 [slider α] 下段 — 横幅を丸ごと使えるようにするための 2 段組
//   CSS 側で flex-direction を切り替える（.ric-color--rgba 修飾子）。

'use strict';

// ── パーサ / ヘルパー ──

const _is_hex6 = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());

const _parse_rgba = (v) => {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (!m) return null;
  return { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10), a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
};

const _rgb_to_hex = (r, g, b) =>
  '#' + [r, g, b].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');

const _hex_to_rgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16),
});

const ui_color = ({
  value    = '#000000',
  oninput  = null,
  disabled = false,
} = {}) => {
  const current = String(value);
  const rgba = _parse_rgba(current);
  const is_rgba = rgba !== null;

  // カラーピッカー用の hex 値
  const picker_val = _is_hex6(current) ? current.trim()
                   : rgba ? _rgb_to_hex(rgba.r, rgba.g, rgba.b)
                   : '#000000';
  const alpha_val = rgba ? rgba.a : 1;

  // カラーピッカー変更
  const on_color = !oninput ? null : (e) => {
    if (is_rgba) {
      const { r, g, b } = _hex_to_rgb(e.target.value);
      oninput({ target: { value: `rgba(${r},${g},${b},${alpha_val})` } });
    } else {
      oninput(e);
    }
  };

  // アルファスライダー変更
  const on_alpha = (!oninput || !is_rgba) ? null : (e) => {
    const a = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
    const { r, g, b } = _hex_to_rgb(picker_val);
    oninput({ target: { value: `rgba(${r},${g},${b},${a})` } });
  };

  const picker_node = {
    tag: 'input', type: 'color', class: 'ric-color__picker',
    value: picker_val,
    ...(disabled ? { disabled: true } : {}),
    ...(on_color ? { oninput: on_color } : {}),
  };

  // hex モード: [picker] [value]
  if (!is_rgba) {
    return {
      tag: 'div', class: 'ric-color',
      ctx: [
        picker_node,
        { tag: 'span', class: 'ric-color__value', ctx: [current || '—'] },
      ],
    };
  }

  // rgba モード: 縦 2 段組
  //   上段: picker（幅 100%）
  //   下段: slider（幅 100%） + α ラベル
  return {
    tag: 'div', class: 'ric-color ric-color--rgba',
    ctx: [
      picker_node,
      { tag: 'div', class: 'ric-color__alpha-row', ctx: [
        { tag: 'input', type: 'range', class: 'ric-color__alpha',
          min: '0', max: '1', step: '0.01', value: String(alpha_val),
          ...(disabled ? { disabled: true } : {}),
          ...(on_alpha ? { oninput: on_alpha } : {}),
        },
        { tag: 'span', class: 'ric-color__value', ctx: [`α${alpha_val.toFixed(2)}`] },
      ]},
    ],
  };
};

module.exports = { ui_color };
