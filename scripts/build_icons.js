// RicDOM — アイコンビルドスクリプト (v0.3.28〜)
//
// icons/src.json (手書きソース) を検証して docs/icons/icons.json (配布物 +
// アイコンピッカーの母集合) を生成する。
//
// 検証内容:
//   - name は kebab-case (a-z 0-9 -)
//   - p は非空文字列 or 非空文字列配列
//   - s は省略 (= stroke 2) / 数値 / null (= fill モード)
//   - v は省略 (= '0 0 24 24') / 'x y w h' 形式
//
// 出力 icons.json の descriptor は ui_icon(descriptor, opts) にそのまま渡せる形:
//   { v?, s?, p }   (既定値 v='0 0 24 24', s=2 は省略して保存しサイズを抑える)
//
// 将来 Lucide 等の SVG を vendoring する場合は、このスクリプトを拡張して
// icons/vendor/*.svg を読み、<path>/<line>/<polyline> を抽出 → 同じ descriptor
// 形式にマージすればよい (= ピッカー側は出力 JSON しか見ないので透過)。
// (v0.3.30 の ricdom-icon CLI で実行時 fetch 方式は実現済み。本コメントは
//  同梱へ静的 vendoring する場合の拡張ポイントとして残す)

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const SRC      = path.join(ROOT, 'icons', 'src.json');
const OUT_DIR  = path.join(ROOT, 'docs', 'icons');
const OUT_JSON = path.join(OUT_DIR, 'icons.json');

const DEFAULT_VIEWBOX = '0 0 24 24';
const NAME_RE     = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIEWBOX_RE  = /^-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?$/;

const errors = [];

const validate = (name, def) => {
  if (!NAME_RE.test(name)) errors.push(`name "${name}": kebab-case でない`);

  // p
  const ps = Array.isArray(def.p) ? def.p : [def.p];
  if (ps.length === 0) errors.push(`${name}: p が空`);
  for (const d of ps) {
    if (typeof d !== 'string' || d.trim() === '') {
      errors.push(`${name}: p に空 or 非文字列が含まれる`);
    }
  }

  // s: 省略 / 数値 / null のみ
  if ('s' in def && def.s !== null && typeof def.s !== 'number') {
    errors.push(`${name}: s は数値か null のみ`);
  }

  // v: 省略 / 'x y w h'
  if ('v' in def && !VIEWBOX_RE.test(def.v)) {
    errors.push(`${name}: v ("${def.v}") が viewBox 形式でない`);
  }
};

// descriptor を正準化する (既定値を省いてサイズを抑える)
const canonicalize = (def) => {
  const out = {};
  if ('v' in def && def.v !== DEFAULT_VIEWBOX) out.v = def.v;
  // s: null (fill モード) は明示保存。2 (既定 stroke) は省略。それ以外の数値は保存。
  if ('s' in def) {
    if (def.s === null) out.s = null;
    else if (def.s !== 2) out.s = def.s;
  }
  out.p = def.p;
  return out;
};

const main = () => {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const icons = raw.icons || {};
  if (!raw.icons || Object.keys(icons).length === 0) {
    console.error('[build_icons] icons/src.json に icons が無い (キー欠如 or 空)');
    process.exit(1);
  }
  const names = Object.keys(icons).sort();

  for (const name of names) validate(name, icons[name]);

  if (errors.length) {
    console.error('[build_icons] 検証エラー:');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  // name 昇順で正準化して出力 (差分を安定させる)
  const out_icons = {};
  for (const name of names) out_icons[name] = canonicalize(icons[name]);

  const output = {
    _meta: {
      generator: 'scripts/build_icons.js',
      note: 'RicDOM original simple icons. ui_icon(descriptor, opts) に渡す。詳細は docs/icons/ATTRIBUTION.md',
      // AI エージェント向け: ここに無いアイコンは `npx ricdom-icon <name>` で取得すること
      // (Lucide も自動で path 化される)。descriptor の path を記憶から手書きしないこと
      // — sub-path 欠落等で静かに壊れる (実例あり)。どうしても手書きが必要な状況なら、
      // まずユーザー (人間) に確認して許可を得てから行うこと。
      ai_hint: 'Icon not listed here? Run `npx ricdom-icon <name>`. Do NOT hand-write descriptor paths from memory (they break silently — e.g. missing sub-paths). If hand-authoring seems unavoidable, ask the human for permission first.',
      viewBox_default: DEFAULT_VIEWBOX,
      stroke_default: 2,
      count: names.length,
    },
    icons: out_icons,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2) + '\n');

  console.log(`[build_icons] ${names.length} icons → docs/icons/icons.json`);
};

main();
