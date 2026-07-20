# References for Export Format Memory

## Files studied (and what to borrow)

### `src/components/importexport/ExportMenu.vue`

- **Relevance:** the control being changed.
- **Key patterns:** the `enabledActions` computed is the single ordered list of
  export actions (comment already notes "one list means a promotion never needs
  a second edit site"). `primary = enabledActions[0] ?? null`. The dropdown
  `items` = readiness-summary (disabled, **function** label so the untranslated
  walk runs only when open) + separator + `enabledActions.slice(1)`. Reuse all
  of this; add ids + primaryLabels, resolve `primary` from memory, drop the
  `.slice(1)`, add the active marker + pick handler + label crossfade.
- **Borrow the `run` wiring exactly** — `exportXml`, `void exportXlsx()`,
  `void exportZipBundle('xform'|'xlsform')`, each already guards
  `blockOnErrors()` / null doc internally.

### `src/stores/ui.ts` + `src/stores/ui.spec.ts`

- **Relevance:** owns persisted device prefs; the pattern to copy.
- **Key patterns:** `hiddenBundledTemplates` is the exact template for a new
  guarded persisted field — init with a validating helper, add to
  `PersistedUiState`, to `exportPreferences`/`applyPreferences`, to the persist
  `watch` source array + serialized `state`, and to the store's returned API.
  `ui.spec.ts` shows the test shape (persist round-trip, malformed-input
  filtering, `applyPreferences` guards, and the "storage version pinned at 1"
  regression guard). `applyPreferences` validates each field with the same
  guards as load; unknown/invalid fields are ignored (not reset).

### `src/stores/embed.ts`

- **Relevance:** the embed export-filter that already shapes `enabledActions`.
- **Key patterns:** `exportEnabled(kind)` returns `true` outside embed, and in
  embed unless the host set `config.exports[kind] === false`. Because
  `enabledActions` is already built from `exportEnabled`, the memory-fallback
  (`find(id) ?? [0]`) automatically demotes a host-disabled remembered format —
  no extra embed check needed in the primary resolver.

### `src/stores/workspace.ts` (+ `workspace.spec.ts`)

- **Relevance:** the form-deletion chokepoint where the map is pruned.
- **Key patterns:** `deleteForm(id)` → `formsRepo.deleteForm(id)`. It is called
  by `FormLibraryView.confirmDelete`. Add `useUiStore().forgetExportFormat(id)`
  after the repo delete. `workspace.spec.ts` already exercises `createForm` →
  `deleteForm`; extend it to assert the map entry is gone.

### `src/i18n/locales/{en,fr,es}/importExport.json`

- **Relevance:** the strings.
- **Key patterns:** `importExport.export` holds `label`, `moreOptions`,
  `xlsformItem`, `zipXformItem`, `zipXlsformItem`, and the readiness `summary*`
  keys. fr uses "Exporter", es uses "Exportar". The ` · ` middot separator and
  "XForm XML" terminology are already used, so the new labels match house style.

### `src/styles/builder.css`

- **Relevance:** motion tokens + fr/es compact header rules.
- **Key patterns:** `--builder-motion-duration-s: 120ms`,
  `--builder-motion-ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` in `:root`
  (lines ~67-75); the global `prefers-reduced-motion` blanket; and
  `html:is([lang='fr'],[lang='es']) .app-header …` compact rules (~line 219+)
  that shrink header button labels — the place to extend if the longer fr/es
  primary label overflows the editor header.

## e2e specs that reference the export button

- `tests/e2e/import-export.spec.ts` — `:17` primary XML click (by
  `name:'Export'`, **must change to `.first()`**); `:26/:37/:45/:98/:101`
  menu-driven picks by menuitem name (no change).
- `tests/e2e/translations.spec.ts` — `:63` and `:228` primary XML clicks (by
  `name:'Export'`, **must change to `.first()`**).
- `tests/e2e/entities.spec.ts` — `:56` `.last()` + `XLSForm (.xlsx)` menuitem
  (no change).
- `tests/e2e/embed.spec.ts` — `:51` asserts the export button vanishes when all
  exports are disabled (no change; `primary` is `null` when `enabledActions` is
  empty).

## Reference spec folder (layout to match)

- `docs/specs/2026-07-20-1305-template-management/` — same five-file layout
  (`plan.md`, `shape.md`, `standards.md`, `references.md`, `user-guide.md`).
