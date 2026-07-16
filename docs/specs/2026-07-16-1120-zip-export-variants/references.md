# References — ZIP export variants

File:line references verified against code on 2026-07-16 (these correct the
backlog doc's "current implementation" notes, which described the shapes
approximately rather than exactly).

## Core: `src/core/export/zip.ts`

- `exportZip` (`zip.ts:20-44`) is **already async** and returns
  `Promise<ExportZipResult>` — `{ data: Uint8Array, issues: Issue[] }`
  (interface at `zip.ts:12-15`). The backlog doc's `exportZip(doc, blobs)`
  signature note is accurate on the surface but did not flag the `blobs`
  key.
- **`blobs: Map<string, Blob | Uint8Array>` is keyed by attachment `id`
  (`ref.id`), not by filename** (`zip.ts:29`, `blobs.get(ref.id)`). Any new
  variant helper must keep looking up by `ref.id`.
- `form.xml` is written at the ZIP root at `zip.ts:26`
  (`zip.file('form.xml', xml)`), immediately after `serializeXForm(doc)` at
  `zip.ts:24`.
- The media loop is `zip.ts:28-40`: iterates `doc.attachments`, looks up the
  blob by id, pushes an `export.missing-attachment` **warning** `Issue`
  (`zip.ts:31-37`) and `continue`s when absent, otherwise writes
  `media/<filename>` (`zip.ts:39`) via the local `toBytes` helper
  (`zip.ts:17-18`, `Blob → arrayBuffer → Uint8Array` conversion, identity
  for `Uint8Array` input).
- `zip.generateAsync({ type: 'uint8array' })` at `zip.ts:42`.
- Co-located spec `src/core/export/zip.spec.ts` (48 lines): the first test
  (`:11-34`) pins the archive layout (`form.xml`, `media/`, `media/*`
  entries) and XML content; the second (`:36-47`) pins the missing-blob
  warning + that the entry is skipped, not failed.

## Core: `src/core/xlsform/writer.ts`

- `writeXlsForm` (`writer.ts:258-266`) is `async`, signature
  `(doc: FormDocument) => Promise<Uint8Array>`, pure core (no Vue/Pinia/
  Dexie/i18n imports — only `./workbook-write` and `../model/types`). It
  builds sheets (survey/choices/settings/entities + `unknown.extraSheets`)
  and delegates to `writeWorkbook` (`workbook-write.ts`). This is the exact
  function the standalone XLSForm export already calls
  (`ExportMenu.vue:52`) and the one the new ZIP variant reuses — no new
  entry point needed in `writer.ts`.

## UI: `src/components/importexport/ExportMenu.vue`

- `SplitButton` root at `:123-132`, `data-testid="export-button"` at `:130`
  — unchanged by this feature.
- `baseName` (`:24-27`): `` `${settings?.formId ?? 'form'}-${settings?.version ?? ''}` ``
  with a trailing-dash strip (`.replace(/-$/, '')`) for when `version` is
  empty. The new suffixed filenames are built from this same computed —
  `` `${baseName.value}-xform.zip` `` / `` `${baseName.value}-xlsform.zip` ``.
- `secondaryActions` (`:74-83`) is gated per-item by
  `embed.exportEnabled(kind)` — `'xlsform'` at `:76`, `'zip'` at `:79`. Both
  new ZIP entries stay gated on the same `embed.exportEnabled('zip')` call
  (single flag, per the resolved decision) — do not introduce a second
  `exportEnabled` kind.
- `exportZipBundle` (`:57-66`): fetches attachment blobs via
  `listAttachments(form.recordId)` (`:59`, from
  `@/persistence/attachments-repo`), builds the `Map<id, blob>` (`:60`),
  calls `exportZip` (`:61`), surfaces every `severity: 'warning'` issue as a
  toast (`:62-64`), then `downloadBlob` (`:65`, from
  `@/composables/useDownload`). This whole function becomes
  variant-parameterized; the blob-fetch + warning-toast loop is identical
  for both variants (only the `exportZip` call's variant argument and the
  download filename/mediatype differ).
- Every export path is gated by `blockOnErrors()` (`:31-42`, checks
  `form.errorCount > 0`) — both ZIP variants keep this gate, matching
  `exportXml`/`exportXlsx`/the current `exportZipBundle`.
- `ExportAction` interface (`:68-72`) and the `items`/`primary` computeds
  (`:87-119`) assemble the menu; the primary click promotes
  `secondaryActions.value[0]` when the host has hidden `xform`
  (`:87-90`) — unaffected by adding a second ZIP entry, since it always
  reads index `[0]`, not a fixed count.

## i18n: `src/i18n/locales/en/importExport.json`

- `importExport.export.xlsformItem` = `"XLSForm (.xlsx)"` at `:16`.
- `importExport.export.zipItem` = `"ZIP with attachments"` at `:17` — the
  key this feature retires, replaced by `zipXformItem` / `zipXlsformItem`.
- The rest of the `importExport.export.*` tree (`label`, `moreOptions`,
  `blockedSummary`, `blockedDetail`, `warningSummary`,
  `summaryBlocked`/`summaryReady`/`summaryUntranslated`/`summarySeparator`)
  is untouched.

## Embed protocol/store — confirmed no change needed

- `EmbedExportsConfig { xform?, xlsform?, zip? }`
  (`src/embed/protocol.ts:17-20`), merged per-key in
  `src/stores/embed.ts` (`applyConfig`, `exports` merge) and read via
  `exportEnabled(kind)` (`embed.ts`, near the bottom of the store). The
  resolved single-`zip`-flag decision means **neither file changes** —
  `exportEnabled('zip')` continues to gate both new menu entries with no
  new `kind` value.
- `docs/specs/2026-07-09-2235-embed-postmessage-api/user-guide.md:73,85`
  documents the `exports` config example
  (`{ "xform": false, "xlsform": false, "zip": false }`) and its
  description ("hides the builder's own download actions... all three
  `false` removes the Export button entirely"). Still accurate after this
  change (three keys, same semantics) — worth a one-line addition at
  delivery noting `zip` now covers two menu entries, but no structural edit.

## Tests

- `tests/e2e/import-export.spec.ts` — the first test (`:4-43`) clicks the
  menu's caret (`:26`/`:37`, `getByRole('button').last()`), then a specific
  `menuitem` by name: `:29` for `'XLSForm (.xlsx)'`, `:40` for `'ZIP with
  attachments'` (to retire), with the filename assertion at `:42`
  (`/\.zip$/`). Both the menu-item name and the filename regex need
  updating in lockstep for the XForm-ZIP case, and a new case added for the
  XLSForm-ZIP variant (menu item `'ZIP · XLSForm + attachments'`, filename
  matching `/-xlsform\.zip$/`).
- `src/core/export/zip.spec.ts` — extend with an `'xlsform'`-variant test:
  root entry is `form.xlsx` (assert via the zip-container magic bytes `0x50
  0x4b` — the same signature check the e2e XLSForm-export assertion already
  uses at `import-export.spec.ts:33-34` — or by reading it back through the
  xlsform reader), `media/` parity with the existing xform-variant test,
  and the missing-attachment warning still fires for this variant too.

## Related delivered specs worth reading

- `docs/specs/2026-07-09-1750-xlsform-reader-writer-zip/` — the original
  delivery of `writeXlsForm`/`readXlsForm` and the first cut of ZIP export;
  useful for the writer's design rationale (canonical column order,
  translated-column expansion) even though this feature does not touch
  writer internals.
- `docs/specs/2026-07-09-2235-embed-postmessage-api/` — the `exports` embed
  config (`xform`/`xlsform`/`zip` keys) this feature deliberately leaves
  unchanged; its `user-guide.md` is the doc-sweep touch point if the
  wording is refreshed to mention two ZIP variants.
- `docs/specs/2026-07-15-1729-workspace-full-backup/` — a good example of
  the shape/plan/references/standards/user-guide doc set this promotion
  follows, and a reminder of how different the `.formforge.zip`
  **workspace** archive format is from the plain per-form ZIP export this
  feature touches (out of scope here, never confuse the two).
