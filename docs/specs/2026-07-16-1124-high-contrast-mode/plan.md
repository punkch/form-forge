# Plan — High-contrast mode (accessibility)

## Context

Form Forge's theming (`docs/specs/2026-07-13-1840-theming/`) already solved
every structural problem an orthogonal contrast dimension needs: chrome and
the embedded `@getodk/web-forms` preview resolve **all** colour through a CSS
custom-property chain (`--builder-*` → `--odk-*` → `--p-*`), so a token-
override stylesheet re-themes the whole surface for free; the apply layer
owns `<html data-ff-theme data-ff-accent>`, a `matchMedia` listener, a
no-FOUC inline `<head>` script, ui-store persistence with `exportPreferences`/
`applyPreferences`, and an additive-embed-config precedent; `src/theme/
constants.ts` is the pure single source of truth shared by the store, the
embed coercion, the inline script, and the Node CSS generator.

This feature adds a third dimension, `contrast: normal | high | system`,
following that exact pattern: a new attribute (`data-ff-contrast`), a new
`matchMedia('(prefers-contrast: more)')` listener, a new persisted +
backed-up preference, a new additive embed-config key, and new override CSS.
The one real asymmetry: dark mode's override CSS was *generated* wholesale
from the pinned `@primeuix/styled` emission; there is no equivalent upstream
emission for high contrast, so the surface/semantic layer is hand-authored
(like `builder-dark.css`) while the accent layer — which **is** mechanically
derivable from the existing 50–950 `palette()` scales — is generated, with a
new WCAG contrast-ratio helper making the AAA floor self-enforcing.

**Zero contrast groundwork exists today** (verified 2026-07-16; see
`references.md`) — every file this plan touches is a net-new addition. Read
`docs/specs/2026-07-13-1840-theming/plan.md` and its `standards.md` (the
"How to regenerate the theme CSS" / "The drift gate" / "Adding a new accent"
sections) before starting; this plan assumes that context.

Resolved decisions (full detail in `shape.md`): orthogonal setting (not a
new theme), default `system`, generated accent clamping (decision 3),
hand-authored surfaces with a ratio-enforcing test (decision 4),
forced-colors as an audit not a theme (decision 5), decoration *reduction*
under high contrast (tints → borders + labels, shadows → hard lines), a
three-state Settings select, `prefers-contrast: less` treated as `normal`,
and the preview re-contrasted (documented trade-off).

Branch: work directly on `main`. Conventional commits; **no
`Co-Authored-By` trailer or self-attribution on any commit** (global user
instruction — overrides any default tool behaviour).

## Task 1 — Pure contrast constants

**What:** Add the contrast preference's type/guard/resolve layer to the
existing pure constants module, following `ThemeScheme`/`resolveScheme`
exactly.

**Files:**
- `src/theme/constants.ts` — add:
  - `export type ContrastPref = 'normal' | 'high' | 'system'`
  - `export type ResolvedContrast = 'normal' | 'high'`
  - `export const CONTRAST_PREFS: readonly ContrastPref[] = ['normal', 'high', 'system']`
  - `export const DEFAULT_CONTRAST: ContrastPref = 'system'`
  - `export const isContrastPref = (value: unknown): value is ContrastPref => …`
    (same shape as `isThemeScheme`)
  - `export const resolveContrast = (pref: ContrastPref, systemPrefersMore: boolean): ResolvedContrast => pref === 'system' ? (systemPrefersMore ? 'high' : 'normal') : pref`
    (`prefers-contrast: less` is never passed through as `true` here — the
    caller only ever feeds the boolean for `prefers-contrast: more`, so
    "less" and "no-preference" both resolve to `normal`, satisfying the
    "treat `less` as `normal`" decision without special-casing it)
  - A single source-of-truth for the high-contrast surface colours the
    generator's ratio math and the hand-authored CSS must agree on, e.g.:
    ```ts
    export const HIGH_CONTRAST_SURFACES = {
      light: { bg: '#ffffff', text: '#000000' },
      dark: { bg: '#000000', text: '#ffffff' },
    } as const
    ```
    (exact literal values are a design-pass decision — see Task 5 — but the
    constant must exist so Task 6's generator and Task 8's ratio test share
    one number instead of two hand-typed copies drifting apart)

**Tests:**
- `tests/unit/theme-constants.spec.ts` — extend with `describe('CONTRAST_PREFS…')` /
  `describe('isContrastPref…')` / `describe('resolveContrast…')` blocks
  mirroring the existing `THEME_SCHEMES`/`isThemeScheme`/`resolveScheme`
  blocks (accepts every declared pref, rejects unknown strings/non-strings,
  `system` follows the boolean, concrete prefs pass through unchanged,
  `DEFAULT_CONTRAST` is `system`).

No i18n, no testids (pure module).

## Task 2 — Apply layer: stamp `data-ff-contrast`, second media listener

**What:** Extend the runtime apply layer to resolve and stamp contrast, and
to track the OS `prefers-contrast: more` state the same way it already
tracks `prefers-color-scheme`.

**Files:**
- `src/theme/index.ts`:
  - Extend the `ThemeSource` interface with `contrast: ContrastPref`.
  - Extend `state.override` with an optional `contrast?: ContrastPref` and
    add `contrastMedia`/`onContrastChange` fields alongside the existing
    `media`/`onSchemeChange` (or generalize to an array of `{ media,
    onChange }` pairs — either is fine, keep `teardown` symmetric).
  - `effectiveContrast()` mirrors `effectiveTheme()`/`effectiveAccent()`.
  - `systemPrefersMoreContrast()` mirrors `systemPrefersDark()`, backed by
    the new media query.
  - `applyTheme` gains a third parameter,
    `applyTheme(resolved: ResolvedScheme, accent: AccentId, contrast:
    ResolvedContrast): void`, and stamps `data-ff-contrast` **only when
    `contrast === 'high'`** — set `root.dataset.ffContrast = 'high'` in that
    branch, and `delete root.dataset.ffContrast` (or
    `root.removeAttribute('data-ff-contrast')`) otherwise, so `normal`
    leaves the attribute absent (matches the backlog's stated shape: "`high`
    or absent").
  - `apply()` computes the third argument via
    `resolveContrast(effectiveContrast(), systemPrefersMoreContrast())` and
    passes it through.
  - `initThemeController` sets up the second `matchMedia('(prefers-contrast:
    more)')` listener exactly like the existing one: re-`apply()` only while
    `effectiveContrast() === 'system'`; `teardown()` detaches both listeners
    symmetrically (old/no-`addEventListener` fallback included, matching the
    existing `addListener`/`removeListener` shim).
  - `setEmbedTheme` gains a third parameter,
    `setEmbedTheme(theme?: ThemeScheme, accent?: AccentId, contrast?:
    ContrastPref): void`, accumulating exactly like `theme`/`accent` do
    today (only overwrites the fields the host actually sent).

**Tests:**
- `tests/component/theme-apply.spec.ts` — extend the `stubMatchMedia` helper
  (or add a second one) so a test can stub `prefers-contrast: more`
  independently of `prefers-color-scheme`; add cases: `applyTheme` stamps
  `data-ff-contrast="high"` when passed `'high'` and removes the attribute
  when passed `'normal'`; `initThemeController` reacts to a
  `prefers-contrast` change only while the effective preference is `system`;
  `setEmbedTheme`'s third argument overrides the persisted contrast and an
  omitted third argument leaves a prior override in place (mirrors the
  existing `theme`/`accent` override-persistence assertions).

No new testids (this is the apply layer, no template).

## Task 3 — No-FOUC inline script

**What:** Extend the dependency-free pre-paint bootstrap so a reload in high
contrast shows no flash of normal-contrast chrome, in lockstep with Task 1's
constants.

**Files:**
- `index.html` — inside the existing inline `<script>` (currently lines
  19–48): add `var contrast = 'system'`, read `pref.contrast` from the same
  parsed `odk-builder:ui:v1` blob (validate it is one of `'normal'`,
  `'high'`, `'system'` — literal string checks, no imports, matching the
  existing `pref.theme`/`pref.accent` validation style), resolve `system` via
  a **second** `window.matchMedia('(prefers-contrast: more)').matches`
  check, and `root.setAttribute('data-ff-contrast', 'high')` only when the
  resolved value is `high` (never set the attribute for `normal`, and if a
  previous stamp somehow exists, this script runs once at boot so there is
  nothing to remove).

**Tests:**
- `tests/unit/theme-inline-script.spec.ts` — add: the script contains
  `'data-ff-contrast'`; validates a persisted contrast pref against every
  declared value in `CONTRAST_PREFS` (loop like the existing `THEME_SCHEMES`
  assertion); falls back to `DEFAULT_CONTRAST` (`'system'`) when absent;
  references `prefers-contrast` and `more` somewhere in the script text (a
  light-touch assertion that the second media query actually appears,
  mirroring the existing style — this file intentionally tests string
  content, not execution, since it runs in a `node` environment reading
  `index.html` as text).

## Task 4 — ui store: persist + back up the preference

**What:** Add the `contrast` ref to the ui store with the same validate/
persist/export/apply treatment `theme`/`accent` already get.

**Files:**
- `src/stores/ui.ts`:
  - Import `DEFAULT_CONTRAST`, `isContrastPref`, `type ContrastPref` from
    `@/theme/constants`.
  - Add `contrast: ContrastPref` to `PersistedUiState`.
  - `const contrast = ref<ContrastPref>(isContrastPref(persisted.contrast) ?
    persisted.contrast : DEFAULT_CONTRAST)`.
  - Add `contrast: contrast.value` to `exportPreferences()`'s returned
    object.
  - Add `if (isContrastPref(p.contrast)) contrast.value = p.contrast` to
    `applyPreferences`.
  - Add `contrast` to the persistence `watch([...])` dependency array and to
    the `state: PersistedUiState` object built inside it.
  - Add `contrast` to the store's returned object.
  - `STORAGE_VERSION` stays `1` — this is an additive field on the existing
    format, exactly like `theme`/`accent` were when introduced (leniently
    ignored by any older code that doesn't know it, defaulted by any newer
    code reading an older blob that lacks it).

**Tests:**
- Add a `contrast`-focused block to whichever unit spec covers the ui store
  today (grep for the existing `theme`/`accent` persistence assertions and
  extend the same file) — round-trips through `exportPreferences`/
  `applyPreferences`, defaults to `system` when absent/invalid, persists to
  `localStorage` under the unchanged key/version.
- `tests/unit/workspace-full-backup.spec.ts` — confirm (add an assertion if
  not already implicit) that a `preferences.json` without a `contrast` key
  (an old-format archive) restores without error and leaves the default in
  place — proving the "no format-version bump" claim in practice, not just
  by code inspection.

No i18n, no testids.

## Task 5 — Hand-authored surface/decoration CSS

**What:** Author `src/styles/builder-contrast.css`, the high-contrast
counterpart to `builder-dark.css`: AAA-safe surfaces/text/borders for both
schemes, a thicker guaranteed-contrast focus ring, flattened shadows/scrims,
and category-tint chips converted to borders + labels.

**Before writing the CSS:** run an `/interface-craft` design-critique pass
to settle the specifics the shaping doc deliberately left open — this task
produces a short list of concrete values (exact hex pair(s) for
`HIGH_CONTRAST_SURFACES`, focus-ring width/colour, which shadow tokens go to
`none` vs. a hard 1px border, exact `.type-chip` treatment) before the CSS
is written, not after.

**Files:**
- `src/styles/builder-contrast.css` (new) — two selector groups:
  - `:root[data-ff-contrast="high"] { … }` — the light-scheme high-contrast
    block. Remaps at minimum: `--odk-text-color`, `--odk-muted-text-color`,
    `--odk-light-muted-text-color`, `--odk-base-background-color`,
    `--odk-light-background-color`, `--odk-muted-background-color`,
    `--odk-border-color` to AAA-safe near-white/near-black values agreeing
    with `HIGH_CONTRAST_SURFACES.light` (Task 1); `--odk-primary-text-color`/
    `--odk-primary-border-color`/`--odk-primary-light-background-color`/
    `--odk-primary-lighter-background-color` (the fixed-scale-step ODK
    aliases in `odk-tokens.css` that the generated accent-contrast blocks
    from Task 6 don't reach on their own — see `references.md`);
    `--builder-scrim-bg`, `--builder-drawer-shadow`, `--builder-card-shadow`
    flattened (no blur/spread — a hard border or `none`, per the design
    pass); the eight `--builder-cat-*-tint` tokens (transparent or removed).
  - `:root[data-ff-theme="dark"][data-ff-contrast="high"] { … }` — the
    compound dark+high block (specificity 0,3,0, naturally wins over the
    plain 0,2,0 dark and contrast blocks with no ordering dependency),
    remapping the same token set to near-black/near-white for the dark
    scheme, agreeing with `HIGH_CONTRAST_SURFACES.dark`.
  - A `:root[data-ff-contrast="high"] :focus-visible { … }` rule thickening
    `outline-width` and pinning `outline-color` to a token that clears 3:1
    against both high-contrast surfaces (the existing rule in
    `builder.css` is `outline: 1px solid var(--p-primary-500, #3e9fcc);
    outline-offset: 1px;` — this doesn't need to reference the accent at
    all if a fixed AAA-safe colour is simpler and equally correct).
  - Global (non-scheme-keyed under the attribute selectors, so it applies to
    both) `.type-chip` decoration-reduction rules targeting the
    `cat-*` classes in `src/components/canvas/TreeNodeCard.vue` — background
    to `transparent`, add `border: 1px solid currentColor` (or an explicit
    per-category border colour), so the category signal survives as a
    border + the existing icon/label instead of a tint fill. Exact selector
    list is whatever the design pass in this task's preamble settles on;
    `TreeNodeCard.vue`'s `.type-chip`/`.type-chip.cat-*` rules
    (`references.md`) are the known starting point — audit for any other
    component using a `--builder-cat-*-tint` background the same way before
    calling this done.
- `stylelint.config.mjs` — add `abs('src/styles/builder-contrast.css')` to
  the `importFrom` array (alongside `builder-dark.css`).
- `src/main.ts` — add `import '@/styles/builder-contrast.css'` after the
  existing `import '@/styles/builder-dark.css'` (Task 7 covers the full
  import-ordering change together with the generated file from Task 6).

**Tests:** covered by Task 8's ratio-enforcing spec (this file has no drift
gate of its own — hand-authored files aren't generated).

No i18n, no testids (pure CSS + one existing component's scoped-adjacent
global override — `TreeNodeCard.vue`'s template is unchanged, only a new
global stylesheet rule targets its existing classes).

## Task 6 — Generated accent AAA clamping

**What:** Add a WCAG contrast-ratio helper and `generateAccentContrastCss()`
to the existing generator library, covering all six accents (including
`blue`, unlike `generateAccentsCss()`/`ACCENT_GEN` which deliberately skip
it), wired into the CLI and the drift gate.

**Files:**
- `scripts/theme-css-lib.mjs`:
  - A dependency-free WCAG relative-luminance + contrast-ratio helper
    (~15 lines of hex math): parse `#rrggbb` to `[r,g,b]` in `[0,255]`,
    linearize each channel (`v/255 <= 0.03928 ? v/255/12.92 :
    ((v/255+0.055)/1.055)**2.4`), relative luminance
    `0.2126*R + 0.7152*G + 0.0722*B`, contrast ratio
    `(L_lighter + 0.05) / (L_darker + 0.05)`. Export at least
    `contrastRatio(hexA, hexB): number` (and `relativeLuminance` if it's
    useful standalone to the ratio test in Task 8).
  - A full-six-accent generator list (reuse `ACCENT_GEN`'s five anchors plus
    a `blue` anchor `'#3e9fcc'` — either add `blue` to a new list or extend
    `ACCENT_GEN` itself with a flag distinguishing "gets a normal-mode
    override" from "gets a contrast-mode override"; keep
    `generateAccentsCss()`'s existing blue-skip behaviour unchanged either
    way — that is a pinned invariant, `tests/unit/theme-generated.spec.ts`
    already asserts the committed `theme-accents.css`).
  - `export const generateAccentContrastCss = () => { … }`: for each of the
    six accents × each of the two schemes (light-high, dark-high), compute
    the accent's `palette(anchor)` 50–950 scale (as `generateAccentsCss`
    already does), walk the scale to find the step whose `contrastRatio`
    against that scheme's `HIGH_CONTRAST_SURFACES` background clears 7:1,
    and emit a compound block re-pointing the **applied** tokens only (not
    the whole scale) — at minimum `--p-primary-color`, `--p-primary-hover-
    color`, `--p-primary-active-color`, `--p-primary-contrast-color`
    (computed white-vs-dark per chosen step, generalizing the existing
    amber-only `contrast` field in `ACCENT_GEN`), `--p-highlight-background`,
    `--p-highlight-color` — under
    `:root[data-ff-contrast="high"][data-ff-accent="<id>"]` and
    `:root[data-ff-theme="dark"][data-ff-contrast="high"][data-ff-accent=
    "<id>"]`. Also re-point the `odk-tokens.css` fixed-step aliases
    (`--odk-primary-text-color`, `--odk-primary-border-color`,
    `--odk-primary-light-background-color`,
    `--odk-primary-lighter-background-color` — see `references.md`) to the
    same chosen step or to the now-safe `--p-primary-color`, or they will
    keep resolving to an un-clamped mid-scale value.
  - Use the same `HEADER(...)` / committed-file-header convention as the
    other generators.
- `scripts/theme-css-lib.d.mts` — add the new exports
  (`generateAccentContrastCss`, `contrastRatio`, any other new export) so
  `.ts` call sites (the unit test, `generate-theme-css.mjs` if it stays
  `.mjs`) resolve under `vue-tsc`.
- `scripts/generate-theme-css.mjs` — write
  `src/styles/generated/theme-contrast-accents.css` from
  `generateAccentContrastCss()`, alongside the two existing writes; log its
  effective per-accent AAA step map the way `accentPrimary500()` is already
  logged.
- `src/styles/generated/theme-contrast-accents.css` (new, generated —
  produced by running `pnpm generate:theme` once the above lands, then
  committed as a normal reviewed diff, exactly like the two existing
  generated files).

**Tests:**
- `tests/unit/theme-generated.spec.ts` — add
  `it('theme-contrast-accents.css is byte-identical to
  generateAccentContrastCss()', …)` mirroring the two existing drift-gate
  `it`s.
- A focused unit spec (can live in `theme-generated.spec.ts` or a sibling)
  asserting every emitted `--p-primary-contrast-color` choice (white vs.
  dark) actually clears AAA against its own chosen step — a self-consistency
  check independent of the ratio-enforcing spec in Task 8, which checks the
  *surface* layer.

## Task 7 — Wiring: stylesheet import order + stylelint registration

**What:** Bring the two new stylesheets into the app bundle and register
them with the undefined-custom-property linter, alongside Task 5/6's own
per-file edits (listed together here since both land in the same two shared
files).

**Files:**
- `src/main.ts` — extend the existing four-line theming import block
  (`theme-dark.css`, `theme-accents.css`, `builder-dark.css`) to six:
  add `@/styles/generated/theme-contrast-accents.css` and
  `@/styles/builder-contrast.css`. Source order is not load-bearing for
  correctness (the compound selectors' higher specificity wins regardless),
  but keep the generated-then-hand-authored grouping the existing three
  lines already establish, for readability.
- `stylelint.config.mjs` — final `importFrom` array should list, alongside
  the existing five entries: `abs('src/styles/generated/theme-contrast-
  accents.css')` and `abs('src/styles/builder-contrast.css')`.

**Tests:** covered by `pnpm lint` running clean and by
`tests/unit/theme-generated.spec.ts` (Task 6) / the e2e clobber-style checks
(Task 11) actually loading the new stylesheets in a real build.

## Task 8 — Ratio-enforcing enforcement test

**What:** A new unit spec that plays the role the drift gate plays for
generated files, but for the hand-authored surface CSS: parse
`builder-contrast.css`, resolve the token pairs actually used for
text-on-surface and border-on-surface, and assert WCAG ratios — so a later
hand-edit can't silently regress below AAA. Also cross-checks that the
literal hex values in the CSS agree with `HIGH_CONTRAST_SURFACES` (decision
4's "single source of truth").

**Files:**
- `tests/unit/theme-contrast-ratio.spec.ts` (new):
  - Read `src/styles/builder-contrast.css` as text; extract the declared
    custom-property values for the known token set (a small hand-maintained
    list mirroring what Task 5 actually declares — `--odk-text-color` vs.
    `--odk-base-background-color`, `--odk-muted-text-color` vs. the same
    background, `--odk-border-color` vs. the same background, and their
    dark-compound-block counterparts).
  - Import `contrastRatio` from `../../scripts/theme-css-lib.mjs` (reuse,
    don't duplicate the hex math).
  - Assert every text-token pair clears `>= 7`, every border/non-text pair
    clears `>= 3`, for both the light-high block and the dark-compound
    block.
  - Assert the literal hex values found in the CSS for the surface
    background/text pair equal `HIGH_CONTRAST_SURFACES.light`/`.dark` from
    `src/theme/constants.ts` — the cross-check decision 4 calls for.
  - If a token's declared value is itself a `var(--p-…)` reference rather
    than a literal hex (e.g. an `--odk-primary-*` alias repointed at
    `--p-primary-color`), the test needs a resolution step or must be scoped
    to only the tokens Task 5 declares as literal hex — document whichever
    choice is made in the spec's header comment, since this is the one place
    a future contributor might be tempted to add a `var()`-only remap that
    silently escapes the ratio check.

No i18n, no testids.

## Task 9 — Embed protocol + demo host

**What:** Additive `contrast` key on `EmbedConfig`, coerced and applied
exactly like `theme`/`accent`; extend the reference demo host.

**Files:**
- `src/embed/protocol.ts`:
  - `export type EmbedContrast = ContrastPref` (mirrors `EmbedTheme =
    ThemeScheme`), importing `ContrastPref`/`isContrastPref` from
    `@/theme/constants` alongside the existing theme/accent imports.
  - `EmbedConfig` gains `contrast?: EmbedContrast` with a doc comment
    mirroring `theme`'s ("session-only, taking precedence over any persisted
    preference. `system` is accepted…").
  - `coerceEmbedConfig` gains `if (isContrastPref(raw.contrast))
    config.contrast = raw.contrast` alongside the existing theme/accent
    lines.
- `src/stores/embed.ts` — `applyConfig`'s
  `if (partial.theme !== undefined || partial.accent !== undefined) {
  setEmbedTheme(partial.theme, partial.accent) }` becomes a three-way OR
  passing `partial.contrast` through as the third argument.
- `public/embed-demo.html` — add a `<label>Contrast <select id="opt-
  contrast">` with `system`/`normal`/`high` options next to the existing
  theme/accent selects, and include its value in the `sendAppearance`
  payload/listener wiring (mirrors the existing `opt-theme`/`opt-accent`
  pattern at lines ~66–82 and ~191–197).

**Tests:**
- `tests/unit/embed-theme-config.spec.ts` — extend with `contrast`
  coercion cases mirroring the existing theme/accent ones (accepts every
  `CONTRAST_PREFS` value including `system`, rejects invalid strings,
  absent key leaves `config.contrast` undefined).
- Extend whichever test currently exercises `useEmbedStore().applyConfig`
  calling `setEmbedTheme` (grep the embed store spec) to assert a
  `contrast`-only `set-config` call reaches `setEmbedTheme` as the third
  argument without needing `theme`/`accent` present too (the OR condition
  must not gate on only the first two).

No new format-version bump (`PROTOCOL_VERSION` stays `1`); no new testids
beyond the demo host's plain `id` attributes (not part of the app's own
`data-testid` surface).

## Task 10 — Settings UI + i18n

**What:** A three-state contrast `Select` in the Appearance section, beside
the existing scheme select.

**Files:**
- `src/views/SettingsView.vue`:
  - Import `CONTRAST_PREFS` from `@/theme/constants` alongside the existing
    `THEME_SCHEMES` import.
  - Add a `contrastOptions` computed mirroring `themeOptions`:
    `CONTRAST_PREFS.map((id) => ({ value: id, label: t(\`appSettings.
    appearance.contrast.${id}\`) }))`.
  - Add a `changeContrast(value: ContrastPref): void { ui.contrast = value }`
    handler mirroring `changeTheme`.
  - In the Appearance `<section>` (currently lines 177–217), add a new
    `<label class="settings-field">` block after the scheme select (before
    or after the accent swatches — placing it directly under the scheme
    select reads best, matching the shaping doc's "beside the existing
    scheme select"), with:
    - `<span id="appearance-contrast-label">{{ t('appSettings.appearance.contrastLabel') }}</span>`
    - a `Select` bound to `ui.contrast`, `:options="contrastOptions"`,
      `option-label="label"`, `option-value="value"`,
      `aria-labelledby="appearance-contrast-label"`,
      `data-testid="settings-contrast-select"`,
      `@update:model-value="changeContrast"`.
- `src/i18n/locales/en/appSettings.json` — under the existing `appearance`
  object, add:
  ```json
  "contrastLabel": "Contrast",
  "contrast": {
    "normal": "Normal",
    "high": "High",
    "system": "Follow system"
  }
  ```
  (labels are placeholders for the design pass in Task 5 to sign off on
  alongside the visual specifics — "High"/"Normal"/"Follow system" reads
  consistently with the existing scheme labels "Light"/"Dark"/"Follow
  system").

**Tests:**
- Whichever component spec covers `SettingsView`'s Appearance section today
  (extend it if one exists covering the scheme select/accent swatches;
  otherwise add assertions to the nearest settings-view component spec) —
  the contrast select renders three options, changing it writes `ui.
  contrast`, and the `data-testid="settings-contrast-select"` is present.
- `pnpm lint` catches any missing i18n key (`no-missing-keys`).

**testids added:** `settings-contrast-select` (new). All existing testids
(`settings-theme-select`, `settings-accent-swatches`, `accent-swatch-<id>`,
`theme-toggle`) are untouched.

## Task 11 — Decoration-reduction design pass (`/interface-craft`)

**What:** Before or alongside Task 5's CSS authoring, run an
`/interface-craft` critique pass specifically to settle the shaping doc's
deliberately-open design calls: exact `HIGH_CONTRAST_SURFACES` hex pair(s),
the focus-ring width/colour, which shadow/scrim tokens go to `none` vs. a
hard border, and the concrete `.type-chip` border treatment (colour,
width, whether the icon keeps its category colour or goes to `currentColor`).
Log the critique's conclusions inline in `builder-contrast.css`'s file
header comment (mirroring `builder-dark.css`'s own explanatory header) so
the rationale travels with the code, not just this plan.

This task has no code deliverable of its own beyond that header comment —
it is a gate before Task 5's CSS is considered final, and before the
`/agent-browser` pass in Verification below.

## Task 12 — Forced-colors audit (companion, can ship separately)

**What:** Run the built app under Windows Contrast Themes / DevTools
`forced-colors: active` emulation and fix concrete breakage found — this is
an audit against the platform's own override, not a themeable render state,
per decision 5.

**Files (expected, confirm against what the audit actually finds):**
- `src/styles/builder.css`'s `:focus-visible` rule — add or confirm an
  `outline`-based (not `box-shadow`-based) focus treatment survives forced
  colors; `box-shadow` rings are stripped by the UA under `forced-colors:
  active`.
- Any custom control relying on a background-colour-only boundary (drag
  handles, custom checkboxes/switches if any are hand-rolled rather than
  PrimeVue) — add a transparent `border` so a forced border has somewhere to
  land.
- Icon SVGs/`i` glyphs that hard-code a fill/colour rather than
  `currentColor` — audit `src/components/canvas/TreeNodeCard.vue`'s category
  icons and any icon-as-background-image usage.
- The accent swatches (`SettingsView.vue`'s `.accent-swatch` elements, which
  set `--accent-swatch-color` inline) and the category type-chips — these
  must **keep** their real colour under forced colors (that's their whole
  purpose), so they need `forced-color-adjust: none` scoped narrowly to just
  those elements.
- The embedded preview — `forced-colors: active` emulation with a form open,
  checking PrimeVue form controls remain operable and visibly focusable.
- All fixes go under `@media (forced-colors: active) { … }` blocks, scoped
  and small — this is explicitly not a themeable dimension, no new
  `data-ff-*` attribute, no settings control.

**Tests:** primarily a manual/agent-browser audit (see Verification); add a
narrow unit/component assertion only where a fix is mechanical enough to pin
(e.g. a `forced-color-adjust: none` declaration existing in the stylesheet
for the accent-swatch selector) if that proves easy — do not force synthetic
`forced-colors` testing into `happy-dom`/`jsdom`, which don't emulate it.

## Task 13 — Docs sweep

**What:** Update the docs CLAUDE.md requires touching in the same change
that delivers a feature.

**Files:**
- `README.md` — extend the existing "Light/dark/system theme + accent
  presets" bullet (or add a new bullet immediately after it) to mention the
  contrast preference and the Settings control.
- `docs/product/roadmap.md` — extend the existing "Theming" delivered entry
  (or add a new entry immediately after it) describing the contrast
  dimension, the generated accent-clamping mechanism, and the
  forced-colors audit.
- `CLAUDE.md` — update the theme-related rows in the code map (`src/theme/`,
  `src/styles/`, `src/stores/ui.ts` if their one-line descriptions mention
  `theme`/`accent` explicitly) to also name `contrast`; add
  `docs/specs/2026-07-16-1124-high-contrast-mode/` to the documentation
  index list alongside the other notable specs.
- `docs/specs/2026-07-13-1840-theming/user-guide.md` — add a short
  cross-reference note pointing at this feature's own user guide (the
  theming guide is the natural place a reader lands first).
- `docs/specs/2026-07-09-2235-embed-postmessage-api/user-guide.md` — add
  `contrast` to the config-key bullet list in the `init`/`set-config`
  section; bring `theme`/`accent` along in the same edit since neither was
  ever added there when theming shipped (a pre-existing gap this touches
  anyway — see `references.md`).

No tests (docs-only).

## Verification

Run in order; fix findings before moving on.

```bash
pnpm lint                # eslint (i18n no-missing-keys) + stylelint (importFrom registration)
pnpm typecheck           # vue-tsc — embed coercion, store, .d.mts additions all resolve
pnpm test                # unit (constants/apply/ui-store/embed/generated-drift/ratio-enforcement/inline-script) + component (Settings, theme-apply)
pnpm test:coverage       # floors unchanged and met
pnpm build && pnpm test:e2e   # chromium + firefox
pnpm verify:webforms     # darkModeSelector:false + light-preset byte-stability, unchanged
```

**e2e additions** (extend `tests/e2e/theming.spec.ts` or add a sibling
`tests/e2e/contrast.spec.ts`, following the existing `seedTheme`/
`resolveColor`/`brightness` helper pattern):
- Seeding `contrast: 'high'` in the persisted blob stamps
  `data-ff-contrast="high"` with no light/normal flash on first load
  (mirrors the existing dark-mode no-flash test).
- The Settings contrast select flips the attribute live and it persists
  across a reload.
- The four combined states (light/dark × normal/high) each resolve a
  materially different `--odk-base-background-color`/`--odk-text-color`
  brightness pair than their normal-contrast counterpart, in both chrome and
  the mounted preview (the clobber-survival pattern the existing dark test
  already proves must extend to the `data-ff-contrast` attribute too — mount
  the preview and re-assert the attribute + a resolved AAA-range colour
  still hold).
- A `page.emulateMedia({ forcedColors: 'active' })` smoke pass: the page
  still renders, a focused element still shows a visible outline, no
  wholesale layout collapse (a coarse regression net around Task 12 — the
  detailed audit is manual).

**`/interface-craft`** — Task 11's design-critique pass, before Task 5's CSS
is finalized.

**`/agent-browser` manual pass** (log to
`docs/verification/2026-07-16-high-contrast-mode/`, screenshots +
a short README following the `docs/verification/theming/` precedent):
- All four scheme×contrast combinations, chrome and the embedded preview,
  each screenshotted.
- The Settings Appearance section shows the new three-state select next to
  the scheme select; changing it updates the app live with no reload.
- The category type-chips in the palette/canvas show borders + labels (not
  tint fills) under high contrast; shadows read as hard lines, not soft
  blurs.
- Focus indicators are visibly thicker/higher-contrast under high contrast
  while tabbing through the canvas and Settings.
- A `forced-colors: active` DevTools emulation pass over the editor,
  Settings, and an open preview — screenshot anything that reads as broken
  (invisible focus, a swatch that lost its meaning, unreadable text) and
  file it as a Task 12 follow-up if not already fixed.
- The embed demo host (`/embed-demo.html`) sets `contrast: 'high'` via
  `set-config` and the embedded builder follows.

**`/code-review`** (five lenses, no plan mode) on the wave diff; fix
findings immediately, before commit.

**Conventional commit(s)** — no self-attribution trailer. Then the Task 13
docs sweep, in the same change.
