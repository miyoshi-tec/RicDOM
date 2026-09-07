// ビルドツール (tsup/esbuild) の `define` で静的に差し替えられることを想定した
// ビルド時定数の型宣言 (アンビエント、値は与えない — 与えると「常に存在する」ことに
// なってしまい、未定義フォールバック分岐 (src/reactivity.ts の isDevMode) の型検査が
// 素通りしてしまう)。
//
// 用途: `.iife.min.js`/`.iife.js` ビルドでは `typeof __RICDOM_DEV__` が esbuild の
// 定数畳み込みの対象になり、`false` を焼き込めば dev 専用コード (深い代入警告・
// key 重複警告) が dead-code elimination で丸ごと消える。ESM/CJS ビルドや `ts-node`
// 等 tsup を経由しない実行では `define` が効かないため、実行時に
// `typeof __RICDOM_DEV__ === 'boolean'` が false になり、reactivity.ts 側が
// 従来どおり `process.env.NODE_ENV` を見るフォールバックに落ちる (tsup.config.ts 参照)。
declare const __RICDOM_DEV__: boolean | undefined;

// `version` export (コア src/index.ts / ui src/ui/index.ts) 用のビルド時定数
// (v1→v2 パリティ一括監査 #3、2.0.0-alpha.14)。`__RICDOM_DEV__` と違い dev/prod の
// 分岐用ではなく「package.json の version を publish 時点の値として焼き込む」だけの
// 定数なので、tsup.config.ts では ESM/CJS/IIFE の全エントリで無条件に define する
// (consumer のバンドラー設定に依存させない — パッケージの version は常に一定の値であるべき)。
// tsup を経由しない実行 (vitest 等) では未定義になるため、vitest.config.ts 側でも
// 同じ値を define し、テストでも package.json と一致することを確認できるようにする。
declare const __RICDOM_VERSION__: string | undefined;
