// ricdom-icon CLI (src/cli/ricdomIconLib.ts) のテスト (v1 tests/icon_cli.test.js の移植)
//
// ネット必須の Lucide fetch は CI 非依存にするためテストしない (v1 継承)。
// 同梱解決・出力整形・resolveAll のオフライン経路のみを検証する。

import { describe, expect, it } from 'vitest';
import { buildBlock, buildJson, loadBundled, LUCIDE_NOTICE, resolveAll } from '../../src/cli/ricdomIconLib.js';

describe('ricdom-icon: loadBundled', () => {
  it('同梱 (ricdom/icons の ICONS_BY_NAME) を読めて 36 個ある', () => {
    const b = loadBundled();
    expect(typeof b).toBe('object');
    expect(b.x?.p).toBeTruthy();
    expect(Object.keys(b).length).toBeGreaterThanOrEqual(35);
  });
});

describe('ricdom-icon: --names 相当 (src/cli/ricdomIcon.ts の main() が Object.keys(bundled).sort() で出力する一覧)', () => {
  it('同梱名をソートした一覧に既知の名前が含まれ、五十音/アルファベット順にソートされている', () => {
    const names = Object.keys(loadBundled()).sort();
    expect(names.length).toBe(36);
    expect(names).toContain('chevron-down');
    expect(names).toContain('trash-2');
    expect(names).toEqual([...names].sort());
  });
});

describe('ricdom-icon: buildBlock', () => {
  it('貼れる const ICONS ブロックを出す (inline コメント無し)', () => {
    const out = buildBlock(
      [
        ['x', { p: 'M..' }],
        ['check', { p: 'M..' }],
      ],
      [],
    );
    expect(out).toMatch(/^const ICONS = \{/);
    expect(out).toMatch(/\};$/);
    const body = out.slice(out.indexOf('{'), out.lastIndexOf('}'));
    expect(body.includes('//')).toBe(false);
  });

  it('Lucide 由来があれば冒頭に ISC 帰属ブロック + 由来一覧', () => {
    const out = buildBlock([['settings', { p: ['a', 'b'] }]], ['settings']);
    expect(out.includes(LUCIDE_NOTICE)).toBe(true);
    expect(out).toMatch(/\/\/ Lucide 由来: settings/);
  });

  it('Lucide が無ければ帰属ブロックを出さない', () => {
    const out = buildBlock([['x', { p: 'M..' }]], []);
    expect(out.includes('Lucide')).toBe(false);
  });

  it('ハイフン入りの名前はキーをクォートする', () => {
    const out = buildBlock([['refresh-cw', { p: 'M..' }]], []);
    expect(out).toMatch(/"refresh-cw":/);
  });

  it('生成物が JS としてパースできる (ESM 安全)', () => {
    const out = buildBlock(
      [
        ['x', { p: 'M..' }],
        ['refresh-cw', { p: ['a'] }],
      ],
      ['refresh-cw'],
    );
    const body = out.slice(out.indexOf('const ICONS'));
    expect(() => new Function(body + '; return ICONS;')).not.toThrow();
  });
});

describe('ricdom-icon: buildJson', () => {
  it('const ラッパー無しの素の descriptor を出す', () => {
    const out = buildJson([['x', { p: 'M..' }]]);
    expect(JSON.parse(out)).toEqual({ x: { p: 'M..' } });
  });
});

describe('ricdom-icon: resolveAll (同梱・オフライン)', () => {
  it('同梱名は fetch せずに解決し、lucide/errors は空', async () => {
    const b = loadBundled();
    const { entries, lucide, errors } = await resolveAll(['x', 'check'], b);
    expect(entries.length).toBe(2);
    expect(lucide.length).toBe(0);
    expect(errors.length).toBe(0);
    expect(entries[0]![0]).toBe('x');
    expect(entries[0]![1].p).toBeTruthy();
  });

  it('不明な名前 (同梱に無い) は Lucide 取得を試み、失敗すれば errors に集約される', async () => {
    // ネットワーク接続をテストで使わないよう、lucideFetcher (テスト用差し替えフック) に
    // 必ず失敗する dummy を注入する — 「同梱に無い名前は fetchLucide に回り、失敗すると
    // errors[] に { name, msg } として積まれる」という resolveAll の分岐そのものを検証する。
    const b = loadBundled();
    const alwaysFail = async (name: string): Promise<never> => {
      throw new Error(`Lucide '${name}' を取得できません (HTTP 404)`);
    };
    const { entries, lucide, errors } = await resolveAll(['x', 'totally-unknown-icon-name'], b, alwaysFail);
    expect(entries.length).toBe(1); // 'x' は同梱解決 (fetch 不要)
    expect(entries[0]![0]).toBe('x');
    expect(lucide.length).toBe(0); // fetch 自体は失敗したので lucide 由来にはカウントされない
    expect(errors.length).toBe(1);
    expect(errors[0]).toEqual({ name: 'totally-unknown-icon-name', msg: "Lucide 'totally-unknown-icon-name' を取得できません (HTTP 404)" });
  });

  it('同梱に無い名前が Lucide 取得に成功すれば entries + lucide[] の両方に入る', async () => {
    const b = loadBundled();
    const dummyDescriptor = { p: 'M0 0' };
    const alwaysSucceed = async (): Promise<{ p: string }> => dummyDescriptor;
    const { entries, lucide, errors } = await resolveAll(['refresh-cw'], b, alwaysSucceed);
    expect(entries).toEqual([['refresh-cw', dummyDescriptor]]);
    expect(lucide).toEqual(['refresh-cw']);
    expect(errors.length).toBe(0);
  });
});
