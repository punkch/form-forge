# Preview follows canvas selection — Shaping Notes

> Shaped 2026-07-17 directly in conversation with the user (no backlog stub —
> that folder was retired 2026-07-16 per CLAUDE.md). The user asked: "I click
> on range integer picker to edit its properties — can the webform preview
> scroll to this field?" Feasibility was investigated against the pinned
> `@getodk/web-forms` bundle before shaping; the design below was discussed
> and approved question-by-question (matching key, duplicate handling).

## Scope

1. **Scroll on selection** — selecting a node on the canvas scrolls the live
   preview pane to the corresponding rendered question (smooth, centered,
   reduced-motion aware) and briefly flashes it so the landing spot is
   self-evident.
2. **Follow through remounts** — the preview remounts its whole child app on
   every debounced regeneration (`instanceKey++`), resetting scroll to the
   top today. After each remount the preview re-scrolls to the currently
   selected question (no flash), so the pane *stays* on the field being
   edited while the user types.
3. Selecting a group/repeat follows to its first renderable descendant
   question.

Out of scope: a toolbar toggle to disable following (revisit if it annoys),
exact node identification via web-forms changes (upstream `data-reference`
PR / `pnpm patch` — recorded as the deterministic upgrade path), scrolling
the canvas from the preview (reverse direction).

## The mapping problem (why a heuristic)

There is no id bridge between the builder's model and the preview DOM:

- Each rendered leaf question is `<div id="<nodeId>_container"
  class="question-container">`, but `nodeId` is an opaque engine-generated
  unique id (`nodeID(createUniqueId())`) — the field name/ref appears
  nowhere in the DOM.
- `OdkWebForm` is a black box: its only events are `loaded` (no payload),
  `submit`, `submitChunked`; its state lives in a setup closure, so the
  engine's node tree (which does know `currentState.reference`) is
  unreachable from the host app.
- web-forms omits non-relevant questions from the DOM entirely, and repeats
  render one copy of their children per instance — so "nth question in the
  doc = nth container" does not hold.

## Decisions

- **Match on rendered label text, positionally aligned** — not a global
  find-by-label. Doc side: the ordered list of renderable leaf questions
  (`kind === 'question'` with a non-null registry `xform.bodyElement`;
  groups/repeats never render a `.question-container`), each carrying its
  label texts across *all* languages as match candidates (the preview's
  language picker means we can't know which language is displayed). DOM
  side: the ordered `.question-container` list with each container's
  `.control-text > label` text. An LCS-style order-preserving alignment
  (skips allowed on both sides) absorbs relevance-hidden questions (missing
  from the DOM) and extra repeat instances (extra in the DOM); duplicate
  labels resolve by position, anchored by the unique labels around them.
- **Wildcard entries for unmatched-able labels.** Labels containing `${…}`
  output references render as live values, and questions with no label and
  no hint have no text at all — these entries match any rendered item and
  rely on their neighbors for anchoring. Hint text is the secondary key when
  the label is empty (`.control-text > .hint`).
- **Benign-failure stance.** This is a scroll hint, not a correctness
  mapping: every failure mode degrades to "scrolled somewhere plausible" or
  "didn't scroll". Selection stays keyed on real node ids in the builder;
  identical twin labels split across a relevance boundary are accepted as
  unresolvable (the flash makes a rare miss self-evident).
- **Pure logic, thin DOM.** Matching/alignment lives in a pure module
  (`src/preview/followSelection.ts`, node-env unit specs — the vitest unit
  project already includes `src/preview/**`). `PreviewHost` owns the only
  DOM reading (extract labels, scroll, flash); `PreviewPanel` owns the
  wiring (watch `editor.selectedNodeId`, re-follow on host `loaded`).
- **`loaded` is the remount hook.** `PreviewHost` now forwards OdkWebForm's
  `loaded` event (generation-guarded, after a `nextTick` + rAF so the
  questions exist in the DOM). No retry timers: a selection made while the
  engine is still loading is picked up by the next `loaded`.
- **Flash only on selection change**, never on the remount re-follow — the
  remount fires every 500ms-debounced edit while typing; flashing each
  regen would be noise. Flash reuses the established canvas "just added"
  flash idiom, on the motion tokens (`--builder-motion-duration-flash`),
  killed by the global reduced-motion blanket.
- **Already-visible questions don't scroll** — selection of a question fully
  inside the pane's viewport just flashes; `scrollIntoView({block:
  'center'})` fires only when it's (partly) out of view. Smooth behavior is
  gated on `prefers-reduced-motion` via `matchMedia` (the JS-side gate the
  CSS blanket can't cover), mirroring `TreeNodeCard.vue`.
- **No new UI strings, no new testids removed** — the feature has no visible
  chrome; i18n catalogs untouched.

## Context

- Investigation artifacts (bundle findings, event surface) are recorded in
  `references.md` — they were verified against the *pinned* web-forms
  version; the version-pin invariant is what makes coupling to
  `.question-container` / `.control-text` DOM acceptable.
- Product alignment: editor-UX polish item, not a roadmap phase; noted in
  `docs/product/roadmap.md` under delivered follow-ups.

## Delivery-phase decisions (post-implementation)

- **Flash tint = shared `--builder-flash-tint`/`--builder-flash-ring` tokens**
  (builder.css, next to the motion block), not the raw `--p-primary-50/200`
  scale the plan's "mirror TreeNodeCard" wording implied: the dark theme
  never remaps the raw primary scale, so the light-scale tint flashed opaque
  near-white on dark surfaces (caught in the agent-browser dark-mode pass).
  Both the new preview flash and the pre-existing canvas "just added" flash
  now reference the tokens — translucent `color-mix` of `--p-primary-500`,
  scheme-proof and accent-aware.
- **A dynamic `${…}` hint no longer wildcards the whole entry** (revises the
  plan's entry-building rule): the dynamic hint candidates are dropped, but a
  static label stays exactly matchable — wildcarding the entry could flash a
  same-labeled repeat instance instead of the target (code-review finding).
- **Target-anchored alignment replaced the greedy LCS backtrack**: the
  resolved index is the earliest rendered item the target can match while
  lying on *some* optimal alignment (prefix+suffix DP). The single canonical
  backtrack could let a preceding relevance-hidden wildcard entry steal the
  target's item on an LCS tie and silently drop the follow.
- **No `animationend` cleanup listener on the flash class** — `animationend`
  bubbles, so a descendant widget animation could end the flash early; the
  remove → forced-reflow → add cycle alone is re-trigger-safe and the class
  is inert once the animation finishes.

## Skills & Conventions Applied

- Delivery process per CLAUDE.md: spec folder → dynamic Workflow with
  parallel agents (sonnet implementation stages) → full suite +
  agent-browser verification logged to `docs/verification/` → `/code-review`
  with findings fixed immediately → conventional commit (no co-author
  trailer) → README/roadmap/CLAUDE.md sweep.
- Motion invariant: all timings via `--builder-motion-*` tokens; exits/flash
  respect the global reduced-motion blanket.
