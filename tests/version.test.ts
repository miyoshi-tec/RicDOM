// src/index.ts の version export (v1→v2 パリティ一括監査 #3、2.0.0-alpha.14)。
// __RICDOM_VERSION__ は tsup の define (tsup.config.ts) で package.json の version を
// 焼き込む定数 (src/env.d.ts 参照)。vitest 実行では tsup を経由しないため、
// vitest.config.ts 側でも同じ値を define しており、ここではその一致を検証する。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { version } from '../src/index.js';

// import.meta.url はテスト実行時のモジュール解決方式によっては file: スキームでない
// 場合があるため (`new URL(..., import.meta.url)` が失敗する)、process.cwd() 基準の
// 素直なパスで package.json を読む (vitest はプロジェクトルートから実行される)。
describe('version', () => {
  it('package.json の version と一致する', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
    expect(version).toBe(pkg.version);
  });

  it('semver 風の文字列である (少なくとも 2 つのドットを含む)', () => {
    expect(version.split('.').length).toBeGreaterThanOrEqual(3);
  });
});
