// テスト共通ヘルパー。vitest の jsdom 環境 (vitest.config.ts) 上で動く前提。
export const setupApp = (): HTMLDivElement => {
  document.body.innerHTML = '<div id="app"></div>';
  return document.getElementById('app') as HTMLDivElement;
};

/** rAF (+ 必要なら setTimeout バックストップ) が一巡して DOM commit が終わるのを待つ */
export const flush = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));
