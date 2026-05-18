// RicUI.lz.min.js (LZSS 自己展開版) regression test (v0.3.17〜)
//
// 設計上の契約: 「`RicUI.lz.min.js` を <script> で読み込んだ後の window.RicUI は、
// `RicUI.min.js` を読み込んだ場合と完全に同じ export を提供する」。
//
// LZ 版は IoT・組み込み等 gzip が走らない配信環境向けに、本体を ~47% 縮めた
// 自己展開バンドル。decompressor は内部の base64-encoded LZSS reference を atob
// で展開して (0,eval) で実行する。consumer 視点では透明。

'use strict';

const fs = require('fs');
const path = require('path');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');

// 両 bundle を jsdom で load して window.RicUI の export を比較する
const load_bundle = (filename) => {
  const src = fs.readFileSync(path.join(ROOT, filename), 'utf8');
  const dom = new JSDOM('<html><body></body></html>', { runScripts: 'outside-only' });
  dom.window.eval(src);
  return dom.window;
};

// 全 ui_* / create_ui_* / bind_* / context API の存在を主張する key リスト。
// build pipeline が変わるとここを更新する。
describe('RicUI.lz.min.js: 通常版と同じ export を提供する', () => {

  // ファイル両方が存在する場合だけ実行 (npm run build を走らせていない CI でも fail しない)
  const HAS_NORMAL = fs.existsSync(path.join(ROOT, 'RicUI.min.js'));
  const HAS_LZ     = fs.existsSync(path.join(ROOT, 'RicUI.lz.min.js'));

  test('両 bundle が build 済みである (skip 条件)', (t) => {
    if (!HAS_NORMAL || !HAS_LZ) {
      t.skip('npm run build を実行してから本テストを走らせてください');
      return;
    }
    assert.ok(true);
  });

  test('export key の集合が完全一致', (t) => {
    if (!HAS_NORMAL || !HAS_LZ) { t.skip(); return; }
    const w1 = load_bundle('RicUI.min.js');
    const w2 = load_bundle('RicUI.lz.min.js');
    const keys1 = Object.keys(w1.RicUI || {}).sort();
    const keys2 = Object.keys(w2.RicUI || {}).sort();
    assert.deepEqual(keys1, keys2,
      'LZ 版の RicUI export が通常版と一致する');
    assert.ok(keys1.length >= 40, 'まともな数の export がある (sanity)');
  });

  test('代表的な factory / 純関数が正しい型で expose されている', (t) => {
    if (!HAS_LZ) { t.skip(); return; }
    const w = load_bundle('RicUI.lz.min.js');
    const expected_functions = [
      'ui_button', 'ui_input', 'ui_panel', 'ui_col', 'ui_row',
      'create_ui_dialog', 'create_ui_popup', 'create_ui_toast',
      'create_ui_splitter', 'create_ui_page',
      'ui_inline_menu', 'watch_outside_click',
    ];
    for (const name of expected_functions) {
      assert.equal(typeof w.RicUI[name], 'function',
        `RicUI.${name} は function`);
    }
  });

  test('ui_button() の戻り値構造が通常版と同等 (LZ decompress 後の eval が機能している)', (t) => {
    if (!HAS_NORMAL || !HAS_LZ) { t.skip(); return; }
    const w1 = load_bundle('RicUI.min.js');
    const w2 = load_bundle('RicUI.lz.min.js');
    const n1 = w1.RicUI.ui_button({ ctx: ['Save'], variant: 'primary', id: 'btn1' });
    const n2 = w2.RicUI.ui_button({ ctx: ['Save'], variant: 'primary', id: 'btn1' });
    // tag / class / ctx / id が一致
    assert.equal(n1.tag, n2.tag);
    assert.equal(n1.class, n2.class);
    assert.deepEqual(n1.ctx, n2.ctx);
    assert.equal(n1.id, n2.id);
  });

  test('LZ 版のファイルサイズが通常版より小さい (圧縮効果の sanity)', (t) => {
    if (!HAS_NORMAL || !HAS_LZ) { t.skip(); return; }
    const size_normal = fs.statSync(path.join(ROOT, 'RicUI.min.js')).size;
    const size_lz     = fs.statSync(path.join(ROOT, 'RicUI.lz.min.js')).size;
    assert.ok(size_lz < size_normal,
      `LZ 版 (${size_lz}B) は通常版 (${size_normal}B) より小さくあるべき`);
    // 想定範囲: 通常版の 70% 未満 (47% 程度を期待)
    assert.ok(size_lz < size_normal * 0.7,
      `LZ 版の圧縮率が想定より悪い (${(size_lz / size_normal * 100).toFixed(1)}%)`);
  });
});

describe('RicDOM.lz.min.js: 通常版と同じ export を提供する', () => {

  const HAS_NORMAL = fs.existsSync(path.join(ROOT, 'RicDOM.min.js'));
  const HAS_LZ     = fs.existsSync(path.join(ROOT, 'RicDOM.lz.min.js'));

  test('両 bundle が build 済みである (skip 条件)', (t) => {
    if (!HAS_NORMAL || !HAS_LZ) {
      t.skip('npm run build を実行してから本テストを走らせてください');
      return;
    }
    assert.ok(true);
  });

  test('export key の集合が完全一致', (t) => {
    if (!HAS_NORMAL || !HAS_LZ) { t.skip(); return; }
    const w1 = load_bundle('RicDOM.min.js');
    const w2 = load_bundle('RicDOM.lz.min.js');
    const keys1 = Object.keys(w1.RicDOM || {}).sort();
    const keys2 = Object.keys(w2.RicDOM || {}).sort();
    assert.deepEqual(keys1, keys2,
      'LZ 版の RicDOM export が通常版と一致する');
    // RicDOM コアは create_RicDOM / NOOP_PROXY / version の 3 つ前後
    assert.ok(keys1.includes('create_RicDOM'), 'create_RicDOM が export されている');
  });

  test('create_RicDOM() が正常に動作する (LZ decompress 後の eval が機能している)', (t) => {
    if (!HAS_LZ) { t.skip(); return; }
    const w = load_bundle('RicDOM.lz.min.js');
    assert.equal(typeof w.RicDOM.create_RicDOM, 'function');
    // インスタンス化して render が呼べることだけ確認 (DOM 反映は rAF が必要なので別件)
    const s = w.RicDOM.create_RicDOM('#app', {
      count: 0,
      render(s) { return { tag: 'div', ctx: ['count: ' + s.count] }; },
    });
    assert.ok(s, 'create_RicDOM が NOOP_PROXY ではない instance を返す');
    assert.equal(typeof s.count, 'number', 'state field にアクセスできる');
  });

  test('LZ 版のファイルサイズが通常版より小さい (圧縮効果の sanity)', (t) => {
    if (!HAS_NORMAL || !HAS_LZ) { t.skip(); return; }
    const size_normal = fs.statSync(path.join(ROOT, 'RicDOM.min.js')).size;
    const size_lz     = fs.statSync(path.join(ROOT, 'RicDOM.lz.min.js')).size;
    assert.ok(size_lz < size_normal,
      `LZ 版 (${size_lz}B) は通常版 (${size_normal}B) より小さくあるべき`);
    // RicDOM core は CSS と違って繰り返しが少ないので圧縮率は控えめ。
    // 通常版の 85% 未満 (~73% 程度を期待) を許容。
    assert.ok(size_lz < size_normal * 0.85,
      `LZ 版の圧縮率が想定より悪い (${(size_lz / size_normal * 100).toFixed(1)}%)`);
  });
});
