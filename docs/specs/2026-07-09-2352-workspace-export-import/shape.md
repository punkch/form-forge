# F1 — Workspace Export / Import — Shaping Notes

Shaped from `docs/specs/backlog/workspace-export-import.md`.

## Problem

All data lives in one browser's IndexedDB. Users need protection against
profile resets, a way to move between machines, and a way to hand a whole
form collection (or a single lossless form) to a colleague — without a
server.

## Scope

- Export the whole workspace, or a single form, as a `.odkbuilder.zip`.
- Import such an archive into the current library (doubles as "restore
  backup" and "receive a shared form" — same container, one or many forms).
- Split delivery: pure logic + persistence first (this change), UI second.

## Decisions

- **New ids, never overwrite.** Import always mints fresh record ids and
  fresh attachment ids (remapped into `doc.attachments` exactly like
  `duplicateForm`). There is no merge/replace mode in v1 — re-importing a
  backup next to live forms yields duplicates plus warnings, which is
  predictable and safe. `formId` collisions warn
  (`workspace.duplicate-form-id`) but never block.
- **Snapshots excluded.** Autosave/manual snapshots are working state, not
  content; including them would bloat archives and complicate identity
  remapping for little value. `createdAt` is preserved via `meta.json`;
  `updatedAt` becomes the import time so restored forms sort to the top.
- **Orphan-safe gathering.** Export walks `doc.attachments[].id` through
  the attachments repo instead of `listAttachments(formRecordId)`: the
  attachments table can contain orphaned records (AttachmentsDialog
  re-upload adds a new record without deleting the replaced one until
  `pruneOrphans` runs), and those must never leak into an archive.
- **Two version numbers.** `manifest.formatVersion` versions the zip
  layout; `FormDocument.schemaVersion` versions each payload through the
  new `migrateDoc()` (which did not previously exist — it was only reserved
  in the model docs). Reading tolerates unknown *extra* files but rejects
  unknown *greater* versions of either.
- **Tolerant doc gate, not a schema check.** `migrateDoc` verifies object
  shape + required top-level fields only; deep validation stays with the
  form validators. Missing `schemaVersion` is treated as unsupported (all
  documents this app ever persisted have it).
- **Per-form transactions on import.** One Dexie `rw` tx per form so a
  failing form skips with an issue instead of rolling back the whole
  archive — mirroring the read side, where a corrupt `form.json` skips just
  that form (`workspace.form-unreadable`).
- **Helpful "not an archive" error.** An `.xlsx` workbook is also a PK zip,
  so the missing-manifest message explicitly says the zip is not a
  workspace archive and points at "Import form" for XLSForms.
- **No encryption in v1** — plain zip; document that it contains
  everything. (Zip passwords are weak crypto; if demanded, age/WebCrypto
  under a separate spec.)
- **No selective export in v1** beyond whole-workspace vs single form
  (`gatherArchiveForms(recordIds?)` already supports subsets for the
  per-row action).

## Out of scope

- Merge/overwrite import modes, conflict resolution UI.
- Snapshot export, encrypted archives, cloud sync.
- Import of foreign zips (XLSForm import already exists separately).
