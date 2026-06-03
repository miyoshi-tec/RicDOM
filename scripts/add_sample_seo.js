// 各サンプル HTML に <meta name="description"> 等の SEO タグを注入する。
// 既に description が入っているファイルはスキップ (冪等)。
// 1 度実行したら、以降は新規サンプルの追加時にこのテーブルへ 1 行追加するだけ。

'use strict';

const fs   = require('fs');
const path = require('path');

const REPO_BASE = 'https://miyoshi-tec.github.io/RicDOM/samples/';

// ファイル名 → { title, description } のマップ
const ENTRIES = {
  '00_hello.html':                     { title: 'Hello World — RicDOM',                       desc: 'RicDOM の Hello World サンプル。RicDOM 単体と RicUI 利用の最小コードを並べて比較。' },
  '01_forms.html':                     { title: 'フォーム — RicDOM',                          desc: 'bind_input / ui_checkbox / ui_radiobutton による双方向バインドのデモ。' },
  '02_controls.html':                  { title: 'コントロール — RicDOM',                       desc: 'ui_button と create_ui_popup の基本的な使い方デモ。' },
  '03_popup.html':                     { title: 'ポップアップ — RicDOM',                       desc: 'create_ui_popup と create_ui_tooltip のデモ。開き方向の自動判定と排他制御。' },
  '04_accordion_dialog.html':          { title: 'ダイアログ & トースト — RicDOM',              desc: 'create_ui_dialog と create_ui_toast のデモ。controlled / uncontrolled 両モード対応。' },
  '05_toast_accordion.html':           { title: 'アコーディオン — RicDOM',                     desc: 'create_ui_accordion で複数パネルの開閉。' },
  '06_splitter.html':                  { title: 'スプリッター — RicDOM',                       desc: 'create_ui_splitter と bind_tabs によるリサイズ可能なレイアウト。' },
  '07_tweak_splitter.html':            { title: 'Tweak Panel + スプリッター — RicDOM',         desc: 'create_ui_tweak_panel をスプリッターに配置したパラメータ調整 UI。' },
  '08_tweak_menu.html':                { title: 'Tweak Panel + メニュー — RicDOM',             desc: 'create_ui_tweak_panel をポップアップメニュー内に展開。' },
  '09_json_editor.html':               { title: 'JSON エディタ — RicDOM',                       desc: 'スプリッター + ダイアログ + トースト + collapse_box で JSON 編集ツール。' },
  '10_theme_studio.html':              { title: 'Theme Studio — RicDOM',                       desc: 'CSS 変数エディタ + UI プレビュー + JSON での保存 / 読み込み。' },
  '11_theme_override.html':            { title: 'テーマ上書き — RicDOM',                       desc: 'create_ui_panel のテーマ / 密度 / disabled を組み合わせて比較。' },
  '12_md_viewer.html':                 { title: 'Markdown ビューア — RicDOM',                   desc: 'ui_md_pre で Markdown を VDOM に変換、コードハイライト対応。' },
  '13_controlled_dialog_splitter.html':{ title: 'Controlled Mode — RicDOM',                    desc: 'state 駆動の dialog / splitter + SVG グラフ + コード表示。' },
  '14_collapse_box.html':              { title: 'Collapse Box — RicDOM',                       desc: 'collapse_box の入退場アニメーション、6 パターン。配列状態とフラグの扱い canon。' },
  '15_ai_chat.html':                   { title: 'AI Chat — RicDOM',                            desc: 'AI チャット UI、4 プロバイダ対応、SSE ストリーミング、API キーは state のみ保持。' },
  '16_svg_editor.html':                { title: 'SVG ツリーエディタ — RicDOM',                  desc: 'SVG ノードの選択・編集・追加、ドラッグで直感的に配置。' },
  '17_multi_ricdom.html':              { title: 'Multi-instance Memo — RicDOM',                desc: '複数の create_RicDOM インスタンスをパネル単位に配置して再描画スコープを分離。' },
  '18_key_reconciliation.html':        { title: 'Key Reconciliation — RicDOM',                 desc: 'key 属性でリスト並べ替え時に input focus / value が混ざらない、FLIP アニメで可視化。' },
};

const samples_dir = path.join(__dirname, '..', 'docs', 'samples');

let updated = 0, skipped = 0;
for (const [file, { title, desc }] of Object.entries(ENTRIES)) {
  const fp = path.join(samples_dir, file);
  if (!fs.existsSync(fp)) {
    console.warn(`!! ${file} not found, skip`);
    continue;
  }
  let content = fs.readFileSync(fp, 'utf8');

  if (content.includes('meta name="description"')) {
    skipped++;
    continue;
  }

  const url = REPO_BASE + file;
  const seo_block =
`  <meta name="description" content="${desc}">
  <meta name="author" content="miyoshi-tec">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:site_name" content="RicDOM">
  <meta property="og:locale" content="ja_JP">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">`;

  // viewport meta の直後に挿入 (どのサンプルも共通でここを持っている)
  const new_content = content.replace(
    /(<meta name="viewport"[^>]*>)/,
    `$1\n${seo_block}`,
  );
  if (new_content === content) {
    console.warn(`!! ${file}: viewport meta not found, skip`);
    continue;
  }
  fs.writeFileSync(fp, new_content);
  updated++;
}

console.log(`[seo] updated ${updated}, skipped (already had description) ${skipped}`);
