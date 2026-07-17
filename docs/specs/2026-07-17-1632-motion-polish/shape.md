# Motion & transition polish pass — Shaping Notes

> Shaped 2026-07-17 directly from a live `/interface-craft` engagement — not
> promoted from `docs/specs/backlog/` (that folder was retired 2026-07-16 per
> CLAUDE.md; this is a fresh proposal, approved plan at
> `~/.claude/plans/want-to-add-some-soft-hippo.md`).
> **UI-polish-only** re-shaping — no change to core, persistence, or any
> data model; touches only CSS + a handful of template wrappers.

## Scope

The user asked for "stunning motions for the transitions according to best UX
practices." Four surfaces, all in scope:

1. **Overlays & drawers** — dialogs, popovers, toasts, the palette slide-over,
   the editor and library Central drawers, the (retired) per-surface
   reduced-motion gates.
2. **View switching** — route changes (`App.vue`'s bare `<RouterView />`), the
   tablet PropertyPanel/PreviewPanel swap, the desktop rail fold.
3. **Lists & canvas** — canvas node add/remove/reorder (`NodeList.vue`),
   choice rows (`ChoicesSection.vue`), the library card list
   (`FormLibraryView.vue`).
4. **Micro-interactions** — hover/press tints, the save-indicator glide, the
   "just added" canvas-card flash, `PropSection`'s collapse.

`TranslationGrid` is explicitly **out of scope** (see Key design decisions).

## Decisions

### Implementation approach (decided with the user, 2026-07-17)

**CSS-only** — Vue `<Transition>` / `<TransitionGroup>` plus hand-tuned
duration/easing custom properties. **No new runtime dependency**: `motion-v`
and `vue-auto-animate` were both considered and rejected — the app already has
everything it needs (Vue 3.5 built-in transition primitives, `vue-draggable-plus`
for reorder) and CSS transitions are cheap, inspectable, and trivially killed by
`prefers-reduced-motion` with zero JS branching. This also keeps the change
inside the repo's existing style-lint/theme-drift gates instead of opening a
new dependency-pin surface.

### Key design decisions

- **One motion-token block, one place.** All new durations/curves live as
  `--builder-motion-*` custom properties in `src/styles/builder.css`'s
  existing `:root` block (already in stylelint's `importFrom` list — see
  `references.md`), so every new transition resolves under
  `value-no-unknown-custom-properties` with zero extra lint config. This is
  the Interface Craft "storyboard discipline" adapted from its native
  React/Framer-Motion vocabulary (named motion variants, no magic numbers in
  component code) to a CSS-token vocabulary: four duration beats (xs/s/m/l)
  and four named curves (standard/enter/exit/pop) instead of JS spring
  configs.
- **New `src/styles/motion.css`**, imported in `main.ts` right after
  `builder.css`. Two sections: (A) named Vue `<Transition>` classes shared
  app-wide (`route-*`, `drawer-start-*`, `drawer-end-*`, `scrim-fade-*`,
  `pane-fade-*`); (B) `html `-prefixed retunes of PrimeVue's own shipped
  transition classes (Dialog, overlay mask, Drawer, connected-overlay/Popover,
  Toast). No `pt`, no preset edits — the preview child app's isolated PrimeVue
  install is untouched.
- **Global `prefers-reduced-motion` blanket**, replacing the narrower
  `.editor *` killswitch. A `:root`-wide `*, *::before, *::after` rule zeroes
  every `transition-duration`/`animation-duration` app-wide (route changes,
  library cards, PrimeVue overlays — not just the editor). `0.01ms`, not
  `none`: this keeps `transitionend` firing so Vue `<Transition>` leave hooks
  never wedge, and `!important` beats PrimeVue's runtime-injected literals and
  Sortable's inline FLIP styles. The now-redundant per-surface
  `@media (prefers-reduced-motion: no-preference)` opt-in gates
  (`FormEditorView.vue`, `CentralDrawerShell.vue`) are removed along with their
  keyframes. Two precedents are kept because they do more than zero a
  duration: `AttachmentsDialog.vue`'s transform-strip block and
  `TreeNodeCard.vue`'s JS `matchMedia` gate on `scrollIntoView` behavior.
- **Choice rows get an enter-only keyframe, not a `TransitionGroup`.**
  `ChoicesSection.vue` keys rows by array index (`v-for="(choice, i)" :key="i"`)
  — a `TransitionGroup` would animate the wrong row on delete (the index that
  moves, not the choice that was removed). An `animation`-only entrance
  (`choice-row-in`) sidesteps identity entirely: no leave/move semantics are
  needed or attempted.
- **`TranslationGrid` is skipped**, deliberately. It's table rows inside a
  modal with churn driven by a filter toggle (show/hide untranslated rows),
  not a natural fit for row-level enter/leave; the modal itself already gets
  motion from the Dialog retune in `motion.css` section B. Revisit only if a
  future spec reshapes that grid.
- **`PropSection` swaps `v-show` for a grid-rows fold**, not a `<Transition>`.
  A `.prop-section-fold` wrapper animates `grid-template-rows: 1fr → 0fr`
  (clipped by an inner `overflow: hidden` layer) instead of toggling
  `display: none`. This is a plain class toggle — no `<Transition>` component
  — so it stays synchronous under Vitest/happy-dom (no CSS engine, transitions
  compute to 0 duration) and needed only a class-name assertion swap in the
  one affected spec, not a `vi.waitUntil` conversion. Collapsed content also
  gets a delayed `visibility: hidden` so it drops out of the accessibility
  tree and tab order once the fold finishes, not before.
- **`NodeList`'s `TransitionGroup` composes with `vue-draggable-plus` via its
  `target` prop**, rather than replacing Sortable-driven reordering with pure
  Vue transitions (or vice versa). Verified in the library's dist typings and
  bundle: `target` lets `VueDraggable` point Sortable at a *child* element
  (`$el.querySelector`) instead of animating its own direct children, so the
  `<TransitionGroup>` owns enter/leave/move for the node cards while Sortable
  still owns drag-and-drop on the same DOM. Documented fallback if drag
  regresses during verification: revert to a plain `v-for` plus the
  choice-row's enter-only keyframe pattern.

## Context

- **Source plan:** approved implementation plan at
  `~/.claude/plans/want-to-add-some-soft-hippo.md` (full exploration findings,
  motion inventory, per-surface table, test-impact analysis, sequencing) — the
  content source of truth for this spec folder's `plan.md`.
- **No backlog stub or review Artifact** for this pass — unlike the Central UX
  rework, this was scoped and approved directly with the user in one planning
  session; there is no separate visuals/ mockup deliverable.
- **Product alignment:** a cross-cutting polish pass, not a roadmap phase item;
  record it under a "Known follow-ups" / delivered-work note in
  `docs/product/roadmap.md` per the repo's documentation-sweep convention.

## Skills & Conventions Applied

- **interface-craft** — storyboard discipline (named motion variants, zero
  magic numbers, deliberate curve vocabulary) adapted from its native
  React/Framer-Motion frame to this project's CSS-token idiom; still governs
  severity/consistency judgment calls (e.g. the pop curve is transform-only,
  the exit ceiling protects e2e).
- **agent-browser** — manual verification pass across every surface
  (route nav, drawers both directions, canvas add/delete/drag, PropSection
  fold, overlays, reduced-motion emulation via CDP, dark/high-contrast spot
  check), logged to `docs/verification/`.
- Repo conventions (CLAUDE.md hard invariants): no edits to
  `src/styles/generated/*`, the PrimeVue preset, or version pins;
  `value-no-unknown-custom-properties` compliance via the existing
  `builder.css` `importFrom` entry; `data-testid` preservation; conventional
  commits **without** a `Co-Authored-By` trailer.

## Delivery-phase decisions (post-implementation)

Two regressions surfaced in the first full e2e run and set binding patterns:

- **The canvas root `NodeList` is keyed by `form.recordId`** (FormEditorView).
  The form store keeps the previous doc until `load()` resolves, so an in-place
  form switch made the canvas TransitionGroup cross-animate two documents: the
  old doc's cards leave-animated as ghosts beside the entering new ones —
  briefly duplicating `data-testid`s (Playwright strict-mode aborts) and
  visually leaking the previous form. Remounting per record keeps enter/leave
  motion strictly within one editing session. Rule of thumb: a TransitionGroup
  over store-derived lists must be keyed by the owning document's identity.
- **Navigate-then-scroll is dead under route transitions.** The editor's
  Central zero-state used `router.push` → `nextTick` → `scrollIntoView`; with
  `mode="out-in"` the target view mounts only after the old view's leave
  completes, so the query silently missed. The destination view now owns the
  scroll (`?section=central` read in SettingsView's `onMounted`, reduced-motion
  aware). Any future deep-link-and-scroll must live in the destination
  component, never at the push site.

## Known tradeoffs (accepted at review)

- **Drag started within a leave window (~120ms after deleting a canvas card)
  can mis-count Sortable indexes** — the leaving ghost is still a DOM child of
  the sortable `.node-list` while the model has already spliced. The clean fix
  (a Sortable `draggable` selector excluding `.node-item-leave-active`) risks
  breaking palette-clone drops, so the near-unhittable window is accepted;
  revisit only if a real mis-reorder is ever observed.
- **TransitionGroup `-move` FLIP does a full-sibling layout read per list
  mutation** — fine for discrete user actions at realistic form sizes; if
  very large forms (hundreds of siblings in one list) become a target, gate
  the move class behind a child-count threshold.
