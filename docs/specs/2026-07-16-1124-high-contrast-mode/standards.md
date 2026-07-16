# Standards & conventions — high-contrast mode

Repo invariants from `CLAUDE.md` that constrain this feature, each with how it
applies here, followed by the process skills the delivery will use.

## CLAUDE.md hard invariants that apply

### Byte-identical PrimeVue preset + `darkModeSelector: false`

Both PrimeVue installs (this app and `@getodk/web-forms`) must keep
`darkModeSelector: false` and the byte-identical light preset — the invariant
theming was designed around. High contrast rides the **same** mechanism dark
mode uses: committed static override CSS keyed on attribute selectors
(`:root[data-ff-contrast="high"]`, specificity 0,2,0 / the compound forms at
0,3,0), living in Vite-owned stylesheets neither PrimeVue runtime rewrites.
No new runtime PrimeVue configuration is introduced. `pnpm verify:webforms`
and `theme-parity.spec.ts` must stay green unchanged.

### `src/core/` is pure TS

Contrast is pure UI/theming — `src/core/` is not touched. `src/theme/
constants.ts` stays a pure module (no Vue/DOM/i18n imports) so the new
`ContrastPref`/`ResolvedContrast` types, guards, and `resolveContrast` can be
imported from the Node generator (`scripts/theme-css-lib.mjs`), the ui store,
the embed coercion, and the inline-script agreement test alike — exactly how
`ThemeScheme`/`AccentId` are shared today.

### Persistence goes through established, additive patterns

No new persistence tables and no `WORKSPACE_FORMAT_VERSION` bump. `contrast`
is an additive field on the existing ui-store localStorage blob
(`odk-builder:ui:v1`, `STORAGE_VERSION` unchanged at 1) — the same additive
pattern `theme`/`accent` used when they were introduced. `applyPreferences`
is lenient per-field (unknown/invalid values are ignored), so a
`preferences.json` from an older archive that lacks `contrast` restores
cleanly, and an older build reading a newer archive simply ignores the field
it doesn't know. No `gatherWorkspaceBackup`/`importWorkspaceBackup` code
changes: the ui store owns `exportPreferences`/`applyPreferences` and the
archive treats `preferences.json` as opaque JSON.

### Generated theme CSS is committed + drift-gated

The new `src/styles/generated/theme-contrast-accents.css` follows the exact
discipline of `theme-dark.css`/`theme-accents.css`: produced by a pure
function in `scripts/theme-css-lib.mjs`, written by the `pnpm generate:theme`
CLI, committed, and drift-gated by an extension to
`tests/unit/theme-generated.spec.ts` (byte-identity against a fresh
regeneration). Never hand-edited. The hand-authored counterpart
(`src/styles/builder-contrast.css`) is not generated — like
`builder-dark.css` — but is instead protected by a new ratio-enforcing unit
spec that plays the same "don't silently regress" role the drift gate plays
for generated files.

### No undefined CSS custom properties

`pnpm lint` runs stylelint's `value-no-unknown-custom-properties` over
`src/**/*.{css,vue}`. Every new custom property this feature declares
(`--builder-contrast-*` if any are introduced, plus any newly-referenced
tokens) must resolve through the `importFrom` list in `stylelint.config.mjs`
— register `src/styles/builder-contrast.css` and
`src/styles/generated/theme-contrast-accents.css` there alongside the
existing dark/accent entries. Any new bare `:style`-injected property needs
the runtime allowlist entry (see the existing `--accent-swatch-color`
precedent) — not expected here since the contrast select is a plain
`<Select>`, not a swatch picker.

### UI strings only via vue-i18n

All new copy (the contrast select's label and its three option strings) goes
in the typed catalog under `appSettings.appearance.*` in
`src/i18n/locales/en/appSettings.json`; `no-missing-keys` is an error.
Existing rendered English stays byte-stable — only the new Appearance-section
copy is added.

### Preserve `data-testid`s

Every existing testid (`settings-theme-select`, `settings-accent-swatches`,
`accent-swatch-<id>`, `theme-toggle`, …) is untouched. The new contrast
control gets its own new testid (`settings-contrast-select`).

### Embed protocol stays additive-only

`contrast` is a new optional `EmbedConfig` key, coerced by
`coerceEmbedConfig` with the shared `constants.ts` guard, applied through
`setEmbedTheme`'s extended signature — mirroring exactly how `theme`/`accent`
were added without a `PROTOCOL_VERSION` bump. No protocol version bump here
either.

### Conventional commits — no self-attribution

Work directly on `main`; conventional-commit messages only. **No
`Co-Authored-By: Claude` trailer or any self-attribution** on any commit —
global user instruction, overriding any default tool behaviour.

## Process skills used for this delivery

- **Dynamic Workflows with parallel Sonnet implementors** — the standard
  delivery mechanism for a shaped spec (per the established delivery
  process); this feature's tasks (constants → apply layer → CSS/generator →
  embed → Settings UI → docs) split across a small number of largely
  independent streams sharing `src/theme/constants.ts` as the pivot.
- **`/interface-craft`** — a design-critique pass in implementation to settle
  the decoration-reduction specifics the shaping doc left open (exact
  selectors/values for flattening shadows, converting category tints to
  borders + labels, the focus-ring treatment). Load before finalizing
  `builder-contrast.css`.
- **`/agent-browser`** — manual verification pass across all four
  scheme×contrast render states (chrome + embedded preview), the header
  toggle unaffected, the Settings three-state select, persistence across
  reload, and a `forced-colors: active` emulation pass. Screenshots logged to
  `docs/verification/`.
- **`/code-review`** — five-lens review of the wave diff (no plan mode);
  findings fixed immediately, before commit.
- **`docs/verification/` logging** — the agent-browser pass and the
  forced-colors audit findings are written up and screenshotted there (new
  `docs/verification/2026-07-16-high-contrast-mode/` folder), following the
  precedent of `docs/verification/theming/`.
