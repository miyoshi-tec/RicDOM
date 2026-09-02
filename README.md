# ricdom

[![CI](https://github.com/miyoshi-tec/ricdom/actions/workflows/ci.yml/badge.svg)](https://github.com/miyoshi-tec/ricdom/actions/workflows/ci.yml)

> Write UI as plain objects. Assign to state. The real DOM updates. No build step, typed, accessible.

Successor to [RicDOM v1](https://github.com/miyoshi-tec/RicDOM). Under construction — see [docs/DESIGN.ja.md](docs/DESIGN.ja.md).

Status: Phase 2 (component contract + portal + theme + CSS distribution) — not yet published.

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
failures if you forget to register one. Stateless components (`uiButton` /
`uiInput`) are plain functions.

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
