# F1 — Workspace Export / Import — Plan

## Goal

Protect users against browser-profile resets, enable moving a whole form
library between machines, and enable handing a lossless single form (with
attachments and builder state) to a colleague — all without a server.
Everything stays client-side: a `.formforge.zip` archive downloaded and
re-imported through the browser.

## Container format

```text
manifest.json                            { formatVersion: 1, exportedAt, appVersion,
                                           forms: [{ recordId, formId, title }] }
forms/<recordId>/form.json               FormDocument (JSON)
forms/<recordId>/meta.json               { title, formId, version, createdAt, updatedAt }
forms/<recordId>/attachments/<filename>  raw blobs
```

Two independent version numbers:

- `manifest.formatVersion` versions the **container** (zip layout).
- `FormDocument.schemaVersion` versions each **document payload**; every doc
  read from an archive passes through `migrateDoc()`.

Autosave snapshots are **not** included (see shape.md).

## Stage 1 — core + persistence (this change)

### `src/core/model/migrate.ts` (new)

`migrateDoc(raw: unknown): { doc: FormDocument | null, issues: Issue[] }` —
the single entry point for documents sourced outside the running app.
Version 1 is the only schema, so it is a tolerant gate: non-object /
missing top-level fields → error `doc.malformed`; `schemaVersion` missing
or ≠ 1 → error `doc.schema-version-unsupported`; otherwise the raw value
passes through as a `FormDocument`. Future schema bumps add stepwise
`migrateV1toV2`-style functions here.

### `src/core/workspace/archive.ts` (new, pure — no Dexie/Vue)

- `ArchiveFormInput { recordId, meta, doc, attachments: [{ filename,
  mediatype, blob }] }`; `ParsedArchiveForm` is the same shape on the read
  side.
- `buildWorkspaceArchive(forms, appVersion, exportedAt): Promise<Uint8Array>`
  — jszip, mirroring `src/core/export/zip.ts`.
- `readWorkspaceArchive(data: ArrayBuffer): Promise<{ forms, issues }>` —
  corrupt zip → `workspace.invalid-archive`; readable zip without a
  `manifest.json` → `workspace.not-an-archive` (message hints that .xlsx
  workbooks are also zips and points at "Import form"); `formatVersion`
  missing/greater → `workspace.format-version-unsupported`; a form whose
  files are missing/corrupt is skipped with `workspace.form-unreadable`
  while the rest still parse; each doc runs through `migrateDoc`.
  Attachment mediatypes are recovered from the doc's `attachments` refs
  (zip entries carry none).

### `src/persistence/workspace-io.ts` (new)

- `gatherArchiveForms(recordIds?)` — all forms (library order) or a subset
  (per-form export). Attachment blobs are looked up **strictly via
  `doc.attachments[].id`** through the attachments repo, so orphaned
  attachment records (e.g. left behind by an AttachmentsDialog re-upload)
  never leak into an export; refs whose blob is gone are silently omitted
  (matching `export.missing-attachment` semantics at the zip layer).
- `importArchiveForms(parsed): Promise<{ imported, issues }>` — one Dexie
  `rw` transaction **per form** (a bad form never rolls back the rest):
  fresh record id, fresh attachment ids remapped into `doc.attachments`
  exactly like `duplicateForm` (`src/persistence/forms-repo.ts`), refs
  matched to blobs by filename; `meta.createdAt` preserved, `updatedAt` =
  import time; `formId` collision with any existing form → warning
  `workspace.duplicate-form-id`, form imported anyway; unexpected failure →
  error `workspace.import-failed` for that form only.

### Tests (stage 1)

- `src/core/model/migrate.spec.ts` — v1 pass-through, missing/greater
  schemaVersion, non-object and shape failures.
- `src/core/workspace/archive.spec.ts` — build→read round-trip with
  post-JSON-round-trip deep equality incl. attachment bytes; corrupt zip;
  missing manifest; unsupported formatVersion; partial failure tolerance;
  unsupported doc schemaVersion inside an otherwise valid archive.
- `src/persistence/workspace-io.spec.ts` (fake-indexeddb, pattern:
  `forms-repo.spec.ts`) — orphan-safe gathering, subset gathering, dangling
  refs; import creates new ids, remaps attachments (readable blobs),
  preserves createdAt, warns on formId collisions; full
  gather → build → read → import loop across a simulated wipe.

## Stage 2 — UI (follow-up change)

- **Library overflow menu** (`src/views/FormLibraryView.vue` header gains a
  `...` Menu next to "Import form" / "New form"):
  - "Export workspace" → `gatherArchiveForms()` →
    `buildWorkspaceArchive(forms, APP_VERSION, new Date().toISOString())` →
    `downloadBlob(data, 'workspace-<date>.formforge.zip', 'application/zip')`
    via `src/composables/useDownload.ts`. `APP_VERSION` comes from a
    `__APP_VERSION__` Vite define (package.json version) added alongside.
  - "Import workspace" → opens `WorkspaceArchiveDialog`.
- **Per-row menu** (existing `menuItems` in `FormLibraryView.vue`): add
  "Export form archive" → `gatherArchiveForms([record.id])` → same build +
  download path, filename `<formId>.formforge.zip`. This is the lossless
  "share this form" story, distinct from the XLSForm/XForm `ExportMenu`.
- **`src/components/importexport/WorkspaceArchiveDialog.vue`** (new,
  modeled on `ImportDialog.vue`): drop-zone + file picker accepting `.zip`;
  runs `readWorkspaceArchive`, lists the forms found (title, formId,
  attachment count) plus issues (errors block, warnings don't — same
  severity split as `ImportDialog`); "Import N forms" button calls
  `importArchiveForms`, then shows the result summary including any
  `workspace.duplicate-form-id` warnings; library list refreshes.
  `shallowRef` for parsed docs (structured-clone constraint, same as
  `ImportDialog`).
- **Library warning surface**: duplicate-formId warnings surface as a toast
  / inline notice after import (chip on the row is a possible later polish).
- New `data-testid`s (new elements only — existing testids and all existing
  user-visible strings stay byte-identical): `library-overflow-menu`,
  `export-workspace`, `import-workspace`, `export-form-archive`,
  `workspace-archive-dialog`, `workspace-archive-drop`,
  `workspace-archive-import`.

### Tests (stage 2)

- Component test for `WorkspaceArchiveDialog` (happy-dom): parse → list →
  import wiring, error gating.
- e2e `tests/e2e/workspace-archive.spec.ts`: create two forms (one with an
  attachment), export workspace (capture download), **wipe site data**
  (clear IndexedDB via `page.evaluate`), reload → empty library, import the
  captured archive → both forms restored with question counts, attachment
  present and byte-identical, formId collision warning exercised by
  importing twice.

## Verification

- Stage 1: `pnpm vitest run` on the three new spec files, `pnpm typecheck`,
  eslint on changed files — green (full-project typecheck currently also
  compiles the parallel F4 i18n work).
- Stage 2: full unit + component suite, e2e wipe/restore loop run by the
  orchestrator, manual pass per `user-guide.md`.
