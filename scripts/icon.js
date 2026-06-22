#!/usr/bin/env node
// icon.js — ricdom-icon CLI
//
// アイコン descriptor を「名前 → stdout」で引くコマンド。アイコンピッカー
// (icon_playground.html) の **ヘッドレス版**。GUI を開けない CLI / CI /
// AI エージェント向けの導線として用意した (consumer アンケートで 6 エージェント
// 満場一致の要望 + 「記憶から path 手書き → 壊れたアイコン出荷」の実害を構造的に防ぐ)。
//
// 使い方:
//   ricdom-icon settings refresh-cw chat   # 複数一括 → 貼れる const ICONS = {...}
//   ricdom-icon settings --json            # 素の descriptor だけ ({ name: {...} })
//   ricdom-icon --search gear              # 名前が分からない時の候補出し
//   ricdom-icon --names                    # 同梱 35 個の名前一覧
//   ricdom-icon -h / --help                # ヘルプ
//
// 解決順: まず同梱 (docs/icons/icons.json、オフライン即返し)。無ければ Lucide を
// fetch して svg_to_descriptor で path 化 (circle/rect/polygon も自動変換 = 手変換ゼロ)。
//
// 注: ログ・警告は **stderr**、descriptor 出力は **stdout** (ricdom-lz と同じ流儀)。
//     stdout はそのまま `>> icons.js` / `$(...)` で受けられる純粋な出力。

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { svg_to_descriptor } = require('../docs/icons/svg_to_descriptor');

const ICONS_JSON  = path.join(__dirname, '..', 'docs', 'icons', 'icons.json');
const LUCIDE_SVG  = (name) => `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${name}.svg`;
const LUCIDE_TAGS = 'https://cdn.jsdelivr.net/npm/lucide-static@latest/tags.json';

const LUCIDE_NOTICE =
`// アイコン: Lucide (ISC License) https://lucide.dev/
// Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
// part of Feather (MIT). All other copyright (c) for Lucide are held by
// Lucide Contributors 2022. Licensed under the ISC License.`;

// ── 同梱アイコン (オフライン) ──
const load_bundled = () => JSON.parse(fs.readFileSync(ICONS_JSON, 'utf8')).icons;

// ── 出力整形 ──
// ICONS 本体は inline コメントを一切持たない純オブジェクトリテラル。帰属は冒頭に
// 1 ブロックでまとめる (行末コメントのカンマずれフットガンを構造的に回避。TG 報告)。
const build_block = (entries, lucide_names) => {
  const lines = [];
  if (lucide_names.length) {
    lines.push(LUCIDE_NOTICE);
    lines.push(`// Lucide 由来: ${lucide_names.join(', ')}`);
    lines.push('');
  }
  lines.push('const ICONS = {');
  for (const [name, d] of entries) {
    const key = /^[a-zA-Z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
    lines.push(`  ${key}: ${JSON.stringify(d)},`);
  }
  lines.push('};');
  return lines.join('\n');
};

const build_json = (entries) =>
  JSON.stringify(Object.fromEntries(entries), null, 2);

// ── Lucide 取得 (ネット) ──
// global fetch (undici) は keep-alive ソケットを抱えたまま process.exit() すると
// Windows で libuv assertion を踏むため、https.get を使う。デフォルトの globalAgent
// は keep-alive 無効でレスポンス後にソケットを閉じる → イベントループが空になって
// クリーンに終了できる。相対 Location のリダイレクトも new URL で解決する (unpkg 対策)。
const fetch_text = (url, redirects = 0) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'user-agent': 'ricdom-icon' } }, (res) => {
    const { statusCode, headers } = res;
    if (statusCode >= 300 && statusCode < 400 && headers.location) {
      res.resume();  // body を drain してソケットを解放
      if (redirects >= 5) return reject(new Error('リダイレクトが多すぎます'));
      return resolve(fetch_text(new URL(headers.location, url).toString(), redirects + 1));
    }
    if (statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${statusCode}`)); }
    let data = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { data += c; });
    res.on('end', () => resolve(data));
  }).on('error', reject);
});

const fetch_lucide = async (name) => {
  let svg;
  try { svg = await fetch_text(LUCIDE_SVG(name)); }
  catch (e) { throw new Error(`Lucide '${name}' を取得できません (${e.message})`); }
  return svg_to_descriptor(svg);   // circle/rect/polygon も path 化される
};

// ── 名前を解決する。同梱優先 (オフライン)、無ければ Lucide。──
// 戻り値: { entries: [[name, descriptor], ...], lucide: [name,...], errors: [{name,msg}] }
const resolve_all = async (names, bundled) => {
  const entries = [];
  const lucide  = [];
  const errors  = [];
  for (const name of names) {
    if (bundled[name]) {
      entries.push([name, bundled[name]]);
    } else {
      try {
        entries.push([name, await fetch_lucide(name)]);
        lucide.push(name);
      } catch (e) {
        errors.push({ name, msg: e.message });
      }
    }
  }
  return { entries, lucide, errors };
};

const HELP =
`Usage: ricdom-icon <name...> [--json]
       ricdom-icon --search <term>
       ricdom-icon --names

アイコン descriptor を名前で引いて stdout に出す (ピッカーのヘッドレス版)。
  <name...>      1 つ以上のアイコン名。同梱優先、無ければ Lucide を取得して path 化。
  --json         const ICONS ラッパー無しの素の descriptor ({ name: {...} }) を出す。
  --search TERM  名前候補を出す (同梱 + 可能なら Lucide)。
  --names        同梱アイコンの名前一覧を出す。
  -h, --help     このヘルプ。

出力は stdout、ログ/警告は stderr。例: ricdom-icon settings refresh-cw >> icons.js`;

const main = async () => {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help') || args.length === 0) {
    process.stderr.write(HELP + '\n');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const bundled = load_bundled();

  // --names: 同梱一覧
  if (args.includes('--names')) {
    process.stdout.write(Object.keys(bundled).sort().join('\n') + '\n');
    return;
  }

  // --search TERM: 候補出し
  if (args.includes('--search')) {
    const term = (args[args.indexOf('--search') + 1] || '').toLowerCase();
    if (!term) { process.stderr.write('--search には検索語が必要です\n'); process.exit(1); }
    const local_hits = Object.keys(bundled).filter(n => n.includes(term)).sort();
    process.stdout.write('# 同梱:\n' + (local_hits.length ? local_hits.map(n => '  ' + n).join('\n') : '  (なし)') + '\n');
    // Lucide は任意 (ネット必須)。失敗してもエラーにしない。
    try {
      const tags = JSON.parse(await fetch_text(LUCIDE_TAGS));
      const lhits = Object.keys(tags).filter(n => n.includes(term)).sort().slice(0, 40);
      process.stdout.write('# Lucide:\n' + (lhits.length ? lhits.map(n => '  ' + n).join('\n') : '  (なし)') + '\n');
    } catch {
      process.stderr.write('(Lucide 検索はスキップ: ネットに接続できません)\n');
    }
    return;
  }

  // 残りの引数 = アイコン名 (フラグを除く)
  const json = args.includes('--json');
  const names = args.filter(a => !a.startsWith('-'));
  if (names.length === 0) { process.stderr.write('アイコン名を 1 つ以上指定してください\n'); process.exit(1); }

  const { entries, lucide, errors } = await resolve_all(names, bundled);

  for (const e of errors) process.stderr.write(`! ${e.name}: ${e.msg}\n`);

  if (entries.length) {
    process.stdout.write((json ? build_json(entries) : build_block(entries, lucide)) + '\n');
  }
  // process.exit() は使わない (https.get がソケットを閉じるのでループは自然に空になる)。
  // exitCode だけ立てて return すると、Windows の libuv assertion を踏まずに終了できる。
  process.exitCode = errors.length ? 1 : 0;
};

// CLI として呼ばれた時だけ実行。require された場合は helper を export (テスト用)。
if (require.main === module) {
  main().catch((e) => { process.stderr.write('ricdom-icon: ' + e.message + '\n'); process.exit(1); });
}

module.exports = { build_block, build_json, resolve_all, load_bundled, LUCIDE_NOTICE };
