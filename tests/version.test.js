// version.js regression test
// src/version.js は build 時に scripts/gen_version.js が package.json から
// 生成する。忘れて古いバージョン番号が残ったまま push するのを防ぐため、
// package.json と src/version.js が一致することをテストで保証する。

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const pkg = require('../package.json');

test('src/version.js は package.json.version と一致する', () => {
  const version = require('../src/version');
  assert.equal(version, pkg.version,
    `src/version.js (${version}) と package.json (${pkg.version}) が乖離している。` +
    `'npm run build' または 'node scripts/gen_version.js' を実行してください。`);
});

test('RicDOM コア export に version が含まれる', () => {
  const { version } = require('../src/ricdom');
  assert.equal(version, pkg.version);
});

test('RicUI export に version が含まれる', () => {
  const { version } = require('../ric_ui');
  assert.equal(version, pkg.version);
});

test('version は semver 形式の文字列', () => {
  const version = require('../src/version');
  assert.equal(typeof version, 'string');
  assert.match(version, /^\d+\.\d+\.\d+(-.+)?$/,
    `version "${version}" が semver 形式ではない`);
});
