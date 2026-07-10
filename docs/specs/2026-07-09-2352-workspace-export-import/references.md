# References — Workspace Export / Import

## Files added (stage 1)

- `src/core/model/migrate.ts` — `migrateDoc()` document-schema gate
  (`doc.malformed`, `doc.schema-version-unsupported`).
- `src/core/model/migrate.spec.ts`
- `src/core/workspace/archive.ts` — `buildWorkspaceArchive` /
  `readWorkspaceArchive`, `ArchiveFormInput` / `ParsedArchiveForm` types,
  `WORKSPACE_FORMAT_VERSION`.
- `src/core/workspace/archive.spec.ts`
- `src/persistence/workspace-io.ts` — `gatherArchiveForms` /
  `importArchiveForms`.
- `src/persistence/workspace-io.spec.ts`

## Files to touch in stage 2 (UI)

- `src/views/FormLibraryView.vue` — header overflow menu (export/import
  workspace), per-row "Export form archive" menu item.
- `src/components/importexport/WorkspaceArchiveDialog.vue` (new).
- `tests/e2e/workspace-archive.spec.ts` (new) — export → wipe → import loop.
- `vite.config.ts` — `__APP_VERSION__` define for `manifest.appVersion`.

## Files consulted (unchanged)

- `docs/specs/backlog/workspace-export-import.md` — shaping source.
- `src/core/export/zip.ts` / `zip.spec.ts` — jszip usage pattern mirrored
  (uint8array generation, byte-level round-trip assertions).
- `src/core/model/types.ts` — `FormDocument.schemaVersion`, `AttachmentRef`
  (id/filename/mediatype), "pure data, no Dexie/Vue under src/core/" rule.
- `src/core/validate/issues.ts` — `Issue` shape reused for all archive and
  import diagnostics.
- `src/persistence/db.ts` — `FormRecord` / `AttachmentRecord` shapes;
  `formId` is **not** indexed, so the collision check scans `toArray()`.
- `src/persistence/forms-repo.ts:46-67` — `duplicateForm`'s attachment
  id-remap pattern replicated by `importArchiveForms`.
- `src/persistence/attachments-repo.ts` — `getAttachment` (strict by-id
  lookup used by gathering), `pruneOrphans` (why orphan records exist).
- `src/persistence/forms-repo.spec.ts` — fake-indexeddb test pattern
  (`tests/setup/unit.ts` provides `fake-indexeddb/auto`).
- `src/core/import-form.ts` — PK-zip sniffing precedent behind the
  "an .xlsx is also a zip" hint in `workspace.not-an-archive`.
- `src/components/importexport/ImportDialog.vue` — drop-zone, severity
  split and `shallowRef` (DataCloneError) patterns for the stage-2 dialog.
- `src/composables/useDownload.ts` — `downloadBlob` used by stage-2 export.
- `tests/helpers/doc-builders.ts` — `doc()` / `q()` builders used in specs.
