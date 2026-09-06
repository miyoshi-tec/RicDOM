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
// dev/prod の切り替えは本来 `process.env.NODE_ENV` を都度読む設計だった (モジュール
// 読み込み時に 1 回だけ判定してキャッシュすると、テストで dev/prod 両方を切り替えて
// 検証できないため)。IIFE 配布版は tsup の define で 'production' を静的に焼き込み、
// この判定式ごと esbuild の dead-code elimination で消える —はずだったが、
// 2.0.0-alpha.10 で判明した穴 (統括確認済み): tsup/esbuild の `define` は
// `process.env.NODE_ENV` という「式全体」をトークンとして置換するだけで、OR 連鎖の
// 前 2 節 (`typeof process === 'undefined'` / `typeof process.env === 'undefined'`) は
// 置換対象外のまま生きたコードとして残る。`<script>` タグ直読みなど `process`
// グローバルが存在しないブラウザでは、この 2 節が常に true になり production ビルド
// (`.iife.min.js`) でも isDevMode() が true を返し続けてしまい、警告コードごと DCE
// されるという SPEC.md の記述が事実に反していた (grep で warn 文字列が min に残る
// ことを確認)。
//
// 対策の実装中にさらに判明した点 (esbuild の実機検証で確認、統括確認済み): 単に
// `isDevMode()` の中身を `typeof __RICDOM_DEV__ === 'boolean' ? ... : ...` という
// 定数畳み込み可能な形に書き換えるだけでは不十分だった。esbuild は「関数の中身が
// 定数に畳み込める」ことと「その関数の呼び出し箇所を定数に置き換える」ことを
// 結び付けない (関数呼び出しをまたいだ定数伝播/インライン化を行わない —
// `var f=()=>false; if(f()){...}` は実際にビルドしても `f` も `f()&&{...}` も
// 丸ごと残る。関数境界を越えると DCE が止まる)。呼び出し式 `isDevMode()` 自体を
// `if` の条件式から追い出さない限り、内部がどれだけ定数化されても warn コードは
// 物理的に残ってしまう。
//
// 正しい対策: `??` の左辺が「null/undefined でないと静的にわかる」場合、esbuild は
// 右辺を評価すらせず定数畳み込みできる (実測済み: `false ?? f()` → `false` に畳み込まれ
// `f` 呼び出しごと消える。逆に `X && false` のように定数を `&&` の右側に置くと、
// 左が非定数変数だと esbuild は畳み込まない — dom.ts 側で実際にこの順序違いで
// 一度ハマった。定数は必ず左に置くこと)。そこで、ビルド時に焼き込まれる生の値を
// トップレベル定数 `bakedDevMode` として先に確定させ (`typeof __RICDOM_DEV__` の
// 判定はここで一度だけ)、呼び出し側 (このファイルの wrapChild get トラップ、
// および dom.ts の重複 key 検知) は `isDevMode()` を直接呼ばず、必ず定数を左に
// 置いた `bakedDevMode ?? isDevMode()` の形で参照する。`.iife.min.js`
// (`__RICDOM_DEV__: 'false'` → `bakedDevMode` が定数 `false`) では
// `false ?? isDevMode()` が `false` に畳み込まれ、`isDevMode()` 呼び出しと
// それに続く wrapDeepWarn/console.warn のコードごと dead-code elimination される。
// `.iife.js` (`__RICDOM_DEV__: 'true'`) では `true ?? isDevMode()` が `true` に
// 畳み込まれ、警告コードが無条件に残る。ESM/CJS やバンドラを経由しない実行
// (ts-node、bundler なしの生 ESM import 等) では `__RICDOM_DEV__` は未定義のままなので
// `bakedDevMode` は `undefined` になり、`undefined ?? isDevMode()` は毎回
// `isDevMode()` を呼んで `process.env.NODE_ENV` を都度読む (テストで dev/prod を
// 切り替えて検証できる、従来どおりの動的挙動を維持)。`process` 自体が存在しない
// 環境では「判定不能なら dev 扱い」という方針を維持する (「silent failure を
// 増やさない」という本ライブラリの一貫した方針を、判定不能なケースでも優先するため)。
// `declare const __RICDOM_DEV__` の型宣言は src/env.d.ts。
//
// dom.ts の key 重複警告 (#13) も同じ判定規則を使うため `isDevMode` と `bakedDevMode`
// の両方を export する。1 箇所に定義を寄せて重複定義を避ける (dom.ts はここから
// import する)。`isDevMode()` 単体 (`bakedDevMode` を経由しない素の呼び出し) は
// 外部 API・テスト用途に残す — DCE 対象にならないことを許容した上での「常に正しい
// 判定を返す関数」としての役割は変わらない。
export const bakedDevMode: boolean | undefined = typeof __RICDOM_DEV__ === 'boolean' ? __RICDOM_DEV__ : undefined;

export const isDevMode = (): boolean => {
  if (bakedDevMode !== undefined) return bakedDevMode;
  try {
    return typeof process === 'undefined' || typeof process.env === 'undefined' || process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
};

// =====================================================================
// 2 段目以降 (+ 配列は 1 段目から): read-only 相当の警告 Proxy (dev only)
// =====================================================================
//
// 2.0.0-alpha.11 で判明した穴 (Potopeta の最小再現、統括確認済み、v2 の負債 B5 続き):
// 配列は「再描画の追跡対象外」(isTrackableObject が除外、これは変更しない — 配列の
// 差し替え `app.pages = [...app.pages]` が canon であることの帰結) だが、旧実装は
// この関数自体も配列を素通しにしていたため、配列要素を経由した先はどの深さでも
// dev 警告が出ないという別の穴になっていた (`app.arr[0].x = 2` 等)。list 状 state
// (`pages[]`/`items[]`) は consumer が最も深い代入をやりがちな形で、警告の死角に
// なっていた。対策: 配列も素通しせずこの警告 Proxy で包む。「追跡 (notify) の
// 対象外」と「警告の対象外」は別の話であり、後者だけをここで解消する。
const deepWarnProxies = new WeakMap<object, unknown>();

// 呼び出すと配列の中身を書き換える mutating メソッド。個別に警告し、1 回の呼び出しで
// 警告 1 回だけ出す (target = 生配列に対して直接 apply することで、内部の要素代入が
// この Proxy の set トラップを経由せず、要素数分の多重警告を避ける)。
const ARRAY_MUTATING_METHODS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'];

const wrapDeepWarn = <T extends object>(value: T, path: string): T => {
  const cached = deepWarnProxies.get(value);
  if (cached) return cached as T;

  const isArr = Array.isArray(value);
  const rootKey = path.split(/[.[]/)[0]; // 最初の区切り (`.` か `[`) の手前 = 1 段目の state key
  // 配列要素は `path[i]`、オブジェクトのプロパティは `path.prop` で子パスを作る。
  const childPath = (prop: string): string => (isArr && /^\d+$/.test(prop) ? `${path}[${prop}]` : `${path}.${prop}`);

  const proxy = new Proxy(value as Record<PropertyKey, unknown>, {
    get(target, prop, receiver) {
      if (isArr && typeof prop === 'string' && ARRAY_MUTATING_METHODS.includes(prop)) {
        return (...args: unknown[]): unknown => {
          console.warn(
            `RicDOM: "${path}.${prop}()" の呼び出しは再描画をトリガーしません` +
              ' (配列の mutating メソッドは検知対象外です)。\n' +
              `差し替えてください (例: app.${rootKey} = [...app.${rootKey}]）`,
          );
          // target (生配列) に直接適用する。receiver (この Proxy) 越しに呼ぶと
          // メソッド内部の要素代入のたびに set トラップが発火し、要素数分の警告が
          // 出てしまう (例: sort で N 回警告) ため、意図的に target に対して行う。
          const fn = Array.prototype[prop as keyof unknown[]] as (...a: unknown[]) => unknown;
          return fn.apply(target, args);
        };
      }
      const v = Reflect.get(target, prop, receiver);
      if (v != null && typeof v === 'object' && typeof prop === 'string') {
        return wrapDeepWarn(v as object, childPath(prop));
      }
      return v;
    },
    set(target, prop, value) {
      const label = typeof prop === 'string' ? childPath(prop) : `${path}.${String(prop)}`;
      if (isArr) {
        console.warn(
          `RicDOM: "${label}" への代入は再描画をトリガーしません` +
            ' (配列要素・length への代入は検知対象外です)。\n' +
            `差し替えてください (例: app.${rootKey} = [...app.${rootKey}]）`,
        );
      } else {
        console.warn(
          `RicDOM: "${label}" への代入は再描画をトリガーしません` +
            ' (Proxy は 1 段目までしか追跡しません)。\n' +
            `shallow copy で差し替えてください (例: app.${rootKey} = { ...app.${rootKey}, ... }）`,
        );
      }
      target[prop] = value; // production と同じ結果になるよう代入自体は実施する
      return true;
    },
    deleteProperty(target, prop) {
      const label = typeof prop === 'string' ? childPath(prop) : `${path}.${String(prop)}`;
      console.warn(`RicDOM: "${label}" の削除は再描画をトリガーしません。`);
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
        // `isDevMode()` を直接条件に置かず `bakedDevMode ?? isDevMode()` にする理由は
        // 上の isDevMode 定義直前のコメント参照 (production ビルドで DCE を効かせるため)。
        // オブジェクトは従来どおり (isTrackableObject、関数含む・配列除く)。配列は
        // notify 追跡の対象外という判定 (isTrackableObject) はそのままに、警告 Proxy
        // だけは別途かける (alpha.11、v2 の負債 B5 続き — wrapDeepWarn 定義直前のコメント参照)。
        if (
          (bakedDevMode ?? isDevMode()) &&
          prop !== 'ignore' &&
          typeof prop === 'string' &&
          (isTrackableObject(v) || Array.isArray(v))
        ) {
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
      // 元の分岐 (`prop === 'ignore' || typeof prop !== 'string' || !isTrackableObject(v)`)
      // はそのまま温存する (production ビルドの minify 後の形を変えないため —
      // 分岐を組み替えると内容が同じでも esbuild の変数名割り当てがずれ、DCE で
      // 消えるはずの配列分岐が無くても gzip が数バイト変動することを実測で確認した)。
      // 配列は notify 追跡の子 Proxy (wrapChild) を持たない (`app.pages = [...]` の
      // 差し替えがそのままトップレベル代入として追跡されるため、それで十分) が、
      // 1 段目で読んだ配列そのものへの要素代入・mutating メソッドは dev では
      // 警告 Proxy で包む (alpha.11、wrapDeepWarn 定義直前のコメント参照) ので、
      // この分岐の内側にだけ追加する。
      if (prop === 'ignore' || typeof prop !== 'string' || !isTrackableObject(v)) {
        // 定数 (`bakedDevMode ?? isDevMode()`) を `&&` の左に置く。右に置くと
        // (`Array.isArray(v) && 定数`) 、左が非定数のため esbuild は `Array.isArray(v)`
        // の呼び出し自体を副作用ありとみなして残してしまい、DCE が効かない
        // (isDevMode 定義直前のコメント、および dom.ts で一度ハマった教訓と同じ規律)。
        if (prop !== 'ignore' && typeof prop === 'string' && (bakedDevMode ?? isDevMode()) && Array.isArray(v)) {
          return wrapDeepWarn(v, prop);
        }
        return v;
      }
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
