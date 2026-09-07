// src/ui/index.ts の version export (v1→v2 パリティ一括監査 #3、2.0.0-alpha.14)。
// コア (tests/version.test.ts) と同じ仕組み・同じ理由。ui はコアに実行時依存が無いため、
// コアの version import 無しに単独で package.json の version と一致することを確認する。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { version } from '../../src/ui/index.js';

// tests/version.test.ts と同じ理由で process.cwd() 基準のパスを使う。
describe('ui version', () => {
  it('package.json の version と一致する', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version: string };
    expect(version).toBe(pkg.version);
  });
});
