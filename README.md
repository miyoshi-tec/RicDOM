# ricdom

[![CI](https://github.com/miyoshi-tec/ricdom/actions/workflows/ci.yml/badge.svg)](https://github.com/miyoshi-tec/ricdom/actions/workflows/ci.yml)

> Write UI as plain objects. Assign to state. The real DOM updates. No build step, typed, accessible.

Successor to [RicDOM v1](https://github.com/miyoshi-tec/RicDOM). Under construction — see [docs/DESIGN.ja.md](docs/DESIGN.ja.md).

Status: Phase 3c (`createTweakPanel` parameter panel + `ricdom/icons` bundled icon
data / `svgToDescriptor` / `ricdom-icon` CLI) — not yet published.

```js
// createApp(target, state, render) — 3 引数 (state から render の s が型付く)
ricdom.createApp(
  '#app',
  { count: 0 },
  (s) => ({
    tag: 'div',
    children: [
      { tag: 'button', onclick: () => { s.count -= 1; }, children: ['-'] },
      { tag: 'output', children: [String(s.count)] },
      { tag: 'button', onclick: () => { s.count += 1; }, children: ['+'] },
    ],
  }),
);
```

## ricdom/ui

Stateful components (dialog / popup / toast / tooltip) register via `app.use()`
so they always receive a portal to render into — no implicit wiring, no silent
failures if you forget to register one. Stateless components — buttons, inputs,
textareas, checkboxes, radio groups, selects, ranges, color pickers, layout
(col/row/grid/panel), markdown/code display — are plain functions
(`props => RicNode`, no `app.use()`); see `examples/controls.html`.

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom-ui.css">
<script src="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom.iife.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom-ui.iife.min.js"></script>
<script>
  let dlg;
  const app = ricdom.createApp('#app', {}, (s) =>
    dlg ? dlg({ triggerChildren: ['Open'], title: 'Confirm', children: ['Really?'] }) : null,
  );
  dlg = app.use(ricdomUI.createDialog());

  ricdomUI.applyTheme(document.getElementById('app'), { theme: 'dark' });
</script>
```

See [examples/ui.html](examples/ui.html) for a full working demo (dialog + popup +
toast + tooltip, zero build step).

Composite components (splitter / scrollPane / collapseBox / accordion / tabs /
dropdown) also register via `app.use()` — same rule, no exceptions. `uiInlineMenu`
is stateless (open state lives in your own state, like `uiButton`). See
[examples/composite.html](examples/composite.html) for a full working demo.

`createTweakPanel` (`app.use()`) builds a dat.GUI-style parameter panel from a
plain data object — pass `data` and it infers a row per property (number/range/
checkbox/text/select/radiobutton/color, nested objects become collapsible
folders); override individual rows with `keys`, or append hand-built rows with
`rows`. See [examples/tweak.html](examples/tweak.html).

## ricdom/icons

`ricdom/icons` ships 36 bundled icon descriptors (`{ v?, s?, p }`) as individual,
tree-shakable named exports (Lucide-style kebab-case names converted to
camelCase, e.g. `chevron-down` → `chevronDown`) plus `svgToDescriptor(svg)` for
converting your own SVGs. Never hand-write a descriptor's path data — either
`import` from this subpath or fetch one with the bundled CLI:

```sh
npx ricdom-icon chevronDown --json   # bundled, offline
npx ricdom-icon settings --json      # not bundled → fetched from Lucide, path-ified
npx ricdom-icon --names              # list bundled names
npx ricdom-icon --search gear        # search bundled + Lucide
```

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for icon attribution.
