// RicUI — ui_md_pre テスト
//
// テスト方針:
//   1. インラインパーサー: 太字・斜体・コード・リンクの VDOM 変換
//   2. ブロックパーサー: 見出し・段落・リスト・引用・コードブロック・水平線
//   3. 複合ケース: インライン＋ブロックの組み合わせ
//   4. エッジケース: 空文字列・空行のみ・未対応構文

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { ui_md_pre } = require('../ric_ui/text/ui_md_pre');

// ── ヘルパー: ctx から children を取得 ──
const children = (md) => ui_md_pre({ ctx: [md] }).ctx;

// =====================================================================
// 基本構造
// =====================================================================

describe('ui_md_pre: 基本構造', () => {

  test('tag は div', () => {
    assert.equal(ui_md_pre().tag, 'div');
  });

  test('デフォルト class は ric-md-pre', () => {
    assert.equal(ui_md_pre().class, 'ric-md-pre');
  });

  test('追加 class がマージされる', () => {
    assert.equal(ui_md_pre({ class: 'extra' }).class, 'ric-md-pre extra');
  });

  test('空文字列で children が空', () => {
    assert.deepEqual(children(''), []);
  });

  test('空行のみで children が空', () => {
    assert.deepEqual(children('\n\n\n'), []);
  });
});

// =====================================================================
// 見出し
// =====================================================================

describe('ui_md_pre: 見出し', () => {

  test('# → h1', () => {
    const [h] = children('# タイトル');
    assert.equal(h.tag, 'h1');
    assert.equal(h.class, 'ric-md-pre__h1');
    assert.deepEqual(h.ctx, ['タイトル']);
  });

  test('## → h2', () => {
    const [h] = children('## サブタイトル');
    assert.equal(h.tag, 'h2');
    assert.equal(h.class, 'ric-md-pre__h2');
  });

  test('### → h3', () => {
    const [h] = children('### 小見出し');
    assert.equal(h.tag, 'h3');
    assert.equal(h.class, 'ric-md-pre__h3');
  });

  test('# なしスペースは見出しにならない', () => {
    const [p] = children('#タイトル');
    assert.equal(p.tag, 'p');
  });
});

// =====================================================================
// インライン要素
// =====================================================================

describe('ui_md_pre: インライン — 太字', () => {

  test('**text** → strong', () => {
    const [p] = children('これは**太字**です');
    assert.equal(p.tag, 'p');
    assert.equal(p.ctx[0], 'これは');
    assert.equal(p.ctx[1].tag, 'strong');
    assert.deepEqual(p.ctx[1].ctx, ['太字']);
    assert.equal(p.ctx[2], 'です');
  });
});

describe('ui_md_pre: インライン — 斜体', () => {

  test('*text* → em', () => {
    const [p] = children('これは*斜体*です');
    assert.equal(p.ctx[1].tag, 'em');
    assert.deepEqual(p.ctx[1].ctx, ['斜体']);
  });
});

describe('ui_md_pre: インライン — コード', () => {

  test('`code` → code.ric-md-pre__code', () => {
    const [p] = children('変数 `x` を使う');
    assert.equal(p.ctx[1].tag, 'code');
    assert.equal(p.ctx[1].class, 'ric-md-pre__code');
    assert.deepEqual(p.ctx[1].ctx, ['x']);
  });
});

describe('ui_md_pre: インライン — リンク', () => {

  test('[text](url) → a.ric-md-pre__link', () => {
    const [p] = children('[RicDOM](https://example.com)');
    assert.equal(p.ctx[0].tag, 'a');
    assert.equal(p.ctx[0].class, 'ric-md-pre__link');
    assert.equal(p.ctx[0].href, 'https://example.com');
    assert.deepEqual(p.ctx[0].ctx, ['RicDOM']);
    assert.equal(p.ctx[0].target, '_blank');
  });
});

describe('ui_md_pre: インライン — 複合', () => {

  test('太字の中に斜体', () => {
    const [p] = children('**太い*斜体*文字**');
    const strong = p.ctx[0];
    assert.equal(strong.tag, 'strong');
    // strong の中に em がネストされる
    const em = strong.ctx.find(c => typeof c === 'object' && c.tag === 'em');
    assert.ok(em, 'em が strong の中に存在する');
    assert.deepEqual(em.ctx, ['斜体']);
  });
});

// =====================================================================
// リスト
// =====================================================================

describe('ui_md_pre: リスト', () => {

  test('- で始まる行 → ul > li', () => {
    const [ul] = children('- A\n- B\n- C');
    assert.equal(ul.tag, 'ul');
    assert.equal(ul.class, 'ric-md-pre__list');
    assert.equal(ul.ctx.length, 3);
    assert.equal(ul.ctx[0].tag, 'li');
    assert.deepEqual(ul.ctx[0].ctx, ['A']);
    assert.deepEqual(ul.ctx[2].ctx, ['C']);
  });

  test('* でもリストになる', () => {
    const [ul] = children('* X\n* Y');
    assert.equal(ul.tag, 'ul');
    assert.equal(ul.ctx.length, 2);
  });

  test('リスト内にインライン要素', () => {
    const [ul] = children('- **太字** item');
    const li = ul.ctx[0];
    const strong = li.ctx.find(c => typeof c === 'object' && c.tag === 'strong');
    assert.ok(strong, 'li の中に strong がある');
  });
});

// =====================================================================
// 引用
// =====================================================================

describe('ui_md_pre: 引用', () => {

  test('> で始まる行 → blockquote', () => {
    const [bq] = children('> 引用テキスト');
    assert.equal(bq.tag, 'blockquote');
    assert.equal(bq.class, 'ric-md-pre__quote');
    // 中身は再帰パースされて p になる
    assert.equal(bq.ctx[0].tag, 'p');
  });

  test('連続する > 行は1つの blockquote', () => {
    const [bq] = children('> 行1\n> 行2');
    assert.equal(bq.tag, 'blockquote');
    // 連結されて1つの段落になる
    assert.equal(bq.ctx.length, 1);
  });
});

// =====================================================================
// コードブロック
// =====================================================================

describe('ui_md_pre: コードブロック', () => {

  test('``` で囲んだ行 → pre.ric-md-pre__fence', () => {
    const [pre] = children('```\nconst x = 1;\n```');
    assert.equal(pre.tag, 'pre');
    assert.equal(pre.class, 'ric-md-pre__fence');
    assert.equal(pre.ctx[0].tag, 'code');
    assert.deepEqual(pre.ctx[0].ctx, ['const x = 1;']);
  });

  test('言語指定付きコードブロック', () => {
    const [pre] = children('```javascript\nconst x = 1;\n```');
    assert.equal(pre.tag, 'pre');
    // hljs なし環境ではプレーンテキスト
    assert.deepEqual(pre.ctx[0].ctx, ['const x = 1;']);
  });

  test('複数行コードブロック', () => {
    const [pre] = children('```\nline1\nline2\nline3\n```');
    assert.deepEqual(pre.ctx[0].ctx, ['line1\nline2\nline3']);
  });
});

// =====================================================================
// 水平線
// =====================================================================

describe('ui_md_pre: 水平線', () => {

  test('--- → hr', () => {
    const blocks = children('上\n\n---\n\n下');
    const hr = blocks.find(b => b.tag === 'hr');
    assert.ok(hr, 'hr が存在する');
    assert.equal(hr.class, 'ric-md-pre__hr');
  });

  test('---- (4つ以上) も hr', () => {
    const [hr] = children('----');
    assert.equal(hr.tag, 'hr');
  });
});

// =====================================================================
// 段落
// =====================================================================

describe('ui_md_pre: 段落', () => {

  test('連続する行は1つの段落', () => {
    const [p] = children('行1\n行2');
    assert.equal(p.tag, 'p');
    assert.equal(p.class, 'ric-md-pre__p');
  });

  test('空行で段落が分かれる', () => {
    const blocks = children('段落1\n\n段落2');
    const paras = blocks.filter(b => b.tag === 'p');
    assert.equal(paras.length, 2);
  });
});

// =====================================================================
// 複合ケース
// =====================================================================

describe('ui_md_pre: 複合', () => {

  test('見出し + 段落 + リスト', () => {
    const blocks = children('# Title\n\nText here.\n\n- A\n- B');
    assert.equal(blocks[0].tag, 'h1');
    assert.equal(blocks[1].tag, 'p');
    assert.equal(blocks[2].tag, 'ul');
  });

  test('ctx に複数文字列を渡すと連結', () => {
    const result = ui_md_pre({ ctx: ['# A', '# B'] });
    // 改行で連結されるので 2 つの h1
    const headings = result.ctx.filter(c => c.tag === 'h1');
    assert.equal(headings.length, 2);
  });
});
