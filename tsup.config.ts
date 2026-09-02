import { defineConfig } from 'tsup';

// ビルド構成 (Phase 2 で ricdom/ui サブパスを追加、設計書 §4/§6):
//  - コア: ESM (dist/index.js) + CJS (dist/index.cjs) + 型宣言 (.d.ts / .d.cts)
//    → package.json の exports 条件分岐に対応 (制作側は TS、利用側はビルド不要)
//  - コア IIFE (dist/ricdom.iife.min.js、グローバル名 `ricdom`)
//    → `<script src>` 1 本で動くことの根拠 (G1)
//  - ui: ESM (dist/ui.js) + CJS (dist/ui.cjs) + 型宣言。`ricdom/ui` サブパスの実体。
//    コアへの依存は型のみ (RicNode/App/Host を import type するだけ) なので、
//    実行時のバンドル依存関係は無い (最終報告に記載)。
//  - ui IIFE (dist/ricdom-ui.iife.min.js、グローバル名 `ricdomUI`)
//    → コアの IIFE (`ricdom`) を先に読む使い方を想定するが、型のみ依存のため
//    バンドル的には自己完結する (external 指定は不要)。
//  - dist/ricdom-ui.css は `npm run build` の postbuild (scripts/build-css.mjs) が
//    ui の ESM ビルド (dist/ui.js の buildStylesheet()) から生成する (設計書 §4)。
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
  {
    // ricdom/ui サブパスの ESM/CJS + 型宣言。コアと同じく consumer 側の bundler が
    // 自分の NODE_ENV で置換する (ui 自体は dev/prod 分岐を持たないが、コアと構成を揃える)。
    entry: { ui: 'src/ui/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false,
    clean: false,
    target: 'es2020',
  },
  {
    // ricdomUI IIFE。`<script src>` 2 本 (ricdom → ricdom-ui) で部品が動くことの根拠。
    entry: { 'ricdom-ui': 'src/ui/index.ts' },
    format: ['iife'],
    globalName: 'ricdomUI',
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
  {
    // ricdom/icons サブパスの ESM/CJS + 型宣言 (設計書付録 B A17、Phase 3c)。
    // データ + 変換器のみのパッケージで、コア/ui のどちらにも実行時依存が無い
    // (uiIcon の descriptor 引数と構造的に同じ形なだけ)。**IIFE は作らない**
    // (ビルド不要ユーザーは `npx ricdom-icon` で descriptor をコピーする、
    // v1 の「使う分だけ」哲学の継続 — 最終報告に記載)。
    entry: { icons: 'src/icons/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false,
    clean: false,
    target: 'es2020',
  },
]);
