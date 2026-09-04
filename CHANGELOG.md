# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0-alpha.2] — not yet published

Ten fixes/additions from feedback on the second pilot migration (Trend Guard, an Electron
app).

### Fixed

- **`createPopup` trigger-path horizontal clamp**: opening a popup from a trigger near the
  right edge of the viewport could render the body partially off-screen — the trigger path
  only ever positioned at `rect.left`, with no fallback, while `openAt` already clamped
  correctly. Position calculation (below/above flip, horizontal placement) is now shared
  via `internal/popupPosition.ts`'s `computeAnchoredLeft`, used by both `createPopup`'s
  trigger path and `createDropdown`: fits at `rect.left` when possible, aligns to the
  trigger's right edge when it doesn't, and falls back to `clampLeft` only if the content
  is wider than the viewport.
- **Core: portal `ref`s available one render late**: `createApp`'s render cycle collected
  `data-ricdom-ref` elements (`registerRefs`) *before* patching the portal, so a `ref`
  inside a dialog/popup/toast — anything mounted through `renderPortal()` — wasn't visible
  via `app.refs.get()` until the *next* render. `registerRefs` now runs after the portal
  patch, and collects from both `target` and an external `portalTo` element.
- **`wrapMenuItem` (popup menu items) dropped non-string `class`**: an array- or
  boolean-map-form `class` on a menu item was silently discarded instead of being merged
  with `.ric-popup__item`. Now uses the same `mergeClass` every other component uses.
- **`.ric-popup__item` icon/text vertical alignment**: the item wrapper's
  `display: flex !important` had no `align-items`, so it fell back to the CSS default
  (`stretch`) — an icon of fixed height next to text could appear vertically off-center.
  Added `align-items: center` and `gap`. (`.ric-dropdown`/`.ric-inline-menu` don't
  auto-wrap arbitrary content the way `createPopup` does, so they weren't affected.)

### Added

- **`uiRow`/`uiCol`: `gap` prop**: v1's `ui_row({ gap })` was a first-class prop; in v2 it
  fell through the rest-spread and became a stray `gap` DOM attribute instead of
  `style.gap` — a silent regression hit in 25+ places during the pilot. `gap?: string |
  number` (a number is treated as px) now writes to `style.gap`, matching `uiGrid`'s
  existing `gap`.
- **`createPopup`: object-form `trigger`**: `trigger` now also accepts
  `{ icon?, label?, ghost?, size?, class?, style? }` in addition to the existing
  `RicNode | RicNode[]` form — v1's icon+ghost round trigger button couldn't be
  reproduced through the plain-children form, so consumers were overriding it with
  structural CSS selectors. The object form renders a `uiButton`-equivalent look
  (`.ric-button` + `--ghost`/`--sm`/`--lg`). `aria-haspopup`/`aria-expanded` are set either
  way. `createDropdown`'s existing `label`/`icon`/`ghost` props already cover the same
  ground for that component.
- **`createTabs`: panel-less mode**: if no `item` in `items` has `children`, `createTabs`
  renders no `tabpanel` and omits `aria-controls` from the tab buttons — for
  segmented-control-style usage where tabs don't drive a content panel. Any single item
  with `children` restores the previous (panel) behavior for all items.
- **`createFocusWhen`** (`ricdom/ui`), the v1 `focus_when` successor: a stateful helper
  (`app.use(createFocusWhen())`) called as `fw(refName, condition)` during `render` that
  moves focus to `app.refs.get(refName)` on the false→true rising edge of `condition`,
  once that render has committed (implemented via a synchronous `host.app.nextRender()`
  call during `render`, which resolves at the end of that same render per the `nextRender`
  contract). Continuing `true` doesn't refocus; a missing ref logs one `console.warn` in
  dev and does nothing otherwise. One instance tracks each `refName`'s previous condition
  independently, so a single `createFocusWhen()` can drive multiple refs. Fills a gap
  `createDialog`'s own initial-focus-first-focusable behavior doesn't cover: focusing a
  *specific* element, or focusing outside of a dialog-open event entirely.
- **`data-ricdom-role` on portal sub-parts**: dialog (`dialog-overlay`, `dialog-header`,
  `dialog-body`, `dialog-footer`, `dialog-close`), popup/dropdown (`popup-overlay`,
  shared), toast (`toast-item`, `toast-close`) — extending the existing per-component root
  role to their sub-parts for stable E2E/CSS targeting. (Tooltip's single sub-part already
  carried `data-ricdom-role="tooltip"`.)

### Changed

- Core gzip size: **5,107B** (was 5,091B), still under the 5,120B budget. The only core
  change is the portal-ref fix above; the registerRefs implementation was written to
  minimize the increase.
- SPEC.md: documents the popup/dropdown position rule (fit → right-align to trigger →
  clamp), the portal-ref collection timing, `gap`, the new `data-ricdom-role`s, the two
  `trigger` forms, panel-less tabs, `createFocusWhen`, and an Electron-specific footnote:
  give portal elements `-webkit-app-region: no-drag` (`[data-ricdom-role="portal"] {
  -webkit-app-region: no-drag; }`) or interactive UI mounted under a draggable
  `-webkit-app-region: drag` titlebar region becomes unclickable.

## [2.0.0-alpha.1] — not yet published

Five fixes/additions from feedback on the first pilot migration (歯車DXFジェネレーター).

### Added

- **`createApp(target, state, render, { setup })`**: `setup(app)` runs once, immediately
  before the first render (after the app and its portal exist). Anything registered with
  `app.use()` inside `setup` is already attached by the time the first `render` call
  references it, removing the "return a placeholder until `use()` has run, then force a
  render" two-step that was otherwise required on first render. `setup` is skipped for a
  NOOP app, and an exception thrown by `setup` is caught, logged via `console.error`, and
  does not prevent the first render.
- **`createTweakPanel`: `keys[k].get`/`keys[k].set`**: a `keys` entry can now read/write a
  row through `get()`/`set()` instead of `data[k]` — `data[k]` is never touched for that
  row, and the key doesn't even need to exist in `data` (useful for a value derived from
  other fields, e.g. a center distance computed from a module/teeth pair). Rows declared
  this way render after `data`'s own rows, in `keys` order. A throwing `get`/`set` is
  caught and logged, degrading only that row.
- **`createTweakPanel`: `keys[k].rows`**: a folder-shaped `keys` entry can carry its own
  `rows: RicNode[]`, appended at the end of *that* folder's body — the existing top-level
  `rows` prop only ever appends to the end of the whole panel.
- **`createTweakPanel`: stable row hooks**: every leaf row (number/range/checkbox/text/
  select/radiobutton/color, and the new `get`/`set` rows) carries
  `data-ricdom-role="tweak-row"` and `data-ricdom-tweak-key="<dot.path>"` for E2E/CSS
  targeting independent of row order.
- **`uiButton({ size })`**: `'sm' | 'md' | 'lg'`, default `'md'` (adds `.ric-button--sm`/
  `.ric-button--lg`; `'md'` is the core button's own size, so it adds no class).
- **`createDialog`: `returnFocus`**: `dlg.open({ returnFocus })` (uncontrolled) or
  `DialogProps.returnFocus` (controlled) controls where focus goes when the dialog closes.
  Default is unchanged (APG behavior — restore to the pre-open `activeElement`); `false`
  skips focus restoration entirely (the dialog's DOM is simply removed, and the browser's
  own default takes over — no explicit `document.body` focus call); an `Element` restores
  focus there specifically. Fixes a case where opening a dialog from a non-focusable
  trigger returned focus to an unrelated element that merely happened to be focused right
  before the click.

### Changed

- Core gzip size: **5,091B** (was 5,030B), still under the 5,120B budget — the increase is
  entirely the new `setup` option.
- SPEC.md: added a FACT that a hidden/unfocused tab throttles `setTimeout` (not just
  `requestAnimationFrame`), so the scheduler's 200ms backstop can take up to ~1s there;
  code needing an immediate render regardless of tab state should call `app.renderNow()`.

## [2.0.0-alpha.0] — not yet published

Initial alpha of ricdom 2, a from-scratch TypeScript successor to
[RicDOM v1](https://github.com/miyoshi-tec/RicDOM). Not source-compatible with v1 — see
[Breaking changes from v1](#breaking-changes-from-v1) below if migrating an existing app.

### Added — Core (`ricdom`)

- `createApp(target, state, render, options?)`: resolves `target` (CSS selector or
  `Element`) and performs a synchronous first render. An unresolved selector is retried
  once after `DOMContentLoaded`; if it still cannot be resolved, or any argument is
  invalid, `createApp` logs `console.error` and returns a type-safe NOOP `App` instead of
  throwing.
- Node representation: `{ tag, class, style, children, ref, key, island, ...attrs }`,
  fully typed by tag name (`RicElementNode`). `tag` is required at the type level.
- Diffing: position-based and key-based reconciliation, `FORCE_REAPPLY` for
  `value`/`checked`/`selected`/`scrollTop`/`scrollLeft`, an editing guard that exempts a
  focused input/textarea/select's `value` from `FORCE_REAPPLY`, `<select>` value/option
  construction-order handling, SVG namespace inheritance, `data-ricdom-ref` for named
  element references.
- Islands: `island: true` elements are built once and never diffed again — an explicit
  opt-out from ricdom's diffing for externally-managed subtrees (e.g. a `<canvas>` driven
  by your own render loop).
- Reactivity: a shallow `Proxy` over `state` (top level, plus one level into
  object-valued properties). `state.ignore` is never tracked. In non-production builds,
  assigning through an untracked (two-or-more-levels-deep) path logs `console.warn`
  explaining the shallow-copy pattern, without changing the assignment's effect.
- Scheduler: every render request arms both `requestAnimationFrame` and a
  `setTimeout(200ms)` backstop; whichever fires first renders, covering environments where
  rAF does not fire reliably (backgrounded tabs, Electron background throttling, kiosk
  transitions).
- `app.renderNow()` (synchronous, forced) and `app.nextRender()` (a `Promise` that
  resolves on the next *scheduled* render's completion — it does not resolve if nothing is
  pending).
- `app.refs`: a `ReadonlyMap<string, Element>` of every `ref`-named element in the last
  render.
- `app.use(part)`: registers a stateful component (see below), returning it unchanged.
- `app.unmount()`: disposes all registered parts and stops future renders/timers.
- Component contract (`app.use(part)`): `UsePart` (`attach(host)` / `dispose()` /
  `renderPortal()`), where `Host = { notify(), portal, app }` is only ever handed to a
  part through `use()` — a part called without going through `use()` has no way to
  request a render or a place to portal into, and detects this itself (see
  `ricdom/ui`, below).
- Portals: `createApp` auto-generates a `<div data-ricdom-role="portal">` as the last
  child of `target` (an `island: true`, stably-keyed sentinel node, so it is never
  mis-diffed even when the rest of the tree's visible/invisible shape varies render to
  render) and, each render, collects every registered part's `renderPortal()` output into
  it. `options.portalTo` replaces the auto-generated portal with an element you supply.
  Each `createApp` instance owns exactly one portal — there is no cross-app portal
  registry.
- Build: tsup produces ESM (`dist/index.js`), CJS (`dist/index.cjs`), and an IIFE
  (`dist/ricdom.iife.min.js`, global `ricdom`) plus a single `.d.ts`. Consumers never need
  a build step. Core gzip size: **5,030B**, under the 5,120B budget.
- Tests: Vitest (jsdom) unit tests, type-level tests (`expect-type`/`@ts-expect-error`),
  and real-browser tests (`@vitest/browser` + Playwright/Chromium) covering rAF-backstop
  rendering, `<select>` construction order, the editing guard against real `badInput`, and
  IIFE-build smoke tests. GitHub Actions CI runs typecheck → unit → browser → build on
  every push/PR.

### Added — `ricdom/ui`

- **Theming**: `applyTheme(el, { theme, density, fontSize })` writes `--ric-*` CSS custom
  properties (and the native `color-scheme` property, so native controls — scrollbars,
  `<select>`, checkboxes, date pickers — follow light/dark automatically) as inline style
  on any element — themes are per-element, not global, so multiple differently-themed
  mounts can coexist on one page. Five bundled themes (`light`/`dark`/`teal`/`cyber`/
  `aqua`), three densities, three font sizes, or a fully custom `Record<string,string>`.
  `createTheme(base, overrides)` and `exportTheme(el)` round-trip a theme for persistence.
  `applyTheme` also marks its element `data-ricdom-theme`, which scopes the page-wide
  scrollbar styling described below.
- **CSS distribution**: one stylesheet (`ricdom-ui.css`) covers every component — no
  per-instance CSS collection to route through correctly. Load it via `<link>` or, for a
  build-free `<script>`-only page, `injectStyles()` (idempotent, warns once if a
  stateful component is used before either has happened).
- **Component contract**: `Component<P>` (`(props) => RicNode` + `attach(host)` +
  `dispose()` + optional `renderPortal()`), the `ricdom/ui`-side shape of the core's
  `UsePart`. Every stateful component below detects being called without `app.use()` and
  logs one `console.error` (not spammed on every call) instead of doing anything silently
  wrong.
- **Stateless controls** (plain functions, no `app.use()` needed): `uiButton`, `uiInput`,
  `uiTextarea` (`autoResize`), `uiCheckbox`, `uiRadiobutton`, `uiSelect`, `uiRange`,
  `uiColor` (hex/`rgba()` auto-detected), `uiSeparator`, `uiText` (`variant`), `uiIcon`
  (see Icons, below). All follow a rest-spread contract: extra props merge onto the
  rendered root without being able to override the component's own computed attributes,
  and (where a component wraps an inner element, like `uiCheckbox`'s `<input>`) the props
  that belong to that inner element never leak into the outer wrapper's rest spread.
- **`bindInput`/`bindTextarea`/`bindCheckbox`/`bindSelect`/`bindRange`**: two-way-binding
  sugar over a state property, e.g. `bindInput(s, 'name', options)`. Caller-supplied
  `options` is always applied before the computed `value`/`on*` handlers, so it can never
  silently override the binding.
- **Layout**: `uiCol`, `uiRow`, `uiGrid` (`columns`/`rows` accept a number, a raw CSS
  track string, or `'auto-fit 200px'`/`'auto-fill 120px'` shorthand), `uiPanel`
  (`layout: 'col' | 'row'`, `disabled` sets the native `inert` attribute).
- **Text**: `uiMdPre` (a practical Markdown subset — headings, bold/italic, inline code,
  fenced code blocks with `` ``` ``/`~~~`, ordered lists with a `start` attribute,
  bulleted lists, blockquotes, aligned tables, horizontal rules, links, images —
  `transformText`/`transformImageSrc` hooks, and a blocklist, not a whitelist, for
  dangerous `href` schemes so custom protocols like `app://` still work), `uiCodePre`
  (code or `JSON.stringify`'d object display, always dark-themed, optional
  `window.hljs`-powered syntax highlighting if present).
- **Stateful dialog/popup/toast/tooltip/dropdown** (`app.use()` required): `createDialog`
  (modal, `role="dialog"` + `aria-modal`, focus trap, `Escape`-to-close with focus
  restoration, background `inert`, controlled/uncontrolled modes, optional auto-rendered
  trigger), `createPopup` (`role="menu"` dropdown menu with arrow-key/Home/End navigation
  and automatic `role="menuitem"` wrapping, plus `openAt({x,y})` for non-trigger-anchored
  opening), `createToast` (`role="status"`/`role="alert"` queue, never steals focus),
  `createTooltip` (`aria-describedby`, hover/focus-triggered, viewport-aware direction),
  `createDropdown` (a generic Popover — `aria-haspopup="dialog"` — for label/icon-mode
  triggers whose body semantics are entirely up to the caller; shares position-flip and
  exclusive-open logic with `createPopup`). All animate open/close on real CSS events
  (`animationend`) with a 700ms `setTimeout` fallback, so a state transition always
  eventually completes even if `ricdom-ui.css` never loaded.
- **Stateful composite components** (`app.use()` required): `createSplitter`
  (drag-to-resize two-pane layout, `role="separator"` + `aria-valuenow/min/max`, arrow-key
  resizing, collapsible), `createScrollPane` (auto-follow-to-bottom/top scroll region for
  chat/log UIs, with a `threshold` for "is the user currently looking elsewhere"),
  `createCollapseBox` (an animated open/close container primitive; supports multiple
  simultaneous keyed instances for sparse-list animation; completion is detected via
  `transitionend` with a 700ms `setTimeout` fallback, since a dynamic per-instance
  height/width cannot be expressed as a fixed `@keyframes` animation), `createAccordion`
  (`<button aria-expanded aria-controls>` header + `role="region"` panel, closed panels
  get `hidden` to drop out of the accessibility tree while keeping their CSS open/close
  transition working), `createTabs` (`role="tablist"/"tab"/"tabpanel"`, roving tabindex,
  arrow-key/Home/End navigation, controlled or uncontrolled active-tab state).
- **`uiInlineMenu`**: a lightweight, portal-free absolutely-positioned popover (a plain
  function — no `app.use()`), for cases where a full `createPopup` instance per row would
  be too heavy (e.g. an ellipsis menu on every row of a long list). Warns in development
  if its parent element isn't a positioned ancestor.
- **`createTweakPanel`**: a dat.GUI-style parameter panel. Pass `data` alone for full
  auto-generated rows (row type inferred from each value's type — booleans → checkbox,
  numbers → number input, hex/`rgba()` strings → color picker, nested plain objects →
  collapsible folders); `keys` partially overrides individual rows (type/min/max/step/
  options/label/open); `rows` appends hand-built `RicNode`s after the generated ones. The
  editing guard (core) means typing a decimal into a number row survives an unrelated
  re-render mid-keystroke without being clobbered.
- **`ricdom/icons`**: 36 bundled icon descriptors (`{ v?, s?, p }`) as individual,
  tree-shakable named exports (`import { check, chevronDown } from 'ricdom/icons'`),
  Lucide-style kebab-case names converted to camelCase (`chevron-down` → `chevronDown`).
  `ICON_NAMES` (camelCase → kebab) and `ICONS_BY_NAME` (kebab → descriptor) provide the
  reverse/direct lookups. `svgToDescriptor(svg)` converts an arbitrary SVG's
  `circle`/`rect`/`polygon`/`line`/`ellipse`/`path` shapes into descriptor path data.
  `IconDescriptor` (used by `ricdom/icons`) and `uiIcon`'s descriptor parameter (
  `ricdom/ui`) are the same type — `ricdom/ui` imports it type-only, with zero runtime
  dependency on `ricdom/icons`.
- **`ricdom-icon` CLI** (`npx ricdom-icon <name> [--json] [--search TERM] [--names]`):
  returns a bundled descriptor instantly, or fetches and converts one from Lucide if not
  bundled — the tool a no-bundler consumer uses to get an icon's path data without ever
  hand-writing it. stdout carries only the requested data; diagnostics go to stderr.
- **`data-ricdom-role`** is set on every component's rendered root — including the portal
  root of `createDialog`/`createPopup`/`createToast`/`createTooltip`/`createDropdown` —
  as a stable selector for E2E tests and CSS overrides, independent of class names or DOM
  structure. See [SPEC.md §11](docs/SPEC.md#11-data-ricdom-role-registry) for the full
  list of values.
- Build: `dist/ui.js`/`dist/ui.cjs` (`ricdom/ui` subpath, ESM+CJS+`.d.ts`) and
  `dist/ricdom-ui.iife.min.js` (global `ricdomUI`) — `ricdom/ui` has **zero runtime
  dependency on `ricdom`** (only type-only imports of `RicNode`/`App`/`Host`), so the two
  IIFE builds are a logical pairing, not a bundler-level dependency.

### Fixed

- A portal sentinel node lacking a stable `key` could be misdiffed as a different element
  when the surrounding render's top-level visibility toggled between a node and
  `null`/`false` across renders (the sentinel's array index would shift), causing the
  cached portal DOM reference to become detached from the live document while later
  `renderPortal()` patches kept targeting it. Fixed by giving the portal sentinel a fixed
  `key`, which routes it through key-based (not position-based) reconciliation.

### Changed

- License: MIT, for the whole v2 codebase, from the first commit — a clean slate that
  does not inherit v1's noncommercial-with-exceptions license.

### Breaking changes from v1

If you're migrating an existing [RicDOM v1](https://github.com/miyoshi-tec/RicDOM) app,
expect all of the following to require code changes — there is no source compatibility:

- **Naming**: snake_case → camelCase everywhere (`create_RicDOM` → `createApp`,
  `create_ui_dialog` → `createDialog`, `ctx` → `children`, `data-ric-role` →
  `data-ricdom-role`, …).
- **`createApp(target, state, render)`** takes `render` as a required third argument,
  never nested inside `state`.
- **Stateful components require `app.use()`.** v1's implicit wiring (assigning a
  factory's return value to a specific place in `state` silently activated a hidden Proxy
  trap) does not exist in v2 — every stateful component (dialog/popup/toast/tooltip/
  dropdown/splitter/scrollPane/collapseBox/accordion/tabs/tweak panel) must be registered
  via `app.use(create...())` first.
- **`style` is object-only.** v1's string/array/object style forms are reduced to one:
  a plain `Record<string, string | number>`.
- **Islands are explicit**: `island: true`, not "omit `children`."
- **Portals are per-app**, not routed through a page component — there is no v2
  equivalent of v1's `create_ui_page`. `applyTheme(el)` applies directly to any element;
  CSS ships as one stylesheet regardless of what wraps a given mount.
- **`createPopup` is menu-only** (`role="menu"`); v1's combined label/icon/chevron
  dropdown modes are `createDropdown` in v2.
- Checked/selected values are passed as plain booleans — v2's core always assigns
  `checked`/`selected` as DOM properties, so the `1`/`0` numeric-conversion workaround v1
  components needed is gone.
