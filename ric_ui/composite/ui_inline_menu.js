// RicUI — ui_inline_menu
// trigger 要素の near に absolute 配置する軽量ポップオーバー。
//
// 位置づけ:
//   - create_ui_popup は portal + overlay + 1-trigger-instance で、行ごとに
//     存在しうる「…」メニューには重すぎる（N 行 → N instance）。
//   - ui_inline_menu は portal を持たず、親要素の position:relative に対して
//     position:absolute だけで配置する純粋関数。インスタンスを取らない。
//   - open 状態は呼び出し側の state が管理する（s.menu_for のようなパターン）。
//
// 親側の要件:
//   - 親 (ui_inline_menu を含む要素) は position:relative を付ける必要がある。
//     anchor の bl/br/tl/tr はこの親の四隅に対する位置として解釈される。
//
// 含まない機能 (意図的):
//   - 外クリックで閉じる挙動は library に持たせない。
//     ui_inline_menu の onclick が e.stopPropagation() するため、document
//     レベルの click listener が「menu 外をクリック」を検知できる。
//     helper として ric_ui/dom_helpers.js の watch_outside_click を使うか、
//     呼び出し側で document.addEventListener('click', ...) を 1 つ書く。
//   - キーボード操作 / focus trap / ARIA は意図的に含めない。menu/menuitem 相当
//     のセマンティクスが必要なら create_ui_popup や独自実装を使うこと。
//
// 引数:
//   open    : bool（必須）。false のとき null を返す（render 結果ごと消える）
//   anchor  : 'br' | 'bl' | 'tr' | 'tl' = 'br'。親要素のどの角に寄せるか
//   ctx     : 中身のデスクリプタ群
//   style   : string | object（追加スタイル）
//   class   : string（追加クラス）

'use strict';

// anchor → 絶対位置スタイル (object 形式) のマップ
// 「br = bottom-right」のように親の右下に張り付く位置（つまり親の右端の
// すぐ下に展開する）として読む
const _ANCHOR = {
  br: { top:    '100%', right: 0, marginTop:    '4px' },
  bl: { top:    '100%', left:  0, marginTop:    '4px' },
  tr: { bottom: '100%', right: 0, marginBottom: '4px' },
  tl: { bottom: '100%', left:  0, marginBottom: '4px' },
};

// 親要素が positioned (relative / absolute / fixed / sticky) であることを
// dev mode で警告する (v0.3.16〜)。anchor の `top:100% + right:0` 等は
// nearest positioned ancestor を基準に計算されるため、親が `static` だと
// menu が body / 別の祖先を基準に出現する silent failure になる。
//
// 仕組み:
//   - open=true のときに rAF を 1 つ schedule
//   - 描画コミット後に document を走査して .ric-inline-menu の親を点検
//   - 警告済みの親は WeakSet で記録、spam を防止
//   - 環境 (jsdom で getComputedStyle / rAF が無いとき等) では silent skip
//
// rAF を使う理由: build_dom_node は同期だが、DOM 反映後に getComputedStyle
// を読みたいので 1 フレーム遅延させる (create_ui_collapse_box と同じ canon)。
const _warned_parents = typeof WeakSet === 'function' ? new WeakSet() : null;
let _parent_check_scheduled = false;

const _schedule_parent_position_check = () => {
  if (_parent_check_scheduled)          return;
  if (!_warned_parents)                 return;
  if (typeof document === 'undefined')  return;
  if (typeof requestAnimationFrame !== 'function') return;
  if (typeof getComputedStyle !== 'function')      return;

  _parent_check_scheduled = true;
  requestAnimationFrame(() => {
    _parent_check_scheduled = false;
    const menus = document.querySelectorAll('.ric-inline-menu');
    for (const el of menus) {
      const parent = el.parentElement;
      if (!parent || _warned_parents.has(parent)) continue;
      const pos = getComputedStyle(parent).position;
      // jsdom は CSS が未指定の要素に対し '' を返すケースがある。
      // ブラウザは 'static' を返す。両方を「unpositioned」として扱う。
      if (pos && pos !== 'static') continue;
      _warned_parents.add(parent);
      console.warn(
        '[ui_inline_menu] 親要素に position 指定がありません ' +
        '(computed: ' + (pos || 'static') + ')。menu は ' +
        'nearest positioned ancestor (or <body>) を基準に出現します。' +
        '親要素に `position: relative` (or absolute/fixed/sticky) を付けてください。',
        parent,
      );
    }
  });
};

// style 引数を object に正規化する。string で渡された場合は受け入れず、
// 'a:b;c:d' を { a: 'b', c: 'd' } に簡易変換する（後方互換のため）。
// 公式には object 形式を推奨。
const _to_style_object = (style) => {
  if (!style) return {};
  if (typeof style === 'object' && !Array.isArray(style)) return style;
  if (typeof style === 'string') {
    const obj = {};
    for (const part of style.split(';')) {
      const idx = part.indexOf(':');
      if (idx <= 0) continue;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) obj[k] = v;
    }
    return obj;
  }
  return {};
};

const ui_inline_menu = ({
  open = false,
  anchor = 'br',
  ctx = [],
  style = null,
  class: extra_class = '',
} = {}) => {
  if (!open) return null;

  // dev warning: 描画後に親要素の positioning を点検する。
  _schedule_parent_position_check();

  const pos = _ANCHOR[anchor] || _ANCHOR.br;
  // base + anchor の position + 呼び出し側追加の style を object でマージ
  const merged_style = {
    position: 'absolute',
    zIndex:   10,
    ...pos,
    ..._to_style_object(style),
  };

  return {
    tag: 'div',
    class: 'ric-inline-menu' + (extra_class ? ' ' + extra_class : ''),
    style: merged_style,
    // menu 内クリックは document に bubble させない。
    // document 側の outside-click handler が menu 自身のクリックで
    // 閉じてしまわないように。
    onclick: (e) => e.stopPropagation(),
    ctx,
  };
};

module.exports = { ui_inline_menu };
