// RicUI — ポータルキュー
// popup / tooltip / dialog / toast は、開いているとき VDOM をここに push する。
// ui_page が描画時に drain() で取り出し、.ric-page の直接の子として展開する。
// これにより .ric-panel 等の backdrop-filter / transform が作る
// stacking context / containing block の影響を受けずにポータルを配置できる。
//
// 前提: JS はシングルスレッドで render は同期実行されるため、
//   「children 評価で push → inst() が drain」が交錯せず安全。
//   複数の ui_page がある場合も JS の評価順（引数が左から順に評価される）で
//   各 page の children → inst → drain が逐次に完結するため、
//   単一バッファで正しく分離される。

'use strict';

let _buf = [];

const push = (...items) => { _buf.push(...items); };

const drain = () => {
  const items = _buf;
  _buf = [];
  return items;
};

module.exports = { push, drain };
