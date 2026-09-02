# ricdom

[![CI](https://github.com/miyoshi-tec/ricdom/actions/workflows/ci.yml/badge.svg)](https://github.com/miyoshi-tec/ricdom/actions/workflows/ci.yml)

> Write UI as plain objects. Assign to state. The real DOM updates. No build step, typed, accessible.

Successor to [RicDOM v1](https://github.com/miyoshi-tec/RicDOM). Under construction — see [docs/DESIGN.ja.md](docs/DESIGN.ja.md).

Status: Phase 1b (core + browser tests + CI) — not yet published.

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
