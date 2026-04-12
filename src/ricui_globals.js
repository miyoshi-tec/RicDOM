// RicUI 配布用グローバルエントリポイント
// esbuild でバンドルして RicUI.min.js として配布する。
//
// 読み込み順：RicDOM.min.js を先に読んでから RicUI.min.js を読む。
//   <script src="RicDOM.min.js"></script>
//   <script src="RicUI.min.js"></script>
//
// 公開される API の一覧は ric_ui/index.js を参照すること（唯一の source of truth）。
// ここで個別に destructure すると drift の原因になるため、一括 re-export する。

'use strict';

window.RicUI = require('../ric_ui');
