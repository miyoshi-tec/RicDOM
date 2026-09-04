// examples/*.html スモークテスト (2.0.0-alpha.3、パイロット第 2 号からのテスト戦略提案 #5)。
//
// `examples/` はビルド不要を証明する生 HTML デモ (README/SPEC の「利用側はビルド不要」の
// 実演でもある) — dist/ の IIFE ビルドと ricdom-ui.css を素朴な <script>/<link> で読み込む
// だけの、consumer が実際に書くコードに一番近い形。ここが壊れていないことは単体/実ブラウザ
// テスト (jsdom or vitest browser の合成 DOM) では保証できない — 本物のビルド成果物を
// 本物のブラウザで開いて初めて分かる種類の壊れ方 (dist/ のパス間違い、IIFE のグローバル名
// 食い違い、CSS の読み込み漏れ 等) がある。
//
// Node 組み込みの http でリポジトリルートを配信し (dist/ を参照するため事前ビルドが必要
// — package.json の `pretest:examples` で `npm run build` を回す)、Playwright (devDependency
// に既にある) で各ページを開いて:
//   - console error / pageerror が 0 件
//   - ページ内の `button[aria-haspopup]` を順にクリックし、開いた
//     `[data-ricdom-role="popup"]` / `"dropdown"` / `"dialog"` の本体 rect が viewport 内
//   - Escape で閉じる
// を確認する。`npm run test:examples` で実行する (`.github/workflows/ci.yml` にも追加)。

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const examplesDir = join(repoRoot, 'examples');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// リポジトリルート配下を素朴に配信する静的サーバ (examples/*.html が `../dist/...` の
// 相対パスで参照する dist/ も同じ配信で解決できる)。
const startServer = () =>
  new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        const filePath = join(repoRoot, relPath || 'examples/index.html');
        const body = await readFile(filePath);
        res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

// Playwright の boundingBox() は {x, y, width, height} を返す (getBoundingClientRect の
// {left, top, right, bottom} とは形が違う) — ここで left/top/right/bottom に揃える。
const rectWithinViewport = (box, vw, vh, margin = 2) => {
  const left = box.x;
  const top = box.y;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  return left >= -margin && top >= -margin && right <= vw + margin && bottom <= vh + margin;
};

const checkPage = async (browser, baseUrl, htmlFile) => {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  const issues = [];
  await page.goto(`${baseUrl}/examples/${htmlFile}`, { waitUntil: 'load' });
  await page.waitForTimeout(150); // createApp の初回同期描画 + 初期 rAF が落ち着くのを待つ

  if (consoleErrors.length > 0) issues.push(`console error: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length > 0) issues.push(`pageerror: ${pageErrors.join(' | ')}`);

  const triggers = await page.locator('button[aria-haspopup]').all();
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };

  for (let i = 0; i < triggers.length; i++) {
    // 前の反復で開いた本体が残っていないことを毎回確認してからクリックする
    // (排他制御で自動的に閉じるはずだが、テスト自体の前提を明示するため)。
    const trigger = triggers[i];
    await trigger.click();
    await page.waitForTimeout(150); // rAF 実測フェーズ + アニメーション開始を待つ

    const body = page.locator('[data-ricdom-role="popup"], [data-ricdom-role="dropdown"], [data-ricdom-role="dialog"]').first();
    const count = await body.count();
    if (count === 0) {
      issues.push(`trigger #${i} (aria-haspopup) をクリックしても popup/dropdown/dialog の本体が現れなかった`);
      continue;
    }
    const role = await body.getAttribute('data-ricdom-role');
    const rect = await body.boundingBox();
    if (!rect || !rectWithinViewport(rect, viewport.width, viewport.height)) {
      issues.push(`trigger #${i} (${role}) の本体 rect が viewport 外: ${JSON.stringify(rect)} (viewport ${viewport.width}x${viewport.height})`);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(350); // exit アニメーション終了を待つ
    const stillOpen = await body.count();
    if (stillOpen > 0) issues.push(`trigger #${i} (${role}) が Escape で閉じなかった`);
  }

  await page.close();
  return { htmlFile, issues, triggerCount: triggers.length };
};

const main = async () => {
  const files = (await readdir(examplesDir)).filter((f) => f.endsWith('.html'));
  if (files.length === 0) {
    console.error('[examplesSmoke] examples/*.html が見つかりません。');
    process.exitCode = 1;
    return;
  }

  const server = await startServer();
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  // 既存の vitest browser (Playwright provider) は headless chromium で動いている実績が
  // あるため、Windows 上でも同じ既定オプションで問題は出ていない — 追加の起動オプションは
  // 今のところ不要 (問題が出た場合の調整余地として headless: true は明示しておく)。
  const browser = await chromium.launch({ headless: true });

  let failed = false;
  try {
    for (const file of files.sort()) {
      const result = await checkPage(browser, baseUrl, file);
      if (result.issues.length === 0) {
        console.log(`[examplesSmoke] OK   ${file} (trigger ${result.triggerCount} 件)`);
      } else {
        failed = true;
        console.error(`[examplesSmoke] NG   ${file}`);
        for (const issue of result.issues) console.error(`  - ${issue}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failed) {
    console.error('[examplesSmoke] failed');
    process.exitCode = 1;
  } else {
    console.log('[examplesSmoke] all examples passed');
  }
};

await main();
