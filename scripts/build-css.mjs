// dist/ricdom-ui.css 生成スクリプト (設計書 §4)
//
// buildStylesheet() (src/ui/cssTemplates.ts) を「1 枚の CSS」の単一ソースとして、
// ビルド済みの dist/ui.js から読み込んで dist/ricdom-ui.css に書き出す。
// injectStyles() (実行時注入) も同じ buildStylesheet() を使うため、
// <link> 読み込みと実行時注入で内容が食い違うことは構造的に起きない。
//
// `npm run build` = `tsup && node scripts/build-css.mjs` (package.json)。
// tsup が先に dist/ui.js (ricdom/ui サブパスの ESM ビルド) を生成している前提。

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const distUiUrl = new URL('../dist/ui.js', import.meta.url);
const outUrl = new URL('../dist/ricdom-ui.css', import.meta.url);

const { buildStylesheet } = await import(distUiUrl.href);
await writeFile(fileURLToPath(outUrl), buildStylesheet(), 'utf8');

console.log(`[build-css] wrote ${fileURLToPath(outUrl)}`);
