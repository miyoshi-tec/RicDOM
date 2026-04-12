#!/usr/bin/env node
// copy_docs.js
// ビルド成果物（min.js）を docs/ にコピーする（クロスプラットフォーム対応）。
// package.json の build:docs から呼ばれる。
//
// サンプルファイルは docs/samples/ が唯一のソースなのでコピー不要。

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// min.js をコピー
for (const f of ['RicDOM.min.js', 'RicUI.min.js']) {
  fs.copyFileSync(path.join(root, f), path.join(root, 'docs', f));
}

// Markdown ドキュメントをコピー（spec.html / tutorial.html が fetch する）
for (const f of ['SPEC.md', 'TUTORIAL.md']) {
  fs.copyFileSync(path.join(root, f), path.join(root, 'docs', f));
}

console.log('[copy_docs] docs/ updated.');
