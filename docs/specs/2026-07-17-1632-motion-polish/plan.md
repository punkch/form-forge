# Motion & transition polish pass — Implementation Plan

> Source: approved plan at `~/.claude/plans/want-to-add-some-soft-hippo.md`.
> Shaping decisions live in `shape.md`; current-code anchors in
> `references.md`; binding conventions in `standards.md`; user-facing summary
> + manual scenarios in `user-guide.md`.

## Why

Form Forge's UI switches most state abruptly today: route changes are hard
cuts, the palette/Central drawers slide in on open but yank shut on close,
canvas nodes and library cards pop in/out with no transition, and every
PrimeVue overlay (dialogs, popovers, toasts) runs its untouched stock timing.
The user asked for "stunning motions for the transitions according to best UX
practices," scoped to all four motion surfaces, CSS-only (see `shape.md`).

## Engineering detail — the token layer

### 1. Motion token block — `src/styles/builder.css` `:root`

A storyboard-commented cluster appended to the existing `:root` block (already
in stylelint's `importFrom`, so no lint config change needed):

```css
--builder-motion-duration-xs: 80ms;    /* micro feedback: hover tints, press, tiny fade-outs */
--builder-motion-duration-s: 120ms;    /* small moves: chevrons, pane fades, item/overlay exits */
--builder-motion-duration-m: 160ms;    /* standard entrances: dialogs, popovers, list items, route enter */
--builder-motion-duration-l: 200ms;    /* large surfaces: drawers, panel folds, toasts — HARD CEILING for exits (e2e toBeHidden races) */
--builder-motion-duration-flash: 900ms;/* one-shot attention pulse (just-added card) */
--builder-motion-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   /* in-place property changes */
--builder-motion-ease-enter: cubic-bezier(0.16, 0.84, 0.28, 1); /* decelerate in */
--builder-motion-ease-exit: cubic-bezier(0.55, 0, 0.85, 0.36);  /* accelerate out */
--builder-motion-ease-pop: cubic-bezier(0.3, 1.4, 0.45, 1);     /* ~5% overshoot; transform-only, never opacity */
```

**Reduced motion:** replace the `.editor *` killswitch
(`builder.css`, previously ~L164-171) with a `:root`-wide blanket —
`*, *::before, *::after { transition-duration: 0.01ms !important;
animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
scroll-behavior: auto !important; }` under
`@media (prefers-reduced-motion: reduce)`. `0.01ms` (not `none`) keeps
`transitionend` firing so Vue `<Transition>` never wedges; it also kills
PrimeVue's literal durations, Sortable's inline FLIP, and `pi-spin`. The
now-redundant per-surface `no-preference` opt-in gates
(`FormEditorView.vue`, `CentralDrawerShell.vue`) are removed with their
keyframes; `AttachmentsDialog.vue`'s transform-strip block and
`TreeNodeCard.vue`'s JS `matchMedia` gate stay (they do more than zero
durations).

### 2. New `src/styles/motion.css` (imported in `main.ts` right after `builder.css`)

Storyboard header comment, two sections, all values via tokens:

**A. Named Vue transition classes** (shared app-wide): `route-*`,
`drawer-start-*`, `drawer-end-*`, `scrim-fade-*`, `pane-fade-*`.
`scrim-fade-leave-active` also sets `pointer-events: none` (a closing scrim
must never intercept the next click).

**B. PrimeVue retunes** (`html `-prefixed selectors, needed because PrimeVue's
runtime-injected CSS is unlayered and injected *after* bundled CSS — no
`cssLayer` in `main.ts`, deliberate — so overrides need `html ` for
specificity 0,1,1 over PrimeVue's 0,1,0): Dialog `scale(0.7)` → `scale(0.96)`
pop-in with `ease-pop`, dur-m enter / dur-s exit; overlay mask
`animation-duration` → dur-l; Drawer 300ms → dur-l enter/exit curves;
connected-overlay + Popover → dur-s enter / dur-xs exit; Toast → dur-l pop
enter, exit collapse capped at dur-l (down from stock 450ms). No `pt`, no
preset edits, preview child app untouched.

## Per-surface changes

| Surface | File(s) | Change |
| --- | --- | --- |
| Route switching | `src/App.vue` | `<RouterView v-slot="{ Component }">` + `<Transition name="route" mode="out-in">` (out-in mandatory — views are `flex:1` children; crossfade would stack). Enter: fade + 4px rise, dur-m/enter. Leave: fade only, dur-xs/exit. All views verified single-root. |
| Palette slide-over | `FormEditorView.vue` | Wrap scrim in `<Transition name="scrim-fade">`, drawer in `<Transition name="drawer-start">`; delete the old `palette-*-in` keyframes. |
| Central drawer | `FormEditorView.vue` + `CentralDrawerShell.vue` | Wrap in `<Transition name="drawer-end">` in the PARENT (keeps directly-mounted component specs synchronous); delete the old `central-drawer-in` keyframe. |
| Library Central drawer | `FormLibraryView.vue` | Same `drawer-end` wrapper. |
| Canvas nodes | `NodeList.vue` | `target=".node-list"` on `VueDraggable` (host becomes `.node-list-host`, keeps testids + empty-state visuals); inner `<TransitionGroup tag="div" name="node-item" class="node-list">` around the keyed `TreeNodeCard`s. Enter: fade + 4px, dur-m/enter. Leave: fade, dur-s/exit, `position:absolute; width:100%; pointer-events:none` (list `position:relative`). `node-item-move` dur-m/standard for sibling reflow. Sortable `:animation="150"` untouched. **Fallback if drag regresses:** revert to plain `v-for` + enter-only keyframe. |
| Choice rows | `ChoicesSection.vue` | Enter-only `choice-row-in` keyframe (dur-s/enter) — index keys forbid leave/move. |
| Library cards | `FormLibraryView.vue` | `<TransitionGroup tag="ul" name="card" class="form-list">` (keys = `record.id` / `record.formId`, already stable). Enter fade+rise dur-m; leave fade+scale(0.98) dur-s absolute; `card-move`. No `appear`. Fix `.form-card` hover snap: add border-color transition dur-xs. |
| Tablet pane swap | `FormEditorView.vue` | `<Transition v-else name="pane-fade" mode="out-in">` around the PropertyPanel/PreviewPanel alternation (opacity-only, dur-s in / dur-xs out). Canvas keeps `v-show` (kept-alive engine state — do not wrap). |
| Desktop rail fold | `FormEditorView.vue` | Token-ify the existing `grid-template-columns` transition; drop the `no-preference` wrapper; keep the `body.is-panel-resizing` suspension. No second animation on the panels themselves. |
| PropSection collapse | `PropSection.vue` | Replace `v-show` with a class-toggled grid fold: `.prop-section-fold` (`grid-template-rows` 1fr↔0fr, dur-m) > `.prop-section-fold-clip` (`overflow:hidden; min-height:0` — padding-free layer required) > `.prop-section-body`. Delayed `visibility:hidden` on collapsed removes content from the a11y tree/tab order. No `<Transition>` → stays synchronous for tests. Chevron + the old local reduced-motion block token-ified/removed. |
| TranslationGrid | — | **Skip** (table rows in a modal, filter-toggle churn; the dialog itself gets motion from the Dialog retune). |
| Micro-interactions | `EditorTabs.vue`, `SaveIndicator.vue`, `SplitHandle.vue`, `TreeNodeCard.vue`, `builder.css`, `AttachmentsDialog.vue` | Token-ify existing literals; add hover/state color transitions (tabs, save-indicator tint glide); `just-added-flash` → flash token; AttachmentsDialog drill + `:global` position-top rules → tokens. Buttons: skip (PrimeVue theme already transitions them). |

## Test impact

- **Component specs: exactly one change** — `tests/component/property-panel.spec.ts`:
  replace the two `display: none` assertions with fold-class assertions
  (`.prop-section-fold.collapsed`) — still synchronous (class toggle, not
  `<Transition>`). All drawer/library specs are unaffected (the new
  `<Transition>`s live in the parent views; no component spec mounts
  App/FormEditorView/NodeList directly). Considered and rejected a global
  Transition stub — it would change semantics for the existing
  AttachmentsDialog `vi.waitUntil` test.
- **e2e: no spec changes expected.** All exits stay ≤200ms (inside auto-retry
  comfort for every `toBeHidden` site); the scrim `pointer-events: none` fix
  protects `layout.spec.ts`. Watch `editor.spec.ts` drag flows after the
  `NodeList` `target`-prop restructure (testids preserved on the host
  element).
- **stylelint:** tokens resolve via `builder.css`'s existing `importFrom`
  entry; `motion.css` falls under the lint glob. No `generated/*`, preset,
  version-pin, or `builder-contrast.css` changes → all gates stay green.

## Sequencing

One conventional commit per step (no `Co-Authored-By` trailer):

1. `feat(styles): add motion tokens and global reduced-motion guard`
2. `feat(styles): retune primevue overlay transitions to motion tokens`
   (+ `motion.css`, `main.ts` import)
3. `feat(shell): animate route and pane switches`
4. `feat(editor): animate drawer open and close`
5. `refactor(properties): animate section collapse via grid rows`
   (+ spec update, atomic)
6. `feat(canvas): animate node and card list changes` (riskiest — the
   `NodeList` `target`-prop refactor lands last among feature commits;
   fallback documented above)
7. `feat(polish): micro-interaction transitions`

Process per the established delivery flow: this spec folder is created at
implementation start; implement via a dynamic Workflow with parallel agents
(cheap models for mechanical per-surface stages, per the session-model
memory); then update README Features, `docs/product/roadmap.md`, and
CLAUDE.md (motion tokens are a new convention worth an index entry).

## Verification

1. `pnpm lint` (stylelint token resolution) → `pnpm typecheck` → `pnpm test`
   (only the property-panel spec diff expected) → `pnpm test:e2e` (watch
   layout/editor/translations specs). Note the repo's e2e filter syntax is
   `pnpm test:e2e <filter>` — no `--`.
2. **agent-browser manual pass** (`pnpm dev`), logged to `docs/verification/`:
   - Route nav library ↔ editor ↔ settings ↔ full preview (out-in fade, no
     stacking flash).
   - Palette drawer open AND close at ~1100px (slide + scrim both
     directions); Central drawer open/close; library Central drawer; help
     drawer retiming.
   - Canvas: add (rise + flash + sibling glide), delete (fade + move), drag
     reorder, **drag palette → empty group, between nested containers, into
     empty root** (the critical paths of the `target` refactor).
   - Choices add/remove; PropSection fold (no padding jump; collapsed content
     untabbable).
   - Overlays: New Form dialog pop-in, Selects, menus, toasts enter/leave.
   - Tablet ~900px pane cross-fade.
   - **Reduced-motion emulation via CDP**: everything effectively instant on
     ALL routes (not just `.editor`), drawers still close correctly (no
     wedged leave state).
   - Dark + high-contrast spot-check (one dialog, one drawer) for cascade
     accidents.
3. `/interface-craft` critique pass on the resulting motion, then
   `/code-review` and fix findings before the final commit.
