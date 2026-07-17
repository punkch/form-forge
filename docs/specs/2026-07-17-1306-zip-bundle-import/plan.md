# Import per-form ZIP bundles (form.xml / form.xlsx + media/)

## Context

The app exports a per-form ZIP (`src/core/export/zip.ts` — `form.xml` or
`form.xlsx` at the root plus `media/<filename>` per attachment), but nothing
can import that layout back. Today's import surfaces are: single bare file
(`.xml`/`.xlsx`, no attachments, `ImportDialog.vue`), the manifest-based
`.formforge.zip` workspace archive (Settings), and ODK Central (network).
A user who exported a form bundle — or received one — cannot restore it with
its attachments. Goal: the "Import form" dialog accepts these ZIPs and lands
the form **with** its attachments, round-tripping our own export.

## User decisions (2026-07-17 shaping, fixed)

1. **Entry point:** extend the existing library "Import form" dialog
   (FileDropzone accepts `.zip` too). A `.formforge.zip` workspace archive
   dropped there gets a helpful error pointing to Settings → Import workspace.
2. **form_id collision → Copy/Replace prompt**, mirroring the Central import
   flow (replace keeps the record id and its publish targets). Scope: the
   prompt applies to the **ZIP bundle path only** — plain `.xml`/`.xlsx`
   import stays create-and-open (existing pinned behavior untouched).
3. **Both `form.xml` and `form.xlsx` present → prefer `form.xml`** (lossless
   native format); `.xlsx` ignored with an informational warning.
4. No visuals; standing repo invariants + the Central importer as the
   reference implementation.

## Key facts that shape the design (explored 2026-07-17)

- `exportZip` (`src/core/export/zip.ts:25`) emits `form.xml` | `form.xlsx` at
  root + `media/<filename>`; **no manifest, no mediatype metadata**. JSZip
  (`^3.10.1`) is the only zip lib; also imported by
  `src/core/workspace/archive.ts:28` (its `readWorkspaceArchive` requires
  `manifest.json` and explicitly rejects everything else).
- `parseXForm` and `readXlsForm` leave `document.attachments = []` — the
  importer must **rebuild `doc.attachments` from the `media/` entries**,
  exactly like `src/core/central/import.ts:87-104` does (placeholder `id: ''`,
  `roleFor(filename, mediatype)`, `size: blob.size`; the landing path's
  `remapAttachments` join by **filename** mints real ids).
- Landing primitives already exist: `createFormWithArchiveAttachments(doc,
  ArchiveAttachment[])` / `replaceFormWithArchiveAttachments(existingId, doc,
  atts)` (`src/persistence/forms-repo.ts:83,126`) — atomic, filename-joined,
  `dropUnmatched: true`. `ArchiveAttachment = {filename, mediatype, blob}`
  (`archive.ts:59-63`), `DEFAULT_MEDIATYPE = 'application/octet-stream'`.
- `parseFormFile` (`src/core/import-form.ts:24`) dispatches by extension then
  magic bytes; the `PK` sniff currently always means "xlsx" — a ZIP bundle is
  also `PK`, so the sniff branch must inspect entries.
- `roleFor` (`src/core/model/attachment-role.ts:8`) classifies csv/geojson/xml
  by extension but image/audio/video **by mediatype** — zip entries carry no
  mediatype, so a small pure extension→mediatype map is required or every
  image would land as role `'other'`.
- Collision UI template: `LibraryCentralDrawer.vue:167-180` (lookup by
  `doc.settings.formId` over `formsRepo.listForms()`) + the inline
  copy/replace block (`:229-249`) + danger-confirm on replace (`:150-165`).
- e2e pins that must survive: `tests/e2e/import-export.spec.ts` asserts the
  unsupported-file message contains "not an XForm", and testids
  `import-form`, `import-file-input`, `import-report`, `import-confirm`;
  `library-central-collision-copy/replace` testids in component tests.
- No persistence schema change anywhere in this feature: no new tables/fields,
  so **no Dexie version bump and no workspace-backup format bump**.

## Design

### New pure-core module `src/core/import-zip.ts`

`parseFormBundleZip(data: ArrayBuffer): Promise<ImportParseResult>` (JSZip,
mirroring `archive.ts` conventions; no Vue/Pinia/Dexie/i18n):

1. `JSZip.loadAsync` failure → error issue `import.invalid-zip`
   (`The file could not be read as a ZIP archive.`).
2. `manifest.json` present → error `import.workspace-archive`:
   `This is a Form Forge workspace archive. Import it from Settings → Import workspace.`
3. Root `form.xml` present → `parseXForm` (kind `'xform'`); else root
   `form.xlsx` → `readXlsForm` (kind `'xlsform'`); **both** present → use
   `form.xml`, add warning `import.zip-both-forms`
   (`The ZIP contains both form.xml and form.xlsx; form.xml was imported.`);
   **neither** → error `import.zip-no-form`
   (`The ZIP does not contain a form.xml or form.xlsx file at its root.`).
4. `normalizeDefaultContent` on the parsed doc (same boundary rule as every
   other import seam).
5. Collect direct children of `media/` (pattern `^media\/[^/]+$`, skip
   directory entries; anything else in the zip is ignored silently — export
   never produces it, and tolerating `__MACOSX/` junk beats warning noise).
   Each entry → `ArchiveAttachment { filename, mediatype: mediatypeFor(filename), blob }`.
6. Rebuild `document.attachments` from those entries (Central-import pattern:
   placeholder `id: ''`, `roleFor`, `size`). Referenced-but-absent files
   surface naturally as `ref.missing-attachment` warnings after landing;
   extra unreferenced media files import fine and appear in AttachmentsDialog.

Issue objects: plain literals with stable codes and verbatim-English messages
(same style as `import-form.ts:45-54`).

### `ImportParseResult` gains attachments

`src/core/import-form.ts`: `ImportParseResult` gets optional
`attachments?: ArchiveAttachment[]` (absent/empty for bare files — nothing
else changes for existing consumers; `LibraryCentralDrawer` builds the type
manually and is unaffected).

`parseFormFile` dispatch changes:
- `name.endsWith('.zip')` → `parseFormBundleZip(await file.arrayBuffer())`.
- The extensionless `PK` sniff branch now loads the zip and inspects entries:
  `form.xml`/`form.xlsx` → bundle path; `manifest.json` → workspace-archive
  error; otherwise → `readXlsForm` exactly as today ("not a bundle, not an
  archive" is the sufficient discriminator; don't over-detect xlsx).
- `import.unsupported-file` message extended to
  `"<name>" is not an XForm (.xml), XLSForm (.xlsx) or form ZIP file.` —
  keeps the e2e-asserted `not an XForm` substring.

### New pure helper `mediatypeFor(filename)`

In `src/core/model/attachment-role.ts` next to `roleFor` (same
classification concern, already shared core): extension → mediatype for the
types the app cares about — `csv→text/csv`, `geojson→application/geo+json`,
`xml→text/xml`, images (`png jpg jpeg gif webp svg`), audio (`mp3 wav m4a ogg`),
video (`mp4 webm 3gp`), else `DEFAULT_MEDIATYPE`. (`DEFAULT_MEDIATYPE` stays
in `archive.ts`; import it.)

### UI — `ImportDialog.vue` + shared collision panel

- `FileDropzone` accept becomes `.xml,.xlsx,.xls,.zip`; `dropHint` copy
  updated (en/fr/es).
- `handleFile` unchanged (`parseFormFile` covers routing).
- `onConfirm`:
  - bare file (no `attachments` on the result) → existing
    `formsRepo.createForm(doc)` path, behavior untouched;
  - ZIP bundle → collision check (lookup `doc.settings.formId` in
    `formsRepo.listForms()`): no collision →
    `createFormWithArchiveAttachments(doc, attachments)`; collision → show
    the collision panel (Copy / Replace, replace behind the danger confirm →
    `replaceFormWithArchiveAttachments`). Then close + open editor.
- **Extract the collision block into
  `src/components/importexport/ImportCollisionPanel.vue`** — props
  `{ formId, landing, testidPrefix }` + label props (each host keeps its own
  i18n namespace), emits `copy` / `replace`. Used by `ImportDialog` (prefix
  `import-collision`, new testids `import-collision`,
  `import-collision-copy`, `import-collision-replace`) **and** by
  `LibraryCentralDrawer` (prefix `library-central-collision` — existing
  testids preserved exactly). The danger `confirm.require` stays in each host
  (host-specific copy).
- i18n: new keys under `importExport.import.*` in **all three catalogs**
  (en/fr/es, typecheck-enforced): `collision` ("A form with ID “{formId}”
  already exists…"), `copy`, `replace`, `collisionTitle`, `replaceConfirm`,
  `replaceAccept`, plus updated `dropHint`. Locate the catalog file owning
  `importExport.*` at implementation.

### Explicitly untouched

Serializer/parser/XLSForm io, goldens, persistence schema, workspace archive
format, embed protocol, export code. `exportZip` itself is not modified.

## Tasks

### Task 1 — Save spec documentation (FIRST)

Create `docs/specs/2026-07-17-<HHMM>-zip-bundle-import/`:
- `plan.md` — this plan IN FULL (no summarizing)
- `shape.md` — scope, the 4 decisions, context (three existing import paths,
  why Central import is the template)
- `standards.md` — binding invariants: core purity; backend-seam persistence;
  verbatim-English Issue messages (e2e substring pins); i18n en/fr/es
  three-catalog parity; data-testid preservation
  (`library-central-collision-*` must survive the panel extraction); golden
  byte-stability (no engine files in the diff); conventional commits, no
  co-author trailers; delivery process (workflow → verify → /code-review →
  commit → docs sweep)
- `references.md` — anchors: `src/core/export/zip.ts:25` (layout to consume),
  `src/core/central/import.ts:60-107` (rebuild-attachments template),
  `src/persistence/forms-repo.ts:47-158` (remap/create/replace),
  `src/core/workspace/archive.ts:386-454` (JSZip read conventions +
  manifest detection), `LibraryCentralDrawer.vue:143-180` (collision flow),
  `tests/e2e/import-export.spec.ts` (pinned messages/testids)
- `user-guide.md` — authoring flow + the manual test scenarios (a)–(g) below
- `visuals/` — none (note that)

### Wave 1 — core (T2, then T3)

- **T2 `mediatypeFor` + `parseFormBundleZip`** — helper in
  `attachment-role.ts`; new `src/core/import-zip.ts` per the design. Tests
  (co-located `src/core/import-zip.spec.ts`): **round-trip** — build zips
  with the real `exportZip` (both variants, doc with csv + image attachments)
  and parse back: doc round-trips, attachments carry correct
  mediatype/role/size; both-forms preference + warning; no-form error;
  manifest.json → workspace-archive error; corrupt bytes → invalid-zip;
  nested `media/sub/x.png` ignored; unreferenced media imported;
  referenced-but-absent → ref absent from rebuilt attachments.
- **T3 `parseFormFile` dispatch** — `.zip` extension route, `PK`-sniff entry
  inspection, extended unsupported-file message. Extend
  `tests/unit/import-form.spec.ts`: `.zip` routes to bundle; extensionless
  bundle sniffs correctly; extensionless `.xlsx` still parses as xlsform;
  `not an XForm` substring still present.

### Wave 2 — UI (after Wave 1)

- **T4 ImportDialog + collision panel + i18n** — extract
  `ImportCollisionPanel.vue`, refit `LibraryCentralDrawer.vue` (testids
  byte-identical), extend `ImportDialog.vue` per the design, add the
  `importExport.import.*` keys to en/fr/es. Tests: new
  `tests/component/import-dialog-zip.spec.ts` (memory backend): zip lands
  form + attachment records; collision → copy creates second form; replace
  keeps record id (and publish target survives); workspace-archive zip shows
  the helpful error with confirm disabled; existing
  `import-from-central.spec.ts` stays green (panel refit).

### Wave 3 — e2e + docs

- **T5 e2e** — extend `tests/e2e/import-export.spec.ts`: full in-app round
  trip — import the all-widgets fixture, upload an attachment, export
  `-xform.zip`, delete the form, import the downloaded zip, assert the form
  opens and AttachmentsDialog lists the file. Keep existing tests untouched.
- **T6 docs sweep** — README Features bullet, `docs/product/roadmap.md`
  delivered entry, CLAUDE.md (code-map: `import-zip.ts` row, importexport
  components row, `import-form.ts` mention) — same commit.

## Execution & verification (established delivery process)

Implement via a dynamic Workflow with parallel agents per the wave structure
(cheap models for implementation stages, session model for review). Then:

1. `pnpm test` (unit + component + golden gates — **zero engine-file diffs**),
   `pnpm test:coverage` (floors: core 86/78/88, stores 80/85 — the new core
   module needs the round-trip suite above to hold the floor).
2. `pnpm lint` + `pnpm typecheck` (fr/es catalog parity compile-enforced).
3. `pnpm test:e2e` (chromium + firefox vs built app; filter syntax: NO `--`
   between `pnpm test:e2e` and the filter).
4. Agent-browser manual pass logged to `docs/verification/2026-07-17-zip-bundle-import/`:
   (a) export `-xform.zip` with image+csv → delete form → import zip → form +
   attachments restored, preview renders the image; (b) same with
   `-xlsform.zip`; (c) import when form_id exists → Copy creates a second
   form; Replace (after danger confirm) keeps the record id; (d) drop a
   `.formforge.zip` on Import form → helpful error, confirm disabled;
   (e) zip without form.* → error; (f) zip with an extra unreferenced media
   file → imported, listed in AttachmentsDialog; (g) hand-built zip with both
   form.xml + form.xlsx → xml wins, warning shown, "confirm anyway" label.
5. `/code-review` (five lenses, no plan mode); fix findings immediately.
6. Conventional commit (no co-author trailers), e.g.
   `feat(import): import per-form ZIP bundles with attachments`; README,
   roadmap, CLAUDE.md updated in the same change.
