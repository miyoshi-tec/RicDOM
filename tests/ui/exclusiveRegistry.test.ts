// internal/exclusiveRegistry.ts (Phase 3b、popup 系の排他制御、host.app 単位)

import { describe, expect, it } from 'vitest';
import { closeOthers, registerExclusive, unregisterExclusive } from '../../src/ui/internal/exclusiveRegistry.js';

describe('exclusiveRegistry', () => {
  it('同じ app に登録された他の Exclusive を closeOthers で閉じる (自分自身は閉じない)', () => {
    const app = {};
    const closedA: boolean[] = [];
    const closedB: boolean[] = [];
    const a = { close: () => closedA.push(true) };
    const b = { close: () => closedB.push(true) };
    registerExclusive(app, a);
    registerExclusive(app, b);

    closeOthers(app, a);
    expect(closedA).toEqual([]); // 自分自身は閉じない
    expect(closedB).toEqual([true]);
  });

  it('未登録の app に対する closeOthers は no-op', () => {
    const app = {};
    const self = { close: () => {} };
    expect(() => closeOthers(app, self)).not.toThrow();
  });

  it('unregisterExclusive で解除された Exclusive は以後 closeOthers の対象にならない', () => {
    const app = {};
    const closedB: boolean[] = [];
    const a = { close: () => {} };
    const b = { close: () => closedB.push(true) };
    registerExclusive(app, a);
    registerExclusive(app, b);
    unregisterExclusive(app, b);

    closeOthers(app, a);
    expect(closedB).toEqual([]);
  });

  it('別 app に登録された Exclusive は互いに影響しない', () => {
    const appA = {};
    const appB = {};
    const closedB: boolean[] = [];
    const a = { close: () => {} };
    const b = { close: () => closedB.push(true) };
    registerExclusive(appA, a);
    registerExclusive(appB, b);

    closeOthers(appA, a);
    expect(closedB).toEqual([]);
  });
});
