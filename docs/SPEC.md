# ricdom SPEC

This document states the **contract** of `ricdom` (core), `ricdom/ui`, and `ricdom/icons`:
what is guaranteed to be true, and what is guaranteed to stay true across patch/minor
releases. It contains facts, not recipes — for task-oriented walkthroughs see
[TUTORIAL.md](TUTORIAL.md); for design rationale see the (Japanese) internal design
record `docs/DESIGN.ja.md`.

Everything here describes **current, released behavior**. Where v1 (`RicDOM`) behaved
differently, that is noted only when it helps someone migrating — this is not a changelog.

- [1. Node representation](#1-node-representation)
- [2. Diffing (patch) rules](#2-diffing-patch-rules)
- [3. Reactivity](#3-reactivity)
- [4. Scheduler](#4-scheduler)
- [5. `createApp`](#5-createapp)
- [6. `use()` and the component contract](#6-use-and-the-component-contract)
- [7. Portals](#7-portals)
- [8. Themes](#8-themes)
- [9. CSS distribution](#9-css-distribution)
- [10. Components](#10-components)
- [11. `data-ricdom-role` registry](#11-data-ricdom-role-registry)
- [12. Icons](#12-icons)

---

## 1. Node representation

A UI tree is plain data. There is no JSX, no template compiler, no build step required to
author it.

```ts
type RicNode = string | number | null | false | undefined | RicElementNode | RicNode[];
```

- `string` / `number` render as a text node.
- `null`, `false`, `undefined`, and empty arrays render as nothing (**invisible**). Arrays
  are flattened one level and their invisible members are dropped before diffing.
- `RicElementNode` is a discriminated union keyed by `tag`. For a known HTML/SVG tag name,
  the object's allowed attributes are inferred from `HTMLElementTagNameMap` /
  `SVGElementTagNameMap` (so `{ tag: 'input', value: '' }` type-checks and
  `{ tag: 'input', href: '' }` does not). Unknown tags (custom elements) fall back to a
  generic attribute set (primitive IDL properties + `data-*`/`aria-*`).
- Where an HTML and an SVG tag share a name (`a`, `title`, `script`, `style`), the HTML
  attribute types win.
- `tag` is **required** at the type level — `{}` is a type error. If a non-TypeScript
  caller passes a node without a string `tag` at runtime, `ricdom` logs a `console.error`
  and treats the node as invisible; it never throws.

### `BaseNodeProps` (present on every element node)

| Key | Type | Meaning |
|---|---|---|
| `id` | `string` | DOM `id` |
| `class` | `string \| string[] \| Record<string, boolean>` | Concatenated / filtered into a class list |
| `style` | `Record<string, string \| number>` | Inline style. **Object only** — v1's string/array forms do not exist in v2 |
| `children` | `RicNode \| RicNode[]` | Child nodes. v1 called this `ctx`; v2 always calls it `children` |
| `island` | `true` (or omitted) | See [§2.5](#25-islands) |
| `key` | `string \| number` | Reconciliation identity, see [§2.2](#22-key-based-reconciliation) |
| `ref` | `string` | Registers the rendered DOM element under `app.refs.get(name)` (backed by a `data-ricdom-ref` attribute) |

Any other key is either an event handler (`on*`, assigned as a DOM property), a
`data-*`/`aria-*` attribute, or a tag-specific IDL property/attribute — see §2.1.

### FACT: empty object is not invisible

v1 treated `{}` as invisible (no `ctx` key at all was its own signal for "island"). In v2,
`island` is an explicit flag (§2.5) and `{}` does not type-check without a `tag`, so an
empty object is never a meaningful "invisible" input at the type level. At the
`normalizeNode` level, only `null`/`undefined`/`false`/`[]` are invisible.

---

## 2. Diffing (patch) rules

`ricdom` builds real DOM nodes from a tree and, on every render, diffs the previous tree
against the next one in place — there is no virtual DOM retained between renders beyond
the plain-object tree itself.

### 2.1 Attribute application

- Keys in `DOM_PROPERTY_KEYS` (`value`, `checked`, `selected`, `disabled`, `innerHTML`,
  `textContent`, `innerText`, `scrollTop`, `scrollLeft`) are assigned as DOM **properties**
  (`el.value = x`), not via `setAttribute`.
- `on*` keys are assigned as DOM event-handler properties (`el.onclick = fn`). A new
  function reference on every render is expected and cheap — the handler is simply
  reassigned each patch, so closures over fresh render-scoped variables work correctly.
- Boolean values for any other key toggle the attribute's presence
  (`el.setAttribute(key, '')` / `el.removeAttribute(key)`).
- `null`/`undefined` values remove the attribute.
- Everything else is stringified and set via `setAttribute`.
- `class` on an SVG element is written via `setAttribute('class', …)` (SVG's `className`
  is an `SVGAnimatedString`, not a plain string — direct assignment silently no-ops).
- CSS custom properties (style keys starting with `--`) are written via
  `style.setProperty()`/`removeProperty()` — bracket assignment is a silent no-op for
  these on `CSSStyleDeclaration`.
- `style` keys are camelCased automatically (`background-color` and `backgroundColor` are
  equivalent); `--custom-property` keys are left untouched.

### 2.2 Key-based reconciliation

If **any** sibling in either the previous or the next children list has a non-null `key`,
the whole sibling list is reconciled by key:

- A next child with a `key` reuses the previous DOM node that had the same `key`
  (regardless of position), and is attribute/child-patched in place.
- A next child without a `key` is matched against previous **unkeyed** siblings in order,
  by same-tag/same-kind, first-available.
- Unmatched previous entries are removed from the DOM; unmatched next entries are built
  fresh and inserted at the correct position.

### 2.3 Position-based reconciliation

If no sibling has a `key`, children are reconciled by index. To avoid two different
element types at the same index being patched into each other's DOM node, a **duplicate
tag detector** first finds any tag that appears more than once (in either list) and gives
those siblings a per-tag serial key (`div@0`, `div@1`, …) purely for the "did the type
change at this position" check — this is not the same mechanism as an explicit `key` and
does not enable reordering.

### 2.4 `FORCE_REAPPLY`

`value`, `checked`, `selected`, `scrollTop`, and `scrollLeft` are re-applied to the DOM on
every render **even when the previous and next VDOM values are equal**, because the user
(typing, checking a box, scrolling) can make the live DOM drift from the last-rendered
value without ricdom knowing. This mirrors the "controlled input" convention used by
React, Preact, and other major VDOM libraries. It also applies to subtrees where the
parent's children list is structurally unchanged (`isJsonEqual` short-circuits the
subtree, but a dedicated walker still re-applies these five keys).

### FACT: the editing guard

While an `input`/`textarea`/`select` element **is** `document.activeElement`, its `value`
is exempted from `FORCE_REAPPLY`. This prevents an unrelated state change elsewhere in the
app from re-rendering and clobbering what the user is mid-typing (this was a real,
user-visible bug in v1 that only had a local fix inside one widget; in v2 it is a core
rule that applies everywhere). The exemption is scoped to `value` only — `checked`,
`selected`, and scroll position are still force-reapplied, since drift there does not
destroy in-progress keystrokes. Once the element loses focus, the next render re-syncs
`value` normally.

### 2.5 Islands

`{ tag: 'div', island: true, children: [...] }` tells ricdom to build the element once and
never look at its descendants again on any subsequent render — no diff, no patch, no
`FORCE_REAPPLY` walk. This is for embedding externally-managed DOM (a `<canvas>` driven by
your own animation loop, a third-party widget) inside a ricdom tree without ricdom fighting
it for control of that subtree. v1 used *omitting* the `ctx` key as an implicit island
signal; v2 requires the explicit `island: true` flag, because in a typed tree simply
forgetting to write `children` would otherwise silently turn a node into an island.

### 2.6 `<select>`

Because a browser ignores a `<select>`'s `value` assignment until it has at least one
`<option>` child, `buildDomNode` re-applies `value` a second time immediately after all
child `<option>` elements have been appended. Consumers never need to work around
option/value construction order themselves.

### 2.7 SVG

An element whose tag is `svg` establishes the SVG namespace for itself and is inherited by
all of its descendants (`document.createElementNS`), regardless of how deep. An `<svg>`
nested inside an already-SVG-namespaced tree stays in that namespace (namespace, once
entered, is never re-derived from a nested `svg` tag — the inherited one wins for tags
other than `svg` itself).

---

## 3. Reactivity

`createApp(target, state, render)` wraps `state` in a **shallow** `Proxy` (one level deep,
plus one more for object-valued top-level properties):

```
state.count = 1            // tracked → triggers a render
state.user.name = 'x'       // tracked → user itself is a Proxy'd child, its set trap fires
state.user.address.city = 'x' // NOT tracked → nothing renders
```

### Canon: shallow-copy replacement

To change something two or more levels deep, replace the shallow-copied parent:

```js
app.user = { ...app.user, address: { ...app.user.address, city: 'x' } };
```

This is the one and only supported pattern for deep updates — there is no `watch()` /
`effect()` helper and no deep-Proxy mode. It keeps the reactivity system's cost bounded
regardless of state shape, and keeps "why didn't this re-render" answerable by one rule.

### Dev-mode warning for untracked deep assignment

In a non-production build (`process.env.NODE_ENV !== 'production'`, which is also the
fallback when `process` is undefined, e.g. plain `<script>` usage without a bundler — the
library treats "can't tell" as dev mode rather than silently hiding the problem), reading
a nested object through the reactive state returns it wrapped in a second, read-only-style
Proxy that logs `console.warn` on any `set`/`deleteProperty`, then still performs the
assignment (so dev and production observe the same final data, only dev also warns). The
production IIFE build has `process.env.NODE_ENV` statically inlined to `'production'` by
the build, so this entire code path is removed by dead-code elimination — it costs nothing
in the shipped bundle. Arrays are never wrapped (assigning into array elements is not
tracked and is not warned about, matching v1).

### `ignore`

A property literally named `ignore` (`state.ignore = {...}`) is never wrapped, never
tracked, and mutating anything under it never schedules a render. Use it for large caches
or non-reactive scratch space that lives alongside reactive state.

### FACT: mutating the original `state` object does nothing

```js
const state = { count: 0 };
const app = createApp('#app', state, (s) => ({ tag: 'div', children: [s.count] }));
state.count = 1;       // does NOT re-render — `state` is not the Proxy
app.count = 1;          // DOES re-render — `app` (and the render callback's `s`) are the Proxy
```

`createApp` never replaces or proxies the reference you passed in — it wraps it. Only the
returned `app` handle (and the `s` parameter your `render` function receives, which is the
same object) is reactive. This is true in v1 as well, but it is easy to trip over,
especially when refactoring state setup into its own function and holding onto the
original local variable by habit — the fix is always "use the handle you got back from
`createApp`, not the object you built."

---

## 4. Scheduler

Every render request (a `Proxy` `set`, or `app.use()`'s part calling `host.notify()`) goes
through a scheduler that arms **both** `requestAnimationFrame` and `setTimeout(fn, 200)` at
once; whichever fires first performs the render, and the other is cancelled. This exists
because `requestAnimationFrame` does not fire reliably in every environment ricdom targets
— a backgrounded/hidden browser tab, an Electron window with `backgroundThrottling`, a
kiosk mid-transition — and a render that silently never happens is worse than one that is
merely ~200ms late. Multiple render requests within one scheduling window collapse into a
single render.

### `renderNow()` vs `nextRender()`

- `app.renderNow()` cancels any pending scheduled render and renders **synchronously,
  immediately**. Use it when you need "definitely rendered by the time this line returns"
  and don't care whether anything was actually pending.
- `app.nextRender()` returns a `Promise<void>` that resolves once the **next scheduled
  render actually completes**. If no render is currently scheduled, the promise never
  resolves — it observes a pending render, it does not force one. Use it in tests/E2E code
  that needs to await "the DOM has caught up with a state change I just made," not as a
  general-purpose "wait a tick."

### FACT: hidden tabs throttle both halves of the backstop

A hidden/backgrounded tab (or any document where `document.hasFocus() === false`) does not
just stop `requestAnimationFrame` — most browsers also throttle `setTimeout` in that state,
typically to no faster than about once per second. The 200ms backstop described above is
still armed and will still eventually fire, but "eventually" can mean up to ~1s in a hidden
tab, not 200ms. A test (or any code) that needs the DOM to reflect a state change
immediately, regardless of tab visibility/focus, should call `app.renderNow()` rather than
waiting on a timer — `nextRender()`/a bare `setTimeout` wait is not reliable under
throttling.

### FACT: the "2 rAF rule"

A `requestAnimationFrame` callback firing does **not** mean the browser has laid out or
painted the DOM mutations that callback just made — it means a new frame has *started*.
If your own code needs to measure post-patch layout (element size, scroll position) you
generally need to wait for a *second* `requestAnimationFrame` after the one in which the
DOM mutation happened, not just one. This is a browser platform fact, not a ricdom API;
several `ricdom/ui` components that measure the DOM after opening (popup/dropdown
positioning) account for it internally.

---

## 5. `createApp`

```ts
function createApp<S extends object>(
  target: string | Element,
  state: S,
  render: (state: S) => RicNode,
  options?: { portalTo?: Element; setup?: (app: App<S>) => void },
): App<S>;
```

`render` is a required, separate third argument — not a property placed inside `state` (a
form v1 also supported). This is the only signature; there is no overload. Keeping `render`
out of `state` lets `S` be inferred cleanly from the `state` argument, so the `s` parameter
your `render` callback receives is fully typed with no manual type annotation and no
self-referential generic.

### `options.setup`

`setup(app)` runs **once, immediately before the first render** — after the app and its
portal (§7) exist, but before `render` is called for the first time. Anything registered
with `app.use()` inside `setup` is therefore already attached (has a `Host`) by the time
the first `render` call references it — no placeholder-then-`renderNow()` two-step needed:

```js
let dlg;
const app = createApp(
  '#app',
  {},
  () => dlg({ triggerChildren: ['Open'], title: 'Confirm', children: ['Really?'] }),
  { setup: (a) => { dlg = a.use(createDialog()); } },
);
```

Without `setup`, `render` would have to guard the first call (`dlg ? dlg(...) : null`)
because `createApp` itself performs the first render synchronously, before the line that
calls `app.use()` has had a chance to run — `setup` exists specifically so that placeholder
branch is never necessary. If `setup` throws, the exception is caught, logged via
`console.error`, and the first render proceeds normally (never throws, per project
convention). `setup` is **not** called when `createApp` returns a NOOP app (invalid
`target`/`state`/`render`) — there is no app/portal for it to receive.

### Target resolution

- `target` may be a CSS selector string or an `Element`.
- If it resolves immediately, `createApp` performs a **synchronous first render** before
  returning — there is no `await`, no next-tick delay, no flash of unstyled/empty content
  window.
- If it is a selector string that does not currently match anything, and
  `document.readyState === 'loading'`, `createApp` waits for `DOMContentLoaded` **once**
  and retries resolution then (this covers the common case of a `<script>` running in
  `<head>` before `<body>` has parsed). While waiting, the returned handle already behaves
  like a normal `App<S>` for reading/writing state (backed by a temporary Proxy over your
  state object) — `render`, `renderNow()`/`unmount()` are no-ops, `nextRender()` never
  resolves, and `use()` returns the part unchanged, until the target resolves.
- If the target still cannot be resolved (already past `DOMContentLoaded`, or resolution
  fails after waiting), `createApp` logs `console.error` and returns a **NOOP app**.

### NOOP app

`createApp` never throws. On any invalid argument (`target` not a string/Element, `state`
not an object, `render` not a function) or unresolvable target, it logs a descriptive
`console.error` and returns an object that structurally satisfies `App<S>` — every
property read returns itself, every method call is a no-op that returns itself, every
property write succeeds silently. Calling code can chain `app.count`, `app.renderNow()`,
`app.use(part)` etc. against a NOOP app without adding a branch to check "did this actually
work," matching the project's "never let a wiring mistake cascade into a crash of unrelated
code" stance. The trade-off is explicit: prefer catching setup mistakes via `console.error`
during development over hard failures in front of end users.

### `App<S>`

The value returned by `createApp` (and the `s` argument to `render`) is `state` itself,
Proxy-wrapped, with these additional members layered on top (they are reserved property
names — assigning to `app.render`, `app.renderNow`, etc. either performs the documented
special behavior or logs `console.error` and refuses):

| Member | Type | Behavior |
|---|---|---|
| `render` | `(state: S) => RicNode` | Current render function. Assigning a new function replaces it and renders synchronously right away |
| `renderNow()` | `() => void` | See §4 |
| `nextRender()` | `() => Promise<void>` | See §4 |
| `use(part)` | `<T extends UsePart>(part: T) => T` | See §6. Idempotent — registering the same part object twice is a no-op |
| `unmount()` | `() => void` | Disposes all registered parts, stops the scheduler, clears refs. Nothing renders again after this |
| `refs` | `ReadonlyMap<string, Element>` | Every element with a `ref: 'name'` in the last-rendered tree, keyed by that name; recomputed after each render |

---

## 6. `use()` and the component contract

Stateful UI components (dialog, popup, toast, tooltip, and the other `ricdom/ui` widgets
that hold internal state or need a place to portal into) must be registered via
`app.use()` before they will do anything:

```js
const dlg = app.use(createDialog());
// render:
dlg({ triggerChildren: ['Open'], title: 'Confirm', children: ['Really?'] })
```

```ts
interface UsePart {
  attach?: (host: Host) => void;
  dispose?: () => void;
  renderPortal?: () => RicNode;
}
interface Host {
  notify(): void;   // request a render, same scheduler as a state assignment
  portal: Element;   // this app's portal element (§7)
  app: App<any>;      // the app instance this part was registered on
}
```

`app.use(part)` calls `part.attach?.(host)` and returns `part` unchanged (so
`const dlg = app.use(createDialog())` reads naturally). `app.unmount()` calls
`part.dispose?.()` on every registered part.

### FACT: calling a stateful component without `use()` does nothing, on purpose

If you call `createDialog()()` directly, without ever passing it through `app.use()`, the
component has no `Host` and therefore no way to notify or portal. Every `ricdom/ui`
stateful component detects this and, **the first time only**, logs a `console.error`
explaining the fix, then returns `null`/renders nothing on every subsequent call — it does
not throw, and it does not spam the console. This replaces v1's implicit wiring (assigning
a factory's return value to a specific place in `state` silently activated a hidden
`Proxy` trap); in v2 there is exactly one way to register a part, so "I forgot to wire this
up" surfaces immediately in the console instead of failing silently.

### Stateless components are plain functions

Anything without internal state — `uiButton`, `uiInput`, layout (`uiCol`/`uiRow`/`uiGrid`/
`uiPanel`), `uiText`, `uiIcon`, markdown/code display, `uiInlineMenu`, `bind*` — is just a
function `(props) => RicNode`. There is nothing to register and no `Host`; call it directly
in your render tree.

---

## 7. Portals

Every `App` created without `options.portalTo` gets its own portal element: `createApp`
appends a `<div data-ricdom-role="portal">` as the last child of `target`, marked
`island: true` (so ricdom's own diffing never descends into it structurally — only the
portal's own dedicated patch cycle touches its contents) and given a fixed `key` so
key-based reconciliation always finds the same DOM node across renders even when the rest
of the tree's visible/invisible shape changes from render to render.

On every render, `createApp` collects `renderPortal()` from every currently-registered
part and diffs that combined list against the portal element's previous content — this is
a pull, not a push: nothing can "queue up and never drain," because the content is always
"whatever every registered part's `renderPortal()` returns right now."

### `portalTo`

```js
createApp('#app', state, render, { portalTo: document.getElementById('my-portal') });
```

Passing `portalTo` uses that element instead of auto-generating one — useful for anchoring
portal content (dialogs, toasts) to a specific place in the DOM regardless of where
`target` itself lives. When `portalTo` is set, the portal element is **not** managed as
part of `target`'s child list (it is not a sentinel node inside the app's own tree).

### One portal per app

Multiple independent `createApp()` calls each get (or are given) their own portal — there
is no global/shared portal registry and no cross-app portal stacking order to reason
about.

---

## 8. Themes

```ts
applyTheme(el: Element, opts?: {
  theme?: 'light' | 'dark' | 'teal' | 'cyber' | 'aqua' | Record<string, string>;
  density?: 'comfortable' | 'compact' | 'tight' | Record<string, string>;
  fontSize?: 'sm' | 'md' | 'lg' | Record<string, string>;
}): void;
```

`applyTheme` computes a set of CSS custom properties (plus the plain `color-scheme`
property) and writes them as **inline style** on `el` via `style.setProperty()`, then
marks `el` with `data-ricdom-theme` (an attribute, not a class — used by the scrollbar CSS
scope, see §9). There is no `:root` write and no global singleton theme: different
elements on the same page — different `createApp` mounts, or nested containers — can each
carry their own theme, and CSS custom-property inheritance carries the values down to
descendants normally.

### CSS variables set by `applyTheme`

Color/theme (from the `theme` option — one of the five bundled names, or your own
`Record<string, string>` of the same keys):

`--ric-color-fg`, `--ric-color-fg-muted`, `--ric-color-bg`, `--ric-color-control`,
`--ric-color-border`, `--ric-color-accent`, `--ric-color-accent-fg`, `--ric-tooltip-bg`,
`--ric-tooltip-fg`, `--ric-code-bg`, `--ric-code-fg`, `--ric-shadow`, `--ric-radius`,
`color-scheme` — plus, on `cyber`/`aqua` only, `--ric-popup-bg`, `--ric-popup-blur`,
`--ric-panel-shadow`, `--ric-duration`, `--ric-easing` (other themes fall back to the CSS
defaults baked into `ricdom-ui.css`, via `var(--x, fallback)`, rather than redeclaring
them).

Density (from the `density` option): `--ric-gap`, `--ric-pad-x`, `--ric-pad-y`,
`--ric-control-h`.

Font size (from the `fontSize` option): `--ric-font-size`.

Computed regardless of options, if not already supplied by the resolved theme/overrides:
`--ric-color-fg-muted`, `--ric-color-border` (both `color-mix()` derived from
`--ric-color-fg` when a custom `theme` object omits them), `--ric-scrollbar-thumb`,
`--ric-scrollbar-thumb-hover`, `--ric-gap-md` (`calc(var(--ric-gap) * 2)`),
`--ric-duration` (`200ms`), `--ric-easing` (`ease`).

### `color-scheme` and native controls

Because `applyTheme` sets the `color-scheme` CSS property (not just a `--ric-*` variable),
native browser chrome inside the themed subtree — scrollbars, `<select>` dropdowns,
checkboxes, date pickers — automatically follows light/dark, without any ricdom-specific
styling of those controls.

### `createTheme` / `exportTheme`

- `createTheme(base, overrides)` returns a plain `ThemeVars` object (a merge of a base
  theme's color variables with your overrides) suitable for passing back into
  `applyTheme(el, { theme: createTheme(...) })`.
- `exportTheme(el)` reads the current `--ric-*`/`color-scheme` inline-style values off
  `el` (density/font-size variables are excluded) — round-trips with `applyTheme`, e.g.
  for persisting a user's theme choice to `localStorage`.

### `[data-ricdom-theme]` and page-wide scrollbar styling

`ricdom-ui.css` styles `::-webkit-scrollbar`/`scrollbar-color` scoped to
`[data-ricdom-theme]` and its descendants, using the `--ric-scrollbar-thumb(-hover)`
tokens above. **This changes the visual appearance of scrollbars for any element inside
whatever you call `applyTheme` on** — including elements that are not `ricdom/ui`
components — since the selector is attribute-scoped, not class-scoped. Override
`--ric-scrollbar-thumb`/`--ric-scrollbar-thumb-hover` yourself, or restyle
`::-webkit-scrollbar`/`scrollbar-color` with higher specificity, to opt out for a subtree.

---

## 9. CSS distribution

`ricdom/ui`'s styles ship as **one stylesheet** covering every component — there is no
per-component or per-instance CSS collection. This is a deliberate simplification over
v1, where forgetting to route a mount through the right composition point could produce
correctly-structured, silently-unstyled DOM that still passed DOM-shape tests. In v2, the
CSS either is loaded (everything is styled) or is not (nothing is, obviously) — there is
no partially-styled state to fall into by accident.

Load it either way:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ricdom@2/dist/ricdom-ui.css">
```

or, for a build-free `<script>`-only page that never adds a `<link>`:

```js
ricdomUI.injectStyles(); // idempotent — inserts a <style data-ricdom-role="styles"> once per Document
```

`injectStyles(doc?)` defaults to `document`, checks for its own marker attribute before
inserting anything (so calling it repeatedly, or once per component library user, is
harmless), and returns immediately if a matching `<style>` is already present. If neither
`<link>` nor `injectStyles()` has run by the time a stateful component is first `use()`d,
`ricdom/ui` logs one `console.warn` (not per-component, once total) pointing at both fixes
— unstyled output is possible, it is just never silent about it.

Selectors are simple single-class rules (`.ric-button`, `.ric-dialog__header`, …) — no
`!important`, no ID selectors, no compounded specificity beyond what a given component
strictly needs (e.g. `.ric-tabs__tab--active`). Overriding any rule from your own
stylesheet loaded after `ricdom-ui.css` (or `injectStyles()`, which runs at `use()` time)
needs no more specificity than the rule itself.

---

## 10. Components

Every component below is exported from `ricdom/ui`. "Stateless" means a plain function you
call directly; "stateful" means `app.use(create...())` first (§6). Every component accepts
the props type of the same name shown here (e.g. `uiButton`'s props are `UiButtonProps`) —
consult the type for the exhaustive, exact field list; this table summarizes intent and
the accessibility contract, which is FACT that is easy to miss by reading types alone.

### 10.1 Stateless — control

| Component | Notes |
|---|---|
| `uiButton(props)` | `variant`: `'default' \| 'primary' \| 'ghost'`. `size`: `'sm' \| 'md' \| 'lg'`, default `'md'` (`'md'` adds no size class — it *is* the core `.ric-button` size). Rest-spread contract (§10.5) |
| `uiInput(props)` | Text input, controlled. `value` is always emitted (even `''`) so it participates in `FORCE_REAPPLY`/the editing guard |
| `uiTextarea(props)` | `autoResize?: { minRows?, maxRows? }` grows/shrinks height to content, clamped, with overflow scrolling past `maxRows`. **IME note**: a controlled textarea can have its value overwritten mid-composition before IME confirmation — consider driving updates from `onchange` instead of `oninput` for CJK-heavy input |
| `uiCheckbox(props)` | Renders `<label><input type=checkbox>…</label>`; `checked`/`onchange` are isolated to the inner `<input>` (rest props go on the outer `<label>`) |
| `uiRadiobutton(props)` | `options: (string \| { value, label, ...attrs })[]`. Per-option extra attributes are forwarded to that option's `<label>`. **Known browser constraint**: `name` groups radios natively — give every independent group its own `name`, or they will merge |
| `uiSelect(props)` | Native `<select>`; `options: (string \| { value, label })[]`, optional non-selectable `placeholder` option |
| `uiRange(props)` | Slider + live value display; mouse wheel over the control steps the value by `step` |
| `uiColor(props)` | Accepts and emits either `#rrggbb` hex or `rgba(r,g,b,a)`, auto-detected from `value`; rgba mode adds an alpha slider |
| `uiSeparator(props)` | `<hr>` |
| `uiText(props)` | `variant`: `'default' \| 'muted' \| 'title' (h2) \| 'label' (<label>)` |
| `uiIcon(descriptor, opts?)` | See §12 |
| `uiMdPre(props)` | See §10.4 |
| `uiCodePre(props)` | See §10.4 |

`bindInput`/`bindTextarea`/`bindCheckbox`/`bindSelect`/`bindRange` are two-way-binding
sugar: `bindInput(s, 'name', options)` is exactly
`uiInput({ ...options, value: s.name, oninput: (ev) => { s.name = ev.target.value; } })`
— `options` is applied *before* the computed `value`/`on*` so it can never accidentally
override the binding.

### 10.2 Stateless — layout

| Component | Notes |
|---|---|
| `uiCol(props)` | Vertical flex container. No color/background of its own — inherits theme from an ancestor `applyTheme`d element |
| `uiRow(props)` | Horizontal flex container |
| `uiGrid(props)` | CSS grid. `columns`/`rows`: a number expands to `N` × `1fr`; a string passes through to `grid-template-*` as-is; `'auto-fit 200px'`/`'auto-fill 120px'` expand to `repeat(auto-fit, minmax(200px, 1fr))` |
| `uiPanel(props)` | Surface/background/border container. `layout: 'col' \| 'row'`. `disabled: true` sets the native `inert` attribute (disables focus, click, and text selection on every descendant) — dims via `.ric-panel[inert]` CSS, not inline style |

### 10.3 Stateful — dialog / popup / toast / tooltip / dropdown

All of these must be `app.use()`d (§6). All animate their open/close transitions on real
CSS (`animationend`/`transitionend`) with a 700ms `setTimeout` fallback in case the CSS
never loaded — a state transition (dialog closing, toast disappearing) always eventually
completes even without `ricdom-ui.css` present, it just skips the animation.

| Component | ARIA / a11y contract |
|---|---|
| `createDialog()` | Modal. `role="dialog"` + `aria-modal="true"` + `aria-labelledby`/`aria-describedby`. Opening moves focus to the first focusable descendant (visible-element–filtered); `Tab`/`Shift+Tab` are trapped inside; `Escape` closes and returns focus to the triggering element; every sibling of the portal is set `inert` while open. Three usage modes: uncontrolled + auto trigger (`triggerChildren` given → call returns a trigger `RicNode`), uncontrolled + your own trigger (`triggerChildren` omitted → call `dlg.open()`/`dlg.close()`), or controlled (`open`/`onClose(reason)` where `reason` is `'overlay' \| 'close-button' \| 'escape' \| 'api'`). `returnFocus` (§10.3.1) controls where focus goes on close |
| `createPopup()` | `role="menu"` dropdown. Trigger gets `aria-haspopup="menu"` + `aria-expanded`; every menu child is auto-wrapped with `role="menuitem"`. `ArrowUp`/`ArrowDown`/`Home`/`End` move focus among items; `Escape` closes and restores focus to the trigger. `openAt({x,y} \| MouseEvent)` opens at an arbitrary point instead of a trigger button. Menu-open state is exclusive with `createDropdown` within the same app (opening one closes any other open popup/dropdown) |
| `createToast()` | `toast.show(msg, { type, duration })` queues a notification; `type: 'error'` renders `role="alert"`/`aria-live="assertive"`, everything else `role="status"`/`aria-live="polite"`. `duration: 0` disables auto-dismiss (manual close only). Never steals focus |
| `createTooltip()` | `aria-describedby` links trigger ↔ popup; shown on hover or focus, dismissed on blur/mouseleave/`Escape`. `dir: 'auto' \| 'top' \| 'bottom' \| 'right' \| 'left'`, `'auto'` picks a direction that fits the viewport |
| `createDropdown()` | Generic popover (not a menu): trigger gets `aria-haspopup="dialog"` + `aria-expanded`; body content's semantics are entirely up to you. `label`+`chevron` mode or `icon` mode for the trigger. Shares position-flip logic and the exclusive-open registry with `createPopup` |

#### 10.3.1 FACT: dialog focus-return control (`returnFocus`)

By default, closing a dialog returns focus to whatever `document.activeElement` was
**at the moment it opened** (the APG-recommended behavior). This is not always what you
want: if the dialog was opened via `dlg.open()` from a non-focusable trigger (a `<span>`
click handler, say), "whatever happened to be focused right before that click" can be an
unrelated element (e.g. a number input the user was last typing into) — restoring focus
there can surface as spurious `focusin` events to app-level focus listeners.

- Uncontrolled mode: `dlg.open({ returnFocus })` (the auto-trigger button built from
  `triggerChildren` does not take this option — it is itself always a real, focusable
  `<button>`, so the default is always correct there).
- Controlled mode: pass `returnFocus` as a `DialogProps` field, alongside `open`/`onClose`.

`returnFocus` accepts:
- omitted (default): APG behavior, restore focus to the pre-open `activeElement`.
- `false`: do not restore focus at all. No element is focused programmatically — once the
  dialog's DOM is removed, the browser's own default (moving focus to `document.body`)
  takes over. This is "do nothing," not "explicitly focus `document.body`."
- an `Element`: restore focus to that element specifically, regardless of what was focused
  when the dialog opened.

### 10.4 Stateless — text

| Component | Notes |
|---|---|
| `uiMdPre(props)` | Renders a practical Markdown subset (headings, bold/italic, inline code, fenced code blocks with `` ``` ``/`~~~`, bullet and ordered lists with a `start` attribute, blockquotes, tables with alignment, horizontal rules, links, images) to a `RicNode` tree — no external parser dependency. `href` values with a `javascript:`/`data:`/`vbscript:` scheme (case-insensitively, after stripping control characters) are rendered without an `href` attribute at all; every other scheme (including custom ones like `app://`) passes through unmodified — this is a blocklist, not a whitelist, by design. `transformText(str)` post-processes plain-prose text nodes only (never code); `transformImageSrc(src, alt)` rewrites image sources before they're used. Both hooks fall back to the untransformed input and log `console.error` if they throw or return the wrong type — a broken hook degrades the rendered output, it does not break the page |
| `uiCodePre(props)` | `<pre><code>` for a code string or (`obj` prop) a `JSON.stringify`'d object. Always dark-themed (`--ric-code-bg`/`-fg`), regardless of the ambient theme — matching the general code-block convention. If `window.hljs` (highlight.js) is present, output is syntax-highlighted; if not, one `console.warn` per session explains how to enable it, and plain text is shown |

### 10.5 Rest-spread contract

Every stateless control/layout/text component that accepts arbitrary extra props (id,
`data-*`, `aria-*`, event handlers, etc.) spreads them onto the returned node in this
order: `...rest` first, then the component's computed `tag`/`class`/`data-ricdom-role`
(and, where the component wraps an inner element like `uiCheckbox`'s `<input>`, the
props that belong to that inner element are isolated and never merged into `rest`, so a
caller cannot accidentally shadow them). Passing `class` through `rest` extends rather
than replaces the component's base class (`mergeClass`), while any other computed field
you might collide with (`tag`, `data-ricdom-role`) always wins over what you pass.

### 10.6 Stateful — `createTweakPanel`

Also `app.use()`-registered (§6). Builds a parameter panel from a `data` object in three
tiers: `data` alone infers a row per property from its runtime type (Tier 1); `keys`
overrides individual rows or folders by property name (Tier 2); `rows`/a folder's
`keys[k].rows` append hand-built `RicNode`s (Tier 3).

#### FACT: `keys[k].get`/`set` — rows that don't read/write `data`

A `keys` entry may carry `get?: () => unknown` and/or `set?: (v: unknown) => void`. When
either is present, that row's value comes from `get()` (not `data[k]`) and writes go to
`set()` (not `data[k] = v`) — `data[k]` is never touched for that row. This is how you
expose a value that doesn't live in `data` at all (e.g. a center distance derived from a
module/teeth pair): give `keys` an entry for a property name that doesn't exist in `data`,
with a `get`. Rows declared this way (key present in `keys`, absent from `data`) render
*after* all of `data`'s own rows, in the order they appear in `keys`. If `get` (or `set`)
throws, `createTweakPanel` logs `console.error` and continues rendering (`get` falls back
to `undefined` for that render) — a broken hook degrades one row, it does not break the
panel.

#### FACT: `keys[k].rows` — per-folder Tier 3

A folder-shaped `keys` entry (the property's value is a plain object) may also carry its
own `rows: RicNode[]`, appended at the end of that specific folder's body — distinct from
the panel-level `rows` prop, which only ever appends to the very end of the whole panel.
Use this to put a hand-built row (e.g. a "reset this section" button) inside a particular
folder rather than at the panel's outer edge.

#### FACT: every leaf row carries `data-ricdom-role="tweak-row"` + `data-ricdom-tweak-key`

Every leaf row (number/range/checkbox/text/select/radiobutton/color, and the `get`/`set`
computed rows above) has its outer container marked `data-ricdom-role="tweak-row"` and
`data-ricdom-tweak-key="<path>"`, where `<path>` is the dot-joined key chain from the
panel's root (`"outer.inner"` for a property nested one folder deep) — a stable hook for
E2E tests or custom CSS that doesn't depend on row order or DOM structure. The checkbox row
is the one exception to the usual row shape: because `uiCheckbox` renders its own
`<label>` internally, the checkbox row has no separate `.ric-tweak-row__label` `<span>`
(every other row type does) — the role/key attributes are still present on its container.

---

## 11. `data-ricdom-role` registry

Every `ricdom/ui` component's rendered root (and several internal parts) carries a
`data-ricdom-role` attribute for stable E2E/CSS targeting that does not depend on class
names or DOM structure. Portal-root elements of dialog/popup/toast/tooltip/dropdown carry
this too, distinct from their trigger element's role (if any):

`button` `input` `textarea` `checkbox` `radiogroup` `select` `range` `color` `separator`
`text` `icon` `col` `row` `grid` `panel` `md-pre` `code-pre` — `dialog` `popup`
`popup-item` `toast` `tooltip` `dropdown` `dropdown-trigger` — `scroll-pane` `splitter`
`splitter-side` `splitter-main` `splitter-divider` `splitter-toggle` `collapse-box`
`accordion` `accordion-item` `accordion-header` `accordion-body` `accordion-title` `tabs`
`tabs-bar` `tabs-tab` `tabs-panel` `inline-menu` — `tweak-panel` `tweak-folder`
`tweak-folder-header` `tweak-folder-body` `tweak-row` (§10.6).

The core library itself uses `data-ricdom-role="portal"` for the auto-generated portal
sentinel (§7) and `data-ricdom-ref` (a different attribute) for `ref`-registered elements
(§5).

---

## 12. Icons

An icon is data, not markup: `{ v?: string; s?: number | null; p?: string | string[] }`
(`v` = viewBox, default `'0 0 24 24'`; `s` = stroke width, omitted → 2, a number → that
width, `null` → filled/no-stroke mode; `p` = one or more SVG path `d` strings).
`uiIcon(descriptor, opts?)` (`ricdom/ui`) turns a descriptor into an `<svg>` `RicNode` —
`opts.size` (default `'1em'`, follows the surrounding font size), `opts.label` (present →
`role="img"` + `aria-label`; absent → `aria-hidden="true"` for a purely decorative icon
next to text), `opts.spin` (adds a CSS spin animation), `opts.strokeWidth` (overrides
`descriptor.s`). Icon color always follows `currentColor`.

### FACT: never hand-write a descriptor's `p` value

Path data is opaque, dense, and easy to get subtly wrong in a way that renders "close
enough to look right" while missing a sub-path — this has shipped broken icons in
practice. Get a descriptor one of two ways:

- `import { check, chevronDown, /* … */ } from 'ricdom/icons'` — 36 bundled descriptors as
  individual named exports (tree-shakable: importing one does not pull in the other 35).
  `ICON_NAMES` maps the camelCase export name back to Lucide's original kebab-case name;
  `ICONS_BY_NAME` maps kebab-case → descriptor.
- `npx ricdom-icon <name> [--json] [--search TERM] [--names]` — returns a bundled
  descriptor instantly, or fetches and converts one from Lucide if not bundled. No
  `ricdom/icons` install required; paste the output directly into your own code. This is
  also how `ricdom/icons` itself is generated/verified.

`ricdom/icons` also exports `svgToDescriptor(svg)`, converting an arbitrary SVG string's
`circle`/`rect`/`polygon`/`line`/`ellipse`/`path` shapes into a single descriptor's path
data — the tool behind both the bundled set and the CLI's Lucide conversion.

`ricdom/icons` has **zero runtime dependency** on `ricdom` or `ricdom/ui` (data-only
package) and ships no IIFE build — a no-bundler consumer is expected to use the CLI and
paste the resulting literal directly into their own code, rather than adding another
`<script>` tag for 36 icons they mostly won't use.

Of the 36 bundled icons, all but `contrast` are original to this project (simple
geometric shapes in a Lucide-compatible style); `contrast` is derived from Lucide (ISC
license) — see `THIRD_PARTY_NOTICES.md` for full attribution.
