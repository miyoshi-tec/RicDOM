import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// `version` export (v1→v2 パリティ一括監査 #3、2.0.0-alpha.14) のテスト用: tsup を
// 経由しない vitest 実行では __RICDOM_VERSION__ (src/env.d.ts) が define されず
// `typeof __RICDOM_VERSION__ === 'string'` が false になってしまうため、tsup.config.ts と
// 同じ package.json の version を vite の define で焼き込み、`version === package.json.version`
// をテストで検証できるようにする (src/index.ts / src/ui/index.ts のコメント参照)。
const pkgVersion = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }).version;

// jsdom 単体 (`npm test` = `vitest run --project unit`) と実ブラウザ
// (`npm run test:browser` = `vitest run --project browser`) の 2 プロジェクト構成
// (Phase 1b、設計書 §7)。Vitest 3.x の `test.projects` は旧 `vitest.workspace.ts` の後継で、
// 1 ファイルにまとめられる。
//
//  - unit: jsdom 環境 (v1 踏襲: Node 単体では動かないライブラリのため)。tests/browser/ は
//    実ブラウザ専用の DOM API・タイミング挙動 (badInput 等) に依存するため除外する。
//  - browser: Playwright (chromium) provider で実ブラウザ上で実行する。v1 でブラウザ固有
//    だった 3 件 (rAF 停止環境 / select value / 編集中ガード) + IIFE ビルド smoke を
//    tests/browser/ に置く。dist の smoke テストがあるため、実行前にビルドが要る
//    (package.json の `pretest:browser` で `npm run build` を回す)。
// `test.projects` の各要素は独立した Vite config として解決されるため (ルート直下の
// `define` が子 project に自動継承されなかった、実測で確認)、`define` は各 project 側
// (test と同じ階層) に個別に書く。
export default defineConfig({
  test: {
    projects: [
      {
        define: {
          __RICDOM_VERSION__: JSON.stringify(pkgVersion),
        },
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/browser/**'],
        },
      },
      {
        define: {
          __RICDOM_VERSION__: JSON.stringify(pkgVersion),
        },
        test: {
          name: 'browser',
          globals: true,
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
