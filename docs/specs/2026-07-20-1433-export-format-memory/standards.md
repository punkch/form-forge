# Standards & Conventions for Export Format Memory

These are the repo invariants (from `CLAUDE.md`) that bind this work, with the
specific way each applies here.

---

## Additive guarded persisted field — never bump `STORAGE_VERSION`

- **Source:** `CLAUDE.md` (ui store bullet); enforced in practice by
  `src/stores/ui.spec.ts` "pins the storage version at 1" test.
- **Why it applies:** `lastExportFormat` is a new persisted ui pref.
- **Key points:** `loadPersisted` returns `{}` on a version mismatch, wiping
  every saved pref. So the new field MUST be optional and validated on read
  (`sanitizeExportFormatMap`) — like `hiddenBundledTemplates` /
  `dismissedCallouts` — and `STORAGE_VERSION` stays `1`.

## Backup rides `preferences.json` — no `WORKSPACE_FORMAT_VERSION` bump

- **Source:** `CLAUDE.md` (whole-workspace backup invariant; ui store owns
  `exportPreferences`/`applyPreferences`).
- **Why it applies:** the field must survive Export/Import workspace.
- **Key points:** adding the field to `exportPreferences`/`applyPreferences` (and
  to `PersistedUiState`, from which `UiPreferences = Omit<…,'version'>` derives)
  is sufficient — it rides the existing `preferences.json` section. This is
  purely additive optional content, so **do not** bump
  `WORKSPACE_FORMAT_VERSION` (a needless bump makes a slightly-stale app reject
  an entire backup).

## UI strings only via vue-i18n; fr/es in lockstep; English byte-stable

- **Source:** `CLAUDE.md` (UI strings invariant); `MessageSchema = typeof en`,
  fr/es `satisfies` it.
- **Why it applies:** new primary/dropdown labels + one removed key.
- **Key points:** every key added/removed in `en/importExport.json` gets the
  same change in `fr/` and `es/` or `pnpm typecheck` fails. Keep every existing
  export string byte-identical (component + e2e tests assert them; the readiness
  summary strings especially).

## Motion only via `--builder-motion-*` tokens

- **Source:** `CLAUDE.md` (Motion invariant); tokens in `builder.css :root`.
- **Why it applies:** the primary-label crossfade.
- **Key points:** no literal timings — use `--builder-motion-duration-s`
  (120 ms) + `--builder-motion-ease-standard`. Exit/entry ≤ 200 ms. The single
  global `prefers-reduced-motion` blanket in `builder.css` covers the animation;
  add **no** per-component reduced-motion gate.

## No undefined CSS custom properties (stylelint)

- **Source:** `CLAUDE.md` (stylelint invariant, `stylelint.config.mjs`,
  `value-no-unknown-custom-properties`), run by `pnpm lint`.
- **Why it applies:** the new scoped `@keyframes`/animation in `ExportMenu.vue`.
- **Key points:** only reference already-defined `--builder-motion-*` tokens (in
  `importFrom`). Introduce **no** new bare `:style`-injected custom property (the
  animation uses class toggling, not an injected var), so no allowlist edit is
  needed.

## Preserve `data-testid`s

- **Source:** `CLAUDE.md`.
- **Why it applies:** e2e + component helpers depend on `export-button`.
- **Key points:** keep `data-testid="export-button"` on the SplitButton. The
  active menu item is distinguished by the `export-format-active` class (PrimeVue
  applies a model item's `class`). Menu items remain selectable by their
  accessible name (existing e2e pattern: `getByRole('menuitem', { name })`).

## Conventional commits; work on `main`; no self-attribution

- **Source:** `CLAUDE.md` + user global instructions.
- **Key points:** one conventional commit for the feature; **never** append a
  `Co-Authored-By: Claude …` trailer.
