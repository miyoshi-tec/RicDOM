import { defineConfig } from 'vitest/config';

// 単体テストは jsdom 環境で回す (v1 踏襲: Node 単体では動かないライブラリのため)。
// 実ブラウザテスト (`vitest run --browser`) 用の `test.browser` 設定はここに用意するが、
// Playwright provider の導入・CI 化は Phase 1b (設計書 §7) で行う。既定 (`npm test`) では
// browser.enabled を false にし、jsdom 実行を妨げないようにする。
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    browser: {
      enabled: false,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
  },
});
