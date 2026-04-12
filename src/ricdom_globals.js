// RicDOM コア 配布用グローバルエントリポイント
// esbuild でバンドルして RicDOM.min.js として配布する。
//
// 読み込み順：
//   <script src="RicDOM.min.js"></script>   ← コアエンジン（先に読む）
//   <script src="RicUI.min.js"></script>    ← UI 部品（後に読む、任意）
//
// 公開される API の一覧は src/ricdom.js の module.exports を参照すること
// （唯一の source of truth）。__test_exports はテスト専用なので browser
// からは除外する。

'use strict';

const { __test_exports, ...public_api } = require('./ricdom');
window.RicDOM = public_api;
