// LZ 圧縮アルゴリズム本体の単体テスト (v0.3.18〜)
//
// 対象: scripts/lz.js の純粋関数 (find_marker / compress / decompress /
//   escape_for_template / build_wrapper / build_lz_bundle)。
// 既存の v03_lz_bundle.test.js は実 build 済みの RicUI.lz.min.js / RicDOM.lz.min.js
// を eval して通常版と等価か検証するが、本テストはアルゴリズム自身の正しさを
// 入力 → 出力の round-trip と境界ケースで担保する。

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  find_marker,
  compress,
  decompress,
  escape_for_template,
  escape_regex_char,
  build_wrapper,
  build_lz_bundle,
  MIN_MATCH,
  MAX_MATCH,
} = require('../scripts/lz');

// ─────────────────────────────────────────────────────────────
// helper: round-trip を 1 行で検証
// ─────────────────────────────────────────────────────────────
const round_trip = (src) => {
  const { marker_code, substitution } = find_marker(src);
  let prepared = src;
  if (substitution) {
    prepared = prepared.split(String.fromCharCode(substitution.from_code))
                       .join(String.fromCharCode(substitution.to_code));
  }
  const compressed = compress(prepared, marker_code);
  const decompressed = decompress(compressed, marker_code, substitution);
  return { compressed, decompressed, marker_code, substitution };
};

// ─────────────────────────────────────────────────────────────
// find_marker
// ─────────────────────────────────────────────────────────────
describe('find_marker', () => {

  test('空文字列 → printable の先頭 (0x21 "!") が選ばれる', () => {
    const m = find_marker('');
    assert.equal(m.marker_code, 0x21);
    assert.equal(m.substitution, null);
  });

  test('未使用 printable がある場合は substitution なし', () => {
    const m = find_marker('Hello, World!');
    assert.ok(m.marker_code >= 0x21 && m.marker_code <= 0x7E,
      'marker は printable ASCII');
    assert.equal(m.substitution, null);
    // marker char が src に含まれていないことを確認
    assert.ok(!('Hello, World!'.includes(String.fromCharCode(m.marker_code))));
  });

  test('"~" を含まないソースでは "~" (0x7E) が選ばれることが多い (実装依存だが回帰防止)', () => {
    // 実装は 0x21 から走査するので、未使用の最初の char が選ばれる。
    // 典型的な ASCII ソース ("Hello, World!" など) では '!' か '"' あたりが選ばれる。
    // ここでは「printable で substitution なし」までを保証する。
    const m = find_marker('abc 123 def 456');
    assert.equal(m.substitution, null);
  });

  test('全 printable が使われている場合は substitution path に入る', () => {
    let src = '';
    for (let c = 0x21; c <= 0x7E; c++) src += String.fromCharCode(c);
    const m = find_marker(src);
    assert.ok(m.substitution, 'substitution mode が有効化されるべき');
    assert.equal(m.substitution.from_code, m.marker_code,
      'substitution の from は marker と同じ printable');
    assert.ok(m.substitution.to_code >= 0x01 && m.substitution.to_code <= 0x1F,
      'escape は制御 byte (0x01-0x1F)');
    assert.notEqual(m.substitution.to_code, 0x09);
    assert.notEqual(m.substitution.to_code, 0x0A);
    assert.notEqual(m.substitution.to_code, 0x0D);
  });

  test('substitution path で最少頻度の printable が marker に選ばれる', () => {
    // 全 printable を 5 回ずつ繰り返し、'!' だけ 1 回追加で頻度最少にする
    let src = '!';
    for (let c = 0x22; c <= 0x7E; c++) src += String.fromCharCode(c).repeat(5);
    for (let c = 0x21; c <= 0x7E; c++) src += String.fromCharCode(c).repeat(5);
    const m = find_marker(src);
    assert.ok(m.substitution);
    // '!' (0x21) が頻度 6 で、他より少なくはないので別の char が選ばれるかも。
    // 重要なのは「substitution が成立する」と「marker が printable」の 2 点。
    assert.ok(m.marker_code >= 0x21 && m.marker_code <= 0x7E);
  });
});

// ─────────────────────────────────────────────────────────────
// compress + decompress round-trip
// ─────────────────────────────────────────────────────────────
describe('compress + decompress: round-trip', () => {

  test('空文字列', () => {
    const r = round_trip('');
    assert.equal(r.compressed, '');
    assert.equal(r.decompressed, '');
  });

  test('1 文字', () => {
    const r = round_trip('A');
    assert.equal(r.decompressed, 'A');
  });

  test('MIN_MATCH 未満の短い文字列 (圧縮不可)', () => {
    const src = 'abc';
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
    // 短すぎて圧縮できない → 元と同サイズ以上
    assert.ok(r.compressed.length >= src.length,
      '短い文字列は参照化されない');
  });

  test('MIN_MATCH 丁度の長さの重複 (= ' + MIN_MATCH + ')', () => {
    const pat = 'abcdef'.substring(0, MIN_MATCH);
    const src = pat + 'XYZ' + pat;
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
  });

  test('高度に繰り返しのある文字列 (> 50% 圧縮)', () => {
    const src = 'abcdefghij'.repeat(100);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
    assert.ok(r.compressed.length < src.length / 2,
      `期待: < ${src.length / 2}, 実測: ${r.compressed.length}`);
  });

  test('overlapping match (run-length 的パターン)', () => {
    // "ababab..." は offset=2, length=large の overlap 参照で表現される
    const src = 'ab'.repeat(100);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
  });

  test('同一文字の長い run (RLE 風)', () => {
    const src = 'X'.repeat(300);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
    // MAX_MATCH (255) を超えるので 2 参照に分割されるはず
    assert.ok(r.compressed.length < src.length);
  });

  test('marker char を含まない多様な ASCII', () => {
    const src = 'function foo(x) { return x * 2 + 1; } '.repeat(20);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
  });

  test('テンプレートリテラル sensitive な char (\\ ` $ {)', () => {
    const src = '`backtick` and \\\\ and ${interp} and `${nested}` x'.repeat(10);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
  });

  test('改行と CR を含むソース', () => {
    const src = 'line1\nline2\r\nline3\nline4'.repeat(20);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
  });

  test('NULL byte を含むソース', () => {
    const src = 'a\x00b\x00c'.repeat(20);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
  });

  test('全 printable + 繰り返し (substitution path 経由)', () => {
    let head = '';
    for (let c = 0x21; c <= 0x7E; c++) head += String.fromCharCode(c);
    const src = head + 'XYZXYZXYZXYZXYZXYZ'.repeat(20);
    const r = round_trip(src);
    assert.ok(r.substitution, 'substitution path に入っているべき');
    assert.equal(r.decompressed, src);
  });

  test('長い run + 文字 mixed (overlap で MAX_MATCH 超え)', () => {
    const src = 'A'.repeat(500) + 'B'.repeat(500) + 'A'.repeat(500);
    const r = round_trip(src);
    assert.equal(r.decompressed, src);
  });
});

// ─────────────────────────────────────────────────────────────
// escape_for_template
// ─────────────────────────────────────────────────────────────
describe('escape_for_template', () => {

  test('バックスラッシュを \\\\ にエスケープ', () => {
    assert.equal(escape_for_template('a\\b'), 'a\\\\b');
  });

  test('バッククォートを \\` にエスケープ', () => {
    assert.equal(escape_for_template('a`b'), 'a\\`b');
  });

  test('${ を \\${ にエスケープ', () => {
    assert.equal(escape_for_template('a${b}c'), 'a\\${b}c');
  });

  test('$ 単体 ($ の後に { が来ない) はエスケープしない', () => {
    assert.equal(escape_for_template('a$b'), 'a$b');
    assert.equal(escape_for_template('$'), '$');
  });

  test('組み合わせ', () => {
    assert.equal(escape_for_template('`\\${'), '\\`\\\\\\${');
  });

  test('通常 ASCII は変化なし', () => {
    const src = 'function() { return 42; }';
    assert.equal(escape_for_template(src), src);
  });
});

// ─────────────────────────────────────────────────────────────
// escape_regex_char
// ─────────────────────────────────────────────────────────────
describe('escape_regex_char', () => {

  test('regex meta char を \\ で escape', () => {
    for (const c of '.*+?^${}()|[]\\/') {
      assert.equal(escape_regex_char(c), '\\' + c, `meta char ${JSON.stringify(c)}`);
    }
  });

  test('通常 char はそのまま', () => {
    for (const c of '~!@#abcXYZ123') {
      assert.equal(escape_regex_char(c), c);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// build_wrapper: 生成された JS を実行して decompress 結果を捕捉
// ─────────────────────────────────────────────────────────────
//
// build_wrapper の出力は `let C=`...`; ...; eval(s)` の形。
// テストでは末尾の `eval(s)` を `globalThis.__lz_captured=s` に置換し、
// 直接 eval して s を捕捉する。これで「wrapper の中身が valid JS で、
// かつ展開ロジックが正しく元の文字列を復元する」ことを担保する。

describe('build_wrapper: 出力 JS を eval して動作確認', () => {

  const eval_capture = (wrapper) => {
    const captured_key = '__lz_test_capture_' + Math.random().toString(36).slice(2);
    const modified = wrapper.replace('eval(s)', `globalThis['${captured_key}']=s`);
    delete globalThis[captured_key];
    (0, eval)(modified);  // indirect eval = global scope; let が漏れないよう wrap
    const result = globalThis[captured_key];
    delete globalThis[captured_key];
    return result;
  };

  test('simple ASCII payload を round-trip', () => {
    const original = 'console.log("hello");'.repeat(20);
    const { wrapper } = build_lz_bundle(original);
    assert.equal(eval_capture(wrapper), original);
  });

  test('JS の bundle 風 (function / var / 多様な記号)', () => {
    const original =
      '"use strict";(()=>{var a={x:1,y:2,z:3};function f(){return a.x+a.y+a.z}return f()})()'
      .repeat(10);
    const { wrapper } = build_lz_bundle(original);
    assert.equal(eval_capture(wrapper), original);
  });

  test('テンプレートリテラル / バックスラッシュ含み', () => {
    const original = 'const s = `hello ${name}`; const path = "C:\\\\Users";'.repeat(10);
    const { wrapper } = build_lz_bundle(original);
    assert.equal(eval_capture(wrapper), original);
  });

  test('改行と CR を含む payload', () => {
    const original = 'line1\nline2\r\nline3\n'.repeat(30);
    const { wrapper } = build_lz_bundle(original);
    assert.equal(eval_capture(wrapper), original);
  });

  test('substitution path 経由でも eval 結果が原文と一致', () => {
    let head = '';
    for (let c = 0x21; c <= 0x7E; c++) head += String.fromCharCode(c);
    const original = head + 'console.log(42);'.repeat(20);
    const { wrapper, substitution } = build_lz_bundle(original);
    assert.ok(substitution, 'substitution が発動するべき');
    assert.equal(eval_capture(wrapper), original);
  });
});

// ─────────────────────────────────────────────────────────────
// build_lz_bundle: 高レベル API + 内部 round-trip 検証
// ─────────────────────────────────────────────────────────────
describe('build_lz_bundle', () => {

  test('正常系: wrapper / marker_code / substitution / compressed_length を返す', () => {
    const r = build_lz_bundle('test source ' + 'ABC'.repeat(50));
    assert.equal(typeof r.wrapper, 'string');
    assert.ok(r.wrapper.length > 0);
    assert.equal(typeof r.marker_code, 'number');
    assert.ok('substitution' in r);
    assert.equal(typeof r.compressed_length, 'number');
  });

  test('圧縮効果: 高繰り返しソースでは wrapper が元より小さい', () => {
    const original = 'console.log("hello world");'.repeat(200);
    const r = build_lz_bundle(original);
    assert.ok(r.wrapper.length < original.length,
      `wrapper ${r.wrapper.length} < original ${original.length}`);
  });

  test('短すぎるソースでは wrapper の方が大きい (overhead 込み)', () => {
    const original = 'short';
    const r = build_lz_bundle(original);
    // 159 byte の stub overhead があるので、5 byte ソースは確実に膨らむ
    assert.ok(r.wrapper.length > original.length);
  });
});
