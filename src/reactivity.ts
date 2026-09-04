// RicDOM 2 — リアクティビティ (浅い Proxy + dev の深い代入警告)
//
// 設計書 §3.3 の案 A (確定): 浅い Proxy (v1 と同じ) + 深い代入を dev で
// 検知して警告する。
//
// 追跡される深さ (v1 継承、用語は設計書の「1段目」に合わせる):
//   - state.x = v                     … 追跡される (トップレベル代入)
//   - state.obj.prop = v              … 追跡される (obj は 1 段目のオブジェクト。
//                                        obj 自体が set トラップ付き子 Proxy でラップされる
//                                        ため、その子 Proxy への代入は捕まる)
//   - state.obj.nested.prop = v       … 追跡されない (nested は 2 段目。読み出し時に
//                                        raw オブジェクトが返るため、その先の代入は
//                                        どの Proxy も経由しない)
//
// 2 段目以降の未追跡代入は「気づけない」のが実害 (v1 の負債 B5)。dev ビルドでは
// 2 段目以降の読み出しを read-only 相当の Proxy で包み、そこへの set を検知して
// console.warn する (代入自体はブロックしない。production と挙動を分岐させないため。
// 「気づかせる」ことが目的であり、「禁止する」ことが目的ではない)。
//
// dev/prod の切り替えは `process.env.NODE_ENV` を都度読む (モジュール読み込み時に
// 1 回だけ判定してキャッシュすると、テストで dev/prod 両方を切り替えて検証できない
// ため)。IIFE 配布版は tsup の define で 'production' を静的に焼き込み、この判定式
// ごと esbuild の dead-code elimination で消える (tsup.config.ts 参照)。
// `process` 自体が存在しない環境 (bundler を通さない生の ESM import 等) では
// dev 相当 (警告を出す側) にフォールバックする — 「silent failure を増やさない」
// という本ライブラリの一貫した方針を、判定不能なケースでも優先するため。
//
// dom.ts の key 重複警告 (#13) も同じ判定規則を使うため export する。1 箇所に
// 定義を寄せて重複定義を避ける (dom.ts はここから import する)。
export const isDevMode = (): boolean => {
  try {
    return typeof process === 'undefined' || typeof process.env === 'undefined' || process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
};

// =====================================================================
// 2 段目以降: read-only 相当の警告 Proxy (dev only)
// =====================================================================

const deepWarnProxies = new WeakMap<object, unknown>();

const wrapDeepWarn = <T extends object>(value: T, path: string): T => {
  if (Array.isArray(value)) return value; // 配列は追跡対象外 (v1 継承、SPEC 記載事項)
  const cached = deepWarnProxies.get(value);
  if (cached) return cached as T;

  const proxy = new Proxy(value as Record<PropertyKey, unknown>, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (v != null && typeof v === 'object' && typeof prop === 'string') {
        return wrapDeepWarn(v as object, `${path}.${prop}`);
      }
      return v;
    },
    set(target, prop, value) {
      const rootKey = path.split('.')[0];
      console.warn(
        `RicDOM: "${path}.${String(prop)}" への代入は再描画をトリガーしません` +
          ' (Proxy は 1 段目までしか追跡しません)。\n' +
          `shallow copy で差し替えてください (例: app.${rootKey} = { ...app.${rootKey}, ... }）`,
      );
      target[prop] = value; // production と同じ結果になるよう代入自体は実施する
      return true;
    },
    deleteProperty(target, prop) {
      console.warn(`RicDOM: "${path}.${String(prop)}" の削除は再描画をトリガーしません。`);
      delete target[prop];
      return true;
    },
  });
  deepWarnProxies.set(value, proxy);
  return proxy as T;
};

// =====================================================================
// 1 段目: 子オブジェクトの Proxy (v1 の _wrap_child 継承)
// =====================================================================

const isTrackableObject = (v: unknown): v is object => v != null && (typeof v === 'object' || typeof v === 'function') && !Array.isArray(v);

/**
 * state オブジェクトを浅い Proxy でラップする。
 * トップレベル代入と、1 段目オブジェクトへの代入で notify (scheduleRender) を呼ぶ。
 * `ignore` キー配下は追跡しない (内部キャッシュ用、v1 継承)。
 */
export const createReactiveState = <S extends object>(rawState: S, scheduleRender: () => void): S => {
  const childProxies = new WeakMap<object, unknown>();

  const wrapChild = (val: object, key: string): unknown => {
    const cached = childProxies.get(val);
    if (cached) return cached;

    const proxy = new Proxy(val as Record<PropertyKey, unknown>, {
      get(target, prop, receiver) {
        const v = Reflect.get(target, prop, receiver);
        if (isDevMode() && prop !== 'ignore' && typeof prop === 'string' && isTrackableObject(v)) {
          return wrapDeepWarn(v, `${key}.${prop}`);
        }
        return v;
      },
      set(target, prop, value) {
        target[prop] = value;
        if (prop !== 'ignore') scheduleRender();
        return true;
      },
      deleteProperty(target, prop) {
        delete target[prop];
        if (prop !== 'ignore') scheduleRender();
        return true;
      },
    });
    childProxies.set(val, proxy);
    return proxy;
  };

  const rootProxy = new Proxy(rawState as Record<PropertyKey, unknown>, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (prop === 'ignore' || typeof prop !== 'string' || !isTrackableObject(v)) return v;
      return wrapChild(v, prop);
    },
    set(target, prop, value) {
      target[prop] = value;
      if (prop !== 'ignore') scheduleRender();
      return true;
    },
    deleteProperty(target, prop) {
      delete target[prop];
      if (prop !== 'ignore') scheduleRender();
      return true;
    },
  });

  return rootProxy as S;
};
