#!/usr/bin/env node
// build_lz_bundle.js
//
// 入力 JS bundle (`RicUI.min.js` 等) を LZSS で圧縮し、自己展開する JS ファイル
// (`RicUI.lz.min.js`) を生成する CLI。実装本体は scripts/lz.js を参照。
//
// 使い方: node scripts/build_lz_bundle.js <input> <output>

'use strict';

const fs = require('fs');
const lz = require('./lz');

const INPUT  = process.argv[2] || 'RicUI.min.js';
const OUTPUT = process.argv[3] || 'RicUI.lz.min.js';

const original = fs.readFileSync(INPUT, 'utf8');

let result;
try {
  result = lz.build_lz_bundle(original);
} catch (e) {
  console.error('[build_lz] ERROR:', e.message);
  if (e.detail) {
    console.error('  expected:', JSON.stringify(e.detail.expected));
    console.error('  got:     ', JSON.stringify(e.detail.got));
  }
  process.exit(1);
}

fs.writeFileSync(OUTPUT, result.wrapper);

const before = Buffer.byteLength(original, 'utf8');
const after  = Buffer.byteLength(result.wrapper, 'utf8');
const ratio  = (after / before * 100).toFixed(1);
const marker_char = String.fromCharCode(result.marker_code);
console.log(`[build_lz] ${INPUT} → ${OUTPUT}: ${before} → ${after} (-${before - after}B, ${ratio}%)`);
console.log(`  marker: '${marker_char}' (0x${result.marker_code.toString(16)})` +
  (result.substitution
    ? `, substituted '${String.fromCharCode(result.substitution.from_code)}' → 0x${result.substitution.to_code.toString(16)}`
    : ' (unused in source)'));
