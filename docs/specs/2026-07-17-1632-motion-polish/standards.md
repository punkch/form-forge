# Motion conventions — binding on future work

These conventions are established by this pass and apply to any transition,
animation, or PrimeVue-overlay work from here on.

## All timings via `--builder-motion-*` tokens — zero literals

Every `transition`/`animation` duration and easing curve in builder chrome
(component `<style>` blocks, `motion.css`, `builder.css`) must reference one
of the tokens declared in `src/styles/builder.css`'s `:root` block:
`--builder-motion-duration-{xs,s,m,l,flash}` and
`--builder-motion-ease-{standard,enter,exit,pop}`. No new hardcoded `ms`/`s`
duration or bare `cubic-bezier(...)`/`ease`/`linear` keyword may be introduced
in component CSS. If a new beat is genuinely needed (none of the five
durations or four curves fit), add it to the token block with a storyboard
comment explaining when to reach for it — do not inline a one-off value.
`var(--builder-motion-*, fallback)` is fine when a fallback is genuinely
needed (e.g. code that must also run before the tokens are defined); a bare
literal duration is not.

Carve-out: a literal `0s` in the delayed-visibility idiom
(`transition: … , visibility 0s var(--builder-motion-duration-*)`) is not a
timing choice — it flips `visibility` instantly after the token-driven delay —
and needs no token. Easing keywords are still forbidden there (a 0s transition
has no curve).

## 200ms exit ceiling

Any **exit** (leave) transition/animation on an element that an e2e spec
asserts `toBeHidden()` (or equivalent) immediately after triggering the close
must stay at or under `--builder-motion-duration-l` (200ms) — `dur-s`/`dur-xs`
where the surface allows it. This is a hard ceiling, not a target: Playwright
assertions in this repo auto-retry but do not explicitly wait out a leave
animation, so an exit slower than the retry window is a flaky-test risk, not
just a UX nit. When in doubt, prefer a **faster leave than enter** — humans
notice slow entrances more than slow exits, and it's also the safer choice for
this ceiling.

## `html `-prefix rule for PrimeVue overrides

Any CSS override of a PrimeVue-shipped class (whether a transition retune or
any other future PrimeVue style override) must be written with an `html `
prefix (e.g. `html .p-dialog-enter-active`), never the bare class. PrimeVue's
runtime-injected `<style>` tags land after the bundled CSS with no cascade
layer (`main.ts` deliberately sets no `cssLayer`), so a same-specificity
override loses the cascade. `html ` raises specificity to 0,1,1, which beats
PrimeVue's bare-class 0,1,0 without resorting to `!important`. This does not
apply to positional/variant PrimeVue classes that are already more specific on
their own (e.g. `.p-dialog-top`, 0,2,0) — those still legitimately win and
should not be additionally `html `-prefixed unless they also need to beat
another `html `-prefixed rule.

## Global `prefers-reduced-motion` blanket — no per-component gates

Reduced motion is handled **once**, app-wide, in `builder.css`:
`@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
transition-duration: 0.01ms !important; animation-duration: 0.01ms !important;
animation-iteration-count: 1 !important; scroll-behavior: auto !important; } }`.
New motion work must **not** add its own per-component
`@media (prefers-reduced-motion: reduce)` block to zero a duration — the
blanket already covers it. A per-component reduced-motion block is only
justified when the *behavior*, not just a duration, changes under reduced
motion (the two kept precedents: `AttachmentsDialog.vue` strips a `transform`
in addition to timing; `TreeNodeCard.vue` uses a JS `matchMedia` check to pick
instant vs smooth `scrollIntoView`). Use `0.01ms`, never `none` or `0s`/`0ms`,
for any duration reduced-motion code sets directly — `0ms` can skip firing
`transitionend`/`animationend` in some engines, which can wedge a Vue
`<Transition>` leave hook waiting on that event.

## Pop curve (`--builder-motion-ease-pop`) is transform-only

`--builder-motion-ease-pop` (`cubic-bezier(0.3, 1.4, 0.45, 1)`, ~5%
overshoot) is reserved for **`transform` properties only** (scale, translate).
Never apply it to `opacity` — an overshooting opacity curve computes values
outside `[0, 1]` on the rebound, which most engines clamp visibly (a
flicker/hard-clip artifact) rather than rendering smoothly. Pair it with
`--builder-motion-ease-enter` (a plain decelerate curve, no overshoot) on the
`opacity` half of any combined enter transition — see the Dialog and Toast
enter rules in `motion.css` for the reference pattern (`transform` uses
`ease-pop`, `opacity` uses `ease-enter`, in the same rule).

## Index-keyed lists get enter-only animation, never `<TransitionGroup>`

If a `v-for` list is keyed by array index rather than a stable identity
(`:key="i"`), it must not be wrapped in a `<TransitionGroup>` — index keys mean
Vue cannot tell which element was removed, so leave/move animation would
target the wrong row. Such lists get an **enter-only** CSS `animation` on the
row instead (see `ChoicesSection.vue`'s `choice-row-in`). This is not a
stopgap to fix later — re-keying such a list by stable identity to unlock full
`<TransitionGroup>` support is a separate, deliberate change (data-model
question: what is a choice row's stable identity across reorders), not a
motion-layer one.
