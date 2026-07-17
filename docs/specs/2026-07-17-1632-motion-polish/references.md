# References for the motion & transition polish pass

Current-code inventory (recon 2026-07-17, verified against source at
shaping/build time). Re-confirm anchors before further edits.

## Prior art / provenance

- **Approved plan (content source of truth):**
  `~/.claude/plans/want-to-add-some-soft-hippo.md` — full exploration
  findings, motion inventory, per-surface table, test-impact analysis.
- **No backlog stub, no review Artifact** — shaped directly with the user in
  one session (see `shape.md`).

## interface-craft (skill)

- **Source:** `plugin:unops-toolkit:interface-craft`.
- **Why it applies:** the whole pass is a motion/animation-quality exercise;
  the skill's storyboard discipline (named variants, zero magic numbers,
  spring-feel curves, non-negotiable `prefers-reduced-motion` support) is its
  native subject matter.
- **Adaptation note:** the skill's reference material (DialKit, storyboard
  examples) targets **React + Framer Motion** — JS-driven springs and
  variant objects. This project has no such runtime (Vue 3.5 built-ins only,
  CSS-only decision — see `shape.md`), so the adaptation keeps the
  *discipline* (named tokens, no per-component literals, deliberate curve
  vocabulary, reduced-motion as a first-class case) and re-expresses it as:
  - named variants → named `--builder-motion-*` custom properties plus named
    Vue `<Transition>` classes (`route-*`, `drawer-start-*`, …) instead of JS
    variant objects;
  - spring feel → a hand-picked overshoot `cubic-bezier` (`ease-pop`) instead
    of a real spring simulation (real springs need JS; a CSS approximation is
    the documented compromise);
  - the skill's five-lens critique is used post-implementation as a review
    pass, not to produce a mockup Artifact (no visuals/ deliverable here,
    unlike the Central UX spec).

## @primeuix/styles@1.0.3 — shipped transition classes (pin, from `docs/product/tech-stack.md`)

The actual PrimeVue transition classes retuned in `motion.css` section B, with
their stock values before this pass:

- `.p-dialog-enter-active` / `-leave-active` — 150ms, `scale(0.7)` zoom.
- `.p-drawer-enter-active` / `-leave-active` — 300ms, `translateX`.
- `.p-toast-message-enter-active` / `-leave-active` — 300ms enter / 450ms
  leave (collapse).
- `.p-connected-overlay-enter-active` / `-leave-active` and
  `.p-popover-enter-active` / `-leave-active` — 120ms enter / 100ms leave.
- `.p-overlay-mask-enter` / `.p-overlay-mask-leave` — keyframe-based
  (`animation`, not `transition`); retimed via `animation-duration` only,
  the keyframes themselves are not touched.
- PrimeVue `Tabs` ships **no** transition classes — irrelevant here, since
  `EditorTabs.vue` is hand-rolled, not the PrimeVue `Tabs` component.

Selector specificity: PrimeVue's runtime-injected `<style>` tags land *after*
the bundled CSS with no cascade layer (`main.ts` sets no `cssLayer`,
deliberate — see `docs/product/tech-stack.md`), so a same-specificity
override in `motion.css` would lose. Every retune selector is `html `-prefixed
(specificity 0,1,1) to beat PrimeVue's bare class selectors (0,1,0).
Positional Dialog variants (e.g. `.p-dialog-top`, 0,2,0) still win over these
base retunes on purpose — `AttachmentsDialog.vue` owns its own
`position="top"` rules and is not touched by this pass.

## stylelint `importFrom` mechanism — `stylelint.config.mjs`

`csstools/value-no-unknown-custom-properties` is configured with an
`importFrom` array of known-property sources: `src/styles/odk-tokens.css`,
`src/styles/builder.css`, `src/styles/builder-dark.css`,
`src/styles/builder-contrast.css`, the three committed `generated/*.css`
files, a static `{ customProperties: { '--accent-swatch-color': '' } }` entry
for one runtime `:style`-injected prop, and `primevueCustomProperties()` (an
async plugin call resolving every live `--p-*` token from the pinned
`@primeuix/styled` emission). Because `builder.css` is already in that list,
every new `--builder-motion-*` token declared in its `:root` block is picked
up automatically — no config edit needed for this pass. `var(--x, fallback)`
refs are always allowed regardless of `importFrom`, per the rule's own design
(see the file's header comment).

## Prior `prefers-reduced-motion` precedents in the codebase (pre-pass)

- **CSS killswitch (replaced by this pass):** `src/styles/builder.css` had a
  narrower `.editor *` -scoped reduced-motion block; this pass promotes it to
  a `:root`-wide blanket (see `plan.md` §1) so it covers routes, library
  cards, and PrimeVue overlays too, not just the editor.
- **Opt-in `no-preference` gates (removed by this pass):**
  `src/views/FormEditorView.vue` (two blocks — palette slide-over enter
  keyframes, desktop rail-fold transition) and
  `src/components/central/CentralDrawerShell.vue` (one block — the old
  `central-drawer-in` enter keyframe). These existed because there was no
  global blanket yet; the blanket makes per-surface opt-in gates redundant.
- **Kept as-is (do more than zero a duration):**
  `src/components/attachments/AttachmentsDialog.vue`'s `reduce` block strips
  a `transform`, not just a duration; `src/components/canvas/TreeNodeCard.vue`
  has a JS `matchMedia('(prefers-reduced-motion: reduce)')` gate on
  `scrollIntoView` *behavior* (smooth vs instant scroll), which a CSS blanket
  cannot express.

## PrimeVue install — no ripple, no global `pt`

`src/main.ts` installs PrimeVue with no `ripple` option and no global
pass-through (`pt`) config. The preview child app has its own, fully isolated
PrimeVue install (`PreviewHost.vue`) — never touched by anything in this pass,
matching the byte-parity invariant (`pnpm verify:webforms`).

## Motion-relevant components touched by this pass

- `src/App.vue` — bare `<RouterView />` became
  `<RouterView v-slot="{ Component }"><Transition name="route" mode="out-in">…`.
- `src/views/FormEditorView.vue` — palette scrim/drawer, Central drawer wrap,
  tablet pane swap, desktop rail-fold transition.
- `src/components/central/CentralDrawerShell.vue` — its own enter-keyframe
  block removed; the wrapping `<Transition name="drawer-end">` now lives in
  the parent view per surface (`FormEditorView.vue`, `FormLibraryView.vue`),
  keeping component specs that mount the shell directly synchronous.
- `src/views/FormLibraryView.vue` — library card `<TransitionGroup>`, library
  Central drawer wrap.
- `src/components/canvas/NodeList.vue` — `VueDraggable`'s `target=".node-list"`
  prop plus an inner `<TransitionGroup>`.
- `src/components/properties/ChoicesSection.vue` — enter-only
  `choice-row-in` keyframe (rows keyed by index).
- `src/components/properties/PropSection.vue` — `v-show` replaced by a
  `.prop-section-fold` grid-rows toggle.
- `src/components/canvas/TreeNodeCard.vue` — `just-added-flash` keyframe
  token-ified.
- `src/main.ts` — new `import '@/styles/motion.css'` after `builder.css`.

## Tests to check (component spec — the only one affected)

- `tests/component/property-panel.spec.ts` — the two `display: none`
  assertions on the collapsed section body become
  `.prop-section-fold.classList.contains('collapsed')` assertions against the
  `.prop-section-fold` ancestor; stays synchronous (no `vi.waitUntil` needed,
  it's a class toggle, not a `<Transition>`).
- Existing precedent for `<Transition>` + Vitest: `AttachmentsDialog.vue`'s
  drill view was the only prior `<Transition>` in the app and already
  requires `vi.waitUntil` in its component spec — left as-is; this pass does
  not touch that component's own `<Transition mode="out-in">`.
