# Skills & Conventions for Theming

The following skills and conventions apply to this work.

---

## unops-toolkit:shape-spec (skill)

- **Source:** `plugins/unops-toolkit/skills/shape-spec/` (invoked to promote the
  backlog proposal into this timestamped spec folder).
- **Why it applies:** the delivery process (CLAUDE.md) requires a shaping doc →
  timestamped spec folder (shape/plan/references/standards/user-guide) before
  parallel implementation.

## unops-toolkit:code-review (skill) — at delivery

- **Why it applies:** the delivery process runs `/code-review` (five lenses, no
  plan mode) on the wave diffs, fixing findings immediately before commit.

## agent-browser / verify (skills) — at delivery

- **Why it applies:** verification includes a manual agent-browser pass over the
  built app (both schemes × each accent, chrome + preview, the clobber
  regression, no-FOUC reload), logged to `docs/verification/theming/`.

---

## CLAUDE.md hard invariants that apply

### Byte-identical PrimeVue preset + `darkModeSelector: false`

This is the invariant theming was designed *around*, not against. Both this app
and `@getodk/web-forms` install PrimeVue with `darkModeSelector: false`, and the
runtime `:root { --p-* }` emission stays byte-identical to the web-forms bundle.
The `#3e9fcc` primary scale and the light values in `src/styles/odk-tokens.css`
are never touched. Dark mode and accents are delivered **entirely by committed
static CSS** keyed on `:root[data-ff-theme="dark"]` / `:root[data-ff-accent="…"]`
(specificity 0,2,0, in Vite-owned stylesheets PrimeVue never rewrites) — the
runtime dark mode is **never** enabled. `pnpm verify:webforms` +
`theme-parity.spec.ts` keep all prior assertions and add a `darkModeSelector:
false` guard.

### `src/core/` is pure TS

Theming is pure UI — `src/core/` is untouched. `src/theme/constants.ts` is itself
a pure module (no Vue/DOM/i18n) so it can be imported from the Node generator,
the store, the embed coercion, and the inline-script agreement test alike.

### Persistence

No new persistence tables. `theme` / `accent` are additive fields on the existing
ui-store localStorage blob (`odk-builder:ui:v1`), `STORAGE_VERSION` unchanged at
1, validated on load and added to the watcher — exactly like `locale`.

### UI strings only via vue-i18n

All new copy is in the typed catalog under `appSettings.appearance.*` (each
`AccentDef.i18nKey` is e.g. `appSettings.appearance.accent.blue`);
`no-missing-keys` is an error and keys are vue-tsc-checked. Rendered English is
byte-stable except the genuinely-new Appearance/toggle copy.

### Preserve `data-testid`s

Existing testids are untouched; the header toggle and Appearance controls add
their own.

### Conventional commits — NO self-attribution

Conventional commits on `development`. **No `Co-Authored-By: Claude` trailer or
any self-attribution** — global user instruction.

---

## How to regenerate the theme CSS

```bash
pnpm generate:theme
```

Runs `scripts/generate-theme-css.mjs`, which writes
`src/styles/generated/theme-dark.css` and `theme-accents.css` from the pure
generators in `scripts/theme-css-lib.mjs` (against `src/styles/odk-preset.ts` +
`src/theme/constants.ts`). It is a **deliberate act** — the output is committed
and reviewed as a normal diff. Re-run it whenever:

- **PrimeVue / `@primeuix/themes` is bumped** (the emission may change) — the
  drift gate below fails until you regenerate + commit.
- **`odkPreset` changes** — e.g. the inert `colorScheme.dark` surfaces are
  re-curated (light values must stay byte-stable — that is separately guarded).
- **An accent is added, removed, or its anchor tweaked** (see below).

Never hand-edit the files in `src/styles/generated/` — they carry a
"GENERATED FILE — do not edit by hand" header and any manual change is reverted
by the next regeneration. Hand edits belong in `src/styles/builder-dark.css`
(the `--odk-*` / `--builder-*` alias companion), not in the generated files.

## The drift gate

Two guards keep the committed CSS honest:

1. **Regeneration equality (unit suite)** — a spec re-runs
   `generateThemeDarkCss()` / `generateAccentsCss()` and asserts the committed
   `src/styles/generated/*.css` equal a fresh regeneration. A stale file (e.g.
   after an un-regenerated PrimeVue bump) fails the unit suite; the fix is
   `pnpm generate:theme` + commit.
2. **`darkModeSelector: false` + light-parity guard (`pnpm verify:webforms` /
   `theme-parity.spec.ts`)** — asserts both PrimeVue installs keep
   `darkModeSelector: false` (an upstream default of `"system"` would inject
   competing media-query dark blocks) and that the light preset / `#3e9fcc`
   scale / `--odk-*` tokens stay byte-identical to the web-forms bundle. This
   proves the generated CSS never enabled runtime dark mode.

## Adding a new accent

1. **`scripts/theme-css-lib.mjs`** — add an entry to `ACCENT_GEN`
   (`{ id, anchor }`, plus `contrast: 'var(--p-surface-900)'` only if white-on-500
   fails WCAG AA — see amber). The `anchor` is fed to `palette()`; check the
   effective 500 clears AA for white button text, and pick a darker anchor if not
   (see green: raw `#16A34A` → nudged `#0f7c39`).
2. **`src/theme/constants.ts`** — add the id to the `AccentId` union and an
   `ACCENTS` entry with `hex500` set to the **effective** rendered 500 (run
   `pnpm generate:theme` and read the logged `accentPrimary500()` map — the
   swatch must match what renders, not the raw anchor) and an `i18nKey` of
   `appSettings.appearance.accent.<id>`.
3. **`src/i18n/locales/en/appSettings.json`** — add the
   `appearance.accent.<id>` label (`no-missing-keys` fails otherwise).
4. **`pnpm generate:theme`** — regenerate + commit `theme-accents.css`; the
   drift gate then passes. No dark-specific block is needed: the dark map already
   references `var(--p-primary-400)` etc., so re-tinting `--p-primary-*` re-tints
   both schemes.

Removing or reordering accents is the same three-file edit (`ACCENT_GEN`,
`ACCENTS`, the i18n labels) plus a regenerate; `ACCENTS` order is the swatch
order in Settings.
