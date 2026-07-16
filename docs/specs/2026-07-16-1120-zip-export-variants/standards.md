# Standards & conventions — ZIP export variants

Repo invariants from `CLAUDE.md` that constrain this feature, and the
process skills used to deliver it.

## Hard invariants that apply

### `src/core/` is pure TS

`src/core/export/zip.ts` stays free of Vue/Pinia/Dexie/vue-i18n imports. It
already imports only `jszip`, `../model/types`, `../validate/issues`, and
`../xform/serializer`; adding the XLSForm variant adds one more pure-core
import, `../xlsform/writer` (`writeXlsForm`), which is itself pure core — no
new dependency, no purity violation. Both variants keep emitting the shared
`export.missing-attachment` **warning** `Issue` (stable `code` string,
English `message` rendered verbatim) — never a failure, never localized in
core.

### UI strings only via vue-i18n

The two new menu labels are typed catalog keys in
`src/i18n/locales/en/importExport.json` under `importExport.export`
(`zipXformItem`, `zipXlsformItem`), consumed via `useAppI18n().t(...)` in
`ExportMenu.vue` exactly like the existing `xlsformItem`/`label` keys.
`eslint`'s `no-missing-keys` rule (error) and `vue-tsc`'s `StrictTranslate`
typing both catch a missing/misspelled key at build time. Removing the old
`zipItem` key is a **deliberate** rendered-English change (the catalog is
otherwise byte-stable by convention) — the e2e assertions that pin the old
label text must be updated in the same change, not left to drift.

### Preserve `data-testid`s

`export-button` (the `SplitButton` root) is untouched. No new testids are
required: the menu's individual entries have never carried their own
`data-testid`s — `tests/e2e/import-export.spec.ts` already selects them by
accessible role name (`getByRole('menuitem', { name: ... })`), and this
feature keeps that convention for the two new entries rather than
introducing one-off testids.

### No undefined CSS custom properties

Not implicated — this feature adds no new CSS, only text/menu-item-count
changes inside the existing `SplitButton` markup. `pnpm lint`'s stylelint
pass still runs as part of the standard verification gate but nothing here
is expected to touch it.

### Embed protocol evolves additively only

`EmbedExportsConfig.zip` (`src/embed/protocol.ts`) is **not** touched — the
resolved decision keeps a single `zip` flag gating both new variants. This
is the deliberate "no protocol churn" choice: a host that sets
`exports.zip: false` today continues to hide all ZIP-shaped export actions
after this change, with zero migration needed on the host side.

### The `.formforge.zip` workspace archive is untouched

`src/core/workspace/archive.ts` (manifest + `form.json` + attachments,
`WORKSPACE_FORMAT_VERSION`-gated) is a completely different format from the
plain per-form ZIP export this feature touches. Nothing here reads or
writes that module, and no format version changes.

### Conventional commits

Work lands as a conventional commit (e.g. `feat(export): split ZIP export
into XForm and XLSForm attachment bundles`), no `Co-Authored-By` trailer or
other self-attribution (global user instruction, overrides any default
guidance).

## Floors / gates not implicated but worth naming

- `pnpm test:coverage` — `src/core/**` floor (statements ≥86 / branches ≥78
  / lines ≥88) applies to the modified `src/core/export/zip.ts`; the new
  `variant` branch must be covered by both true/false paths in
  `zip.spec.ts`, or the branch floor can regress.
- `tests/golden/` (pyxform parity) is not implicated — `writeXlsForm` is
  reused unchanged, no serializer/parser behaviour changes.
- Both-backend persistence specs are not implicated — this feature touches
  no Dexie table, no `PersistenceBackend` method; it only reads existing
  attachment blobs via the existing `listAttachments` repo call.

## Process skills used

- **Dynamic Workflow, Sonnet implementor(s)** — this is an S-effort,
  single-package change; one implementor package is sufficient (core module
  + component + i18n + both test layers), no wave split needed.
- **agent-browser** — a manual pass over the built app confirming: the
  Export split-button menu shows four entries in the specified order, both
  ZIP downloads land with the suffixed filenames, and each ZIP's contents
  match its variant (open the downloaded file or assert via the existing
  e2e flow). Logged to `docs/verification/2026-07-16-zip-export-variants/`.
- **interface-craft** — not required; no new visual layout, only label text
  and item count inside an existing, unchanged `SplitButton`.
- **`/code-review`** (five lenses, no plan mode) on the diff before commit;
  fix findings immediately rather than deferring them.
- **Docs sweep on delivery** — README Features bullet (currently "✅
  **Export** — XForm XML, XLSForm .xlsx, ZIP with media/CSV attachments"),
  `docs/product/roadmap.md` if it names the ZIP export specifically, and a
  new `CLAUDE.md` code-map row for `src/core/export/` (there is currently no
  row for this module — only `src/core/workspace/archive.ts`, a different
  ZIP format, is listed).
