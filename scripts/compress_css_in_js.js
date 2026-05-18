#!/usr/bin/env node
// compress_css_in_js.js
// esbuild が minify しないテンプレートリテラル内の CSS 文字列を圧縮する。
//
// 処理:
//   1. CSS コメント `/* ... */` を除去 (Japanese コメント は \uXXXX escape で
//      6 倍のサイズになるので特に効く)
//   2. 連続空白 → 1 スペースに畳む
//   3. CSS 構文上の区切り `{};:,` 周りの余分スペースを除去
//   4. `}` の直前の `;` を除去 (CSS 仕様で末尾 `;` は省略可)
//
// 安全性:
//   - バッククォート対の中の **CSS テキスト部分のみ** に作用させ、`${...}`
//     (JS 式部分) はそのまま残す。これにより JS 側の `key: value` 等を
//     破壊しない。
//   - 値の中の space (例: `1px solid red`、`0 0 0 3px`) は維持される
//     (`\s*([{};:,])\s*` は左右に `{};:,` の文字を要求するため)。
//   - CSS の `@media (min-width: 100px)` のような括弧内 `:` も対象だが、
//     `(min-width:100px)` は CSS として valid なので問題なし。
//
// 使い方: node scripts/compress_css_in_js.js RicUI.min.js

'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node compress_css_in_js.js <file>'); process.exit(1); }

// 1 つの CSS テキストフラグメントを最小化する (バッククォート内、`${...}` の外)
const minify_css_fragment = (s) => {
  // CSS コメントを除去
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // 連続空白 → 1 スペース
  s = s.replace(/\s+/g, ' ');
  // CSS 区切り文字 `{};:,` 周りの空白を除去
  s = s.replace(/\s*([{};:,])\s*/g, '$1');
  // `}` の直前の `;` を除去 (末尾セミコロンは省略可)
  s = s.replace(/;}/g, '}');
  return s;
};

// バッククォート対の中を ${...} で分割して、CSS 部分のみ minify する。
// css_templates.js の `${...}` は ネスト無しの単純な変数参照のみだが、
// 防衛的にネストレベルを追跡する。
const process_template = (template) => {
  let out = '';
  let i = 1;            // 先頭の ` をスキップ
  let css_start = i;
  while (i < template.length - 1) {  // 末尾の ` の手前まで
    if (template[i] === '$' && template[i + 1] === '{') {
      // CSS 部分を minify して追加
      out += minify_css_fragment(template.substring(css_start, i));
      // `${...}` の終わりを見つけてそのまま追加
      let depth = 1;
      let j = i + 2;
      while (j < template.length && depth > 0) {
        if (template[j] === '{') depth++;
        else if (template[j] === '}') depth--;
        j++;
      }
      out += template.substring(i, j);
      i = j;
      css_start = i;
    } else {
      i++;
    }
  }
  out += minify_css_fragment(template.substring(css_start, template.length - 1));
  return '`' + out + '`';
};

let src = fs.readFileSync(file, 'utf8');
const before = src.length;

src = src.replace(/`[^`]+`/g, process_template);

fs.writeFileSync(file, src);
const after = src.length;
console.log(`[compress_css] ${file}: ${before} → ${after} (${before - after > 0 ? '-' : '+'}${Math.abs(before - after)}B)`);
