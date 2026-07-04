// RicUI — data-ric-role 属性の regression guard
//
// 各 component の DOM 要素は class 名が minify されるが、data-ric-role 属性は
// minify 対象外で常に semantic な値が残る。consumer 側で CSS / E2E テストの
// selector として使う前提なので、ここで「期待する role が確かに付いている」
// ことを保証する (削除を防ぐ regression guard)。
//
// 全 component を実 DOM にマウントして querySelector で role を引く。

'use strict';

const { test, describe, beforeEach } = require('node:test');
const { strict: assert } = require('node:assert');

const { setup_jsdom, flush } = require('./_helpers/jsdom_env');

// DOM 全体から data-ric-role 一覧を抽出する
const roles_in = (root) =>
  Array.from(root.querySelectorAll('[data-ric-role]'))
    .map(el => el.getAttribute('data-ric-role'));

describe('data-ric-role: splitter', () => {
  beforeEach(setup_jsdom);
  test('side / divider / toggle / main の 4 役割が出る', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_splitter } = require('../ric_ui/composite/create_ui_splitter');
    create_RicDOM('#app', {
      sp: create_ui_splitter({ side: 'left', size: 200, collapsible: true }),
      render: (s) => s.sp({ side: { ctx: ['L'] }, main: { ctx: ['R'] } }),
    });
    await flush();
    const roles = roles_in(document.getElementById('app'));
    assert.ok(roles.includes('splitter-side'),    'side: ' + roles.join(','));
    assert.ok(roles.includes('splitter-divider'), 'divider');
    assert.ok(roles.includes('splitter-toggle'),  'toggle (collapsible:true)');
    assert.ok(roles.includes('splitter-main'),    'main');
  });
});

describe('data-ric-role: dialog', () => {
  beforeEach(setup_jsdom);
  test('overlay / dialog / header / title / close / body / footer', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_page  } = require('../ric_ui/layout/ui_page');
    const { create_ui_dialog } = require('../ric_ui/popup/create_ui_dialog');
    create_RicDOM('#app', {
      page: create_ui_page({ theme: 'light' }),
      dlg:  create_ui_dialog(),
      render: (s) => s.page({ ctx: [
        s.dlg({ open: true, on_close: () => {},
                title: 't', ctx: [{ tag: 'span', ctx: ['body'] }],
                actions: [{ tag: 'button', ctx: ['ok'] }] }),
      ]}),
    });
    await flush();
    const roles = roles_in(document.body);
    for (const r of ['dialog-overlay', 'dialog', 'dialog-header',
                     'dialog-title', 'dialog-close', 'dialog-body',
                     'dialog-footer']) {
      assert.ok(roles.includes(r), r + ' missing in: ' + roles.join(','));
    }
  });
});

describe('data-ric-role: popup', () => {
  beforeEach(setup_jsdom);
  test('trigger が常に出る (overlay/body は open 時のみなので trigger のみ確認)', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_page  } = require('../ric_ui/layout/ui_page');
    const { create_ui_popup } = require('../ric_ui/popup/create_ui_popup');
    create_RicDOM('#app', {
      page: create_ui_page({ theme: 'light' }),
      pop:  create_ui_popup(),
      render: (s) => s.page({ ctx: [s.pop({ label: 'menu', ctx: [] })] }),
    });
    await flush();
    const roles = roles_in(document.body);
    assert.ok(roles.includes('popup-trigger'), 'trigger: ' + roles.join(','));
  });
});

describe('data-ric-role: toast', () => {
  beforeEach(setup_jsdom);
  test('toast を push すると container / item / msg / close が出る', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_page  } = require('../ric_ui/layout/ui_page');
    const { create_ui_toast } = require('../ric_ui/popup/create_ui_toast');
    const s = create_RicDOM('#app', {
      page: create_ui_page({ theme: 'light' }),
      ts:   create_ui_toast(),
      render: (s) => { s.ts(); return s.page({ ctx: [] }); },
    });
    s.ts.show('hello');
    await flush();
    const roles = roles_in(document.body);
    for (const r of ['toast-container', 'toast-item', 'toast-msg', 'toast-close']) {
      assert.ok(roles.includes(r), r + ' missing in: ' + roles.join(','));
    }
  });
});

describe('data-ric-role: tooltip', () => {
  beforeEach(setup_jsdom);
  test('tooltip-target が常に出る (popup は hover 時のみ)', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_page  } = require('../ric_ui/layout/ui_page');
    const { create_ui_tooltip } = require('../ric_ui/popup/create_ui_tooltip');
    create_RicDOM('#app', {
      page: create_ui_page({ theme: 'light' }),
      tt:   create_ui_tooltip(),
      render: (s) => s.page({ ctx: [
        s.tt({ content: 'hint', ctx: { tag: 'button', ctx: ['hover me'] } }),
      ]}),
    });
    await flush();
    const roles = roles_in(document.body);
    assert.ok(roles.includes('tooltip-target'), 'tooltip-target: ' + roles.join(','));
  });
});

describe('data-ric-role: accordion', () => {
  beforeEach(setup_jsdom);
  test('accordion / -item / -header / -title / -arrow / -body の 6 役割', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { create_ui_accordion } = require('../ric_ui/composite/create_ui_accordion');
    create_RicDOM('#app', {
      acc: create_ui_accordion(),
      render: (s) => s.acc({ items: [{ id: 'a', title: 'T', ctx: [{ tag: 'span', ctx: ['x'] }] }] }),
    });
    await flush();
    const roles = roles_in(document.getElementById('app'));
    for (const r of ['accordion', 'accordion-item', 'accordion-header',
                     'accordion-title', 'accordion-arrow', 'accordion-body']) {
      assert.ok(roles.includes(r), r + ' missing in: ' + roles.join(','));
    }
  });
});

describe('data-ric-role: tabs', () => {
  beforeEach(setup_jsdom);
  test('tabs / -bar / -tab / -panel の 4 役割', async () => {
    const { create_RicDOM } = require('../src/ricdom');
    const { ui_tabs } = require('../ric_ui/composite/ui_tabs');
    create_RicDOM('#app', {
      tab: 'a',
      render: (s) => ui_tabs({
        active: s.tab,
        onchange: (k) => { s.tab = k; },
        items: [
          { key: 'a', label: 'A', ctx: [{ tag: 'span', ctx: ['x'] }] },
          { key: 'b', label: 'B', ctx: [{ tag: 'span', ctx: ['y'] }] },
        ],
      }),
    });
    await flush();
    const roles = roles_in(document.getElementById('app'));
    for (const r of ['tabs', 'tabs-bar', 'tabs-tab', 'tabs-panel']) {
      assert.ok(roles.includes(r), r + ' missing in: ' + roles.join(','));
    }
  });
});
