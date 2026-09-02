import { defineConfig } from 'vitest/config';

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
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/browser/**'],
        },
      },
      {
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
