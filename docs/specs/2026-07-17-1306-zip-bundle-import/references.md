# References for ZIP bundle import

## Similar Implementations

### Per-form export ZIP (the layout to consume)

- **Location:** `src/core/export/zip.ts:25` (`exportZip(doc, blobs, variant)`)
- **Relevance:** produces exactly the structure the importer must read:
  `form.xml` (variant `'xform'`) or `form.xlsx` (variant `'xlsform'`) at the
  root plus `media/<filename>` per attachment. No manifest, no mediatype
  metadata, JSZip default STORE.
- **Key patterns:** the round-trip unit tests build fixtures with the real
  `exportZip` so import is verified against the true producer.

### ODK Central importer (the assembly template)

- **Location:** `src/core/central/import.ts:60-107`
- **Relevance:** the only existing path that lands a parsed form **with**
  attachments. Documents the load-bearing detail: `parseXForm` leaves
  `document.attachments = []`, so the importer must rebuild refs
  (placeholder `id: ''`, `roleFor(filename, mediatype)`, `size: blob.size`)
  and return `ArchiveAttachment[] = {filename, mediatype, blob}`.
- **Key patterns:** `normalizeDefaultContent` at the import boundary;
  `DEFAULT_MEDIATYPE` fallback; issues flow into the shared `ImportReport`.

### Landing primitives (persistence)

- **Location:** `src/persistence/forms-repo.ts:47-158` —
  `remapAttachments` (filename-keyed join, `dropUnmatched: true`),
  `createFormWithArchiveAttachments` (`:83`),
  `replaceFormWithArchiveAttachments` (`:126`, keeps record id → publish
  targets survive).
- **Relevance:** the ZIP path reuses these unchanged; no new persistence code.

### Workspace archive reader (JSZip read conventions + rejection copy)

- **Location:** `src/core/workspace/archive.ts:386-454`
  (`readWorkspaceArchive`), `:244-248` (`parseJsonFile`), `:57`
  (`DEFAULT_MEDIATYPE`), `:59-63` (`ArchiveAttachment`).
- **Relevance:** shows the JSZip idioms (`loadAsync`, `zip.file(path)`,
  `.async('uint8array')`) and the manifest-based detection that
  distinguishes `.formforge.zip` from a form bundle. Its
  `workspace.not-an-archive` message already points bundle-shaped confusion
  the other way ("use Import form").

### Collision flow (copy vs replace)

- **Location:** `src/components/central/LibraryCentralDrawer.vue:143-180`
  (lookup by `doc.settings.formId`, `landCopy`/`landReplace` with danger
  `confirm.require`), template `:229-249` (inline collision block with
  `library-central-collision-*` testids).
- **Key patterns:** extracted into the shared
  `src/components/importexport/ImportCollisionPanel.vue`; each host keeps its
  own i18n namespace and confirm copy.

### Single-file import dialog (the surface being extended)

- **Location:** `src/components/importexport/ImportDialog.vue`,
  `src/core/import-form.ts:24` (`parseFormFile` extension/magic-byte
  dispatch), `src/components/importexport/FileDropzone.vue`,
  `src/components/importexport/ImportReport.vue`.
- **Relevance:** `.zip` joins the accept list; the `PK` sniff branch must now
  inspect zip entries (bundle vs workspace archive vs bare `.xlsx`).

## Pinned tests (must not break)

- `tests/e2e/import-export.spec.ts` — "not an XForm" message substring;
  testids `import-form`, `import-file-input`, `import-report`,
  `import-confirm`; XForm/XLSForm round-trips.
- `tests/unit/import-form.spec.ts` — `parseFormFile` dispatch matrix.
- `tests/component/import-from-central.spec.ts` — copy-vs-replace collision
  behavior + `library-central-collision-*` testids (survive panel extraction).
- `tests/component/workspace-archive-dialog.spec.ts` — the other ZIP surface
  stays untouched.

## i18n

- Catalog file owning the namespace:
  `src/i18n/locales/{en,fr,es}/importExport.json`.
- fr/es terminology anchored to the glossary in
  `docs/specs/2026-07-16-1125-ui-localization-fr-es/`.
