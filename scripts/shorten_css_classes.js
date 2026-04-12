#!/usr/bin/env node
// shorten_css_classes.js
// esbuild 後の min.js 内で、エンドユーザーが直接使わない内部 CSS クラス名を
// 短い名前に一括置換してバンドルサイズを削減する。
//
// 使い方: node scripts/shorten_css_classes.js RicUI.min.js
//
// 置換戦略:
//   BEM のベースクラス（ric-xxx__yyy）のみを短縮名に置換する。
//   modifier（--zzz）はそのまま残す。
//   これにより 'ric-popup__body--' + dir のような動的構築でも
//   CSS とクラス名が一致する。
//
//   例: ric-popup__body       → r5
//       ric-popup__body--out  → r5--out  （CSS セレクタ内でも同様に置換）
//       'ric-popup__body--' + inst._d  → 'r5--' + inst._d  ✓

'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node shorten_css_classes.js <file>'); process.exit(1); }

// エンドユーザーや他バンドルが直接参照するベースクラス（短縮しない）
// __yyy 子要素も一括で対象外にするためプレフィクス一致で判定する。
//
// ric-accordion__* が含まれている理由:
//   create_ui_accordion が使う BEM 子要素クラスをロングネームで残す。
const PUBLIC_BASE_PREFIXES = [
  'ric-page', 'ric-col', 'ric-row',
  'ric-panel', 'ric-button', 'ric-input',
  'ric-checkbox', 'ric-select',
  'ric-radiogroup', 'ric-radio',
  'ric-range', 'ric-color', 'ric-separator',
  'ric-text', 'ric-code-pre',
  'ric-tweak', 'ric-tweak-row', 'ric-tweak-folder',
  'ric-accordion',
];

const is_public_base = (cls) =>
  PUBLIC_BASE_PREFIXES.some(prefix =>
    cls === prefix || cls.startsWith(prefix + '__'),
  );

let src = fs.readFileSync(file, 'utf8');
const before = src.length;

// BEM ベースクラス（__ を含むもの）を抽出し、出現回数をカウント
// modifier（--zzz）は除外してベース部分のみ集める
const base_re = /ric-[a-z]+__[a-z_-]+/g;
const all = src.match(base_re) || [];

// ベースクラスから modifier を除去して集計
const bases = {};
for (const raw of all) {
  // ric-popup__body--out → ric-popup__body
  const base = raw.replace(/--[a-z_-]+$/, '');
  bases[base] = (bases[base] || 0) + 1;
}

// 内部ベースクラスを効果が大きい順にソート
const internal = Object.entries(bases)
  .filter(([cls]) => !is_public_base(cls))
  .map(([cls, count]) => ({ cls, count, weight: cls.length * count }))
  .sort((a, b) => b.weight - a.weight);

// 短縮名を生成
let idx = 0;
const gen_short = () => 'r' + (idx++).toString(36);

// 置換マップ（ベースクラスのみ）
const map = new Map();
for (const { cls } of internal) {
  const short = gen_short();
  if (short.length >= cls.length) continue;
  map.set(cls, short);
}

// 長いベースクラスから順に置換
// ric-popup__body--out → r5--out（ベース部分だけ置換、modifier はそのまま）
const sorted = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
for (const [long, short] of sorted) {
  const escaped = long.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'g');
  src = src.replace(re, short);
}

fs.writeFileSync(file, src);
const after = src.length;
console.log(`[shorten_css] ${file}: ${before} → ${after} (${before - after > 0 ? '-' : '+'}${Math.abs(before - after)}B, ${map.size} bases)`);
