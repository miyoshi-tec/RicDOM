#!/usr/bin/env node
// compress_css_in_js.js
// esbuild が minify しないテンプレートリテラル内の CSS 空白を圧縮する。
// バッククォート内の連続空白を 1 スペースに畳み、先頭・末尾の空白を除去する。
//
// 使い方: node scripts/compress_css_in_js.js RicUI.min.js

'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node compress_css_in_js.js <file>'); process.exit(1); }

let src = fs.readFileSync(file, 'utf8');
const before = src.length;

// バッククォート文字列を検出し、内部の空白を圧縮する
// ネストした ${} 内のバッククォートは css_templates には存在しないため
// 単純なバッククォート対のマッチで十分
src = src.replace(/`[^`]+`/g, (m) => {
  // 連続する空白（改行含む）を 1 スペースに
  let compressed = m.replace(/\s+/g, ' ');
  // バッククォート直後・直前の空白を除去
  compressed = compressed.replace(/` /, '`').replace(/ `/, '`');
  return compressed;
});

fs.writeFileSync(file, src);
const after = src.length;
console.log(`[compress_css] ${file}: ${before} → ${after} (${before - after > 0 ? '-' : '+'}${Math.abs(before - after)}B)`);
