// ricdom-icon CLI — ロジック本体
//
// v1 (scripts/icon.js) の TS 移植。アイコン descriptor を「名前 → stdout」で引くコマンドの
// ヘッドレス実装。GUI を開けない CLI / CI / AI エージェント向けの導線 (設計書付録 B A17:
// 「データ + 変換器 + CLI」)。エントリポイント (`ricdomIcon.ts`) と分離してあるのは、
// ユニットテストが `main()` の副作用 (process.exit 等) を経由せずにここを直接 import
// できるようにするため (v1 は 1 ファイルで `require.main === module` 分岐していたが、
// v2 は ESM 前提のビルド (tsup) で CJS の CLI バイナリを生成する構成上、テスト対象の
// ロジックとエントリポイントを最初から分けた方が素直。最終報告に記載)。
//
// 解決順: まず同梱 (`ricdom/icons` の ICONS_BY_NAME、オフライン即返し)。無ければ Lucide を
// fetch して svgToDescriptor で path 化 (circle/rect/polygon も自動変換 = 手変換ゼロ)。
//
// 注: ログ・警告は stderr、descriptor 出力は stdout (v1 / ricdom-lz と同じ流儀)。
//     stdout はそのまま `>> icons.js` / `$(...)` で受けられる純粋な出力。

import * as https from 'node:https';
import type { IconDescriptor } from '../icons/types.js';
import { ICONS_BY_NAME } from '../icons/index.js';
import { svgToDescriptor } from '../icons/svgToDescriptor.js';

export const LUCIDE_SVG = (name: string): string => `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${name}.svg`;
export const LUCIDE_TAGS = 'https://cdn.jsdelivr.net/npm/lucide-static@latest/tags.json';

// ※ この帰属ブロックと ICONS 整形は v1 (docs/icon_playground.html) と意図的に重複していた
//    経緯を引き継ぐ (browser/Node 境界を跨ぐため共通化しない、v1 コメント継承)。出力フォーマット
//    変更時は tests/cli/ricdomIcon.test.ts も更新すること。
export const LUCIDE_NOTICE = `// アイコン: Lucide (ISC License) https://lucide.dev/
// Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
// part of Feather (MIT). All other copyright (c) for Lucide are held by
// Lucide Contributors 2022. Licensed under the ISC License.`;

/** 同梱アイコン (オフライン、`ricdom/icons` の ICONS_BY_NAME が単一ソース)。 */
export const loadBundled = (): Readonly<Record<string, IconDescriptor>> => ICONS_BY_NAME;

// ── 出力整形 ──
// ICONS 本体は inline コメントを一切持たない純オブジェクトリテラル。帰属は冒頭に
// 1 ブロックでまとめる (行末コメントのカンマずれフットガンを構造的に回避、v1 継承)。
export const buildBlock = (entries: [string, IconDescriptor][], lucideNames: string[]): string => {
  const lines: string[] = [];
  if (lucideNames.length) {
    lines.push(LUCIDE_NOTICE);
    lines.push(`// Lucide 由来: ${lucideNames.join(', ')}`);
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

export const buildJson = (entries: [string, IconDescriptor][]): string => JSON.stringify(Object.fromEntries(entries), null, 2);

// ── Lucide 取得 (ネット) ──
// global fetch (undici) は keep-alive ソケットを抱えたまま process.exit() すると
// Windows で libuv assertion を踏むため、https.get を使う (v1 継承)。デフォルトの
// globalAgent は keep-alive 無効でレスポンス後にソケットを閉じる → イベントループが
// 空になってクリーンに終了できる。相対 Location のリダイレクトも new URL で解決する
// (unpkg 対策)。
export const fetchText = (url: string, redirects = 0): Promise<string> =>
  new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'ricdom-icon' } }, (res) => {
        const { statusCode, headers } = res;
        if (statusCode != null && statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume(); // body を drain してソケットを解放
          if (redirects >= 5) {
            reject(new Error('リダイレクトが多すぎます'));
            return;
          }
          resolve(fetchText(new URL(headers.location, url).toString(), redirects + 1));
          return;
        }
        if (statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          data += c;
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });

export const fetchLucide = async (name: string): Promise<IconDescriptor> => {
  let svg: string;
  try {
    svg = await fetchText(LUCIDE_SVG(name));
  } catch (e) {
    throw new Error(`Lucide '${name}' を取得できません (${(e as Error).message})`);
  }
  return svgToDescriptor(svg); // circle/rect/polygon も path 化される
};

export interface ResolveAllResult {
  entries: [string, IconDescriptor][];
  lucide: string[];
  errors: { name: string; msg: string }[];
}

/**
 * 名前を解決する。同梱優先 (オフライン)、無ければ Lucide。
 * `lucideFetcher` はテスト用の差し替えフック (既定は実際に fetch する `fetchLucide`) —
 * 「不明な名前 → errors に集約される」経路をネットワーク接続無しに検証できるようにする
 * (v1 にはこの差し替え口が無く、ネット必須のテストは丸ごとスキップされていた。
 * v2 でのテスタビリティ改善、最終報告に記載)。
 */
export const resolveAll = async (
  names: string[],
  bundled: Readonly<Record<string, IconDescriptor>>,
  lucideFetcher: (name: string) => Promise<IconDescriptor> = fetchLucide,
): Promise<ResolveAllResult> => {
  const entries: [string, IconDescriptor][] = [];
  const lucide: string[] = [];
  const errors: { name: string; msg: string }[] = [];
  for (const name of names) {
    const b = bundled[name];
    if (b) {
      entries.push([name, b]);
    } else {
      try {
        entries.push([name, await lucideFetcher(name)]);
        lucide.push(name);
      } catch (e) {
        errors.push({ name, msg: (e as Error).message });
      }
    }
  }
  return { entries, lucide, errors };
};

export const HELP = `Usage: ricdom-icon <name...> [--json]
       ricdom-icon --search <term>
       ricdom-icon --names

アイコン descriptor を名前で引いて stdout に出す。
  <name...>      1 つ以上のアイコン名。同梱優先、無ければ Lucide を取得して path 化。
  --json         const ICONS ラッパー無しの素の descriptor ({ name: {...} }) を出す。
  --search TERM  名前候補を出す (同梱 + 可能なら Lucide)。
  --names        同梱アイコンの名前一覧を出す。
  -h, --help     このヘルプ。

出力は stdout、ログ/警告は stderr。例: ricdom-icon settings refresh-cw >> icons.js`;
