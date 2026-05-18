// RicUI — CSS press feedback (`:active`) regression test (v0.3.17〜)
//
// 設計上の契約: 「`ui_button` / `ui_checkbox` の `:active` 沈み feedback は
// `transform` プロパティではなく `translate` プロパティで実装する」。
//
// 理由: `transform` は単一値プロパティなので、consumer が `transform:
// translateY(-50%)` (absolute 配置の中央寄せ等) を使っていると `:active` で
// 全て上書きされてしまう。CSS Transforms Level 2 の `translate` プロパティは
// `transform` と composable に動くので、library と consumer が衝突なく共存
// できる。
//
// これは API 契約として SPEC.md に明記してあるので、回帰してしまうと
// downstream (Rancha 等) の workaround が必要になる。

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { CSS_TEMPLATES } = require('../ric_ui/css_templates');

// CSS コメント (/* ... */) を取り除く。コメント内の "transform:" のような
// 文字列が regex 検査で誤検出されないようにする。
const strip_css_comments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('CSS press feedback: :active は translate プロパティを使う', () => {

  test('.ric-button:active は `translate: 0 1px` を含む', () => {
    const css = strip_css_comments(CSS_TEMPLATES['ric-button']());
    // 該当ルール (.ric-button:active:not(:disabled)) のブロックを抽出
    const m = css.match(/\.ric-button:active:not\(:disabled\)\s*\{([^}]+)\}/);
    assert.ok(m, '.ric-button:active ルールが見つかる');
    assert.match(m[1], /translate:\s*0\s+1px/, 'translate プロパティで沈みを表現');
  });

  test('.ric-button:active は `transform: translateY(...)` を含まない', () => {
    // 回帰防止: 旧実装の `transform: translateY(1px)` を復活させない
    const css = strip_css_comments(CSS_TEMPLATES['ric-button']());
    const m = css.match(/\.ric-button:active:not\(:disabled\)\s*\{([^}]+)\}/);
    assert.ok(m);
    assert.doesNotMatch(m[1], /transform:\s*translate/,
      ':active で transform を使うと consumer の transform を上書きしてしまう');
  });

  test('.ric-button--primary:active も translate を使う', () => {
    const css = strip_css_comments(CSS_TEMPLATES['ric-button']());
    const m = css.match(/\.ric-button--primary:active:not\(:disabled\)\s*\{([^}]+)\}/);
    assert.ok(m, '.ric-button--primary:active ルールが見つかる');
    assert.match(m[1], /translate:\s*0\s+1px/);
    assert.doesNotMatch(m[1], /transform:\s*translate/);
  });

  test('.ric-button--link:active は translate: 0 でリセット (press-jump しない)', () => {
    const css = strip_css_comments(CSS_TEMPLATES['ric-button']());
    const m = css.match(/\.ric-button--link:active:not\(:disabled\)\s*\{([^}]+)\}/);
    assert.ok(m, '.ric-button--link:active ルールが見つかる');
    assert.match(m[1], /translate:\s*0\b/, '明示的に translate を 0 にリセット');
  });

  test('.ric-checkbox:active も translate を使う', () => {
    const css = strip_css_comments(CSS_TEMPLATES['ric-checkbox']());
    const m = css.match(/\.ric-checkbox:active\s*\{([^}]+)\}/);
    assert.ok(m, '.ric-checkbox:active ルールが見つかる');
    assert.match(m[1], /translate:\s*0\s+1px/);
    assert.doesNotMatch(m[1], /transform:\s*translate/);
  });

  test('.ric-checkbox--disabled:active は translate: 0 でリセット', () => {
    const css = strip_css_comments(CSS_TEMPLATES['ric-checkbox']());
    const m = css.match(/\.ric-checkbox--disabled:active\s*\{([^}]+)\}/);
    assert.ok(m);
    assert.match(m[1], /translate:\s*0\b/);
  });

  test('transition 宣言が translate を補間する (transform 単体への transition は無い)', () => {
    // CSS Transforms Level 2 では translate プロパティ単体に対する transition
    // が可能。library 内で `:active` の沈み feedback に対応する transition は
    // `translate ...` であるべき (transform のままだと無意味)。
    const button_css   = strip_css_comments(CSS_TEMPLATES['ric-button']());
    const checkbox_css = strip_css_comments(CSS_TEMPLATES['ric-checkbox']());
    // base rule の transition declaration には translate が入っていてほしい
    assert.match(button_css,   /transition:[^;]*translate/, '.ric-button transition に translate');
    assert.match(checkbox_css, /transition:[^;]*translate/, '.ric-checkbox transition に translate');
  });
});

describe('CSS press feedback: consumer の transform 共存シナリオ (statically check)', () => {

  // jsdom で実 DOM に CSS を適用して computed style を読むのは jsdom が
  // animations / transitions / pseudo-classes (:active) の computed を
  // 正しくシミュレートしないため断念。代わりに CSS 文字列に対する static
  // 検査で「consumer transform が消えない設計になっているか」を担保する。

  test('library 側ルールで transform プロパティを書かない (translate のみ使う)', () => {
    // .ric-button / .ric-checkbox は consumer が transform を自由に設定できる
    // ように、library 側は transform を一切宣言しない。
    // 注意: keyframes / popup / tooltip / dialog 等 positioning に transform を
    // 使う箇所は除外 (consumer が override しないコンポーネント内の話)。
    const button_css   = strip_css_comments(CSS_TEMPLATES['ric-button']());
    const checkbox_css = strip_css_comments(CSS_TEMPLATES['ric-checkbox']());

    // .ric-button および .ric-checkbox 系のセレクタの中で transform: を含む
    // 宣言が無いことを確認する。
    // (簡易: keyframes は含まれていないテンプレートなので grep で十分)
    for (const css of [button_css, checkbox_css]) {
      assert.doesNotMatch(css, /transform:\s*(?!none)/,
        'library 側で transform を宣言しない (consumer に解放)');
    }
  });
});
