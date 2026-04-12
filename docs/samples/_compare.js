// _compare.js — 左右比較デモの共通スクリプト（サンプル 00-06 用）
//
// 使い方:
//   <div class="compare-grid"></div>
//     ↑ この空の div に左右2カラムの HTML を自動生成する。
//   <script type="text/plain" id="src-raw">...</script>
//   <script type="text/plain" id="src-rui">...</script>
//     ↑ 左カラム (raw) と右カラム (rui) で実行するデモコード。
//   <script src="_compare.js"></script>
//
// カスタマイズ（data 属性で上書き）:
//   <div class="compare-grid"
//        data-sub-raw="手書き実装"
//        data-sub-rui="RicUI コンポーネントで実装"></div>

'use strict';

(function () {

  // ── スタイル注入 ──────────────────────────────────────────
  const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  background: #f3f4f6;
  color: #1f2937;
}

.page-intro {
  padding: 10px 20px;
  font-size: 13px; color: #6b7280; line-height: 1.6;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.col {
  display: flex; flex-direction: column;
  border-right: 1px solid #e5e7eb;
  min-width: 0;
}
.col:last-child { border-right: none; }

.col-head {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 14px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.col-badge {
  font-size: 11px; font-weight: 700;
  padding: 2px 10px; border-radius: 20px;
}
.badge-raw { background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db; }
.badge-rui { background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; }
.col-sub { font-size: 11px; color: #9ca3af; }

.demo-box {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}
.demo-box-raw { background: #fff; }
.demo-box-rui { padding: 0; }

.code-label {
  padding: 4px 14px;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em;
  background: #0f172a; color: #475569;
  border-bottom: 1px solid #1e293b;
}
.code-block {
  background: #282c34; overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.code-block:hover { scrollbar-color: rgba(255,255,255,0.25) transparent; }
.code-block pre { margin: 0; }
.code-block pre code {
  display: block;
  padding: 14px 18px !important;
  font-size: 12px !important;
  line-height: 1.65 !important;
}

@media (max-width: 700px) {
  .compare-grid { grid-template-columns: 1fr; }
  .col { border-right: none; border-bottom: 1px solid #e5e7eb; }
}
  `.trim();

  const style_el = document.createElement('style');
  style_el.textContent = CSS;
  document.head.appendChild(style_el);

  // ── 比較グリッド HTML 生成 ────────────────────────────────
  const grid = document.querySelector('.compare-grid');
  if (grid) {
    const sub_raw = grid.dataset.subRaw || 'スタイルなし・ブラウザデフォルト';
    const sub_rui = grid.dataset.subRui || 'CSS 主導テーマシステム';
    grid.innerHTML = `
      <div class="col">
        <div class="col-head">
          <span class="col-badge badge-raw">RicDOM のみ</span>
          <span class="col-sub">${sub_raw}</span>
        </div>
        <div class="demo-box demo-box-raw">
          <div id="mount-raw"></div>
        </div>
        <div class="code-label">コード</div>
        <div class="code-block">
          <pre><code id="code-raw" class="language-javascript"></code></pre>
        </div>
      </div>
      <div class="col">
        <div class="col-head">
          <span class="col-badge badge-rui">RicUI</span>
          <span class="col-sub">${sub_rui}</span>
        </div>
        <div class="demo-box demo-box-rui">
          <div id="mount-rui"></div>
        </div>
        <div class="code-label">コード</div>
        <div class="code-block">
          <pre><code id="code-rui" class="language-javascript"></code></pre>
        </div>
      </div>
    `;
  }

  // ── デモ実行 ──────────────────────────────────────────────
  const src_raw = document.getElementById('src-raw')?.textContent.trim();
  const src_rui = document.getElementById('src-rui')?.textContent.trim();

  if (src_raw) {
    try { new Function(src_raw)(); }
    catch (err) {
      document.getElementById('mount-raw').textContent = 'Error: ' + err.message;
      console.error(err);
    }
  }
  if (src_rui) {
    try { new Function(src_rui)(); }
    catch (err) {
      document.getElementById('mount-rui').textContent = 'Error: ' + err.message;
      console.error(err);
    }
  }

  // ── コード表示（highlight.js）────────────────────────────
  ['code-raw', 'code-rui'].forEach(id => {
    const el = document.getElementById(id);
    const src_id = id.replace('code-', 'src-');
    const src = document.getElementById(src_id)?.textContent.trim();
    if (el && src) {
      el.textContent = src;
      hljs.highlightElement(el);
    }
  });
})();
