'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ui_md_pre } = require('../ric_ui/text/ui_md_pre');
const c = (md) => ui_md_pre({ ctx: [md] }).ctx;

describe('basic', () => {
  test('tag', () => assert.equal(ui_md_pre().tag, 'div'));
  test('class', () => assert.equal(ui_md_pre().class, 'ric-md-pre'));
  test('empty', () => assert.deepEqual(c(''), []));
});

describe('headings', () => {
  test('h1', () => assert.equal(c('# T')[0].tag, 'h1'));
  test('h2', () => assert.equal(c('## T')[0].tag, 'h2'));
  test('h3', () => assert.equal(c('### T')[0].tag, 'h3'));
});

describe('inline', () => {
  test('bold', () => assert.equal(c('a **b** c')[0].ctx[1].tag, 'strong'));
  test('italic', () => assert.equal(c('a *i* c')[0].ctx[1].tag, 'em'));
  test('code', () => assert.equal(c('a `x` c')[0].ctx[1].tag, 'code'));
  test('link', () => assert.equal(c('[R](http://x)')[0].ctx[0].tag, 'a'));
});

describe('blocks', () => {
  test('list', () => assert.equal(c('- A\n- B')[0].tag, 'ul'));
  test('quote', () => assert.equal(c('> text')[0].tag, 'blockquote'));
  test('fence', () => assert.equal(c('```\nx\n```')[0].tag, 'pre'));
  test('hr', () => assert.equal(c('---')[0].tag, 'hr'));
  test('para', () => assert.equal(c('text')[0].tag, 'p'));
  test('h4', () => { const n = c('#### T')[0]; assert.equal(n.tag, 'h4'); assert.equal(n.class, 'ric-md-pre__h3'); });
});

// 無限ループ回帰テスト：上のブロック分岐で拾われない行が段落に降りてきたときに
// 無限ループせず段落として消費されることを確認する。
// 過去に `#hello` / `#` / `####### ` / `|foo` などで _parse_blocks が無限ループした。
describe('safety net (infinite loop regression)', () => {
  test('#hello (no space)', () => { const n = c('#hello')[0]; assert.equal(n.tag, 'p'); });
  test('# alone',         () => { const n = c('#')[0];       assert.equal(n.tag, 'p'); });
  test('####### (7 #s)',  () => { const n = c('####### hi')[0]; assert.equal(n.tag, 'p'); });
  test('|foo (no table)', () => { const n = c('|foo')[0];    assert.equal(n.tag, 'p'); });
  test('#### alone',      () => { const n = c('####')[0];    assert.equal(n.tag, 'p'); });
  test('mixed', () => {
    // 不正見出し（#bad）は段落の終端ではないので、3 行がひとつの段落にまとまる
    const nodes = c('text1\n#bad\ntext2');
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].tag, 'p');
  });
  test('valid heading still terminates para', () => {
    // 正しい見出し（## H）は段落の終端になる
    const nodes = c('text1\n## H\ntext2');
    assert.equal(nodes.length, 3);
    assert.equal(nodes[0].tag, 'p');
    assert.equal(nodes[1].tag, 'h2');
    assert.equal(nodes[2].tag, 'p');
  });
});

describe('table', () => {
  const tbl = () => c('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |')[0];
  test('tag', () => assert.equal(tbl().tag, 'table'));
  test('class', () => assert.equal(tbl().class, 'ric-md-pre__table'));
  test('thead', () => assert.equal(tbl().ctx[0].tag, 'thead'));
  test('th', () => assert.equal(tbl().ctx[0].ctx[0].ctx[0].ctx[0], 'A'));
  test('tbody rows', () => assert.equal(tbl().ctx[1].ctx.length, 2));
  test('td', () => assert.equal(tbl().ctx[1].ctx[0].ctx[0].ctx[0], '1'));
  test('align center', () => {
    const t = c('| L | C |\n|---|:---:|\n| a | b |')[0];
    assert.equal(t.ctx[0].ctx[0].ctx[1].style, 'text-align:center');
  });
  test('align right', () => {
    const t = c('| L | R |\n|---|---:|\n| a | b |')[0];
    assert.equal(t.ctx[0].ctx[0].ctx[1].style, 'text-align:right');
  });
  test('inline in cell', () => {
    const t = c('| H |\n|---|\n| **b** |')[0];
    assert.equal(t.ctx[1].ctx[0].ctx[0].ctx[0].tag, 'strong');
  });
});
