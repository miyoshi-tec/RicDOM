// テスト共通ヘルパー。vitest の jsdom 環境 (vitest.config.ts) 上で動く前提。
export const setupApp = (): HTMLDivElement => {
  document.body.innerHTML = '<div id="app"></div>';
  return document.getElementById('app') as HTMLDivElement;
};

/** rAF (+ 必要なら setTimeout バックストップ) が一巡して DOM commit が終わるのを待つ */
export const flush = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 深い代入の発火忘れ警告 (src/reactivity.ts の scheduleFlush、queueMicrotask 1 回分) が
 * flush されるのを待つ。setTimeout ではなく queueMicrotask を使うのは、こちらが
 * マクロタスクの完了を待たず「同じタスクの直後」の意味を保つため (setTimeout(0) でも
 * 動くが、マクロタスク境界をまたぐぶん「同じタスク内で発火したか」の判定タイミングが
 * ずれ得る)。
 */
export const flushMicrotasks = (): Promise<void> => new Promise((r) => queueMicrotask(r));
