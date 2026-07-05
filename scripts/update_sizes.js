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
//
// 判定は「置換前後で文字列が変わったか (out === s)」ではなく「regex が実際にマッチしたか
// (re.test(s))」で行う。前者だと、regex は実際にマッチしているのに置換後の値が元の値と
// 同じ (= サイズが変わっていない、冪等な再実行) ケースを「未マッチ」と誤検知してしまう。
// re.test() は呼び出し元に /g 付き regex と無し (キャプチャグループのみ) の regex が
// 混在しており、/g 付きは lastIndex を持つため使い回すと呼び出しごとに結果がずれる副作用が
// ある。呼び出し元の re をそのまま使い回さず、/g を外した新しい RegExp インスタンスで
// 判定専用にテストすることでその副作用を避ける。
const replace_checked = (s, re, rep, label) => {
  const has_match = new RegExp(re.source, re.flags.replace('g', '')).test(s);
  if (!has_match) console.warn('[update_sizes] WARN: ' + label + ' にマッチなし (更新されず)');
  return s.replace(re, rep);
};

// ── docs/index.html ──
const index_path = path.join(root, 'docs', 'index.html');
let html = fs.readFileSync(index_path, 'utf-8');
html = replace_checked(html, /RicDOM\.min\.js\s*—\s*\d+KB/g, `RicDOM.min.js — ${ricdom_kb}KB`, 'docs/index.html RicDOM.min.js badge');
html = replace_checked(html, /RicUI\.min\.js\s*—\s*\d+KB/g,  `RicUI.min.js — ${ricui_kb}KB`, 'docs/index.html RicUI.min.js badge');
// 旧: html = replace_checked(html, /JSON で書く、\d+KB の/g, `JSON で書く、${ricdom_kb}KB の`, 'docs/index.html リード文');
// 現在の docs/index.html のリード文には KB 数字が含まれない (README.md 側の同種パターンとは
// 独立に、docs 側は文言が変わった)。このパターンは廃止。次にリード文へ数字を戻す場合は
// update_sizes.js に regex を復活させること。
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
// テーブル行 "| `RicDOM.min.js`    | 10KB |" パターン
// (バッククォート直後〜パイプの間がカラム桁揃えスペースで可変長のため \s* で吸収する。
// LZ 版行はパイプの後ろ側が可変長なのでそちらは \s* の位置が異なる。桁揃えの位置が
// 版によって違う点に注意)
readme = replace_checked(readme, /(\| `RicDOM\.min\.js`\s*\| )\d+KB/g, `$1${ricdom_kb}KB`, 'README.md RicDOM.min.js 行');
readme = replace_checked(readme, /(\| `RicUI\.min\.js`\s*\| )\d+KB/g,  `$1${ricui_kb}KB`, 'README.md RicUI.min.js 行');
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
