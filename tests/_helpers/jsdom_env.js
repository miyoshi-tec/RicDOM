// tests/_helpers/jsdom_env.js
// jsdom セットアップの共通ヘルパー。
// rAF shim は必ず setImmediate を使う (setTimeout(cb,0) ではない)。
// 理由: Node.js (v24 で確認) では setTimeout(0) の連鎖が稀に starve する race があり、
// _measure → safe_notify → schedule_render → rAF の連鎖で rAF callback が
// flush(10ms) 内に発火しない fail が ~30% 起きる (create_ui_collapse_box テストで実証)。
// setImmediate は I/O ループ末尾で確実に発火するため deterministic に動く。
'use strict';
const { JSDOM } = require('jsdom');

// body: <body> 内の HTML (既定 '<div id="app"></div>')
// globals: 追加で global に載せる window プロパティ名の配列
//          (例: ['Element'], ['KeyboardEvent'], ['getComputedStyle', 'Event'])
const setup_jsdom = ({ body = '<div id="app"></div>', globals = [] } = {}) => {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${body}</body></html>`);
  global.window      = dom.window;
  global.document    = dom.window.document;
  global.Node        = dom.window.Node;
  global.HTMLElement = dom.window.HTMLElement;
  for (const g of globals) global[g] = dom.window[g];
  global.requestAnimationFrame = (cb) => setImmediate(cb);
  return dom;
};

// rAF (setImmediate) が一巡して DOM commit が終わるのを待つ
const flush = (ms = 10) => new Promise((r) => setTimeout(r, ms));

module.exports = { setup_jsdom, flush };
