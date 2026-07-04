// RicDOM — build pipeline scripts の特性テスト (characterization test)
//
// build_icons.js / shorten_css_classes.js / compress_css_in_js.js / copy_docs.js は
// これまでテストがゼロだった (lz / build_lz_bundle / icon / svg_to_descriptor は
// テスト済み)。ここでは「現在の挙動」を固定し、将来のリファクタリングで
// 無言 drift しないようにする。
//
// shorten_css_classes / compress_css_in_js は一時ファイルに最小 JS を書いて
// スクリプトを CLI として実行し、出力を検証する。
// copy_docs / build_icons は冪等スクリプトなので実 repo に対して直接実行し、
// 実行前後で内容が変わらないこと (= 既に同期済みであること) を確認する。

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// 一時ディレクトリに文字列を書き、node でスクリプトを実行して stdout を返す
const run_script_on_tmp_file = (script, content, tmp_name = 'input.js') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ric-'));
  const file = path.join(dir, tmp_name);
  fs.writeFileSync(file, content, 'utf8');
  const stdout = execFileSync('node', [path.join(ROOT, 'scripts', script), file], { encoding: 'utf8' });
  const out = fs.readFileSync(file, 'utf8');
  return { dir, file, stdout, out };
};

// =====================================================================
// shorten_css_classes.js
// =====================================================================

describe('shorten_css_classes.js', () => {
  const SRC = 'const css = `.ric-page .ric-popup__body--out{color:red}`; const cls = "ric-popup__body--out";';

  test('CSS 側とリテラル側が同じ短縮名に置換される', () => {
    const { out } = run_script_on_tmp_file('shorten_css_classes.js', SRC);
    // ric-popup__body の短縮名を CSS 側から抽出し、リテラル側にも同じ短縮名が使われていることを確認
    const m = out.match(/\.ric-page \.([a-z0-9]+)--out\{color:red\}/);
    assert.ok(m, `CSS 部分が期待した形で短縮されていない: ${out}`);
    const short = m[1];
    assert.ok(out.includes(`"${short}--out"`), `リテラル側が同じ短縮名 (${short}) に置換されていない: ${out}`);
  });

  test('ric-page (PUBLIC_BASE_PREFIXES) は不変', () => {
    const { out } = run_script_on_tmp_file('shorten_css_classes.js', SRC);
    assert.ok(out.includes('.ric-page '), 'ric-page が短縮されてしまっている');
  });

  test('同一入力 2 回で同一出力 (決定性)', () => {
    const { out: out1 } = run_script_on_tmp_file('shorten_css_classes.js', SRC);
    const { out: out2 } = run_script_on_tmp_file('shorten_css_classes.js', SRC);
    assert.equal(out1, out2);
  });
});

// =====================================================================
// compress_css_in_js.js
// =====================================================================

describe('compress_css_in_js.js', () => {
  // 改行・インデント入り template literal、${...} 式を含む
  const SRC = [
    'const make = (color) => `',
    '  .ric-foo {',
    '    color: ${color};',
    '    padding:   8px   16px ;',
    '  }',
    '`;',
  ].join('\n');

  test('${...} の中身は 1 byte も変わらない', () => {
    const { out } = run_script_on_tmp_file('compress_css_in_js.js', SRC);
    assert.ok(out.includes('${color}'), `\${color} が破壊されている: ${out}`);
  });

  test('CSS 部分の空白が畳まれる', () => {
    const { out } = run_script_on_tmp_file('compress_css_in_js.js', SRC);
    // 改行・インデントが除去され、区切り文字周りの空白も畳まれていること
    assert.ok(!/\n\s+/.test(out), `改行+インデントが残っている: ${out}`);
    assert.ok(out.includes('.ric-foo{'), `セレクタ周りの空白が畳まれていない: ${out}`);
  });
});

// =====================================================================
// copy_docs.js (冪等スクリプト、実 repo に対して実行)
// =====================================================================

describe('copy_docs.js', () => {
  test('実行後 SPEC.md/TUTORIAL.md が docs/ とバイト一致する', () => {
    const before = fs.readFileSync(path.join(ROOT, 'docs', 'SPEC.md'), 'utf8');
    const before_tut = fs.readFileSync(path.join(ROOT, 'docs', 'TUTORIAL.md'), 'utf8');

    execFileSync('node', [path.join(ROOT, 'scripts', 'copy_docs.js')], { cwd: ROOT });

    const spec_src = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8');
    const spec_docs = fs.readFileSync(path.join(ROOT, 'docs', 'SPEC.md'), 'utf8');
    const tut_src = fs.readFileSync(path.join(ROOT, 'TUTORIAL.md'), 'utf8');
    const tut_docs = fs.readFileSync(path.join(ROOT, 'docs', 'TUTORIAL.md'), 'utf8');

    assert.equal(spec_src, spec_docs, 'SPEC.md と docs/SPEC.md がバイト一致しない');
    assert.equal(tut_src, tut_docs, 'TUTORIAL.md と docs/TUTORIAL.md がバイト一致しない');

    // 冪等性の後始末: 実 repo 実行で内容差分が無ければ何もしない。
    // (min.js は既存状態依存なので比較対象にしない。SPEC/TUTORIAL は
    //  既にリポジトリ内で同期済みのはずなので、実行前後で内容が変わらないことも確認する)
    assert.equal(before, spec_docs, 'copy_docs 実行で docs/SPEC.md の内容が変わった (drift の疑い)');
    assert.equal(before_tut, tut_docs, 'copy_docs 実行で docs/TUTORIAL.md の内容が変わった (drift の疑い)');
  });
});

// =====================================================================
// build_icons.js (冪等スクリプト、実 repo に対して実行)
// =====================================================================

describe('build_icons.js', () => {
  test('icons.json の生成規則を満たし、実行前後で内容が変わらない (冪等)', () => {
    const icons_path = path.join(ROOT, 'docs', 'icons', 'icons.json');
    const before = JSON.parse(fs.readFileSync(icons_path, 'utf8'));

    execFileSync('node', [path.join(ROOT, 'scripts', 'build_icons.js')], { cwd: ROOT });

    const after = JSON.parse(fs.readFileSync(icons_path, 'utf8'));

    assert.equal(after._meta.count, Object.keys(after.icons).length, '_meta.count と icons のキー数が一致しない');
    assert.equal(after.icons['circle-dot'].s, null, 'circle-dot.s === null が保持されていない');
    assert.equal(after.icons['x'].s, undefined, 'x.s は既定 stroke 2 のため省略されるはず');

    assert.deepEqual(after, before, 'build_icons 再実行で icons.json の内容が変わった (drift の疑い)');
  });
});
