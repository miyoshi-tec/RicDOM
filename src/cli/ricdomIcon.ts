// ricdom-icon CLI — エントリポイント
//
// v1 (scripts/icon.js) の main() 部分の TS 移植。ロジック本体は ricdomIconLib.ts に
// 分離してある (テストから副作用なしで import するため、ricdomIconLib.ts のヘッダ
// コメント参照)。tsup がこのファイルを Node 向け CJS 単体バイナリ
// (dist/cli/ricdom-icon.cjs、package.json の `bin`) にビルドする。
// shebang (#!/usr/bin/env node) はソースには書かず、tsup.config.ts の banner で
// 出力ファイルの先頭に付与する (このファイル自体は通常の .ts として tsc/vitest からも
// import できるようにするため — shebang をソースに書くと isolatedModules 環境や
// 一部ツールが「実行可能スクリプト」と誤認する事故を避ける)。
//
// 使い方:
//   ricdom-icon settings refresh-cw chat   # 複数一括 → 貼れる const ICONS = {...}
//   ricdom-icon settings --json            # 素の descriptor だけ ({ name: {...} })
//   ricdom-icon --search gear              # 名前が分からない時の候補出し
//   ricdom-icon --names                    # 同梱アイコンの名前一覧
//   ricdom-icon -h / --help                # ヘルプ

import { HELP, LUCIDE_TAGS, buildBlock, buildJson, fetchText, loadBundled, resolveAll } from './ricdomIconLib.js';

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help') || args.length === 0) {
    process.stderr.write(HELP + '\n');
    process.exitCode = args.length === 0 ? 1 : 0;
    return;
  }

  const bundled = loadBundled();

  // --names: 同梱一覧 (ICON_NAMES のケバブ名、= ICONS_BY_NAME のキー)
  if (args.includes('--names')) {
    process.stdout.write(Object.keys(bundled).sort().join('\n') + '\n');
    return;
  }

  // --search TERM: 候補出し
  if (args.includes('--search')) {
    const term = (args[args.indexOf('--search') + 1] || '').toLowerCase();
    if (!term) {
      process.stderr.write('--search には検索語が必要です\n');
      process.exitCode = 1;
      return;
    }
    const localHits = Object.keys(bundled)
      .filter((n) => n.includes(term))
      .sort();
    process.stdout.write('# 同梱:\n' + (localHits.length ? localHits.map((n) => '  ' + n).join('\n') : '  (なし)') + '\n');
    // Lucide は任意 (ネット必須)。失敗してもエラーにしない。
    try {
      const tags = JSON.parse(await fetchText(LUCIDE_TAGS)) as Record<string, unknown>;
      const lhits = Object.keys(tags)
        .filter((n) => n.includes(term))
        .sort()
        .slice(0, 40);
      process.stdout.write('# Lucide:\n' + (lhits.length ? lhits.map((n) => '  ' + n).join('\n') : '  (なし)') + '\n');
    } catch {
      process.stderr.write('(Lucide 検索はスキップ: ネットに接続できません)\n');
    }
    return;
  }

  // 残りの引数 = アイコン名 (フラグを除く)
  const json = args.includes('--json');
  const names = args.filter((a) => !a.startsWith('-'));
  if (names.length === 0) {
    process.stderr.write('アイコン名を 1 つ以上指定してください\n');
    process.exitCode = 1;
    return;
  }

  const { entries, lucide, errors } = await resolveAll(names, bundled);

  for (const e of errors) process.stderr.write(`! ${e.name}: ${e.msg}\n`);

  if (entries.length) {
    process.stdout.write((json ? buildJson(entries) : buildBlock(entries, lucide)) + '\n');
  }
  // process.exit() は使わない (https.get がソケットを閉じるのでループは自然に空になる、v1 継承)。
  // exitCode だけ立てて return すると、Windows の libuv assertion を踏まずに終了できる。
  process.exitCode = errors.length ? 1 : 0;
};

main().catch((e: Error) => {
  process.stderr.write('ricdom-icon: ' + e.message + '\n');
  process.exitCode = 1;
});
