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
const ricdom_lz_kb = fs.existsSync(path.join(root, 'RicDOM.lz.min.js')) ? get_kb('RicDOM.lz.min.js') : null;
const ricui_lz_kb  = fs.existsSync(path.join(root, 'RicUI.lz.min.js'))  ? get_kb('RicUI.lz.min.js')  : null;

console.log(`[update_sizes] RicDOM: ${ricdom_kb}KB, RicUI: ${ricui_kb}KB` +
  (ricdom_lz_kb !== null ? `, RicDOM.lz: ${ricdom_lz_kb}KB` : '') +
  (ricui_lz_kb  !== null ? `, RicUI.lz: ${ricui_lz_kb}KB`  : ''));

// 置換が 0 件マッチ (= ドキュメント側の文言が変わって regex が追従できていない) でも
// 従来は無言で「updated.」ログを出すだけだった。それだと drift に気付けないため、
// マッチ 0 件のときだけ warn を出す (置換仕様そのものは不変)。
const replace_checked = (s, re, rep, label) => {
  const out = s.replace(re, rep);
  if (out === s) console.warn('[update_sizes] WARN: ' + label + ' にマッチなし (更新されず)');
  return out;
};

// ── docs/index.html ──
const index_path = path.join(root, 'docs', 'index.html');
let html = fs.readFileSync(index_path, 'utf-8');
html = replace_checked(html, /RicDOM\.min\.js\s*—\s*\d+KB/g, `RicDOM.min.js — ${ricdom_kb}KB`, 'docs/index.html RicDOM.min.js badge');
html = replace_checked(html, /RicUI\.min\.js\s*—\s*\d+KB/g,  `RicUI.min.js — ${ricui_kb}KB`, 'docs/index.html RicUI.min.js badge');
html = replace_checked(html, /JSON で書く、\d+KB の/g, `JSON で書く、${ricdom_kb}KB の`, 'docs/index.html リード文');
// LZ バッジ: RicDOM 用 badge (badge--core) と RicUI 用 badge (badge--ui) がそれぞれ直後の
// badge--lz 行と対になっている。同一 ".lz.min.js — NNKB" という文字列が 2 箇所あるため、
// 直前の badge--core / badge--ui 行を含めてマッチさせて区別する。
if (ricdom_lz_kb !== null) {
  html = replace_checked(
    html,
    /(badge--core[^\n]*\n\s*\{ tag: 'span', class: 'badge badge--lz',\s*ctx: \['\.lz\.min\.js — )\d+(KB'\] \})/,
    `$1${ricdom_lz_kb}$2`,
    'docs/index.html RicDOM.lz badge'
  );
}
if (ricui_lz_kb !== null) {
  html = replace_checked(
    html,
    /(badge--ui[^\n]*\n\s*\{ tag: 'span', class: 'badge badge--lz', ctx: \['\.lz\.min\.js — )\d+(KB'\] \})/,
    `$1${ricui_lz_kb}$2`,
    'docs/index.html RicUI.lz badge'
  );
}
fs.writeFileSync(index_path, html, 'utf-8');
console.log('[update_sizes] docs/index.html updated.');

// ── README.md ──
const readme_path = path.join(root, 'README.md');
let readme = fs.readFileSync(readme_path, 'utf-8');
// リード文 "JSON で書く 9KB の" / 読点あり "JSON で書く、9KB の" どちらにも対応
readme = replace_checked(readme, /JSON で書く[、 ]\d+KB の/g, `JSON で書く ${ricdom_kb}KB の`, 'README.md リード文');
// テーブル行 "| `RicDOM.min.js` | 12KB |" パターン
readme = replace_checked(readme, /(\| `RicDOM\.min\.js` \| )\d+KB/g, `$1${ricdom_kb}KB`, 'README.md RicDOM.min.js 行');
readme = replace_checked(readme, /(\| `RicUI\.min\.js` \| )\d+KB/g,  `$1${ricui_kb}KB`, 'README.md RicUI.min.js 行');
// レイヤー表 "| **RicDOM** | 9KB |" パターン
readme = replace_checked(readme, /(\| \*\*RicDOM\*\* \| )\d+KB/g, `$1${ricdom_kb}KB`, 'README.md レイヤー表 RicDOM 行');
readme = replace_checked(readme, /(\| \*\*RicUI\*\* \| )\d+KB/g,  `$1${ricui_kb}KB`, 'README.md レイヤー表 RicUI 行');
// LZ テーブル行 "| `RicDOM.lz.min.js` |  7KB | ..." パターン
// (既存の桁揃えスペースは維持するため、キャプチャグループに含めて数字部分だけ差し替える)
if (ricdom_lz_kb !== null) {
  readme = replace_checked(readme, /(\| `RicDOM\.lz\.min\.js` \|\s*)\d+KB/g, `$1${ricdom_lz_kb}KB`, 'README.md RicDOM.lz.min.js 行');
}
if (ricui_lz_kb !== null) {
  readme = replace_checked(readme, /(\| `RicUI\.lz\.min\.js`  \|\s*)\d+KB/g, `$1${ricui_lz_kb}KB`, 'README.md RicUI.lz.min.js 行');
}
fs.writeFileSync(readme_path, readme, 'utf-8');
console.log('[update_sizes] README.md updated.');
