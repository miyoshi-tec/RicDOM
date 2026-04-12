#!/usr/bin/env node
// scripts/update_sizes.js
// ビルド後に docs/index.html と README.md の min.js サイズ表記を実ファイルサイズで自動更新する。

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 各 min.js のサイズを KB（小数なし）で取得
const get_kb = (filename) => {
  const filepath = path.join(root, filename);
  const bytes = fs.statSync(filepath).size;
  return Math.round(bytes / 1024);
};

const ricdom_kb = get_kb('RicDOM.min.js');
const ricui_kb  = get_kb('RicUI.min.js');

console.log(`[update_sizes] RicDOM: ${ricdom_kb}KB, RicUI: ${ricui_kb}KB`);

// ── docs/index.html ──
const index_path = path.join(root, 'docs', 'index.html');
let html = fs.readFileSync(index_path, 'utf-8');
html = html.replace(/RicDOM\.min\.js\s*—\s*\d+KB/g, `RicDOM.min.js — ${ricdom_kb}KB`);
html = html.replace(/RicUI\.min\.js\s*—\s*\d+KB/g,  `RicUI.min.js — ${ricui_kb}KB`);
html = html.replace(/JSON で書く、\d+KB の/g, `JSON で書く、${ricdom_kb}KB の`);
fs.writeFileSync(index_path, html, 'utf-8');
console.log('[update_sizes] docs/index.html updated.');

// ── README.md ──
const readme_path = path.join(root, 'README.md');
let readme = fs.readFileSync(readme_path, 'utf-8');
// リード文 "JSON で書く 9KB の" / 読点あり "JSON で書く、9KB の" どちらにも対応
readme = readme.replace(/JSON で書く[、 ]\d+KB の/g, `JSON で書く ${ricdom_kb}KB の`);
// テーブル行 "| `RicDOM.min.js` | 12KB |" パターン
readme = readme.replace(/(\| `RicDOM\.min\.js` \| )\d+KB/g, `$1${ricdom_kb}KB`);
readme = readme.replace(/(\| `RicUI\.min\.js` \| )\d+KB/g,  `$1${ricui_kb}KB`);
// レイヤー表 "| **RicDOM** | 9KB |" パターン
readme = readme.replace(/(\| \*\*RicDOM\*\* \| )\d+KB/g, `$1${ricdom_kb}KB`);
readme = readme.replace(/(\| \*\*RicUI\*\* \| )\d+KB/g,  `$1${ricui_kb}KB`);
fs.writeFileSync(readme_path, readme, 'utf-8');
console.log('[update_sizes] README.md updated.');
