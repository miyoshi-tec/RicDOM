// RicUI — ui_tabs
// タブ切り替えコンポーネント（ステートレス）。
//
// tabs の「どのタブがアクティブか」は radiobutton の value や select の
// value と同じく user の関心事（タブによって描画内容を変えるため）なので、
// 状態は user の state に持ち、ui_tabs はそれを受け取るだけの純粋関数とする。
// state 双方向バインドが欲しい場合は bind_tabs を使う。
//
// 使い方:
//   ui_tabs({
//     items:  [
//       { key: 'profile', label: 'プロフィール', ctx: [...] },
//       { key: 'notify',  label: '通知設定',    ctx: [...] },
//     ],
//     active:   s.tab,              // 現在アクティブな key
//     onchange: (key) => { s.tab = key; },
//     variant:  'line',             // 'line'（デフォルト）| 'pill'
//   })
//
// items の各要素:
//   key   {string}  タブを一意に識別するキー
//   label {string}  タブバーに表示するラベル文字列
//   ctx   {Array}   パネル本体のコンテンツ（未指定可；パネルを描画しない）
//
// variant:
//   'line' — アンダーラインでアクティブを示す（デフォルト）
//   'pill' — 丸みのあるピル形状。背景色でアクティブを示す

'use strict';

const ui_tabs = ({
  items    = [],
  active   = null,
  onchange = null,
  variant  = 'line',
} = {}) => {
  // active 未指定 or 範囲外のときは先頭を fallback（user の state が空でも壊れないため）
  const active_key = (active != null && items.some(it => it.key === active))
    ? active
    : (items[0]?.key ?? null);

  // タブバー（タブボタン一覧）
  const tab_bar = {
    tag:   'div',
    class: 'ric-tabs__bar',
    ctx:   items.map(item => ({
      tag:     'button',
      class:   'ric-tabs__tab' + (item.key === active_key ? ' ric-tabs__tab--active' : ''),
      // アクティブが変わった時だけ onchange を呼ぶ（同じタブのクリックは無視）
      onclick: () => { if (item.key !== active_key && typeof onchange === 'function') onchange(item.key); },
      ctx:     [item.label],
    })),
  };

  // アクティブなタブのコンテンツ
  const active_item = items.find(it => it.key === active_key);
  const panel = {
    tag:   'div',
    class: 'ric-tabs__panel',
    ctx:   active_item ? (active_item.ctx || []) : [],
  };

  return {
    tag:   'div',
    class: 'ric-tabs' + (variant !== 'line' ? ' ric-tabs--' + variant : ''),
    ctx:   [tab_bar, panel],
  };
};

module.exports = { ui_tabs };
