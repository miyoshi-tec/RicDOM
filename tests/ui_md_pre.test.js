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
});
