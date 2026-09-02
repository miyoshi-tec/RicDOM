import { defineConfig } from 'tsup';

// ビルド構成:
//  - ESM (dist/index.js)  + CJS (dist/index.cjs) + 型宣言 (.d.ts / .d.cts)
//    → package.json の exports 条件分岐に対応 (制作側は TS、利用側はビルド不要)
//  - IIFE (dist/ricdom.iife.min.js、グローバル名 `ricdom`)
//    → `<script src>` 1 本で動くことの根拠 (G1)
// dev/prod の分岐 (深い代入警告など、§3.3) は process.env.NODE_ENV を tsup の
// define で差し替えることで実現する。production ビルド (このコマンド) では
// 'production' を注入し、テスト実行時 (vitest) は素の process.env.NODE_ENV を使う。
export default defineConfig([
  {
    // ESM/CJS は npm 経由でバンドラーを使う consumer 向け。process.env.NODE_ENV は
    // ここでは固定しない (consumer 側の bundler (Vite/webpack 等) が自分の
    // NODE_ENV で置換するのが標準的な作法。React 等主要ライブラリも同じ扱い)。
    // これにより dev ビルドの consumer では深い代入警告 (§3.3) が有効なまま届く。
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false,
    clean: true,
    target: 'es2020',
  },
  {
    // IIFE は「<script src> 1 本で動く」利用側ビルド不要デモ・配布用 (G1)。
    // CDN から素の状態で読み込まれる想定のため、ここだけ NODE_ENV='production' を
    // 焼き込み、深い代入警告 (§3.3) 等の dev 専用コードを esbuild の dead-code
    // elimination で丸ごと削り、最小サイズにする。
    entry: { ricdom: 'src/index.ts' },
    format: ['iife'],
    globalName: 'ricdom',
    dts: false,
    sourcemap: true,
    minify: true,
    clean: false,
    target: 'es2020',
    outExtension: () => ({ js: '.iife.min.js' }),
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  },
]);
