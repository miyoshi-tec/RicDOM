# ricdom TUTORIAL

Ten short chapters, each with runnable code. This tutorial only uses a `<script>` tag —
no build step, no `npm install` — so you can copy any snippet into an `.html` file and
open it in a browser. For the full contract behind everything shown here, see
[SPEC.md](SPEC.md).

1. [Setup](#1-setup)
2. [Writing a tree](#2-writing-a-tree)
3. [Changing state re-renders — and the one trap](#3-changing-state-re-renders--and-the-one-trap)
4. [Wiring up inputs](#4-wiring-up-inputs)
5. [Components and `use()`](#5-components-and-use)
6. [Theme and CSS](#6-theme-and-css)
7. [Dialog and popup](#7-dialog-and-popup)
8. [The tweak panel](#8-the-tweak-panel)
9. [Islands: coexisting with a `<canvas>`](#9-islands-coexisting-with-a-canvas)
10. [Next steps](#10-next-steps)

---

## 1. Setup

One `<script>` tag is enough:

```html
<script src="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom.iife.min.js"></script>
<script>
  ricdom.createApp('#app', { count: 0 }, (s) => ({
    tag: 'div',
    children: [`count: ${s.count}`],
  }));
</script>
<div id="app"></div>
```

Or, with a bundler / native ESM:

```js
import { createApp } from 'https://esm.sh/ricdom@2';
```

Both forms give you exactly the same API — `ricdom` (the global) and the module's default
export are the same object. Everything below is written as ESM `import`s; swap in the
`ricdom.` / `ricdomUI.` global prefix if you're using the `<script>` tags instead.

---

## 2. Writing a tree

A ricdom tree is plain JavaScript objects and arrays — no JSX, no template syntax.

```js
import { createApp } from 'ricdom';

createApp('#app', {}, () => ({
  tag: 'ul',
  children: [
    { tag: 'li', children: ['one'] },
    { tag: 'li', children: ['two'] },
    { tag: 'li', children: ['three'] },
  ],
}));
```

- `tag` picks the element (any HTML or SVG tag name).
- `children` is a node or array of nodes: strings/numbers become text, `null`/`false`/
  `undefined` render as nothing, arrays are flattened.
- Anything else you put on the object becomes an attribute, a property, or (for `on*`
  keys) an event handler:

```js
{ tag: 'button', class: 'primary', disabled: false, onclick: () => alert('hi'), children: ['Click'] }
```

---

## 3. Changing state re-renders — and the one trap

`createApp(target, state, render)` returns an **app handle**. Assigning to a property of
that handle schedules a re-render:

```js
import { createApp } from 'ricdom';

const app = createApp('#app', { count: 0 }, (s) => ({
  tag: 'div',
  children: [
    { tag: 'button', onclick: () => { app.count -= 1; }, children: ['-'] },
    { tag: 'output', children: [String(s.count)] },
    { tag: 'button', onclick: () => { app.count += 1; }, children: ['+'] },
  ],
}));
```

Notice the render callback's own parameter, `s`, and the outer `app` handle refer to the
**same reactive object** — you can write to either one (`s.count = 1` inside an event
handler works exactly like `app.count = 1`). What does *not* work is writing to the plain
object you originally passed in:

```js
const state = { count: 0 };
const app = createApp('#app', state, (s) => ({ tag: 'div', children: [s.count] }));

state.count = 1;   // ❌ nothing happens — `state` was never made reactive, only wrapped
app.count = 1;      // ✅ this is the reactive handle — re-renders
```

This is the single most common thing people trip on, so it's worth internalizing early:
**`createApp` wraps your object, it does not mutate it.** Only the returned handle (and
the `s` your render function receives) is reactive. Once you're in the habit of reading
and writing through `app`/`s`, this never comes up again.

### One more rule: shallow

The reactive wrapper only tracks the state object's own top-level properties, plus one
level into any object-valued property:

```js
app.user = { name: 'x' };      // ✅ tracked (top level)
app.user.name = 'y';            // ✅ tracked (one level in)
app.user.address.city = 'z';    // ❌ not tracked (two levels in)
```

To update something nested two or more levels deep, shallow-copy the level that changed:

```js
app.user = { ...app.user, address: { ...app.user.address, city: 'z' } };
```

In a development build, writing to an untracked nested path like that logs a
`console.warn` telling you exactly this — it still writes the value, it just won't
re-render, so you'll notice a stale UI and a matching warning in the console rather than
silence.

---

## 4. Wiring up inputs

`ricdom/ui` ships plain-function form controls plus `bind*` helpers for the common
two-way case. Add the UI package:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom-ui.css">
<script src="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom.iife.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom-ui.iife.min.js"></script>
```

```js
import { createApp } from 'ricdom';
import { bindInput, uiText } from 'ricdom/ui';

createApp('#app', { name: '' }, (s) => ({
  tag: 'div',
  children: [
    bindInput(s, 'name', { placeholder: 'Your name' }),
    uiText({ children: [`Hello, ${s.name || 'stranger'}!`] }),
  ],
}));
```

`bindInput(s, 'name', options)` is shorthand for wiring `value`/`oninput` yourself:

```js
uiInput({
  value: s.name,
  oninput: (ev) => { s.name = ev.target.value; },
});
```

`bindTextarea`, `bindCheckbox`, `bindSelect`, and `bindRange` follow the same pattern for
their respective controls. Reach for the plain `uiInput`/`uiCheckbox`/… functions directly
whenever you need custom logic in the handler instead of a straight assignment.

---

## 5. Components and `use()`

Stateless components (everything in the previous chapter) are just functions you call.
Stateful components — ones that hold their own open/closed state and need somewhere to
render into, like a dialog — are different: you register them once with `app.use()`, and
call the returned handle inside `render` every time. `createApp` renders synchronously
before it returns, so register the part in the `setup` option — it runs right before that
first render, so the part is already usable on the very first call:

```js
import { createApp } from 'ricdom';
import { createToast, uiButton } from 'ricdom/ui';

let toast;
const app = createApp(
  '#app',
  {},
  () => {
    toast(); // registers this render cycle's portal content — call it every render
    return uiButton({
      children: ['Save'],
      onclick: () => toast.show('Saved!', { type: 'success' }),
    });
  },
  { setup: (a) => { toast = a.use(createToast()); } },
);
```

(Without `setup`, you'd have to make `render` return a placeholder until `use()` has run,
then trigger another render — `setup` exists so you don't have to.)

If you forget the `app.use(...)` step and call `createToast()()` directly, nothing
crashes — `ricdom/ui` logs one `console.error` explaining the fix and renders nothing.
There's no implicit wiring to get subtly wrong: either a part is registered with `use()`,
or it visibly isn't.

---

## 6. Theme and CSS

`applyTheme` sets a family of `--ric-*` CSS variables (plus the native `color-scheme`
property) as inline style on whatever element you give it — themes are per-element, not
global, so different parts of a page can carry different themes at once:

```js
import { applyTheme } from 'ricdom/ui';

applyTheme(document.getElementById('app'), { theme: 'dark', density: 'compact' });
```

Built-in themes: `light`, `dark`, `teal`, `cyber`, `aqua`. Densities: `comfortable`
(default), `compact`, `tight`. You can also pass your own `{ '--ric-color-accent': '#e91e8c', ... }`
object as `theme` for a fully custom palette, or `createTheme('teal', { ... })` to start
from a bundled theme and override just a few variables.

`applyTheme` also paints `background`/`color`/`font-size` on the element itself
(background/color since 2.0.0-alpha.3, font-size added in alpha.6) — with v1's
`create_ui_page` gone, this is what makes the element you called it on actually look
themed, not just its descendants (which pick up the `--ric-*` variables through normal CSS
inheritance either way).

If you skipped the `<link rel="stylesheet">` in chapter 4 (e.g. a pure `<script>`-only
page), call `ricdomUI.injectStyles()` once instead — it inserts the same stylesheet at
runtime and is safe to call more than once.

---

## 7. Dialog and popup

Accessibility (focus trap, `Escape` handling, ARIA roles) is the library's job, not yours
— you just supply content. For the common "click a button to open" case, `createDialog`
can render its own trigger button for you:

```js
import { createApp } from 'ricdom';
import { createDialog, uiButton } from 'ricdom/ui';

let dlg;
const app = createApp(
  '#app',
  {},
  () =>
    dlg({
      triggerChildren: ['Delete item'],
      title: 'Are you sure?',
      children: ['This cannot be undone.'],
      actions: [uiButton({ children: ['Delete'], variant: 'primary', onclick: () => { /* ... */ dlg.close(); } })],
    }),
  { setup: (a) => { dlg = a.use(createDialog()); } },
);
```

This is *uncontrolled* mode: the dialog manages its own open/closed state. For a dialog
driven entirely by your own state (`controlled` mode), pass `open`/`onClose` instead of
`triggerChildren`:

```js
dlg({
  open: s.showDialog,
  onClose: (reason) => { s.showDialog = false; }, // reason: 'overlay' | 'close-button' | 'escape' | 'api'
  title: 'Are you sure?',
  children: ['This cannot be undone.'],
});
```

`createPopup` follows the same `use()`-then-call pattern for a `role="menu"` dropdown menu
with arrow-key navigation built in:

```js
let menu;
const app = createApp(
  '#app',
  {},
  () =>
    menu({
      trigger: ['⋯'],
      children: [
        uiButton({ children: ['Rename'], onclick: () => { /* ... */ } }),
        uiButton({ children: ['Delete'], onclick: () => { /* ... */ } }),
      ],
    }),
  { setup: (a) => { menu = a.use(createPopup()); } },
);
```

`Escape`, focus trapping/restoration, and outside-click dismissal all work without any
further code on your part. Selecting a menuitem also closes the menu by default (pass
`closeOnSelect: false` for a checkbox-style menu that should stay open).

One naming difference worth remembering: `createPopup`'s trigger look (icon/ghost/size) is
configured *inside* the `trigger` object (`trigger: { icon, ghost, size }`), while
`createDropdown`'s equivalent look is a set of **top-level props** (`label`/`icon`/`ghost`)
passed alongside `children` — the two components don't share a `trigger` shape.

---

## 8. The tweak panel

For quickly exposing a set of parameters to adjust live — useful for prototyping visual
effects, calibrating a simulation, or building an internal debug panel —
`createTweakPanel` turns a plain data object into a full parameter panel automatically:

```js
import { createApp } from 'ricdom';
import { createTweakPanel } from 'ricdom/ui';

let tweak;
const app = createApp(
  '#app',
  { params: { size: 10, color: '#ff0000', spin: true } },
  (s) => tweak({ title: 'Params', data: s.params }),
  { setup: (a) => { tweak = a.use(createTweakPanel()); } },
);
```

This alone produces a number field for `size`, a color picker for `color`, and a checkbox
for `spin` — the row type is inferred from the value's type (booleans → checkbox, numbers
→ number input, hex/`rgba()` strings → color picker, everything else → text). Nest a plain
object to get a collapsible folder. Override individual rows (min/max/step/options/type)
with the `keys` prop, or append your own hand-built rows with `rows` — see
[SPEC.md §10](SPEC.md#10-components) or `examples/tweak.html` for the full three-tier API.

A row doesn't have to come from `data`: give a `keys` entry a `get` (and optionally `set`)
function and it renders as its own row without ever reading or writing `data[key]` —
useful for a derived/read-only value (e.g. an area computed from `size`). A folder's
`keys` entry can also carry its own `rows` array, appended at the end of that folder
specifically (the top-level `rows` prop only ever appends to the end of the whole panel).

---

## 9. Islands: coexisting with a `<canvas>`

Sometimes part of your page is driven by something other than ricdom's own diffing — an
animation loop drawing to a `<canvas>`, a third-party widget. Mark that subtree
`island: true` and ricdom will build it once and never touch its descendants again on any
later render:

```js
createApp('#app', { fps: 0 }, (s) => ({
  tag: 'div',
  children: [
    { tag: 'output', children: [`${s.fps} fps`] },
    { tag: 'canvas', island: true, width: 400, height: 300, ref: 'canvas' },
  ],
}));
```

Grab the canvas element yourself via `app.refs.get('canvas')` and drive it however you
like — ricdom's diffing will never fight you for control of anything inside an island.

---

## 10. Next steps

- [SPEC.md](SPEC.md) — the full contract: diffing rules, reactivity, the scheduler,
  `use()`, portals, themes, every component's props and ARIA behavior.
- `examples/` — five build-free demo pages you can open directly in a browser
  (`examples/index.html` is the index).
- [CHANGELOG.md](../CHANGELOG.md) — what changed release to release, and the breaking
  changes from v1 if you're migrating an existing RicDOM v1 app.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — if you want to work on ricdom itself.
