// RicUI — ui_range
// スライダー入力 + 現在値表示（control カテゴリ）。
// ホイールでステップ単位の増減が可能。

'use strict';

// rest: id / data-* / aria-* / style 等の任意属性を透過する
//       （ui_button / ui_input / ui_panel 等と同じ流儀）
// rest は外側のラッパー <div class="ric-range"> に付く。
// oninput / min / max / step / value は input 要素に掛けるため rest には入れない。
const ui_range = ({
  value    = 0,
  min      = 0,
  max      = 100,
  step     = 1,
  oninput  = null,
  disabled = false,
  ...rest
} = {}) => {
  const step_num = Number(step) || 1;
  const min_num  = Number(min);
  const max_num  = Number(max);

  const clamp = (v) => Math.min(max_num, Math.max(min_num, v));

  const align = (v) => {
    const base = Number.isFinite(min_num) ? min_num : 0;
    return Number((Math.round((v - base) / step_num) * step_num + base).toFixed(6));
  };

  return {
    ...rest,
    tag: 'div',
    class: rest.class ? 'ric-range ' + rest.class : 'ric-range',
    ctx: [
      {
        tag: 'input', type: 'range',
        min: String(min), max: String(max), step: String(step),
        value: String(value),
        ...(disabled ? { disabled: true } : {}),
        ...(oninput ? { oninput } : {}),
        onwheel: (ev) => {
          ev.preventDefault();
          const now = Number(ev.target.value) || 0;
          const delta = ev.deltaY < 0 ? step_num : -step_num;
          const next = align(clamp(now + delta));
          ev.target.value = String(next);
          if (oninput) oninput({ target: { value: String(next) } });
        },
      },
      { tag: 'span', class: 'ric-range__value', ctx: [String(value)] },
    ],
  };
};

module.exports = { ui_range };
