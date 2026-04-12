// RicUI — ui_md_pre
// Markdown テキストを VDOM ノードに変換する部品。
// ヘルプ画面・チュートリアル表示用の簡易パーサー。
// 外部ライブラリ不要。完全な CommonMark 準拠ではなく、実用的なサブセットを対応する。
//
// 使い方：
//   ui_md_pre({ ctx: ['# 見出し\n\nテキスト'] })
//
//   // 複数行の Markdown
//   ui_md_pre({ ctx: [`
//     # タイトル
//     **太字** と *斜体* と \`コード\`
//     - リスト A
//     - リスト B
//   `] })
//
// 対応構文：
//   # ## ###           見出し（h1 / h2 / h3）
//   **text**           太字
//   *text*             斜体
//   `code`             インラインコード
//   ```lang ... ```    コードブロック（ui_code_pre 風の表示）
//   - item             箇条書きリスト（ネストなし）
//   > quote            引用
//   [text](url)        リンク
//   ---                水平線
//   空行               段落区切り
//
// Props:
//   ctx        {string[]}   Markdown テキスト（複数渡すと連結される）

'use strict';

// ── インライン Markdown → VDOM ノード配列 ──────────────────────────
// 太字・斜体・インラインコード・リンクを解析して VDOM ノードの配列を返す。
// ネストは「太字の中に斜体」程度まで対応する。
const _parse_inline = (text) => {
  const nodes = [];
  // 正規表現: コード → リンク → 太字 → 斜体 の優先度で探す
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    // マッチ前のプレーンテキスト
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      // `code`
      nodes.push({ tag: 'code', class: 'ric-md-pre__code', ctx: [m[1]] });
    } else if (m[2] !== undefined) {
      // [text](url)
      nodes.push({
        tag: 'a', class: 'ric-md-pre__link',
        href: m[3], target: '_blank', rel: 'noopener',
        ctx: [m[2]],
      });
    } else if (m[4] !== undefined) {
      // **bold** — 中身を再帰パースして斜体等に対応
      nodes.push({ tag: 'strong', ctx: _parse_inline(m[4]) });
    } else if (m[5] !== undefined) {
      // *italic*
      nodes.push({ tag: 'em', ctx: _parse_inline(m[5]) });
    }
    last = m.index + m[0].length;
  }
  // 残りのプレーンテキスト
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

// ── ブロックレベル Markdown → VDOM ノード配列 ─────────────────────
// 行単位でパースし、VDOM ノードの配列を返す。
const _parse_blocks = (src) => {
  const lines = src.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── コードブロック ``` ──
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim() || null;
      const code_lines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        code_lines.push(lines[i]);
        i++;
      }
      i++; // ``` の閉じ行をスキップ

      const raw = code_lines.join('\n');
      // hljs でハイライトを試みる（ui_code_pre と同じロジック）
      // lang 指定ありのときのみ hljs を呼ぶ。指定なしはプレーンテキスト。
      // highlightAuto はリアルタイム入力で重くなるため使わない。
      let code_node;
      if (lang && typeof window !== 'undefined' && typeof window.hljs !== 'undefined') {
        try {
          const result = window.hljs.highlight(raw, { language: lang });
          code_node = { tag: 'code', class: 'hljs', innerHTML: result.value };
        } catch (_) {
          // 未知の言語名などで失敗したらプレーンテキストにフォールバック
          code_node = { tag: 'code', ctx: [raw] };
        }
      } else {
        code_node = { tag: 'code', ctx: [raw] };
      }
      blocks.push({
        tag: 'pre', class: 'ric-md-pre__fence', ctx: [code_node],
      });
      continue;
    }

    // ── 空行（段落区切り）──
    if (line.trim() === '') { i++; continue; }

    // ── 水平線 --- ──
    if (/^-{3,}\s*$/.test(line.trim())) {
      blocks.push({ tag: 'hr', class: 'ric-md-pre__hr' });
      i++;
      continue;
    }

    // ── 見出し # 〜 ###### ──
    const heading_match = line.match(/^(#{1,6})\s+(.+)/);
    if (heading_match) {
      const level = heading_match[1].length;
      // h4〜h6 は h3 と同じスタイルで表示
      const tag = level <= 3 ? 'h' + level : 'h' + level;
      const cls = level <= 3 ? 'ric-md-pre__h' + level : 'ric-md-pre__h3';
      blocks.push({
        tag, class: cls,
        ctx: _parse_inline(heading_match[2]),
      });
      i++;
      continue;
    }

    // ── 引用 > ──
    if (line.trimStart().startsWith('> ')) {
      const quote_lines = [];
      while (i < lines.length && lines[i].trimStart().startsWith('> ')) {
        quote_lines.push(lines[i].trimStart().slice(2));
        i++;
      }
      blocks.push({
        tag: 'blockquote', class: 'ric-md-pre__quote',
        ctx: _parse_blocks(quote_lines.join('\n')),
      });
      continue;
    }

    // ── リスト - ──
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const item_text = lines[i].replace(/^\s*[-*]\s+/, '');
        items.push({ tag: 'li', ctx: _parse_inline(item_text) });
        i++;
      }
      blocks.push({ tag: 'ul', class: 'ric-md-pre__list', ctx: items });
      continue;
    }

    // ── 段落（連続する非空行をまとめる）──
    const para_lines = [];
    while (i < lines.length && lines[i].trim() !== '' &&
           !lines[i].trimStart().startsWith('#') &&
           !lines[i].trimStart().startsWith('```') &&
           !lines[i].trimStart().startsWith('> ') &&
           !/^\s*[-*]\s+/.test(lines[i]) &&
           !/^-{3,}\s*$/.test(lines[i].trim())) {
      para_lines.push(lines[i]);
      i++;
    }
    if (para_lines.length > 0) {
      blocks.push({
        tag: 'p', class: 'ric-md-pre__p',
        ctx: _parse_inline(para_lines.join('\n')),
      });
    }
  }

  return blocks;
};

// ── ui_md_pre 本体 ────────────────────────────────────────────────
const ui_md_pre = ({ ctx = [], ...rest } = {}) => {
  const src = ctx.join('\n');
  const children = _parse_blocks(src);

  return {
    tag:   'div',
    class: rest.class ? 'ric-md-pre ' + rest.class : 'ric-md-pre',
    ...rest,
    ctx: children,
  };
};

module.exports = { ui_md_pre };
